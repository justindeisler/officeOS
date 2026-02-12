/**
 * Office Scene Manager
 * 
 * Manages the office scene lifecycle: initialization, animation loop,
 * mouse interaction, and state updates from the API.
 */

import type { CharacterState, FurnitureItem } from './types';
import type { OfficeStatusResponse, OfficeAgent, AnimationState } from '../../types/office';
import { STATUS_TO_ANIMATION } from '../../types/office';
import { 
  TILE_SIZE, SCENE_WIDTH, SCENE_HEIGHT, COLORS,
  CHARACTER_POSITIONS, getOfficeFurniture 
} from './layout';
import {
  drawFloor, drawWalls, drawFurniture,
  drawCharacter, drawTimeOverlay, drawHoverHighlight
} from './renderer';

// ── Scene Manager ───────────────────────────────────────────

export interface SceneManagerOptions {
  canvas: HTMLCanvasElement;
  onCharacterHover: (char: CharacterState | null, screenX: number, screenY: number) => void;
  onCharacterClick: (char: CharacterState) => void;
}

export class SceneManager {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animationId: number | null = null;
  private frameCount = 0;
  private scale = 1;
  private furniture: FurnitureItem[];
  private characters: Map<string, CharacterState> = new Map();
  private sceneTime: string = 'day';
  private hoveredCharId: string | null = null;
  private onCharacterHover: SceneManagerOptions['onCharacterHover'];
  private onCharacterClick: SceneManagerOptions['onCharacterClick'];
  private isDestroyed = false;
  private prefersReducedMotion = false;
  
  // Pre-rendered background (only redraws when scale changes)
  private bgCanvas: HTMLCanvasElement | null = null;
  private bgScale = 0;
  private bookshelfSeed: number;

  constructor(options: SceneManagerOptions) {
    this.canvas = options.canvas;
    this.ctx = this.canvas.getContext('2d')!;
    this.onCharacterHover = options.onCharacterHover;
    this.onCharacterClick = options.onCharacterClick;
    this.furniture = getOfficeFurniture();
    this.bookshelfSeed = Math.random();
    this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    // Initialize default characters
    this.initCharacters();
    
    // Set up event listeners
    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    this.canvas.addEventListener('click', this.handleClick);
    this.canvas.addEventListener('touchstart', this.handleTouch, { passive: false });
    
    // Start render loop
    this.resize();
    this.startLoop();
  }

  // ── Character Initialization ──────────────────────────────

  private initCharacters() {
    const james: CharacterState = {
      id: 'james',
      name: 'James',
      role: 'Team Manager',
      x: CHARACTER_POSITIONS.james.desk.x,
      y: CHARACTER_POSITIONS.james.desk.y,
      animation: 'working',
      baseAnimation: 'working',
      frame: 0,
      frameTimer: 0,
      direction: 'down',
      currentTask: 'Coordinating team tasks',
      status: 'delegating',
      taskStartTime: new Date(Date.now() - 3600000).toISOString(),
      color: COLORS.jamesPrimary,
      accentColor: COLORS.jamesAccent,
      isHovered: false,
    };

    const markus: CharacterState = {
      id: 'markus',
      name: 'Markus',
      role: 'Senior Developer',
      x: CHARACTER_POSITIONS.markus.desk.x,
      y: CHARACTER_POSITIONS.markus.desk.y,
      animation: 'typing',
      baseAnimation: 'typing',
      frame: 0,
      frameTimer: 0,
      direction: 'down',
      currentTask: 'Building Office feature',
      status: 'coding',
      taskStartTime: new Date(Date.now() - 7200000).toISOString(),
      color: COLORS.markusPrimary,
      accentColor: COLORS.markusAccent,
      isHovered: false,
    };

    this.characters.set('james', james);
    this.characters.set('markus', markus);
  }

  // ── API State Updates ─────────────────────────────────────

