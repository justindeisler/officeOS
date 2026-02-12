/**
 * Office Scene - Internal Types
 */

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FurnitureItem {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  label?: string;
  zIndex?: number;
}

export interface CharacterState {
  id: string;
  name: string;
  role: string;
  x: number;
  y: number;
  targetX?: number;
  targetY?: number;
  animation: string;
  baseAnimation: string;  // API-derived animation, restored after walking
  frame: number;
  frameTimer: number;
  direction: 'down' | 'left' | 'right' | 'up';
  currentTask: string;
  status: string;
  taskStartTime: string;
  color: string;        // Primary color for the character
  accentColor: string;  // Secondary color
  isHovered: boolean;
}

export interface SceneState {
  time: 'morning' | 'day' | 'evening' | 'night';
  characters: Map<string, CharacterState>;
  furniture: FurnitureItem[];
}
