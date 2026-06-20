export const CATEGORIES = [
  { value: "", label: "Không phân loại" },
  { value: "giao_trinh", label: "Giáo trình" },
  { value: "bai_tap", label: "Bài tập" },
  { value: "de_thi", label: "Đề thi" },
  { value: "tai_lieu_tham_khao", label: "Tài liệu tham khảo" },
  { value: "bao_cao", label: "Báo cáo" },
  { value: "khac", label: "Khác" },
];

export function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function fmtDate(s: string) {
  const d = new Date(s);
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function hashToHue(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
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
