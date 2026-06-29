import { Code, Palette } from "lucide-react";
import type { SettingsPreferences } from "../preferences";
import { CodeEditorPreview, ThemeSelectorPreview, WorkbenchPreview } from "../SettingsPreviews";
import { SectionHeader, SegmentedSetting, SettingsGroup, SwitchSetting } from "../settingsUi";

export function AppearanceSettingsSection({
  prefs,
  setPref,
  onThemePreferenceChange,
}: {
  prefs: SettingsPreferences;
  setPref: <K extends keyof SettingsPreferences>(key: K, value: SettingsPreferences[K]) => void;
  onThemePreferenceChange?: (themePreference: SettingsPreferences["themePreference"]) => void;
}) {
  return (
    <div id="settings-appearance" className="scroll-mt-12 flex flex-col gap-6">
      <SectionHeader title="外观与编辑器" icon={<Palette />} description="软件界面及代码编辑器样式主题。" />
      <SettingsGroup preview={<WorkbenchPreview prefs={prefs} />}>
        <ThemeSelectorPreview
          prefs={prefs}
          onChange={(value) => {
            const nextPreference = value as SettingsPreferences["themePreference"];
            onThemePreferenceChange?.(nextPreference);
            setPref("themePreference", nextPreference);
          }}
        />
      </SettingsGroup>

      <SectionHeader title="代码编辑器" icon={<Code />} description="内置代码及文本编辑器视图偏好。" />
      <SettingsGroup preview={<CodeEditorPreview prefs={prefs} />}>
        <SegmentedSetting
          label="编辑器主题"
          value={prefs.codeEditorTheme}
          options={[
            { label: "跟随主应用", value: "app" },
            { label: "浅色", value: "light" },
            { label: "深色", value: "dark" },
            { label: "高对比度", value: "high-contrast" },
          ]}
          onChange={(value) => setPref("codeEditorTheme", value)}
        />
        <SegmentedSetting
          label="字体大小"
          value={prefs.codeEditorFontSize}
          options={[
            { label: "小", value: "small" },
            { label: "标准", value: "standard" },
            { label: "大", value: "large" },
          ]}
          onChange={(value) => setPref("codeEditorFontSize", value)}
        />
        <SwitchSetting
          label="自动换行"
          checked={prefs.codeEditorWrap === "wrap"}
          onChange={(value) => setPref("codeEditorWrap", value ? "wrap" : "scroll")}
        />
        <SwitchSetting
          label="显示行号"
          checked={prefs.codeEditorLineNumbers === "show"}
          onChange={(value) => setPref("codeEditorLineNumbers", value ? "show" : "hide")}
        />
      </SettingsGroup>
    </div>
  );
}
