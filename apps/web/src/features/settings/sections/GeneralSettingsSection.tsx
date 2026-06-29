import { Monitor, Settings } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { SelectField } from "../../../components/ui/SelectField";
import type { SettingsPreferences } from "../preferences";
import { GeneralSettingsPreview } from "../SettingsPreviews";
import { SectionHeader, SegmentedSetting, SettingContainer, SettingsGroup } from "../settingsUi";

export function GeneralSettingsSection({
  prefs,
  setPref,
  windowMinimumDraft,
  setWindowMinimumDraft,
  applyWindowMinimumSizePreset,
  commitWindowMinimumSize,
}: {
  prefs: SettingsPreferences;
  setPref: <K extends keyof SettingsPreferences>(key: K, value: SettingsPreferences[K]) => void;
  windowMinimumDraft: { width: string; height: string };
  setWindowMinimumDraft: Dispatch<SetStateAction<{ width: string; height: string }>>;
  applyWindowMinimumSizePreset: (value: SettingsPreferences["windowMinimumSizePreset"]) => void;
  commitWindowMinimumSize: (axis: "width" | "height") => void;
}) {
  return (
    <div id="settings-general" className="scroll-mt-12 flex flex-col gap-6">
      <SectionHeader title="通用" icon={<Settings />} description="基础应用行为偏好。" />
      <SettingsGroup preview={<GeneralSettingsPreview prefs={prefs} />}>
        <SegmentedSetting
          label="启动时打开"
          value={prefs.startupPreference}
          options={[
            { label: "上次的项目", value: "last-project" },
            { label: "主页", value: "home" },
            { label: "项目选择器", value: "home-picker" },
          ]}
          onChange={(value) => setPref("startupPreference", value)}
        />
        <SegmentedSetting
          label="默认工作区"
          value={prefs.defaultWorkspace}
          options={[
            { label: "资产库", value: "assets" },
            { label: "视频", value: "studio-video" },
            { label: "图像", value: "studio-image" },
            { label: "音频", value: "studio-music" },
            { label: "3D", value: "studio-3d" },
          ]}
          onChange={(value) => setPref("defaultWorkspace", value)}
        />
        <SegmentedSetting
          label="UI 密度"
          value={prefs.density}
          options={[
            { label: "宽松", value: "comfortable" },
            { label: "标准", value: "standard" },
            { label: "紧凑", value: "compact" },
          ]}
          onChange={(value) => setPref("density", value)}
        />
        <SettingContainer label="界面最小尺寸">
          <div className="flex flex-wrap items-center gap-3">
            <SelectField
              id="window-minimum-size-preset"
              value={prefs.windowMinimumSizePreset}
              options={[
                { label: "1366 x 768", value: "1366x768" },
                { label: "1440 x 900", value: "1440x900" },
                { label: "1600 x 900", value: "1600x900" },
                { label: "自定义", value: "custom" },
              ]}
              onChange={(value) => applyWindowMinimumSizePreset(value as SettingsPreferences["windowMinimumSizePreset"])}
              className="h-8 w-[120px] text-[12px] bg-surface-app/50 border-border-soft"
            />
            <div className="flex h-8 items-center overflow-hidden rounded-lg border border-border-soft bg-surface-app/50 px-1 shadow-inner">
              <input
                type="number"
                min={1366}
                value={windowMinimumDraft.width}
                onChange={(event) => setWindowMinimumDraft((draft) => ({ ...draft, width: event.target.value }))}
                onBlur={() => commitWindowMinimumSize("width")}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                }}
                className="w-[58px] bg-transparent px-1 text-center font-mono text-[12px] text-text outline-none transition-colors focus:text-brand"
                aria-label="最小宽度"
              />
              <span className="select-none px-1 text-[10px] font-bold text-text-subtle/50">x</span>
              <input
                type="number"
                min={768}
                value={windowMinimumDraft.height}
                onChange={(event) => setWindowMinimumDraft((draft) => ({ ...draft, height: event.target.value }))}
                onBlur={() => commitWindowMinimumSize("height")}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                }}
                className="w-[58px] bg-transparent px-1 text-center font-mono text-[12px] text-text outline-none transition-colors focus:text-brand"
                aria-label="最小高度"
              />
            </div>
          </div>
        </SettingContainer>
        <SegmentedSetting
          label="危险操作确认强度"
          value={prefs.confirmationPreference}
          options={[
            { label: "标准", value: "standard" },
            { label: "严格", value: "strict" },
          ]}
          onChange={(value) => setPref("confirmationPreference", value)}
        />
      </SettingsGroup>

      <SectionHeader title="全局侧边栏偏好" icon={<Monitor />} description="默认的侧栏开合策略。" />
      <SettingsGroup>
        <SegmentedSetting
          label="左栏默认状态"
          value={prefs.sidebarPreference}
          options={[
            { label: "记住状态", value: "remember" },
            { label: "默认展开", value: "expanded" },
            { label: "默认折叠", value: "collapsed" },
          ]}
          onChange={(value) => setPref("sidebarPreference", value)}
        />
        <SegmentedSetting
          label="右栏 (Inspector) 默认状态"
          value={prefs.inspectorPreference}
          options={[
            { label: "记住状态", value: "remember" },
            { label: "默认展开", value: "expanded" },
            { label: "默认折叠", value: "collapsed" },
          ]}
          onChange={(value) => setPref("inspectorPreference", value)}
        />
      </SettingsGroup>
    </div>
  );
}
