/**
 * Office Feature - Type Definitions
 * 
 * Types for the pixel art office visualization showing
 * the AI team (James & Markus) at work in real-time.
 */

// ── Agent Status ────────────────────────────────────────────
export type AgentStatus =
  | 'idle'
  | 'coding'
  | 'delegating'
  | 'thinking'
  | 'reviewing'
  | 'meeting'
  | 'break'
  | 'away';

export type AgentLocation =
  | 'desk'
  | 'dev_station'
  | 'kitchen'
  | 'meeting_room';

export type AnimationState =
  | 'idle'
  | 'typing'
  | 'working'
  | 'thinking'
  | 'coffee_break'
  | 'meeting'
  | 'away'
  | 'walking';

export type SceneTime = 'morning' | 'day' | 'evening' | 'night';
export type SceneActivity = 'working' | 'meeting' | 'break';

// ── API Response Types ──────────────────────────────────────

export interface OfficeAgent {
  id: string;
  name: string;
  role: string;
  location: AgentLocation;
  status: AgentStatus;
  currentTask: string;
  animation: AnimationState;
  interactingWith: string | null;
  taskStartTime: string; // ISO 8601
}

export interface OfficeInteraction {
  type: 'discussion' | 'code_review' | 'task_approval' | 'meeting';
  participants: string[];
  location: string;
  topic: string;
  startTime: string;
  duration: number; // seconds
}

export interface OfficeStatusResponse {
  scene: {
    time: SceneTime;
    activity: SceneActivity;
  };
  agents: OfficeAgent[];
  interactions: OfficeInteraction[];
}

// ── Hover Card ──────────────────────────────────────────────

export interface HoverCardData {
  id: string;
  name: string;
  role: string;
  avatar: string;
  currentTask: string;
  taskStartTime: string;
  status: AgentStatus;
}

// ── Scene Configuration ─────────────────────────────────────

export interface SceneConfig {
  width: number;
  height: number;
  scale: number;
  tileSize: number;
}

export interface CharacterPosition {
  x: number;
  y: number;
  direction: 'down' | 'left' | 'right' | 'up';
}

// ── Animation Mapping ───────────────────────────────────────

export const STATUS_TO_ANIMATION: Record<AgentStatus, AnimationState> = {
  idle: 'idle',
  coding: 'typing',
  delegating: 'working',
  thinking: 'thinking',
  reviewing: 'thinking',
  meeting: 'meeting',
  break: 'coffee_break',
  away: 'away',
};

// ── Sprite Sheet Config ─────────────────────────────────────

export interface SpriteSheetConfig {
  frameWidth: number;
  frameHeight: number;
  columns: number;
  rows: number;
  animations: Record<string, {
    row: number;
    frames: number;
    speed: number; // frames per second
  }>;
}

// Worker sprite sheets are 64x160, 4 columns x 10 rows, 16x16 frames
export const WORKER_SPRITE_CONFIG: SpriteSheetConfig = {
  frameWidth: 16,
  frameHeight: 16,
  columns: 4,
  rows: 10,
  animations: {
    'walk-down':  { row: 0, frames: 4, speed: 6 },
    'walk-left':  { row: 2, frames: 4, speed: 6 },
    'walk-right': { row: 4, frames: 4, speed: 6 },
    'walk-up':    { row: 6, frames: 4, speed: 6 },
    'idle':       { row: 0, frames: 2, speed: 2 },
    'typing':     { row: 8, frames: 4, speed: 4 },
    'thinking':   { row: 0, frames: 2, speed: 1 },
  },
};

// Computer sprite sheet is 80x160, 5 columns x 10 rows, 16x16 frames
export const COMPUTER_SPRITE_CONFIG: SpriteSheetConfig = {
  frameWidth: 16,
  frameHeight: 16,
  columns: 5,
  rows: 10,
  animations: {
    'on':  { row: 0, frames: 4, speed: 2 },
    'off': { row: 0, frames: 1, speed: 0 },
  },
};
