import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { AuthProvider, useAuth } from "../auth-context";

const mockLogin = vi.fn();
const mockLogout = vi.fn();
const mockRefresh = vi.fn();
const mockSetTokenHandlers = vi.fn();

vi.mock("@/lib/api", () => ({
  api: {
    login: (...args: unknown[]) => mockLogin(...args),
    logout: (...args: unknown[]) => mockLogout(...args),
    refresh: () => mockRefresh(),
  },
  setTokenHandlers: (...args: unknown[]) => mockSetTokenHandlers(...args),
}));

function TestConsumer() {
  const { token, isLoading, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="loading">{isLoading ? "loading" : "ready"}</span>
      <span data-testid="token">{token ?? "none"}</span>
      <button onClick={() => login("user", "pass")}>Login</button>
      <button onClick={() => logout()}>Logout</button>
    </div>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls refresh on mount and sets token on success", async () => {
    mockRefresh.mockResolvedValue({ accessToken: "refreshed-token" });
    render(<AuthProvider><TestConsumer /></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("ready"));
    expect(screen.getByTestId("token")).toHaveTextContent("refreshed-token");
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it("sets token to null when refresh fails", async () => {
    mockRefresh.mockRejectedValue(new Error("No session"));
    render(<AuthProvider><TestConsumer /></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("ready"));
    expect(screen.getByTestId("token")).toHaveTextContent("none");
  });

  it("sets token after login", async () => {
    mockRefresh.mockRejectedValue(new Error("No session"));
    mockLogin.mockResolvedValue({ accessToken: "new-token" });
    render(<AuthProvider><TestConsumer /></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("ready"));

    await userEvent.click(screen.getByText("Login"));
    await waitFor(() => expect(screen.getByTestId("token")).toHaveTextContent("new-token"));
  });

  it("clears token on logout", async () => {
    mockRefresh.mockResolvedValue({ accessToken: "existing-token" });
    mockLogout.mockResolvedValue(undefined);
    render(<AuthProvider><TestConsumer /></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId("token")).toHaveTextContent("existing-token"));

    await userEvent.click(screen.getByText("Logout"));
    await waitFor(() => expect(screen.getByTestId("token")).toHaveTextContent("none"));
  });
});
