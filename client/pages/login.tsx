import { useState } from "react";
import { useRouter } from "next/router";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("student@example.com");
  const [password, setPassword] = useState("password123");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json?.error ?? "login_failed");
      return;
    }
    setAccessToken(json.accessToken);
    localStorage.setItem("pdocs_access_token", json.accessToken);
  }

  async function onRegister() {
    setError(null);
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, displayName: "Student" }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j?.error ?? "register_failed");
      return;
    }
    await onLogin({ preventDefault() {} } as any);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-lg px-6 py-10">
        <h1 className="text-2xl font-semibold">Đăng nhập</h1>

        <form onSubmit={onLogin} className="mt-6 grid gap-3">
          <input
            className="w-full rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email"
          />
          <input
            className="w-full rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="password"
          />

          <div className="mt-2 flex gap-2">
            <button className="rounded-lg bg-sky-600 px-4 py-2 font-medium" type="submit">
              Login
            </button>
            <button
              className="rounded-lg border border-slate-700 px-4 py-2 font-medium"
              type="button"
              onClick={onRegister}
            >
              Register
            </button>
            <button
              className="ml-auto rounded-lg border border-slate-700 px-4 py-2"
              type="button"
              onClick={() => router.push("/")}
            >
              Home
            </button>
          </div>
        </form>

        {error ? <div className="mt-4 text-sm text-red-300">Error: {error}</div> : null}
        {accessToken ? (
          <div className="mt-4 text-sm text-slate-300">
            Saved access token to localStorage. Bạn có thể vào <a className="text-sky-300 underline" href="/documents">Documents</a>.
          </div>
        ) : null}
      </div>
    </main>
  );
}

