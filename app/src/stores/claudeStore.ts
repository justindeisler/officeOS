import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { toast } from "sonner";

// Lazy-loaded Tauri API functions to avoid blocking React mount
let invokeFunc: typeof import("@tauri-apps/api/core").invoke | null = null;
let listenFunc: typeof import("@tauri-apps/api/event").listen | null = null;

async function getTauriApi() {
  if (!invokeFunc || !listenFunc) {
    const [coreModule, eventModule] = await Promise.all([
      import("@tauri-apps/api/core"),
      import("@tauri-apps/api/event"),
    ]);
    invokeFunc = coreModule.invoke;
    listenFunc = eventModule.listen;
  }
  return { invoke: invokeFunc, listen: listenFunc };
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

export interface SessionState {
  status: "inactive" | "starting" | "active" | "stopping" | "error";
  session_id: string | null;
  error: string | null;
}

export interface ConversationInfo {
  id: string;
  title: string | null;
  preview: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
}

interface ClaudeState {
  // Panel state
  isOpen: boolean;
  width: number;
  minWidth: number;
  maxWidth: number;

  // Session state
  sessionState: SessionState;
  messages: Message[];
  isStreaming: boolean;

  // Conversation history
  conversations: ConversationInfo[];
  currentConversationId: string | null;

  // CLI status
  cliAvailable: boolean;
  isAuthenticated: boolean;

  // Actions
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;
  setWidth: (width: number) => void;

  // Session actions
  startSession: (resumeId?: string) => Promise<void>;
  stopSession: () => Promise<void>;
  sendMessage: (message: string) => Promise<void>;
  checkStatus: () => Promise<void>;

  // Conversation actions
  loadConversations: () => Promise<void>;
  selectConversation: (id: string) => void;
  startNewConversation: () => void;

  // Message actions
  addMessage: (message: Omit<Message, "id" | "timestamp">) => void;
  updateLastMessage: (content: string) => void;
  clearMessages: () => void;

  // Event handling
  setupEventListeners: () => Promise<UnlistenFn[]>;
}

const DEFAULT_WIDTH = 360;
const MIN_WIDTH = 300;
const MAX_WIDTH = 480;

export const useClaudeStore = create<ClaudeState>()(
  persist(
    (set, get) => ({
      // Initial state
      isOpen: false,
      width: DEFAULT_WIDTH,
      minWidth: MIN_WIDTH,
      maxWidth: MAX_WIDTH,

      sessionState: {
        status: "inactive",
        session_id: null,
        error: null,
      },
      messages: [],
      isStreaming: false,

      conversations: [],
      currentConversationId: null,

      cliAvailable: false,
      isAuthenticated: false,

      // Panel actions
      togglePanel: () => set((state) => ({ isOpen: !state.isOpen })),
      openPanel: () => set({ isOpen: true }),
      closePanel: () => set({ isOpen: false }),
      setWidth: (width) => {
        const clampedWidth = Math.min(Math.max(width, MIN_WIDTH), MAX_WIDTH);
        set({ width: clampedWidth });
      },

      // Session actions
      startSession: async (resumeId?: string) => {
        try {
          set({
            sessionState: { status: "starting", session_id: null, error: null },
          });

          const { invoke } = await getTauriApi();
          const sessionId = await invoke<string>("claude_start_session", {
            resumeId,
          });

          set({
            sessionState: { status: "active", session_id: sessionId, error: null },
            currentConversationId: sessionId,
          });

          // Add system message
          get().addMessage({
            role: "system",
            content: "Session started. How can I help you with your tasks?",
          });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          set({
            sessionState: { status: "error", session_id: null, error: errorMsg },
          });
          toast.error(`Failed to start session: ${errorMsg}`);
        }
      },

      stopSession: async () => {
        try {
          set({
            sessionState: { ...get().sessionState, status: "stopping" },
          });

          const { invoke } = await getTauriApi();
          await invoke("claude_stop_session");

          set({
            sessionState: { status: "inactive", session_id: null, error: null },
            isStreaming: false,
          });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          toast.error(`Failed to stop session: ${errorMsg}`);
        }
      },

      sendMessage: async (message: string) => {
        if (!message.trim()) return;

        const { sessionState, startSession, addMessage } = get();

        // Start session if not active
        if (sessionState.status !== "active") {
          await startSession();
        }

        // Add user message
        addMessage({ role: "user", content: message });

        try {
          set({ isStreaming: true });

          // Add placeholder for assistant response
          addMessage({ role: "assistant", content: "", isStreaming: true });

          const { invoke } = await getTauriApi();
          await invoke("claude_send_message", { message });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          toast.error(`Failed to send message: ${errorMsg}`);
          set({ isStreaming: false });
        }
      },

      checkStatus: async () => {
        try {
          const { invoke } = await getTauriApi();
          const status = await invoke<{
            cli_available: boolean;
            authenticated: boolean;
            session_state: SessionState;
          }>("claude_check_status");

          set({
            cliAvailable: status.cli_available,
            isAuthenticated: status.authenticated,
            sessionState: status.session_state,
          });
        } catch (error) {
          console.error("Failed to check Claude status:", error);
        }
      },

      // Conversation actions
      loadConversations: async () => {
        try {
          const { invoke } = await getTauriApi();
          const conversations = await invoke<ConversationInfo[]>(
            "claude_list_conversations"
          );
          set({ conversations });
        } catch (error) {
          console.error("Failed to load conversations:", error);
        }
      },

      selectConversation: (id: string) => {
        const conversation = get().conversations.find((c) => c.id === id);
        if (conversation) {
          set({ currentConversationId: id });
          get().clearMessages();
          get().startSession(id);
        }
      },

      startNewConversation: () => {
        get().clearMessages();
        get().stopSession();
        set({ currentConversationId: null });
      },

      // Message actions
      addMessage: (message) => {
        const newMessage: Message = {
          ...message,
          id: crypto.randomUUID(),
          timestamp: new Date(),
        };
        set((state) => ({ messages: [...state.messages, newMessage] }));
      },

      updateLastMessage: (content) => {
        set((state) => {
          const messages = [...state.messages];
          const lastIndex = messages.length - 1;
          if (lastIndex >= 0 && messages[lastIndex].role === "assistant") {
            messages[lastIndex] = {
              ...messages[lastIndex],
              content: messages[lastIndex].content + content,
            };
          }
          return { messages };
        });
      },

      clearMessages: () => set({ messages: [] }),

      // Event handling
      setupEventListeners: async () => {
        const { listen } = await getTauriApi();
        const unlisteners: UnlistenFn[] = [];

        // Listen for Claude output (streaming text and completion signal)
        const outputUnlisten = await listen<{
          content: string;
          is_complete: boolean;
          session_id: string;
        }>("claude:output", (event) => {
          const { content, is_complete } = event.payload;

          if (is_complete) {
            // Message complete - mark streaming as finished
            const messages = get().messages;
            const lastIndex = messages.length - 1;
            if (lastIndex >= 0 && messages[lastIndex].isStreaming) {
              set((state) => {
                const msgs = [...state.messages];
                msgs[lastIndex] = { ...msgs[lastIndex], isStreaming: false };
                return { messages: msgs, isStreaming: false };
              });
            } else {
              set({ isStreaming: false });
            }
          } else if (content) {
            // Streaming content - append to last message
            get().updateLastMessage(content);
          }
        });
        unlisteners.push(outputUnlisten);

        // Listen for errors from Claude
        const errorUnlisten = await listen<string>("claude:error", (event) => {
          const errorMsg = event.payload;
          toast.error(`Claude error: ${errorMsg}`);
          set({ isStreaming: false });
        });
        unlisteners.push(errorUnlisten);

        return unlisteners;
      },
    }),
    {
      name: "claude-panel-state",
      partialize: (state) => ({
        width: state.width,
        // Don't persist: isOpen, messages, sessionState, etc.
      }),
    }
  )
);

// Selectors
export const useClaudePanelOpen = () => useClaudeStore((state) => state.isOpen);
export const useClaudePanelWidth = () => useClaudeStore((state) => state.width);
export const useClaudeMessages = () => useClaudeStore((state) => state.messages);
export const useClaudeSessionState = () =>
  useClaudeStore((state) => state.sessionState);
export const useClaudeIsStreaming = () =>
  useClaudeStore((state) => state.isStreaming);
