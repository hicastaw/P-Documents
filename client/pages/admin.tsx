import { useEffect, useState } from "react";
import { AppShell } from "../components/shell/AppShell";
import { API_BASE, apiJsonAuth } from "../services/api";
import { useRequireAuth } from "../hooks/use-require-auth";
import { useRouter } from "next/router";

type Stats = { users: number; documents: number; reports: number };
type Report = {
  id: string;
  reason: string;
  created_at: string;
  reporter_email: string;
  document_id: string;
  document_title: string;
  document_status: string;
};
type User = {
  id: string;
  email: string;
  display_name: string;
  role: string;
  created_at: string;
};

export default function AdminDashboard() {
  const auth = useRequireAuth();
  const router = useRouter();
  const [tab, setTab] = useState<"stats" | "reports" | "users">("stats");
  const [loading, setLoading] = useState(false);

  const [stats, setStats] = useState<Stats | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    if (!auth) return;
    if (auth.role !== "admin") {
      router.replace("/");
      return;
    }
    loadData(tab);
  }, [auth?.id, tab, router]);

  async function loadData(currentTab: string) {
    setLoading(true);
    try {
      if (currentTab === "stats") {
        const data = await apiJsonAuth<Stats>("/admin/stats");
        setStats(data);
      } else if (currentTab === "reports") {
        const data = await apiJsonAuth<{ reports: Report[] }>("/admin/reports");
        setReports(data.reports);
      } else if (currentTab === "users") {
        const data = await apiJsonAuth<{ users: User[] }>("/admin/users");
        setUsers(data.users);
      }
    } catch (err) {
      console.error(err);
      alert("Lỗi tải dữ liệu. Bạn có quyền admin không?");
    } finally {
      setLoading(false);
    }
  }

  async function handleDismissReport(id: string) {
    if (!confirm("Bỏ qua báo cáo này?")) return;
    try {
      await apiJsonAuth(`/admin/reports/${id}/dismiss`, { method: "POST" });
      setReports((prev) => prev.filter((r) => r.id !== id));
      setStats((prev) => prev ? { ...prev, reports: Math.max(0, prev.reports - 1) } : null);
    } catch {
      alert("Lỗi khi bỏ qua báo cáo");
    }
  }

  async function handleDeleteDocument(docId: string, reportId: string) {
    if (!confirm("Xóa tài liệu này vĩnh viễn?")) return;
    try {
      await apiJsonAuth(`/admin/documents/${docId}`, { method: "DELETE" });
      setReports((prev) => prev.filter((r) => r.id !== reportId));
      setStats((prev) => prev ? { ...prev, reports: Math.max(0, prev.reports - 1), documents: Math.max(0, prev.documents - 1) } : null);
      alert("Đã xóa tài liệu");
    } catch {
      alert("Lỗi khi xóa tài liệu");
    }
  }

  async function handleDeleteUser(id: string) {
    if (!confirm("Xóa tài khoản này vĩnh viễn?")) return;
    try {
      await apiJsonAuth(`/admin/users/${id}`, { method: "DELETE" });
      setUsers((prev) => prev.filter((u) => u.id !== id));
      alert("Đã xóa người dùng");
    } catch {
      alert("Lỗi khi xóa tài khoản");
    }
  }

  async function handleUpdateRole(id: string, newRole: string) {
    if (!confirm(`Bạn có chắc muốn cấp quyền ${newRole.toUpperCase()} cho người dùng này?`)) return;
    try {
      await apiJsonAuth(`/admin/users/${id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role: newRole } : u)));
    } catch {
      alert("Lỗi khi cập nhật quyền");
    }
  }

  if (!auth) return null;
  if (auth.role !== "admin") return <div className="p-8 text-center text-red-500">Access Denied</div>;

  return (
    <AppShell title="Quản trị" subtitle="Hệ thống quản lý tài liệu và người dùng">
      <div className="rounded-2xl border border-white/70 bg-white/70 shadow-[0_8px_32px_-16px_rgba(2,6,23,0.18)] backdrop-blur-xl overflow-hidden flex flex-col">
        {/* Tab Bar within the Form */}
        <div className="flex border-b border-black/5 bg-slate-50/50">
          {(["stats", "reports", "users"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={[
                "px-8 py-4 text-xs font-bold transition-all border-b-2",
                tab === t
                  ? "border-rose-600 text-rose-600 bg-white"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-white/50",
              ].join(" ")}
            >
              {t === "stats" && "Tổng quan"}
              {t === "reports" && `Báo cáo (${stats?.reports ?? reports.length})`}
              {t === "users" && "Người dùng"}
            </button>
          ))}
        </div>

        <div className="flex-1 flex flex-col p-6">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 animate-pulse">
              <div className="h-10 w-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mb-4" />
              <div className="text-slate-400 font-medium text-sm">Đang đồng bộ dữ liệu...</div>
            </div>
          ) : (
            <div className="animate-fadeIn">
              {tab === "stats" && stats && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {[
                    { label: "Tài liệu hệ thống", value: stats.documents, icon: "📄" },
                    { label: "Tổng người dùng", value: stats.users, icon: "👥" },
                    { label: "Báo cáo chờ", value: stats.reports, icon: "🚩", highlight: true },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="rounded-2xl border border-black/5 bg-slate-50 p-6 transition-all hover:bg-white hover:shadow-sm"
                    >
                      <div className="text-2xl">{s.icon}</div>
                      <div className={["mt-3 text-3xl font-bold", s.highlight ? "text-rose-600" : "text-slate-900"].join(" ")}>{s.value}</div>
                      <div className="mt-1 text-xs text-slate-500 uppercase tracking-wider font-semibold">{s.label}</div>
                    </div>
                  ))}
                </div>
              )}

              {tab === "reports" && (
                <div className="space-y-4">
                  <div className="text-sm font-bold text-slate-800">Danh sách báo cáo vi phạm</div>
                  <div className="grid gap-4">
                    {reports.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 bg-white rounded-2xl border border-black/10">
                        Không có báo cáo vi phạm nào.
                      </div>
                    ) : (
                      reports.map((r) => (
                        <div key={r.id} className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm flex flex-col md:flex-row md:items-center gap-4 justify-between">
                          <div>
                            <div className="text-sm font-semibold text-slate-900 mb-1">
                              Tài liệu: <span className="text-rose-600">{r.document_title}</span>
                            </div>
                            <div className="text-sm text-slate-600 bg-red-50 p-3 rounded-xl border border-red-100 my-2">
                              <strong>Lý do:</strong> {r.reason}
                            </div>
                            <div className="text-xs text-slate-400">
                              Báo cáo bởi: {r.reporter_email} · {new Date(r.created_at).toLocaleString("vi-VN")}
                            </div>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={() => handleDismissReport(r.id)}
                              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition"
                            >
                              Bỏ qua
                            </button>
                            <button
                              onClick={() => handleDeleteDocument(r.document_id, r.id)}
                              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl shadow-sm shadow-red-200 transition"
                            >
                              Xóa tài liệu
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {tab === "users" && (
                <div className="space-y-4">
                  <div className="text-sm font-bold text-slate-800">Quản lý người dùng hệ thống</div>
                  <div className="overflow-x-auto rounded-xl border border-black/5 bg-white shadow-sm">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-slate-600 border-b border-black/5">
                        <tr>
                          <th className="px-6 py-4 font-semibold">Người dùng</th>
                          <th className="px-6 py-4 font-semibold">Vai trò</th>
                          <th className="px-6 py-4 font-semibold">Ngày tham gia</th>
                          <th className="px-6 py-4 font-semibold text-right">Hành động</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/5">
                        {users.map((u) => (
                          <tr key={u.id} className="hover:bg-slate-50/50 transition">
                            <td className="px-6 py-4">
                              <div className="font-semibold text-slate-900">{u.display_name}</div>
                              <div className="text-slate-500">{u.email}</div>
                            </td>
                            <td className="px-6 py-4">
                              {u.email === "system@pdocs.local" || u.id === auth.id ? (
                                <span className={u.role === "admin" ? "text-rose-600 font-bold bg-rose-50 px-2 py-1 rounded" : "text-slate-600"}>
                                  {u.role.toUpperCase()}
                                </span>
                              ) : (
                                <select
                                  value={u.role}
                                  onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                                  className={[
                                    "px-2 py-1 rounded-lg border border-black/10 outline-none text-xs font-bold transition",
                                    u.role === "admin" ? "bg-rose-50 text-rose-600" : "bg-slate-50 text-slate-600"
                                  ].join(" ")}
                                >
                                  <option value="user">USER</option>
                                  <option value="admin">ADMIN</option>
                                </select>
                              )}
                            </td>
                            <td className="px-6 py-4 text-slate-500">
                              {new Date(u.created_at).toLocaleDateString("vi-VN")}
                            </td>
                            <td className="px-6 py-4 text-right">
                              {u.id !== auth.id && (
                                <button
                                  onClick={() => handleDeleteUser(u.id)}
                                  className="text-red-500 hover:text-red-700 font-semibold"
                                >
                                  Xóa
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
