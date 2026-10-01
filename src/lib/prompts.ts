import type { Criterion, Role } from "./types";
import { ROLES } from "./types";

export const SYSTEM = `You support Arjun Mehta, founder of Kargo, a Series A logistics SaaS company (software for mid-sized \
freight forwarders and 3PLs, Mumbai, in-office). He is hiring a Product Manager (PM) and a Senior Product Manager (SPM).

The system recommends. Arjun decides. You never make a hiring or rejection decision.

Kargo's best hires did not match the job spec; they shared traits the spec never asks for. Judge candidates on those \
traits, as defined in the rubric you are given, not on job-description keywords, titles or years.

Rules:
- Evaluate professional evidence only. Never use or infer age, gender, race, ethnicity, religion, caste, disability, \
health, marital or family status, sexual orientation, political views, photos or home address. Identifiers have been \
removed; "[Candidate]" or labels like "H1" stand in for names.
- Do not reward prestigious schools or employers unless they give direct, job-relevant evidence.
- Never invent achievements. Evidence quotes must be copied word for word from the text so they can be checked.
- Missing evidence is not negative evidence: score 1 with LOW confidence and say it should be probed in interview.
- Phrase concerns neutrally and only when the text supports them.`;

export function rubricPrompt(hires: { label: string; role: Role; rating: string; profile: string }[]): string {
  const block = hires.map((h) => `## ${h.label} (${ROLES[h.role]}, rated ${h.rating})\n${h.profile}`).join("\n\n");
  return `Build Kargo's hiring rubrics from these past hires. Calibrate on outcomes, not the job description.

<hires>
${block}
</hires>

For each role (PM and SPM), write 4 to 6 criteria that the "Exceeds" hires have in common and that the weaker hires \
("Meets", "Below") lack or show less. Every criterion must trace back to specific hire profiles: list the Exceeds hire \
labels that show it in source_hires, and explain in contrast how the weaker hires differ. Do not use anything that comes \
only from a job description, and never build a criterion from schools, employer prestige, names or personal \
characteristics.

Give each criterion a short name, a description of what evidence in a CV would show it, anchors for scores 1, 3 and 5, \
and a weight. Weights within a role must add up to 100 and reflect how strongly the criterion separated the Exceeds hires \
from the weaker ones. The SPM rubric should reflect what separated strong hires at senior scope where the profiles show \
it; if the profiles give little SPM-specific signal, say so in notes rather than inventing it.

In notes, give caveats: this is a small sample, and correlation is not causation.`;
}

function rubricBlock(role: Role, criteria: Criterion[]): string {
  const lines = criteria.map(
    (c) => `- id: ${c.id} | ${c.name} (weight ${c.weight}%)\n  Evidence: ${c.description}\n  1 = ${c.anchors["1"]}; 3 = ${c.anchors["3"]}; 5 = ${c.anchors["5"]}`,
  );
  return `<rubric role="${role}">\n${lines.join("\n")}\n</rubric>`;
}

export function scorePrompt(cv: string, appliedRole: Role, rubrics: Partial<Record<Role, Criterion[]>>): string {
  const roles = (Object.keys(rubrics) as Role[]).filter((r) => rubrics[r]?.length);
  return `The candidate applied for ${ROLES[appliedRole]}. Score the CV against ${roles.length === 2 ? "BOTH rubrics below, \
because some candidates apply to the wrong level" : "the rubric below"}.

${roles.map((r) => rubricBlock(r, rubrics[r]!)).join("\n\n")}

<cv>
${cv}
</cv>

For every criterion in ${roles.length === 2 ? "each rubric" : "the rubric"}: a score from 1 to 5 using the anchors, a \
confidence (HIGH = direct and quantified evidence; MEDIUM = indirect or lacking detail; LOW = weak, inferred or missing), \
one evidence quote copied exactly from the CV (use "..." only to skip words inside one sentence; empty string if there \
is none), and a one-sentence reason.

Then:
- brief: exactly 3 sentences for Arjun's interview prep: what stands out, the biggest open question, and what to probe.
- strengths: the top 3 strengths, each tied to CV evidence.
- concern: the single biggest concern or gap, phrased neutrally.
- pm_years_note: one sentence stating how many years the CV shows in product-manager roles (information only, not scored).`;
}

export function emailPrompt(kind: "INVITE" | "REJECT", role: Role, note: string): string {
  const rules =
    kind === "INVITE"
      ? `Invite them to a conversation about the ${ROLES[role]} role at Kargo (in-office, Mumbai). Professional, short, \
warm and specific. If Arjun's note gives times or a format, use them; otherwise ask for their availability next week.`
      : `Tell them Kargo will not be moving forward for the ${ROLES[role]} role. Respectful, short and clear. Thank them \
for their time. Do not invent personalised feedback.`;
  return `Draft an email from Arjun Mehta, Founder, Kargo, to a candidate. ${rules}

Start with "Hi {{first_name}}," exactly: the app fills in the name. Never mention AI, automated screening, scores, \
rankings or rubrics. Plain text, no markdown. Sign off as "Arjun Mehta\\nFounder, Kargo".

Arjun's note (may be empty): ${note || "(none)"}`;
}
