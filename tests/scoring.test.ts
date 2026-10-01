import { test } from "node:test";
import assert from "node:assert/strict";
import { fixWeights, overallConfidence, priority, quoteInCv, validateRubric, verifyScores, weightedTotal } from "../src/lib/scoring.ts";
import { pseudonymise, splitPii } from "../src/lib/pii.ts";
import type { Criterion, CriterionScore, Hire } from "../src/lib/types.ts";

const crit = (id: string, weight: number, hires = ["Meghna"]): Criterion => ({
  id, name: id, description: "", weight, anchors: { "1": "", "3": "", "5": "" }, source_hires: hires, contrast: "",
});
const sc = (id: string, score: number, confidence: "HIGH" | "MEDIUM" | "LOW" = "HIGH", quote = ""): CriterionScore => ({
  criterion_id: id, score, confidence, evidence_quote: quote, reason: "",
});
const RUBRIC = [crit("a", 30), crit("b", 25), crit("c", 25), crit("d", 20)];
const HIRES: Hire[] = [
  { id: "1", name: "Meghna", role: "PM", rating: "Exceeds", profile: "", created_at: "" },
  { id: "2", name: "Rahul", role: "PM", rating: "Meets", profile: "", created_at: "" },
];

test("weighted total", () => {
  assert.equal(weightedTotal(RUBRIC, RUBRIC.map((c) => sc(c.id, 5))), 100);
  assert.equal(weightedTotal(RUBRIC, RUBRIC.map((c) => sc(c.id, 1))), 20);
  assert.equal(weightedTotal(RUBRIC, [sc("a", 5), sc("b", 3), sc("c", 3), sc("d", 1)]), 30 + 15 + 15 + 4);
  assert.equal(weightedTotal(RUBRIC, []), 20); // missing scores count as 1, never 0
});

test("confidence rule", () => {
  assert.equal(overallConfidence(RUBRIC, RUBRIC.map((c) => sc(c.id, 3, "HIGH"))), "HIGH");
  assert.equal(overallConfidence(RUBRIC, [sc("a", 3, "LOW"), sc("b", 3, "LOW"), sc("c", 3), sc("d", 3)]), "LOW");
  assert.equal(overallConfidence(RUBRIC, [sc("a", 3, "LOW"), sc("b", 3), sc("c", 3), sc("d", 3)]), "MEDIUM");
});

test("priority labels", () => {
  assert.equal(priority(85), "STRONG REVIEW");
  assert.equal(priority(84.9), "REVIEW");
  assert.equal(priority(55), "POSSIBLE");
  assert.equal(priority(54.9), "LOWER PRIORITY");
});

test("quote verification", () => {
  const cv = "Churn on managed accounts over the past 12 months: 6% against a team average of 24%";
  assert.ok(quoteInCv("churn on managed accounts over the past 12 months: 6%", cv));
  assert.ok(quoteInCv("Churn on managed accounts ... team average of 24%", cv));
  assert.ok(!quoteInCv("Churn reduced to 2%", cv));
  const [v] = verifyScores([sc("a", 5, "HIGH", "Led a team of 40")], cv);
  assert.equal(v.verified, false);
  assert.equal(v.confidence, "LOW");
});

test("rubric validation", () => {
  assert.deepEqual(validateRubric(RUBRIC, HIRES), []);
  assert.ok(validateRubric(RUBRIC.slice(0, 3), HIRES).some((p) => p.includes("4–6")));
  assert.ok(validateRubric([...RUBRIC.slice(0, 3), crit("d", 10)], HIRES).some((p) => p.includes("100%")));
  assert.ok(validateRubric([...RUBRIC.slice(0, 3), crit("d", 20, ["Rahul"])], HIRES).some((p) => p.includes("trace")));
});

test("fixWeights sums to 100", () => {
  for (const w of [[1, 1, 1], [30, 30, 30, 30], [10, 20, 33, 7, 2]]) {
    assert.equal(fixWeights(w).reduce((a, b) => a + b, 0), 100);
  }
});

test("PII split", () => {
  const text = "Jane Doe\njane.doe@mail.com · +91 98100 47293 · Mumbai\nProfile\nDate of Birth: 1 Jan 1990\nJane led onboarding 2019-2022.";
  const p = splitPii(text, "cv.docx");
  assert.equal(p.name, "Jane Doe");
  assert.equal(p.email, "jane.doe@mail.com");
  assert.equal(p.phone, "+91 98100 47293");
  for (const leak of ["jane.doe@mail.com", "47293", "1990", "Jane", "Doe"]) assert.ok(!p.content.includes(leak), leak);
  assert.ok(p.content.includes("2019-2022"));
});

test("hire pseudonymisation", () => {
  assert.equal(pseudonymise("Meghna Tiwari joined; Meghna shipped fast.", "Meghna Tiwari", "H1"), "H1 joined; H1 shipped fast.");
});
