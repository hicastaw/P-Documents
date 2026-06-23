import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { AppShell } from "../components/shell/AppShell";
import { useRequireAuth } from "../hooks/use-require-auth";
import {
  completeUpload,
  getDownloadUrl,
  presignUpload,
  reportDocument,
  searchDocuments,
  toggleStar as toggleStarApi,
  uploadFileToStorage,
  type Doc,
} from "../services/documentsApi";
import { CATEGORIES, friendlyUploadError } from "../components/documents/utils";
import { DocCard } from "../components/documents/DocCard";
import { UploadModal } from "../components/documents/UploadModal";
import { DocDetailModal } from "../components/documents/DocDetailModal";
import { ReportModal } from "../components/documents/ReportModal";
import { SearchIcon, SpinIcon, UploadBigIcon, UploadIcon } from "../components/documents/icons";
import { CheckCircle2, AlertCircle, X, FileText, Star, Download } from "lucide-react";

export default function DocumentsPage() {
  const auth = useRequireAuth();
  const router = useRouter();
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
    if (auth.role === "admin") {
      router.replace("/admin");
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!auth, auth?.role, router]);

  function showToast(msg: string) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const json = await searchDocuments(q);
      setDocs(json.documents ?? []);
      // Initialize starred IDs
      const starred = new Set<string>();
      (json.documents ?? []).forEach((d) => {
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
      const p = await presignUpload(file);
      setUploadProgress(20);

      let putRes: Response;
      try {
        putRes = await uploadFileToStorage(p.presignedPutUrl, file);
      } catch {
        throw new Error("upload_network_failed");
      }

      if (!putRes.ok) {
        if (putRes.status === 413)
          throw new Error("File quá lớn vượt quá giới hạn cho phép (tối đa 500 MB).");
        throw new Error(`Lỗi server khi tải file (mã ${putRes.status}).`);
      }

      setUploadProgress(80);

      await completeUpload({
        objectKey: p.objectKey,
        title: title || file.name.replace(/\.[^/.]+$/, ""),
        description: description || undefined,
        category: category || undefined,
        mime: file.type || "application/pdf",
        size: file.size,
      });

      setUploadProgress(100);
      showToast(`Đã tải lên "${title || file.name}" thành công!`);
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

  async function handleToggleStar() {
    if (!activeDoc) return;
    setStarLoading(true);
    try {
      const j = await toggleStarApi(activeDoc.id);
      setStarredIds((prev) => {
        const next = new Set(prev);
        if (j.starred) next.add(activeDoc.id); else next.delete(activeDoc.id);
        return next;
      });
      setActiveDoc((prev) => (prev ? { ...prev, stars: j.stars } : prev));
      setDocs((prev) => prev.map((d) => (d.id === activeDoc.id ? { ...d, stars: j.stars } : d)));
    } catch {
      alert("Không thể đánh giá tài liệu lúc này.");
    } finally {
      setStarLoading(false);
    }
  }

  async function handleDownloadFromModal() {
    if (!activeDoc) return;
    try {
      const j = await getDownloadUrl(activeDoc.id);
      window.open(j.presignedGetUrl, "_blank");
    } catch {
      alert("Không thể tải xuống.");
    }
  }

  async function handleSubmitReport() {
    if (!reportDoc) return;
    setReportLoading(true);
    try {
      await reportDocument(reportDoc.id, reportReason.trim());
      showToast("Đã gửi báo cáo thành công.");
      setReportDoc(null);
    } catch {
      alert("Không thể gửi báo cáo lúc này.");
    } finally {
      setReportLoading(false);
    }
  }

  if (!auth) return null;

  // Lọc theo q đã được server xử lý (RRF hybrid: vector + full-text, không phân biệt
  // dấu tiếng Việt) trong load() — không lọc lại bằng .includes() ở đây, vì điều đó sẽ
  // loại bỏ chính những kết quả mà tìm kiếm ngữ nghĩa/không dấu vừa tìm ra đúng.
  const filtered = docs.filter((d) => !filterCategory || d.category_slug === filterCategory);
  const totalStars = docs.reduce((s, d) => s + (d.stars || 0), 0);
  const totalDownloads = docs.reduce((s, d) => s + (d.downloads || 0), 0);

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
            {CATEGORIES.filter((c) => c.value !== "").map((c) => (
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
        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Tài liệu", value: docs.length, Icon: FileText, chip: "bg-rose-50 text-rose-600" },
            { label: "Lượt star", value: totalStars, Icon: Star, chip: "bg-amber-50 text-amber-600" },
            { label: "Lượt tải", value: totalDownloads, Icon: Download, chip: "bg-sky-50 text-sky-600" },
          ].map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white/80 p-4 shadow-sm"
            >
              <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${s.chip}`}>
                <s.Icon size={18} strokeWidth={1.8} />
              </div>
              <div>
                <div className="text-lg font-bold text-slate-900">{s.value}</div>
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

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
          <div className="fixed bottom-8 right-8 z-[9999] flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-800 shadow-popover animate-fadeIn">
            <CheckCircle2 size={18} strokeWidth={2} className="shrink-0 text-emerald-600" />
            {toast}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 animate-fadeIn">
            <AlertCircle size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto shrink-0 text-red-400 hover:text-red-600">
              <X size={14} strokeWidth={2} />
            </button>
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
              "flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-all bg-gradient-to-b",
              dragOver
                ? "border-rose-400 from-rose-50 to-rose-50/40"
                : "border-rose-200/70 from-rose-50/50 to-white hover:border-rose-300 hover:from-rose-50",
            ].join(" ")}
          >
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-rose-600 to-rose-500 text-white shadow-[0_8px_18px_-8px_rgba(225,29,72,0.5)]">
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
        <UploadModal
          file={pendingFile}
          title={formTitle}
          category={formCategory}
          description={formDescription}
          onTitleChange={setFormTitle}
          onCategoryChange={setFormCategory}
          onDescriptionChange={setFormDescription}
          onSubmit={handleFormSubmit}
          onClose={closeUploadForm}
        />
      )}

      {/* Document Details Modal */}
      {activeDoc && (
        <DocDetailModal
          doc={activeDoc}
          starred={starredIds.has(activeDoc.id)}
          starLoading={starLoading}
          onClose={() => setActiveDoc(null)}
          onToggleStar={handleToggleStar}
          onDownload={handleDownloadFromModal}
          onReport={() => { setReportDoc(activeDoc); setReportReason(""); }}
        />
      )}

      {/* Report Modal */}
      {reportDoc && (
        <ReportModal
          doc={reportDoc}
          reason={reportReason}
          loading={reportLoading}
          onReasonChange={setReportReason}
          onClose={() => setReportDoc(null)}
          onSubmit={handleSubmitReport}
        />
      )}
    </AppShell>
  );
}
