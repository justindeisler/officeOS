/**
 * Office Layout Configuration
 * 
 * Defines the positions of all furniture and zones in the office scene.
 * All coordinates are in "tile" units (each tile = 16px at 1x scale).
 * The canvas is 75 tiles wide x 50 tiles tall (1200x800 at 1x).
 */

import type { FurnitureItem } from './types';

// ── Scene Constants ─────────────────────────────────────────

export const TILE_SIZE = 16;
export const SCENE_TILES_X = 75;
export const SCENE_TILES_Y = 50;
export const SCENE_WIDTH = SCENE_TILES_X * TILE_SIZE;  // 1200
export const SCENE_HEIGHT = SCENE_TILES_Y * TILE_SIZE;  // 800

// ── Color Palette (Pixel Art Style) ─────────────────────────

export const COLORS = {
  // Floors
  floorLight: '#c8b89a',
  floorDark: '#b8a88a',
  floorTile: '#d4cdc0',
  
  // Walls
  wallTop: '#e8e0d0',
  wallSide: '#d0c8b0',
  wallAccent: '#a09070',
  
  // Furniture
  deskWood: '#8b6d3f',
  deskDark: '#6b4d2f',
  chairBlue: '#4a6fa5',
  chairGrey: '#6a7a8a',
  
  // Tech
  monitorFrame: '#2a2a2a',
  monitorScreen: '#1a3a5a',
  monitorScreenOn: '#2a5a8a',
  monitorGlow: '#4a8aba',
  keyboard: '#3a3a3a',
  
  // Kitchen
  counterTop: '#808080',
  counterSide: '#606060',
  coffeeMachine: '#4a3a2a',
  coffeeAccent: '#8a6a4a',
  fridge: '#d0d8e0',
  
  // Meeting Room
  tableWood: '#7a5a3a',
  whiteboard: '#f0f0f0',
  whiteboardFrame: '#808080',
  
  // Decor
  plantGreen: '#4a8a3a',
  plantDark: '#2a6a1a',
  potBrown: '#8a6a4a',
  bookshelfWood: '#6a4a2a',
  
  // Walls/Dividers
  divider: '#b0a890',
  
  // Characters
  jamesPrimary: '#3a6a9a',    // Professional blue
  jamesAccent: '#2a4a6a',
  markusPrimary: '#7a7a7a',   // Grey hoodie
  markusAccent: '#5a5a5a',
  skin: '#e8c8a0',
  skinDark: '#d0a878',
  hair: '#4a3a2a',
};

// ── Room Zones ──────────────────────────────────────────────

export const ZONES = {
  meetingRoom: { x: 0, y: 0, width: 30, height: 20 },
  kitchen: { x: 30, y: 0, width: 45, height: 20 },
  jamesDesk: { x: 5, y: 25, width: 20, height: 15 },
  markusDesk: { x: 45, y: 25, width: 25, height: 15 },
  hallway: { x: 0, y: 20, width: 75, height: 5 },
  expansion: { x: 0, y: 40, width: 75, height: 10 },
};

// ── Character Default Positions (tile coords) ──────────────

export const CHARACTER_POSITIONS = {
  james: {
    desk: { x: 14, y: 30 },
    kitchen: { x: 45, y: 10 },
    meetingRoom: { x: 12, y: 10 },
  },
  markus: {
    desk: { x: 54, y: 30 },  // dev_station
    kitchen: { x: 50, y: 10 },
    meetingRoom: { x: 18, y: 10 },
  },
};

// ── Furniture Layout ────────────────────────────────────────

