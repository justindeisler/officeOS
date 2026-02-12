/**
 * Office Scene Renderer
 * 
 * Pure canvas-based pixel art renderer for the office visualization.
 * Handles drawing the floor, walls, furniture, characters, and effects.
 * All rendering is done with crisp pixel art (no anti-aliasing).
 */

import type { CharacterState, FurnitureItem } from './types';
import { COLORS, TILE_SIZE } from './layout';

// ── Utility ─────────────────────────────────────────────────

function drawPixelRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  color: string,
  scale: number
) {
  ctx.fillStyle = color;
  ctx.fillRect(
    Math.round(x * TILE_SIZE * scale),
    Math.round(y * TILE_SIZE * scale),
    Math.round(w * TILE_SIZE * scale),
    Math.round(h * TILE_SIZE * scale)
  );
}

function drawPixelBorder(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  color: string,
  scale: number,
  lineWidth = 1
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth * scale;
  ctx.strokeRect(
    Math.round(x * TILE_SIZE * scale) + 0.5,
    Math.round(y * TILE_SIZE * scale) + 0.5,
    Math.round(w * TILE_SIZE * scale) - 1,
    Math.round(h * TILE_SIZE * scale) - 1
  );
}

// ── Floor Rendering ─────────────────────────────────────────

export function drawFloor(ctx: CanvasRenderingContext2D, scale: number) {
  // Base floor - checkerboard pattern
  for (let y = 0; y < 50; y++) {
    for (let x = 0; x < 75; x++) {
      const isLight = (x + y) % 2 === 0;
      
      // Different floor colors for different zones
      let baseColor: string;
      if (y < 20 && x < 30) {
        // Meeting room - carpet
        baseColor = isLight ? '#8a9a7a' : '#7a8a6a';
      } else if (y < 20 && x >= 30) {
        // Kitchen - tile floor
        baseColor = isLight ? '#d0d0d0' : '#c0c0c0';
      } else if (y >= 20 && y < 25) {
        // Hallway
        baseColor = isLight ? COLORS.floorLight : COLORS.floorDark;
      } else {
        // Work area - wood floor
        baseColor = isLight ? '#c0a878' : '#b09868';
      }
      
      drawPixelRect(ctx, x, y, 1, 1, baseColor, scale);
    }
  }
}

// ── Wall Rendering ──────────────────────────────────────────

export function drawWalls(ctx: CanvasRenderingContext2D, scale: number) {
  const s = TILE_SIZE * scale;
  
  // Top wall
  drawPixelRect(ctx, 0, 0, 75, 1.5, COLORS.wallTop, scale);
  drawPixelRect(ctx, 0, 1.5, 75, 0.5, COLORS.wallAccent, scale);
  
  // Left wall
  drawPixelRect(ctx, 0, 0, 1.5, 50, COLORS.wallSide, scale);
  
  // Right wall
  drawPixelRect(ctx, 73.5, 0, 1.5, 50, COLORS.wallSide, scale);
  
  // Meeting room / kitchen divider wall (partial)
  drawPixelRect(ctx, 29.5, 0, 1, 18, COLORS.divider, scale);
  
  // Horizontal wall separating rooms from work area (with gap for passage)
  drawPixelRect(ctx, 0, 19, 14, 1, COLORS.divider, scale);
  // Gap for door (14-18)
  drawPixelRect(ctx, 18, 19, 12, 1, COLORS.divider, scale);
  // Another gap (30-35) 
  drawPixelRect(ctx, 35, 19, 20, 1, COLORS.divider, scale);
  // Gap (55-60)
  drawPixelRect(ctx, 60, 19, 15, 1, COLORS.divider, scale);
  
  // Bottom wall
  drawPixelRect(ctx, 0, 48.5, 75, 1.5, COLORS.wallSide, scale);
  
  // Door indicators (lighter sections)
  drawPixelRect(ctx, 14, 19, 4, 1, '#d0c8b0', scale);
  drawPixelRect(ctx, 55, 19, 5, 1, '#d0c8b0', scale);
}

// ── Furniture Rendering ─────────────────────────────────────

