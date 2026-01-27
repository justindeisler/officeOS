/**
 * Project management tools for MCP server
 */

import { getDb, generateId, getCurrentTimestamp } from "../database.js";

export interface Project {
  id: string;
  client_id: string | null;
  name: string;
  description: string | null;
  status: "active" | "completed" | "on_hold" | "archived";
  budget_amount: number | null;
  budget_currency: string;
  start_date: string | null;
  target_end_date: string | null;
  actual_end_date: string | null;
  area: "wellfy" | "freelance" | "personal";
  markdown_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectParams {
  name: string;
  area?: "wellfy" | "freelance" | "personal";
  client_id?: string;
  description?: string;
  budget_amount?: number;
  budget_currency?: string;
  start_date?: string;
  target_end_date?: string;
}

export interface UpdateProjectParams {
  id: string;
  name?: string;
  area?: "wellfy" | "freelance" | "personal";
  client_id?: string;
  description?: string;
  status?: "active" | "completed" | "on_hold" | "archived";
  budget_amount?: number;
  budget_currency?: string;
  start_date?: string;
  target_end_date?: string;
  actual_end_date?: string;
}

export interface ListProjectsParams {
  area?: "wellfy" | "freelance" | "personal";
  status?: "active" | "completed" | "on_hold" | "archived";
  client_id?: string;
}

/**
 * Create a new project
 */
export function createProject(params: CreateProjectParams): Project {
  const db = getDb();
  const now = getCurrentTimestamp();

  const project: Project = {
    id: generateId(),
    client_id: params.client_id || null,
    name: params.name,
    description: params.description || null,
    status: "active",
    budget_amount: params.budget_amount || null,
    budget_currency: params.budget_currency || "EUR",
    start_date: params.start_date || null,
    target_end_date: params.target_end_date || null,
    actual_end_date: null,
    area: params.area || "freelance",
    markdown_path: null,
    created_at: now,
    updated_at: now,
  };

  const stmt = db.prepare(`
    INSERT INTO projects (
      id, client_id, name, description, status, budget_amount,
      budget_currency, start_date, target_end_date, actual_end_date,
      area, markdown_path, created_at, updated_at
    ) VALUES (
      @id, @client_id, @name, @description, @status, @budget_amount,
      @budget_currency, @start_date, @target_end_date, @actual_end_date,
      @area, @markdown_path, @created_at, @updated_at
    )
  `);

  stmt.run(project);

  return project;
}

/**
 * Update an existing project
 */
export function updateProject(params: UpdateProjectParams): Project {
  const db = getDb();
  const now = getCurrentTimestamp();

  // Get current project
  const current = db
    .prepare("SELECT * FROM projects WHERE id = ?")
    .get(params.id) as Project | undefined;

  if (!current) {
    throw new Error(`Project not found: ${params.id}`);
  }

  const updates: string[] = ["updated_at = @updated_at"];
  const values: Record<string, unknown> = {
    id: params.id,
    updated_at: now,
  };

  if (params.name !== undefined) {
    updates.push("name = @name");
    values.name = params.name;
  }

  if (params.area !== undefined) {
    updates.push("area = @area");
    values.area = params.area;
  }

  if (params.client_id !== undefined) {
    updates.push("client_id = @client_id");
    values.client_id = params.client_id || null;
  }

  if (params.description !== undefined) {
    updates.push("description = @description");
    values.description = params.description;
  }

  if (params.status !== undefined) {
    updates.push("status = @status");
    values.status = params.status;

    // Set actual_end_date if completing
    if (params.status === "completed" && current.status !== "completed") {
      updates.push("actual_end_date = @actual_end_date");
      values.actual_end_date = now.split("T")[0];
    }
  }

  if (params.budget_amount !== undefined) {
    updates.push("budget_amount = @budget_amount");
    values.budget_amount = params.budget_amount || null;
  }

  if (params.budget_currency !== undefined) {
    updates.push("budget_currency = @budget_currency");
    values.budget_currency = params.budget_currency;
  }

  if (params.start_date !== undefined) {
    updates.push("start_date = @start_date");
    values.start_date = params.start_date || null;
  }

  if (params.target_end_date !== undefined) {
    updates.push("target_end_date = @target_end_date");
    values.target_end_date = params.target_end_date || null;
  }

  if (params.actual_end_date !== undefined) {
    updates.push("actual_end_date = @actual_end_date");
    values.actual_end_date = params.actual_end_date || null;
  }

  const sql = `UPDATE projects SET ${updates.join(", ")} WHERE id = @id`;
  db.prepare(sql).run(values);

  return db
    .prepare("SELECT * FROM projects WHERE id = ?")
    .get(params.id) as Project;
}

/**
 * List projects with optional filters
 */
export function listProjects(params: ListProjectsParams = {}): Project[] {
  const db = getDb();

  const conditions: string[] = [];
  const values: Record<string, unknown> = {};

  if (params.area) {
    conditions.push("area = @area");
    values.area = params.area;
  }

  if (params.status) {
    conditions.push("status = @status");
    values.status = params.status;
  }

  if (params.client_id) {
    conditions.push("client_id = @client_id");
    values.client_id = params.client_id;
  }

  let sql = "SELECT * FROM projects";

  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(" AND ")}`;
  }

  sql += " ORDER BY created_at DESC";

  return db.prepare(sql).all(values) as Project[];
}

/**
 * Get a project by ID
 */
export function getProject(id: string): Project | null {
  const db = getDb();
  return (
    (db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as Project) ||
    null
  );
}

/**
 * Delete a project
 */
export function deleteProject(
  id: string
): { success: boolean; message: string } {
  const db = getDb();

  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as
    | Project
    | undefined;

  if (!project) {
    throw new Error(`Project not found: ${id}`);
  }

  // Check for associated tasks
  const taskCount = db
    .prepare("SELECT COUNT(*) as count FROM tasks WHERE project_id = ?")
    .get(id) as { count: number };

  if (taskCount.count > 0) {
    throw new Error(
      `Cannot delete project "${project.name}" - it has ${taskCount.count} associated tasks. Delete or reassign them first.`
    );
  }

  db.prepare("DELETE FROM projects WHERE id = ?").run(id);

  return {
    success: true,
    message: `Project "${project.name}" deleted successfully`,
  };
}
