/** Scroll-triggered reveal animation — elements slide up and fade in when they enter the viewport. */
import { motion, useInView } from 'framer-motion';
import { useRef, type ReactNode } from 'react';

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  /** Delay in seconds before animation starts. Default: 0 */
  delay?: number;
  /** Distance to travel upward in px. Default: 40 */
  y?: number;
}

export function ScrollReveal({ children, className, delay = 0, y = 40 }: ScrollRevealProps) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      transition={{
        duration: 0.6,
        delay,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
