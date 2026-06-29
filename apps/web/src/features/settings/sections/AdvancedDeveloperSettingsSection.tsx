import { Bell, Bot, Bug, CheckCircle2, Download, MonitorCog, Shield, Terminal, Trash2 } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import type { SettingsPreferences } from "../preferences";
import { PreferenceNote, SectionHeader, SegmentedSetting, SettingContainer, SettingsGroup, SwitchSetting } from "../settingsUi";

export type DiagnosticExportState = {
  status: "idle" | "working" | "done" | "error";
  message: string;
  zipPath?: string;
};

export function AdvancedDeveloperSettingsSection({
  prefs,
  setPref,
  developerOptionsUnlocked,
  developerMode,
  developerLogCount,
  diagnosticExportState,
  resetInitialStateText,
  resetInitialStateNotice,
  setResetInitialStateText,
  setDeveloperModeEnabled,
  onCheckDesktopResources,
  onExportLogs,
  onClearLogs,
  onOpenDesktopDevtools,
  onResetInitialState,
}: {
  prefs: SettingsPreferences;
  setPref: <K extends keyof SettingsPreferences>(key: K, value: SettingsPreferences[K]) => void;
  developerOptionsUnlocked: boolean;
  developerMode: boolean;
  developerLogCount: number;
  diagnosticExportState: DiagnosticExportState;
  resetInitialStateText: string;
  resetInitialStateNotice: string;
  setResetInitialStateText: (value: string) => void;
  setDeveloperModeEnabled: (enabled: boolean) => void;
  onCheckDesktopResources: () => void;
  onExportLogs: () => void;
  onClearLogs: () => void;
  onOpenDesktopDevtools: () => void;
  onResetInitialState: () => void;
}) {
  return (
    <div id="settings-advanced" className="scroll-mt-12 flex flex-col gap-6">
      <SectionHeader title="高级" icon={<Bug />} description="诊断日志、开发者功能，以及未接入的高级配置入口。" />

      <div className="pointer-events-none flex flex-col gap-6 opacity-60 grayscale">
        <SectionHeader title="个性化" icon={<Bot />} badge="未接入" description="AI 智能助手的偏好与自定义指令。" />
        <SettingsGroup>
          <PreferenceNote text="这里还没有接入真实模型配置；下面只保留后续 UI 形态。" />
          <SegmentedSetting
            label="默认模型偏好"
            value="gpt-5-4"
            options={[
              { label: "GPT-5.4", value: "gpt-5-4" },
              { label: "Claude Sonnet 4.5", value: "claude-sonnet-4-5" },
            ]}
            onChange={() => {}}
          />
          <SwitchSetting label="自动附加项目上下文" checked={true} onChange={() => {}} />
          <SettingContainer label="自定义指令" description="助手生成代码和思考时的基础规则">
            <Button variant="outline" size="sm">编辑规则 (0)</Button>
          </SettingContainer>
        </SettingsGroup>

        <SectionHeader title="浏览器" icon={<MonitorCog />} badge="未接入" description="内置 Chromium 浏览器设置。" />
        <SettingsGroup>
          <PreferenceNote text="当前没有可用配置入口；下面的开关不会生效。" />
          <SwitchSetting label="禁用同源策略 (CORS)" checked={false} onChange={() => {}} />
          <SwitchSetting label="默认清空缓存并硬性重新加载" checked={true} onChange={() => {}} />
        </SettingsGroup>

        <SectionHeader title="权限" icon={<Shield />} badge="未接入" description="管理 MCP 工具的自动审批与访问策略。" />
        <SettingsGroup>
          <PreferenceNote text="当前没有接入权限策略保存与执行链路；下面的控件不会生效。" />
          <SettingContainer label="工作区访问策略" description="定义智能助手读写文件的范围和确认机制。">
            <Button variant="outline" size="sm">管理策略</Button>
          </SettingContainer>
          <SwitchSetting label="执行终端命令前总是询问" checked={true} onChange={() => {}} />
        </SettingsGroup>
      </div>

      <SectionHeader title="日志与通知" icon={<Bell />} description="软件诊断日志及运行记录留存策略。" />
      <SettingsGroup>
        <SettingContainer
          label="高级诊断报告"
          description={
            diagnosticExportState.message
              ? `${diagnosticExportState.message}${diagnosticExportState.zipPath ? ` 路径：${diagnosticExportState.zipPath}` : ""}`
              : "打包当前软件、MCP Runtime、前端错误和项目日志快照。"
          }
        >
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onCheckDesktopResources}
              disabled={diagnosticExportState.status === "working"}
            >
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> 检查安装资源
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onExportLogs}
              disabled={diagnosticExportState.status === "working"}
            >
              <Download className="mr-1 h-3.5 w-3.5" />
              {diagnosticExportState.status === "working" ? "处理中" : "导出诊断包"}
            </Button>
          </div>
        </SettingContainer>
        <SettingContainer label="本地运行日志缓存" description={`当前已缓存 ${developerLogCount} 条开发者日志记录`}>
          <Button variant="outline" size="sm" onClick={onClearLogs} className="hover:border-red-400 hover:text-red-400">
            <Trash2 className="mr-1 h-3.5 w-3.5" /> 清空日志
          </Button>
        </SettingContainer>
        <SegmentedSetting
          label="诊断日志保留策略"
          value={prefs.logRetention}
          options={[
            { label: "14 天", value: "14d" },
            { label: "30 天", value: "30d" },
            { label: "100 MB", value: "100mb" },
            { label: "手动", value: "manual" },
          ]}
          onChange={(value) => setPref("logRetention", value)}
        />
      </SettingsGroup>

      {developerOptionsUnlocked ? (
        <>
          <SectionHeader title="开发者" icon={<Bug />} description="供开发者或高级用户使用的实验性功能。" />
          <SettingsGroup>
            <SwitchSetting
              label="启用开发者模式"
              description="开启后将记录更详尽的系统级调试日志"
              checked={developerMode}
              onChange={setDeveloperModeEnabled}
            />
            <SettingContainer label="Chromium DevTools" description="开启内置浏览器及前端环境的检查器">
              <Button variant="outline" size="sm" onClick={onOpenDesktopDevtools}>
                <Terminal className="mr-1 h-3.5 w-3.5" />
                Open Devtools
              </Button>
            </SettingContainer>
            <SettingContainer
              label={<span className="text-red-500">重置软件为初始状态</span>}
              description={
                <span>
                  清空桌面端保存的项目列表、选中项目、任务/资产索引和设置偏好，并停止当前 MCP runtime。不删除 Maker 项目目录，不清 npm-cache，不改 AI client 配置。
                  {resetInitialStateNotice ? ` ${resetInitialStateNotice}` : ""}
                </span>
              }
            >
              <div className="flex flex-wrap justify-end gap-2">
                <input
                  value={resetInitialStateText}
                  onChange={(event) => setResetInitialStateText(event.target.value)}
                  placeholder="输入：重置软件"
                  className="h-9 w-[180px] rounded-control border border-border bg-surface-app px-3 text-[12px] text-text outline-none focus:border-red-500"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onResetInitialState}
                  disabled={resetInitialStateText !== "重置软件"}
                  className="hover:border-red-500 hover:text-red-500"
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  确认重置
                </Button>
              </div>
            </SettingContainer>
          </SettingsGroup>
        </>
      ) : null}
    </div>
  );
}
