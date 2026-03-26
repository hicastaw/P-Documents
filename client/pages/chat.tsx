import { useEffect, useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api";

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("pdocs_access_token");
}

export default function ChatPage() {
  const [token, setToken] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState("");
  const [question, setQuestion] = useState("Tài liệu này nói gì?");
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const authHeader = useMemo(() => (token ? { authorization: `Bearer ${token}` } : {}), [token]);

  useEffect(() => {
    setToken(getToken());
  }, []);

  async function ask() {
    setError(null);
    setAnswer(null);
    const res = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeader },
      body: JSON.stringify({ documentId, question }),
    });
    const j = await res.json();
    if (!res.ok) {
      setError(j?.error ?? "chat_failed");
      return;
    }
    setAnswer(j.answer);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold">Chat (Phase 5)</h1>
        <p className="mt-2 text-slate-300">Hỏi đáp dựa trên nội dung đã bóc tách từ PDF (worker tạo `doc_chunks`).</p>

        <div className="mt-6 grid gap-3">
          <input
            className="w-full rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2"
            placeholder="documentId (uuid)"
            value={documentId}
            onChange={(e) => setDocumentId(e.target.value)}
          />
          <textarea
            className="min-h-24 w-full rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2"
            placeholder="question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <div className="flex gap-2">
            <button className="rounded-lg bg-sky-600 px-4 py-2 font-medium" onClick={ask}>
              Ask
            </button>
            <button
              className="rounded-lg border border-slate-700 px-4 py-2"
              onClick={() => {
                setAnswer(null);
                setError(null);
              }}
            >
              Clear
            </button>
          </div>
        </div>

        {error ? <div className="mt-4 text-sm text-red-300">Error: {error}</div> : null}
        {answer ? (
          <pre className="mt-4 whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-100">
            {answer}
          </pre>
        ) : null}
      </div>
    </main>
  );
}

