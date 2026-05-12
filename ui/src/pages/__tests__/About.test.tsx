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

vi.mock("@/components/BgNotebook", () => ({
  BgNotebook: () => null,
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

  it("credits Said Azaizah with lead-developer / full-stack role (never 'Founder' — feedback_said_credit_phrasing.md)", () => {
    renderAbout();
    const block = screen.getByTestId("credit-said");
    expect(block).toHaveTextContent("Said Azaizah");
    expect(block).toHaveTextContent(/Lead developer/);
    expect(block).toHaveTextContent(/full-stack/);
    // Guard: 'Founder' must NEVER appear in Said's credit block.
    expect(block.textContent ?? "").not.toMatch(/\bFounder\b/);
  });

  it("credits Dr. Peleg Ragonis-Bachar (Technion) for algorithms", () => {
    renderAbout();
    const block = screen.getByTestId("credit-peleg");
    expect(block).toHaveTextContent("Dr. Peleg Ragonis-Bachar");
    expect(block).toHaveTextContent("Technion");
    expect(block).toHaveTextContent(/FF-Helix/);
    expect(block).toHaveTextContent(/Staphylococcus 2023/);
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
