import { Box, Cpu, Play, RefreshCw, Square } from "lucide-react";
import type { RuntimeSummary } from "../../../api";
import { Button } from "../../../components/ui/Button";
import { McpPackageManager } from "../McpPackageManager";
import type { SettingsPreferences } from "../preferences";
import { SectionHeader, SegmentedSetting, SettingContainer, SettingsGroup } from "../settingsUi";

export function RuntimeSettingsSection({
  prefs,
  setPref,
  runtime,
  busy,
  onStartRuntime,
  onStopRuntime,
  onRefreshTools,
  onDeveloperUnlock,
}: {
  prefs: SettingsPreferences;
  setPref: <K extends keyof SettingsPreferences>(key: K, value: SettingsPreferences[K]) => void;
  runtime?: RuntimeSummary;
  busy: boolean;
  onStartRuntime: () => void;
  onStopRuntime: () => void;
  onRefreshTools: () => void;
  onDeveloperUnlock: () => void;
}) {
  return (
    <div id="settings-runtime" className="scroll-mt-12 flex flex-col gap-6">
      <SectionHeader title="MCP 运行时" icon={<Cpu />} description="当前项目的 MCP 服务控制与 MCP 包环境管理。" />
      <SettingsGroup>
        <SegmentedSetting
          label="自动启动策略"
          value={prefs.autoRuntime}
          options={[
            { label: "手动控制", value: "manual" },
            { label: "选中项目后启动", value: "selected-project" },
          ]}
          onChange={(value) => setPref("autoRuntime", value)}
        />
        <SettingContainer label="服务管理" description="管理当前项目的运行时进程。">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onStartRuntime} disabled={busy || runtime?.status === "ready"}>
              <Play className="mr-1 h-3.5 w-3.5" />
              启动
            </Button>
            <Button variant="outline" size="sm" onClick={onStopRuntime} disabled={busy || runtime?.status === "idle"}>
              <Square className="mr-1 h-3.5 w-3.5" />
              停止
            </Button>
            <Button variant="outline" size="sm" onClick={onRefreshTools} disabled={busy}>
              <RefreshCw className="mr-1 h-3.5 w-3.5" />
              重载 Tools
            </Button>
          </div>
        </SettingContainer>
      </SettingsGroup>
      <SectionHeader title="MCP 包管理" icon={<Box />} description="管理桌面端 MCP (Model Context Protocol) 运行时与环境。" />
      <McpPackageManager busy={busy} onDeveloperUnlock={onDeveloperUnlock} />
    </div>
  );
}
