"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sendViaResend } from "@/lib/email";
import { fileToText } from "@/lib/extract";
import { splitPii } from "@/lib/pii";
import { draftEmail, generateRubrics } from "@/lib/pipeline";
import { validateRubric } from "@/lib/scoring";
import { audit, db, must } from "@/lib/supabase";
import type { Criterion, EmailDraft, Hire, Rating, Role, Rubric } from "@/lib/types";

const asRole = (v: FormDataEntryValue | null): Role => (v === "SPM" ? "SPM" : "PM");
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

// ---------------------------------------------------------------- CV upload

export type UploadResult = { file: string; ok: boolean; name?: string; email?: string; error?: string }[];

export async function uploadCvs(_prev: UploadResult | null, form: FormData): Promise<UploadResult> {
  const role = asRole(form.get("role"));
  const results: UploadResult = [];
  for (const entry of form.getAll("files")) {
    if (!(entry instanceof File) || !entry.name) continue;
    try {
      const text = await fileToText(entry);
      if (text.length < 200) throw new Error("Very little text found (scanned image PDF?). Upload a text-based file.");
      // PII split happens here, before anything else touches the CV.
      const pii = splitPii(text, entry.name);
      const { id } = must(await db().from("candidates").insert({
        name: pii.name, email: pii.email, phone: pii.phone, filename: entry.name, applied_role: role,
      }).select("id").single()) as { id: string };
      must(await db().from("candidate_content").insert({ candidate_id: id, content: pii.content }));
      await audit("uploaded", entry.name, id);
      results.push({ file: entry.name, ok: true, name: pii.name, email: pii.email });
    } catch (e) {
      results.push({ file: entry.name, ok: false, error: msg(e) });
    }
  }
  revalidatePath("/");
  return results;
}

export async function updateCandidate(form: FormData) {
  const id = String(form.get("id"));
  must(await db().from("candidates").update({
    name: String(form.get("name")).trim(), email: String(form.get("email")).trim(),
  }).eq("id", id));
  await audit("details_edited", "", id);
  revalidatePath(`/candidates/${id}`);
}

// ---------------------------------------------------------------- hires & rubric

export async function addHire(form: FormData) {
  const rating = String(form.get("rating")) as Rating;
  let profile = String(form.get("profile") ?? "").trim();
  const file = form.get("file");
  if (file instanceof File && file.name) profile = [await fileToText(file), profile].filter(Boolean).join("\n\n");
  if (!profile) redirect("/rubric?error=" + encodeURIComponent("Add the hire's profile text or a file."));
  must(await db().from("hires").insert({
    name: String(form.get("name")).trim(), role: asRole(form.get("role")), rating, profile,
  }));
  revalidatePath("/rubric");
}

export async function deleteHire(form: FormData) {
  must(await db().from("hires").delete().eq("id", String(form.get("id"))));
  revalidatePath("/rubric");
}

export async function buildRubrics() {
  try {
    await generateRubrics();
  } catch (e) {
    redirect("/rubric?error=" + encodeURIComponent(msg(e)));
  }
  revalidatePath("/rubric");
}

export async function saveRubric(rubricId: string, criteria: Criterion[], approve: boolean): Promise<string[]> {
  const rubric = must(await db().from("rubric").select("*").eq("id", rubricId).single()) as Rubric;
  if (rubric.status !== "draft") return ["Only drafts can be edited. Generate a new draft to change an approved rubric."];
  const clean = criteria.map((c, i) => ({ ...c, id: `c${i + 1}`, weight: Math.round(Number(c.weight) || 0) }));
  must(await db().from("rubric").update({ criteria: clean }).eq("id", rubricId));
  if (approve) {
    const hires = must(await db().from("hires").select("*")) as Hire[];
    const problems = validateRubric(clean, hires);
    if (problems.length) return problems;
    must(await db().from("rubric").update({ status: "retired" }).eq("role", rubric.role).eq("status", "approved"));
    must(await db().from("rubric").update({ status: "approved" }).eq("id", rubricId));
    // Scores made with the old rubric are out of date: queue everyone for rescoring.
    must(await db().from("candidates").update({ status: "pending" }).in("status", ["scored", "error"]));
    await audit("rubric_approved", `${rubric.role} v${rubric.version}`);
  }
  revalidatePath("/rubric");
  revalidatePath("/");
  return [];
}

// ---------------------------------------------------------------- decisions & email

export async function decide(form: FormData) {
  const id = String(form.get("id"));
  const kind = form.get("kind") === "REJECT" ? "REJECT" : "INVITE";
  must(await db().from("candidates").update({ decision: kind, decided_at: new Date().toISOString() }).eq("id", id));
  await audit("decision", `${kind} (by Arjun)`, id);
  try {
    await draftEmail(id, kind, String(form.get("note") ?? ""));
  } catch (e) {
    redirect(`/candidates/${id}?error=${encodeURIComponent(msg(e))}#email`);
  }
  revalidatePath(`/candidates/${id}`);
  revalidatePath("/");
}

export async function saveEmail(form: FormData) {
  const id = String(form.get("email_id"));
  const email = must(await db().from("emails").select("*").eq("id", id).single()) as EmailDraft;
  must(await db().from("emails").update({
    to_email: String(form.get("to_email")).trim(), subject: String(form.get("subject")), body: String(form.get("body")),
  }).eq("id", id).eq("status", "draft"));
  revalidatePath(`/candidates/${email.candidate_id}`);
}

/** The only place an email leaves the system: Arjun clicked Confirm & send with the box ticked. */
export async function confirmAndSend(form: FormData) {
  const id = String(form.get("email_id"));
  const email = must(await db().from("emails").select("*").eq("id", id).single()) as EmailDraft;
  const back = `/candidates/${email.candidate_id}`;
  if (form.get("confirm") !== "yes") redirect(`${back}?error=${encodeURIComponent("Tick the confirmation box to send.")}#email`);
  if (email.status !== "draft") redirect(`${back}?error=${encodeURIComponent("This email was already sent or replaced.")}#email`);

  const to = String(form.get("to_email")).trim();
  const subject = String(form.get("subject"));
  const body = String(form.get("body"));
  let error: string | null = null;
  try {
    const resendId = await sendViaResend(to, subject, body);
    must(await db().from("emails").update({ to_email: to, subject, body, status: "sent", sent_at: new Date().toISOString(), resend_id: resendId }).eq("id", id));
    await audit("email_sent", `${email.kind} to ${to}`, email.candidate_id);
  } catch (e) {
    error = msg(e);
    await db().from("emails").update({ to_email: to, subject, body, error }).eq("id", id);
    await audit("send_error", error, email.candidate_id);
  }
  revalidatePath(back);
  if (error) redirect(`${back}?error=${encodeURIComponent(error)}#email`);
}
