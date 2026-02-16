/**
 * Auth API Route Tests
 *
 * Tests login, token verification, and auth middleware.
 */

import { describe, it, expect, beforeEach, afterAll, vi, beforeAll } from 'vitest';

// ============================================================================
// Setup - Mock environment variables BEFORE importing auth module
// ============================================================================

// We need to set env vars before auth.ts is loaded
const TEST_JWT_SECRET = 'test-jwt-secret-key-for-testing-only-32chars!';
const TEST_PASSWORD = 'testpassword123';

// bcrypt hash for 'testpassword123' (cost factor 10)
import bcrypt from 'bcryptjs';

let testPasswordHash: string;

beforeAll(async () => {
  testPasswordHash = await bcrypt.hash(TEST_PASSWORD, 10);
  process.env.JWT_SECRET = TEST_JWT_SECRET;
  process.env.AUTH_JUSTIN_HASH = testPasswordHash;
  process.env.AUTH_JUSTIN_NAME = 'Justin Test';
  process.env.AUTH_JAMES_HASH = testPasswordHash;
  process.env.AUTH_JAMES_NAME = 'James Test';
});

import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// ============================================================================
// Test App Builder (with dynamic import to pick up env vars)
// ============================================================================

async function buildApp() {
  // Dynamic import so auth module sees the env vars
  const authModule = await import('../auth.js');
  const authRouter = authModule.default;
  const { authMiddleware } = authModule;

  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);

  // Protected test endpoint
  app.get('/api/protected', authMiddleware, (_req, res) => {
    res.json({ message: 'protected content', user: ((_req as any).user) });
  });

  // Error handler
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.statusCode || 500).json({ error: err.message || 'Internal Server Error' });
  });

  return app;
}

// ============================================================================
// Tests
// ============================================================================

describe('Auth API', () => {
  let app: express.Express;

  beforeAll(async () => {
    app = await buildApp();
  });

  // ==========================================================================
  // POST /api/auth/login
  // ==========================================================================

  describe('POST /api/auth/login', () => {
    it('returns token for valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'justin', password: TEST_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.username).toBe('justin');
      expect(res.body.user.name).toBe('Justin Test');
      expect(res.body.expiresIn).toBe('7d');
    });

    it('supports case-insensitive username', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'JUSTIN', password: TEST_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.user.username).toBe('justin');
    });

    it('returns longer token with rememberMe', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'justin', password: TEST_PASSWORD, rememberMe: true });

      expect(res.status).toBe(200);
      expect(res.body.expiresIn).toBe('365d');
    });

    it('rejects invalid password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'justin', password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid credentials');
    });

    it('rejects unknown username', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'unknown', password: TEST_PASSWORD });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid credentials');
    });

    it('rejects missing username', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ password: TEST_PASSWORD });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Username and password required');
    });

    it('rejects missing password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'justin' });

      expect(res.status).toBe(400);
    });

    it('returns valid JWT token', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'justin', password: TEST_PASSWORD });

      const decoded = jwt.verify(res.body.token, TEST_JWT_SECRET) as any;
      expect(decoded.username).toBe('justin');
      expect(decoded.name).toBe('Justin Test');
    });
  });

  // ==========================================================================
  // GET /api/auth/verify
  // ==========================================================================

  describe('GET /api/auth/verify', () => {
    let validToken: string;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'justin', password: TEST_PASSWORD });
      validToken = res.body.token;
    });

    it('verifies a valid token', async () => {
      const res = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
      expect(res.body.user.username).toBe('justin');
    });

    it('rejects expired token', async () => {
      const expiredToken = jwt.sign(
        { username: 'justin', name: 'Justin Test' },
        TEST_JWT_SECRET,
        { expiresIn: '0s' }
      );

      // Wait a moment for token to expire
      await new Promise(r => setTimeout(r, 100));

      const res = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
    });

    it('rejects missing token', async () => {
      const res = await request(app).get('/api/auth/verify');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('No token provided');
    });

    it('rejects invalid token format', async () => {
      const res = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', 'Bearer invalid.token.here');

      expect(res.status).toBe(401);
    });

    it('rejects token signed with wrong secret', async () => {
      const badToken = jwt.sign(
        { username: 'justin', name: 'Justin Test' },
        'wrong-secret-key'
      );

      const res = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${badToken}`);

      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // Auth Middleware
  // ==========================================================================

  describe('Auth Middleware', () => {
    let validToken: string;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'justin', password: TEST_PASSWORD });
      validToken = res.body.token;
    });

    it('allows access with valid token', async () => {
      const res = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('protected content');
    });

    it('blocks access without token', async () => {
      const res = await request(app).get('/api/protected');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Authentication required');
    });

    it('blocks access with invalid token', async () => {
      const res = await request(app)
        .get('/api/protected')
        .set('Authorization', 'Bearer invalid');

      expect(res.status).toBe(401);
    });

    it('blocks access with non-Bearer scheme', async () => {
      const res = await request(app)
        .get('/api/protected')
        .set('Authorization', `Basic ${validToken}`);

      expect(res.status).toBe(401);
    });
  });
});
