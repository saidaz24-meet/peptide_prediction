import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

type Phase = "idle" | "enter" | "exit";

const EASE = [0.25, 0.46, 0.45, 0.94]; // Gentle easing

// Soft floating bubbles in background
function AmbientBubble({ delay = 0, x = 50, size = 30 }) {
  return (
    <motion.div
      className="absolute rounded-full bg-purple-300/20 backdrop-blur-sm"
      style={{
        width: size,
        height: size,
        left: `${x}%`,
        top: "100%",
      }}
      initial={{ y: 0, opacity: 0 }}
      animate={{
        y: [-50, -window.innerHeight - 100],
        opacity: [0, 0.3, 0.3, 0],
      }}
      transition={{
        duration: 8,
        delay,
        ease: "linear",
        repeat: Infinity,
      }}
    />
  );
}

export default function ScreenTransition({
  phase,
  onHalfway,
  onDone,
  clickPosition = { x: window.innerWidth / 2, y: window.innerHeight / 2 },
}) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (phase === "enter") {
      // Call navigation halfway through expansion
      const timer = setTimeout(() => {
        onHalfway?.();
        setRevealed(true);
      }, 600);
      return () => clearTimeout(timer);
    } else {
      setRevealed(false);
    }
  }, [phase, onHalfway]);

  return (
    <AnimatePresence>
      {phase !== "idle" && (
        <div className="fixed inset-0 z-[99] pointer-events-none overflow-hidden">
          {/* Soft ambient bubbles */}
          {phase === "enter" && (
            <>
              {[...Array(8)].map((_, i) => (
                <AmbientBubble
                  key={i}
                  delay={i * 0.3}
                  x={10 + (i * 12)}
                  size={20 + Math.random() * 20}
                />
              ))}
            </>
          )}

          {/* Main expanding bubble */}
          <motion.div
            className="absolute rounded-full"
            style={{
              left: clickPosition.x,
              top: clickPosition.y,
              x: "-50%",
              y: "-50%",
              background: "linear-gradient(135deg, #a78bfa 0%, #8b5cf6 50%, #7c3aed 100%)",
            }}
            initial={{ 
              width: 0, 
              height: 0,
              opacity: 0,
            }}
            animate={{
              width: phase === "enter" ? Math.max(window.innerWidth, window.innerHeight) * 3 : 0,
              height: phase === "enter" ? Math.max(window.innerWidth, window.innerHeight) * 3 : 0,
              opacity: phase === "enter" ? [0, 0.95, 0.95, 0] : 0,
            }}
            transition={{
              duration: phase === "enter" ? 1.4 : 0.8,
              
              times: phase === "enter" ? [0, 0.5, 0.85, 1] : undefined,
            }}
            onAnimationComplete={() => {
              if (phase === "exit") {
                onDone?.();
              }
            }}
          >
            {/* Gentle shine effect */}
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{
                background: "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.3) 0%, transparent 60%)",
              }}
              initial={{ opacity: 0 }}
              animate={{ 
                opacity: revealed ? 0 : [0, 0.4, 0],
              }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </motion.div>

          {/* Soft reveal overlay - fades to show new page */}
          <motion.div
            className="absolute inset-0 bg-purple-50"
            initial={{ opacity: 0 }}
            animate={{
              opacity: revealed ? 0 : 0,
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />

          {/* Gentle pop particles when bubble disappears */}
          {phase === "exit" && (
            <div className="absolute inset-0">
              {[...Array(12)].map((_, i) => {
                const angle = (i * 360) / 12;
                const distance = 100;
                return (
                  <motion.div
                    key={i}
                    className="absolute w-2 h-2 rounded-full bg-purple-300/60"
                    style={{
                      left: clickPosition.x,
                      top: clickPosition.y,
                    }}
                    initial={{ 
                      x: 0, 
                      y: 0,
                      opacity: 0.6,
                      scale: 1,
                    }}
                    animate={{
                      x: Math.cos(angle * Math.PI / 180) * distance,
                      y: Math.sin(angle * Math.PI / 180) * distance,
                      opacity: 0,
                      scale: 0,
                    }}
                    transition={{
                      duration: 0.8,
                      ease: "easeOut",
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </AnimatePresence>
  );
}