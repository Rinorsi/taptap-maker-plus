import { CheckCircle2, CircleAlert, RefreshCw, RotateCcw, Save } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { cn } from "../../lib/utils";
import type { SettingsPersistenceState } from "./useSettingsPersistence";

export function SettingsPersistenceBar({
  state,
  label,
  onResetDefaults,
  onSaveNow,
}: {
  state: SettingsPersistenceState;
  label: string;
  onResetDefaults: () => void;
  onSaveNow: () => void;
}) {
  const isSaving = state.status === "saving-local" || state.status === "local-applied";
  const isFailed = state.status === "failed";
  const isFallback = state.status === "backend-fallback";

  return (
    <div className="workbench-top-scrim flex min-h-[52px] shrink-0 items-center justify-between gap-4 border-b border-border-soft px-8">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
            isFailed
              ? "border-red-500/30 bg-red-500/10 text-red-500"
              : isFallback
                ? "border-amber-500/30 bg-amber-500/10 text-amber-500"
                : isSaving
                  ? "border-brand/30 bg-brand/10 text-brand"
                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
          )}
        >
          {isSaving ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : isFailed || isFallback ? (
            <CircleAlert className="h-4 w-4" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-text">设置偏好</div>
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                "truncate text-[11px]",
                isFailed
                  ? "text-red-500"
                  : isFallback
                    ? "text-amber-500"
                    : state.status === "saved-local"
                      ? "text-emerald-500"
                      : "text-text-subtle",
              )}
              title={label}
            >
              {label}
            </span>
            <span
              className="inline-flex h-5 shrink-0 items-center rounded-full border border-border-soft bg-surface-muted px-2 text-[10px] font-medium text-text-subtle"
              title="设置修改后会先临时应用，再自动写入桌面端本地配置。"
            >
              自动保存开启
            </span>
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={onResetDefaults}>
          <RotateCcw className="h-3.5 w-3.5" />
          重置默认
        </Button>
        <Button size="sm" className="gap-1.5" onClick={onSaveNow} disabled={isSaving}>
          <Save className="h-3.5 w-3.5" />
          保存
        </Button>
      </div>
    </div>
  );
}
