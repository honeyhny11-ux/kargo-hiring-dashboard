import Link from "next/link";
import { notFound } from "next/navigation";
import { confirmAndSend, decide, saveEmail, updateCandidate } from "@/app/actions";
import { deliveryAddress } from "@/lib/email";
import { loadCandidate } from "@/lib/queries";
import { priority } from "@/lib/scoring";
import { ROLES, type Criterion, type Role, type Rubric, type Score } from "@/lib/types";
import SubmitButton from "@/app/components/SubmitButton";

export const dynamic = "force-dynamic";

function Scorecard({ score, rubric, applied }: { score: Score; rubric?: Rubric; applied: boolean }) {
  const criteria: Criterion[] = rubric?.criteria ?? [];
  const byId = new Map(score.criteria.map((s) => [s.criterion_id, s]));
  const total = Number(score.total);
  return (
    <div className="panel">
      <div className="actions" style={{ marginTop: 0, justifyContent: "space-between" }}>
        <h3 style={{ margin: 0 }}>
          {ROLES[score.role as Role]} rubric {applied ? <span className="chip">applied role</span> : <span className="chip warn">other level</span>}
        </h3>
        <div>
          <span className="score">{total}</span> <span className="muted small">/ 100</span>{" "}
          <span className={`prio prio-${priority(total).split(" ")[0]}`}>{priority(total)}</span>
        </div>
      </div>
      <p className="small muted" style={{ margin: "4px 0 8px" }}>
        Confidence {score.confidence} · rubric v{rubric?.version ?? "?"} · scored {new Date(score.created_at).toLocaleString()}
      </p>
      {criteria.map((c) => {
        const s = byId.get(c.id);
        if (!s) return null;
        return (
          <div key={c.id} className="crit">
            <div className="actions" style={{ marginTop: 0, justifyContent: "space-between" }}>
              <strong>{c.name}</strong>
              <span className="small">
                <span className={`dot s${s.score}`}>{s.score}</span>/5 · weight {c.weight}% · {((s.score / 5) * c.weight).toFixed(1)} pts · {s.confidence}
              </span>
            </div>
            <div className="small">{s.reason}</div>
            {s.evidence_quote ? (
              <div className="small" style={{ marginTop: 4 }}>
                “{s.evidence_quote}”{" "}
                {s.verified === true && <span className="chip ok">found in CV</span>}
                {s.verified === false && <span className="chip bad">not found in CV: check it</span>}
              </div>
            ) : (
              <div className="small muted" style={{ marginTop: 4 }}>No evidence in CV: probe in interview.</div>
            )}
            <div className="small muted" style={{ marginTop: 4 }}>From past hires: {c.source_hires.join(", ") || "—"}</div>
          </div>
        );
      })}
    </div>
  );
}

