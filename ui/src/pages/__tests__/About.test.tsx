/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import About from "../About";

// About.tsx pulls in heavy infra (framer-motion ScreenTransition, Sentry,
// AppFooter). Stub the parts that don't matter for the credits assertions.
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
  cubicBezier: () => () => 0,
}));

// V10-1: About now uses WaveBackground instead of BgDotGrid
vi.mock("@/components/WaveBackground", () => ({
  WaveBackground: (props: any) => (
    <div data-testid="wave-background" {...props} />
  ),
}));

vi.mock("@/components/AppFooter", () => ({
  __esModule: true,
  default: () => <footer data-testid="app-footer-mock" />,
}));

vi.mock("@sentry/react", async () => {
  const actual = await vi.importActual<typeof import("@sentry/react")>(
    "@sentry/react",
  );
  return {
    ...actual,
    captureException: vi.fn(),
    captureMessage: vi.fn(),
  };
});

function renderAbout() {
  return render(
    <MemoryRouter>
      <About />
    </MemoryRouter>,
  );
}

describe("About page — credits & dataset card", () => {
  it("renders the credits card", () => {
    renderAbout();
    expect(screen.getByTestId("about-credits")).toBeInTheDocument();
  });

  it("credits Said Azaizah with lead-developer role (never 'Founder' — feedback_said_credit_phrasing.md)", () => {
    renderAbout();
    const block = screen.getByTestId("credit-said");
    expect(block).toHaveTextContent("Said Azaizah");
    expect(block).toHaveTextContent(/Lead developer/);
    // 2026-06-08: contribution scope rewritten — five surfaces (web, Python,
    // CLI, MCP, self-host) replace the prior "full-stack architect" phrasing.
    expect(block).toHaveTextContent(/backend/);
    expect(block).toHaveTextContent(/frontend/);
    // Guard: 'Founder' must NEVER appear in Said's credit block.
    expect(block.textContent ?? "").not.toMatch(/\bFounder\b/);
  });

  it("credits Dr. Peleg Ragonis-Bachar (Technion) for algorithms", () => {
    renderAbout();
    const block = screen.getByTestId("credit-peleg");
    expect(block).toHaveTextContent("Dr. Peleg Ragonis-Bachar");
    expect(block).toHaveTextContent("Technion");
    // 2026-06-08: Peleg's credit broadened to her actual contribution scope —
    // the four-category classification algorithm + threshold definitions +
    // validation cohort + scientific review across every release. Was
    // narrowly "FF-Helix, FF-SSW, Staphylococcus 2023".
    expect(block).toHaveTextContent(/four-category classification/);
    expect(block).toHaveTextContent(/validation cohort/);
  });

  it("credits Prof. Meytal Landau as corresponding author (added 2026-06-08)", () => {
    renderAbout();
    const block = screen.getByTestId("credit-landau");
    expect(block).toHaveTextContent("Prof. Meytal Landau");
    expect(block).toHaveTextContent(/Corresponding author/);
    expect(block).toHaveTextContent(/0000-0002-1743-3430/);
  });

  it("Peleg's ORCID now points to her real ORCID (was 'pending')", () => {
    renderAbout();
    const link = screen.getByTestId("peleg-orcid");
    expect(link).toHaveAttribute("href", "https://orcid.org/0000-0002-0979-8165");
  });

  it("credits Dr. Aleksandr Golubev (DESY) as scientific advisor", () => {
    renderAbout();
    const block = screen.getByTestId("credit-alex");
    expect(block).toHaveTextContent("Dr. Aleksandr Golubev");
    expect(block).toHaveTextContent("DESY");
    expect(block).toHaveTextContent(/Scientific advisor/i);
  });

  it("links Said's ORCID to orcid.org/0009-0002-3596-5358", () => {
    renderAbout();
    const link = screen.getByTestId("said-orcid");
    expect(link).toHaveAttribute(
      "href",
      "https://orcid.org/0009-0002-3596-5358",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer noopener");
  });

  it("renders the Staphylococcus 2023 dataset card on the page", () => {
    renderAbout();
    const card = screen.getByTestId("dataset-credit-card");
    expect(card).toBeInTheDocument();
    expect(card).toHaveTextContent(/Staphylococcus 2023 benchmark/i);
    expect(card).toHaveTextContent(/2,916 peptides/);
  });
});

describe("About page — V10-1 layout redesign", () => {
  it("does NOT render a back button", () => {
    renderAbout();
    // Back button was removed per V10-1 — sidebar handles navigation
    expect(screen.queryByText(/^Back$/)).not.toBeInTheDocument();
  });

  it("renders WaveBackground component", () => {
    renderAbout();
    expect(screen.getByTestId("wave-background")).toBeInTheDocument();
  });

  it("renders hero-scale Peptide Visual Lab title", () => {
    renderAbout();
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Peptide Visual Lab");
  });

  it("shows DESY · Landau Group subtitle", () => {
    renderAbout();
    // Use a combined regex to avoid matching "DESY" in the credits section
    expect(screen.getByText(/DESY .* Landau Group/)).toBeInTheDocument();
  });
});