export function drawFurniture(
  ctx: CanvasRenderingContext2D,
  furniture: FurnitureItem[],
  scale: number,
  time: string
) {
  // Sort by zIndex for proper layering
  const sorted = [...furniture].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
  
  for (const item of sorted) {
    switch (item.type) {
      case 'desk':
        drawDesk(ctx, item, scale);
        break;
      case 'monitor':
        drawMonitor(ctx, item, scale, time);
        break;
      case 'chair':
        drawChair(ctx, item, scale);
        break;
      case 'table':
        drawTable(ctx, item, scale);
        break;
      case 'plant':
        drawPlant(ctx, item, scale);
        break;
      case 'appliance':
        drawAppliance(ctx, item, scale);
        break;
      case 'counter':
        drawCounter(ctx, item, scale);
        break;
      case 'bookshelf':
        drawBookshelf(ctx, item, scale);
        break;
      case 'whiteboard':
        drawWhiteboard(ctx, item, scale);
        break;
      case 'decoration':
        drawDecoration(ctx, item, scale);
        break;
      case 'prop':
        drawProp(ctx, item, scale);
        break;
      default:
        // Fallback: simple colored rectangle
        drawPixelRect(ctx, item.x, item.y, item.width, item.height, item.color, scale);
    }
  }
}

function drawDesk(ctx: CanvasRenderingContext2D, item: FurnitureItem, scale: number) {
  // Desk surface
  drawPixelRect(ctx, item.x, item.y, item.width, item.height, item.color, scale);
  // Highlight on top edge
  drawPixelRect(ctx, item.x, item.y, item.width, 0.5, '#a08050', scale);
  // Shadow on bottom
  drawPixelRect(ctx, item.x, item.y + item.height - 0.5, item.width, 0.5, COLORS.deskDark, scale);
  // Desk legs (corners)
  drawPixelRect(ctx, item.x + 0.5, item.y + item.height, 1, 1, COLORS.deskDark, scale);
  drawPixelRect(ctx, item.x + item.width - 1.5, item.y + item.height, 1, 1, COLORS.deskDark, scale);
  
  // Label for future desks
  if (item.label) {
    const ts = TILE_SIZE * scale;
    const cx = (item.x + item.width / 2) * ts;
    const cy = (item.y + item.height / 2) * ts;
    ctx.fillStyle = '#807060';
    ctx.font = `${Math.round(8 * scale)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.label, cx, cy);
  }
}

function drawMonitor(ctx: CanvasRenderingContext2D, item: FurnitureItem, scale: number, time: string) {
  const s = TILE_SIZE * scale;
  
  // Monitor frame
  drawPixelRect(ctx, item.x, item.y, item.width, item.height - 1, COLORS.monitorFrame, scale);
  
  // Screen (with glow effect based on time)
  const screenPadding = 0.5;
  const isNight = time === 'night' || time === 'evening';
  const screenColor = isNight ? COLORS.monitorGlow : COLORS.monitorScreenOn;
  
  drawPixelRect(
    ctx,
    item.x + screenPadding,
    item.y + screenPadding,
    item.width - screenPadding * 2,
    item.height - 1 - screenPadding * 2,
    screenColor,
    scale
  );
  
  // Screen glare (small highlight)
  drawPixelRect(
    ctx,
    item.x + 1,
    item.y + 1,
    1.5,
    0.5,
    'rgba(255,255,255,0.3)',
    scale
  );
  
  // Monitor stand
  drawPixelRect(ctx, item.x + item.width / 2 - 0.75, item.y + item.height - 1, 1.5, 1, '#3a3a3a', scale);
  
  // Monitor base
  drawPixelRect(ctx, item.x + item.width / 2 - 1.5, item.y + item.height, 3, 0.5, '#3a3a3a', scale);
}

function drawChair(ctx: CanvasRenderingContext2D, item: FurnitureItem, scale: number) {
  // Chair seat (circle-ish)
  drawPixelRect(ctx, item.x, item.y, item.width, item.height, item.color, scale);
  // Chair back (darker)
  drawPixelRect(ctx, item.x + 0.5, item.y, item.width - 1, 1, 
    item.color === COLORS.chairBlue ? '#3a5f8f' : '#5a6a7a', scale);
  // Wheels (dark dots at bottom)
  const wheelColor = '#404040';
  drawPixelRect(ctx, item.x, item.y + item.height - 0.5, 0.5, 0.5, wheelColor, scale);
  drawPixelRect(ctx, item.x + item.width - 0.5, item.y + item.height - 0.5, 0.5, 0.5, wheelColor, scale);
}

function drawTable(ctx: CanvasRenderingContext2D, item: FurnitureItem, scale: number) {
  // Table surface
  drawPixelRect(ctx, item.x, item.y, item.width, item.height, item.color, scale);
  // Table edge highlight
  drawPixelRect(ctx, item.x, item.y, item.width, 0.5, '#9a7a5a', scale);
  // Table shadow
  drawPixelRect(ctx, item.x, item.y + item.height - 0.5, item.width, 0.5, '#5a3a1a', scale);
  // Table legs
  drawPixelRect(ctx, item.x + 1, item.y + item.height, 1, 1, '#5a3a1a', scale);
  drawPixelRect(ctx, item.x + item.width - 2, item.y + item.height, 1, 1, '#5a3a1a', scale);
}

function drawPlant(ctx: CanvasRenderingContext2D, item: FurnitureItem, scale: number) {
  // Pot
  drawPixelRect(ctx, item.x + 0.5, item.y + item.height - 2, item.width - 1, 2, COLORS.potBrown, scale);
  // Plant body
  drawPixelRect(ctx, item.x, item.y, item.width, item.height - 2, COLORS.plantGreen, scale);
  // Plant highlights
  drawPixelRect(ctx, item.x + 0.5, item.y + 0.5, 1, 1, '#5aaa4a', scale);
  drawPixelRect(ctx, item.x + item.width - 1.5, item.y + 1, 1, 1, '#5aaa4a', scale);
  // Darker leaves
  drawPixelRect(ctx, item.x + 1, item.y + 1, 1, 1, COLORS.plantDark, scale);
}

function drawAppliance(ctx: CanvasRenderingContext2D, item: FurnitureItem, scale: number) {
  const s = TILE_SIZE * scale;
  
  // Main body
  drawPixelRect(ctx, item.x, item.y, item.width, item.height, item.color, scale);
  // Top highlight
  drawPixelRect(ctx, item.x, item.y, item.width, 0.5, 
    adjustBrightness(item.color, 30), scale);
  // Border
  drawPixelBorder(ctx, item.x, item.y, item.width, item.height, 
    adjustBrightness(item.color, -30), scale);
  
  // Label emoji
  if (item.label) {
    const cx = (item.x + item.width / 2) * s;
    const cy = (item.y + item.height / 2) * s;
    ctx.font = `${Math.round(10 * scale)}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.label, cx, cy);
  }
}

