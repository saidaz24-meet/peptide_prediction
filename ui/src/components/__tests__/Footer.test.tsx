/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Footer } from "../Footer";

function renderFooter() {
  return render(
    <MemoryRouter>
      <Footer />
    </MemoryRouter>,
  );
}

describe("Footer", () => {
  it("renders the footer element", () => {
    renderFooter();
    expect(screen.getByTestId("pvl-footer")).toBeInTheDocument();
  });

  it("renders all 4 column headings", () => {
    renderFooter();
    expect(screen.getByText("Product")).toBeInTheDocument();
    expect(screen.getByText("Resources")).toBeInTheDocument();
    expect(screen.getByText("Citation")).toBeInTheDocument();
    expect(screen.getByText("Legal")).toBeInTheDocument();
  });

  it("renders product links", () => {
    renderFooter();
    expect(screen.getByText("Features")).toBeInTheDocument();
    expect(screen.getByText("Demo")).toBeInTheDocument();
    expect(screen.getByText("Self-host")).toBeInTheDocument();
    expect(screen.getByText("Quick Analyze")).toBeInTheDocument();
  });

  it("renders resource links", () => {
    renderFooter();
    expect(screen.getByText("Help & Docs")).toBeInTheDocument();
    expect(screen.getByText("GitHub")).toBeInTheDocument();
    expect(screen.getByText("Report Issue")).toBeInTheDocument();
    expect(screen.getByText("About")).toBeInTheDocument();
  });

  it("renders citation links", () => {
    renderFooter();
    expect(screen.getByText("DOI (mints on release)")).toBeInTheDocument();
    expect(screen.getByText("BibTeX")).toBeInTheDocument();
    expect(screen.getByText("JOSS Paper (in submission)")).toBeInTheDocument();
  });

  it("renders legal links", () => {
    renderFooter();
    expect(screen.getByText("MIT License")).toBeInTheDocument();
    expect(screen.getByText("Privacy Policy")).toBeInTheDocument();
  });

  it("renders team credits", () => {
    renderFooter();
    expect(screen.getByText("Peptide Visual Lab")).toBeInTheDocument();
    expect(screen.getByText("Said Azaizah")).toBeInTheDocument();
    expect(screen.getByText("Dr. Peleg Ragonis-Bachar")).toBeInTheDocument();
    expect(screen.getByText("Dr. Aleksandr Golubev")).toBeInTheDocument();
  });

  it("renders copyright with current year", () => {
    renderFooter();
    const year = new Date().getFullYear();
    expect(screen.getByText(`© ${year} PVL`)).toBeInTheDocument();
  });

  it("disabled links are not clickable", () => {
    renderFooter();
    const doiEl = screen.getByText("DOI (mints on release)");
    expect(doiEl.tagName.toLowerCase()).toBe("span");
    expect(doiEl).toHaveClass("cursor-default");
  });

  it("external links open in new tab", () => {
    renderFooter();
    const ghLinks = screen.getAllByText("GitHub");
    // The footer GitHub link should be an <a> with target=_blank
    const footerGh = ghLinks.find(
      (el) => el.tagName.toLowerCase() === "a",
    );
    expect(footerGh).toHaveAttribute("target", "_blank");
    expect(footerGh).toHaveAttribute("rel", "noopener noreferrer");
  });
});
