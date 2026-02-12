/**
 * Office Feature - Unit Tests
 * 
 * Tests for office types, layout, and state management logic.
 */

import { describe, it, expect } from 'vitest';
import { STATUS_TO_ANIMATION } from '../../../types/office';
import type { OfficeStatusResponse, OfficeAgent } from '../../../types/office';
import { 
  TILE_SIZE, SCENE_WIDTH, SCENE_HEIGHT, 
  CHARACTER_POSITIONS, getOfficeFurniture, COLORS 
} from '../../../lib/office/layout';

describe('Office Types', () => {
  describe('STATUS_TO_ANIMATION mapping', () => {
    it('should map all status values to animations', () => {
      expect(STATUS_TO_ANIMATION.idle).toBe('idle');
      expect(STATUS_TO_ANIMATION.coding).toBe('typing');
      expect(STATUS_TO_ANIMATION.delegating).toBe('working');
      expect(STATUS_TO_ANIMATION.thinking).toBe('thinking');
      expect(STATUS_TO_ANIMATION.reviewing).toBe('thinking');
      expect(STATUS_TO_ANIMATION.meeting).toBe('meeting');
      expect(STATUS_TO_ANIMATION.break).toBe('coffee_break');
      expect(STATUS_TO_ANIMATION.away).toBe('away');
    });

    it('should cover all possible statuses', () => {
      const statuses = ['idle', 'coding', 'delegating', 'thinking', 'reviewing', 'meeting', 'break', 'away'];
      for (const status of statuses) {
        expect(STATUS_TO_ANIMATION).toHaveProperty(status);
      }
    });
  });
});

