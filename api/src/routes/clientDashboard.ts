import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { getDb } from '../database.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware to verify client token
const requireClientAuth = (req: Request, res: Response, next: any) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    if (decoded.role !== 'client') {
      return res.status(403).json({ error: 'Client access only' });
    }

    (req as any).client = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Get dashboard summary
router.get('/dashboard', requireClientAuth, async (req: Request, res: Response) => {
  try {
    const client = (req as any).client;
    const assignedProjects = client.assignedProjects || [];

    if (assignedProjects.length === 0) {
      return res.json({ projects: [] });
    }

    const db = getDb();
    const placeholders = assignedProjects.map(() => '?').join(',');
    
    const projects = db.prepare(
      `SELECT 
        p.id, 
        p.name, 
        p.description,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'in_progress') as in_progress_count,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'backlog') as backlog_count,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'done') as done_count,
        (SELECT MAX(updated_at) FROM tasks WHERE project_id = p.id) as last_update
      FROM projects p
      WHERE p.id IN (${placeholders}) AND p.client_visible = 1`
    ).all(...assignedProjects) as any[];

    res.json({ projects });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get project tasks (Kanban data)
router.get('/projects/:projectId/tasks', requireClientAuth, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const client = (req as any).client;
    const assignedProjects = client.assignedProjects || [];

    // Verify client has access to this project
    if (!assignedProjects.includes(projectId)) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const db = getDb();
    const tasks = db.prepare(
      `SELECT 
        id, 
        title, 
        description, 
        status, 
        priority, 
        created_by,
        quick_capture,
        ai_processed,
        due_date,
        created_at, 
        updated_at
      FROM tasks 
      WHERE project_id = ?
      ORDER BY 
        CASE status
          WHEN 'in_progress' THEN 1
          WHEN 'backlog' THEN 2
          WHEN 'done' THEN 3
          ELSE 4
        END,
        priority DESC,
        created_at DESC`
    ).all(projectId) as any[];

    // Group by status for Kanban
    const kanban = {
      backlog: tasks.filter((t: any) => t.status === 'backlog'),
      in_progress: tasks.filter((t: any) => t.status === 'in_progress'),
      done: tasks.filter((t: any) => t.status === 'done')
    };

    res.json({ tasks, kanban });
  } catch (error) {
    console.error('Get project tasks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single task details
router.get('/tasks/:taskId', requireClientAuth, async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const client = (req as any).client;
    const assignedProjects = client.assignedProjects || [];

    const db = getDb();
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any;

    if (!task || !assignedProjects.includes(task.project_id)) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(task);
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create task (client can create tasks in their assigned projects)
router.post('/tasks', requireClientAuth, async (req: Request, res: Response) => {
  try {
    const { project_id, title, description, quick_capture = false, original_capture = null } = req.body;
    const client = (req as any).client;
    const assignedProjects = client.assignedProjects || [];

    if (!assignedProjects.includes(project_id)) {
      return res.status(403).json({ error: 'Access denied to this project' });
    }

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const db = getDb();
    const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO tasks (
        id, project_id, title, description, status, priority, 
        created_by, quick_capture, ai_processed, original_capture,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      taskId,
      project_id,
      title,
      description || '',
      'backlog',
      2, // default priority
      client.email,
      quick_capture ? 1 : 0,
      0, // not AI processed yet
      original_capture,
      now,
      now
    );

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    res.status(201).json(task);
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update task (client can only update tasks they created and only before AI processing)
router.patch('/tasks/:taskId', requireClientAuth, async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { title, description } = req.body;
    const client = (req as any).client;
    const assignedProjects = client.assignedProjects || [];

    const db = getDb();
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any;

    if (!task || !assignedProjects.includes(task.project_id)) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Client can only edit their own unprocessed tasks
    if (task.created_by !== client.email) {
      return res.status(403).json({ error: 'Can only edit your own tasks' });
    }

    if (task.ai_processed) {
      return res.status(403).json({ error: 'Cannot edit AI-processed tasks' });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (title !== undefined) {
      updates.push('title = ?');
      values.push(title);
    }

    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }

    if (updates.length === 0) {
      return res.json(task);
    }

    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(taskId);

    db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    res.json(updatedTask);
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
