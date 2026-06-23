export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api";

const ACCESS_TOKEN_KEY = "pdocs_access_token";
const REFRESH_TOKEN_KEY = "pdocs_refresh_token";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function authHeader(token: string | null): Record<string, string> {
  return token ? { authorization: `Bearer ${token}` } : {};
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (json as any)?.error ?? `http_${res.status}`;
    throw Object.assign(new Error(msg), { statusCode: res.status });
  }
  return json as T;
}

// Ensures concurrent 401s only trigger a single /auth/refresh call.
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  if (!refreshPromise) {
    refreshPromise = apiJson<{ accessToken: string; refreshToken: string }>("/auth/refresh", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    })
      .then((json) => {
        setTokens(json.accessToken, json.refreshToken);
        return json.accessToken;
      })
      .catch(() => {
        clearTokens();
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function apiJsonAuth<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAccessToken();
  try {
    return await apiJson<T>(path, {
      ...init,
      headers: { ...(init?.headers ?? {}), ...authHeader(token) },
    });
  } catch (err) {
    if ((err as any)?.statusCode === 401 && getRefreshToken()) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        return apiJson<T>(path, {
          ...init,
          headers: { ...(init?.headers ?? {}), ...authHeader(newToken) },
        });
      }
    }
    throw err;
  }
}
