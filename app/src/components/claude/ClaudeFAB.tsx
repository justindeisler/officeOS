import { motion } from "framer-motion";
import { useClaudeStore } from "@/stores/claudeStore";
import { ClaudeSparkIcon } from "./ClaudeIcon";
import { cn } from "@/lib/utils";

/**
 * Floating Action Button for toggling the Claude panel
 * Positioned at the bottom-right of the viewport
 * Animates left when the panel opens
 */
export function ClaudeFAB() {
  const { isOpen, width, togglePanel } = useClaudeStore();

  return (
    <motion.button
      onClick={togglePanel}
      className={cn(
        "fixed bottom-6 z-50 w-14 h-14 rounded-full",
        "bg-[#D97757] hover:bg-[#C56A4C] shadow-lg",
        "flex items-center justify-center",
        "transition-colors duration-200",
        "focus:outline-none focus:ring-2 focus:ring-[#D97757] focus:ring-offset-2"
      )}
      initial={false}
      animate={{
        right: isOpen ? width + 24 : 24,
        scale: 1,
      }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={{
        right: { type: "spring", stiffness: 300, damping: 30 },
        scale: { duration: 0.1 },
      }}
      aria-label={isOpen ? "Close Claude assistant" : "Open Claude assistant"}
    >
      <ClaudeSparkIcon className="w-7 h-7 text-white" />
    </motion.button>
  );
}
