import Link from "next/link";
import { db, must } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface Row { id: number; at: string; candidate_id: string | null; event: string; detail: string; candidates: { name: string } | null }

export default async function Activity() {
  const rows = must(await db().from("audit").select("*, candidates(name)").order("id", { ascending: false }).limit(300)) as Row[];
  return (
    <>
      <h1>Activity</h1>
      <p className="muted small">The written record: every upload, score, decision and email, newest first.</p>
      <div className="table-wrap">
        <table>
          <thead><tr><th>When</th><th>Candidate</th><th>Event</th><th>Detail</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={4} className="muted">Nothing yet.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="small" style={{ whiteSpace: "nowrap" }}>{new Date(r.at).toLocaleString()}</td>
                <td>{r.candidate_id ? <Link href={`/candidates/${r.candidate_id}`}>{r.candidates?.name ?? "—"}</Link> : "—"}</td>
                <td>{r.event.replace(/_/g, " ")}</td>
                <td className="small">{r.detail.slice(0, 200)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
