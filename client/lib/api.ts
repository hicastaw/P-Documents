export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("pdocs_access_token");
}

export function authHeader(token: string | null): Record<string, string> {
  return token ? { authorization: `Bearer ${token}` } : {};
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (json as any)?.error ?? `http_${res.status}`;
    throw new Error(msg);
  }
  return json as T;
}

export async function apiJsonAuth<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAccessToken();
  return apiJson<T>(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...authHeader(token),
    },
  });
}

