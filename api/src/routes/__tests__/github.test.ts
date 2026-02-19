/**
 * GitHub API Route Tests
 *
 * Tests the actual GitHub /repos endpoint which uses `gh` CLI.
 * Only tests endpoints that exist in the route file.
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';

// ============================================================================
// Setup — Mock child_process before importing route
// ============================================================================

const mockExecFile = vi.fn();

vi.mock('child_process', () => ({
  execFile: (...args: unknown[]) => mockExecFile(...args),
}));

vi.mock('util', () => ({
  promisify: (_fn: unknown) => {
    return (...args: unknown[]) => mockExecFile(...args);
  },
}));

import { createTestApp } from '../../test/app.js';
import githubRouter from '../github.js';
import request from 'supertest';

const app = createTestApp(githubRouter, '/api/github');

// ============================================================================
// Tests
// ============================================================================

describe('GitHub API', () => {
  beforeEach(() => {
    mockExecFile.mockReset();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // GET /api/github/repos
  // ==========================================================================

  describe('GET /api/github/repos', () => {
    it('returns repo list from gh CLI', async () => {
      const mockRepos = [
        {
          name: 'test-repo',
          description: 'A test repo',
          url: 'https://github.com/testuser/test-repo',
          updatedAt: new Date().toISOString(),
        },
      ];

      mockExecFile.mockResolvedValue({ stdout: JSON.stringify(mockRepos) });

      const res = await request(app).get('/api/github/repos');
      expect(res.status).toBe(200);
      expect(res.body.repos).toBeDefined();
      expect(Array.isArray(res.body.repos)).toBe(true);
      expect(res.body.repos).toHaveLength(1);
      expect(res.body.repos[0].name).toBe('test-repo');
    });

    it('handles gh CLI not authenticated', async () => {
      mockExecFile.mockRejectedValue(new Error('not logged in'));

      const res = await request(app).get('/api/github/repos');
      expect(res.status).toBe(200);
      expect(res.body.repos).toEqual([]);
      expect(res.body.authenticated).toBe(false);
    });

    it('handles gh CLI errors gracefully', async () => {
      mockExecFile.mockRejectedValue(new Error('some network error'));

      const res = await request(app).get('/api/github/repos');
      expect(res.status).toBe(200);
      expect(res.body.repos).toEqual([]);
      expect(res.body.message).toContain('Failed to fetch repos');
    });

    it('filters repos to last 6 months', async () => {
      const recentDate = new Date();
      recentDate.setMonth(recentDate.getMonth() - 1);
      const oldDate = new Date();
      oldDate.setMonth(oldDate.getMonth() - 8);

      const mockRepos = [
        { name: 'recent-repo', description: 'Recent', url: 'https://github.com/test/recent', updatedAt: recentDate.toISOString() },
        { name: 'old-repo', description: 'Old', url: 'https://github.com/test/old', updatedAt: oldDate.toISOString() },
      ];

      mockExecFile.mockResolvedValue({ stdout: JSON.stringify(mockRepos) });

      const res = await request(app).get('/api/github/repos');
      expect(res.status).toBe(200);
      expect(res.body.repos).toHaveLength(1);
      expect(res.body.repos[0].name).toBe('recent-repo');
    });

    it('sorts repos by most recently updated', async () => {
      const date1 = new Date();
      date1.setDate(date1.getDate() - 1);
      const date2 = new Date();

      const mockRepos = [
        { name: 'older-repo', description: null, url: 'https://github.com/test/older', updatedAt: date1.toISOString() },
        { name: 'newer-repo', description: null, url: 'https://github.com/test/newer', updatedAt: date2.toISOString() },
      ];

      mockExecFile.mockResolvedValue({ stdout: JSON.stringify(mockRepos) });

      const res = await request(app).get('/api/github/repos');
      expect(res.status).toBe(200);
      expect(res.body.repos[0].name).toBe('newer-repo');
      expect(res.body.repos[1].name).toBe('older-repo');
    });

    it('handles invalid JSON from gh CLI', async () => {
      mockExecFile.mockResolvedValue({ stdout: 'not valid json' });

      const res = await request(app).get('/api/github/repos');
      expect(res.status).toBe(200);
      expect(res.body.repos).toEqual([]);
    });

    it('handles empty repo list', async () => {
      mockExecFile.mockResolvedValue({ stdout: '[]' });

      const res = await request(app).get('/api/github/repos');
      expect(res.status).toBe(200);
      expect(res.body.repos).toEqual([]);
    });

    it('maps repo fields correctly', async () => {
      const mockRepos = [
        {
          name: 'my-project',
          description: 'My project description',
          url: 'https://github.com/user/my-project',
          updatedAt: new Date().toISOString(),
        },
      ];

      mockExecFile.mockResolvedValue({ stdout: JSON.stringify(mockRepos) });

      const res = await request(app).get('/api/github/repos');
      expect(res.status).toBe(200);
      const repo = res.body.repos[0];
      expect(repo.name).toBe('my-project');
      expect(repo.description).toBe('My project description');
      expect(repo.url).toBe('https://github.com/user/my-project');
      expect(repo.updatedAt).toBeDefined();
    });

    it('handles null description', async () => {
      const mockRepos = [
        { name: 'no-desc', description: null, url: 'https://github.com/test/no-desc', updatedAt: new Date().toISOString() },
      ];

      mockExecFile.mockResolvedValue({ stdout: JSON.stringify(mockRepos) });

      const res = await request(app).get('/api/github/repos');
      expect(res.status).toBe(200);
      expect(res.body.repos[0].description).toBe('');
    });
  });
});
