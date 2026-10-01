"use client";

import Link from "next/link";
import { useState } from "react";
import { uploadCvs, type UploadResult } from "@/app/actions";
import { ROLES, ROLE_KEYS, type Role } from "@/lib/types";

export default function UploadForm() {
  const [role, setRole] = useState<Role>("PM");
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<UploadResult>([]);
  const [busy, setBusy] = useState(false);

  async function upload() {
    setBusy(true);
    setResults([]);
    // One file per request keeps each request under the hosting body-size limit.
    for (const file of files) {
      const fd = new FormData();
      fd.set("role", role);
      fd.append("files", file);
      try {
        const res = await uploadCvs(null, fd);
        setResults((r) => [...r, ...res]);
      } catch (e) {
        setResults((r) => [...r, { file: file.name, ok: false, error: e instanceof Error ? e.message : "Upload failed" }]);
      }
    }
    setBusy(false);
    setFiles([]);
  }

  return (
    <>
      <div className="panel">
        <div className="row">
          <div>
            <label>Role applied for</label>
            <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {ROLE_KEYS.map((r) => <option key={r} value={r}>{ROLES[r]}</option>)}
            </select>
          </div>
          <div>
            <label>CV files (DOCX, PDF or TXT)</label>
            <input type="file" multiple accept=".docx,.pdf,.txt" onChange={(e) => setFiles([...(e.target.files ?? [])])} />
          </div>
        </div>
        <div className="actions">
          <button onClick={upload} disabled={busy || files.length === 0}>
            {busy ? `Uploading ${results.length + 1} of ${files.length}…` : `Upload ${files.length || ""} CV${files.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>

      {results.length > 0 && (
        <>
          <div className="table-wrap">
            <table>
              <thead><tr><th>File</th><th>Result</th><th>Name found</th><th>Email found</th></tr></thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i}>
                    <td>{r.file}</td>
                    {r.ok ? (
                      <>
                        <td><span className="chip ok">Added</span></td>
                        <td>{r.name}</td>
                        <td>{r.email || <span className="chip warn">None: add it on the candidate page</span>}</td>
                      </>
                    ) : (
                      <td colSpan={3}><span className="chip bad">Not added</span> {r.error}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!busy && <p className="actions"><Link className="btn" href={`/?role=${role}`}>Go to the shortlist to score them</Link></p>}
        </>
      )}
    </>
  );
}
