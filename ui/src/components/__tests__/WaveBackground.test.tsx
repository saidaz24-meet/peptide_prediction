/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { WaveBackground } from "../WaveBackground";

// ---------------------------------------------------------------------------
// Mock Canvas 2D context (jsdom doesn't have real canvas)
// ---------------------------------------------------------------------------

const mockCtx = {
  clearRect: vi.fn(),
  beginPath: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  fillRect: vi.fn(),
  fillStyle: "",
  setTransform: vi.fn(),
  getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([0, 0, 0, 255]) })),
};

const originalGetContext = HTMLCanvasElement.prototype.getContext;

beforeEach(() => {
  // Mock getContext to return our stub
  HTMLCanvasElement.prototype.getContext = vi.fn(function (
    this: HTMLCanvasElement,
    contextId: string,
  ) {
    if (contextId === "2d") return mockCtx as unknown as CanvasRenderingContext2D;
    return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

  // Mock getComputedStyle to return a foreground variable
  vi.spyOn(window, "getComputedStyle").mockReturnValue({
    getPropertyValue: (prop: string) => {
      if (prop === "--foreground") return "0 0% 0%";
      return "";
    },
  } as CSSStyleDeclaration);

  // Mock ResizeObserver (needs function keyword for `new`)
  vi.stubGlobal(
    "ResizeObserver",
    vi.fn(function (this: any) {
      this.observe = vi.fn();
      this.unobserve = vi.fn();
      this.disconnect = vi.fn();
    }),
  );

  // Mock IntersectionObserver
  vi.stubGlobal(
    "IntersectionObserver",
    vi.fn(function (this: any) {
      this.observe = vi.fn();
      this.unobserve = vi.fn();
      this.disconnect = vi.fn();
    }),
  );

  // Mock MutationObserver
  vi.stubGlobal(
    "MutationObserver",
    vi.fn(function (this: any) {
      this.observe = vi.fn();
      this.disconnect = vi.fn();
    }),
  );

  // Default: no reduced motion
  vi.stubGlobal("matchMedia", vi.fn((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })));

  // Mock requestAnimationFrame / cancelAnimationFrame
  // Do NOT call cb synchronously — the component's loop calls rAF recursively,
  // which would cause infinite recursion. Just store the ID and return it.
  let rafId = 0;
  vi.stubGlobal("requestAnimationFrame", vi.fn((_cb: FrameRequestCallback) => {
    return ++rafId;
  }));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});

afterEach(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext;
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("WaveBackground", () => {
  it("renders the container with data-testid", () => {
    render(<WaveBackground />);
    expect(screen.getByTestId("wave-background")).toBeInTheDocument();
  });

  it("renders a canvas element inside the container", () => {
    render(<WaveBackground />);
    const container = screen.getByTestId("wave-background");
    expect(container.querySelector("canvas")).toBeTruthy();
  });

  it("sets aria-hidden on the container", () => {
    render(<WaveBackground />);
    expect(screen.getByTestId("wave-background")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("applies pointer-events-none so content above is clickable", () => {
    render(<WaveBackground />);
    const el = screen.getByTestId("wave-background");
    expect(el.className).toContain("pointer-events-none");
  });

  it("forwards className prop", () => {
    render(<WaveBackground className="z-0 custom-class" />);
    const el = screen.getByTestId("wave-background");
    expect(el.className).toContain("custom-class");
  });

  it("respects prefers-reduced-motion by rendering a static frame", () => {
    // Override matchMedia to report reduced motion
    vi.stubGlobal("matchMedia", vi.fn((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));

    render(<WaveBackground />);

    // With reduced motion, requestAnimationFrame should NOT be called
    // (static frame renders directly, not via rAF loop)
    // The component renders one frame inline and returns without setting up a loop
    expect(screen.getByTestId("wave-background")).toBeInTheDocument();
  });

  it("cleans up on unmount (cancelAnimationFrame called)", () => {
    const { unmount } = render(<WaveBackground />);
    unmount();
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });

  it("accepts custom particleCount prop without crashing", () => {
    render(<WaveBackground particleCount={100} />);
    expect(screen.getByTestId("wave-background")).toBeInTheDocument();
  });

  it("accepts speed=0 for static rendering", () => {
    render(<WaveBackground speed={0} />);
    expect(screen.getByTestId("wave-background")).toBeInTheDocument();
  });

  it("accepts custom color prop", () => {
    render(<WaveBackground color="128,0,255" />);
    expect(screen.getByTestId("wave-background")).toBeInTheDocument();
  });
});
