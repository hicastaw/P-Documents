import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { useAuth } from "../lib/auth-context";

type Tab = "login" | "register";

export default function LoginPage() {
  const router = useRouter();
  const { authState, login, register } = useAuth();
  const [tab, setTab] = useState<Tab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    if (authState.status === "authenticated") {
      if (authState.user.role === "admin") {
        router.replace("/admin");
      } else {
        router.replace("/documents");
      }
    }
  }, [authState.status, authState.user, router]);

  function switchTab(t: Tab) {
    setTab(t);
    setError(null);
    setShowPass(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (tab === "login") {
        await login(email.trim().toLowerCase(), password);
      } else {
        if (!displayName.trim()) {
          setError("Vui lòng nhập tên hiển thị.");
          return;
        }
        await register(email.trim().toLowerCase(), password, displayName.trim());
      }
    } catch (err: any) {
      const code: string = err?.message ?? "unknown_error";
      const MSG: Record<string, string> = {
        invalid_credentials: "Email hoặc mật khẩu không đúng.",
        email_exists: "Email này đã được đăng ký rồi. Vui lòng đăng nhập.",
        validation_error: "Thông tin không hợp lệ. Kiểm tra email và mật khẩu (ít nhất 8 ký tự).",
      };
      setError(MSG[code] ?? "Đã xảy ra lỗi, vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  const loading = authState.status === "loading";

  return (
    <>
      <Head>
        <title>{tab === "login" ? "Đăng nhập" : "Đăng ký"} — P-Documents</title>
      </Head>
      <div className="min-h-screen bg-login flex items-center justify-center p-4">
        {/* Decorative blobs */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-rose-400/20 blur-3xl" />
          <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-sky-400/15 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-400/10 blur-3xl" />
        </div>

        <div className="relative w-full max-w-[420px] animate-scaleIn">
          {/* Card */}
          <div className="overflow-hidden rounded-3xl border border-white/60 bg-white/80 shadow-[0_32px_80px_-20px_rgba(2,6,23,0.28)] backdrop-blur-xl">
            {/* Top accent bar */}
            <div className="h-1 bg-gradient-to-r from-rose-500 via-rose-400 to-pink-400" />

            <div className="px-8 py-8">
              {/* Logo */}
              <div className="mb-7 flex flex-col items-center gap-3 text-center">
                <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-rose-600 to-rose-500 text-white shadow-[0_14px_30px_-10px_rgba(225,29,72,0.55)]">
                  <span className="text-xl font-bold tracking-wider">PD</span>
                </div>
                <div>
                  <div className="text-2xl font-bold tracking-tight text-slate-900">P-Documents</div>
                  <div className="mt-0.5 text-sm text-slate-500">Quản lý & chia sẻ tài liệu thông minh</div>
                </div>
              </div>

              {/* Tab switch */}
              <div className="mb-6 flex rounded-2xl border border-black/5 bg-slate-100/80 p-1">
                {(["login", "register"] as Tab[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => switchTab(t)}
                    className={[
                      "flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all duration-200",
                      tab === t
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700",
                    ].join(" ")}
                  >
                    {t === "login" ? "Đăng nhập" : "Đăng ký"}
                  </button>
                ))}
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="grid gap-4">
                {tab === "register" && (
                  <div className="animate-fadeIn grid gap-1.5">
                    <label className="text-xs font-semibold text-slate-600">Tên hiển thị</label>
                    <input
                      className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-rose-300 focus:ring-4 focus:ring-rose-100 transition"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Tên của bạn"
                      autoComplete="name"
                      required
                    />
                  </div>
                )}

                <div className="grid gap-1.5">
                  <label className="text-xs font-semibold text-slate-600">Email</label>
                  <input
                    className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-rose-300 focus:ring-4 focus:ring-rose-100 transition"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                  />
                </div>

                <div className="grid gap-1.5">
                  <label className="text-xs font-semibold text-slate-600">Mật khẩu</label>
                  <div className="relative">
                    <input
                      className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 pr-11 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-rose-300 focus:ring-4 focus:ring-rose-100 transition"
                      type={showPass ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={tab === "register" ? "Tối thiểu 8 ký tự" : "••••••••"}
                      autoComplete={tab === "login" ? "current-password" : "new-password"}
                      required
                      minLength={tab === "register" ? 8 : 1}
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPass((v) => !v)}
                      className="absolute inset-y-0 right-3 grid place-items-center text-slate-400 hover:text-slate-600 transition"
                    >
                      {showPass ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 animate-fadeIn">
                    <span className="mt-0.5 shrink-0">⚠</span>
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy || loading}
                  className="mt-1 w-full rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_-10px_rgba(225,29,72,0.65)] hover:from-rose-500 hover:to-rose-400 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {busy ? (
                    <span className="flex items-center justify-center gap-2">
                      <SpinIcon />
                      {tab === "login" ? "Đang đăng nhập..." : "Đang tạo tài khoản..."}
                    </span>
                  ) : tab === "login" ? "Đăng nhập" : "Tạo tài khoản"}
                </button>
              </form>

              <p className="mt-5 text-center text-xs text-slate-500">
                {tab === "login" ? (
                  <>
                    Chưa có tài khoản?{" "}
                    <button
                      type="button"
                      className="font-semibold text-rose-600 hover:text-rose-500 transition"
                      onClick={() => switchTab("register")}
                    >
                      Đăng ký ngay
                    </button>
                  </>
                ) : (
                  <>
                    Đã có tài khoản?{" "}
                    <button
                      type="button"
                      className="font-semibold text-rose-600 hover:text-rose-500 transition"
                      onClick={() => switchTab("login")}
                    >
                      Đăng nhập
                    </button>
                  </>
                )}
              </p>
            </div>
          </div>

          <p className="mt-5 text-center text-xs text-slate-400">
            © 2026 P-Documents · Study · Share · Quiz
          </p>
        </div>
      </div>

      <style jsx global>{`
        .bg-login {
          background:
            radial-gradient(800px 600px at 15% 10%, rgba(244, 63, 94, 0.18), transparent 60%),
            radial-gradient(700px 500px at 90% 80%, rgba(14, 165, 233, 0.14), transparent 55%),
            radial-gradient(600px 500px at 50% 50%, rgba(139, 92, 246, 0.08), transparent 60%),
            linear-gradient(165deg, #fff1f2 0%, #f8fafc 40%, #eff6ff 100%);
        }
      `}</style>
    </>
  );
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 11 7 11 7a13.16 13.16 0 0 1-1.67 2.68" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 1 12s4 7 11 7a9.74 9.74 0 0 0 5.39-1.61" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M2 2l20 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function SpinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true" style={{ animation: "spin 0.8s linear infinite" }}>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}
