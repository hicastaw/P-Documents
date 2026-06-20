import type { Doc } from "../../services/documentsApi";
import { CATEGORIES, fmtDate, fmtSize } from "./utils";
import { DownloadSmallIcon, ReportIcon, StarIconFilled } from "./icons";

export function DocDetailModal({
  doc,
  starred,
  starLoading,
  onClose,
  onToggleStar,
  onDownload,
  onReport,
}: {
  doc: Doc;
  starred: boolean;
  starLoading: boolean;
  onClose: () => void;
  onToggleStar: () => void;
  onDownload: () => void;
  onReport: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm animate-fadeIn">
      <div className="fixed inset-0" onClick={onClose} />
      <div className="relative w-full max-w-xl rounded-3xl bg-white shadow-2xl animate-scaleIn">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/5 px-6 py-4">
          <h3 className="text-base font-bold text-slate-800">Thông tin tài liệu</h3>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            ✕
          </button>
        </div>
        {/* Content */}
        <div className="px-6 py-6 space-y-5">
          <div>
            <div className="text-xl font-bold text-slate-900 leading-snug">{doc.title}</div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 font-medium">
              {doc.category_slug && (
                <span className="rounded-md bg-rose-50 px-2 py-0.5 text-rose-600 ring-1 ring-inset ring-rose-500/10">
                  {doc.category_name || CATEGORIES.find((c) => c.value === doc.category_slug)?.label || doc.category_slug}
                </span>
              )}
              <span>Đăng bởi: {doc.uploader_name ?? doc.uploader_email ?? "Ẩn danh"}</span>
              <span>Ngày: {fmtDate(doc.created_at)}</span>
              <span>Kích thước: {fmtSize(doc.size)}</span>
            </div>
          </div>

          {doc.description ? (
            <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
              <div className="text-sm font-semibold text-slate-700 mb-1">Mô tả chi tiết:</div>
              <div className="text-sm text-slate-600 whitespace-pre-wrap">{doc.description}</div>
            </div>
          ) : (
            <div className="text-sm text-slate-400 italic">Tài liệu này không có mô tả chi tiết.</div>
          )}

          <div className="flex items-center gap-6 pt-2">
            {/* Star block – clickable */}
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Đánh giá</span>
              <button
                disabled={starLoading || doc.status !== "approved"}
                onClick={(e) => { e.stopPropagation(); onToggleStar(); }}
                className={[
                  "mt-0.5 flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold transition-all active:scale-95 border-2",
                  starred
                    ? "bg-amber-400 text-white border-amber-400 shadow-md hover:bg-amber-500 hover:border-amber-500"
                    : "bg-white text-amber-500 border-amber-500/30 hover:bg-amber-50 hover:border-amber-500/50",
                  (starLoading || doc.status !== "approved") && "opacity-50 cursor-not-allowed",
                ].filter(Boolean).join(" ")}
              >
                <StarIconFilled filled={starred} />
                {starred ? "Đã Star" : "Star"} · {doc.stars}
              </button>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lượt tải</span>
              <div className="text-base font-bold text-slate-700 flex items-center gap-1.5 mt-0.5">
                <DownloadSmallIcon /> {doc.downloads} lượt
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Trạng thái</span>
              <div className="text-sm font-bold text-emerald-600 mt-1">
                {doc.status === "approved" ? "✓ Đã xử lý AI" : "... Đang xử lý"}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 border-t border-black/5 bg-slate-50 px-6 py-4 rounded-b-3xl">
          <button
            onClick={onReport}
            className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 shadow-sm hover:bg-red-100 transition"
            title="Báo cáo vi phạm"
          >
            <ReportIcon />
            <span>Báo cáo</span>
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-black/8 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
          >
            Đóng
          </button>
          <button
            onClick={onDownload}
            disabled={doc.status !== "approved"}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 px-4 py-2.5 text-sm font-semibold text-white shadow shadow-rose-200 hover:from-rose-500 hover:to-rose-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <DownloadSmallIcon /> Tải tài liệu ngay
          </button>
        </div>
      </div>
    </div>
  );
}
