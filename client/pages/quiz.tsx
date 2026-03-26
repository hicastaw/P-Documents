import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api";

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("pdocs_access_token");
}

export default function QuizPage() {
  const [token, setToken] = useState<string | null>(null);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setToken(getToken());
    const socket = io({ path: "/socket.io" });
    socket.on("leaderboard:update", (evt: any) => {
      setMsg(`Leaderboard updated: quiz=${evt.quizId} user=${evt.userId} score=${evt.score}`);
    });
    return () => {
      socket.disconnect();
    };
  }, []);

  async function loadQuizzes() {
    const res = await fetch(`${API_BASE}/quiz`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    const j = await res.json();
    setQuizzes(j.quizzes ?? []);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-2xl font-semibold">Quiz</h1>
        <p className="mt-2 text-slate-300">Realtime updates qua Socket.io.</p>
        {msg ? <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-sm">{msg}</div> : null}

        <div className="mt-6">
          <button className="rounded-lg border border-slate-700 px-4 py-2" onClick={loadQuizzes}>
            Load quizzes
          </button>
        </div>

        <div className="mt-6 grid gap-3">
          {quizzes.map((q) => (
            <div key={q.id} className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <div className="font-medium">{q.title}</div>
              <div className="mt-2 text-xs text-slate-400">id: {q.id}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

