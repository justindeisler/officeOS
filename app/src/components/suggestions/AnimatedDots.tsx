import { useEffect, useState } from "react";

/** Animated dots: "" → "." → ".." → "..." → repeat */
export function AnimatedDots() {
  const [dots, setDots] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Fixed-width span to prevent layout shift
  return <span className="inline-block w-[1.2em] text-left">{dots}</span>;
}
