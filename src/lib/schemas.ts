// JSON schemas for Gemini's structured output.
import type { Role } from "./types";

const str = { type: "string" };
const obj = (properties: Record<string, object>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

const criterionOut = obj({
  name: str,
  description: str,
  weight: { type: "integer", minimum: 1, maximum: 100 },
  anchor_1: str,
  anchor_3: str,
  anchor_5: str,
  source_hires: { type: "array", items: str, minItems: 1 },
  contrast: str,
});

export const RUBRIC_SCHEMA = obj({
  PM: { type: "array", items: criterionOut, minItems: 4, maxItems: 6 },
  SPM: { type: "array", items: criterionOut, minItems: 4, maxItems: 6 },
  notes: str,
});

export interface RubricOut {
  PM: RawCriterion[];
  SPM: RawCriterion[];
  notes: string;
}
export interface RawCriterion {
  name: string;
  description: string;
  weight: number;
  anchor_1: string;
  anchor_3: string;
  anchor_5: string;
  source_hires: string[];
  contrast: string;
}

export function scoreSchema(ids: Partial<Record<Role, string[]>>) {
  const perRole: Record<string, object> = {};
  for (const [role, list] of Object.entries(ids)) {
    if (!list?.length) continue;
    perRole[role] = {
      type: "array",
      minItems: list.length,
      maxItems: list.length,
      items: obj({
        criterion_id: { type: "string", enum: list },
        score: { type: "integer", enum: [1, 2, 3, 4, 5] },
        confidence: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
        evidence_quote: str,
        reason: str,
      }),
    };
  }
  return obj({
    ...perRole,
    brief: str,
    strengths: { type: "array", items: str, minItems: 1, maxItems: 3 },
    concern: str,
    pm_years_note: str,
  });
}

export const EMAIL_SCHEMA = obj({ subject: str, body: str });
