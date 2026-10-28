import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { createElement } from "react";
import { OfficeScreen } from "@/features/office/screens/OfficeScreen";
import { AgentStoreProvider } from "@/features/agents/state/store";
import { TeamStoreProvider } from "@/features/teams/store";
import { HQSidebar } from "@/features/office/components/HQSidebar";
import { HeaderBar } from "@/features/agents/components/HeaderBar";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/office",
}));

vi.mock("@/lib/http", () => ({
  fetchJson: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/features/pixel-office/PixelOffice2D", () => ({
  PixelOffice2D: () => createElement("div", { "data-testid": "mock-pixel-office" }),
}));

vi.mock("@/features/retro-office/RetroOffice3D", () => ({
  RetroOffice3D: () => createElement("div", { "data-testid": "mock-retro-office" }),
}));

describe("Office UI: Team Management Entry Point", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders visible Team Management navigation link in OfficeScreen with accessible label and route", () => {
    render(
      createElement(
        AgentStoreProvider,
        null,
        createElement(TeamStoreProvider, null, createElement(OfficeScreen))
      )
    );

    // Look for the Team Management entry point
    const teamLinks = screen.getAllByRole("link", { name: /team management/i });
    expect(teamLinks.length).toBeGreaterThan(0);

    // Verify accessible route to /agents
    const mainNav = teamLinks[0];
    expect(mainNav).toHaveAttribute("href", "/agents");
    expect(mainNav).toBeVisible();
  });

  it("renders Team Management entry point in HQSidebar with accessible label and route", () => {
    render(
      createElement(HQSidebar, {
        open: true,
        activeTab: "inbox",
        inboxCount: 0,
        onToggle: vi.fn(),
        onTabChange: vi.fn(),
        onOpenMarketplace: vi.fn(),
        inboxPanel: createElement("div", null, "Inbox Content"),
        historyPanel: createElement("div", null, "History Content"),
        kanbanPanel: createElement("div", null, "Kanban Content"),
        playbooksPanel: createElement("div", null, "Playbooks Content"),
        analyticsPanel: createElement("div", null, "Analytics Content"),
      })
    );

    const teamLinks = screen.getAllByRole("link", { name: /team management/i });
    expect(teamLinks.length).toBeGreaterThan(0);

    for (const link of teamLinks) {
      expect(link).toHaveAttribute("href", "/agents");
    }
  });

  it("renders Back to Office navigation link in HeaderBar with accessible label and route", () => {
    render(
      createElement(HeaderBar, {
        status: "connected",
        onConnectionSettings: vi.fn(),
      })
    );

    const backLink = screen.getByRole("link", { name: /back to office/i });
    expect(backLink).toBeInTheDocument();
    expect(backLink).toHaveAttribute("href", "/office");
  });
});
