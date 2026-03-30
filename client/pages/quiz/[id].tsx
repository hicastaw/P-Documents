import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { AppShell } from "../../components/shell/AppShell";
import { API_BASE, authHeader, getAccessToken } from "../../lib/api";

type QuizDetail = {
  id: string;
  title: string;
  subject: string | null;
  created_at: string;
  questions: Array<{ prompt?: string; options?: any[] }>;
};

export default function QuizAttemptPage() {
  const router = useRouter();
  const quizId = typeof router.query.id === "string" ? router.query.id : null;

  const [token, setToken] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<QuizDetail | null>(null);
  const [answers, setAnswers] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [leaderboardMsg, setLeaderboardMsg] = useState<string | null>(null);
  const [timeLeftSec, setTimeLeftSec] = useState<number>(120);

  const hdr = useMemo(() => authHeader(token), [token]);

  useEffect(() => {
    setToken(getAccessToken());
    const socket = io({ path: "/socket.io" });
    socket.on("leaderboard:update", (evt: any) => {
      if (evt?.quizId && quizId && evt.quizId !== quizId) return;
      setLeaderboardMsg(`Leaderboard updated: user=${evt.userId} score=${evt.score}`);
    });
    return () => socket.disconnect();
  }, [quizId]);

  useEffect(() => {
    if (!quizId) return;
    let cancelled = false;
    (async () => {
      setError(null);
      setStatus("Đang tải quiz…");
      const res = await fetch(`${API_BASE}/quiz/${quizId}`, { headers: hdr });
      const j = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (!res.ok) {
        setError(j?.error ?? "load_failed");
        setStatus(null);
        return;
      }
      setQuiz(j.quiz as QuizDetail);
      setAnswers(new Array(Array.isArray(j?.quiz?.questions) ? j.quiz.questions.length : 0).fill(null));
      setStatus(null);
      setTimeLeftSec(120);
    })();
    return () => {
      cancelled = true;
    };
  }, [quizId, hdr]);

  useEffect(() => {
    if (!quiz) return;
    const t = setInterval(() => {
      setTimeLeftSec((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [quiz]);

  async function submit() {
    if (!quizId) return;
    setError(null);
    setStatus("Đang nộp bài…");
    const res = await fetch(`${API_BASE}/quiz/${quizId}/submit`, {
      method: "POST",
      headers: { "content-type": "application/json", ...hdr },
      body: JSON.stringify({ answers }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(j?.error ?? "submit_failed");
      setStatus(null);
      return;
    }
    setStatus(`Nộp bài xong. Score=${j?.attempt?.score ?? "?"}`);
  }

  return (
    <AppShell
      title="Quiz"
      right={
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
            Còn lại: <span className="text-rose-700">{fmtTimer(timeLeftSec)}</span>
          </div>
          <button
            className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
            onClick={submit}
            disabled={!quiz || timeLeftSec === 0}
          >
            Nộp bài
          </button>
        </div>
      }
    >
      <div className="grid gap-5">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Link className="font-semibold text-rose-700 underline decoration-rose-300" href="/quiz">
            ← Quay lại danh sách
          </Link>
          {quiz?.subject ? <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold">{quiz.subject}</span> : null}
        </div>

        {leaderboardMsg ? (
          <div className="rounded-2xl border border-rose-200/60 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {leaderboardMsg}
          </div>
        ) : null}
        {status ? (
          <div className="rounded-2xl border border-black/5 bg-white/75 px-4 py-3 text-sm text-slate-700 backdrop-blur">
            {status}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Error: {error}</div>
        ) : null}

        {quiz ? (
          <section className="rounded-2xl border border-black/5 bg-white/75 p-5 shadow-[0_10px_40px_-25px_rgba(2,6,23,0.35)] backdrop-blur">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bài kiểm tra</div>
            <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{quiz.title}</div>

            <div className="mt-5 grid gap-4">
              {quiz.questions.map((qq, idx) => (
                <QuestionCard
                  key={idx}
                  idx={idx}
                  q={qq}
                  value={answers[idx]}
                  onChange={(v) => {
                    setAnswers((prev) => {
                      const next = [...prev];
                      next[idx] = v;
                      return next;
                    });
                  }}
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}

function QuestionCard(props: {
  idx: number;
  q: { prompt?: string; options?: any[] };
  value: any;
  onChange: (v: any) => void;
}) {
  const prompt = props.q.prompt ?? `Câu ${props.idx + 1}`;
  const options = Array.isArray(props.q.options) ? props.q.options : [];

  return (
    <div className="rounded-2xl border border-black/5 bg-gradient-to-b from-white to-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">
            <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-lg bg-rose-600 text-xs font-bold text-white">
              {props.idx + 1}
            </span>
            {prompt}
          </div>
          <div className="mt-1 text-xs text-slate-500">Chọn 1 đáp án</div>
        </div>
      </div>

      <div className="mt-3 grid gap-2">
        {options.map((opt, i) => {
          const label = typeof opt === "string" ? opt : opt?.label ?? String(opt);
          const value = typeof opt === "string" ? opt : opt?.value ?? opt?.id ?? label;
          const checked = props.value === value;
          return (
            <button
              type="button"
              key={i}
              onClick={() => props.onChange(value)}
              className={[
                "flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm transition",
                checked
                  ? "border-rose-200 bg-rose-50 text-rose-900 shadow-[inset_0_0_0_1px_rgba(244,63,94,0.25)]"
                  : "border-black/10 bg-white text-slate-800 hover:bg-slate-50",
              ].join(" ")}
            >
              <span
                className={[
                  "grid h-5 w-5 place-items-center rounded-full border",
                  checked ? "border-rose-400 bg-rose-600 text-white" : "border-slate-300 bg-white text-transparent",
                ].join(" ")}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                </svg>
              </span>
              <span className="min-w-0 flex-1">{label}</span>
            </button>
          );
        })}
        {options.length === 0 ? <div className="text-xs text-slate-500">Quiz này chưa có options theo format.</div> : null}
      </div>
    </div>
  );
}

function fmtTimer(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

