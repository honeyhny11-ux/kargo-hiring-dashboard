import "server-only";
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";

/** Plain text from a DOCX, PDF or TXT upload. */
export async function fileToText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());
  let text: string;
  if (name.endsWith(".docx")) {
    text = (await mammoth.extractRawText({ buffer: buf })).value;
  } else if (name.endsWith(".pdf")) {
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const out = await extractText(pdf, { mergePages: true });
    text = Array.isArray(out.text) ? out.text.join("\n") : out.text;
  } else if (name.endsWith(".txt") || name.endsWith(".md")) {
    text = buf.toString("utf8");
  } else {
    throw new Error("Unsupported file type. Use .docx, .pdf or .txt");
  }
  return text.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
}
