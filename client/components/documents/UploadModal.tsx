import { CATEGORIES, fmtSize } from "./utils";
import { UploadIcon } from "./icons";

export function UploadModal({
  file,
  title,
  category,
  description,
  onTitleChange,
  onCategoryChange,
  onDescriptionChange,
  onSubmit,
  onClose,
}: {
  file: File;
  title: string;
  category: string;
  description: string;
  onTitleChange: (v: string) => void;
  onCategoryChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-black/5 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-600 to-rose-500 px-6 py-4">
          <h3 className="text-lg font-bold text-white">📄 Thông tin tài liệu</h3>
          <p className="text-xs text-rose-100 mt-0.5">{file.name} · {fmtSize(file.size)}</p>
        </div>

        <div className="p-6 grid gap-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Tiêu đề *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-rose-300 focus:ring-4 focus:ring-rose-100 transition"
              placeholder="Nhập tiêu đề tài liệu..."
              autoFocus
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Danh mục</label>
            <select
              value={category}
              onChange={(e) => onCategoryChange(e.target.value)}
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
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none resize-none focus:border-rose-300 focus:ring-4 focus:ring-rose-100 transition"
              placeholder="Mô tả ngắn về tài liệu (tùy chọn)..."
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-black/8 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition"
            >
              Hủy
            </button>
            <button
              onClick={onSubmit}
              disabled={!title.trim()}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_-6px_rgba(225,29,72,0.6)] hover:from-rose-500 hover:to-rose-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <UploadIcon /> Tải lên
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
