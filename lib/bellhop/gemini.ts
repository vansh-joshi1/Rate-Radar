import { GoogleGenAI } from '@google/genai';

/**
 * The only file that knows Bellhop runs on Gemini. Tried in order: the free
 * tier regularly answers 503 "high demand" on Flash while Flash-Lite still serves.
 */
const MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash-lite'];

export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

/** Throws before the first chunk on a missing key or an API error, so the route can answer with a status. */
export async function streamReply(system: string, turns: ChatTurn[]): Promise<AsyncGenerator<string>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  const ai = new GoogleGenAI({ apiKey });
  const contents = turns.map((t) => ({ role: t.role === 'user' ? 'user' : 'model', parts: [{ text: t.text }] }));
  let stream: AsyncGenerator<{ text?: string }> | undefined;
  let lastError: unknown;
  for (const model of MODELS) {
    try {
      stream = await ai.models.generateContentStream({ model, contents, config: { systemInstruction: system } });
      break;
    } catch (err) {
      lastError = err;
    }
  }
  if (!stream) throw lastError;
  return (async function* () {
    for await (const chunk of stream) if (chunk.text) yield chunk.text;
  })();
}