describe('Office Layout', () => {
  describe('Scene dimensions', () => {
    it('should have correct tile size', () => {
      expect(TILE_SIZE).toBe(16);
    });

    it('should have correct scene dimensions', () => {
      expect(SCENE_WIDTH).toBe(1200);
      expect(SCENE_HEIGHT).toBe(800);
    });
  });

  describe('Character positions', () => {
    it('should define positions for James', () => {
      expect(CHARACTER_POSITIONS.james).toHaveProperty('desk');
      expect(CHARACTER_POSITIONS.james).toHaveProperty('kitchen');
      expect(CHARACTER_POSITIONS.james).toHaveProperty('meetingRoom');
      
      expect(CHARACTER_POSITIONS.james.desk.x).toBeGreaterThan(0);
      expect(CHARACTER_POSITIONS.james.desk.y).toBeGreaterThan(0);
    });

    it('should define positions for Markus', () => {
      expect(CHARACTER_POSITIONS.markus).toHaveProperty('desk');
      expect(CHARACTER_POSITIONS.markus).toHaveProperty('kitchen');
      expect(CHARACTER_POSITIONS.markus).toHaveProperty('meetingRoom');
      
      expect(CHARACTER_POSITIONS.markus.desk.x).toBeGreaterThan(0);
      expect(CHARACTER_POSITIONS.markus.desk.y).toBeGreaterThan(0);
    });

    it('James and Markus should have different desk positions', () => {
      expect(CHARACTER_POSITIONS.james.desk.x).not.toBe(CHARACTER_POSITIONS.markus.desk.x);
    });

    it('positions should be within scene bounds', () => {
      const maxTileX = SCENE_WIDTH / TILE_SIZE;
      const maxTileY = SCENE_HEIGHT / TILE_SIZE;

      for (const agent of Object.values(CHARACTER_POSITIONS)) {
        for (const pos of Object.values(agent)) {
          expect(pos.x).toBeGreaterThanOrEqual(0);
          expect(pos.x).toBeLessThan(maxTileX);
          expect(pos.y).toBeGreaterThanOrEqual(0);
          expect(pos.y).toBeLessThan(maxTileY);
        }
      }
    });
  });

  describe('Furniture', () => {
    it('should return furniture items', () => {
      const furniture = getOfficeFurniture();
      expect(furniture.length).toBeGreaterThan(10);
    });

    it('all furniture items should have required fields', () => {
      const furniture = getOfficeFurniture();
      for (const item of furniture) {
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('type');
        expect(item).toHaveProperty('x');
        expect(item).toHaveProperty('y');
        expect(item).toHaveProperty('width');
        expect(item).toHaveProperty('height');
        expect(item).toHaveProperty('color');
      }
    });

    it('should have unique IDs', () => {
      const furniture = getOfficeFurniture();
      const ids = furniture.map(f => f.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('furniture should be within scene bounds', () => {
      const furniture = getOfficeFurniture();
      const maxTileX = SCENE_WIDTH / TILE_SIZE;
      const maxTileY = SCENE_HEIGHT / TILE_SIZE;

      for (const item of furniture) {
        expect(item.x).toBeGreaterThanOrEqual(0);
        expect(item.x + item.width).toBeLessThanOrEqual(maxTileX + 1);
        expect(item.y).toBeGreaterThanOrEqual(0);
        expect(item.y + item.height).toBeLessThanOrEqual(maxTileY + 1);
      }
    });

    it('should include desks for James and Markus', () => {
      const furniture = getOfficeFurniture();
      const jamesDesk = furniture.find(f => f.id === 'james-desk');
      const markusDesk = furniture.find(f => f.id === 'markus-desk');
      
      expect(jamesDesk).toBeDefined();
      expect(markusDesk).toBeDefined();
    });

    it('should include monitors', () => {
      const furniture = getOfficeFurniture();
      const monitors = furniture.filter(f => f.type === 'monitor');
      
      // James: 1 monitor, Markus: 2 monitors
      expect(monitors.length).toBeGreaterThanOrEqual(3);
    });

    it('should include kitchen items', () => {
      const furniture = getOfficeFurniture();
      const kitchen = furniture.filter(f => 
        f.id.includes('coffee') || f.id.includes('fridge') || f.id.includes('vending')
      );
      
      expect(kitchen.length).toBeGreaterThanOrEqual(3);
    });

    it('should include meeting room items', () => {
      const furniture = getOfficeFurniture();
      const meeting = furniture.filter(f => 
        f.id.includes('meeting') || f.id.includes('whiteboard') || f.id.includes('mchair')
      );
      
      expect(meeting.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Colors', () => {
    it('should define character colors', () => {
      expect(COLORS.jamesPrimary).toBeDefined();
      expect(COLORS.jamesAccent).toBeDefined();
      expect(COLORS.markusPrimary).toBeDefined();
      expect(COLORS.markusAccent).toBeDefined();
    });

    it('should define valid hex colors', () => {
      const hexRegex = /^#[0-9a-fA-F]{6}$/;
      
      for (const [key, value] of Object.entries(COLORS)) {
        expect(value).toMatch(hexRegex);
      }
    });
  });
});

describe('API Response Parsing', () => {
  it('should parse a valid office status response', () => {
    const response: OfficeStatusResponse = {
      scene: { time: 'day', activity: 'working' },
      agents: [
        {
          id: 'james',
          name: 'James',
          role: 'Team Manager',
          location: 'desk',
          status: 'delegating',
          currentTask: 'Planning sprint',
          animation: 'working',
          interactingWith: null,
          taskStartTime: new Date().toISOString(),
        },
        {
          id: 'markus',
          name: 'Markus',
          role: 'Senior Developer',
          location: 'dev_station',
          status: 'coding',
          currentTask: 'Building feature',
          animation: 'typing',
          interactingWith: null,
          taskStartTime: new Date().toISOString(),
        },
      ],
      interactions: [],
    };

    expect(response.scene.time).toBe('day');
    expect(response.agents).toHaveLength(2);
    expect(response.agents[0].id).toBe('james');
    expect(response.agents[1].animation).toBe('typing');
  });
});
