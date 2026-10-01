import "server-only";
import { GoogleGenAI } from "@google/genai";
import { SYSTEM } from "./prompts";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
let ai: GoogleGenAI | null = null;

export const geminiModel = MODEL;

/** One stateless Gemini call that must return JSON matching `schema`. Content only: never pass names, emails or phones. */
export async function geminiJson<T>(input: string, schema: object): Promise<T> {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set in .env.local");
  ai ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  let text: string | undefined;
  try {
    const interaction = await ai.interactions.create({
      model: MODEL,
      system_instruction: SYSTEM,
      input,
      // Don't keep candidate content on Google's side after the call.
      store: false,
      response_format: { type: "text", mime_type: "application/json", schema },
    } as Parameters<typeof ai.interactions.create>[0]);
    text = (interaction as { output_text?: string }).output_text;
  } catch (e) {
    throw new Error(`Gemini request failed: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!text) throw new Error("Gemini returned no output.");
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Gemini returned invalid JSON.");
  }
}
