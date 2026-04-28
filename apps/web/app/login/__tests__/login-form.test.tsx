import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { LoginForm } from "../login-form";

const mockLogin = vi.fn();
const mockPush = vi.fn();

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ login: mockLogin, token: null, isLoading: false, logout: vi.fn() }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders username, password, and submit button", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("calls login with credentials and redirects on success", async () => {
    mockLogin.mockResolvedValue(undefined);
    render(<LoginForm />);

    await userEvent.type(screen.getByLabelText(/username/i), "admin");
    await userEvent.type(screen.getByLabelText(/password/i), "secret");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith("admin", "secret"));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/"));
  });

  it("shows error message on failed login", async () => {
    mockLogin.mockRejectedValue(new Error("Invalid credentials"));
    render(<LoginForm />);

    await userEvent.type(screen.getByLabelText(/username/i), "admin");
    await userEvent.type(screen.getByLabelText(/password/i), "wrong");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Invalid credentials")
    );
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("disables the button while submitting", async () => {
    let resolve: (v: void) => void;
    mockLogin.mockReturnValue(new Promise<void>((r) => { resolve = r; }));
    render(<LoginForm />);

    await userEvent.type(screen.getByLabelText(/username/i), "admin");
    await userEvent.type(screen.getByLabelText(/password/i), "secret");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(screen.getByRole("button", { name: /signing in/i })).toBeDisabled();
    resolve!();
  });
});
