import Link from "next/link";
import Head from "next/head";
import { useRouter } from "next/router";
import { ReactNode, useMemo, useState } from "react";
import { useAuth } from "../../lib/auth-context";

type NavItem = { href: string; label: string; icon: ReactNode };

const NAV: NavItem[] = [
  { href: "/", label: "Trang chủ", icon: <HomeIcon /> },
  { href: "/documents", label: "Tài liệu", icon: <DocIcon /> },
  { href: "/chat", label: "Chat AI", icon: <ChatIcon /> },
  { href: "/quiz", label: "Quiz", icon: <QuizIcon /> },
  { href: "/profile", label: "Hồ sơ", icon: <UserIcon /> },
];

export function AppShell(props: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  right?: ReactNode;
  search?: ReactNode;
}) {
  const router = useRouter();
  const activeHref = useMemo(() => {
    const p = router.asPath || "/";
    if (p === "/") return "/";
    const hit = NAV.find((n) => p === n.href || p.startsWith(`${n.href}/`));
    return hit?.href ?? "";
  }, [router.asPath]);

  return (
    <>
      <Head>
        <title>{props.title} — P-Documents</title>
      </Head>
      <div className="min-h-screen bg-pdocs text-slate-900">
        <div className="mx-auto max-w-[1440px] px-4 py-5 lg:px-6">
          <div className="grid gap-4 lg:grid-cols-[256px_1fr]">
            {/* ── Sidebar ── */}
            <aside className="flex flex-col rounded-2xl border border-white/70 bg-white/70 shadow-[0_8px_32px_-16px_rgba(2,6,23,0.18)] backdrop-blur-xl lg:sticky lg:top-5 lg:max-h-[calc(100vh-40px)]">
              {/* Brand */}
              <div className="px-5 pt-5">
                <Link href="/" className="flex items-center gap-3 group">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-rose-600 to-rose-500 text-white shadow-[0_8px_18px_-8px_rgba(225,29,72,0.6)] transition group-hover:shadow-[0_10px_22px_-8px_rgba(225,29,72,0.75)]">
                    <span className="text-sm font-bold tracking-wide">PD</span>
                  </div>
                  <div>
                    <div className="text-sm font-bold leading-5 text-slate-900">P-Documents</div>
                    <div className="text-[11px] text-slate-400">Study · Share · Quiz</div>
                  </div>
                </Link>

                {/* Nav */}
                <nav className="mt-6 grid gap-0.5">
                  {NAV.map((item) => {
                    const isActive = item.href === activeHref;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={[
                          "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                          isActive
                            ? "bg-rose-50 text-rose-700 shadow-[inset_0_0_0_1px_rgba(244,63,94,0.2)]"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "grid h-8 w-8 shrink-0 place-items-center rounded-lg transition",
                            isActive
                              ? "bg-white text-rose-600 shadow-sm"
                              : "text-slate-400 group-hover:text-slate-600",
                          ].join(" ")}
                        >
                          {item.icon}
                        </span>
                        {item.label}
                        {isActive && (
                          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-rose-500" />
                        )}
                      </Link>
                    );
                  })}
                </nav>
              </div>

              {/* Spacer */}
              <div className="flex-1" />

              {/* User block */}
              <SidebarUser />
            </aside>

            {/* ── Main ── */}
            <section className="min-w-0">
              {/* Topbar */}
              <header className="rounded-2xl border border-white/70 bg-white/70 shadow-[0_8px_32px_-16px_rgba(2,6,23,0.18)] backdrop-blur-xl">
                <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="text-lg font-bold leading-6 text-slate-900">{props.title}</div>
                    {props.subtitle && (
                      <div className="mt-0.5 text-xs text-slate-500">{props.subtitle}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {props.search ? (
                      <div className="w-full sm:w-[320px]">{props.search}</div>
                    ) : null}
                    {props.right}
                  </div>
                </div>
              </header>

              <main className="mt-4 animate-fadeIn">{props.children}</main>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Sidebar User Block ── */
function SidebarUser() {
  const { authState, logout } = useAuth();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try { await logout(); } finally { setLoggingOut(false); }
    router.push("/login");
  }

  return (
    <div className="border-t border-black/5 px-4 py-4">
      {authState.status === "loading" && (
        <div className="flex items-center gap-3 animate-pulse">
          <div className="h-9 w-9 rounded-full bg-slate-200 shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-2.5 w-20 rounded bg-slate-200" />
            <div className="h-2 w-28 rounded bg-slate-200" />
          </div>
        </div>
      )}

      {authState.status === "unauthenticated" && (
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-600">Chưa đăng nhập</div>
            <div className="text-[11px] text-slate-400">Đăng nhập để tiếp tục</div>
          </div>
          <Link
            href="/login"
            className="shrink-0 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-500 transition"
          >
            Đăng nhập
          </Link>
        </div>
      )}

      {authState.status === "authenticated" && (
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-rose-500 to-rose-400 text-xs font-bold text-white shadow-sm select-none">
            {(authState.user.display_name || authState.user.email).slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-semibold text-slate-800">
              {authState.user.display_name || "Người dùng"}
            </div>
            <div className="truncate text-[11px] text-slate-500">{authState.user.email}</div>
          </div>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            title="Đăng xuất"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-black/5 bg-white text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition disabled:opacity-50"
          >
            {loggingOut ? <SpinIcon /> : <LogoutIcon />}
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Icons ── */
function HomeIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 10.5L12 3l8 7.5V20a1 1 0 0 1-1 1h-5v-7H10v7H5a1 1 0 0 1-1-1v-9.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}
function DocIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 3h7l3 3v15a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M14 3v4a1 1 0 0 0 1 1h4" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8.5 12h7M8.5 16h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function ChatIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 14a4 4 0 0 1-4 4H9l-5 3V6a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8 8.5h8M8 12h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function QuizIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 3h8a2 2 0 0 1 2 2v16l-6-3-6 3V5a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 8h6M9 12h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function UserIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 21a8 8 0 1 0-16 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 13a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}
function LogoutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="16 17 21 12 16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function SpinIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true" style={{ animation: "spin 0.8s linear infinite" }}>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}
