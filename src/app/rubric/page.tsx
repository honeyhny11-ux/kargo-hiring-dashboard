import { addHire, buildRubrics, deleteHire } from "@/app/actions";
import SubmitButton from "@/app/components/SubmitButton";
import { db, must } from "@/lib/supabase";
import { ROLE_KEYS, ROLES, type Hire, type Rubric } from "@/lib/types";
import RubricEditor from "./RubricEditor";

export const dynamic = "force-dynamic";

function RubricView({ rubric }: { rubric: Rubric }) {
  return (
    <div className="panel">
      <h3 style={{ marginTop: 0 }}>{ROLES[rubric.role]}: v{rubric.version} <span className="chip ok">Approved, in use</span></h3>
      {rubric.criteria.map((c) => (
        <div key={c.id} className="crit">
          <div className="actions" style={{ marginTop: 0, justifyContent: "space-between" }}>
            <strong>{c.name}</strong><span className="score" style={{ fontSize: 16 }}>{c.weight}%</span>
          </div>
          <div className="small">{c.description}</div>
          <div className="small muted">From: {c.source_hires.join(", ")}. Weaker hires: {c.contrast}</div>
        </div>
      ))}
    </div>
  );
}

export default async function RubricPage({ searchParams }: PageProps<"/rubric">) {
  const sp = await searchParams;
  const hires = must(await db().from("hires").select("*").order("created_at")) as Hire[];
  const rubrics = must(await db().from("rubric").select("*").in("status", ["draft", "approved"]).order("version")) as Rubric[];
  const error = typeof sp.error === "string" ? sp.error : null;

  return (
    <>
      <h1>Rubric</h1>
      <p className="muted small">
        Calibrated on past outcomes, not the job description. Every criterion must trace back to an &quot;Exceeds&quot;
        hire, and the weaker hires are the contrast. 4–6 criteria per role, weights adding up to 100%.
      </p>
      {error && <div className="banner bad">{error}</div>}

      <h2>1. Past hires ({hires.length})</h2>
      {hires.length > 0 && (
        <div className="table-wrap" style={{ marginBottom: 16 }}>
          <table>
            <thead><tr><th>Name</th><th>Role</th><th>Rating</th><th>Profile</th><th /></tr></thead>
            <tbody>
              {hires.map((h) => (
                <tr key={h.id}>
                  <td><strong>{h.name}</strong></td>
                  <td>{h.role}</td>
                  <td><span className={`chip ${h.rating === "Exceeds" ? "ok" : h.rating === "Below" ? "bad" : ""}`}>{h.rating}</span></td>
                  <td className="small">
                    <details><summary>{h.profile.slice(0, 110)}{h.profile.length > 110 ? "…" : ""}</summary><p style={{ whiteSpace: "pre-wrap" }}>{h.profile}</p></details>
                  </td>
                  <td>
                    <form action={deleteHire}><input type="hidden" name="id" value={h.id} /><SubmitButton className="danger">Remove</SubmitButton></form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <details className="panel" open={hires.length === 0}>
        <summary>Add a past hire</summary>
        <form action={addHire}>
          <div className="row">
            <div><label>Name</label><input type="text" name="name" required placeholder="e.g. Meghna" /></div>
            <div><label>Role</label><select name="role">{ROLE_KEYS.map((r) => <option key={r} value={r}>{ROLES[r]}</option>)}</select></div>
            <div><label>Rating</label><select name="rating"><option>Exceeds</option><option>Meets</option><option>Below</option></select></div>
          </div>
          <label>Profile: what stood out at application, interview notes, performance, current status</label>
          <textarea name="profile" />
          <label>…or upload the profile (DOCX, PDF, TXT)</label>
          <input type="file" name="file" accept=".docx,.pdf,.txt" />
          <div className="actions"><SubmitButton pending="Saving…">Add hire</SubmitButton></div>
        </form>
      </details>
      <p className="muted small">Hire names are replaced with labels (H1, H2…) before the profiles go to Gemini.</p>

      <h2>2. Build the rubrics</h2>
      <form action={buildRubrics} className="panel">
        <p className="small" style={{ marginTop: 0 }}>
          Gemini compares the Exceeds hires with the Meets and Below hires and proposes a PM and an SPM rubric as drafts.
          Nothing is used for scoring until you edit and approve it.
        </p>
        <SubmitButton pending="Analysing hires…" disabled={hires.length < 2}>Generate draft rubrics</SubmitButton>
      </form>

      {ROLE_KEYS.map((role) => {
        const approved = rubrics.find((r) => r.role === role && r.status === "approved");
        const draft = rubrics.find((r) => r.role === role && r.status === "draft");
        return (
          <div key={role}>
            <h2>{ROLES[role]}</h2>
            {!approved && !draft && <p className="muted small">No rubric yet.</p>}
            {draft && <RubricEditor rubric={draft} hires={hires} />}
            {approved && <RubricView rubric={approved} />}
          </div>
        );
      })}
    </>
  );
}
