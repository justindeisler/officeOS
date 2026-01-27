import { cn } from "@/lib/utils";

interface ClaudeIconProps {
  className?: string;
}

/**
 * Claude logomark - the distinctive "C" shape
 * Based on official Anthropic branding
 */
export function ClaudeIcon({ className }: ClaudeIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-6 h-6", className)}
    >
      <path
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"
        fill="currentColor"
        opacity="0.3"
      />
      <path
        d="M15.5 8.5C14.67 7.67 13.4 7 12 7c-2.76 0-5 2.24-5 12 0 2.76 2.24 5 5 5 1.4 0 2.67-.67 3.5-1.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  );
}

/**
 * Alternative Claude icon - simpler spark/assistant style
 */
export function ClaudeSparkIcon({ className }: ClaudeIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-6 h-6", className)}
    >
      <path
        d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"
        fill="currentColor"
      />
    </svg>
  );
}
