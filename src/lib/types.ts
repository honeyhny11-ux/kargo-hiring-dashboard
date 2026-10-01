export type Role = "PM" | "SPM";
export const ROLES: Record<Role, string> = { PM: "Product Manager", SPM: "Senior Product Manager" };
export const ROLE_KEYS: Role[] = ["PM", "SPM"];

export type Rating = "Exceeds" | "Meets" | "Below";
export type Confidence = "HIGH" | "MEDIUM" | "LOW";

export interface Hire {
  id: string;
  name: string;
  role: Role;
  rating: Rating;
  profile: string;
  created_at: string;
}

export interface Criterion {
  id: string;
  name: string;
  description: string;
  weight: number; // percent, all criteria in a rubric add up to 100
  anchors: { "1": string; "3": string; "5": string };
  source_hires: string[]; // names of the Exceeds hires who show it
  contrast: string; // how the weaker hires differ
}

export interface Rubric {
  id: string;
  role: Role;
  version: number;
  status: "draft" | "approved" | "retired";
  criteria: Criterion[];
  notes: string;
  created_at: string;
}

export interface CriterionScore {
  criterion_id: string;
  score: number; // 1-5
  confidence: Confidence;
  evidence_quote: string; // copied from the CV, or "" when there is none
  reason: string;
  verified?: boolean | null; // quote found in the CV text?
}

export interface Score {
  id: string;
  candidate_id: string;
  role: Role;
  rubric_id: string;
  criteria: CriterionScore[];
  total: number;
  confidence: Confidence;
  created_at: string;
}

export interface Candidate {
  id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string;
  filename: string;
  applied_role: Role;
  status: "pending" | "scoring" | "scored" | "error";
  error: string | null;
  brief: string | null;
  strengths: string[] | null;
  concern: string | null;
  pm_years_note: string | null;
  decision: "INVITE" | "REJECT" | null;
  decided_at: string | null;
}

export interface EmailDraft {
  id: string;
  candidate_id: string;
  kind: "INVITE" | "REJECT";
  to_email: string;
  subject: string;
  body: string;
  status: "draft" | "sent" | "failed" | "discarded";
  error: string | null;
  created_at: string;
  sent_at: string | null;
  resend_id: string | null;
}
