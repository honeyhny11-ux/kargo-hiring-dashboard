import Link from "next/link";
import { approvedRubrics } from "@/lib/pipeline";
import { loadCandidates } from "@/lib/queries";
import { priority } from "@/lib/scoring";
import { ROLE_KEYS, ROLES, type Role } from "@/lib/types";
import ScoreQueue from "./components/ScoreQueue";

export const dynamic = "force-dynamic";

const other = (r: Role): Role => (r === "PM" ? "SPM" : "PM");

export default async function Dashboard({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const role: Role = sp.role === "SPM" ? "SPM" : "PM";
  const includeOther = sp.all === "1";
  const [all, rubrics] = await Promise.all([loadCandidates(), approvedRubrics()]);
  const rubric = rubrics[role];

  const pool = all.filter((c) => c.applied_role === role || (includeOther && c.scores[role]));
  const ranked = pool.filter((c) => c.scores[role]).sort((a, b) => b.scores[role]!.total - a.scores[role]!.total);
  const unranked = pool.filter((c) => !c.scores[role]);
  const queue = all.filter((c) => c.status === "pending" || c.status === "scoring").map((c) => c.id);
  const counts = Object.fromEntries(ROLE_KEYS.map((r) => [r, all.filter((c) => c.applied_role === r).length]));

  return (
    <>
      <h1>{ROLES[role]} shortlist</h1>
      <p className="muted small">
        Ranked by fit with the rubric built from Kargo&apos;s best past hires. Priority labels help decide who to read
        first; they are not hiring decisions.
      </p>

      <div className="tabs">
        {ROLE_KEYS.map((r) => (
          <Link key={r} href={`/?role=${r}${includeOther ? "&all=1" : ""}`} className={r === role ? "on" : ""}>
            {ROLES[r]} ({counts[r]})
          </Link>
        ))}
        <Link href={`/?role=${role}${includeOther ? "" : "&all=1"}`} className="small" style={{ border: 0, background: "none" }}>
          {includeOther ? `Show only ${role} applicants` : `Also show ${other(role)} applicants scored on this rubric`}
        </Link>
      </div>

      {!rubric && (
        <div className="banner warn">
          No approved {role} rubric yet. <Link href="/rubric">Build it from the past hires</Link> before scoring.
        </div>
      )}
      <ScoreQueue ids={queue} />

      {pool.length === 0 ? (
        <div className="panel">No candidates yet. <Link href="/upload">Upload CVs</Link>.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="num">#</th>
                <th>Candidate</th>
                <th className="num">Score</th>
                <th>Priority</th>
                <th>Confidence</th>
                {rubric?.criteria.map((c) => (
                  <th key={c.id} className="num" title={`${c.name} (${c.weight}%)`}>
                    {c.name.length > 14 ? c.name.slice(0, 13) + "…" : c.name}
                  </th>
                ))}
                <th>Top concern</th>
                <th>Flags</th>
                <th>Decision</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((c, i) => {
                const s = c.scores[role]!;
                const alt = c.scores[other(role)];
                const byId = new Map(s.criteria.map((x) => [x.criterion_id, x]));
                const stale = rubric && s.rubric_id !== rubric.id;
                return (
                  <tr key={c.id}>
                    <td className="num">{i + 1}</td>
                    <td>
                      <Link href={`/candidates/${c.id}`}>{c.name}</Link>
                      {c.applied_role !== role && <div className="small muted">applied for {c.applied_role}</div>}
                    </td>
                    <td className="num"><span className="score">{s.total}</span></td>
                    <td><span className={`prio prio-${priority(s.total).split(" ")[0]}`}>{priority(s.total)}</span></td>
                    <td className="small">{s.confidence}</td>
                    {rubric?.criteria.map((rc) => {
                      const x = byId.get(rc.id);
                      return (
                        <td key={rc.id} className="num" title={x?.reason}>
                          {x ? <span className={`dot s${x.score}`}>{x.score}</span> : "–"}
                        </td>
                      );
                    })}
                    <td className="small">{c.concern}</td>
                    <td>
                      {alt && alt.total >= s.total + 10 && <span className="chip warn">Stronger on {other(role)} ({alt.total})</span>}
                      {s.criteria.some((x) => x.verified === false) && <span className="chip bad" title="A quote wasn't found in the CV">Check quote</span>}
                      {stale && <span className="chip">Old rubric</span>}
                    </td>
                    <td className="small">
                      {c.emailStatus ? <span className={`chip ${c.emailStatus.endsWith("sent") ? "ok" : ""}`}>{c.emailStatus}</span> : <span className="muted">Not decided</span>}
                    </td>
                  </tr>
                );
              })}
              {unranked.map((c) => (
                <tr key={c.id}>
                  <td />
                  <td><Link href={`/candidates/${c.id}`}>{c.name}</Link></td>
                  <td colSpan={6 + (rubric?.criteria.length ?? 0)} className="small muted">
                    {c.status === "error" ? <><span className="chip bad">Error</span> {c.error}</> : <span className="chip">{c.status === "scoring" ? "Scoring…" : "Waiting to be scored"}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
