import { GoogleGenAI } from '@google/genai';

/** The only file that knows Bellhop runs on Gemini. */
const MODEL = 'gemini-3.8-flash';

export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

/** Throws before the first chunk on a missing key or an API error, so the route can answer with a status. */
export async function streamReply(system: string, turns: ChatTurn[]): Promise<AsyncGenerator<string>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  const stream = await new GoogleGenAI({ apiKey }).models.generateContentStream({
    model: MODEL,
    contents: turns.map((t) => ({ role: t.role === 'user' ? 'user' : 'model', parts: [{ text: t.text }] })),
    config: { systemInstruction: system },
  });
  return (async function* () {
    for await (const chunk of stream) if (chunk.text) yield chunk.text;
  })();
}
