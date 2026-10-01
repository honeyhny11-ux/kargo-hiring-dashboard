"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

/** Scores waiting CVs one at a time (one request each, so no single request runs long). */
export default function ScoreQueue({ ids }: { ids: string[] }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const stop = useRef(false);
  const [total, setTotal] = useState(0);

  async function run() {
    stop.current = false;
    setRunning(true);
    setDone(0);
    setErrors([]);
    setTotal(ids.length);
    for (const id of [...ids]) {
      if (stop.current) break;
      const res = await fetch(`/api/score/${id}`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        setErrors((e) => [...e, body.error]);
        // A missing rubric or key will fail every CV the same way, so stop early.
        if (/rubric|API_KEY|not set/i.test(body.error)) break;
      }
      setDone((d) => d + 1);
      router.refresh();
    }
    setRunning(false);
    router.refresh();
  }

  if (ids.length === 0 && !running && errors.length === 0) return null;
  return (
    <div className="panel">
      {running ? (
        <div className="actions" style={{ marginTop: 0 }}>
          <span>Scoring {Math.min(done + 1, total)} of {total}…</span>
          <button className="secondary" onClick={() => (stop.current = true)}>Pause</button>
        </div>
      ) : (
        <div className="actions" style={{ marginTop: 0 }}>
          <span>{ids.length} CV{ids.length === 1 ? "" : "s"} waiting to be scored against both rubrics.</span>
          {ids.length > 0 && <button onClick={run}>Score now</button>}
        </div>
      )}
      {errors.length > 0 && (
        <div className="banner bad" style={{ margin: "10px 0 0" }}>
          {errors.length} failed: {errors[errors.length - 1]}
        </div>
      )}
    </div>
  );
}
