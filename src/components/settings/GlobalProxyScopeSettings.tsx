/**
 * 路由请求的出站代理范围
 *
 * 选择本地路由转发到哪些供应商时走全局出站代理：全部供应商（默认），或只走勾选的供应商、
 * 其余直连。只影响路由转发和供应商连通性检查，登录、Skills 下载、云同步等照旧走全局代理。
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { APP_DISPLAY_NAME, AppGlyph } from "@/components/shell/AppGlyph";
import { MODE_APP_IDS, type ModeAppId } from "@/config/appConfig";
import { useProvidersQuery } from "@/lib/query";
import {
  useGlobalProxyScope,
  useSetGlobalProxyScope,
  type ProxyScope,
} from "@/hooks/useGlobalProxy";
import type { Provider } from "@/types";

type ScopeMode = ProxyScope["mode"];

/** 和供应商列表同一个顺序：拖拽排序优先，其次创建时间，最后按名称 */
function sortProviders(providers: Record<string, Provider>): Provider[] {
  return Object.values(providers).sort((a, b) => {
    if (a.sortIndex !== undefined && b.sortIndex !== undefined) {
      return a.sortIndex - b.sortIndex;
    }
    if (a.sortIndex !== undefined) return -1;
    if (b.sortIndex !== undefined) return 1;
    const timeA = a.createdAt ?? 0;
    const timeB = b.createdAt ?? 0;
    if (timeA && timeB && timeA !== timeB) return timeA - timeB;
    return a.name.localeCompare(b.name);
  });
}

/** 比较两份勾选是否相同（忽略顺序和空应用） */
function sameSelection(
  a: Record<string, string[]>,
  b: Record<string, string[]>,
): boolean {
  const normalize = (value: Record<string, string[]>) =>
    Object.entries(value)
      .filter(([, ids]) => ids.length > 0)
      .map(([app, ids]) => `${app}:${[...ids].sort().join(",")}`)
      .sort()
      .join("|");
  return normalize(a) === normalize(b);
}

export function GlobalProxyScopeSettings() {
  const { t } = useTranslation();
  const { data: savedScope, isLoading } = useGlobalProxyScope();
  const saveMutation = useSetGlobalProxyScope();

  const providersByApp: Record<
    ModeAppId,
    Record<string, Provider> | undefined
  > = {
    claude: useProvidersQuery("claude").data?.providers,
    codex: useProvidersQuery("codex").data?.providers,
    gemini: useProvidersQuery("gemini").data?.providers,
    grokbuild: useProvidersQuery("grokbuild").data?.providers,
    "claude-desktop": useProvidersQuery("claude-desktop").data?.providers,
  };

  const [mode, setMode] = useState<ScopeMode>("all");
  const [selected, setSelected] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (savedScope) {
      setMode(savedScope.mode);
      setSelected(savedScope.providers ?? {});
    }
  }, [savedScope]);

  const groups = MODE_APP_IDS.map((app) => ({
    app,
    providers: sortProviders(providersByApp[app] ?? {}),
  })).filter((group) => group.providers.length > 0);

  // 只数还存在的供应商：删掉的供应商留在配置里不影响转发，也不该算进「已勾选」
  const selectedCount = groups.reduce(
    (count, { app, providers }) =>
      count +
      providers.filter((p) => selected[app]?.includes(p.id) ?? false).length,
    0,
  );

  const dirty =
    !!savedScope &&
    (mode !== savedScope.mode ||
      !sameSelection(selected, savedScope.providers ?? {}));

  const toggle = (app: string, providerId: string, checked: boolean) => {
    setSelected((prev) => {
      const current = prev[app] ?? [];
      const next = checked
        ? current.includes(providerId)
          ? current
          : [...current, providerId]
        : current.filter((id) => id !== providerId);
      return { ...prev, [app]: next };
    });
  };

  const handleSave = async () => {
    try {
      await saveMutation.mutateAsync({ mode, providers: selected });
    } catch {
      // useSetGlobalProxyScope 的 onError 已经弹过 toast
    }
  };

  if (isLoading && savedScope === undefined) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-5 w-5 animate-spin text-fg-2" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl<ScopeMode>
          aria-label={t("settings.globalProxy.scopeAria")}
          value={mode}
          onValueChange={setMode}
          items={[
            { value: "all", label: t("settings.globalProxy.scopeAll") },
            {
              value: "selected",
              label: t("settings.globalProxy.scopeSelected"),
            },
          ]}
        />
        <Button
          onClick={() => void handleSave()}
          disabled={!dirty || saveMutation.isPending}
          size="sm"
        >
          {saveMutation.isPending && (
            <Loader2 className="h-4 w-4 animate-spin" />
          )}
          {t("common.save")}
        </Button>
      </div>

      <p className="text-sm text-fg-2">
        {mode === "all"
          ? t("settings.globalProxy.scopeAllHint")
          : t("settings.globalProxy.scopeSelectedHint")}
      </p>

      {mode === "selected" &&
        (groups.length === 0 ? (
          <p className="text-sm text-fg-2">
            {t("settings.globalProxy.scopeNoProviders")}
          </p>
        ) : (
          <div className="space-y-4">
            {selectedCount === 0 && (
              <p className="text-sm text-warning">
                {t("settings.globalProxy.scopeNoneSelected")}
              </p>
            )}
            {groups.map(({ app, providers }) => (
              <fieldset key={app} className="space-y-2">
                <legend className="mb-2 flex items-center gap-2 text-body font-medium text-fg-1">
                  <AppGlyph app={app} />
                  {APP_DISPLAY_NAME[app]}
                </legend>
                <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
                  {providers.map((provider) => {
                    const id = `proxy-scope-${app}-${provider.id}`;
                    return (
                      <label
                        key={provider.id}
                        htmlFor={id}
                        className="flex min-w-0 cursor-pointer items-center gap-2 text-sm text-fg-1"
                      >
                        <Checkbox
                          id={id}
                          checked={
                            selected[app]?.includes(provider.id) ?? false
                          }
                          onCheckedChange={(checked) =>
                            toggle(app, provider.id, checked)
                          }
                        />
                        <span className="truncate">{provider.name}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>
        ))}
    </div>
  );
}
