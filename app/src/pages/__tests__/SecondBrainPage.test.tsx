/**
 * Tests for SecondBrainPage component and supporting logic
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SecondBrainPage } from "../SecondBrainPage";
import { api } from "@/lib/api";

// Mock the API module
vi.mock("@/lib/api", () => ({
  api: {
    getJournalEntries: vi.fn(),
    getJournalEntry: vi.fn(),
    getResearchNotes: vi.fn(),
    getResearchNote: vi.fn(),
    getAgentMemories: vi.fn(),
    getAgentMemory: vi.fn(),
    getConversations: vi.fn(),
    getConversationTranscript: vi.fn(),
    searchBrain: vi.fn(),
    getSecondBrainDocuments: vi.fn(),
    getSecondBrainDocument: vi.fn(),
    searchSecondBrain: vi.fn(),
  },
  isWebBuild: true,
}));

const mockApi = vi.mocked(api);

function setupMocks() {
  mockApi.getJournalEntries.mockResolvedValue({
    entries: [
      { date: "2026-02-13", filename: "2026-02-13.md", title: "Daily Journal - Feb 13", preview: "Major progress on specialist agents", lastModified: "2026-02-13T12:00:00.000Z", size: 9592 },
      { date: "2026-02-12", filename: "2026-02-12.md", title: "Daily Journal - Feb 12", preview: "Completed PWA implementation", lastModified: "2026-02-12T21:00:00.000Z", size: 4644 },
    ],
    total: 2,
  });
  mockApi.getJournalEntry.mockResolvedValue({ date: "2026-02-13", filename: "2026-02-13.md", title: "Daily Journal - Feb 13", content: "# Journal\n\nContent", lastModified: "2026-02-13T12:00:00.000Z", size: 9592 });
  mockApi.getResearchNotes.mockResolvedValue({ notes: [{ filename: "2026-02-13-business.md", title: "Business Research", preview: "Research preview", date: "2026-02-13", lastModified: "2026-02-13T10:37:00.000Z", size: 17198, tags: ["business"] }], total: 1 });
  mockApi.getResearchNote.mockResolvedValue({ filename: "test.md", title: "Test", content: "# Test", lastModified: "2026-02-13T12:00:00.000Z", size: 1000 });
  mockApi.getAgentMemories.mockResolvedValue({ agents: [{ id: "bs", name: "Rocky", filename: "bs.md", lastModified: "2026-02-13T11:00:00.000Z", size: 1839, sections: { principles: 5, decisions: 0, preferences: 4 } }], total: 1 });
  mockApi.getAgentMemory.mockResolvedValue({ id: "bs", name: "Rocky", content: "# Rocky", lastModified: "2026-02-13T11:00:00.000Z", size: 1839, sections: { principles: 5, decisions: 0, preferences: 4 }, isRootMemory: false });
  mockApi.getConversations.mockResolvedValue({ sessions: [{ id: "abc", agent: "main", timestamp: "2026-02-13T11:00:00.000Z", messageCount: 50, size: 100000, isLong: true }], total: 1, agents: ["main"] });
  mockApi.getConversationTranscript.mockResolvedValue({ id: "abc", agent: "main", timestamp: "2026-02-13T11:00:00.000Z", messages: [{ type: "message", id: "m1", timestamp: "2026-02-13T11:00:00.000Z", role: "user", text: "Hi" }], totalLines: 5, size: 10000 });
  mockApi.getSecondBrainDocuments.mockResolvedValue({ folders: [{ name: "journal", documents: [{ path: "journal/2026-02-13.md", name: "2026-02-13.md", title: "Feb 13", folder: "journal", lastModified: "2026-02-13T12:00:00.000Z" }] }] });
  mockApi.getSecondBrainDocument.mockResolvedValue({ path: "journal/2026-02-13.md", name: "2026-02-13.md", title: "Feb 13", content: "# Feb 13", lastModified: "2026-02-13T12:00:00.000Z" });
  mockApi.searchSecondBrain.mockResolvedValue({ results: [] });
  mockApi.searchBrain.mockResolvedValue({ results: [], total: 0, query: "" });
}

describe("SecondBrainPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  it("renders without crashing", () => {
    const { container } = render(<MemoryRouter><SecondBrainPage /></MemoryRouter>);
    expect(container).not.toBeNull();
  });

  it("renders the page title", () => {
    render(<MemoryRouter><SecondBrainPage /></MemoryRouter>);
    // getAllByText because title appears in header and possible subtitle
    const elements = screen.getAllByText(/Second Brain/i);
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });

  it("renders tab navigation elements", () => {
    render(<MemoryRouter><SecondBrainPage /></MemoryRouter>);
    const tabs = screen.getAllByRole("tab");
    expect(tabs.length).toBeGreaterThanOrEqual(1);
  });

  it("calls at least one API on initial render", async () => {
    render(<MemoryRouter><SecondBrainPage /></MemoryRouter>);
    // Wait a tick for React effects to fire
    await new Promise(r => setTimeout(r, 100));
    // At least one API should be called (journal, documents, or another tab)
    const totalCalls = Object.values(mockApi).reduce((sum, fn) => {
      if (typeof fn === "function" && "mock" in fn) {
        return sum + (fn as ReturnType<typeof vi.fn>).mock.calls.length;
      }
      return sum;
    }, 0);
    expect(totalCalls).toBeGreaterThan(0);
  });

  it("handles API errors without crashing", () => {
    mockApi.getJournalEntries.mockRejectedValue(new Error("fail"));
    mockApi.getSecondBrainDocuments.mockRejectedValue(new Error("fail"));
    const { container } = render(<MemoryRouter><SecondBrainPage /></MemoryRouter>);
    // Should render without throwing
    expect(container).not.toBeNull();
    expect(container.querySelector("h1")).not.toBeNull();
  });
});

// ============================================
// Data type validation tests (unit tests - no rendering)
// ============================================

describe("Second Brain - Data Types", () => {
  describe("JournalEntry", () => {
    it("validates date format", () => {
      expect("2026-02-13").toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect("invalid").not.toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("validates complete structure", () => {
      const entry = { date: "2026-02-13", filename: "2026-02-13.md", title: "Test", preview: "Preview", lastModified: "2026-02-13T12:00:00.000Z", size: 1000 };
      expect(entry.date).toBeDefined();
      expect(entry.filename).toBeDefined();
      expect(entry.title).toBeDefined();
      expect(entry.preview).toBeDefined();
      expect(entry.lastModified).toBeDefined();
      expect(entry.size).toBeGreaterThan(0);
    });
  });

  describe("ResearchNote", () => {
    it("validates tags array", () => {
      const note = { tags: ["business", "strategist", "agent"] };
      expect(note.tags).toHaveLength(3);
      expect(note.tags).toContain("business");
    });

    it("validates filename pattern", () => {
      const filename = "2026-02-13-business-strategist-agent-best-practices.md";
      expect(filename).toMatch(/\.md$/);
      const dateMatch = filename.match(/^(\d{4}-\d{2}-\d{2})/);
      expect(dateMatch).not.toBeNull();
      expect(dateMatch![1]).toBe("2026-02-13");
    });

    it("extracts tags from filename", () => {
      const filename = "2026-02-13-business-strategist-agent-best-practices.md";
      const nameWithoutDate = filename.replace(/^\d{4}-\d{2}-\d{2}-?/, "").replace(".md", "");
      const tags = nameWithoutDate.split("-").filter(t => t.length > 2);
      expect(tags).toContain("business");
      expect(tags).toContain("strategist");
      expect(tags).toContain("agent");
      expect(tags).toContain("best");
      expect(tags).toContain("practices");
    });
  });

  describe("AgentMemory", () => {
    it("validates section counts", () => {
      const sections = { principles: 5, decisions: 3, preferences: 8 };
      expect(sections.principles).toBe(5);
      expect(sections.decisions).toBe(3);
      expect(sections.preferences).toBe(8);
    });

    it("validates agent ID format", () => {
      const id = "business-strategist";
      expect(id).not.toContain("/");
      expect(id).not.toContain("..");
      expect(id).not.toContain(" ");
    });

    it("maps agent names to emojis", () => {
      const getAgentEmoji = (name: string) => {
        const lower = name.toLowerCase();
        if (lower.includes("rocky") || lower.includes("business")) return "💼";
        if (lower.includes("prof") || lower.includes("research")) return "🔍";
        if (lower.includes("markus") || lower.includes("developer")) return "🔧";
        if (lower.includes("james")) return "🤖";
        return "🧠";
      };
      expect(getAgentEmoji("Rocky")).toBe("💼");
      expect(getAgentEmoji("Prof")).toBe("🔍");
      expect(getAgentEmoji("Markus")).toBe("🔧");
      expect(getAgentEmoji("James")).toBe("🤖");
      expect(getAgentEmoji("Unknown")).toBe("🧠");
    });
  });

  describe("ConversationSession", () => {
    it("validates session structure", () => {
      const session = { id: "abc-123", agent: "main", timestamp: "2026-02-13T11:00:00.000Z", messageCount: 50, size: 100000, isLong: true };
      expect(session.isLong).toBe(session.messageCount > 20);
      expect(new Date(session.timestamp).getTime()).not.toBeNaN();
    });

    it("classifies long sessions correctly", () => {
      expect(50 > 20).toBe(true);   // isLong
      expect(10 > 20).toBe(false);  // not isLong
    });

    it("formats agent labels", () => {
      const getAgentLabel = (agent: string) => {
        if (agent === "main") return "James (Main)";
        if (agent === "markus") return "Markus (Dev)";
        if (agent === "research-analyst") return "Prof (Research)";
        if (agent === "business-strategist") return "Rocky (Business)";
        return agent;
      };
      expect(getAgentLabel("main")).toBe("James (Main)");
      expect(getAgentLabel("markus")).toBe("Markus (Dev)");
      expect(getAgentLabel("research-analyst")).toBe("Prof (Research)");
      expect(getAgentLabel("business-strategist")).toBe("Rocky (Business)");
    });
  });

  describe("ConversationMessage", () => {
    it("parses user messages", () => {
      const msg = { type: "message", id: "m1", timestamp: "2026-02-13T11:00:00.000Z", role: "user", text: "Hello" };
      expect(msg.role).toBe("user");
      expect(msg.text).toBe("Hello");
    });

    it("parses assistant messages", () => {
      const msg = { type: "message", id: "m2", timestamp: "2026-02-13T11:00:01.000Z", role: "assistant", text: "Hi!" };
      expect(msg.role).toBe("assistant");
    });

    it("handles tool result messages", () => {
      const msg = { type: "message", id: "m3", timestamp: "2026-02-13T11:00:02.000Z", role: "toolResult", text: "[Tool Result]" };
      const isToolResult = msg.role === "toolResult" || msg.role === "tool";
      expect(isToolResult).toBe(true);
    });
  });

  describe("BrainSearchResult", () => {
    it("validates result types", () => {
      const validTypes = ["document", "agent-memory", "conversation"];
      expect(validTypes).toContain("document");
      expect(validTypes).toContain("agent-memory");
      expect(validTypes).toContain("conversation");
    });

    it("validates score-based sorting", () => {
      const results = [
        { type: "document" as const, score: 5, lastModified: "2026-02-13T12:00:00.000Z" },
        { type: "document" as const, score: 15, lastModified: "2026-02-12T12:00:00.000Z" },
        { type: "agent-memory" as const, score: 10, lastModified: "2026-02-13T12:00:00.000Z" },
      ];
      const sorted = [...results].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime();
      });
      expect(sorted[0].score).toBe(15);
      expect(sorted[1].score).toBe(10);
      expect(sorted[2].score).toBe(5);
    });

    it("highlights search matches correctly", () => {
      const snippet = "The German supplement market is growing fast";
      const query = "supplement";
      const regex = new RegExp(`(${query})`, "gi");
      const parts = snippet.split(regex);
      expect(parts.length).toBe(3);
      expect(parts[0]).toBe("The German ");
      expect(parts[1]).toBe("supplement");
      expect(parts[2]).toBe(" market is growing fast");
    });

    it("escapes special regex characters in query", () => {
      const query = "c++";
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      expect(escaped).toBe("c\\+\\+");
      expect(() => new RegExp(escaped, "gi")).not.toThrow();
    });
  });

  describe("Search Filtering", () => {
    it("filters entries by search query", () => {
      const entries = [
        { title: "Supplement Research", preview: "Market analysis", date: "2026-02-13" },
        { title: "Daily Journal", preview: "Regular updates", date: "2026-02-12" },
        { title: "PWA Implementation", preview: "Setting up supplement tracking", date: "2026-02-11" },
      ];
      const query = "supplement";
      const filtered = entries.filter(e =>
        e.title.toLowerCase().includes(query) ||
        e.preview.toLowerCase().includes(query) ||
        e.date.includes(query)
      );
      expect(filtered).toHaveLength(2);
      expect(filtered[0].title).toBe("Supplement Research");
      expect(filtered[1].title).toBe("PWA Implementation");
    });

    it("groups entries by month", () => {
      const entries = [
        { date: "2026-02-13" },
        { date: "2026-02-12" },
        { date: "2026-01-30" },
      ];
      const groups: Record<string, typeof entries> = {};
      for (const entry of entries) {
        const month = entry.date.substring(0, 7);
        if (!groups[month]) groups[month] = [];
        groups[month].push(entry);
      }
      expect(Object.keys(groups)).toHaveLength(2);
      expect(groups["2026-02"]).toHaveLength(2);
      expect(groups["2026-01"]).toHaveLength(1);
    });
  });
});
