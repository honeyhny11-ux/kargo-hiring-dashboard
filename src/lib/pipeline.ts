import "server-only";
import { geminiJson } from "./gemini";
import { emailPrompt, rubricPrompt, scorePrompt } from "./prompts";
import { EMAIL_SCHEMA, RUBRIC_SCHEMA, scoreSchema, type RubricOut } from "./schemas";
import { fixWeights, overallConfidence, verifyScores, weightedTotal } from "./scoring";
import { pseudonymise } from "./pii";
import { audit, db, must } from "./supabase";
import { ROLE_KEYS, type Candidate, type Criterion, type CriterionScore, type Hire, type Role, type Rubric } from "./types";

export async function approvedRubrics(): Promise<Partial<Record<Role, Rubric>>> {
  const rows = must(await db().from("rubric").select("*").eq("status", "approved")) as Rubric[];
  return Object.fromEntries(rows.map((r) => [r.role, r]));
}

// ---------------------------------------------------------------- rubric from past hires

export async function generateRubrics(): Promise<void> {
  const hires = must(await db().from("hires").select("*").order("created_at")) as Hire[];
  if (!hires.some((h) => h.rating === "Exceeds")) throw new Error("Add at least one \"Exceeds\" hire first.");
  if (!hires.some((h) => h.rating !== "Exceeds")) throw new Error("Add at least one weaker (Meets/Below) hire to contrast against.");

  // Hire names are replaced with labels before they reach Gemini, then mapped back.
  const labelled = hires.map((h, i) => ({ ...h, label: `H${i + 1}` }));
  const byLabel = new Map(labelled.map((h) => [h.label, h.name]));
  const out = await geminiJson<RubricOut>(
    rubricPrompt(labelled.map((h) => ({ label: h.label, role: h.role, rating: h.rating, profile: pseudonymise(h.profile, h.name, h.label) }))),
    RUBRIC_SCHEMA,
  );

  for (const role of ROLE_KEYS) {
    const raw = out[role];
    const weights = fixWeights(raw.map((c) => c.weight));
    const criteria: Criterion[] = raw.map((c, i) => ({
      id: `c${i + 1}`,
      name: c.name,
      description: c.description,
      weight: weights[i],
      anchors: { "1": c.anchor_1, "3": c.anchor_3, "5": c.anchor_5 },
      source_hires: c.source_hires.map((l) => byLabel.get(l.trim())).filter((n): n is string => Boolean(n)),
      contrast: c.contrast.replace(/\bH\d+\b/g, (l) => byLabel.get(l) ?? l),
    }));
    const latest = must(await db().from("rubric").select("version").eq("role", role).order("version", { ascending: false }).limit(1)) as { version: number }[];
    must(await db().from("rubric").update({ status: "retired" }).eq("role", role).eq("status", "draft"));
    must(await db().from("rubric").insert({
      role,
      version: (latest[0]?.version ?? 0) + 1,
      status: "draft",
      criteria,
      notes: out.notes.replace(/\bH\d+\b/g, (l) => byLabel.get(l) ?? l),
    }));
  }
  await audit("rubric_generated", `${hires.length} hires`);
}

// ---------------------------------------------------------------- scoring

interface ScoreOut {
  PM?: CriterionScore[];
  SPM?: CriterionScore[];
  brief: string;
  strengths: string[];
  concern: string;
  pm_years_note: string;
}

export async function scoreCandidate(id: string): Promise<void> {
  const candidate = must(await db().from("candidates").select("*").eq("id", id).single()) as Candidate;
  const { content } = must(await db().from("candidate_content").select("content").eq("candidate_id", id).single()) as { content: string };
  const rubrics = await approvedRubrics();
  if (!rubrics[candidate.applied_role]) {
    throw new Error(`Approve the ${candidate.applied_role} rubric on the Rubric page first.`);
  }
  must(await db().from("candidates").update({ status: "scoring", error: null }).eq("id", id));

  try {
    const criteria = Object.fromEntries(ROLE_KEYS.filter((r) => rubrics[r]).map((r) => [r, rubrics[r]!.criteria])) as Partial<Record<Role, Criterion[]>>;
    // Only the redacted content goes to Gemini.
    const out = await geminiJson<ScoreOut>(
      scorePrompt(content, candidate.applied_role, criteria),
      scoreSchema(Object.fromEntries(Object.entries(criteria).map(([r, cs]) => [r, cs!.map((c) => c.id)]))),
    );

    for (const role of Object.keys(criteria) as Role[]) {
      const rubric = rubrics[role]!;
      const returned = new Map((out[role] ?? []).map((s) => [s.criterion_id, s]));
      const complete: CriterionScore[] = rubric.criteria.map(
        (c) => returned.get(c.id) ?? { criterion_id: c.id, score: 1, confidence: "LOW", evidence_quote: "", reason: "Not returned by the model; treat as not assessed." },
      );
      const verified = verifyScores(complete, content);
      must(await db().from("scores").upsert(
        {
          candidate_id: id,
          role,
          rubric_id: rubric.id,
          criteria: verified,
          total: weightedTotal(rubric.criteria, verified),
          confidence: overallConfidence(rubric.criteria, verified),
          created_at: new Date().toISOString(),
        },
        { onConflict: "candidate_id,role" },
      ));
    }
    must(await db().from("candidates").update({
      status: "scored",
      brief: out.brief,
      strengths: out.strengths.slice(0, 3),
      concern: out.concern,
      pm_years_note: out.pm_years_note,
    }).eq("id", id));
    await audit("scored", "", id);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db().from("candidates").update({ status: "error", error: message }).eq("id", id);
    await audit("score_error", message, id);
    throw e;
  }
}

// ---------------------------------------------------------------- email drafts

export async function draftEmail(candidateId: string, kind: "INVITE" | "REJECT", note: string): Promise<void> {
  const c = must(await db().from("candidates").select("*").eq("id", candidateId).single()) as Candidate;
  // Gemini writes "{{first_name}}"; the name is filled in here and never sent to the model.
  const out = await geminiJson<{ subject: string; body: string }>(emailPrompt(kind, c.applied_role, note), EMAIL_SCHEMA);
  const firstName = c.name.split(/\s+/)[0] || "there";
  const fill = (s: string) => s.replace(/\{\{\s*first_name\s*\}\}/g, firstName);
  must(await db().from("emails").update({ status: "discarded" }).eq("candidate_id", candidateId).eq("status", "draft"));
  must(await db().from("emails").insert({ candidate_id: candidateId, kind, to_email: c.email, subject: fill(out.subject), body: fill(out.body) }));
  await audit("email_drafted", kind, candidateId);
}
