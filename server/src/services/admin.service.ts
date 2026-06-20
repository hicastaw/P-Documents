import * as userModel from "../models/user.model";
import * as documentModel from "../models/document.model";
import * as statsModel from "../models/stats.model";

const SYSTEM_ADMIN_EMAIL = "system@pdocs.local";

export async function getDashboardStats() {
  const [users, documents, reports] = await Promise.all([
    statsModel.countUsers(),
    statsModel.countDocuments(),
    statsModel.countDocumentReports(),
  ]);
  return { users, documents, reports };
}

export async function listReports() {
  return documentModel.listReportsWithDetails();
}

export async function dismissReport(id: string) {
  await documentModel.dismissReportById(id);
}

export async function deleteDocumentAdmin(id: string) {
  await documentModel.deleteDocumentById(id);
}

export async function listUsers() {
  return userModel.listUsers();
}

export async function deleteUser(id: string) {
  const user = await userModel.findUserById(id);
  if (user?.email === SYSTEM_ADMIN_EMAIL) {
    throw new Error("cannot_delete_system_admin");
  }
  await userModel.deleteUserCascade(id);
}

export async function changeRole(id: string, role: string) {
  if (role !== "admin" && role !== "user") {
    throw new Error("invalid_role");
  }

  const user = await userModel.findUserById(id);
  if (user?.email === SYSTEM_ADMIN_EMAIL) {
    throw new Error("cannot_modify_system_admin");
  }

  await userModel.updateUserRole(id, role);
}