  updateFromAPI(data: OfficeStatusResponse) {
    this.sceneTime = data.scene.time;

    for (const agentData of data.agents) {
      const char = this.characters.get(agentData.id);
      if (!char) continue;

      // Update animation state
      const newAnim = STATUS_TO_ANIMATION[agentData.status] || 'idle';
      char.baseAnimation = newAnim;
      // Only set animation directly if not currently walking
      if (char.animation !== 'walking') {
        char.animation = newAnim;
      }
      char.status = agentData.status;
      char.currentTask = agentData.currentTask;
      char.taskStartTime = agentData.taskStartTime;

      // Update position based on location
      const positions = CHARACTER_POSITIONS[agentData.id as keyof typeof CHARACTER_POSITIONS];
      if (positions) {
        const locationKey = agentData.location === 'dev_station' ? 'desk' : agentData.location;
        const pos = positions[locationKey as keyof typeof positions];
        if (pos) {
          // Smooth movement (set target, interpolate in render loop)
          char.targetX = pos.x;
          char.targetY = pos.y;
        }
      }
    }
  }

  // ── Resize ────────────────────────────────────────────────

  resize() {
    const container = this.canvas.parentElement;
    if (!container) return;

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight || 600;

    // Calculate scale to fit container while maintaining aspect ratio
    const scaleX = containerWidth / SCENE_WIDTH;
    const scaleY = containerHeight / SCENE_HEIGHT;
    this.scale = Math.min(scaleX, scaleY, 2); // Cap at 2x

    // Set canvas size
    const canvasWidth = Math.round(SCENE_WIDTH * this.scale);
    const canvasHeight = Math.round(SCENE_HEIGHT * this.scale);
    
    // Only resize if dimensions changed
    if (this.canvas.width !== canvasWidth || this.canvas.height !== canvasHeight) {
      this.canvas.width = canvasWidth;
      this.canvas.height = canvasHeight;
      this.canvas.style.width = `${canvasWidth}px`;
      this.canvas.style.height = `${canvasHeight}px`;
    }

    // Disable image smoothing for crisp pixel art
    this.ctx.imageSmoothingEnabled = false;
  }

  // ── Render Loop ───────────────────────────────────────────

  private startLoop() {
    const loop = () => {
      if (this.isDestroyed) return;
      this.update();
      this.render();
      this.frameCount++;
      this.animationId = requestAnimationFrame(loop);
    };
    this.animationId = requestAnimationFrame(loop);
  }

