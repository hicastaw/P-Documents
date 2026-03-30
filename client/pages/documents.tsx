import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "../components/shell/AppShell";
import { API_BASE, apiJsonAuth, getAccessToken } from "../lib/api";
import { useRequireAuth } from "../lib/use-require-auth";

type Doc = {
  id: string;
  title: string;
  description: string | null;
  mime: string;
  size: number;
  status: string;
  created_at: string;
  uploader_name: string | null;
  uploader_email: string | null;
};

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(s: string) {
  const d = new Date(s);
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const UPLOAD_ERROR_MSG: Record<string, string> = {
  upload_network_failed: "Mất kết nối khi tải file. Vui lòng thử lại.",
  presign_failed: "Không thể khởi tạo phiên upload. Kiểm tra kết nối.",
  complete_failed: "File đã tải nhưng không thể xác nhận. Vui lòng liên hệ hỗ trợ.",
  unauthorized: "Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.",
};

function friendlyUploadError(msg: string): string {
  if (UPLOAD_ERROR_MSG[msg]) return UPLOAD_ERROR_MSG[msg];
  if (msg.includes("413") || msg.includes("too large") || msg.includes("entity too large"))
    return "File quá lớn vượt quá giới hạn cho phép.";
  if (msg.includes("network") || msg.includes("fetch"))
    return "Lỗi kết nối mạng khi tải file.";
  if (msg.includes("timeout")) return "Upload timeout — file quá lớn hoặc kết nối chậm.";
  return "Tải file thất bại. Vui lòng thử lại.";
}

export default function DocumentsPage() {
  const auth = useRequireAuth();
  const [q, setQ] = useState("");
  const [docs, setDocs] = useState<Doc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0); // 0-100
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<any>(null);

  useEffect(() => {
    if (!auth) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!auth]);

  function showToast(msg: string) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const json = await apiJsonAuth<{ documents: Doc[] }>(
        `/documents?q=${encodeURIComponent(q)}`
      );
      setDocs(json.documents ?? []);
    } catch {
      setError("Không thể tải danh sách tài liệu. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  async function upload(file: File) {
    setError(null);
    setUploading(true);
    setUploadProgress(5);
    try {
      const p = await apiJsonAuth<{ objectKey: string; presignedPutUrl: string }>(
        "/documents/presign",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            mime: file.type || "application/pdf",
            size: file.size,
          }),
        }
      );

      setUploadProgress(20);

      let putRes: Response;
      try {
        putRes = await fetch(p.presignedPutUrl, {
          method: "PUT",
          headers: { "content-type": file.type || "application/pdf" },
          body: file,
        });
      } catch {
        throw new Error("upload_network_failed");
      }

      if (!putRes.ok) {
        if (putRes.status === 413)
          throw new Error("File quá lớn vượt quá giới hạn cho phép (tối đa 200 MB).");
        throw new Error(`Lỗi server khi tải file (mã ${putRes.status}).`);
      }

      setUploadProgress(80);

      await apiJsonAuth("/documents/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          objectKey: p.objectKey,
          title: file.name.replace(/\.[^/.]+$/, ""),
          mime: file.type || "application/pdf",
          size: file.size,
        }),
      });

      setUploadProgress(100);
      showToast(`✓ Đã tải lên "${file.name.replace(/\.[^/.]+$/, "")}" thành công!`);
      await load();
    } catch (err: any) {
      const raw = err?.message ?? "unknown";
      setError(friendlyUploadError(raw));
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 600);
    }
  }

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
        setError("Chỉ hỗ trợ file PDF.");
        return;
      }
      await upload(file);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [auth]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  if (!auth) return null;

  const filtered = docs.filter(
    (d) =>
      !q.trim() ||
      d.title.toLowerCase().includes(q.toLowerCase()) ||
      (d.uploader_name ?? "").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <AppShell
      title="Tài liệu"
      subtitle={`${docs.length} tài liệu được chia sẻ`}
      search={
        <div className="relative">
          <input
            className="w-full rounded-xl border border-black/8 bg-white/90 px-4 py-2.5 pr-10 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-rose-300 focus:ring-4 focus:ring-rose-100 transition"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="Tìm tài liệu hoặc người upload..."
          />
          <button
            onClick={load}
            disabled={loading}
            className="absolute inset-y-0 right-2 grid place-items-center px-2 text-slate-400 hover:text-rose-500 transition"
          >
            <SearchIcon />
          </button>
        </div>
      }
      right={
        <label className="cursor-pointer">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
            disabled={uploading}
          />
          <div
            className={[
              "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-[0_6px_18px_-8px_rgba(225,29,72,0.6)] transition-all",
              uploading
                ? "bg-rose-400 cursor-not-allowed"
                : "bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 cursor-pointer hover:shadow-[0_8px_22px_-8px_rgba(225,29,72,0.75)]",
            ].join(" ")}
          >
            <UploadIcon />
            {uploading ? "Đang tải..." : "Upload PDF"}
          </div>
        </label>
      }
    >
      <div className="grid gap-4">
        {/* Upload progress bar */}
        {uploading && (
          <div className="overflow-hidden rounded-2xl border border-rose-100 bg-white shadow-sm animate-fadeIn">
            <div className="flex items-center gap-3 px-4 py-3">
              <SpinIcon />
              <span className="text-sm text-slate-700">Đang tải file lên...</span>
              <span className="ml-auto text-xs font-semibold text-rose-600">{uploadProgress}%</span>
            </div>
            <div className="h-1 bg-rose-50">
              <div
                className="h-full progress-bar rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 animate-fadeIn">
            <span className="shrink-0 text-emerald-500">✓</span>
            {toast}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 animate-fadeIn">
            <span className="mt-0.5 shrink-0">⚠</span>
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto shrink-0 text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        {/* Drag & Drop zone */}
        {!uploading && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={[
              "flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-all",
              dragOver
                ? "border-rose-400 bg-rose-50/60"
                : "border-slate-200 bg-white/50 hover:border-rose-300 hover:bg-rose-50/30",
            ].join(" ")}
          >
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-50 text-rose-500">
              <UploadBigIcon />
            </div>
            <div className="text-sm font-semibold text-slate-700">
              {dragOver ? "Thả file vào đây" : "Kéo thả file PDF hoặc click để chọn"}
            </div>
            <div className="text-xs text-slate-400">Hỗ trợ PDF · Tối đa 200 MB</div>
          </div>
        )}

        {/* Doc grid */}
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-black/5 bg-white animate-pulse">
                <div className="h-24 bg-slate-100" />
                <div className="p-4 space-y-2">
                  <div className="h-3 w-3/4 rounded bg-slate-200" />
                  <div className="h-2.5 w-1/2 rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((d) => (
              <DocCard key={d.id} doc={d} />
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-sm text-slate-500">
            {q ? "Không tìm thấy tài liệu nào phù hợp." : "Chưa có tài liệu nào. Hãy upload file PDF đầu tiên!"}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function DocCard({ doc }: { doc: Doc }) {
  const [downloading, setDownloading] = useState(false);
  const [dlError, setDlError] = useState<string | null>(null);

  const hue = hashToHue(doc.id);
  const banner = `linear-gradient(135deg, hsla(${hue},85%,52%,0.92), hsla(${(hue + 35) % 360},85%,55%,0.80))`;
  const initials = (doc.uploader_name ?? doc.uploader_email ?? "?").slice(0, 2).toUpperCase();

  async function handleDownload() {
    setDlError(null);
    setDownloading(true);
    try {
      const res = await fetch(`${API_BASE}/documents/${doc.id}/download`, {
        headers: getAccessToken() ? { authorization: `Bearer ${getAccessToken()}` } : {},
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error ?? "download_failed");
      window.open(j.presignedGetUrl, "_blank");
    } catch {
      setDlError("Không thể tải xuống. Vui lòng thử lại.");
    } finally {
      setDownloading(false);
    }
  }

  const statusLabel: Record<string, string> = {
    uploaded: "Đã upload",
    processing: "Đang xử lý",
    ready: "Sẵn sàng",
    error: "Lỗi",
  };
  const statusColor: Record<string, string> = {
    uploaded: "bg-sky-50 text-sky-700",
    processing: "bg-amber-50 text-amber-700",
    ready: "bg-emerald-50 text-emerald-700",
    error: "bg-red-50 text-red-600",
  };

  return (
    <div className="group overflow-hidden rounded-2xl border border-black/5 bg-white shadow-[0_4px_24px_-12px_rgba(2,6,23,0.18)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_36px_-16px_rgba(2,6,23,0.28)]">
      {/* Banner */}
      <div className="relative h-20 flex items-end p-3" style={{ background: banner }}>
        <div className="absolute inset-0 opacity-20 [background:radial-gradient(600px_120px_at_10%_10%,white,transparent)]" />
        <span
          className={[
            "relative rounded-lg px-2 py-0.5 text-[11px] font-semibold",
            statusColor[doc.status] ?? "bg-white/80 text-slate-700",
          ].join(" ")}
        >
          {statusLabel[doc.status] ?? doc.status}
        </span>
      </div>

      <div className="p-4">
        <div className="truncate text-sm font-semibold text-slate-900" title={doc.title}>
          {doc.title}
        </div>

        {/* Meta row */}
        <div className="mt-2 flex items-center gap-2">
          <div className="grid h-5 w-5 place-items-center rounded-full bg-rose-100 text-[9px] font-bold text-rose-700 shrink-0">
            {initials}
          </div>
          <span className="truncate text-xs text-slate-500 flex-1">
            {doc.uploader_name ?? doc.uploader_email ?? "Ẩn danh"}
          </span>
          <span className="shrink-0 text-xs text-slate-400">{fmtSize(doc.size)}</span>
        </div>

        <div className="mt-1 text-[11px] text-slate-400">{fmtDate(doc.created_at)}</div>

        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-1.5 rounded-xl border border-black/8 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white hover:border-rose-200 hover:text-rose-700 transition disabled:opacity-50"
          >
            <DownloadIcon />
            {downloading ? "Đang lấy link..." : "Tải xuống"}
          </button>
        </div>

        {dlError && <div className="mt-2 text-xs text-red-600">{dlError}</div>}
      </div>
    </div>
  );
}

function hashToHue(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="m16.5 16.5 4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function UploadIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="17 8 12 3 7 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function UploadBigIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="17 8 12 3 7 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function DownloadIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="7 10 12 15 17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function SpinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-rose-500" aria-hidden="true" style={{ animation: "spin 0.8s linear infinite" }}>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}
