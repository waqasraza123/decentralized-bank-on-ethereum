import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { adminLocaleStorageKey } from "../i18n/provider";
import App from "../App";

vi.mock("@stealth-trails-bank/config/web", () => ({
  loadWebRuntimeConfig: () => ({
    serverUrl: "http://localhost:9001"
  })
}));

describe("Admin console", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = "en";
    document.documentElement.dir = "ltr";
  });

  it("renders the operator console shell and credential form", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Operator Console" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Operations Overview" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Queues")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Treasury")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Credentials required/i)
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Operator Access Token")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Save Session" })
    ).toBeInTheDocument();
  });

  it("persists the saved operator session and restores it on the next render", async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.type(screen.getByLabelText("Operator Access Token"), "session-token");
    await user.click(screen.getByRole("button", { name: "Save Session" }));

    await waitFor(() => {
      expect(
        window.localStorage.getItem(
          "stealth-trails-bank.admin.operator-session-settings"
        )
      ).toContain("\"baseUrl\":\"http://localhost:9001\"");
    });

    cleanup();
    render(<App />);

    expect(screen.getByLabelText("Operator Access Token")).toHaveValue(
      "session-token"
    );
  });

  it("switches the shell into Arabic and persists document rtl state", async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(screen.getByRole("button", { name: "العربية" }));

    expect(
      await screen.findByRole("heading", { name: "وحدة تحكم المشغل" })
    ).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("ar");
    expect(document.documentElement.dir).toBe("rtl");
    expect(window.localStorage.getItem(adminLocaleStorageKey)).toBe("ar");
  });
});