function drawCounter(ctx: CanvasRenderingContext2D, item: FurnitureItem, scale: number) {
  // Counter top
  drawPixelRect(ctx, item.x, item.y, item.width, item.height, item.color, scale);
  // Counter front
  drawPixelRect(ctx, item.x, item.y + item.height, item.width, 1, COLORS.counterSide, scale);
  // Counter highlight
  drawPixelRect(ctx, item.x, item.y, item.width, 0.3, '#909090', scale);
}

function drawBookshelf(ctx: CanvasRenderingContext2D, item: FurnitureItem, scale: number) {
  // Shelf frame
  drawPixelRect(ctx, item.x, item.y, item.width, item.height, item.color, scale);
  // Shelf dividers (horizontal)
  const shelves = 4;
  const shelfH = item.height / shelves;
  for (let i = 1; i < shelves; i++) {
    drawPixelRect(ctx, item.x, item.y + shelfH * i, item.width, 0.3, '#5a3a1a', scale);
  }
  // Books (colored rectangles)
  const bookColors = ['#c04040', '#4060c0', '#40a040', '#c0a040', '#8040c0', '#c06040'];
  for (let shelf = 0; shelf < shelves; shelf++) {
    let bx = item.x + 0.5;
    const by = item.y + shelf * shelfH + 0.5;
    for (let b = 0; b < 4 + Math.floor(Math.random() * 3); b++) {
      const bw = 0.8 + Math.random() * 0.6;
      const bh = shelfH - 1;
      if (bx + bw > item.x + item.width - 0.5) break;
      drawPixelRect(ctx, bx, by, bw, bh, bookColors[b % bookColors.length], scale);
      bx += bw + 0.2;
    }
  }
}

function drawWhiteboard(ctx: CanvasRenderingContext2D, item: FurnitureItem, scale: number) {
  // Frame
  drawPixelRect(ctx, item.x, item.y, item.width, item.height, COLORS.whiteboardFrame, scale);
  // Board surface
  drawPixelRect(ctx, item.x + 0.3, item.y + 0.3, item.width - 0.6, item.height - 0.6, 
    COLORS.whiteboard, scale);
  // Some "writing" marks
  drawPixelRect(ctx, item.x + 1, item.y + 1, 3, 0.2, '#3060a0', scale);
  drawPixelRect(ctx, item.x + 1, item.y + 1.5, 4, 0.2, '#3060a0', scale);
  drawPixelRect(ctx, item.x + 6, item.y + 1, 2, 0.2, '#a03030', scale);
}

