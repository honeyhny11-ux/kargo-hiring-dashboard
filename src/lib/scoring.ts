// Deterministic scoring maths. Gemini gives 1-5 per criterion with evidence;
// totals, confidence and priority labels are computed here, identically for everyone.

import type { Confidence, Criterion, CriterionScore, Hire } from "./types.ts";

export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’‚′`]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/₹/g, "rs")
    .replace(/[^\w%'"\-.,/+]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when every fragment of the quote (split on "...") appears in the CV text. */
export function quoteInCv(quote: string, cv: string): boolean {
  const hay = normalise(cv);
  const parts = quote.split(/\.\.\.|…/).map((p) => normalise(p).replace(/^[ .,]+|[ .,]+$/g, "")).filter(Boolean);
  if (parts.length === 0) return false;
  return parts.every((p) => p.length >= 4 && hay.includes(p));
}

/** Mark each quote verified or not; an unverifiable quote drops that criterion's confidence to LOW. */
export function verifyScores(scores: CriterionScore[], cv: string): CriterionScore[] {
  return scores.map((s) => {
    if (!s.evidence_quote.trim()) return { ...s, verified: null };
    const verified = quoteInCv(s.evidence_quote, cv);
    return { ...s, verified, confidence: verified ? s.confidence : "LOW" };
  });
}

export function weightedTotal(criteria: Criterion[], scores: CriterionScore[]): number {
  const byId = new Map(scores.map((s) => [s.criterion_id, s]));
  let total = 0;
  for (const c of criteria) {
    const s = byId.get(c.id);
    const raw = Math.min(5, Math.max(1, Math.round(s?.score ?? 1)));
    total += (raw / 5) * c.weight;
  }
  return Math.round(total * 10) / 10;
}

/** HIGH if >=60% of weight is HIGH and <=15% LOW; LOW if >40% LOW; otherwise MEDIUM. */
export function overallConfidence(criteria: Criterion[], scores: CriterionScore[]): Confidence {
  const byId = new Map(scores.map((s) => [s.criterion_id, s]));
  const sum = criteria.reduce((a, c) => a + c.weight, 0) || 1;
  const share = (level: Confidence) =>
    criteria.filter((c) => (byId.get(c.id)?.confidence ?? "LOW") === level).reduce((a, c) => a + c.weight, 0) / sum;
  if (share("LOW") > 0.4) return "LOW";
  if (share("HIGH") >= 0.6 && share("LOW") <= 0.15) return "HIGH";
  return "MEDIUM";
}

export function priority(total: number): string {
  if (total >= 85) return "STRONG REVIEW";
  if (total >= 70) return "REVIEW";
  if (total >= 55) return "POSSIBLE";
  return "LOWER PRIORITY";
}

/** Rubric rules from the class brief. Returns a list of problems; empty means it can be approved. */
export function validateRubric(criteria: Criterion[], hires: Hire[]): string[] {
  const problems: string[] = [];
  if (criteria.length < 4 || criteria.length > 6) problems.push(`Needs 4–6 criteria (has ${criteria.length}).`);
  const sum = criteria.reduce((a, c) => a + c.weight, 0);
  if (sum !== 100) problems.push(`Weights must add up to 100% (currently ${sum}%).`);
  const exceeds = new Set(hires.filter((h) => h.rating === "Exceeds").map((h) => h.name.toLowerCase()));
  for (const c of criteria) {
    if (!c.name.trim()) problems.push("A criterion has no name.");
    if (c.weight <= 0) problems.push(`"${c.name}" needs a weight above 0.`);
    const traced = c.source_hires.filter((n) => exceeds.has(n.toLowerCase()));
    if (traced.length === 0) problems.push(`"${c.name}" doesn't trace back to any "Exceeds" hire.`);
  }
  return problems;
}

/** Make integer weights add to exactly 100, keeping proportions. */
export function fixWeights(weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return weights.map(() => Math.floor(100 / weights.length));
  const scaled = weights.map((w) => (w / sum) * 100);
  const out = scaled.map(Math.floor);
  let rest = 100 - out.reduce((a, b) => a + b, 0);
  const order = scaled.map((w, i) => [w - Math.floor(w), i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; rest > 0; k++, rest--) out[order[k % order.length][1]]++;
  return out;
}
