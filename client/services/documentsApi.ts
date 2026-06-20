import { API_BASE, apiJsonAuth, authHeader, getAccessToken } from "./api";

export type Doc = {
  id: string;
  title: string;
  description: string | null;
  mime: string;
  size: number;
  status: string;
  created_at: string;
  uploader_name: string | null;
  uploader_email: string | null;
  category_id: string | null;
  category_slug: string | null;
  category_name: string | null;
  stars: number;
  downloads: number;
  is_starred: boolean;
};

export function searchDocuments(q: string) {
  return apiJsonAuth<{ documents: Doc[] }>(`/documents?q=${encodeURIComponent(q)}`);
}

export function presignUpload(file: File) {
  return apiJsonAuth<{ objectKey: string; presignedPutUrl: string }>("/documents/presign", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      mime: file.type || "application/pdf",
      size: file.size,
    }),
  });
}

export function uploadFileToStorage(presignedPutUrl: string, file: File) {
  return fetch(presignedPutUrl, {
    method: "PUT",
    headers: { "content-type": file.type || "application/pdf" },
    body: file,
  });
}

export function completeUpload(opts: {
  objectKey: string;
  title: string;
  description?: string;
  category?: string;
  mime: string;
  size: number;
}) {
  return apiJsonAuth<{ document: Doc }>("/documents/complete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(opts),
  });
}

export async function toggleStar(documentId: string) {
  const res = await fetch(`${API_BASE}/documents/${documentId}/star`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader(getAccessToken()) },
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j?.error ?? "star_failed");
  return j as { starred: boolean; stars: number };
}

export async function getDownloadUrl(documentId: string) {
  const res = await fetch(`${API_BASE}/documents/${documentId}/download`, {
    headers: authHeader(getAccessToken()),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j?.error ?? "download_failed");
  return j as { presignedGetUrl: string };
}

export async function reportDocument(documentId: string, reason: string) {
  const res = await fetch(`${API_BASE}/documents/${documentId}/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader(getAccessToken()) },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw new Error("report_failed");
  return res.json().catch(() => ({ success: true }));
}
