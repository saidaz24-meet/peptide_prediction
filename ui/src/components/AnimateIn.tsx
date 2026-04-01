/**
 * AnimateIn — Reusable scroll-triggered animation wrapper.
 *
 * Usage:
 *   <AnimateIn>             — single element fade-up on scroll
 *   <AnimateIn variant="scaleUp">  — scale-up variant
 *   <AnimateIn stagger>     — stagger children (wrap multiple items)
 *   <AnimateIn sequential>  — sequential reveal (pipeline steps, numbered lists)
 *   <AnimateIn delay={0.2}> — add extra delay
 *
 * This replaces all the manual useRef + useInView + motion.div patterns.
 * Use this component everywhere for consistent scroll animations.
 */
import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import {
  fadeUp,
  fadeUpSmall,
  scaleUp,
  staggerContainer,
  staggerChild,
  sequentialContainer,
  sequentialChild,
} from "@/lib/animations";
import { cn } from "@/lib/utils";

type VariantName = "fadeUp" | "fadeUpSmall" | "scaleUp";

interface AnimateInProps {
  children: React.ReactNode;
  className?: string;
  /** Which single-element variant to use. Default: "fadeUp" */
  variant?: VariantName;
  /** Stagger children — wraps children in a stagger container */
  stagger?: boolean;
  /** Delay between stagger children in seconds. Default: 0.12 */
  staggerDelay?: number;
  /** Sequential reveal — like stagger but slower, for ordered items */
  sequential?: boolean;
  /** Delay between sequential children. Default: 0.25 */
  sequentialDelay?: number;
  /** Extra delay before animation starts */
  delay?: number;
  /** InView margin. Default: "-60px" */
  margin?: string;
  /** Only animate once. Default: true */
  once?: boolean;
  /** HTML tag to render. Default: "div" */
  as?: "div" | "section" | "ul" | "ol" | "nav" | "header" | "footer";
}

const VARIANTS: Record<VariantName, typeof fadeUp> = {
  fadeUp,
  fadeUpSmall,
  scaleUp,
};

export function AnimateIn({
  children,
  className,
  variant = "fadeUp",
  stagger: isStagger,
  staggerDelay = 0.12,
  sequential: isSequential,
  sequentialDelay = 0.25,
  delay = 0,
  margin = "-60px",
  once = true,
  as = "div",
}: AnimateInProps) {
  const ref = useRef(null);
  const inView = useInView(ref, { once, margin: margin as `${number}px` });

  const MotionTag = motion[as] as typeof motion.div;

  // Sequential mode — ordered items appearing one by one
  if (isSequential) {
    return (
      <MotionTag
        ref={ref}
        className={className}
        initial="hidden"
        animate={inView ? "visible" : "hidden"}
        variants={sequentialContainer(sequentialDelay)}
        transition={delay ? { delay } : undefined}
      >
        {children}
      </MotionTag>
    );
  }

  // Stagger mode — children appear with slight delay between each
  if (isStagger) {
    return (
      <MotionTag
        ref={ref}
        className={className}
        initial="hidden"
        animate={inView ? "visible" : "hidden"}
        variants={staggerContainer(staggerDelay)}
        transition={delay ? { delay } : undefined}
      >
        {children}
      </MotionTag>
    );
  }

  // Single element mode
  const selectedVariant = VARIANTS[variant];
  return (
    <MotionTag
      ref={ref}
      className={className}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={
        delay
          ? {
              ...selectedVariant,
              visible: {
                ...selectedVariant.visible,
                transition: {
                  ...(selectedVariant.visible as Record<string, unknown>).transition as Record<string, unknown>,
                  delay,
                },
              },
            }
          : selectedVariant
      }
    >
      {children}
    </MotionTag>
  );
}

/**
 * AnimateInChild — Use inside <AnimateIn stagger> or <AnimateIn sequential>
 * Wraps a child with the appropriate stagger/sequential variant.
 */
export function AnimateInChild({
  children,
  className,
  sequential,
}: {
  children: React.ReactNode;
  className?: string;
  sequential?: boolean;
}) {
  return (
    <motion.div
      className={className}
      variants={sequential ? sequentialChild : staggerChild}
    >
      {children}
    </motion.div>
  );
}
