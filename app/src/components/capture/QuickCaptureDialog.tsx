import { useState, useEffect, useRef } from "react";
import { Zap, ListTodo, StickyNote, Lightbulb, Calendar } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCaptureStore } from "@/stores/captureStore";
import { cn } from "@/lib/utils";
import type { CaptureType } from "@/types";

interface QuickCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const captureTypes: { type: CaptureType; label: string; icon: React.ReactNode; shortcut: string }[] = [
  { type: "task", label: "Task", icon: <ListTodo className="h-4 w-4" />, shortcut: "T" },
  { type: "note", label: "Note", icon: <StickyNote className="h-4 w-4" />, shortcut: "N" },
  { type: "idea", label: "Idea", icon: <Lightbulb className="h-4 w-4" />, shortcut: "I" },
  { type: "meeting", label: "Meeting", icon: <Calendar className="h-4 w-4" />, shortcut: "M" },
];

export function QuickCaptureDialog({ open, onOpenChange }: QuickCaptureDialogProps) {
  const { addCapture } = useCaptureStore();
  const [content, setContent] = useState("");
  const [type, setType] = useState<CaptureType>("task");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [open]);

  // Keyboard shortcuts for type selection
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + T/N/I/M for type selection
      if (e.metaKey || e.ctrlKey) {
        switch (e.key.toLowerCase()) {
          case "t":
            e.preventDefault();
            setType("task");
            break;
          case "n":
            e.preventDefault();
            setType("note");
            break;
          case "i":
            e.preventDefault();
            setType("idea");
            break;
          case "m":
            e.preventDefault();
            setType("meeting");
            break;
          case "enter":
            e.preventDefault();
            handleSubmit();
            break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, content, type]);

  const handleSubmit = () => {
    if (!content.trim()) return;

    addCapture({
      content: content.trim(),
      type,
    });

    setContent("");
    setType("task");
    onOpenChange(false);
  };

  const handleClose = () => {
    setContent("");
    setType("task");
    onOpenChange(false);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* Overlay with blur */}
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        />

        {/* Dialog Content */}
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] sm:w-full max-w-[560px] -translate-x-1/2 -translate-y-1/2",
            "bg-card rounded-xl border border-border/50 shadow-2xl shadow-black/20",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "duration-200"
          )}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-6 pt-5 pb-4 border-b border-border/50">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-amber-500/10">
              <Zap className="h-5 w-5 text-amber-500" />
            </div>
            <DialogPrimitive.Title className="text-lg font-semibold text-foreground">
              Quick Capture
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              className="ml-auto rounded-md p-1.5 text-muted-foreground/60 hover:text-foreground hover:bg-muted/80 transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-5">
            {/* Type Selection - Pill Buttons */}
            <div className="grid grid-cols-2 sm:flex gap-1.5 p-1.5 rounded-lg bg-muted/50">
              {captureTypes.map((item) => (
                <button
                  key={item.type}
                  onClick={() => setType(item.type)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-150",
                    type === item.type
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                  )}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>

            {/* Content Input - Custom styled textarea */}
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={getPlaceholder(type)}
                rows={4}
                className={cn(
                  "w-full px-4 py-3 rounded-lg text-sm",
                  "bg-muted/30 border border-border/50",
                  "placeholder:text-muted-foreground/50",
                  "focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-transparent",
                  "resize-none transition-all duration-150",
                  // Hide scrollbar but keep scroll functionality
                  "scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                )}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-border/50 bg-muted/20 rounded-b-xl">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              Press
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono border border-border/50">
                ⌘↵
              </kbd>
              to save
            </p>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="text-muted-foreground hover:text-foreground"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={!content.trim()}
                className="bg-amber-500 hover:bg-amber-600 text-white shadow-sm"
              >
                <Zap className="h-4 w-4 mr-1.5" />
                Capture
              </Button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function getPlaceholder(type: CaptureType): string {
  switch (type) {
    case "task":
      return "What needs to be done?";
    case "note":
      return "What's on your mind?";
    case "idea":
      return "What's your idea?";
    case "meeting":
      return "Meeting notes or action items...";
    default:
      return "Capture something...";
  }
}
