import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect } from "vitest";
import { ActionButton } from "../action-buttons";

describe("ActionButton", () => {
  it("renders label when inactive", () => {
    render(<ActionButton label="+ Watchlist" active={false} onClick={vi.fn()} />);
    expect(screen.getByText("+ Watchlist")).toBeInTheDocument();
  });

  it("renders activeLabel when active", () => {
    render(
      <ActionButton label="+ Watchlist" active={true} activeLabel="In Watchlist" onClick={vi.fn()} />
    );
    expect(screen.getByText("In Watchlist")).toBeInTheDocument();
  });

  it("shows ellipsis while loading and re-enables after", async () => {
    let resolve: () => void;
    const onClick = vi.fn(() => new Promise<void>((res) => { resolve = res; }));
    render(<ActionButton label="Mark Watched" active={false} onClick={onClick} />);

    fireEvent.click(screen.getByText("Mark Watched"));
    expect(screen.getByText("…")).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeDisabled();

    resolve!();
    await waitFor(() => expect(screen.getByText("Mark Watched")).toBeInTheDocument());
    expect(screen.getByRole("button")).not.toBeDisabled();
  });

  it("calls onClick when clicked", async () => {
    const onClick = vi.fn().mockResolvedValue(undefined);
    render(<ActionButton label="Click Me" active={false} onClick={onClick} />);
    fireEvent.click(screen.getByText("Click Me"));
    await waitFor(() => expect(onClick).toHaveBeenCalledOnce());
  });
});
