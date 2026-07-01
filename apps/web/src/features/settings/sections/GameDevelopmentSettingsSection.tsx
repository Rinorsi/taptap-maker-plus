import { Gamepad2, MonitorSmartphone, PanelTop, PictureInPicture, VolumeX } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../../../components/ui/Button";
import type { SettingsPreferences } from "../preferences";
import { PreferenceNote, SectionHeader, SegmentedSetting, SettingContainer, SettingsGroup } from "../settingsUi";

export function GameDevelopmentSettingsSection({
  prefs,
  setPref,
}: {
  prefs: SettingsPreferences;
  setPref: <K extends keyof SettingsPreferences>(key: K, value: SettingsPreferences[K]) => void;
}) {
  return (
    <div id="settings-game-development" className="scroll-mt-12 flex flex-col gap-6">
      <SectionHeader title="游戏开发" icon={<Gamepad2 />} description="TapTap Maker 预览、登录态和后台实例策略。" />
      <SettingsGroup preview={<GameDevelopmentPreview prefs={prefs} />}>
        <SegmentedSetting
          label="登录态保存"
          description="控制桌面端 Maker WebView 是否保留已登录会话。"
          value={prefs.makerPreviewSession}
          options={[
            { label: "保存登录态", value: "keep" },
            { label: "退出时清空", value: "clear-on-exit" },
          ]}
          onChange={(value) => setPref("makerPreviewSession", value)}
        />
        <SettingContainer label="清空登录态" description="清空按钮会在桌面端 cookie 清理命令接入后启用。">
          <Button variant="outline" size="sm" disabled>
            待接入
          </Button>
        </SettingContainer>
      </SettingsGroup>

      <SettingsGroup>
        <SegmentedSetting
          label="切走游戏开发页"
          description="当前默认切走即隐藏并停掉嵌入预览；后台保留接口先保存在设置里。"
          value={prefs.makerPreviewBackground}
          options={[
            { label: "切走即关闭", value: "hide" },
            { label: "后台保留", value: "keep" },
          ]}
          onChange={(value) => setPref("makerPreviewBackground", value)}
        />
        <SegmentedSetting
          label="后台声音"
          description="后台保留启用后使用；当前先保存偏好，后续接入原生静音控制。"
          value={prefs.makerPreviewBackgroundAudio}
          options={[
            { label: "后台静音", value: "mute" },
            { label: "保持声音", value: "keep" },
          ]}
          onChange={(value) => setPref("makerPreviewBackgroundAudio", value)}
        />
        <SegmentedSetting
          label="窗口模式"
          description="控制游戏开发与资源生成是否继续同窗，独立窗口实现后读取该偏好。"
          value={prefs.makerPreviewWindowMode}
          options={[
            { label: "嵌入工作台", value: "embedded" },
            { label: "独立窗口", value: "separate" },
          ]}
          onChange={(value) => setPref("makerPreviewWindowMode", value)}
        />
        <PreferenceNote text="活跃实例提示已接入顶部和侧栏；鼠标悬停会显示运行中与静音状态。" />
      </SettingsGroup>
    </div>
  );
}

function GameDevelopmentPreview({ prefs }: { prefs: SettingsPreferences }) {
  const keepsBackground = prefs.makerPreviewBackground === "keep";
  const muted = prefs.makerPreviewBackgroundAudio === "mute";
  const separate = prefs.makerPreviewWindowMode === "separate";

  return (
    <div className="flex w-full max-w-[320px] flex-col gap-3 rounded-xl border border-border-soft bg-surface-app p-4 shadow-inner">
      <div className="flex items-center justify-between rounded-lg border border-border-soft bg-surface-panel px-3 py-2">
        <div className="flex min-w-0 items-center gap-2 text-[12px] font-semibold text-text">
          <MonitorSmartphone className="h-4 w-4 text-brand" />
          <span className="truncate">游戏开发</span>
        </div>
        <span className="h-2 w-2 rounded-full border border-[#00ffeb] bg-[#00d9c5] shadow-[0_0_8px_rgba(0,217,197,0.85)]" />
      </div>
      <div className="grid grid-cols-2 gap-2 text-[11px] text-text-muted">
        <PreviewStatus icon={<PanelTop className="h-3.5 w-3.5" />} label={keepsBackground ? "后台保留" : "切走关闭"} />
        <PreviewStatus icon={<VolumeX className="h-3.5 w-3.5" />} label={muted ? "后台静音" : "保持声音"} />
        <PreviewStatus icon={<PictureInPicture className="h-3.5 w-3.5" />} label={separate ? "独立窗口" : "嵌入工作台"} />
        <PreviewStatus icon={<Gamepad2 className="h-3.5 w-3.5" />} label={prefs.makerPreviewSession === "keep" ? "保存登录" : "退出清空"} />
      </div>
    </div>
  );
}

function PreviewStatus({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 rounded-md border border-border-soft bg-surface-panel px-2 py-1.5">
      <span className="shrink-0 text-text-subtle">{icon}</span>
      <span className="truncate">{label}</span>
    </div>
  );
}
