import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from '../database.js';

const router = Router();

if (!process.env.JWT_SECRET) {
  throw new Error("FATAL: JWT_SECRET environment variable is required");
}
const JWT_SECRET: string = process.env.JWT_SECRET;

interface ClientRow {
  id: string;
  name: string;
  email: string;
  company: string | null;
  password_hash: string;
  role: string;
  assigned_projects: string | null;
  status: string;
}

// Client login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const db = getDb();
    const client = db.prepare('SELECT * FROM clients WHERE email = ? AND role = ?')
      .get(email, 'client') as ClientRow | undefined;

    if (!client || client.status !== 'active') {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const passwordMatch = await bcrypt.compare(password, client.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    db.prepare('UPDATE clients SET last_login_at = ? WHERE id = ?')
      .run(new Date().toISOString(), client.id);

    // Parse assigned projects
    const assignedProjects = client.assigned_projects 
      ? JSON.parse(client.assigned_projects) 
      : [];

    // Generate JWT
    const token = jwt.sign(
      {
        id: client.id,
        email: client.email,
        name: client.name,
        role: 'client',
        assignedProjects
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      client: {
        id: client.id,
        name: client.name,
        email: client.email,
        company: client.company,
        assignedProjects
      }
    });
  } catch (error) {
    console.error('Client login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current client info
router.get('/me', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    if (decoded.role !== 'client') {
      return res.status(403).json({ error: 'Client access only' });
    }

    const db = getDb();
    const client = db.prepare('SELECT id, name, email, company, assigned_projects FROM clients WHERE id = ? AND role = ?')
      .get(decoded.id, 'client') as ClientRow | undefined;

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const assignedProjects = client.assigned_projects 
      ? JSON.parse(client.assigned_projects) 
      : [];

    res.json({
      id: client.id,
      name: client.name,
      email: client.email,
      company: client.company,
      assignedProjects
    });
  } catch (error) {
    console.error('Get client info error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
