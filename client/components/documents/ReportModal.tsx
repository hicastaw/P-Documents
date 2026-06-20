import type { Doc } from "../../services/documentsApi";
import { ReportIcon } from "./icons";

export function ReportModal({
  doc,
  reason,
  loading,
  onReasonChange,
  onClose,
  onSubmit,
}: {
  doc: Doc;
  reason: string;
  loading: boolean;
  onReasonChange: (v: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-black/5 overflow-hidden animate-scaleIn">
        <div className="px-6 py-4 border-b border-black/5 flex items-center justify-between">
          <h3 className="font-bold text-red-600 flex items-center gap-2">
            <ReportIcon /> Báo cáo tài liệu
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">✕</button>
        </div>
        <div className="p-6">
          <p className="text-sm text-slate-600 mb-3">Bạn đang báo cáo: <strong className="text-slate-800">{doc.title}</strong></p>
          <textarea
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder="Nhập lý do báo cáo (ví dụ: spam, sai danh mục, nội dung xấu...)"
            rows={4}
            className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-red-300 focus:ring-4 focus:ring-red-100 transition resize-none"
            autoFocus
          />
          <div className="mt-4 flex gap-3">
            <button onClick={onClose} className="flex-1 rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition">Hủy</button>
            <button
              disabled={loading || reason.trim().length < 5}
              onClick={onSubmit}
              className="flex-1 flex justify-center items-center rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Đang gửi..." : "Gửi báo cáo"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
