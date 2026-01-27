import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useConfettiStore } from "@/stores/confettiStore";

// Celebration color palette - success greens, warm ambers, cool blues
const COLORS = [
  "#22c55e", // green-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#eab308", // yellow-500
  "#3b82f6", // blue-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
];

// Particle shape types
type ParticleShape = "square" | "circle" | "rectangle";

interface ParticleConfig {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  shape: ParticleShape;
  xVelocity: number;
  yVelocity: number;
  rotation: number;
  drift: number;
  delay: number;
}

const PARTICLE_COUNT = 120;

function generateParticles(): ParticleConfig[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const shape: ParticleShape =
      Math.random() < 0.5 ? "square" : Math.random() < 0.6 ? "circle" : "rectangle";

    // Random angle for 360° radial explosion from center
    const angle = Math.random() * Math.PI * 2;
    const velocity = 800 + Math.random() * 1000;

    return {
      id: i,
      // Start from CENTER of page
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      // 200% bigger particles: 24-56px (was 12-28px)
      size: 24 + Math.random() * 32,
      shape,
      // Radial explosion in all directions from center
      xVelocity: Math.cos(angle) * velocity,
      yVelocity: Math.sin(angle) * velocity,
      rotation: (Math.random() - 0.5) * 1800,
      drift: (Math.random() - 0.5) * 300,
      delay: Math.random() * 0.2,
    };
  });
}

function ConfettiParticle({ config }: { config: ParticleConfig }) {
  const { x, y, color, size, shape, xVelocity, yVelocity, rotation, drift, delay } = config;

  const shapeStyles = useMemo(() => {
    switch (shape) {
      case "circle":
        return { borderRadius: "50%" };
      case "rectangle":
        // Ribbon-like confetti strips - taller and thinner
        return { width: size * 0.3, height: size * 2.5 };
      default:
        // Squares get slight border radius
        return { borderRadius: 3 };
    }
  }, [shape, size]);

  return (
    <motion.div
      className="pointer-events-none absolute"
      style={{
        left: x,
        top: y,
        width: size,
        height: size,
        backgroundColor: color,
        willChange: "transform",
        ...shapeStyles,
      }}
      initial={{
        x: 0,
        y: 0,
        opacity: 1,
        scale: 0,
        rotate: 0,
      }}
      animate={{
        // Radial explosion: particles fly outward from center in all directions
        x: [0, xVelocity * 0.4, xVelocity * 0.8 + drift],
        y: [0, yVelocity * 0.4, yVelocity * 0.8 + drift * 0.5],
        opacity: [1, 1, 0],
        scale: [0, 1.3, 0.7],
        rotate: [0, rotation * 0.5, rotation],
      }}
      transition={{
        duration: 2.2,
        delay,
        ease: [0.16, 1, 0.3, 1],
        times: [0, 0.2, 1],
      }}
    />
  );
}

export function Confetti() {
  const isActive = useConfettiStore((state) => state.isActive);

  // Generate new particles each time confetti is triggered
  const particles = useMemo(() => {
    if (!isActive) return [];
    return generateParticles();
  }, [isActive]);

  // Check for reduced motion preference
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReducedMotion) {
    return null;
  }

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          aria-hidden="true"
        >
          {particles.map((particle) => (
            <ConfettiParticle key={particle.id} config={particle} />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
