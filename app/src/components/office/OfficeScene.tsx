/**
 * Office Scene Component
 * 
 * Main React wrapper for the pixel art office canvas.
 * Manages canvas lifecycle, API polling, and hover/click interactions.
 */

import { useRef, useEffect, useState, useCallback, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { SceneManager } from '../../lib/office/scene-manager';
import { HoverCard } from './HoverCard';
import { ProfileOverlay } from './ProfileOverlay';
import type { CharacterState } from '../../lib/office/types';
import type { OfficeStatusResponse } from '../../types/office';
import { getAuthHeader } from '../../stores/authStore';

const POLL_INTERVAL = 5000; // 5 seconds

export function OfficeScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SceneManager | null>(null);
  const [hoveredChar, setHoveredChar] = useState<CharacterState | null>(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const [selectedChar, setSelectedChar] = useState<CharacterState | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'error'>('connecting');
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [focusedCharIndex, setFocusedCharIndex] = useState(-1);

  // Character hover handler
  const handleHover = useCallback((char: CharacterState | null, screenX: number, screenY: number) => {
    setHoveredChar(char);
    setHoverPos({ x: screenX, y: screenY });
  }, []);

  // Character click handler
  const handleClick = useCallback((char: CharacterState) => {
    setSelectedChar(char);
  }, []);

  // Keyboard navigation for accessibility
  const handleKeyDown = useCallback((e: ReactKeyboardEvent<HTMLCanvasElement>) => {
    const scene = sceneRef.current;
    if (!scene) return;
    const chars = scene.getCharacters();
    if (chars.length === 0) return;

    if (e.key === 'Tab') {
      e.preventDefault();
      const next = e.shiftKey
        ? (focusedCharIndex <= 0 ? chars.length - 1 : focusedCharIndex - 1)
        : (focusedCharIndex + 1) % chars.length;
      setFocusedCharIndex(next);
      scene.setHoveredCharacter(chars[next].id);
      handleHover(chars[next], 0, 0);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (focusedCharIndex >= 0 && focusedCharIndex < chars.length) {
        setSelectedChar(chars[focusedCharIndex]);
      }
    } else if (e.key === 'Escape') {
      scene.setHoveredCharacter(null);
      setFocusedCharIndex(-1);
      handleHover(null, 0, 0);
    }
  }, [focusedCharIndex, handleHover]);

  // Initialize scene
  useEffect(() => {
    if (!canvasRef.current) return;

    const scene = new SceneManager({
      canvas: canvasRef.current,
      onCharacterHover: handleHover,
      onCharacterClick: handleClick,
    });

    sceneRef.current = scene;

    // Handle resize
    const handleResize = () => scene.resize();
    window.addEventListener('resize', handleResize);

    // Observe container resize
    const container = canvasRef.current.parentElement;
    let resizeObserver: ResizeObserver | null = null;
    if (container) {
      resizeObserver = new ResizeObserver(() => scene.resize());
      resizeObserver.observe(container);
    }

    return () => {
      scene.destroy();
      window.removeEventListener('resize', handleResize);
      resizeObserver?.disconnect();
    };
  }, [handleHover, handleClick]);

  // API polling
  useEffect(() => {
    let active = true;
    let previousTime = '';

    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/office/status', {
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        
        const data: OfficeStatusResponse = await res.json();
        
        if (active && sceneRef.current) {
          sceneRef.current.updateFromAPI(data);
          
          // Invalidate background cache if time changed
          if (data.scene.time !== previousTime) {
            sceneRef.current.invalidateBackground();
            previousTime = data.scene.time;
          }
          
          setConnectionStatus('connected');
          setLastUpdate(new Date().toLocaleTimeString());
        }
      } catch (err) {
        if (active) {
          setConnectionStatus('error');
          console.warn('[Office] Failed to fetch status:', err);
        }
      }
    };

    // Initial fetch
    fetchStatus();

    // Poll every 5 seconds
    const interval = setInterval(fetchStatus, POLL_INTERVAL);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900/80 border-b border-white/10 text-xs">
        <div className="flex items-center gap-2 text-gray-400">
          <span className={`w-2 h-2 rounded-full ${
            connectionStatus === 'connected' ? 'bg-green-500' :
            connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
            'bg-red-500'
          }`} />
          <span>
            {connectionStatus === 'connected' ? 'Live' :
             connectionStatus === 'connecting' ? 'Connecting...' :
             'Offline'}
          </span>
          {lastUpdate && (
            <span className="text-gray-600">• Updated {lastUpdate}</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-gray-500">
          <span>🏢 The Office</span>
          <span className="hidden sm:inline">• Hover for details • Click for profile</span>
        </div>
      </div>

      {/* Canvas Container */}
      <div className="flex-1 flex items-center justify-center bg-gray-950 overflow-hidden p-2 sm:p-4">
        <canvas
          ref={canvasRef}
          className="block rounded-lg shadow-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          style={{
            imageRendering: 'pixelated',
            maxWidth: '100%',
            maxHeight: '100%',
          }}
          tabIndex={0}
          role="img"
          aria-label="AI team office visualization. Tab to cycle through team members, Enter to view profile."
          onKeyDown={handleKeyDown}
        />
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 px-4 py-2 bg-gray-900/80 border-t border-white/10 text-xs text-gray-500 flex-wrap">
        <span className="flex items-center gap-1">💻 Coding</span>
        <span className="flex items-center gap-1">📋 Delegating</span>
        <span className="flex items-center gap-1">🤔 Thinking</span>
        <span className="flex items-center gap-1">☕ Break</span>
        <span className="flex items-center gap-1">🔍 Reviewing</span>
      </div>

      {/* Hover Card */}
      <HoverCard
        character={hoveredChar}
        screenX={hoverPos.x}
        screenY={hoverPos.y}
      />

      {/* Profile Overlay */}
      <ProfileOverlay
        character={selectedChar}
        onClose={() => setSelectedChar(null)}
      />
    </div>
  );
}
