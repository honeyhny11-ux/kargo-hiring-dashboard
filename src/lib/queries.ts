import "server-only";
import { approvedRubrics } from "./pipeline";
import { db, must } from "./supabase";
import type { Candidate, EmailDraft, Role, Score } from "./types";

export type CandidateRow = Candidate & { scores: Partial<Record<Role, Score>>; emailStatus: string | null };

export async function loadCandidates(): Promise<CandidateRow[]> {
  const [cands, scores, emails] = await Promise.all([
    db().from("candidates").select("*").order("created_at"),
    db().from("scores").select("*"),
    db().from("emails").select("candidate_id,status,kind").neq("status", "discarded"),
  ]);
  const byCand = new Map<string, Partial<Record<Role, Score>>>();
  for (const s of must(scores) as Score[]) {
    byCand.set(s.candidate_id, { ...byCand.get(s.candidate_id), [s.role]: { ...s, total: Number(s.total) } });
  }
  const mail = new Map<string, string>();
  for (const e of must(emails) as Pick<EmailDraft, "candidate_id" | "status" | "kind">[]) {
    if (e.status === "sent" || !mail.has(e.candidate_id)) mail.set(e.candidate_id, `${e.kind} ${e.status}`);
  }
  return (must(cands) as Candidate[]).map((c) => ({ ...c, scores: byCand.get(c.id) ?? {}, emailStatus: mail.get(c.id) ?? null }));
}

export async function loadCandidate(id: string) {
  const [c, emails, rubrics] = await Promise.all([
    db().from("candidates").select("*").eq("id", id).maybeSingle(),
    db().from("emails").select("*").eq("candidate_id", id).neq("status", "discarded").order("created_at", { ascending: false }),
    approvedRubrics(),
  ]);
  const candidate = must(c) as Candidate | null;
  if (!candidate) return null;
  const scores = must(await db().from("scores").select("*").eq("candidate_id", id)) as Score[];
  // Show each score against the rubric version it was made with.
  const rubricIds = [...new Set(scores.map((s) => s.rubric_id))];
  const usedRubrics = rubricIds.length ? must(await db().from("rubric").select("*").in("id", rubricIds)) : [];
  return { candidate, emails: must(emails) as EmailDraft[], scores, usedRubrics, approved: rubrics };
}
