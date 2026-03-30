import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { AppShell } from "../components/shell/AppShell";
import { API_BASE, authHeader, getAccessToken } from "../lib/api";
import { useRequireAuth } from "../lib/use-require-auth";

type QuizListItem = {
  id: string;
  title: string;
  subject: string | null;
  created_at: string;
};

export default function QuizPage() {
  const auth = useRequireAuth();
  const [token, setToken] = useState<string | null>(null);
  const [quizzes, setQuizzes] = useState<QuizListItem[]>([]);
  const [liveMsg, setLiveMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const hdr = useMemo(() => authHeader(token), [token]);

  useEffect(() => {
    if (!auth) return;
    setToken(getAccessToken());
    const socket = io({ path: "/socket.io" });
    socket.on("leaderboard:update", (evt: any) => {
      setLiveMsg(`🏆 Quiz cập nhật: ${evt.quizId?.slice(0, 8)} · Điểm ${evt.score}`);
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
      const res = await fetch(`${API_BASE}/quiz`, { headers: hdr });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError("Không thể tải danh sách quiz. Vui lòng thử lại.");
        return;
      }
      setQuizzes((j.quizzes ?? []) as QuizListItem[]);
    } catch {
      setError("Lỗi kết nối khi tải quiz.");
    } finally {
      setLoading(false);
    }
  }

  async function seedQuizzes() {
    setSeeding(true);
    try {
      const res = await fetch(`${API_BASE}/quiz/seed`, { method: "POST", headers: hdr });
      if (res.ok) await loadQuizzes();
      else setError("Không thể tạo quiz mẫu.");
    } catch {
      setError("Lỗi kết nối khi tạo quiz mẫu.");
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
        <button
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_-6px_rgba(225,29,72,0.6)] hover:from-rose-500 hover:to-rose-400 transition"
          onClick={loadQuizzes}
        >
          <RefreshIcon />
          Làm mới
        </button>
      }
    >
      <div className="grid gap-4">
        {/* Live leaderboard toast */}
        {liveMsg && (
          <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 animate-fadeIn">
            <span className="shrink-0 text-amber-500">📡</span>
            {liveMsg}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>⚠</span> {error}
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
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
            <div className="text-4xl mb-3">📝</div>
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
                {seeding ? "Đang tạo..." : "✨ Tạo quiz mẫu"}
              </button>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function QuizCard({ quiz }: { quiz: QuizListItem }) {
  const seed = hashToHue(quiz.id);
  const banner = `linear-gradient(135deg, hsla(${seed},88%,52%,0.92), hsla(${(seed + 38) % 360},88%,56%,0.80))`;
  const created = new Date(quiz.created_at);

  return (
    <Link
      href={`/quiz/${quiz.id}`}
      className="group overflow-hidden rounded-2xl border border-black/5 bg-white shadow-[0_4px_20px_-12px_rgba(2,6,23,0.18)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_36px_-16px_rgba(2,6,23,0.28)]"
    >
      <div className="relative h-32 flex items-end p-3" style={{ background: banner }}>
        <div className="absolute inset-0 opacity-20 [background:radial-gradient(700px_180px_at_10%_10%,white,transparent)]" />
        {quiz.subject && (
          <span className="relative rounded-lg bg-white/85 px-2.5 py-1 text-xs font-semibold text-slate-800 shadow-sm">
            {quiz.subject}
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="truncate text-sm font-bold text-slate-900">{quiz.title}</div>
        <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
          <span>📅 {created.toLocaleDateString("vi-VN")}</span>
          <span className="ml-auto text-xs font-semibold text-rose-600 group-hover:text-rose-500 transition">
            Làm bài →
          </span>
        </div>
      </div>
    </Link>
  );
}

function hashToHue(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
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
