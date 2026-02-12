/**
 * Office Hover Card
 * 
 * Tooltip that appears when hovering over a character in the office scene.
 * Shows agent name, role, current task, and time on task.
 */

import { useEffect, useState } from 'react';
import type { CharacterState } from '../../lib/office/types';

interface HoverCardProps {
  character: CharacterState | null;
  screenX: number;
  screenY: number;
}

const STATUS_LABELS: Record<string, string> = {
  coding: 'Coding',
  delegating: 'Delegating',
  thinking: 'Thinking',
  reviewing: 'Reviewing',
  meeting: 'In Meeting',
  break: 'On Break',
  idle: 'Idle',
  away: 'Away',
};

function getTimeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m ago`;
  
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function HoverCard({ character, screenX, screenY }: HoverCardProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (character) {
      // Delay showing to avoid flicker
      const timer = setTimeout(() => {
        setVisible(true);
        
        // Position card above the mouse, clamped to viewport
        const cardWidth = 240;
        const cardHeight = 140;
        
        let x = screenX - cardWidth / 2;
        let y = screenY - cardHeight - 20;
        
        // Clamp to viewport
        x = Math.max(8, Math.min(window.innerWidth - cardWidth - 8, x));
        y = Math.max(8, y);
        
        // If would go off top, show below instead
        if (y < 8) {
          y = screenY + 20;
        }
        
        setPosition({ x, y });
      }, 200);
      
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [character, screenX, screenY]);

  if (!character || !visible) return null;

  return (
    <div
      className="fixed z-50 pointer-events-none"
      style={{
        left: position.x,
        top: position.y,
        transition: 'opacity 150ms ease',
        opacity: visible ? 1 : 0,
      }}
    >
      <div className="bg-gray-900/95 text-white rounded-lg border-2 border-white/20 shadow-xl px-4 py-3 w-60"
           style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", imageRendering: 'pixelated' }}>
        {/* Agent Info */}
        <div className="flex items-center gap-3 mb-2">
          {/* Pixel avatar indicator */}
          <div
            className="w-8 h-8 rounded border-2 border-white/30 flex items-center justify-center text-sm font-bold"
            style={{ backgroundColor: character.color }}
          >
            {character.name[0]}
          </div>
          <div>
            <div className="font-bold text-sm">{character.name}</div>
            <div className="text-xs text-gray-400">{character.role}</div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-white/10 my-2" />

        {/* Current Task */}
        <div className="text-xs">
          <div className="text-gray-400 mb-1">Currently:</div>
          <div className="text-white/90 leading-tight line-clamp-2">
            {character.currentTask || 'No active task'}
          </div>
        </div>

        {/* Status & Time */}
        <div className="flex items-center justify-between mt-2 text-xs">
          <span className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${getStatusColor(character.status)}`} />
            <span className="text-gray-300">
              {STATUS_LABELS[character.status] || character.status}
            </span>
          </span>
          <span className="text-gray-500">
            ⏱ {getTimeAgo(character.taskStartTime)}
          </span>
        </div>
      </div>
    </div>
  );
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'coding':
    case 'typing':
      return 'bg-green-500';
    case 'delegating':
    case 'working':
      return 'bg-blue-500';
    case 'thinking':
    case 'reviewing':
      return 'bg-yellow-500';
    case 'meeting':
      return 'bg-purple-500';
    case 'break':
      return 'bg-orange-500';
    case 'away':
      return 'bg-gray-500';
    default:
      return 'bg-gray-400';
  }
}