export function getOfficeFurniture(): FurnitureItem[] {
  return [
    // ── Meeting Room ──────────────────────────────────────
    // Meeting table
    {
      id: 'meeting-table',
      type: 'table',
      x: 8, y: 7,
      width: 14, height: 8,
      color: COLORS.tableWood,
      zIndex: 1,
    },
    // Meeting chairs (around table)
    { id: 'mchair-1', type: 'chair', x: 10, y: 5, width: 3, height: 3, color: COLORS.chairBlue },
    { id: 'mchair-2', type: 'chair', x: 17, y: 5, width: 3, height: 3, color: COLORS.chairBlue },
    { id: 'mchair-3', type: 'chair', x: 10, y: 14, width: 3, height: 3, color: COLORS.chairBlue },
    { id: 'mchair-4', type: 'chair', x: 17, y: 14, width: 3, height: 3, color: COLORS.chairBlue },
    // Whiteboard
    {
      id: 'whiteboard',
      type: 'whiteboard',
      x: 2, y: 2,
      width: 12, height: 3,
      color: COLORS.whiteboard,
    },

    // ── Kitchen / Break Area ──────────────────────────────
    // Coffee machine
    {
      id: 'coffee-machine',
      type: 'appliance',
      x: 40, y: 2,
      width: 4, height: 4,
      color: COLORS.coffeeMachine,
      label: '☕',
    },
    // Fridge
    {
      id: 'fridge',
      type: 'appliance',
      x: 46, y: 2,
      width: 4, height: 5,
      color: COLORS.fridge,
    },
    // Counter
    {
      id: 'counter',
      type: 'counter',
      x: 52, y: 2,
      width: 16, height: 3,
      color: COLORS.counterTop,
    },
    // Vending machine
    {
      id: 'vending',
      type: 'appliance',
      x: 60, y: 7,
      width: 5, height: 6,
      color: '#4050a0',
      label: '🧊',
    },
    // Kitchen plant
    {
      id: 'plant-kitchen',
      type: 'plant',
      x: 36, y: 14,
      width: 3, height: 4,
      color: COLORS.plantGreen,
    },

    // ── James's Desk Area ─────────────────────────────────
    // Desk
    {
      id: 'james-desk',
      type: 'desk',
      x: 8, y: 28,
      width: 14, height: 6,
      color: COLORS.deskWood,
      zIndex: 1,
    },
    // Monitor
    {
      id: 'james-monitor',
      type: 'monitor',
      x: 12, y: 27,
      width: 6, height: 4,
      color: COLORS.monitorFrame,
      zIndex: 2,
    },
    // Chair
    {
      id: 'james-chair',
      type: 'chair',
      x: 13, y: 33,
      width: 4, height: 3,
      color: COLORS.chairBlue,
    },
    // Clipboard/tablet on desk
    {
      id: 'james-tablet',
      type: 'prop',
      x: 9, y: 29,
      width: 2, height: 3,
      color: '#303030',
    },
    // Plant near James
    {
      id: 'plant-james',
      type: 'plant',
      x: 3, y: 35,
      width: 3, height: 4,
      color: COLORS.plantGreen,
    },

    // ── Markus's Desk Area (Developer Station) ────────────
    // L-shaped desk
    {
      id: 'markus-desk',
      type: 'desk',
      x: 48, y: 28,
      width: 18, height: 6,
      color: COLORS.deskWood,
      zIndex: 1,
    },
    // Dual monitors
    {
      id: 'markus-monitor-1',
      type: 'monitor',
      x: 51, y: 27,
      width: 5, height: 4,
      color: COLORS.monitorFrame,
      zIndex: 2,
    },
    {
      id: 'markus-monitor-2',
      type: 'monitor',
      x: 57, y: 27,
      width: 5, height: 4,
      color: COLORS.monitorFrame,
      zIndex: 2,
    },
    // Chair
    {
      id: 'markus-chair',
      type: 'chair',
      x: 53, y: 33,
      width: 4, height: 3,
      color: COLORS.chairGrey,
    },
    // Coffee mug on desk
    {
      id: 'markus-mug',
      type: 'prop',
      x: 63, y: 29,
      width: 2, height: 2,
      color: '#a04020',
    },
    // Headphones on desk
    {
      id: 'markus-headphones',
      type: 'prop',
      x: 49, y: 30,
      width: 2, height: 2,
      color: '#2a2a2a',
    },

    // ── Common Area / Decor ───────────────────────────────
    // Bookshelf
    {
      id: 'bookshelf',
      type: 'bookshelf',
      x: 32, y: 25,
      width: 8, height: 10,
      color: COLORS.bookshelfWood,
    },
    // Plants
    {
      id: 'plant-main',
      type: 'plant',
      x: 42, y: 38,
      width: 3, height: 4,
      color: COLORS.plantGreen,
    },
    // Wall art
    {
      id: 'wall-art-1',
      type: 'decoration',
      x: 28, y: 22,
      width: 4, height: 3,
      color: '#506090',
    },
    {
      id: 'wall-art-2',
      type: 'decoration',
      x: 60, y: 22,
      width: 4, height: 3,
      color: '#905050',
    },

    // ── Future Expansion Desks ────────────────────────────
    {
      id: 'future-desk-1',
      type: 'desk',
      x: 8, y: 42,
      width: 12, height: 5,
      color: '#a09080',
      label: 'Available',
    },
    {
      id: 'future-desk-2',
      type: 'desk',
      x: 50, y: 42,
      width: 12, height: 5,
      color: '#a09080',
      label: 'Available',
    },
  ];
}
