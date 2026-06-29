import { Grid3X3 } from "lucide-react";
import type { SettingsPreferences } from "../preferences";
import { TaskInspectorPreview } from "../SettingsPreviews";
import { SectionHeader, SegmentedSetting, SettingsGroup, SwitchSetting } from "../settingsUi";

export function TasksNotificationsSettingsSection({
  prefs,
  setPref,
}: {
  prefs: SettingsPreferences;
  setPref: <K extends keyof SettingsPreferences>(key: K, value: SettingsPreferences[K]) => void;
}) {
  return (
    <div id="settings-tasks" className="scroll-mt-12 flex flex-col gap-6">
      <SectionHeader title="任务与通知" icon={<Grid3X3 />} description="任务面板展现与通知策略。" />
      <SettingsGroup preview={<TaskInspectorPreview prefs={prefs} />}>
        <SegmentedSetting
          label="点击任务默认展示"
          value={prefs.taskDefaultPanel}
          options={[
            { label: "状态", value: "status" },
            { label: "日志", value: "logs" },
            { label: "错误", value: "errors" },
          ]}
          onChange={(value) => setPref("taskDefaultPanel", value)}
        />
        <SwitchSetting label="开启任务异常桌面通知" checked={prefs.failureNotifications} onChange={(value) => setPref("failureNotifications", value)} />
        <SwitchSetting label="任务失败时自动弹出错误日志" checked={prefs.autoOpenErrors} onChange={(value) => setPref("autoOpenErrors", value)} />
        <SwitchSetting
          label="生成类任务完成后自动刷新"
          checked={prefs.taskCompletionRefresh === "on"}
          onChange={(value) => setPref("taskCompletionRefresh", value ? "on" : "off")}
        />
      </SettingsGroup>
    </div>
  );
}
