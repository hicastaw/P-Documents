import { pool } from "../config/db";

export async function insertUser(email: string, passwordHash: string, displayName: string) {
  const result = await pool.query(
    "INSERT INTO users(email, password_hash, display_name) VALUES ($1,$2,$3) RETURNING id,email,display_name,created_at",
    [email, passwordHash, displayName],
  );
  return result.rows[0];
}

export async function findUserByEmail(email: string) {
  const result = await pool.query(
    "SELECT id, email, password_hash, display_name, role FROM users WHERE email=$1",
    [email],
  );
  return result.rows[0] ?? null;
}

export async function findUserById(id: string) {
  const result = await pool.query(
    "SELECT id,email,display_name,role,created_at FROM users WHERE id=$1",
    [id],
  );
  return result.rows[0] ?? null;
}

export async function findUserPasswordHash(id: string) {
  const result = await pool.query(
    "SELECT id, password_hash, display_name FROM users WHERE id=$1",
    [id],
  );
  return result.rows[0] ?? null;
}

export async function updateUserProfile(id: string, fields: { displayName?: string; passwordHash?: string }) {
  const updates: string[] = [];
  const values: any[] = [];
  let paramIdx = 1;

  if (fields.displayName !== undefined) {
    updates.push(`display_name = $${paramIdx++}`);
    values.push(fields.displayName);
  }
  if (fields.passwordHash !== undefined) {
    updates.push(`password_hash = $${paramIdx++}`);
    values.push(fields.passwordHash);
  }
  if (updates.length === 0) return null;

  values.push(id);
  const result = await pool.query(
    `UPDATE users SET ${updates.join(", ")} WHERE id = $${paramIdx} RETURNING id, email, display_name`,
    values,
  );
  return result.rows[0] ?? null;
}

export async function findDisplayName(id: string): Promise<string | null> {
  const result = await pool.query("SELECT display_name FROM users WHERE id=$1", [id]);
  return result.rows[0]?.display_name ?? null;
}

export async function findUserRole(id: string) {
  const result = await pool.query("SELECT role FROM users WHERE id=$1", [id]);
  return result.rows[0]?.role ?? null;
}

export async function listUsers() {
  const result = await pool.query(
    "SELECT id, email, display_name, role, created_at FROM users ORDER BY created_at DESC",
  );
  return result.rows;
}

export async function updateUserRole(id: string, role: string) {
  await pool.query("UPDATE users SET role = $1 WHERE id = $2", [role, id]);
}

/** Pure persistence: delete a user and the rows that don't cascade automatically. */
export async function deleteUserCascade(id: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Manually delete documents and quizzes because their foreign keys do not have ON DELETE CASCADE
    await client.query("DELETE FROM documents WHERE owner_id = $1", [id]);
    await client.query("DELETE FROM quizzes WHERE created_by = $1", [id]);
    // Delete the user (this cascades to forum_threads, notifications, document_stars, etc.)
    await client.query("DELETE FROM users WHERE id = $1", [id]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
