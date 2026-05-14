import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  isChunkLoadError,
  reloadForChunkError,
  installChunkErrorRecovery,
} from "../chunkErrorRecovery";

describe("isChunkLoadError", () => {
  it("matches Vite preload-error message", () => {
    expect(
      isChunkLoadError(
        new Error(
          "Failed to fetch dynamically imported module: http://example.com/assets/Upload-BXltiSGY.js"
        )
      )
    ).toBe(true);
  });

  it("matches Safari 'Importing a module script failed'", () => {
    expect(isChunkLoadError(new Error("Importing a module script failed."))).toBe(true);
  });

  it("matches webpack-style ChunkLoadError name", () => {
    const e = new Error("Loading chunk 42 failed.");
    e.name = "ChunkLoadError";
    expect(isChunkLoadError(e)).toBe(true);
  });

  it("matches CSS chunk failure", () => {
    expect(isChunkLoadError(new Error("Loading CSS chunk 7 failed."))).toBe(true);
  });

  it("does NOT match unrelated TypeErrors", () => {
    expect(isChunkLoadError(new Error("Cannot read properties of undefined (reading 'foo')"))).toBe(
      false
    );
  });

  it("does NOT match plain strings without chunk markers", () => {
    expect(isChunkLoadError("network error")).toBe(false);
  });

  it("handles null / undefined safely", () => {
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });
});

describe("reloadForChunkError", () => {
  let reloadSpy: ReturnType<typeof vi.fn>;
  let originalLocation: Location;

  beforeEach(() => {
    sessionStorage.clear();
    reloadSpy = vi.fn();
    originalLocation = window.location;
    // jsdom's window.location is non-configurable in some node versions —
    // replace the whole object with one whose .reload is our spy.
    // Overriding window.location in jsdom — cast widens to allow delete.
    delete (window as { location?: Location }).location;
    (window as { location: unknown }).location = {
      reload: reloadSpy as unknown as () => void,
      href: originalLocation.href,
    };
  });

  afterEach(() => {
    // Restoring window.location in jsdom — cast widens to allow delete.
    delete (window as { location?: Location }).location;
    (window as { location: Location }).location = originalLocation;
  });

  it("reloads the page on first call and returns true", () => {
    const result = reloadForChunkError();
    expect(result).toBe(true);
    expect(reloadSpy).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem("pvl-chunk-error-reloaded")).toMatch(/^\d+$/);
  });

  it("does NOT reload twice within the TTL window", () => {
    reloadForChunkError();
    reloadSpy.mockClear();
    const result = reloadForChunkError();
    expect(result).toBe(false);
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it("DOES reload again after the TTL window expires", () => {
    sessionStorage.setItem(
      "pvl-chunk-error-reloaded",
      String(Date.now() - 60_000) // 60s ago, past the 30s TTL
    );
    const result = reloadForChunkError();
    expect(result).toBe(true);
    expect(reloadSpy).toHaveBeenCalledOnce();
  });
});

describe("installChunkErrorRecovery", () => {
  let reloadSpy: ReturnType<typeof vi.fn>;
  let originalLocation: Location;

  beforeEach(() => {
    sessionStorage.clear();
    reloadSpy = vi.fn();
    originalLocation = window.location;
    // Overriding window.location in jsdom — cast widens to allow delete.
    delete (window as { location?: Location }).location;
    (window as { location: unknown }).location = {
      reload: reloadSpy as unknown as () => void,
      href: originalLocation.href,
    };
  });

  afterEach(() => {
    // Restoring window.location in jsdom — cast widens to allow delete.
    delete (window as { location?: Location }).location;
    (window as { location: Location }).location = originalLocation;
  });

  it("reloads on vite:preloadError event", () => {
    installChunkErrorRecovery();
    window.dispatchEvent(new Event("vite:preloadError"));
    expect(reloadSpy).toHaveBeenCalledOnce();
  });

  it("reloads on unhandledrejection with a chunk error", () => {
    installChunkErrorRecovery();
    const event = new Event("unhandledrejection") as PromiseRejectionEvent;
    Object.defineProperty(event, "reason", {
      value: new Error("Failed to fetch dynamically imported module: /x.js"),
    });
    window.dispatchEvent(event);
    expect(reloadSpy).toHaveBeenCalledOnce();
  });

  it("does NOT reload on unhandledrejection with an unrelated error", () => {
    installChunkErrorRecovery();
    const event = new Event("unhandledrejection") as PromiseRejectionEvent;
    Object.defineProperty(event, "reason", {
      value: new Error("Some other error"),
    });
    window.dispatchEvent(event);
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it("is idempotent — calling install twice doesn't double-fire", () => {
    installChunkErrorRecovery();
    installChunkErrorRecovery();
    window.dispatchEvent(new Event("vite:preloadError"));
    // Single reload, not two.
    expect(reloadSpy).toHaveBeenCalledOnce();
  });
});
