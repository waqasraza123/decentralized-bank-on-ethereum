import { render, screen } from "@testing-library/react";
import App from "../App";

vi.mock("@stealth-trails-bank/config/web", () => ({
  loadWebRuntimeConfig: () => ({
    serverUrl: "http://localhost:9001"
  })
}));

describe("Admin console", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders the operator console shell and credential form", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Operator Console" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Ledger reconciliation" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Platform audit log" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Treasury visibility" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Route critical alerts" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Operator ID")).toBeInTheDocument();
    expect(screen.getByLabelText("Operator API Key")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Save Session" })
    ).toBeInTheDocument();
  });
});