export default async function CandidatePage({ params, searchParams }: PageProps<"/candidates/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const data = await loadCandidate(id);
  if (!data) notFound();
  const { candidate: c, emails, scores, usedRubrics } = data;
  const rubricById = new Map((usedRubrics as Rubric[]).map((r) => [r.id, r]));
  const sorted = [...scores].sort((a, b) => (a.role === c.applied_role ? -1 : b.role === c.applied_role ? 1 : 0));
  const draft = emails.find((e) => e.status === "draft");
  const sent = emails.filter((e) => e.status === "sent");
  const delivery = deliveryAddress(c.email);
  const error = typeof sp.error === "string" ? sp.error : null;

  return (
    <>
      <p className="small"><Link href={`/?role=${c.applied_role}`}>← {ROLES[c.applied_role]} shortlist</Link></p>
      <h1>{c.name}</h1>
      <p className="muted small">
        Applied for {ROLES[c.applied_role]} · {c.email || "no email found"} {c.phone && `· ${c.phone}`} · {c.filename}
      </p>
      <details className="small" style={{ marginBottom: 16 }}>
        <summary>Correct name or email</summary>
        <form action={updateCandidate} className="panel" style={{ marginTop: 8 }}>
          <input type="hidden" name="id" value={c.id} />
          <div className="row">
            <div><label>Name (never sent to the AI)</label><input type="text" name="name" defaultValue={c.name} /></div>
            <div><label>Email</label><input type="email" name="email" defaultValue={c.email} /></div>
          </div>
          <div className="actions"><SubmitButton className="secondary">Save</SubmitButton></div>
        </form>
      </details>

      {error && <div className="banner bad">{error}</div>}
      {c.status === "error" && <div className="banner bad">Scoring failed: {c.error}. Retry from the shortlist.</div>}
      {c.status !== "scored" && c.status !== "error" && <div className="banner warn">Not scored yet. Start scoring from the shortlist.</div>}

      {c.brief && (
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Interview brief</h3>
          <p className="brief" style={{ margin: 0 }}>{c.brief}</p>
          <div className="grid" style={{ marginTop: 12 }}>
            <div>
              <strong className="small">Strengths</strong>
              <ul className="small tight">{c.strengths?.map((s) => <li key={s}>{s}</li>)}</ul>
            </div>
            <div>
              <strong className="small">Top concern</strong>
              <p className="small" style={{ margin: 0 }}>{c.concern}</p>
              {c.pm_years_note && <p className="small muted">PM experience (info only, not scored): {c.pm_years_note}</p>}
            </div>
          </div>
        </div>
      )}

      {sorted.length > 0 && (
        <>
          <h2>Scores against both rubrics</h2>
          <div className="grid">
            {sorted.map((s) => <Scorecard key={s.id} score={s} rubric={rubricById.get(s.rubric_id)} applied={s.role === c.applied_role} />)}
          </div>
        </>
      )}

      <h2 id="email">Decision &amp; email</h2>
      <div className="panel">
        {c.decision && <p style={{ marginTop: 0 }}>Current decision: <span className="chip ok">{c.decision}</span> <span className="muted small">{c.decided_at && new Date(c.decided_at).toLocaleString()}</span></p>}
        <form action={decide}>
          <input type="hidden" name="id" value={c.id} />
          <label>Note for the email (optional, e.g. proposed interview times)</label>
          <input type="text" name="note" placeholder="e.g. Tue 3pm or Thu 11am, 45 min at our Mumbai office" />
          <div className="actions">
            <SubmitButton name="kind" value="INVITE" pending="Drafting…">Invite → draft email</SubmitButton>
            <SubmitButton name="kind" value="REJECT" className="secondary" pending="Drafting…">Reject → draft email</SubmitButton>
            <span className="muted small">Creates a draft only. Nothing is sent until you confirm below.</span>
          </div>
        </form>
      </div>

      {draft && (
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Draft: {draft.kind === "INVITE" ? "interview invite" : "rejection"}</h3>
          {delivery.redirected && (
            <div className="banner warn">Test mode: Resend will deliver this to <strong>{delivery.to}</strong> (RESEND_TEST_TO), not to the candidate.</div>
          )}
          <form action={confirmAndSend}>
            <input type="hidden" name="email_id" value={draft.id} />
            <label>To</label><input type="email" name="to_email" defaultValue={draft.to_email || c.email} required />
            <label>Subject</label><input type="text" name="subject" defaultValue={draft.subject} required />
            <label>Body</label><textarea name="body" defaultValue={draft.body} style={{ minHeight: 220 }} required />
            <label className="check"><input type="checkbox" name="confirm" value="yes" required /> I&apos;ve read this email and want to send it.</label>
            <div className="actions">
              <SubmitButton pending="Sending…">Confirm &amp; send</SubmitButton>
              <SubmitButton formAction={saveEmail} className="secondary" formNoValidate>Save edits</SubmitButton>
            </div>
          </form>
        </div>
      )}

      {sent.map((e) => (
        <div key={e.id} className="panel">
          <p className="small" style={{ marginTop: 0 }}>
            <span className="chip ok">Sent</span> {e.kind} · {e.sent_at && new Date(e.sent_at).toLocaleString()} · to {e.to_email}
          </p>
          <strong className="small">{e.subject}</strong>
          <pre className="small" style={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{e.body}</pre>
        </div>
      ))}
    </>
  );
}
