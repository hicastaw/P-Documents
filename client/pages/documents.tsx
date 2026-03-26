import { useEffect, useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api";

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("pdocs_access_token");
}

export default function DocumentsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [docs, setDocs] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const authHeader = useMemo(() => (token ? { authorization: `Bearer ${token}` } : {}), [token]);

  useEffect(() => {
    setToken(getToken());
  }, []);

  async function load() {
    setError(null);
    const res = await fetch(`${API_BASE}/documents?q=${encodeURIComponent(q)}`, {
      headers: { ...authHeader },
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json?.error ?? "load_failed");
      return;
    }
    setDocs(json.documents ?? []);
  }

  async function upload(file: File) {
    setError(null);
    const presign = await fetch(`${API_BASE}/documents/presign`, {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeader },
      body: JSON.stringify({ filename: file.name, mime: file.type || "application/pdf", size: file.size }),
    });
    const p = await presign.json();
    if (!presign.ok) throw new Error(p?.error ?? "presign_failed");

    const putRes = await fetch(p.presignedPutUrl, {
      method: "PUT",
      headers: { "content-type": file.type || "application/pdf" },
      body: file,
    });
    if (!putRes.ok) throw new Error("upload_failed");

    const complete = await fetch(`${API_BASE}/documents/complete`, {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeader },
      body: JSON.stringify({
        objectKey: p.objectKey,
        title: file.name,
        mime: file.type || "application/pdf",
        size: file.size,
      }),
    });
    const c = await complete.json();
    if (!complete.ok) throw new Error(c?.error ?? "complete_failed");
    await load();
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-2xl font-semibold">Documents</h1>
        <p className="mt-1 text-sm text-slate-300">Upload/Download qua Presigned URL (MinIO).</p>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <input
            className="w-64 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="search..."
          />
          <button className="rounded-lg border border-slate-700 px-4 py-2" onClick={load}>
            Search
          </button>
          <label className="ml-auto cursor-pointer rounded-lg bg-sky-600 px-4 py-2 font-medium">
            Upload PDF
            <input
              className="hidden"
              type="file"
              accept="application/pdf"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  await upload(f);
                } catch (err: any) {
                  setError(err?.message ?? "upload_error");
                } finally {
                  e.target.value = "";
                }
              }}
            />
          </label>
        </div>

        {error ? <div className="mt-4 text-sm text-red-300">Error: {error}</div> : null}

        <div className="mt-6 grid gap-3">
          {docs.map((d) => (
            <DocCard key={d.id} doc={d} token={token} />
          ))}
          {docs.length === 0 ? <div className="text-slate-400">No documents yet.</div> : null}
        </div>
      </div>
    </main>
  );
}

function DocCard({ doc, token }: { doc: any; token: string | null }) {
  async function getDownload() {
    const res = await fetch(`${API_BASE}/documents/${doc.id}/download`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j?.error ?? "download_failed");
    window.open(j.presignedGetUrl, "_blank");
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="font-medium">{doc.title}</div>
      <div className="mt-1 text-xs text-slate-400">{doc.status}</div>
      <div className="mt-3">
        <button className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm" onClick={getDownload}>
          Download
        </button>
      </div>
    </div>
  );
}

