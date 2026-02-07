import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from '../database.js';
import { createLogger } from '../logger.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { ValidationError, AuthError, NotFoundError } from '../errors.js';

const router = Router();
const log = createLogger('client-auth');

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
router.post('/login', asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ValidationError('Email and password required');
  }

  const db = getDb();
  const client = db.prepare('SELECT * FROM clients WHERE email = ? AND role = ?')
    .get(email, 'client') as ClientRow | undefined;

  if (!client || client.status !== 'active') {
    throw new AuthError('Invalid credentials');
  }

  const passwordMatch = await bcrypt.compare(password, client.password_hash);
  if (!passwordMatch) {
    throw new AuthError('Invalid credentials');
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

  log.info({ clientId: client.id, email: client.email }, 'Client logged in');

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
}));

// Get current client info
router.get('/me', asyncHandler(async (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    throw new AuthError('No token provided');
  }

  let decoded: any;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    throw new AuthError('Invalid or expired token');
  }

  if (decoded.role !== 'client') {
    throw new AuthError('Client access only');
  }

  const db = getDb();
  const client = db.prepare('SELECT id, name, email, company, assigned_projects FROM clients WHERE id = ? AND role = ?')
    .get(decoded.id, 'client') as ClientRow | undefined;

  if (!client) {
    throw new NotFoundError('Client', decoded.id);
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
}));

export default router;
