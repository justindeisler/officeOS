/**
 * Office Status API
 * 
 * Provides real-time status data for the pixel art office visualization.
 * Returns current agent states, positions, and interactions.
 */

import { Router } from "express";
import { validateBody } from "../middleware/validateBody.js";
import { UpdateAgentStatusSchema } from "../schemas/index.js";

const router = Router();

// ── Types ───────────────────────────────────────────────────

type AgentStatus = 'idle' | 'coding' | 'delegating' | 'thinking' | 'reviewing' | 'meeting' | 'break' | 'away';
type AgentLocation = 'desk' | 'dev_station' | 'kitchen' | 'meeting_room';
type AnimationState = 'idle' | 'typing' | 'working' | 'thinking' | 'coffee_break' | 'meeting' | 'away' | 'walking';
type SceneTime = 'morning' | 'day' | 'evening' | 'night';

interface AgentState {
  id: string;
  name: string;
  role: string;
  location: AgentLocation;
  status: AgentStatus;
  currentTask: string;
  animation: AnimationState;
  interactingWith: string | null;
  taskStartTime: string;
}

const statusToAnimation: Record<AgentStatus, AnimationState> = {
  idle: 'idle',
  coding: 'typing',
  delegating: 'working',
  thinking: 'thinking',
  reviewing: 'thinking',
  meeting: 'meeting',
  break: 'coffee_break',
  away: 'away',
};

// ── Scene Time Calculation ──────────────────────────────────

function getSceneTime(): SceneTime {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'day';
  if (hour >= 18 && hour < 22) return 'evening';
  return 'night';
}

// ── Agent State Management ──────────────────────────────────

// In-memory agent state (will be updated by Clawdbot integration later)
const agentStates: Map<string, AgentState> = new Map();

// Initialize default states
function getDefaultAgentStates(): AgentState[] {
  return [
    {
      id: 'james',
      name: 'James',
      role: 'Team Manager',
      location: 'desk',
      status: 'delegating',
      currentTask: 'Coordinating team tasks and priorities',
      animation: 'working',
      interactingWith: null,
      taskStartTime: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    },
    {
      id: 'markus',
      name: 'Markus',
      role: 'Senior Developer',
      location: 'dev_station',
      status: 'coding',
      currentTask: 'Building Office feature visualization',
      animation: 'typing',
      interactingWith: null,
      taskStartTime: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
    },
  ];
}

// Initialize on first load
function ensureInitialized() {
  if (agentStates.size === 0) {
    for (const agent of getDefaultAgentStates()) {
      agentStates.set(agent.id, agent);
    }
  }
}

// ── Routes ──────────────────────────────────────────────────

/**
 * GET /api/office/status
 * Returns current office state for all agents
 */
router.get("/status", (_req, res) => {
  ensureInitialized();

  const agents = Array.from(agentStates.values());
  const sceneTime = getSceneTime();

  // Detect interactions
  const interactions: Array<{
    type: string;
    participants: string[];
    location: string;
    topic: string;
    startTime: string;
    duration: number;
  }> = [];

  // Check for agent interactions
  for (const agent of agents) {
    if (agent.interactingWith) {
      const partner = agentStates.get(agent.interactingWith);
      if (partner) {
        // Avoid duplicate entries (only add once per pair)
        const alreadyAdded = interactions.some(
          (i) =>
            i.participants.includes(agent.id) &&
            i.participants.includes(partner.id)
        );
        if (!alreadyAdded) {
          interactions.push({
            type: "discussion",
            participants: [agent.id, partner.id],
            location: agent.location,
            topic: agent.currentTask,
            startTime: new Date().toISOString(),
            duration: 300,
          });
        }
      }
    }
  }

  // Determine overall activity
  const hasInteraction = interactions.length > 0;
  const anyOnBreak = agents.some((a) => a.status === "break");
  const activity = hasInteraction ? "meeting" : anyOnBreak ? "break" : "working";

  res.json({
    scene: {
      time: sceneTime,
      activity,
    },
    agents,
    interactions,
  });
});

/**
 * GET /api/office/agent/:id
 * Returns detailed profile for a specific agent
 */
router.get("/agent/:id", (req, res) => {
  ensureInitialized();

  const { id } = req.params;
  const agent = agentStates.get(id);

  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  // Extended profile data
  const profiles: Record<string, object> = {
    james: {
      ...agent,
      fullName: "James",
      avatar: "/assets/office/characters/james/avatar.png",
      traits: [
        "Strategic thinker",
        "Excellent delegator",
        "Clear communicator",
        "Always has a plan",
      ],
      currentTask: {
        id: 1,
        title: agent.currentTask,
        progress: 45,
        startTime: agent.taskStartTime,
        estimatedCompletion: new Date(
          Date.now() + 3600000 * 4
        ).toISOString(),
      },
      backlog: [
        { id: 2, title: "Review Markus's Office feature PR", priority: "high", status: "pending" },
        { id: 3, title: "Plan Q1 roadmap priorities", priority: "medium", status: "pending" },
        { id: 4, title: "Set up monitoring dashboards", priority: "low", status: "pending" },
      ],
      stats: {
        tasksCompleted: 47,
        tasksDelegated: 23,
        avgResponseTime: 1.2,
        uptime: 99.5,
      },
    },
    markus: {
      ...agent,
      fullName: "Markus",
      avatar: "/assets/office/characters/markus/avatar.png",
      traits: [
        "Analytical & methodical",
        "Test-Driven Development advocate",
        "TypeScript enthusiast",
        "Coffee-powered ☕",
      ],
      currentTask: {
        id: 5,
        title: agent.currentTask,
        progress: 30,
        startTime: agent.taskStartTime,
        estimatedCompletion: new Date(
          Date.now() + 3600000 * 24
        ).toISOString(),
      },
      backlog: [
        { id: 6, title: "Optimize database query performance", priority: "medium", status: "pending" },
        { id: 7, title: "Add dark mode support to dashboard", priority: "low", status: "pending" },
        { id: 8, title: "Implement WebSocket for real-time updates", priority: "medium", status: "pending" },
      ],
      stats: {
        tasksCompleted: 12,
        bugsIntroduced: 0,
        avgTestCoverage: 95,
        avgCompletionTime: 4.2,
      },
    },
  };

  const profile = profiles[id];
  if (!profile) {
    res.status(404).json({ error: "Agent profile not found" });
    return;
  }

  res.json(profile);
});

/**
 * PUT /api/office/agent/:id/status
 * Update an agent's status (called by Clawdbot gateway)
 */
router.put("/agent/:id/status", validateBody(UpdateAgentStatusSchema), (req, res) => {
  ensureInitialized();

  const { id } = req.params;
  const agent = agentStates.get(id);

  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  const { status, currentTask, location, interactingWith } = req.body;

  if (status) {
    agent.status = status;
    agent.animation = statusToAnimation[status as AgentStatus] || 'idle';
  }
  if (currentTask !== undefined) {
    agent.currentTask = currentTask;
    agent.taskStartTime = new Date().toISOString();
  }
  if (location) {
    agent.location = location;
  }
  if (interactingWith !== undefined) {
    agent.interactingWith = interactingWith;
  }

  agentStates.set(id, agent);
  res.json(agent);
});

export default router;
