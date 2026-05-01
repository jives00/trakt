import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect } from "vitest";
import { TopNav } from "../top-nav";

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

describe("TopNav", () => {
  it("renders the TRAKT logo link", () => {
    render(<TopNav />);
    expect(screen.getByText("TRAKT")).toBeInTheDocument();
  });

  it("renders primary nav links", () => {
    render(<TopNav />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Search")).toBeInTheDocument();
    expect(screen.getByText("History")).toBeInTheDocument();
  });

  it("logo links to /", () => {
    render(<TopNav />);
    const logo = screen.getByText("TRAKT").closest("a");
    expect(logo).toHaveAttribute("href", "/");
  });
});
