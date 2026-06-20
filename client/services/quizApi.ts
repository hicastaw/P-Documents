import { API_BASE, authHeader, getAccessToken } from "./api";

function hdr() {
  return authHeader(getAccessToken());
}

export type QuizListItem = { id: string; title: string; subject: string | null; created_at: string };

export async function listQuizzes() {
  const res = await fetch(`${API_BASE}/quiz`, { headers: hdr() });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j?.error ?? "load_failed");
  return j as { quizzes: QuizListItem[] };
}

export async function seedQuizzes() {
  const res = await fetch(`${API_BASE}/quiz/seed`, { method: "POST", headers: hdr() });
  if (!res.ok) throw new Error("seed_failed");
  return res.json().catch(() => ({}));
}

export async function createQuiz(payload: { title: string; subject?: string; questions: unknown }) {
  const res = await fetch(`${API_BASE}/quiz`, {
    method: "POST",
    headers: { "content-type": "application/json", ...hdr() },
    body: JSON.stringify(payload),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j?.error ?? "create_failed");
  return j as { quiz: { id: string } };
}

export async function getQuiz(quizId: string) {
  const res = await fetch(`${API_BASE}/quiz/${quizId}`, { headers: hdr() });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j?.error ?? "load_failed");
  return j;
}

export async function getLeaderboard(quizId: string) {
  const res = await fetch(`${API_BASE}/quiz/${quizId}/leaderboard`, { headers: hdr() });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j?.error ?? "load_failed");
  return j;
}

export async function getHistory(quizId: string) {
  const res = await fetch(`${API_BASE}/quiz/${quizId}/history`, { headers: hdr() });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j?.error ?? "load_failed");
  return j;
}

export async function submitQuiz(quizId: string, payload: { answers: any[]; timeTakenSeconds: number }) {
  const res = await fetch(`${API_BASE}/quiz/${quizId}/submit`, {
    method: "POST",
    headers: { "content-type": "application/json", ...hdr() },
    body: JSON.stringify(payload),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j?.error ?? "submit_failed");
  return j;
}
