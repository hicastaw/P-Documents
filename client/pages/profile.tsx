import { useEffect, useState } from "react";
import { AppShell } from "../components/shell/AppShell";
import { apiJsonAuth } from "../services/api";
import { useRequireAuth } from "../hooks/use-require-auth";
import { useAuth } from "../hooks/auth-context";

type Doc = {
  id: string;
  title: string;
  size: number;
  status: string;
  created_at: string;
};

function fmtSize(b: number) {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

type EditSection = null | "name" | "password";

export default function ProfilePage() {
  const auth = useRequireAuth();
  const { authState, login } = useAuth();
  const [myDocs, setMyDocs] = useState<Doc[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  // Edit state
  const [editSection, setEditSection] = useState<EditSection>(null);

  // Name form
  const [newName, setNewName] = useState("");
  const [nameLoading, setNameLoading] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSuccess, setNameSuccess] = useState(false);

  // Password form
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [passLoading, setPassLoading] = useState(false);
  const [passError, setPassError] = useState<string | null>(null);
  const [passSuccess, setPassSuccess] = useState(false);

  useEffect(() => {
    if (!auth) return;
    setLoadingDocs(true);
    apiJsonAuth<{ documents: Doc[] }>("/documents")
      .then((j) => setMyDocs(j.documents ?? []))
      .finally(() => setLoadingDocs(false));
  }, [!!auth]);

  if (!auth) return null;
  if (authState.status !== "authenticated") return null;

  const user = authState.user;
  const avatarText = (user.display_name || user.email).slice(0, 2).toUpperCase();

  const statusColor: Record<string, string> = {
    uploaded: "bg-sky-50 text-sky-700",
    processing: "bg-amber-50 text-amber-700",
    ready: "bg-emerald-50 text-emerald-700",
    error: "bg-red-50 text-red-600",
  };
  const statusLabel: Record<string, string> = {
    uploaded: "Đã upload",
    processing: "Xử lý",
    ready: "Sẵn sàng",
    error: "Lỗi",
  };

  const ERROR_MSG: Record<string, string> = {
    wrong_current_password: "Mật khẩu hiện tại không đúng.",
    current_password_required: "Vui lòng nhập mật khẩu hiện tại.",
    nothing_to_update: "Không có gì để cập nhật.",
    validation_error: "Dữ liệu không hợp lệ.",
  };

  async function saveName() {
    if (!newName.trim() || newName.trim().length < 2) {
      setNameError("Tên phải có ít nhất 2 ký tự.");
      return;
    }
    setNameError(null);
    setNameLoading(true);
    try {
      const res = await apiJsonAuth<{ user: { display_name: string } }>("/auth/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName: newName.trim() }),
      });
      // Refresh auth state by re-fetching /auth/me
      await apiJsonAuth("/auth/me");
      // Force page reload to refresh auth context
      (user as any).display_name = res.user.display_name;
      setNameSuccess(true);
      setEditSection(null);
      setTimeout(() => setNameSuccess(false), 3000);
      // Reload to update sidebar user block
      window.location.reload();
    } catch (err: any) {
      setNameError(ERROR_MSG[err?.message] ?? "Không thể cập nhật tên. Thử lại.");
    } finally {
      setNameLoading(false);
    }
  }

  async function savePassword() {
    if (!currentPass) { setPassError("Nhập mật khẩu hiện tại."); return; }
    if (newPass.length < 8) { setPassError("Mật khẩu mới phải ít nhất 8 ký tự."); return; }
    if (newPass !== confirmPass) { setPassError("Mật khẩu xác nhận không khớp."); return; }
    setPassError(null);
    setPassLoading(true);
    try {
      await apiJsonAuth("/auth/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPass, newPassword: newPass }),
      });
      setPassSuccess(true);
      setEditSection(null);
      setCurrentPass(""); setNewPass(""); setConfirmPass("");
      setTimeout(() => setPassSuccess(false), 4000);
    } catch (err: any) {
      setPassError(ERROR_MSG[err?.message] ?? "Không thể đổi mật khẩu. Thử lại.");
    } finally {
      setPassLoading(false);
    }
  }

  return (
    <AppShell title="Hồ sơ" subtitle="Thông tin & cài đặt tài khoản">
      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        {/* Left column */}
        <div className="grid gap-4">
          {/* Profile card */}
          <div className="rounded-2xl border border-black/5 bg-white/80 p-5 shadow-[0_4px_20px_-12px_rgba(2,6,23,0.15)] backdrop-blur">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="relative">
                <div className="grid h-20 w-20 place-items-center rounded-2xl bg-gradient-to-br from-rose-600 to-rose-500 text-2xl font-bold text-white shadow-[0_14px_30px_-10px_rgba(225,29,72,0.5)]">
                  {avatarText}
                </div>
                <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-emerald-500 text-[10px] text-white">✓</div>
              </div>
              <div>
                <div className="text-base font-bold text-slate-900">{user.display_name || "Người dùng"}</div>
                <div className="text-sm text-slate-500">{user.email}</div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 p-3 text-center">
                <div className="text-xl font-bold text-slate-900">{myDocs.length}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Tài liệu</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 text-center">
                <div className="text-xl font-bold text-slate-900">2026</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Thành viên từ</div>
              </div>
            </div>
          </div>

          {/* Success toasts */}
          {nameSuccess && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 animate-fadeIn">
              ✓ Đã cập nhật tên hiển thị.
            </div>
          )}
          {passSuccess && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 animate-fadeIn">
              ✓ Đã đổi mật khẩu thành công.
            </div>
          )}

          {/* Edit actions */}
          <div className="rounded-2xl border border-black/5 bg-white/80 p-5 shadow-[0_4px_20px_-12px_rgba(2,6,23,0.15)] backdrop-blur">
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
              Cài đặt tài khoản
            </div>

            {/* Separator */}
            {editSection === null && (
              <div className="grid gap-2">
                <button
                  onClick={() => { setEditSection("name"); setNewName(user.display_name || ""); setNameError(null); }}
                  className="flex items-center justify-between rounded-xl border border-black/5 bg-slate-50 px-4 py-3 text-left hover:border-rose-200 hover:bg-rose-50 transition group"
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-800">Tên hiển thị</div>
                    <div className="text-xs text-slate-500 mt-0.5">{user.display_name || "—"}</div>
                  </div>
                  <span className="text-xs font-semibold text-rose-600 group-hover:text-rose-500">Sửa →</span>
                </button>

                <button
                  onClick={() => { setEditSection("password"); setCurrentPass(""); setNewPass(""); setConfirmPass(""); setPassError(null); }}
                  className="flex items-center justify-between rounded-xl border border-black/5 bg-slate-50 px-4 py-3 text-left hover:border-rose-200 hover:bg-rose-50 transition group"
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-800">Mật khẩu</div>
                    <div className="text-xs text-slate-500 mt-0.5">••••••••</div>
                  </div>
                  <span className="text-xs font-semibold text-rose-600 group-hover:text-rose-500">Đổi →</span>
                </button>

                <div className="flex items-center justify-between rounded-xl border border-black/5 bg-slate-50 px-4 py-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">Email</div>
                    <div className="text-xs text-slate-500 mt-0.5">{user.email}</div>
                  </div>
                  <span className="text-xs text-slate-400">Không thể thay đổi</span>
                </div>
              </div>
            )}

            {/* Edit Name Form */}
            {editSection === "name" && (
              <div className="grid gap-3 animate-fadeIn">
                <div className="text-sm font-bold text-slate-800">Cập nhật tên hiển thị</div>
                <div className="grid gap-1.5">
                  <label className="text-xs font-semibold text-slate-600">Tên mới</label>
                  <input
                    className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-rose-300 focus:ring-4 focus:ring-rose-100 transition"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Tên hiển thị của bạn"
                    autoFocus
                  />
                </div>
                {nameError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{nameError}</div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={saveName}
                    disabled={nameLoading}
                    className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-semibold text-white hover:bg-rose-500 transition disabled:opacity-60"
                  >
                    {nameLoading ? "Đang lưu..." : "Lưu thay đổi"}
                  </button>
                  <button
                    onClick={() => setEditSection(null)}
                    className="rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            )}

            {/* Edit Password Form */}
            {editSection === "password" && (
              <div className="grid gap-3 animate-fadeIn">
                <div className="text-sm font-bold text-slate-800">Đổi mật khẩu</div>
                <div className="grid gap-1.5">
                  <label className="text-xs font-semibold text-slate-600">Mật khẩu hiện tại</label>
                  <input
                    type="password"
                    className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-rose-300 focus:ring-4 focus:ring-rose-100 transition"
                    value={currentPass}
                    onChange={(e) => setCurrentPass(e.target.value)}
                    placeholder="Nhập mật khẩu hiện tại"
                    autoFocus
                  />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-xs font-semibold text-slate-600">Mật khẩu mới</label>
                  <input
                    type="password"
                    className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-rose-300 focus:ring-4 focus:ring-rose-100 transition"
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    placeholder="Tối thiểu 8 ký tự"
                  />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-xs font-semibold text-slate-600">Xác nhận mật khẩu mới</label>
                  <input
                    type="password"
                    className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-rose-300 focus:ring-4 focus:ring-rose-100 transition"
                    value={confirmPass}
                    onChange={(e) => setConfirmPass(e.target.value)}
                    placeholder="Nhập lại mật khẩu mới"
                  />
                </div>
                {passError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{passError}</div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={savePassword}
                    disabled={passLoading}
                    className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-semibold text-white hover:bg-rose-500 transition disabled:opacity-60"
                  >
                    {passLoading ? "Đang lưu..." : "Đổi mật khẩu"}
                  </button>
                  <button
                    onClick={() => setEditSection(null)}
                    className="rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Account info */}
          <div className="rounded-2xl border border-black/5 bg-white/80 p-5 shadow-[0_4px_20px_-12px_rgba(2,6,23,0.15)] backdrop-blur">
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Chi tiết</div>
            <div className="grid gap-2">
              <InfoRow label="User ID" value={user.id} mono />
              <InfoRow label="Email" value={user.email} />
            </div>
          </div>
        </div>

        {/* Right column — Documents */}
        <div className="rounded-2xl border border-black/5 bg-white/80 p-5 shadow-[0_4px_20px_-12px_rgba(2,6,23,0.15)] backdrop-blur">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm font-bold text-slate-800">Tài liệu trong hệ thống</div>
            <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
              {myDocs.length} tài liệu
            </span>
          </div>

          {loadingDocs ? (
            <div className="grid gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : myDocs.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">
              Chưa có tài liệu nào. Upload PDF đầu tiên!
            </div>
          ) : (
            <div className="grid gap-2 max-h-[560px] overflow-y-auto pr-1">
              {myDocs.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center gap-3 rounded-xl border border-black/5 bg-slate-50 px-3 py-2.5 hover:bg-slate-100 transition"
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-base shadow-sm">📄</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-800">{d.title}</div>
                    <div className="text-[11px] text-slate-400">
                      {fmtSize(d.size)} · {new Date(d.created_at).toLocaleDateString("vi-VN")}
                    </div>
                  </div>
                  <span className={[
                    "shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-semibold",
                    statusColor[d.status] ?? "bg-slate-100 text-slate-500",
                  ].join(" ")}>
                    {statusLabel[d.status] ?? d.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className={["min-w-0 truncate text-right text-xs font-semibold text-slate-800", mono ? "font-mono" : ""].join(" ")}>
        {value}
      </div>
    </div>
  );
}
