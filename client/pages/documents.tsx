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
  category_id: string | null;
  category_slug: string | null;
  category_name: string | null;
  stars: number;
  downloads: number;
  is_starred: boolean;
};

const CATEGORIES = [
  { value: "", label: "Không phân loại" },
  { value: "giao_trinh", label: "Giáo trình" },
  { value: "bai_tap", label: "Bài tập" },
  { value: "de_thi", label: "Đề thi" },
  { value: "tai_lieu_tham_khao", label: "Tài liệu tham khảo" },
  { value: "bao_cao", label: "Báo cáo" },
  { value: "khac", label: "Khác" },
];

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
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<any>(null);

  // Filter state
  const [filterCategory, setFilterCategory] = useState("");

  // Detail Modal state
  const [activeDoc, setActiveDoc] = useState<Doc | null>(null);
  // Track which docs the current user has starred (populated from API response)
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [starLoading, setStarLoading] = useState(false);

  // Report Modal state
  const [reportDoc, setReportDoc] = useState<Doc | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportLoading, setReportLoading] = useState(false);

  // Upload form state
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formDescription, setFormDescription] = useState("");

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
      // Initialize starred IDs
      const starred = new Set<string>();
      (json.documents ?? []).forEach(d => {
        if (d.is_starred) starred.add(d.id);
      });
      setStarredIds(starred);
    } catch {
      setError("Không thể tải danh sách tài liệu. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  async function uploadWithMeta(file: File, title: string, category: string, description: string) {
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
          throw new Error("File quá lớn vượt quá giới hạn cho phép (tối đa 500 MB).");
        throw new Error(`Lỗi server khi tải file (mã ${putRes.status}).`);
      }

      setUploadProgress(80);

      await apiJsonAuth("/documents/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          objectKey: p.objectKey,
          title: title || file.name.replace(/\.[^/.]+$/, ""),
          description: description || undefined,
          category: category || undefined,
          mime: file.type || "application/pdf",
          size: file.size,
        }),
      });

      setUploadProgress(100);
      showToast(`✓ Đã tải lên "${title || file.name}" thành công!`);
      await load();
    } catch (err: any) {
      const raw = err?.message ?? "unknown";
      setError(friendlyUploadError(raw));
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 600);
    }
  }

  function openUploadForm(file: File) {
    setPendingFile(file);
    setFormTitle(file.name.replace(/\.[^/.]+$/, ""));
    setFormCategory("");
    setFormDescription("");
    setShowUploadForm(true);
  }

  function closeUploadForm() {
    setShowUploadForm(false);
    setPendingFile(null);
  }

  async function handleFormSubmit() {
    if (!pendingFile) return;
    closeUploadForm();
    await uploadWithMeta(pendingFile, formTitle, formCategory, formDescription);
  }

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
        setError("Chỉ hỗ trợ file PDF.");
        return;
      }
      openUploadForm(file);
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
      (!filterCategory || d.category_slug === filterCategory) &&
      (!q.trim() ||
        d.title.toLowerCase().includes(q.toLowerCase()) ||
        (d.uploader_name ?? "").toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <AppShell
      title="Tài liệu"
      subtitle={`${docs.length} tài liệu được chia sẻ`}
      search={
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
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
          <select
            className="rounded-xl border border-black/8 bg-white/90 px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none focus:border-rose-300 focus:ring-4 focus:ring-rose-100 transition sm:max-w-xs"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="">Tất cả danh mục</option>
            {CATEGORIES.filter(c => c.value !== "").map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
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
          <div className="fixed bottom-8 right-8 z-[9999] flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-800 shadow-[0_8px_30px_rgb(0,0,0,0.12)] animate-fadeIn">
            <span className="shrink-0 text-emerald-600">✨</span>
            {toast.replace(/^✓\s*/, '')}
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
            <div className="text-xs text-slate-400">Hỗ trợ PDF · Tối đa 500 MB</div>
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
              <DocCard key={d.id} doc={d} onOpen={() => setActiveDoc(d)} />
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-sm text-slate-500">
            {q ? "Không tìm thấy tài liệu nào phù hợp." : "Chưa có tài liệu nào. Hãy upload file PDF đầu tiên!"}
          </div>
        )}
      </div>

      {/* Upload Form Modal */}
      {showUploadForm && pendingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-black/5 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-rose-600 to-rose-500 px-6 py-4">
              <h3 className="text-lg font-bold text-white">📄 Thông tin tài liệu</h3>
              <p className="text-xs text-rose-100 mt-0.5">{pendingFile.name} · {fmtSize(pendingFile.size)}</p>
            </div>

            <div className="p-6 grid gap-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Tiêu đề *</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-rose-300 focus:ring-4 focus:ring-rose-100 transition"
                  placeholder="Nhập tiêu đề tài liệu..."
                  autoFocus
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Danh mục</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-rose-300 focus:ring-4 focus:ring-rose-100 transition"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Mô tả</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none resize-none focus:border-rose-300 focus:ring-4 focus:ring-rose-100 transition"
                  placeholder="Mô tả ngắn về tài liệu (tùy chọn)..."
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={closeUploadForm}
                  className="flex-1 rounded-xl border border-black/8 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition"
                >
                  Hủy
                </button>
                <button
                  onClick={handleFormSubmit}
                  disabled={!formTitle.trim()}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_-6px_rgba(225,29,72,0.6)] hover:from-rose-500 hover:to-rose-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <UploadIcon /> Tải lên
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Document Details Modal ── */}
      {activeDoc && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm animate-fadeIn">
          <div
            className="fixed inset-0"
            onClick={() => setActiveDoc(null)}
          />
          <div className="relative w-full max-w-xl rounded-3xl bg-white shadow-2xl animate-scaleIn">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-black/5 px-6 py-4">
              <h3 className="text-base font-bold text-slate-800">Thông tin tài liệu</h3>
              <button
                onClick={() => setActiveDoc(null)}
                className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                ✕
              </button>
            </div>
            {/* Content */}
            <div className="px-6 py-6 space-y-5">
              <div>
                <div className="text-xl font-bold text-slate-900 leading-snug">{activeDoc.title}</div>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 font-medium">
                  {activeDoc.category_slug && (
                    <span className="rounded-md bg-rose-50 px-2 py-0.5 text-rose-600 ring-1 ring-inset ring-rose-500/10">
                      {activeDoc.category_name || CATEGORIES.find(c => c.value === activeDoc.category_slug)?.label || activeDoc.category_slug}
                    </span>
                  )}
                  <span>Đăng bởi: {activeDoc.uploader_name ?? activeDoc.uploader_email ?? "Ẩn danh"}</span>
                  <span>Ngày: {fmtDate(activeDoc.created_at)}</span>
                  <span>Kích thước: {fmtSize(activeDoc.size)}</span>
                </div>
              </div>

              {activeDoc.description ? (
                <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                  <div className="text-sm font-semibold text-slate-700 mb-1">Mô tả chi tiết:</div>
                  <div className="text-sm text-slate-600 whitespace-pre-wrap">{activeDoc.description}</div>
                </div>
              ) : (
                <div className="text-sm text-slate-400 italic">Tài liệu này không có mô tả chi tiết.</div>
              )}

              <div className="flex items-center gap-6 pt-2">
                {/* Star block – clickable */}
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Đánh giá</span>
                  <button
                    disabled={starLoading || activeDoc.status !== 'approved'}
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!activeDoc) return;
                      setStarLoading(true);
                      console.log("Starring document:", activeDoc.id);
                      try {
                        const res = await fetch(`${API_BASE}/documents/${activeDoc.id}/star`, {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                            ...(getAccessToken() ? { authorization: `Bearer ${getAccessToken()}` } : {})
                          },
                        });
                        const j = await res.json();
                        if (!res.ok) throw new Error(j.error || "star_failed");
                        
                        setStarredIds(prev => {
                          const next = new Set(prev);
                          if (j.starred) next.add(activeDoc.id); else next.delete(activeDoc.id);
                          return next;
                        });
                        setActiveDoc(prev => prev ? { ...prev, stars: j.stars } : prev);
                        setDocs(prev => prev.map(d => d.id === activeDoc.id ? { ...d, stars: j.stars } : d));
                        console.log("Star toggle success:", j);
                      } catch (err) {
                        console.error("Star toggle failed:", err);
                        alert("Không thể đánh giá tài liệu lúc này.");
                      } finally {
                        setStarLoading(false);
                      }
                    }}
                    className={[
                      "mt-0.5 flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold transition-all active:scale-95 border-2",
                      starredIds.has(activeDoc.id)
                        ? "bg-amber-400 text-white border-amber-400 shadow-md hover:bg-amber-500 hover:border-amber-500"
                        : "bg-white text-amber-500 border-amber-500/30 hover:bg-amber-50 hover:border-amber-500/50",
                      (starLoading || activeDoc.status !== 'approved') && "opacity-50 cursor-not-allowed",
                    ].filter(Boolean).join(" ")}
                  >
                    <StarIconFilled filled={starredIds.has(activeDoc.id)} />
                    {starredIds.has(activeDoc.id) ? "Đã Star" : "Star"} · {activeDoc.stars}
                  </button>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lượt tải</span>
                  <div className="text-base font-bold text-slate-700 flex items-center gap-1.5 mt-0.5">
                    <DownloadSmallIcon /> {activeDoc.downloads} lượt
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Trạng thái</span>
                  <div className="text-sm font-bold text-emerald-600 mt-1">
                     {activeDoc.status === 'approved' ? '✓ Đã xử lý AI' : '... Đang xử lý'}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center gap-3 border-t border-black/5 bg-slate-50 px-6 py-4 rounded-b-3xl">
              <button
                onClick={() => { setReportDoc(activeDoc); setReportReason(""); }}
                className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 shadow-sm hover:bg-red-100 transition"
                title="Báo cáo vi phạm"
              >
                <ReportIcon />
                <span>Báo cáo</span>
              </button>
              <button
                onClick={() => setActiveDoc(null)}
                className="flex-1 rounded-xl border border-black/8 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
              >
                Đóng
              </button>
              <button
                onClick={async () => {
                  try {
                    const res = await fetch(`${API_BASE}/documents/${activeDoc.id}/download`, {
                      headers: getAccessToken() ? { authorization: `Bearer ${getAccessToken()}` } : {},
                    });
                    const j = await res.json();
                    if (!res.ok) throw new Error();
                    window.open(j.presignedGetUrl, "_blank");
                  } catch {
                    alert("Không thể tải xuống.");
                  }
                }}
                disabled={activeDoc.status !== 'approved'}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 px-4 py-2.5 text-sm font-semibold text-white shadow shadow-rose-200 hover:from-rose-500 hover:to-rose-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <DownloadSmallIcon /> Tải tài liệu ngay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Report Modal ── */}
      {reportDoc && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-black/5 overflow-hidden animate-scaleIn">
            <div className="px-6 py-4 border-b border-black/5 flex items-center justify-between">
              <h3 className="font-bold text-red-600 flex items-center gap-2">
                <ReportIcon /> Báo cáo tài liệu
              </h3>
              <button onClick={() => setReportDoc(null)} className="text-slate-400 hover:text-slate-600 transition">✕</button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-600 mb-3">Bạn đang báo cáo: <strong className="text-slate-800">{reportDoc.title}</strong></p>
              <textarea
                value={reportReason}
                onChange={e => setReportReason(e.target.value)}
                placeholder="Nhập lý do báo cáo (ví dụ: spam, sai danh mục, nội dung xấu...)"
                rows={4}
                className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-red-300 focus:ring-4 focus:ring-red-100 transition resize-none"
                autoFocus
              />
              <div className="mt-4 flex gap-3">
                <button onClick={() => setReportDoc(null)} className="flex-1 rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition">Hủy</button>
                <button
                  disabled={reportLoading || reportReason.trim().length < 5}
                  onClick={async () => {
                    setReportLoading(true);
                    try {
                      const res = await fetch(`${API_BASE}/documents/${reportDoc.id}/report`, {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          ...(getAccessToken() ? { authorization: `Bearer ${getAccessToken()}` } : {})
                        },
                        body: JSON.stringify({ reason: reportReason.trim() })
                      });
                      if (!res.ok) throw new Error();
                      showToast("Đã gửi báo cáo thành công.");
                      setReportDoc(null);
                    } catch {
                      alert("Không thể gửi báo cáo lúc này.");
                    } finally {
                      setReportLoading(false);
                    }
                  }}
                  className="flex-1 flex justify-center items-center rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {reportLoading ? "Đang gửi..." : "Gửi báo cáo"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function DocCard({ doc, onOpen }: { doc: Doc; onOpen?: () => void }) {
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
    approved: "Sẵn sàng",
    error: "Lỗi",
  };
  const statusColor: Record<string, string> = {
    uploaded: "bg-sky-50 text-sky-700",
    processing: "bg-amber-50 text-amber-700",
    approved: "bg-emerald-50 text-emerald-700",
    error: "bg-red-50 text-red-600",
  };

  return (
    <div 
      onClick={() => onOpen && onOpen()}
      className="group overflow-hidden rounded-2xl border border-black/5 bg-white shadow-[0_4px_24px_-12px_rgba(2,6,23,0.18)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_36px_-16px_rgba(2,6,23,0.28)] cursor-pointer"
    >
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
        <div className="flex items-start justify-between gap-3">
          <div className="truncate text-sm font-semibold text-slate-900" title={doc.title}>
            {doc.title}
          </div>
          {doc.category_slug && (
            <span className="shrink-0 inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-600 ring-1 ring-inset ring-rose-500/10">
              {doc.category_name || CATEGORIES.find(c => c.value === doc.category_slug)?.label || doc.category_slug}
            </span>
          )}
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

        <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
          <span>{fmtDate(doc.created_at)}</span>
          <div className="flex gap-2.5 font-medium">
            <span className="flex items-center gap-1 text-amber-500/80"><StarIcon /> {doc.stars}</span>
            <span className="flex items-center gap-1"><DownloadSmallIcon /> {doc.downloads}</span>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); handleDownload(); }}
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

function StarIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
       <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function DownloadSmallIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
       <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
       <polyline points="7 10 12 15 17 10" />
       <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function StarIconFilled({ filled }: { filled: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? "white" : "none"} stroke={filled ? "white" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function ReportIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
      <line x1="4" y1="22" x2="4" y2="15"></line>
    </svg>
  );
}

