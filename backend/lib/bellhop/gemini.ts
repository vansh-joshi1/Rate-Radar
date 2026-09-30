import { GoogleGenAI, type GenerateContentResponse, type GroundingMetadata } from '@google/genai';

/**
 * The only file that knows Bellhop runs on Gemini. Tried in order: the free
 * tier regularly answers 503 "high demand" on Flash while Flash-Lite still serves.
 */
const MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash-lite'];

/** Appended whenever the model answers without search: in the demo, or when the grounded attempt failed. */
const SEARCH_OFF =
  'WEB SEARCH IS OFF for this answer. For anything outside the DATA, say you cannot look that up right now.';

export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

/** Where a searched answer came from. Google's terms: show `suggestions` with the answer, unmodified. */
export interface Grounding {
  sources: { title: string; uri: string }[];
  suggestions?: string;
}

export type ReplyPart = { text: string } | { grounding: Grounding };

/** Sources one link per site (Gemini titles web chunks by domain), plus the Search Suggestions HTML. */
export function groundingFrom(meta: GroundingMetadata | undefined): Grounding | null {
  const sources = new Map<string, { title: string; uri: string }>();
  for (const { web } of meta?.groundingChunks ?? []) {
    // Rendered as a link: only http(s), never a javascript: URI from upstream.
    if (!web?.uri || !/^https?:\/\//i.test(web.uri)) continue;
    const title = web.title || web.uri;
    if (!sources.has(title)) sources.set(title, { title, uri: web.uri });
  }
  const suggestions = meta?.searchEntryPoint?.renderedContent;
  return sources.size || suggestions ? { sources: [...sources.values()], suggestions } : null;
}

/**
 * Throws before the first part on a missing key or when every attempt fails,
 * so the route can answer with a status. With `search`, one grounded attempt
 * goes first; if it fails, Bellhop still answers rate questions without it.
 */
export async function streamReply(
  system: string,
  turns: ChatTurn[],
  { search }: { search: boolean }
): Promise<AsyncGenerator<ReplyPart>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  const ai = new GoogleGenAI({ apiKey });
  const contents = turns.map((t) => ({ role: t.role === 'user' ? 'user' : 'model', parts: [{ text: t.text }] }));
  // One grounded try: the search quota is shared across models, so a 429 on Flash is a 429 on Lite.
  // ponytail: an overloaded (503) Flash drops search too; add a Lite + search attempt if that shows up.
  const attempts = [
    ...(search ? [{ model: MODELS[0], grounded: true }] : []),
    ...MODELS.map((model) => ({ model, grounded: false })),
  ];
  let stream: AsyncGenerator<GenerateContentResponse> | undefined;
  let lastError: unknown;
  for (const { model, grounded } of attempts) {
    try {
      stream = await ai.models.generateContentStream({
        model,
        contents,
        config: grounded
          ? { systemInstruction: system, tools: [{ googleSearch: {} }] }
          : { systemInstruction: `${system}\n\n${SEARCH_OFF}` },
      });
      break;
    } catch (err) {
      lastError = err;
    }
  }
  if (!stream) throw lastError;
  const reply = stream;
  return (async function* () {
    // Grounding metadata rides on the closing chunks; merge whatever arrives.
    let meta: GroundingMetadata | undefined;
    for await (const chunk of reply) {
      if (chunk.text) yield { text: chunk.text };
      const m = chunk.candidates?.[0]?.groundingMetadata;
      if (m) meta = { ...meta, ...m };
    }
    const grounding = groundingFrom(meta);
    if (grounding) yield { grounding };
  })();
}
