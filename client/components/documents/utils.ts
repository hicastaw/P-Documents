export const CATEGORIES = [
  { value: "", label: "Không phân loại" },
  { value: "giao_trinh", label: "Giáo trình" },
  { value: "bai_tap", label: "Bài tập" },
  { value: "de_thi", label: "Đề thi" },
  { value: "tai_lieu_tham_khao", label: "Tài liệu tham khảo" },
  { value: "bao_cao", label: "Báo cáo" },
  { value: "khac", label: "Khác" },
];

const CATEGORY_COLORS: Record<string, { chip: string; icon: string; banner: string; badge: string; ring: string }> = {
  giao_trinh: { chip: "bg-indigo-50", icon: "text-indigo-500", banner: "from-indigo-50/70", badge: "bg-indigo-50 text-indigo-600", ring: "ring-indigo-500/10" },
  bai_tap: { chip: "bg-sky-50", icon: "text-sky-500", banner: "from-sky-50/70", badge: "bg-sky-50 text-sky-600", ring: "ring-sky-500/10" },
  de_thi: { chip: "bg-rose-50", icon: "text-rose-500", banner: "from-rose-50/70", badge: "bg-rose-50 text-rose-600", ring: "ring-rose-500/10" },
  tai_lieu_tham_khao: { chip: "bg-violet-50", icon: "text-violet-500", banner: "from-violet-50/70", badge: "bg-violet-50 text-violet-600", ring: "ring-violet-500/10" },
  bao_cao: { chip: "bg-amber-50", icon: "text-amber-500", banner: "from-amber-50/70", badge: "bg-amber-50 text-amber-600", ring: "ring-amber-500/10" },
  khac: { chip: "bg-slate-100", icon: "text-slate-500", banner: "from-slate-100/70", badge: "bg-slate-100 text-slate-600", ring: "ring-slate-500/10" },
};
const DEFAULT_CATEGORY_COLOR = { chip: "bg-slate-100", icon: "text-slate-400", banner: "from-slate-50", badge: "bg-slate-100 text-slate-500", ring: "ring-slate-500/10" };

export function getCategoryColor(slug?: string | null) {
  return (slug && CATEGORY_COLORS[slug]) || DEFAULT_CATEGORY_COLOR;
}

export function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function fmtDate(s: string) {
  const d = new Date(s);
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const UPLOAD_ERROR_MSG: Record<string, string> = {
  upload_network_failed: "Mất kết nối khi tải file. Vui lòng thử lại.",
  presign_failed: "Không thể khởi tạo phiên upload. Kiểm tra kết nối.",
  complete_failed: "File đã tải nhưng không thể xác nhận. Vui lòng liên hệ hỗ trợ.",
  unauthorized: "Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.",
};

export function friendlyUploadError(msg: string): string {
  if (UPLOAD_ERROR_MSG[msg]) return UPLOAD_ERROR_MSG[msg];
  if (msg.includes("413") || msg.includes("too large") || msg.includes("entity too large"))
    return "File quá lớn vượt quá giới hạn cho phép.";
  if (msg.includes("network") || msg.includes("fetch"))
    return "Lỗi kết nối mạng khi tải file.";
  if (msg.includes("timeout")) return "Upload timeout — file quá lớn hoặc kết nối chậm.";
  return "Tải file thất bại. Vui lòng thử lại.";
}
