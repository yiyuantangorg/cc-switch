import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GlobalProxyScopeSettings } from "@/components/settings/GlobalProxyScopeSettings";
import type { ProxyScope } from "@/lib/api/globalProxy";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mutateAsyncMock = vi.fn();
let savedScope: ProxyScope = { mode: "all", providers: {} };

vi.mock("@/hooks/useGlobalProxy", () => ({
  useGlobalProxyScope: () => ({ data: savedScope, isLoading: false }),
  useSetGlobalProxyScope: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: false,
  }),
}));

const providers: Record<string, Record<string, unknown>> = {
  claude: {
    official: { id: "official", name: "Anthropic", settingsConfig: {} },
    kimi: { id: "kimi", name: "Kimi", settingsConfig: {} },
  },
  codex: {
    openai: { id: "openai", name: "OpenAI", settingsConfig: {} },
  },
};

vi.mock("@/lib/query", () => ({
  useProvidersQuery: (app: string) => ({
    data: { providers: providers[app] ?? {}, currentProviderId: "" },
  }),
}));

describe("GlobalProxyScopeSettings", () => {
  beforeEach(() => {
    mutateAsyncMock.mockReset();
    savedScope = { mode: "all", providers: {} };
  });

  it("defaults to all providers and hides the provider list", () => {
    render(<GlobalProxyScopeSettings />);

    expect(
      screen.getByRole("button", { name: "settings.globalProxy.scopeAll" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByLabelText("Anthropic")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "common.save" })).toBeDisabled();
  });

  it("saves only the checked providers when switching to selected", async () => {
    render(<GlobalProxyScopeSettings />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "settings.globalProxy.scopeSelected",
      }),
    );
    expect(
      screen.getByText("settings.globalProxy.scopeNoneSelected"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Anthropic"));
    fireEvent.click(screen.getByLabelText("OpenAI"));
    expect(
      screen.queryByText("settings.globalProxy.scopeNoneSelected"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() =>
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        mode: "selected",
        providers: { claude: ["official"], codex: ["openai"] },
      }),
    );
  });

  it("shows the saved selection and can uncheck a provider", async () => {
    savedScope = {
      mode: "selected",
      providers: { claude: ["official", "kimi"] },
    };
    render(<GlobalProxyScopeSettings />);

    expect(screen.getByLabelText("Anthropic")).toBeChecked();
    expect(screen.getByLabelText("Kimi")).toBeChecked();
    expect(screen.getByLabelText("OpenAI")).not.toBeChecked();
    expect(screen.getByRole("button", { name: "common.save" })).toBeDisabled();

    fireEvent.click(screen.getByLabelText("Kimi"));
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() =>
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        mode: "selected",
        providers: { claude: ["official"] },
      }),
    );
  });
});
