import { useEffect, useRef, useCallback } from "react";

/**
 * Animated constellation background — canvas-based particle network.
 * Inspired by Precognition's hero. Renders 50-80 nodes with connecting
 * lines, subtle drift, mouse repel, and 2-3 purple-glowing nodes.
 *
 * Performance: Uses requestAnimationFrame, max 80 nodes, canvas only.
 * Accessibility: Respects prefers-reduced-motion (renders static).
 */

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  glow: boolean;
  glowPhase: number;
}

interface ConstellationBackgroundProps {
  className?: string;
  nodeCount?: number;
  /** Max distance between nodes to draw a connecting line */
  connectionDistance?: number;
}

export function ConstellationBackground({
  className = "",
  nodeCount = 65,
  connectionDistance = 150,
}: ConstellationBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const animRef = useRef<number>(0);
  const reducedMotionRef = useRef(false);

  // Initialize nodes — density-based: ~1 node per 7500px² (matches Cowork's 60 nodes in 900×500)
  const initNodes = useCallback(
    (width: number, height: number) => {
      const area = width * height;
      const count = Math.max(nodeCount, Math.round(area / 7500));
      const glowCount = Math.max(3, Math.round(count * 0.05)); // 5% glow nodes
      const nodes: Node[] = [];
      for (let i = 0; i < count; i++) {
        nodes.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          size: 1 + Math.random() * 1.5,
          opacity: 0.2 + Math.random() * 0.2,
          glow: i < glowCount,
          glowPhase: Math.random() * Math.PI * 2,
        });
      }
      nodesRef.current = nodes;
    },
    [nodeCount]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Check reduced motion
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = mq.matches;

    // Size canvas
    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.scale(dpr, dpr);
      if (nodesRef.current.length === 0) {
        initNodes(rect.width, rect.height);
      }
    };
    resize();
    window.addEventListener("resize", resize);

    // Mouse tracking
    const handleMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const handleMouseLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 };
    };
    canvas.addEventListener("mousemove", handleMouse);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    // Theme-aware colors
    const isDark = () => document.documentElement.classList.contains("dark");

    let time = 0;

    const draw = () => {
      const w = canvas.width / (window.devicePixelRatio || 1);
      const h = canvas.height / (window.devicePixelRatio || 1);
      const nodes = nodesRef.current;
      const dark = isDark();

      // Dot/line base color
      const dotColor = dark ? "255, 255, 255" : "0, 0, 0";
      const purpleGlow = "hsla(263, 70%, 58%, 0.3)";
      const purpleGlowBright = "hsla(263, 70%, 58%, 0.6)";
      const purpleCore = dark ? "hsla(263, 70%, 70%," : "hsla(263, 70%, 50%,";

      ctx.clearRect(0, 0, w, h);

      time += 0.01;

      // Update positions (skip if reduced motion)
      if (!reducedMotionRef.current) {
        for (const node of nodes) {
          // Drift
          node.x += node.vx;
          node.y += node.vy;

          // Bounce off edges
          if (node.x < 0 || node.x > w) node.vx *= -1;
          if (node.y < 0 || node.y > h) node.vy *= -1;
          node.x = Math.max(0, Math.min(w, node.x));
          node.y = Math.max(0, Math.min(h, node.y));

          // Mouse repel
          const mx = mouseRef.current.x;
          const my = mouseRef.current.y;
          const dx = node.x - mx;
          const dy = node.y - my;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 200 && dist > 0) {
            const force = ((200 - dist) / 200) * 0.8;
            node.x += (dx / dist) * force;
            node.y += (dy / dist) * force;
          }
        }
      }

      // Draw connections
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < connectionDistance) {
            const alpha = (1 - dist / connectionDistance) * (dark ? 0.07 : 0.04);
            ctx.strokeStyle = `rgba(${dotColor}, ${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw nodes
      for (const node of nodes) {
        if (node.glow) {
          const pulse = 0.5 + 0.5 * Math.sin(time * 2 + node.glowPhase);
          const glowRadius = node.size * (6 + pulse * 4);

          const grad = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, glowRadius);
          grad.addColorStop(0, purpleGlowBright);
          grad.addColorStop(0.4, purpleGlow);
          grad.addColorStop(1, "transparent");
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(node.x, node.y, glowRadius, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = `${purpleCore} ${0.7 + pulse * 0.3})`;
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.size * 1.2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = `rgba(${dotColor}, ${node.opacity})`;
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", handleMouse);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [initNodes, connectionDistance]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 z-0 pointer-events-auto ${className}`}
      aria-hidden="true"
    />
  );
}
