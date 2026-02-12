/**
 * Office API Tests
 * 
 * Tests for GET /api/office/status and GET /api/office/agent/:id
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../../test/app.js';

// Create a minimal test app with the office router
async function getApp() {
  // Import the router
  const { default: officeRouter } = await import('../office.js');
  const express = (await import('express')).default;
  
  const app = express();
  app.use(express.json());
  app.use('/api/office', officeRouter);
  return app;
}

describe('Office API', () => {
  let app: any;

  beforeEach(async () => {
    app = await getApp();
  });

  describe('GET /api/office/status', () => {
    it('should return scene and agents data', async () => {
      const res = await request(app).get('/api/office/status');
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('scene');
      expect(res.body).toHaveProperty('agents');
      expect(res.body).toHaveProperty('interactions');
    });

    it('should include scene time', async () => {
      const res = await request(app).get('/api/office/status');
      
      expect(res.body.scene).toHaveProperty('time');
      expect(['morning', 'day', 'evening', 'night']).toContain(res.body.scene.time);
    });

    it('should include scene activity', async () => {
      const res = await request(app).get('/api/office/status');
      
      expect(res.body.scene).toHaveProperty('activity');
      expect(['working', 'meeting', 'break']).toContain(res.body.scene.activity);
    });

    it('should return both agents (James and Markus)', async () => {
      const res = await request(app).get('/api/office/status');
      
      expect(res.body.agents).toHaveLength(2);
      
      const ids = res.body.agents.map((a: any) => a.id);
      expect(ids).toContain('james');
      expect(ids).toContain('markus');
    });

    it('should include required agent fields', async () => {
      const res = await request(app).get('/api/office/status');
      
      for (const agent of res.body.agents) {
        expect(agent).toHaveProperty('id');
        expect(agent).toHaveProperty('name');
        expect(agent).toHaveProperty('role');
        expect(agent).toHaveProperty('location');
        expect(agent).toHaveProperty('status');
        expect(agent).toHaveProperty('currentTask');
        expect(agent).toHaveProperty('animation');
        expect(agent).toHaveProperty('taskStartTime');
      }
    });

    it('should return valid animation states', async () => {
      const res = await request(app).get('/api/office/status');
      
      const validAnimations = ['idle', 'typing', 'working', 'thinking', 'coffee_break', 'meeting', 'away', 'walking'];
      
      for (const agent of res.body.agents) {
        expect(validAnimations).toContain(agent.animation);
      }
    });

    it('interactions should be an array', async () => {
      const res = await request(app).get('/api/office/status');
      
      expect(Array.isArray(res.body.interactions)).toBe(true);
    });
  });

  describe('GET /api/office/agent/:id', () => {
    it('should return James profile', async () => {
      const res = await request(app).get('/api/office/agent/james');
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('name', 'James');
      expect(res.body).toHaveProperty('role', 'Team Manager');
    });

    it('should return Markus profile', async () => {
      const res = await request(app).get('/api/office/agent/markus');
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('name', 'Markus');
      expect(res.body).toHaveProperty('role', 'Senior Developer');
    });

    it('should include traits', async () => {
      const res = await request(app).get('/api/office/agent/james');
      
      expect(res.body).toHaveProperty('traits');
      expect(Array.isArray(res.body.traits)).toBe(true);
      expect(res.body.traits.length).toBeGreaterThan(0);
    });

    it('should include current task with progress', async () => {
      const res = await request(app).get('/api/office/agent/markus');
      
      expect(res.body).toHaveProperty('currentTask');
      expect(res.body.currentTask).toHaveProperty('title');
      expect(res.body.currentTask).toHaveProperty('progress');
      expect(typeof res.body.currentTask.progress).toBe('number');
    });

    it('should include backlog', async () => {
      const res = await request(app).get('/api/office/agent/markus');
      
      expect(res.body).toHaveProperty('backlog');
      expect(Array.isArray(res.body.backlog)).toBe(true);
    });

    it('should include stats', async () => {
      const res = await request(app).get('/api/office/agent/james');
      
      expect(res.body).toHaveProperty('stats');
      expect(typeof res.body.stats).toBe('object');
    });

    it('should return 404 for unknown agent', async () => {
      const res = await request(app).get('/api/office/agent/unknown');
      
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/office/agent/:id/status', () => {
    it('should update agent status', async () => {
      const res = await request(app)
        .put('/api/office/agent/markus/status')
        .send({ status: 'thinking', currentTask: 'Debugging auth issue' });
      
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('thinking');
      expect(res.body.currentTask).toBe('Debugging auth issue');
      expect(res.body.animation).toBe('thinking');
    });

    it('should update agent location', async () => {
      const res = await request(app)
        .put('/api/office/agent/james/status')
        .send({ location: 'kitchen' });
      
      expect(res.status).toBe(200);
      expect(res.body.location).toBe('kitchen');
    });

    it('should update interactingWith', async () => {
      const res = await request(app)
        .put('/api/office/agent/james/status')
        .send({ interactingWith: 'markus' });
      
      expect(res.status).toBe(200);
      expect(res.body.interactingWith).toBe('markus');
    });

    it('should return 404 for unknown agent', async () => {
      const res = await request(app)
        .put('/api/office/agent/unknown/status')
        .send({ status: 'idle' });
      
      expect(res.status).toBe(404);
    });

    it('should reflect status changes in GET /status', async () => {
      // Update Markus to 'break'
      await request(app)
        .put('/api/office/agent/markus/status')
        .send({ status: 'break' });
      
      // Check it's reflected
      const res = await request(app).get('/api/office/status');
      const markus = res.body.agents.find((a: any) => a.id === 'markus');
      
      expect(markus.status).toBe('break');
      expect(markus.animation).toBe('coffee_break');
    });
  });
});
