import type { Doc } from "../../services/documentsApi";
import { CATEGORIES, fmtDate, fmtSize } from "./utils";
import { ModalPortal } from "../shell/ModalPortal";
import { X, CheckCircle2, Loader2, Star, Download, Flag } from "lucide-react";

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
    <ModalPortal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm animate-fadeIn">
        <div className="fixed inset-0" onClick={onClose} />
        <div className="relative w-full max-w-xl rounded-2xl bg-white shadow-2xl animate-scaleIn">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-black/5 px-6 py-4">
            <h3 className="text-base font-bold text-slate-800">Thông tin tài liệu</h3>
            <button
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            >
              <X size={16} strokeWidth={2} />
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

            {/* Stat row */}
            <div className="grid grid-cols-3 gap-3">
              <button
                disabled={starLoading || doc.status !== "approved"}
                onClick={(e) => { e.stopPropagation(); onToggleStar(); }}
                className={[
                  "flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition disabled:opacity-50 disabled:cursor-not-allowed",
                  starred ? "border-amber-200 bg-amber-50" : "border-black/5 bg-slate-50 hover:bg-slate-100",
                ].join(" ")}
              >
                <Star size={16} strokeWidth={1.8} className={starred ? "text-amber-500" : "text-slate-400"} fill={starred ? "currentColor" : "none"} />
                <div>
                  <div className="text-sm font-bold text-slate-800">{doc.stars}</div>
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{starred ? "Đã star" : "Star"}</div>
                </div>
              </button>

              <div className="flex flex-col items-start gap-1.5 rounded-xl border border-black/5 bg-slate-50 p-3">
                <Download size={16} strokeWidth={1.8} className="text-slate-400" />
                <div>
                  <div className="text-sm font-bold text-slate-800">{doc.downloads}</div>
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Lượt tải</div>
                </div>
              </div>

              <div className="flex flex-col items-start gap-1.5 rounded-xl border border-black/5 bg-slate-50 p-3">
                {doc.status === "approved" ? (
                  <CheckCircle2 size={16} strokeWidth={1.8} className="text-emerald-500" />
                ) : (
                  <Loader2 size={16} strokeWidth={1.8} className="animate-spin text-amber-500" />
                )}
                <div>
                  <div className={["text-sm font-bold", doc.status === "approved" ? "text-emerald-600" : "text-amber-600"].join(" ")}>
                    {doc.status === "approved" ? "Đã xử lý" : "Đang xử lý"}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Trạng thái AI</div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-3 border-t border-black/5 bg-slate-50 px-6 py-4 rounded-b-2xl">
            <button
              onClick={onReport}
              className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100 transition"
              title="Báo cáo vi phạm"
            >
              <Flag size={14} strokeWidth={2} />
              <span>Báo cáo</span>
            </button>
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-black/8 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Đóng
            </button>
            <button
              onClick={onDownload}
              disabled={doc.status !== "approved"}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_-6px_rgba(225,29,72,0.6)] hover:from-rose-500 hover:to-rose-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={14} strokeWidth={2} /> Tải tài liệu ngay
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
