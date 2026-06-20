import { useState } from "react";
import type { Doc } from "../../services/documentsApi";
import { getDownloadUrl } from "../../services/documentsApi";
import { CATEGORIES, fmtDate, fmtSize, hashToHue } from "./utils";
import { DownloadIcon, DownloadSmallIcon, StarIcon } from "./icons";

const STATUS_LABEL: Record<string, string> = {
  uploaded: "Đã upload",
  processing: "Đang xử lý",
  approved: "Sẵn sàng",
  error: "Lỗi",
};
const STATUS_COLOR: Record<string, string> = {
  uploaded: "bg-sky-50 text-sky-700",
  processing: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  error: "bg-red-50 text-red-600",
};

export function DocCard({ doc, onOpen }: { doc: Doc; onOpen?: () => void }) {
  const [downloading, setDownloading] = useState(false);
  const [dlError, setDlError] = useState<string | null>(null);

  const hue = hashToHue(doc.id);
  const banner = `linear-gradient(135deg, hsla(${hue},85%,52%,0.92), hsla(${(hue + 35) % 360},85%,55%,0.80))`;
  const initials = (doc.uploader_name ?? doc.uploader_email ?? "?").slice(0, 2).toUpperCase();

  async function handleDownload() {
    setDlError(null);
    setDownloading(true);
    try {
      const j = await getDownloadUrl(doc.id);
      window.open(j.presignedGetUrl, "_blank");
    } catch {
      setDlError("Không thể tải xuống. Vui lòng thử lại.");
    } finally {
      setDownloading(false);
    }
  }

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
            STATUS_COLOR[doc.status] ?? "bg-white/80 text-slate-700",
          ].join(" ")}
        >
          {STATUS_LABEL[doc.status] ?? doc.status}
        </span>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="truncate text-sm font-semibold text-slate-900" title={doc.title}>
            {doc.title}
          </div>
          {doc.category_slug && (
            <span className="shrink-0 inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-600 ring-1 ring-inset ring-rose-500/10">
              {doc.category_name || CATEGORIES.find((c) => c.value === doc.category_slug)?.label || doc.category_slug}
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