function drawDecoration(ctx: CanvasRenderingContext2D, item: FurnitureItem, scale: number) {
  // Frame
  drawPixelRect(ctx, item.x, item.y, item.width, item.height, '#404040', scale);
  // Canvas
  drawPixelRect(ctx, item.x + 0.3, item.y + 0.3, item.width - 0.6, item.height - 0.6, 
    item.color, scale);
}

function drawProp(ctx: CanvasRenderingContext2D, item: FurnitureItem, scale: number) {
  drawPixelRect(ctx, item.x, item.y, item.width, item.height, item.color, scale);
}

// ── Character Rendering ─────────────────────────────────────

export function drawCharacter(
  ctx: CanvasRenderingContext2D,
  char: CharacterState,
  scale: number,
  frameCount: number
) {
  const s = TILE_SIZE * scale;
  const cx = char.x * s;
  const cy = char.y * s;
  const size = 3 * s; // Character is 3 tiles wide/tall
  
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.ellipse(cx + size / 2, cy + size - s * 0.3, size * 0.4, size * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Body based on animation state
  const bobOffset = char.animation === 'typing' 
    ? Math.sin(frameCount * 0.15) * scale * 1.5 
    : char.animation === 'idle' 
      ? Math.sin(frameCount * 0.05) * scale * 0.5 
      : 0;
  
  const bodyY = cy + bobOffset;
  
  // Legs
  ctx.fillStyle = '#4a4a5a';
  drawPixelRect(ctx, char.x + 0.8, char.y + 2.2, 0.6, 0.8, '#4a4a5a', scale);
  drawPixelRect(ctx, char.x + 1.6, char.y + 2.2, 0.6, 0.8, '#4a4a5a', scale);
  
  // Body (torso)
  ctx.fillStyle = char.color;
  const bodyTop = bodyY + s * 0.8;
  ctx.fillRect(
    Math.round(cx + s * 0.5),
    Math.round(bodyTop),
    Math.round(s * 2),
    Math.round(s * 1.5)
  );
  
  // Collar / shirt detail
  ctx.fillStyle = char.accentColor;
  ctx.fillRect(
    Math.round(cx + s * 0.7),
    Math.round(bodyTop),
    Math.round(s * 1.6),
    Math.round(s * 0.3)
  );
  
  // Head
  ctx.fillStyle = COLORS.skin;
  ctx.fillRect(
    Math.round(cx + s * 0.7),
    Math.round(bodyY + s * 0.1),
    Math.round(s * 1.6),
    Math.round(s * 0.8)
  );
  
  // Hair
  ctx.fillStyle = char.id === 'james' ? '#3a2a1a' : '#5a4a3a';
  ctx.fillRect(
    Math.round(cx + s * 0.6),
    Math.round(bodyY),
    Math.round(s * 1.8),
    Math.round(s * 0.35)
  );
  
  // Eyes
  ctx.fillStyle = '#1a1a2a';
  const eyeY = bodyY + s * 0.45;
  ctx.fillRect(Math.round(cx + s * 0.95), Math.round(eyeY), Math.round(s * 0.25), Math.round(s * 0.2));
  ctx.fillRect(Math.round(cx + s * 1.8), Math.round(eyeY), Math.round(s * 0.25), Math.round(s * 0.2));
  
  // Blink animation (every ~120 frames)
  const blinkPhase = (frameCount + (char.id === 'markus' ? 60 : 0)) % 120;
  if (blinkPhase > 116) {
    ctx.fillStyle = COLORS.skin;
    ctx.fillRect(Math.round(cx + s * 0.95), Math.round(eyeY), Math.round(s * 0.25), Math.round(s * 0.2));
    ctx.fillRect(Math.round(cx + s * 1.8), Math.round(eyeY), Math.round(s * 0.25), Math.round(s * 0.2));
  }
  
  // Animation-specific details
  if (char.animation === 'typing') {
    // Arms forward (typing)
    ctx.fillStyle = char.color;
    const armBob = Math.sin(frameCount * 0.3) * scale;
    ctx.fillRect(
      Math.round(cx + s * 0.2),
      Math.round(bodyTop + s * 0.8 + armBob),
      Math.round(s * 0.5),
      Math.round(s * 0.4)
    );
    ctx.fillRect(
      Math.round(cx + s * 2.3),
      Math.round(bodyTop + s * 0.8 - armBob),
      Math.round(s * 0.5),
      Math.round(s * 0.4)
    );
    // Hands
    ctx.fillStyle = COLORS.skin;
    ctx.fillRect(
      Math.round(cx + s * 0.1),
      Math.round(bodyTop + s * 1.1 + armBob),
      Math.round(s * 0.35),
      Math.round(s * 0.25)
    );
    ctx.fillRect(
      Math.round(cx + s * 2.55),
      Math.round(bodyTop + s * 1.1 - armBob),
      Math.round(s * 0.35),
      Math.round(s * 0.25)
    );
  } else if (char.animation === 'thinking') {
    // Hand on chin
    ctx.fillStyle = char.color;
    ctx.fillRect(
      Math.round(cx + s * 2.1),
      Math.round(bodyTop + s * 0.2),
      Math.round(s * 0.5),
      Math.round(s * 0.8)
    );
    ctx.fillStyle = COLORS.skin;
    ctx.fillRect(
      Math.round(cx + s * 2.1),
      Math.round(bodyY + s * 0.6),
      Math.round(s * 0.3),
      Math.round(s * 0.25)
    );
    // Thought dots
    if (frameCount % 60 < 40) {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      const dotPhase = (frameCount % 60) / 40;
      ctx.beginPath();
      ctx.arc(cx + s * 2.8, bodyY - s * 0.2, s * 0.15, 0, Math.PI * 2);
      ctx.fill();
      if (dotPhase > 0.3) {
        ctx.beginPath();
        ctx.arc(cx + s * 3.1, bodyY - s * 0.6, s * 0.12, 0, Math.PI * 2);
        ctx.fill();
      }
      if (dotPhase > 0.6) {
        ctx.beginPath();
        ctx.arc(cx + s * 3.3, bodyY - s * 1.0, s * 0.1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (char.animation === 'working') {
    // Arms at sides, slightly forward
    ctx.fillStyle = char.color;
    ctx.fillRect(
      Math.round(cx + s * 0.1),
      Math.round(bodyTop + s * 0.4),
      Math.round(s * 0.4),
      Math.round(s * 0.8)
    );
    ctx.fillRect(
      Math.round(cx + s * 2.5),
      Math.round(bodyTop + s * 0.4),
      Math.round(s * 0.4),
      Math.round(s * 0.8)
    );
  } else {
    // Idle - arms at sides
    ctx.fillStyle = char.color;
    ctx.fillRect(
      Math.round(cx + s * 0.2),
      Math.round(bodyTop + s * 0.5),
      Math.round(s * 0.4),
      Math.round(s * 0.7)
    );
    ctx.fillRect(
      Math.round(cx + s * 2.4),
      Math.round(bodyTop + s * 0.5),
      Math.round(s * 0.4),
      Math.round(s * 0.7)
    );
  }
  
  // Markus: headphones
  if (char.id === 'markus' && (char.animation === 'typing' || char.animation === 'idle')) {
    ctx.fillStyle = '#2a2a2a';
    // Headband
    ctx.fillRect(Math.round(cx + s * 0.5), Math.round(bodyY - s * 0.05), Math.round(s * 2), Math.round(s * 0.15));
    // Ear cups
    ctx.fillRect(Math.round(cx + s * 0.4), Math.round(bodyY + s * 0.2), Math.round(s * 0.3), Math.round(s * 0.4));
    ctx.fillRect(Math.round(cx + s * 2.3), Math.round(bodyY + s * 0.2), Math.round(s * 0.3), Math.round(s * 0.4));
  }
  
  // James: small clipboard/tablet when working
  if (char.id === 'james' && char.animation === 'working') {
    ctx.fillStyle = '#e0e0e0';
    ctx.fillRect(
      Math.round(cx + s * 2.6),
      Math.round(bodyTop + s * 0.5),
      Math.round(s * 0.8),
      Math.round(s * 1.0)
    );
    ctx.fillStyle = '#a0a0a0';
    ctx.fillRect(
      Math.round(cx + s * 2.7),
      Math.round(bodyTop + s * 0.6),
      Math.round(s * 0.6),
      Math.round(s * 0.15)
    );
    ctx.fillRect(
      Math.round(cx + s * 2.7),
      Math.round(bodyTop + s * 0.85),
      Math.round(s * 0.6),
      Math.round(s * 0.15)
    );
  }
  
  // Status indicator bubble
  drawStatusBubble(ctx, char, scale, frameCount);
}

function drawStatusBubble(
  ctx: CanvasRenderingContext2D,
  char: CharacterState,
  scale: number,
  frameCount: number
) {
  const s = TILE_SIZE * scale;
  const bx = char.x * s + s * 1.5;
  const by = char.y * s - s * 1.2;
  
  // Only show for active statuses
  if (char.animation === 'away') return;
  
  const emoji = getStatusEmoji(char.status);
  if (!emoji) return;
  
  // Floating animation
  const floatOffset = Math.sin(frameCount * 0.08) * scale * 2;
  
  // Bubble background
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  const bubbleSize = s * 1.2;
  ctx.beginPath();
  ctx.roundRect(
    Math.round(bx - bubbleSize / 2),
    Math.round(by + floatOffset - bubbleSize / 2),
    Math.round(bubbleSize),
    Math.round(bubbleSize),
    scale * 3
  );
  ctx.fill();
  
  // Bubble border
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = scale;
  ctx.stroke();
  
  // Bubble tail
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.moveTo(bx - s * 0.15, by + floatOffset + bubbleSize / 2 - scale);
  ctx.lineTo(bx, by + floatOffset + bubbleSize / 2 + s * 0.3);
  ctx.lineTo(bx + s * 0.15, by + floatOffset + bubbleSize / 2 - scale);
  ctx.fill();
  
  // Emoji
  ctx.font = `${Math.round(9 * scale)}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#000';
  ctx.fillText(emoji, bx, by + floatOffset);
}

function getStatusEmoji(status: string): string | null {
  switch (status) {
    case 'coding': return '💻';
    case 'delegating': return '📋';
    case 'thinking': return '🤔';
    case 'reviewing': return '🔍';
    case 'meeting': return '🗣️';
    case 'break': return '☕';
    case 'idle': return null;
    case 'away': return null;
    default: return null;
  }
}

// ── Time Overlay ────────────────────────────────────────────

export function drawTimeOverlay(
  ctx: CanvasRenderingContext2D,
  time: string,
  scale: number,
  width: number,
  height: number
) {
  // Apply time-based color overlay
  let overlayColor: string;
  let overlayAlpha: number;
  
  switch (time) {
    case 'morning':
      overlayColor = '255, 220, 150';  // Warm morning light
      overlayAlpha = 0.08;
      break;
    case 'day':
      overlayColor = '255, 255, 255';  // Neutral
      overlayAlpha = 0;
      break;
    case 'evening':
      overlayColor = '255, 150, 80';   // Warm evening
      overlayAlpha = 0.12;
      break;
    case 'night':
      overlayColor = '30, 30, 80';     // Dark blue night
      overlayAlpha = 0.25;
      break;
    default:
      overlayAlpha = 0;
      overlayColor = '0,0,0';
  }
  
  if (overlayAlpha > 0) {
    ctx.fillStyle = `rgba(${overlayColor}, ${overlayAlpha})`;
    ctx.fillRect(0, 0, width, height);
  }
}

// ── Hover Highlight ─────────────────────────────────────────

export function drawHoverHighlight(
  ctx: CanvasRenderingContext2D,
  char: CharacterState,
  scale: number,
  frameCount: number
) {
  if (!char.isHovered) return;
  
  const s = TILE_SIZE * scale;
  const pulse = 0.5 + Math.sin(frameCount * 0.1) * 0.3;
  
  ctx.strokeStyle = `rgba(100, 180, 255, ${pulse})`;
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.roundRect(
    Math.round(char.x * s - s * 0.3),
    Math.round(char.y * s - s * 0.3),
    Math.round(s * 3.6),
    Math.round(s * 3.6),
    scale * 4
  );
  ctx.stroke();
  
  // Name label above character
  const nameX = char.x * s + s * 1.5;
  const nameY = char.y * s - s * 2.2;
  
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  const nameWidth = ctx.measureText(char.name).width + s * 0.8;
  ctx.beginPath();
  ctx.roundRect(
    Math.round(nameX - nameWidth / 2),
    Math.round(nameY - s * 0.4),
    Math.round(nameWidth),
    Math.round(s * 0.9),
    scale * 3
  );
  ctx.fill();
  
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.round(8 * scale)}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(char.name, nameX, nameY);
}

// ── Utilities ───────────────────────────────────────────────

function adjustBrightness(hex: string, amount: number): string {
  const r = Math.min(255, Math.max(0, parseInt(hex.slice(1, 3), 16) + amount));
  const g = Math.min(255, Math.max(0, parseInt(hex.slice(3, 5), 16) + amount));
  const b = Math.min(255, Math.max(0, parseInt(hex.slice(5, 7), 16) + amount));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
