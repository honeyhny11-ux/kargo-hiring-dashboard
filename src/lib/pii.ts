// Splits identifiers (name, email, phone) from CV content at extraction time.
// Only the redacted content is ever sent to Gemini; identifiers stay in Supabase.

const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;
const PHONE_RE = /\+?\d[\d\s().-]{7,}\d/g;
const URL_RE = /(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com|github\.com)\/\S+|https?:\/\/\S+/i;
const SENSITIVE_LINE_RE =
  /^\s*(date of birth|dob|d\.o\.b|age|gender|sex|marital status|nationality|religion|caste|father'?s name|mother'?s name|spouse|children|photo|address|permanent address|health|blood group)\b/i;
const SECTION_RE =
  /^\s*(profile|summary|professional summary|about( me)?|experience|work experience|professional experience|employment|education|skills|projects|career objective|objective)\s*$/i;

export interface PiiSplit {
  name: string;
  email: string;
  phone: string;
  content: string; // CV text with identifiers removed
}

export function splitHeader(text: string): { header: string; body: string } {
  const lines = text.split("\n");
  for (let i = 0; i < Math.min(lines.length, 8); i++) {
    if (SECTION_RE.test(lines[i].trim())) {
      return { header: lines.slice(0, i).join("\n"), body: lines.slice(i).join("\n") };
    }
  }
  const nonEmpty = lines.map((l, i) => (l.trim() ? i : -1)).filter((i) => i >= 0);
  const cut = nonEmpty.length >= 3 ? nonEmpty[2] + 1 : lines.length;
  return { header: lines.slice(0, cut).join("\n"), body: lines.slice(cut).join("\n") };
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

export function guessName(header: string, filename: string): string {
  for (const raw of header.split("\n")) {
    const line = raw.trim();
    if (!line || EMAIL_RE.test(line) || new RegExp(PHONE_RE.source).test(line)) continue;
    const words = line.split(/\s+/);
    if (words.length > 1 && words.length <= 4 && words.every((w) => /^[A-Za-z.'-]+$/.test(w))) {
      return titleCase(line);
    }
    break;
  }
  const stem = filename.replace(/\.[^.]+$/, "").replace(/^(cv|resume)[_\- ]*\d*[_\- ]*/i, "");
  return titleCase(stem.replace(/[_-]+/g, " ").trim()) || "Unknown";
}

function isPhone(match: string): boolean {
  // Date ranges like "2019-2022" match the loose pattern; real phone numbers have 10+ digits.
  return match.replace(/\D/g, "").length >= 10;
}

export function redact(text: string, name: string): string {
  const tokens = name.split(/\s+/).filter((t) => t.length >= 3);
  return text
    .split("\n")
    .map((line) => {
      if (SENSITIVE_LINE_RE.test(line)) return "[personal detail removed]";
      // Contact lines usually carry phone and home location too, so drop the whole line.
      if (EMAIL_RE.test(line) || URL_RE.test(line)) return "[contact details removed]";
      let out = line.replace(PHONE_RE, (m) => (isPhone(m) ? "[phone removed]" : m));
      for (const t of tokens) {
        out = out.replace(new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), "[Candidate]");
      }
      return out;
    })
    .join("\n");
}

export function splitPii(text: string, filename: string): PiiSplit {
  const { header } = splitHeader(text);
  const name = guessName(header, filename);
  const email = text.match(EMAIL_RE)?.[0] ?? "";
  const phone = (text.match(PHONE_RE) ?? []).find(isPhone)?.trim() ?? "";
  return { name, email, phone, content: redact(text, name) };
}

/** Replace hire names with labels (H1, H2...) before the profiles go to Gemini. */
export function pseudonymise(text: string, name: string, label: string): string {
  let out = text;
  for (const t of [name, ...name.split(/\s+/)].filter((t) => t.length >= 3)) {
    out = out.replace(new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), label);
  }
  return out.replace(new RegExp(EMAIL_RE.source, "g"), "[email removed]");
}
