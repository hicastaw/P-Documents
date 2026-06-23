import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { AppShell } from "../components/shell/AppShell";
import { apiJsonAuth } from "../services/api";
import { useRequireAuth } from "../hooks/use-require-auth";
import { useAuth } from "../hooks/auth-context";
import {
  FileText,
  Bot,
  ClipboardList,
  MessageSquare,
  User,
  Users,
  ArrowRight,
} from "lucide-react";

type Doc = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  uploader_name: string | null;
};

type Stats = {
  documents: number;
  users: number;
  quizzes: number;
  quizAttempts: number;
};

export default function HomePage() {
  const router = useRouter();
  const auth = useRequireAuth();
  const { authState } = useAuth();
  const [recentDocs, setRecentDocs] = useState<Doc[]>([]);
  const [stats, setStats] = useState<Stats>({ documents: 0, users: 0, quizzes: 0, quizAttempts: 0 });

  useEffect(() => {
    if (!auth) return;
    if (authState.status === "authenticated" && authState.user.role === "admin") {
      router.replace("/admin");
      return;
    }
    apiJsonAuth<{ documents: Doc[] }>("/documents").then((j) => {
      setRecentDocs((j.documents ?? []).slice(0, 4));
    });
    apiJsonAuth<Stats>("/stats").then((s) => setStats(s)).catch(() => {});
  }, [!!auth, authState.status, authState.user, router]);

  if (!auth) return null;

  const userName =
    authState.status === "authenticated"
      ? authState.user.display_name || authState.user.email.split("@")[0]
      : "";

  const FEATURES = [
    {
      href: "/documents",
      icon: FileText,
      title: "Tài liệu",
      desc: "Upload, quản lý & chia sẻ PDF với mọi người trong hệ thống.",
      cta: "Mở kho tài liệu",
    },
    {
      href: "/chat",
      icon: Bot,
      title: "Chat AI",
      desc: "Đặt câu hỏi và nhận câu trả lời thông minh từ nội dung tài liệu.",
      cta: "Bắt đầu hỏi",
    },
    {
      href: "/quiz",
      icon: ClipboardList,
      title: "Quiz",
      desc: "Kiểm tra kiến thức với bài quiz tự động từ tài liệu học.",
      cta: "Làm bài quiz",
    },
    {
      href: "/forum",
      icon: MessageSquare,
      title: "Diễn đàn",
      desc: "Thảo luận, đặt câu hỏi và chia sẻ kiến thức với cộng đồng.",
      cta: "Vào diễn đàn",
    },
    {
      href: "/profile",
      icon: User,
      title: "Hồ sơ",
      desc: "Xem thông tin tài khoản và lịch sử tài liệu đã upload.",
      cta: "Xem hồ sơ",
    },
  ];

  return (
    <AppShell title="Trang chủ" subtitle={`Xin chào, ${userName}!`}>
      <div className="grid gap-5">
        {/* Stats Bar */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Tài liệu chia sẻ", value: stats.documents, icon: FileText },
            { label: "Người dùng", value: stats.users, icon: Users },
            { label: "Quiz đã tạo", value: stats.quizzes, icon: ClipboardList },
            { label: "Bài làm quiz", value: stats.quizAttempts, icon: MessageSquare },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-black/5 bg-white/80 p-4 shadow-card backdrop-blur"
            >
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-rose-50 text-rose-600">
                <s.icon size={16} strokeWidth={2} />
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900">{s.value}</div>
              <div className="mt-0.5 text-xs text-slate-500">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Feature Cards */}
        <div>
          <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
            Tính năng
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {FEATURES.map((f) => (
              <Link
                key={f.href}
                href={f.href}
                className="group flex flex-col rounded-2xl border border-black/5 bg-white p-4 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-popover"
              >
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-rose-50 text-rose-600">
                  <f.icon size={20} strokeWidth={1.8} />
                </div>
                <div className="mt-3 text-sm font-bold text-slate-900">{f.title}</div>
                <div className="mt-1 text-xs leading-relaxed text-slate-500">{f.desc}</div>
                <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-rose-600 group-hover:text-rose-500 transition">
                  {f.cta} <ArrowRight size={13} strokeWidth={2} />
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Docs */}
        {recentDocs.length > 0 && (
          <div className="rounded-2xl border border-black/5 bg-white/80 p-5 backdrop-blur">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-bold text-slate-800">Tài liệu mới nhất</div>
              <Link href="/documents" className="flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-500 transition">
                Xem tất cả <ArrowRight size={12} strokeWidth={2} />
              </Link>
            </div>
            <div className="grid gap-2">
              {recentDocs.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5 hover:bg-slate-100 transition"
                >
                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white text-slate-400">
                    <FileText size={14} strokeWidth={1.8} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-800">{d.title}</div>
                    <div className="text-xs text-slate-400">
                      {d.uploader_name ?? "Ẩn danh"} · {new Date(d.created_at).toLocaleDateString("vi-VN")}
                    </div>
                  </div>
                  <span
                    className={[
                      "shrink-0 rounded-lg px-2 py-0.5 text-[11px] font-semibold",
                      d.status === "approved" ? "bg-emerald-50 text-emerald-700" : "bg-sky-50 text-sky-700",
                    ].join(" ")}
                  >
                    {d.status === "approved" ? "Sẵn sàng" : "Đã upload"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
