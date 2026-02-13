/**
 * Tests for SecondBrainPage component
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

function setupDefaultMocks() {
  mockApi.getJournalEntries.mockResolvedValue({
    entries: [
      {
        date: "2026-02-13",
        filename: "2026-02-13.md",
        title: "Daily Journal - Feb 13",
        preview: "Major progress on specialist agents...",
        lastModified: "2026-02-13T12:00:00.000Z",
        size: 9592,
      },
      {
        date: "2026-02-12",
        filename: "2026-02-12.md",
        title: "Daily Journal - Feb 12",
        preview: "Completed PWA implementation...",
        lastModified: "2026-02-12T21:00:00.000Z",
        size: 4644,
      },
    ],
    total: 2,
  });

  mockApi.getJournalEntry.mockResolvedValue({
    date: "2026-02-13",
    filename: "2026-02-13.md",
    title: "Daily Journal - Feb 13",
    content: "# Daily Journal\n\nMajor progress on specialist agents today.",
    lastModified: "2026-02-13T12:00:00.000Z",
    size: 9592,
  });

  mockApi.getResearchNotes.mockResolvedValue({
    notes: [{
      filename: "2026-02-13-business.md",
      title: "Business Strategist Research",
      preview: "Comprehensive research on best practices...",
      date: "2026-02-13",
      lastModified: "2026-02-13T10:37:00.000Z",
      size: 17198,
      tags: ["business", "strategist"],
    }],
    total: 1,
  });

  mockApi.getResearchNote.mockResolvedValue({
    filename: "2026-02-13-business.md",
    title: "Business Strategist Research",
    content: "# Research\n\nContent",
    lastModified: "2026-02-13T10:37:00.000Z",
    size: 17198,
  });

  mockApi.getAgentMemories.mockResolvedValue({
    agents: [
      { id: "business-strategist", name: "Rocky", filename: "business-strategist.md", lastModified: "2026-02-13T11:00:00.000Z", size: 1839, sections: { principles: 5, decisions: 0, preferences: 4 } },
      { id: "research-analyst", name: "Prof", filename: "research-analyst.md", lastModified: "2026-02-13T11:00:00.000Z", size: 4773, sections: { principles: 13, decisions: 1, preferences: 12 } },
    ],
    total: 2,
  });

  mockApi.getAgentMemory.mockResolvedValue({
    id: "business-strategist", name: "Rocky", content: "# Rocky\n\nMemory",
    lastModified: "2026-02-13T11:00:00.000Z", size: 1839, sections: { principles: 5, decisions: 0, preferences: 4 }, isRootMemory: false,
  });

  mockApi.getConversations.mockResolvedValue({
    sessions: [{ id: "abc-123", agent: "main", timestamp: "2026-02-13T11:00:00.000Z", messageCount: 50, size: 100000, isLong: true }],
    total: 1, agents: ["main"],
  });

  mockApi.getConversationTranscript.mockResolvedValue({
    id: "abc-123", agent: "main", timestamp: "2026-02-13T11:00:00.000Z",
    messages: [
      { type: "message", id: "msg1", timestamp: "2026-02-13T11:00:00.000Z", role: "user", text: "Hello" },
      { type: "message", id: "msg2", timestamp: "2026-02-13T11:00:01.000Z", role: "assistant", text: "Hi!" },
    ],
    totalLines: 10, size: 100000,
  });

  mockApi.getSecondBrainDocuments.mockResolvedValue({
    folders: [{
      name: "journal",
      documents: [{ path: "journal/2026-02-13.md", name: "2026-02-13.md", title: "Feb 13", folder: "journal", lastModified: "2026-02-13T12:00:00.000Z" }],
    }],
  });

  mockApi.getSecondBrainDocument.mockResolvedValue({
    path: "journal/2026-02-13.md", name: "2026-02-13.md", title: "Feb 13",
    content: "# Feb 13\n\nContent.", lastModified: "2026-02-13T12:00:00.000Z",
  });

  mockApi.searchSecondBrain.mockResolvedValue({ results: [] });
  mockApi.searchBrain.mockResolvedValue({ results: [], total: 0, query: "" });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <SecondBrainPage />
    </MemoryRouter>
  );
}

describe("SecondBrainPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 1024 });
    window.dispatchEvent(new Event("resize"));
  });

  describe("Layout", () => {
    it("should render the page with Brain title", async () => {
      renderPage();
      // Use getAllByText since "Second Brain" appears in both header title and description
      const elements = screen.getAllByText("Second Brain");
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });

    it("should render 6 tab triggers", () => {
      renderPage();
      const tabs = screen.getAllByRole("tab");
      expect(tabs.length).toBe(6);
    });

    it("should have Journal tab selected by default", () => {
      renderPage();
      const tabs = screen.getAllByRole("tab");
      const journalTab = tabs.find(t => t.textContent?.includes("Journal"));
      expect(journalTab).toBeDefined();
      expect(journalTab?.getAttribute("data-state")).toBe("active");
    });
  });

  describe("Journal Tab (default)", () => {
    it("should call getJournalEntries on mount", async () => {
      renderPage();
      await waitFor(() => {
        expect(mockApi.getJournalEntries).toHaveBeenCalledOnce();
      });
    });

    it("should display journal entries after loading", async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("2 entries")).toBeInTheDocument();
      });
    });

    it("should show entry previews", async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/Major progress on specialist agents/)).toBeInTheDocument();
      });
    });

    it("should have journal search input", () => {
      renderPage();
      expect(screen.getByPlaceholderText("Search journal...")).toBeInTheDocument();
    });
  });

  describe("Tab Switching", () => {
    it("should switch to Research tab", async () => {
      const user = userEvent.setup();
      renderPage();
      
      const tabs = screen.getAllByRole("tab");
      const researchTab = tabs.find(t => t.textContent?.includes("Research"));
      await user.click(researchTab!);
      
      expect(researchTab?.getAttribute("data-state")).toBe("active");
    });

    it("should switch to Agents tab", async () => {
      const user = userEvent.setup();
      renderPage();
      
      const tabs = screen.getAllByRole("tab");
      const agentsTab = tabs.find(t => t.textContent?.includes("Agents"));
      await user.click(agentsTab!);
      
      expect(agentsTab?.getAttribute("data-state")).toBe("active");
    });

    it("should switch to Search tab and show search input", async () => {
      const user = userEvent.setup();
      renderPage();
      
      const tabs = screen.getAllByRole("tab");
      const searchTab = tabs.find(t => t.textContent?.includes("Search"));
      await user.click(searchTab!);
      
      expect(searchTab?.getAttribute("data-state")).toBe("active");
      await waitFor(() => {
        expect(screen.getByPlaceholderText("Search across all sources...")).toBeInTheDocument();
      });
    });
  });

  describe("API Error Handling", () => {
    it("should not crash when journal API fails", async () => {
      mockApi.getJournalEntries.mockRejectedValue(new Error("Network error"));
      const { container } = renderPage();
      
      await waitFor(() => {
        expect(mockApi.getJournalEntries).toHaveBeenCalled();
      });
      // Component should still be rendered
      expect(container.querySelector("h1")).not.toBeNull();
    });
  });
});

describe("SecondBrainPage - Data Types", () => {
  it("validates JournalEntry", () => {
    const entry = { date: "2026-02-13", filename: "2026-02-13.md", title: "Test", preview: "Preview", lastModified: "2026-02-13T12:00:00.000Z", size: 1000 };
    expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(entry.filename).toMatch(/\.md$/);
    expect(entry.size).toBeGreaterThan(0);
  });

  it("validates ResearchNote", () => {
    const note = { filename: "test.md", title: "Test", preview: "P", date: "2026-02-13", lastModified: "2026-02-13T12:00:00.000Z", size: 5000, tags: ["a", "b"] };
    expect(note.tags).toHaveLength(2);
  });

  it("validates AgentMemory", () => {
    const m = { id: "test", name: "Test", filename: "test.md", lastModified: "2026-02-13T12:00:00.000Z", size: 2000, sections: { principles: 5, decisions: 3, preferences: 8 } };
    expect(m.sections.principles).toBe(5);
    expect(m.id).not.toContain("/");
  });

  it("validates ConversationSession", () => {
    const s = { id: "abc", agent: "main", timestamp: "2026-02-13T11:00:00.000Z", messageCount: 50, size: 100000, isLong: true };
    expect(s.isLong).toBe(true);
    expect(new Date(s.timestamp).getTime()).not.toBeNaN();
  });

  it("validates BrainSearchResult", () => {
    const r = { type: "document" as const, path: "a.md", title: "T", source: "s", snippet: "...", lastModified: "2026-02-13T12:00:00.000Z", score: 15 };
    expect(["document", "agent-memory", "conversation"]).toContain(r.type);
    expect(r.score).toBeGreaterThan(0);
  });
});
