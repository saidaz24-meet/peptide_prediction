/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DatasetCreditCard } from "../DatasetCreditCard";

describe("DatasetCreditCard", () => {
  describe("default variant", () => {
    it("renders the card root", () => {
      render(<DatasetCreditCard />);
      expect(screen.getByTestId("dataset-credit-card")).toBeInTheDocument();
    });

    it("displays the dataset name", () => {
      render(<DatasetCreditCard />);
      expect(
        screen.getByText(/Staphylococcus 2023 benchmark/i),
      ).toBeInTheDocument();
    });

    it("shows the N stat (2,916 peptides)", () => {
      render(<DatasetCreditCard />);
      expect(screen.getByTestId("dataset-stat-n")).toHaveTextContent(
        /2,916 peptides/,
      );
    });

    it("shows the validated count (66)", () => {
      render(<DatasetCreditCard />);
      expect(screen.getByTestId("dataset-stat-validated")).toHaveTextContent(
        /66 experimentally validated/,
      );
    });

    it("credits Dr. Peleg Ragonis-Bachar", () => {
      render(<DatasetCreditCard />);
      const provider = screen.getByTestId("dataset-provider");
      expect(provider).toHaveTextContent(/Dr\. Peleg Ragonis-Bachar/);
      expect(provider).toHaveTextContent(/Technion, 2023/);
    });

    it("includes the 2026-05-08 release note", () => {
      render(<DatasetCreditCard />);
      expect(screen.getByText(/Released 2026-05-08/)).toBeInTheDocument();
    });

    it("links to the UniProt S. aureus reference proteome", () => {
      render(<DatasetCreditCard />);
      const link = screen.getByTestId("dataset-uniprot-link");
      expect(link).toHaveAttribute(
        "href",
        "https://www.uniprot.org/proteomes/UP000008816",
      );
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noreferrer noopener");
    });
  });

  describe("compact variant", () => {
    it("renders the compact root", () => {
      render(<DatasetCreditCard variant="compact" />);
      expect(
        screen.getByTestId("dataset-credit-card-compact"),
      ).toBeInTheDocument();
    });

    it("does NOT render the default-variant card", () => {
      render(<DatasetCreditCard variant="compact" />);
      expect(screen.queryByTestId("dataset-credit-card")).toBeNull();
    });

    it("still credits Peleg + shows the N value", () => {
      render(<DatasetCreditCard variant="compact" />);
      const root = screen.getByTestId("dataset-credit-card-compact");
      expect(root).toHaveTextContent(/Dr\. Peleg Ragonis-Bachar/);
      expect(root).toHaveTextContent(/2,916 peptides/);
      expect(root).toHaveTextContent(/66 experimentally validated/);
    });

    it("exposes an aria-label for assistive tech", () => {
      render(<DatasetCreditCard variant="compact" />);
      expect(
        screen.getByLabelText("Staphylococcus 2023 dataset attribution"),
      ).toBeInTheDocument();
    });
  });

  describe("className passthrough", () => {
    it("forwards className on the default variant", () => {
      render(<DatasetCreditCard className="my-extra-padding" />);
      const root = screen.getByTestId("dataset-credit-card");
      expect(root.className).toContain("my-extra-padding");
    });

    it("forwards className on the compact variant", () => {
      render(<DatasetCreditCard variant="compact" className="my-strip" />);
      const root = screen.getByTestId("dataset-credit-card-compact");
      expect(root.className).toContain("my-strip");
    });
  });
});