  private update() {
    // Skip non-essential animations for reduced motion preference
    if (this.prefersReducedMotion) {
      // Still update positions instantly (teleport) so state is correct
      for (const char of this.characters.values()) {
        if (char.targetX !== undefined && char.targetY !== undefined) {
          char.x = char.targetX;
          char.y = char.targetY;
          char.targetX = undefined;
          char.targetY = undefined;
          char.animation = char.baseAnimation;
        }
      }
      return;
    }

    // Interpolate character positions towards targets
    for (const char of this.characters.values()) {
      if (char.targetX !== undefined && char.targetY !== undefined) {
        const dx = char.targetX - char.x;
        const dy = char.targetY - char.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > 0.1) {
          const speed = 0.1; // tiles per frame
          char.x += (dx / dist) * Math.min(speed, dist);
          char.y += (dy / dist) * Math.min(speed, dist);
          char.animation = 'walking';
          
          // Set direction based on movement
          if (Math.abs(dx) > Math.abs(dy)) {
            char.direction = dx > 0 ? 'right' : 'left';
          } else {
            char.direction = dy > 0 ? 'down' : 'up';
          }
        } else {
          char.x = char.targetX;
          char.y = char.targetY;
          char.targetX = undefined;
          char.targetY = undefined;
          // Restore API-derived animation after walking completes
          char.animation = char.baseAnimation;
        }
      }
      
      // Update animation frame
      char.frameTimer++;
      const frameRate = char.animation === 'typing' ? 8 : 
                        char.animation === 'walking' ? 6 : 20;
      if (char.frameTimer >= frameRate) {
        char.frame = (char.frame + 1) % 4;
        char.frameTimer = 0;
      }
    }
  }

  private render() {
    const { ctx, scale } = this;
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Disable smoothing each frame (some browsers reset it)
    ctx.imageSmoothingEnabled = false;

    // Draw background (cached)
    this.drawBackground();

    // Draw characters (sorted by Y for depth)
    const sortedChars = Array.from(this.characters.values())
      .sort((a, b) => a.y - b.y);

    for (const char of sortedChars) {
      drawCharacter(ctx, char, scale, this.frameCount);
      drawHoverHighlight(ctx, char, scale, this.frameCount);
    }

    // Time overlay
    drawTimeOverlay(ctx, this.sceneTime, scale, width, height);
  }

  private drawBackground() {
    // Cache the background rendering (floor, walls, furniture)
    // Only re-render when scale changes
    if (!this.bgCanvas || this.bgScale !== this.scale) {
      this.bgCanvas = document.createElement('canvas');
      this.bgCanvas.width = this.canvas.width;
      this.bgCanvas.height = this.canvas.height;
      const bgCtx = this.bgCanvas.getContext('2d')!;
      bgCtx.imageSmoothingEnabled = false;

      // Seed random for consistent bookshelf
      const origRandom = Math.random;
      let seed = this.bookshelfSeed;
      Math.random = () => {
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
      };

      drawFloor(bgCtx, this.scale);
      drawWalls(bgCtx, this.scale);
      drawFurniture(bgCtx, this.furniture, this.scale, this.sceneTime);

      Math.random = origRandom;
      this.bgScale = this.scale;
    }

    this.ctx.drawImage(this.bgCanvas, 0, 0);
  }

  // Invalidate background cache (e.g., when time changes)
  invalidateBackground() {
    this.bgScale = 0;
  }

  // ── Mouse/Touch Interaction ───────────────────────────────

  private getCanvasPos(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / this.scale / TILE_SIZE,
      y: (clientY - rect.top) / this.scale / TILE_SIZE,
    };
  }

  private findCharacterAt(tileX: number, tileY: number): CharacterState | null {
    const hitSize = 3; // Character hitbox in tiles
    for (const char of this.characters.values()) {
      if (
        tileX >= char.x - 0.5 &&
        tileX <= char.x + hitSize + 0.5 &&
        tileY >= char.y - 0.5 &&
        tileY <= char.y + hitSize + 0.5
      ) {
        return char;
      }
    }
    return null;
  }

  private handleMouseMove = (e: MouseEvent) => {
    const pos = this.getCanvasPos(e.clientX, e.clientY);
    const char = this.findCharacterAt(pos.x, pos.y);

    // Update hover states
    for (const c of this.characters.values()) {
      c.isHovered = char?.id === c.id;
    }

    const newHoveredId = char?.id || null;
    if (newHoveredId !== this.hoveredCharId) {
      this.hoveredCharId = newHoveredId;
      
      // Get screen coordinates for hover card positioning
      const rect = this.canvas.getBoundingClientRect();
      const screenX = e.clientX;
      const screenY = e.clientY;
      
      this.onCharacterHover(char, screenX, screenY);
    }

    // Update cursor
    this.canvas.style.cursor = char ? 'pointer' : 'default';
  };

  private handleClick = (e: MouseEvent) => {
    const pos = this.getCanvasPos(e.clientX, e.clientY);
    const char = this.findCharacterAt(pos.x, pos.y);
    if (char) {
      this.onCharacterClick(char);
    }
  };

  private handleTouch = (e: TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const pos = this.getCanvasPos(touch.clientX, touch.clientY);
    const char = this.findCharacterAt(pos.x, pos.y);
    if (char) {
      e.preventDefault();
      this.onCharacterClick(char);
    }
  };

  // ── Public Accessors ───────────────────────────────────────

  getCharacters(): CharacterState[] {
    return Array.from(this.characters.values());
  }

  getCharacterById(id: string): CharacterState | null {
    return this.characters.get(id) || null;
  }

  setHoveredCharacter(id: string | null) {
    for (const c of this.characters.values()) {
      c.isHovered = c.id === id;
    }
    this.hoveredCharId = id;
  }

  // ── Cleanup ───────────────────────────────────────────────

  destroy() {
    this.isDestroyed = true;
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('click', this.handleClick);
    this.canvas.removeEventListener('touchstart', this.handleTouch);
  }
}
