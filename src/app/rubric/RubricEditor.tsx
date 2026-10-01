"use client";

import { useState, useTransition } from "react";
import { saveRubric } from "@/app/actions";
import { validateRubric } from "@/lib/scoring";
import { ROLES, type Criterion, type Hire, type Rubric } from "@/lib/types";

const blank = (): Criterion => ({
  id: "", name: "", description: "", weight: 0, anchors: { "1": "", "3": "", "5": "" }, source_hires: [], contrast: "",
});

export default function RubricEditor({ rubric, hires }: { rubric: Rubric; hires: Hire[] }) {
  const [criteria, setCriteria] = useState<Criterion[]>(rubric.criteria);
  const [serverProblems, setServerProblems] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const exceeds = hires.filter((h) => h.rating === "Exceeds");
  const problems = validateRubric(criteria, hires);
  const sum = criteria.reduce((a, c) => a + (Number(c.weight) || 0), 0);

  const set = (i: number, patch: Partial<Criterion>) => {
    setSaved(false);
    setCriteria((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  };
  const toggleHire = (i: number, name: string) =>
    set(i, { source_hires: criteria[i].source_hires.includes(name) ? criteria[i].source_hires.filter((n) => n !== name) : [...criteria[i].source_hires, name] });

  const submit = (approve: boolean) =>
    start(async () => {
      const res = await saveRubric(rubric.id, criteria, approve);
      setServerProblems(res);
      setSaved(res.length === 0);
    });

  return (
    <div className="panel">
      <h3 style={{ marginTop: 0 }}>{ROLES[rubric.role]}: draft v{rubric.version} <span className="chip warn">Review, then approve</span></h3>
      {rubric.notes && <p className="small muted">{rubric.notes}</p>}

      {criteria.map((c, i) => (
        <div key={i} className="crit">
          <div className="row">
            <div style={{ flex: "3 1 240px" }}><label>Criterion</label><input type="text" value={c.name} onChange={(e) => set(i, { name: e.target.value })} /></div>
            <div style={{ flex: "0 0 110px" }}><label>Weight %</label><input type="number" min={0} max={100} value={c.weight} onChange={(e) => set(i, { weight: Number(e.target.value) })} /></div>
          </div>
          <label>What evidence in a CV shows it</label>
          <textarea style={{ minHeight: 60 }} value={c.description} onChange={(e) => set(i, { description: e.target.value })} />
          <div className="row">
            {(["1", "3", "5"] as const).map((k) => (
              <div key={k}><label>Score {k} means</label><input type="text" value={c.anchors[k]} onChange={(e) => set(i, { anchors: { ...c.anchors, [k]: e.target.value } })} /></div>
            ))}
          </div>
          <label>Traced to these &quot;Exceeds&quot; hires</label>
          <div>
            {exceeds.map((h) => (
              <label key={h.id} className="check" style={{ display: "inline-flex", marginRight: 14 }}>
                <input type="checkbox" checked={c.source_hires.includes(h.name)} onChange={() => toggleHire(i, h.name)} /> {h.name}
              </label>
            ))}
          </div>
          <label>How the weaker hires differ</label>
          <input type="text" value={c.contrast} onChange={(e) => set(i, { contrast: e.target.value })} />
          <div className="actions">
            <button type="button" className="danger" onClick={() => setCriteria((cs) => cs.filter((_, j) => j !== i))} disabled={criteria.length <= 1}>Remove criterion</button>
          </div>
        </div>
      ))}

      <div className="actions">
        <button type="button" className="secondary" onClick={() => setCriteria((cs) => [...cs, blank()])} disabled={criteria.length >= 6}>Add criterion</button>
        <span className={`chip ${sum === 100 ? "ok" : "bad"}`}>Weights: {sum}%</span>
        <span className="chip">{criteria.length} criteria</span>
      </div>

      {[...new Set([...problems, ...serverProblems])].length > 0 && (
        <div className="banner warn" style={{ marginTop: 12 }}>
          <ul className="tight">{[...new Set([...problems, ...serverProblems])].map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
      )}
      {saved && <div className="banner ok" style={{ marginTop: 12 }}>Saved.</div>}

      <div className="actions">
        <button type="button" className="secondary" onClick={() => submit(false)} disabled={pending}>Save draft</button>
        <button type="button" onClick={() => submit(true)} disabled={pending || problems.length > 0}>
          {pending ? "Saving…" : "Approve & rescore all candidates"}
        </button>
      </div>
    </div>
  );
}
