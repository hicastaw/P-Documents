import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "../components/shell/AppShell";
import { API_BASE, apiJsonAuth } from "../services/api";
import { useRequireAuth } from "../hooks/use-require-auth";
import { hashToAvatarColor } from "../utils/colors";
import { PenSquare, AlertCircle, X, MessageSquare } from "lucide-react";

type Thread = {
  id: string;
  title: string;
  body: string;
  author_id: string;
  author_name: string | null;
  author_email: string | null;
  post_count: number;
  created_at: string;
  updated_at: string;
};

export default function ForumPage() {
  const auth = useRequireAuth();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (auth) loadThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!auth]);

  if (!auth) return null;

  async function loadThreads() {
    setError(null);
    setLoading(true);
    try {
      const json = await apiJsonAuth<{ threads: Thread[] }>(`/forum/threads?q=${encodeURIComponent(q)}`);
      setThreads(json.threads ?? []);
    } catch {
      setError("Không thể tải danh sách chủ đề.");
    } finally {
      setLoading(false);
    }
  }

  async function createThread() {
    if (!newTitle.trim() || !newBody.trim()) return;
    setCreating(true);
    try {
      await apiJsonAuth("/forum/threads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), body: newBody.trim() }),
      });
      setNewTitle("");
      setNewBody("");
      setShowCreate(false);
      await loadThreads();
    } catch {
      setError("Không thể tạo chủ đề mới.");
    } finally {
      setCreating(false);
    }
  }

  const filtered = threads.filter(
    (t) =>
      !q.trim() ||
      t.title.toLowerCase().includes(q.toLowerCase()) ||
      (t.author_name ?? "").toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <AppShell
      title="Diễn đàn"
      subtitle={`${threads.length} chủ đề thảo luận`}
      search={
        <div className="relative">
          <input
            className="w-full rounded-xl border border-black/8 bg-white/90 px-4 py-2.5 pr-10 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-rose-300 focus:ring-4 focus:ring-rose-100 transition"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadThreads()}
            placeholder="Tìm chủ đề..."
          />
          <button
            onClick={loadThreads}
            disabled={loading}
            className="absolute inset-y-0 right-2 grid place-items-center px-2 text-slate-400 hover:text-rose-500 transition"
          >
            <SearchIcon />
          </button>
        </div>
      }
      right={
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_6px_18px_-8px_rgba(225,29,72,0.6)] hover:from-rose-500 hover:to-rose-400 transition hover:shadow-[0_8px_22px_-8px_rgba(225,29,72,0.75)]"
        >
          <PlusIcon />
          Tạo chủ đề
        </button>
      }
    >
      <div className="grid gap-4">
        {/* Create thread form */}
        {showCreate && (
          <div className="rounded-2xl border border-rose-100 bg-white p-5 animate-fadeIn shadow-sm">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-800 mb-3">
              <PenSquare size={15} strokeWidth={2} /> Tạo chủ đề mới
            </div>
            <input
              className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-rose-300 focus:ring-4 focus:ring-rose-100 transition mb-3"
              placeholder="Tiêu đề chủ đề..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <textarea
              className="w-full min-h-[120px] resize-none rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-rose-300 focus:ring-4 focus:ring-rose-100 transition mb-3"
              placeholder="Nội dung thảo luận..."
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
            />
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => setShowCreate(false)}
                className="rounded-xl border border-black/10 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
              >
                Hủy
              </button>
              <button
                onClick={createThread}
                disabled={creating || !newTitle.trim() || !newBody.trim()}
                className="rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 px-5 py-2 text-sm font-semibold text-white shadow-[0_4px_14px_-6px_rgba(225,29,72,0.6)] hover:from-rose-500 hover:to-rose-400 transition disabled:opacity-50"
              >
                {creating ? "Đang tạo..." : "Đăng chủ đề"}
              </button>
            </div>
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

        {/* Thread list */}
        {loading ? (
          <div className="grid gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border border-black/5 bg-white p-5 animate-pulse">
                <div className="h-4 w-2/3 rounded bg-slate-200 mb-3" />
                <div className="h-3 w-1/2 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid gap-3">
            {filtered.map((thread) => (
              <ThreadCard key={thread.id} thread={thread} />
            ))}
          </div>
        ) : (
          <div className="py-16 text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
              <MessageSquare size={22} strokeWidth={1.8} />
            </div>
            <div className="text-sm font-semibold text-slate-600 mb-1">
              {q ? "Không tìm thấy chủ đề phù hợp" : "Chưa có chủ đề nào"}
            </div>
            <div className="text-xs text-slate-400">
              {q ? "Thử tìm với từ khoá khác" : "Hãy tạo chủ đề đầu tiên để bắt đầu thảo luận!"}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function ThreadCard({ thread }: { thread: Thread }) {
  const avatar = hashToAvatarColor(thread.id);
  const initials = (thread.author_name ?? thread.author_email ?? "?").slice(0, 2).toUpperCase();
  const timeAgo = getTimeAgo(thread.updated_at);

  return (
    <Link
      href={`/forum/${thread.id}`}
      className="group flex items-start gap-4 rounded-2xl border border-black/5 bg-white p-4 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-popover"
    >
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xs font-bold ${avatar.bg} ${avatar.text}`}>
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold text-slate-900 group-hover:text-rose-700 transition">
          {thread.title}
        </div>
        <div className="mt-1 text-xs text-slate-500 line-clamp-2">{thread.body}</div>
        <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
          <span>{thread.author_name ?? thread.author_email ?? "Ẩn danh"}</span>
          <span>·</span>
          <span>{timeAgo}</span>
          <span className="ml-auto flex items-center gap-1 text-slate-500 font-medium">
            <ReplyIcon /> {thread.post_count}
          </span>
        </div>
      </div>
    </Link>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} giờ trước`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} ngày trước`;
  return new Date(dateStr).toLocaleDateString("vi-VN");
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="m16.5 16.5 4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function ReplyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 14a4 4 0 0 1-4 4H9l-5 3V6a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}
