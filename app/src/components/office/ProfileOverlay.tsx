/**
 * Office Profile Overlay
 * 
 * Full-screen modal showing detailed agent profile when a character is clicked.
 * Phase 1: Basic info + current task. Phase 2 will add backlog and stats.
 */

import { useEffect, useCallback, useState } from 'react';
import type { CharacterState } from '../../lib/office/types';
import { getAuthHeader } from '../../stores/authStore';

interface ProfileOverlayProps {
  character: CharacterState | null;
  onClose: () => void;
}

interface AgentProfile {
  fullName: string;
  role: string;
  traits: string[];
  currentTask: {
    title: string;
    progress: number;
    startTime: string;
  };
  backlog: Array<{
    id: number;
    title: string;
    priority: 'high' | 'medium' | 'low';
    status: string;
  }>;
  stats: Record<string, number>;
}

const TRAIT_EMOJIS: Record<string, string> = {
  'Strategic thinker': '🧠',
  'Excellent delegator': '📋',
  'Clear communicator': '💬',
  'Always has a plan': '📐',
  'Analytical & methodical': '🔍',
  'Test-Driven Development advocate': '✅',
  'TypeScript enthusiast': '💙',
  'Coffee-powered ☕': '☕',
};

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-500/20 text-red-400 border-red-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low: 'bg-green-500/20 text-green-400 border-green-500/30',
};

export function ProfileOverlay({ character, onClose }: ProfileOverlayProps) {
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch profile when character changes
  useEffect(() => {
    if (!character) {
      setProfile(null);
      return;
    }

    setLoading(true);
    fetch(`/api/office/agent/${character.id}`, {
      headers: getAuthHeader(),
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to load profile');
        return res.json();
      })
      .then(data => {
        setProfile(data);
        setLoading(false);
      })
      .catch(() => {
        // Use character data as fallback
        setProfile({
          fullName: character.name,
          role: character.role,
          traits: [],
          currentTask: {
            title: character.currentTask,
            progress: 50,
            startTime: character.taskStartTime,
          },
          backlog: [],
          stats: {},
        });
        setLoading(false);
      });
  }, [character]);

  // ESC to close
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (character) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [character, handleKeyDown]);

  if (!character) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-gray-900 border-2 border-white/20 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}
      >
        {/* Header */}
        <div
          className="px-6 py-5 relative"
          style={{
            background: `linear-gradient(135deg, ${character.color}40, ${character.accentColor}20)`,
          }}
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors"
          >
            ✕
          </button>

          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-lg border-3 border-white/30 flex items-center justify-center text-2xl font-bold text-white"
              style={{ backgroundColor: character.color }}
            >
              {character.name[0]}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {profile?.fullName || character.name}
              </h2>
              <p className="text-sm text-white/60">{character.role}</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="px-6 py-8 text-center text-gray-500">
            <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin mx-auto mb-2" />
            Loading profile...
          </div>
        ) : profile ? (
          <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Traits */}
            {profile.traits.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                  Traits
                </h3>
                <div className="flex flex-wrap gap-2">
                  {profile.traits.map((trait, i) => (
                    <span
                      key={i}
                      className="text-xs bg-white/5 border border-white/10 rounded-full px-3 py-1 text-gray-300"
                    >
                      {TRAIT_EMOJIS[trait] ? `${TRAIT_EMOJIS[trait]} ` : ''}{trait}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Current Task */}
            <div>
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                Current Task
              </h3>
              <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                <div className="flex items-start gap-2 mb-2">
                  <span className="text-base">🔨</span>
                  <span className="text-sm text-white/90">
                    {profile.currentTask.title}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>Progress</span>
                    <span>{profile.currentTask.progress}%</span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${profile.currentTask.progress}%`,
                        backgroundColor: character.color,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Backlog */}
            {profile.backlog.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                  Task Backlog ({profile.backlog.length})
                </h3>
                <div className="space-y-1.5">
                  {profile.backlog.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-2 text-xs bg-white/5 rounded-md px-3 py-2"
                    >
                      <span className="text-gray-400">📋</span>
                      <span className="flex-1 text-gray-300 truncate">
                        {task.title}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] border ${
                          PRIORITY_COLORS[task.priority] || 'text-gray-400'
                        }`}
                      >
                        {task.priority}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stats */}
            {Object.keys(profile.stats).length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                  Statistics
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(profile.stats).map(([key, value]) => (
                    <div
                      key={key}
                      className="bg-white/5 rounded-md px-3 py-2 text-center"
                    >
                      <div className="text-lg font-bold text-white">{value}</div>
                      <div className="text-[10px] text-gray-500 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm bg-white/10 hover:bg-white/20 text-white rounded-md transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
