import Link from "next/link";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { AppShell } from "../components/shell/AppShell";
import { listQuizzes as listQuizzesApi, seedQuizzes as seedQuizzesApi, type QuizListItem } from "../services/quizApi";
import { useRequireAuth } from "../hooks/use-require-auth";
import { Trophy, AlertCircle, X, ClipboardList, Sparkles, Calendar, ArrowRight } from "lucide-react";

export default function QuizPage() {
  const auth = useRequireAuth();
  const [quizzes, setQuizzes] = useState<QuizListItem[]>([]);
  const [liveMsg, setLiveMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    if (!auth) return;
    const socket = io({ path: "/socket.io" });
    socket.on("leaderboard:update", (evt: any) => {
      setLiveMsg(`Quiz cập nhật: ${evt.quizId?.slice(0, 8)} · Điểm ${evt.score}`);
      setTimeout(() => setLiveMsg(null), 5000);
    });
    return () => { socket.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!auth]);

  useEffect(() => {
    if (auth) loadQuizzes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!auth]);

  if (!auth) return null;

  async function loadQuizzes() {
    setError(null);
    setLoading(true);
    try {
      const j = await listQuizzesApi();
      setQuizzes(j.quizzes ?? []);
    } catch {
      setError("Không thể tải danh sách quiz. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  async function seedQuizzes() {
    setSeeding(true);
    try {
      await seedQuizzesApi();
      await loadQuizzes();
    } catch {
      setError("Không thể tạo quiz mẫu.");
    } finally {
      setSeeding(false);
    }
  }

  const filtered = quizzes.filter((item) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return item.title.toLowerCase().includes(s) || (item.subject ?? "").toLowerCase().includes(s);
  });

  return (
    <AppShell
      title="Quiz"
      subtitle="Kiểm tra kiến thức từ tài liệu học"
      search={
        <div className="relative">
          <input
            className="w-full rounded-xl border border-black/8 bg-white/90 px-4 py-2.5 pr-10 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-rose-300 focus:ring-4 focus:ring-rose-100 transition"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm quiz hoặc môn học..."
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-slate-400">
            <SearchIcon />
          </span>
        </div>
      }
      right={
        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
            onClick={loadQuizzes}
          >
            <RefreshIcon />
            Làm mới
          </button>
          <Link
            href="/quiz/create"
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_-6px_rgba(225,29,72,0.6)] hover:from-rose-500 hover:to-rose-400 transition"
          >
            <PlusIcon />
            Tạo Quiz
          </Link>
        </div>
      }
    >
      <div className="grid gap-4">
        {/* Live leaderboard toast */}
        {liveMsg && (
          <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 animate-fadeIn">
            <Trophy size={16} strokeWidth={2} className="shrink-0 text-amber-500" />
            {liveMsg}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle size={16} strokeWidth={2} className="shrink-0" /> {error}
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-black/5 bg-white animate-pulse">
                <div className="h-32 bg-slate-100" />
                <div className="p-4 space-y-2">
                  <div className="h-3 w-3/4 rounded bg-slate-200" />
                  <div className="h-2.5 w-1/2 rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((item) => (
              <QuizCard key={item.id} quiz={item} />
            ))}
          </div>
        ) : (
          <div className="py-16 text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
              <ClipboardList size={22} strokeWidth={1.8} />
            </div>
            <div className="text-sm font-semibold text-slate-600 mb-1">
              {q ? "Không tìm thấy quiz phù hợp" : "Chưa có quiz nào"}
            </div>
            <div className="text-xs text-slate-400 mb-4">
              {q ? "Thử tìm với từ khoá khác" : "Chưa có quiz trong hệ thống."}
            </div>
            {!q && (
              <button
                onClick={seedQuizzes}
                disabled={seeding}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_-6px_rgba(225,29,72,0.6)] hover:from-rose-500 hover:to-rose-400 transition disabled:opacity-60"
              >
                {seeding ? "Đang tạo..." : (
                  <span className="flex items-center gap-1.5"><Sparkles size={14} strokeWidth={2} /> Tạo quiz mẫu</span>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function QuizCard({ quiz }: { quiz: QuizListItem }) {
  const created = new Date(quiz.created_at);

  return (
    <Link
      href={`/quiz/${quiz.id}`}
      className="group overflow-hidden rounded-2xl border border-black/5 bg-white shadow-card transition-all hover:-translate-y-0.5 hover:shadow-popover"
    >
      <div className="relative h-32 flex items-end justify-between bg-slate-50 p-3">
        <ClipboardList size={28} strokeWidth={1.5} className="text-slate-300" />
        {quiz.subject && (
          <span className="rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 shadow-sm">
            {quiz.subject}
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="truncate text-sm font-bold text-slate-900">{quiz.title}</div>
        <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1"><Calendar size={12} strokeWidth={2} /> {created.toLocaleDateString("vi-VN")}</span>
          <span className="ml-auto flex items-center gap-1 text-xs font-semibold text-rose-600 group-hover:text-rose-500 transition">
            Làm bài <ArrowRight size={12} strokeWidth={2} />
          </span>
        </div>
      </div>
    </Link>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="m16.5 16.5 4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M1 4v6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M23 20v-6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
