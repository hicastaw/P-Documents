import { Router, type Request, type Response } from "express";
import { pool } from "../../db/pg";
import { requireAdmin } from "../auth/middleware";

export const adminRouter = Router();

adminRouter.use(requireAdmin);

// 1. Get Dashboard Stats
adminRouter.get("/stats", async (req: Request, res: Response, next) => {
  try {
    const usersCount = await pool.query("SELECT COUNT(*) FROM users");
    const docsCount = await pool.query("SELECT COUNT(*) FROM documents");
    const reportsCount = await pool.query("SELECT COUNT(*) FROM document_reports");
    
    return res.json({
      users: parseInt(usersCount.rows[0].count),
      documents: parseInt(docsCount.rows[0].count),
      reports: parseInt(reportsCount.rows[0].count),
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/test-stats", async (req: Request, res: Response, next) => {
  try {
    const usersCount = await pool.query("SELECT COUNT(*) FROM users");
    const docsCount = await pool.query("SELECT COUNT(*) FROM documents");
    const reportsCount = await pool.query("SELECT COUNT(*) FROM document_reports");
    
    return res.json({
      users: parseInt(usersCount.rows[0].count),
      documents: parseInt(docsCount.rows[0].count),
      reports: parseInt(reportsCount.rows[0].count),
    });
  } catch (err) {
    next(err);
  }
});

// 2. Get Reports
adminRouter.get("/reports", async (req: Request, res: Response, next) => {
  try {
    const query = `
      SELECT 
        dr.id, dr.reason, dr.created_at,
        u.email as reporter_email,
        d.id as document_id, d.title as document_title, d.status as document_status
      FROM document_reports dr
      JOIN users u ON dr.user_id = u.id
      JOIN documents d ON dr.document_id = d.id
      ORDER BY dr.created_at DESC
    `;
    const { rows } = await pool.query(query);
    return res.json({ reports: rows });
  } catch (err) {
    next(err);
  }
});

// 3. Dismiss Report
adminRouter.post("/reports/:id/dismiss", async (req: Request, res: Response, next) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM document_reports WHERE id = $1", [id]);
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// 4. Delete Document (admin override)
adminRouter.delete("/documents/:id", async (req: Request, res: Response, next) => {
  try {
    const { id } = req.params;
    // This will cascade delete document_reports, document_stars, etc.
    await pool.query("DELETE FROM documents WHERE id = $1", [id]);
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// 5. Get Users
adminRouter.get("/users", async (req: Request, res: Response, next) => {
  try {
    const { rows } = await pool.query("SELECT id, email, display_name, role, created_at FROM users ORDER BY created_at DESC");
    return res.json({ users: rows });
  } catch (err) {
    next(err);
  }
});

// 6. Delete User
adminRouter.delete("/users/:id", async (req: Request, res: Response, next) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    const { rows } = await client.query("SELECT email FROM users WHERE id = $1", [id]);
    if (rows[0]?.email === "system@pdocs.local") {
      client.release();
      return res.status(403).json({ error: "cannot_delete_system_admin" });
    }

    await client.query("BEGIN");

    // Manually delete documents and quizzes because their foreign keys do not have ON DELETE CASCADE
    await client.query("DELETE FROM documents WHERE owner_id = $1", [id]);
    await client.query("DELETE FROM quizzes WHERE created_by = $1", [id]);

    // Delete the user (this cascades to forum_threads, notifications, document_stars, etc.)
    await client.query("DELETE FROM users WHERE id = $1", [id]);

    await client.query("COMMIT");
    return res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
});

// 7. Update User Role
adminRouter.patch("/users/:id/role", async (req: Request, res: Response, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    
    if (role !== "admin" && role !== "user") {
      return res.status(400).json({ error: "invalid_role" });
    }
    
    // Prevent changing the system admin role
    const { rows } = await pool.query("SELECT email FROM users WHERE id = $1", [id]);
    if (rows[0]?.email === "system@pdocs.local") {
      return res.status(403).json({ error: "cannot_modify_system_admin" });
    }
    
    await pool.query("UPDATE users SET role = $1 WHERE id = $2", [role, id]);
    return res.json({ success: true, role });
  } catch (err) {
    next(err);
  }
});
