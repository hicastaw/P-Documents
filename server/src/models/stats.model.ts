import { pool } from "../config/db";

async function countTable(table: string): Promise<number> {
  const result = await pool.query(`SELECT COUNT(*)::int AS count FROM ${table}`);
  return result.rows[0]?.count ?? 0;
}

export const countUsers = () => countTable("users");
export const countDocuments = () => countTable("documents");
export const countDocumentReports = () => countTable("document_reports");
export const countQuizzes = () => countTable("quizzes");
export const countQuizAttempts = () => countTable("quiz_attempts");
