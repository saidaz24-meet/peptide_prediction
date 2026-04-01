/**
 * Shared animation variants and config for the entire app.
 * Import these anywhere you need consistent scroll-reveal, stagger, or hover animations.
 */
import type { Variants, Transition } from "framer-motion";

/* ── Easing ── */
export const smoothEase: [number, number, number, number] = [0.16, 1, 0.3, 1];

/* ── Fade up (single element) ── */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: smoothEase },
  },
};

/* ── Fade up (smaller movement, for text) ── */
export const fadeUpSmall: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: smoothEase },
  },
};

/* ── Scale up from slightly smaller ── */
export const scaleUp: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.6, ease: smoothEase },
  },
};

/* ── Stagger container ── */
export const staggerContainer = (staggerDelay = 0.12): Variants => ({
  hidden: {},
  visible: {
    transition: { staggerChildren: staggerDelay },
  },
});

/* ── Stagger child (used inside stagger container) ── */
export const staggerChild: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: smoothEase },
  },
};

/* ── Sequential reveal (for pipeline steps, numbered items) ── */
export const sequentialContainer = (delayBetween = 0.25): Variants => ({
  hidden: {},
  visible: {
    transition: { staggerChildren: delayBetween, delayChildren: 0.1 },
  },
});

export const sequentialChild: Variants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: smoothEase },
  },
};

/* ── Hover: card lift + glow ── */
export const cardHover = {
  rest: {
    y: 0,
    scale: 1,
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
    transition: { duration: 0.3, ease: smoothEase },
  },
  hover: {
    y: -6,
    scale: 1.02,
    boxShadow: "0 20px 40px rgba(0,0,0,0.12), 0 0 20px rgba(139,92,246,0.08)",
    transition: { duration: 0.3, ease: smoothEase },
  },
};

/* ── Hover: subtle lift (for smaller elements) ── */
export const subtleHover = {
  rest: {
    y: 0,
    transition: { duration: 0.2 },
  },
  hover: {
    y: -3,
    transition: { duration: 0.2 },
  },
};

/* ── Transition presets ── */
export const springTransition: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 30,
};

export const smoothTransition: Transition = {
  duration: 0.7,
  ease: smoothEase,
};
