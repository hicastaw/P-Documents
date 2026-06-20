import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { AppShell } from "../../components/shell/AppShell";
import { getQuiz, getLeaderboard, getHistory, submitQuiz } from "../../services/quizApi";
import { useRequireAuth } from "../../hooks/use-require-auth";

type QuizDetail = {
  id: string;
  title: string;
  subject: string | null;
  created_at: string;
  questions: Array<{ q?: string; prompt?: string; options?: any[] }>;
};

type LeaderboardEntry = { attemptId: string; userId: string; score: number; timeTaken: number; displayName: string; createdAt: string };
type Attempt = { id: string; quiz_id: string; score: number; time_taken_seconds: number; created_at: string };

const QUIZ_DURATION = 120; // seconds

export default function QuizAttemptPage() {
  const auth = useRequireAuth();
  const router = useRouter();
  const quizId = typeof router.query.id === "string" ? router.query.id : null;

  const [quiz, setQuiz] = useState<QuizDetail | null>(null);
  const [answers, setAnswers] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [history, setHistory] = useState<Attempt[]>([]);
  const [timeLeftSec, setTimeLeftSec] = useState<number>(QUIZ_DURATION);
  const [timeTaken, setTimeTaken] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!auth) return;
    const socket = io({ path: "/socket.io" });
    socket.on("leaderboard:update", (evt: any) => {
      if (evt?.quizId && quizId && evt.quizId === quizId) {
        loadLeaderboard();
      }
    });
    return () => { socket.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId, !!auth]);

  useEffect(() => {
    if (!quizId || !auth) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const j = await getQuiz(quizId);
        if (cancelled) return;
        setQuiz(j.quiz as QuizDetail);
        const qs = Array.isArray(j?.quiz?.questions) ? j.quiz.questions : [];
        setAnswers(new Array(qs.length).fill(null));
        setTotalQuestions(qs.length);
        setTimeLeftSec(QUIZ_DURATION);
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? "load_failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    loadLeaderboard();
    loadHistory();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId, !!auth]);

  // Timer countdown
  useEffect(() => {
    if (!quiz || submitted) return;
    const t = setInterval(() => {
      setTimeLeftSec((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [quiz, submitted]);

  // Auto-submit when time runs out
  useEffect(() => {
    if (timeLeftSec === 0 && quiz && !submitted) {
      submit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeftSec]);

  async function loadLeaderboard() {
    if (!quizId) return;
    try {
      const j = await getLeaderboard(quizId);
      setLeaderboard(j.leaderboard ?? []);
    } catch { /* ignore */ }
  }

  async function loadHistory() {
    if (!quizId) return;
    try {
      const j = await getHistory(quizId);
      setHistory(j.attempts ?? []);
    } catch { /* ignore */ }
  }

  async function submit() {
    if (!quizId || submitted) return;
    const elapsed = QUIZ_DURATION - timeLeftSec;
    setTimeTaken(elapsed);
    setError(null);
    try {
      const j = await submitQuiz(quizId, { answers, timeTakenSeconds: elapsed });
      setScore(j?.attempt?.score ?? 0);
      setSubmitted(true);
      loadLeaderboard();
      loadHistory();
    } catch (err: any) {
      setError(err?.message ?? "submit_failed");
    }
  }

  if (!auth) return null;

  const scorePercent = totalQuestions > 0 && score !== null ? Math.round((score / totalQuestions) * 100) : 0;

  return (
    <AppShell
      title={quiz?.title ?? "Quiz"}
      subtitle={quiz?.subject ?? undefined}
      right={
        !submitted ? (
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
              Còn lại: <span className={timeLeftSec <= 30 ? "text-red-600 animate-pulse" : "text-rose-700"}>{fmtTimer(timeLeftSec)}</span>
            </div>
            <button
              className="rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_14px_-6px_rgba(225,29,72,0.6)] hover:from-rose-500 hover:to-rose-400 transition disabled:opacity-50"
              onClick={submit}
              disabled={!quiz || timeLeftSec === 0}
            >
              Nộp bài
            </button>
          </div>
        ) : undefined
      }
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* Main content */}
        <div className="grid gap-5">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Link className="font-semibold text-rose-700 underline decoration-rose-300" href="/quiz">
              ← Quay lại danh sách
            </Link>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              ⚠ {error}
              <button onClick={() => setError(null)} className="ml-2 text-red-400 hover:text-red-600">✕</button>
            </div>
          )}

          {/* Score result */}
          {submitted && score !== null && (
            <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-6 text-center animate-fadeIn">
              <div className="text-5xl mb-2">{scorePercent >= 70 ? "🎉" : scorePercent >= 40 ? "👍" : "💪"}</div>
              <div className="text-2xl font-bold text-slate-900">
                {score} / {totalQuestions}
              </div>
              <div className="mt-2 flex items-center justify-center gap-4 text-sm">
                <span className="flex items-center gap-1.5 rounded-xl bg-white/70 px-3 py-1.5 font-semibold text-slate-700">
                  ⏱ {fmtTimer(timeTaken)}
                </span>
                <span className="flex items-center gap-1.5 rounded-xl bg-white/70 px-3 py-1.5 font-semibold text-emerald-700">
                  📊 {scorePercent}%
                </span>
              </div>
              <div className="mt-2 text-sm text-slate-600">
                {scorePercent >= 70 ? "Xuất sắc! Bạn làm rất tốt!" : scorePercent >= 40 ? "Khá tốt! Hãy cố gắng thêm!" : "Hãy ôn lại và thử lại nhé!"}
              </div>
              <div className="mt-3 h-3 rounded-full bg-white/60 overflow-hidden max-w-xs mx-auto">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-700"
                  style={{ width: `${scorePercent}%` }}
                />
              </div>
              <button
                onClick={() => { setSubmitted(false); setScore(null); setTimeTaken(0); setAnswers(new Array(totalQuestions).fill(null)); setTimeLeftSec(QUIZ_DURATION); }}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_-6px_rgba(225,29,72,0.6)] hover:from-rose-500 hover:to-rose-400 transition"
              >
                🔄 Làm lại
              </button>
            </div>
          )}

          {/* Questions */}
          {quiz && !submitted && (
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

              <div className="mt-5 flex justify-end">
                <button
                  className="rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 px-6 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_-6px_rgba(225,29,72,0.6)] hover:from-rose-500 hover:to-rose-400 transition disabled:opacity-50"
                  onClick={submit}
                  disabled={timeLeftSec === 0}
                >
                  ✅ Nộp bài
                </button>
              </div>
            </section>
          )}

          {loading && (
            <div className="rounded-2xl border border-black/5 bg-white/75 p-8 text-center text-sm text-slate-500 animate-pulse">
              Đang tải quiz…
            </div>
          )}
        </div>

        {/* Sidebar: Leaderboard + History */}
        <div className="flex flex-col gap-4">
          {/* Leaderboard */}
          <div className="rounded-2xl border border-black/5 bg-white/80 p-4 backdrop-blur">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
              <span>🏆</span> Bảng xếp hạng
            </div>
            {leaderboard.length > 0 ? (
              <div className="grid gap-1.5 max-h-[320px] overflow-y-auto">
                {leaderboard.map((entry, i) => (
                  <div
                    key={entry.attemptId}
                    className={[
                      "flex items-center gap-3 rounded-xl px-3 py-2 text-sm",
                      i === 0 ? "bg-amber-50 font-semibold text-amber-900" :
                      i === 1 ? "bg-slate-50 font-medium text-slate-800" :
                      i === 2 ? "bg-orange-50/60 font-medium text-orange-800" :
                      "text-slate-700",
                    ].join(" ")}
                  >
                    <span className={[
                      "grid h-6 w-6 place-items-center rounded-full text-xs font-bold shrink-0",
                      i === 0 ? "bg-amber-400 text-white" :
                      i === 1 ? "bg-slate-400 text-white" :
                      i === 2 ? "bg-orange-400 text-white" :
                      "bg-slate-200 text-slate-600",
                    ].join(" ")}>
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{entry.displayName}</div>
                      <div className="text-[10px] text-slate-400">
                        ⏱ {fmtTimer(entry.timeTaken)} · {new Date(entry.createdAt).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-rose-600">{entry.score} đ</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-400 text-center py-4">Chưa có ai nộp bài</div>
            )}
          </div>

          {/* History */}
          <div className="rounded-2xl border border-black/5 bg-white/80 p-4 backdrop-blur">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
              <span>📋</span> Lịch sử làm bài
            </div>
            {history.length > 0 ? (
              <div className="grid gap-1.5 max-h-[300px] overflow-y-auto">
                {history.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                    <span className="text-xs font-semibold text-rose-600">{a.score} đ</span>
                    <span className="text-[10px] text-slate-400">⏱ {fmtTimer(a.time_taken_seconds)}</span>
                    <span className="flex-1 text-xs text-slate-500 text-right">
                      {new Date(a.created_at).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-400 text-center py-4">Bạn chưa nộp bài quiz này</div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function QuestionCard(props: {
  idx: number;
  q: { q?: string; prompt?: string; options?: any[] };
  value: any;
  onChange: (v: any) => void;
}) {
  const prompt = props.q.q ?? props.q.prompt ?? `Câu ${props.idx + 1}`;
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
