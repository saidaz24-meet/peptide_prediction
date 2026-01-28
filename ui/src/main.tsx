import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Initialize Sentry as early as possible in the application lifecycle
// DSN must be provided via VITE_SENTRY_DSN environment variable
// Never hardcode DSNs in source code
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;

let SENTRY_INITIALIZED = false;

// Store feedback integration instance for manual access
const feedbackIntegration = Sentry.feedbackIntegration({
  // Set autoInject to false so we can control when to show the dialog
  autoInject: false,
});

// Store globally for access in components
if (typeof window !== 'undefined') {
  (window as any).__sentryFeedbackIntegration = feedbackIntegration;
}

if (SENTRY_DSN) {
  try {
    Sentry.init({
      dsn: SENTRY_DSN,
      // Setting this option to true will send default PII data to Sentry
      // For example, automatic IP address collection on events
      sendDefaultPii: true,
      // Set traces_sample_rate to 1.0 to capture 100% of transactions for performance monitoring
      // Adjust this value in production
      tracesSampleRate: 0.1,
      // Set profiles_sample_rate to profile 10% of sampled transactions
      profilesSampleRate: 0.1,
      environment: import.meta.env.MODE || "development",
      // Enable debug mode to see Sentry activity in console (disable in production)
      debug: import.meta.env.VITE_SENTRY_DEBUG === "true",
      // Enable React Router integration for better error tracking
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllText: false,
          blockAllMedia: false,
        }),
        feedbackIntegration,
      ],
    });
    
    SENTRY_INITIALIZED = true;
    console.log("[SENTRY] Initialized successfully");
    
    // Send a test message to verify connection
    Sentry.captureMessage("Sentry frontend initialized", "info");
  } catch (error) {
    console.error("[SENTRY] Failed to initialize:", error);
    SENTRY_INITIALIZED = false;
  }
} else {
  console.warn("[SENTRY] No DSN provided (VITE_SENTRY_DSN env var not set), Sentry disabled");
}

// Expose test function to window for manual testing
(window as any).testSentry = () => {
  if (!SENTRY_INITIALIZED) {
    console.error("[SENTRY] Not initialized");
    return;
  }
  
  console.log("[SENTRY] Sending test events...");
  
  // Test 1: Message
  const msgId = Sentry.captureMessage("Test message from frontend", "info");
  console.log("[SENTRY] Test message sent:", msgId);
  
  // Test 2: Exception
  const excId = Sentry.captureException(new Error("Test exception from frontend"));
  console.log("[SENTRY] Test exception sent:", excId);
  
  // Test 3: Manual throw (will be caught by ErrorBoundary)
  setTimeout(() => {
    throw new Error("Test async error from frontend");
  }, 100);
  
  alert("Test events sent! Check Sentry dashboard and browser console.");
};

// Capture unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  Sentry.captureException(event.reason);
});

// Capture uncaught errors
window.addEventListener('error', (event) => {
  Sentry.captureException(event.error);
});

const container = document.getElementById("root")!;
const root = createRoot(container);

// Wrap app in ErrorBoundary to catch React render errors
root.render(
  <Sentry.ErrorBoundary 
    fallback={({ error, resetError }) => (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <h1>Something went wrong</h1>
        <p>{error.message}</p>
        <button onClick={resetError}>Try again</button>
      </div>
    )}
    showDialog
  >
    <App />
  </Sentry.ErrorBoundary>
);
