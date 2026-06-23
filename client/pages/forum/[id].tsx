import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { AppShell } from "../../components/shell/AppShell";
import { API_BASE, apiJsonAuth, getAccessToken } from "../../services/api";
import { useRequireAuth } from "../../hooks/use-require-auth";
import { useAuth } from "../../hooks/auth-context";
import { hashToAvatarColor } from "../../utils/colors";
import { ArrowLeft, AlertCircle, X, Send } from "lucide-react";

type ThreadDetail = {
  id: string;
  title: string;
  body: string;
  author_id: string;
  author_name: string | null;
  author_email: string | null;
  created_at: string;
};

type Post = {
  id: string;
  body: string;
  parent_id: string | null;
  author_id: string;
  author_name: string | null;
  author_email: string | null;
  created_at: string;
};

export default function ForumThreadPage() {
  const auth = useRequireAuth();
  const { authState } = useAuth();
  const router = useRouter();
  const threadId = typeof router.query.id === "string" ? router.query.id : null;

  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const currentUserId = authState.status === "authenticated" ? authState.user.id : null;

  useEffect(() => {
    if (!threadId || !auth) return;
    loadThread();

    const socket = io({ path: "/socket.io" });
    if (currentUserId) {
      socket.on(`notify:${currentUserId}`, () => {
        loadThread(); // Refresh when we get a notification (someone replied)
      });
    }
    return () => { socket.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, !!auth]);

  async function loadThread() {
    if (!threadId) return;
    setLoading(true);
    try {
      const json = await apiJsonAuth<{ thread: ThreadDetail; posts: Post[] }>(`/forum/threads/${threadId}`);
      setThread(json.thread);
      setPosts(json.posts ?? []);
    } catch {
      setError("Không thể tải chủ đề.");
    } finally {
      setLoading(false);
    }
  }

  async function sendReply() {
    if (!threadId || !reply.trim()) return;
    setSending(true);
    try {
      await apiJsonAuth(`/forum/threads/${threadId}/posts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: reply.trim(), parentId: replyTo ?? undefined }),
      });
      setReply("");
      setReplyTo(null);
      await loadThread();
    } catch {
      setError("Không thể gửi bình luận.");
    } finally {
      setSending(false);
    }
  }

  async function deletePost(postId: string) {
    try {
      await apiJsonAuth(`/forum/posts/${postId}`, { method: "DELETE" });
      await loadThread();
    } catch {
      setError("Không thể xóa bình luận.");
    }
  }

  if (!auth) return null;

  // Build nested structure (1-level deep)
  const topPosts = posts.filter((p) => !p.parent_id);
  const repliesMap = new Map<string, Post[]>();
  posts.filter((p) => p.parent_id).forEach((p) => {
    const existing = repliesMap.get(p.parent_id!) ?? [];
    existing.push(p);
    repliesMap.set(p.parent_id!, existing);
  });

  const replyToPost = replyTo ? posts.find((p) => p.id === replyTo) : null;

  return (
    <AppShell
      title={thread?.title ?? "Chủ đề"}
      subtitle={thread ? `bởi ${thread.author_name ?? thread.author_email ?? "Ẩn danh"}` : undefined}
    >
      <div className="grid gap-4 max-w-3xl">
        <Link className="flex items-center gap-1.5 text-sm font-semibold text-rose-700 underline decoration-rose-300" href="/forum">
          <ArrowLeft size={14} strokeWidth={2} /> Quay lại diễn đàn
        </Link>

        {error && (
          <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle size={16} strokeWidth={2} className="shrink-0" /> {error}
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        )}

        {loading && !thread && (
          <div className="rounded-2xl border border-black/5 bg-white p-6 animate-pulse">
            <div className="h-5 w-2/3 rounded bg-slate-200 mb-4" />
            <div className="h-3 w-full rounded bg-slate-100 mb-2" />
            <div className="h-3 w-4/5 rounded bg-slate-100" />
          </div>
        )}

        {/* Thread body */}
        {thread && (
          <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-[0_4px_20px_-12px_rgba(2,6,23,0.15)]">
            <div className="flex items-start gap-3">
              <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xs font-bold ${hashToAvatarColor(thread.author_id).bg} ${hashToAvatarColor(thread.author_id).text}`}>
                {(thread.author_name ?? thread.author_email ?? "?").slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-lg font-bold text-slate-900">{thread.title}</div>
                <div className="mt-0.5 text-xs text-slate-400">
                  {thread.author_name ?? thread.author_email ?? "Ẩn danh"} · {new Date(thread.created_at).toLocaleString("vi-VN")}
                </div>
              </div>
            </div>
            <div className="mt-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{thread.body}</div>
          </div>
        )}

        {/* Posts */}
        <div className="grid gap-3">
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            {posts.length} bình luận
          </div>

          {topPosts.map((post) => (
            <div key={post.id}>
              <PostCard
                post={post}
                isOwn={post.author_id === currentUserId}
                onReply={() => setReplyTo(post.id)}
                onDelete={() => deletePost(post.id)}
              />
              {/* Nested replies */}
              {(repliesMap.get(post.id) ?? []).map((child) => (
                <div key={child.id} className="ml-8 mt-1.5">
                  <PostCard
                    post={child}
                    isOwn={child.author_id === currentUserId}
                    onReply={() => setReplyTo(post.id)}
                    onDelete={() => deletePost(child.id)}
                    isReply
                  />
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Reply input */}
        {thread && (
          <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
            {replyToPost && (
              <div className="mb-2 flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-1.5 text-xs text-rose-700">
                Trả lời {replyToPost.author_name ?? "bình luận"}
                <button onClick={() => setReplyTo(null)} className="ml-auto text-rose-400 hover:text-rose-600">
                  <X size={13} strokeWidth={2} />
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <textarea
                className="min-h-[52px] flex-1 resize-none rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-rose-300 focus:ring-4 focus:ring-rose-100 transition"
                placeholder="Viết bình luận..."
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendReply();
                  }
                }}
                rows={2}
              />
              <button
                onClick={sendReply}
                disabled={sending || !reply.trim()}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_-6px_rgba(225,29,72,0.6)] hover:from-rose-500 hover:to-rose-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={14} strokeWidth={2} />
                Gửi
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function PostCard(props: {
  post: Post;
  isOwn: boolean;
  onReply: () => void;
  onDelete: () => void;
  isReply?: boolean;
}) {
  const { post, isOwn, onReply, onDelete, isReply } = props;
  const avatar = hashToAvatarColor(post.author_id);
  const initials = (post.author_name ?? post.author_email ?? "?").slice(0, 2).toUpperCase();

  return (
    <div className={[
      "rounded-2xl border bg-white p-4 transition",
      isReply ? "border-black/3 bg-slate-50/60" : "border-black/5",
    ].join(" ")}>
      <div className="flex items-start gap-3">
        <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[10px] font-bold ${avatar.bg} ${avatar.text}`}>
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-800">
              {post.author_name ?? post.author_email ?? "Ẩn danh"}
            </span>
            <span className="text-[10px] text-slate-400">
              {getTimeAgo(post.created_at)}
            </span>
          </div>
          <div className="mt-1 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{post.body}</div>
          <div className="mt-2 flex items-center gap-3">
            <button
              onClick={onReply}
              className="text-xs font-medium text-slate-400 hover:text-rose-600 transition"
            >
              Trả lời
            </button>
            {isOwn && (
              <button
                onClick={onDelete}
                className="text-xs font-medium text-slate-400 hover:text-red-600 transition"
              >
                Xóa
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
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
