import { Box } from "lucide-react";
import type { SettingsPreferences } from "../preferences";
import { WorkspaceDefaultsPreview } from "../SettingsPreviews";
import { SectionHeader, SettingsGroup } from "../settingsUi";

export function GenerationDefaultsSettingsSection({
  prefs,
  setPref,
}: {
  prefs: SettingsPreferences;
  setPref: <K extends keyof SettingsPreferences>(key: K, value: SettingsPreferences[K]) => void;
}) {
  return (
    <div id="settings-generation-defaults" className="scroll-mt-12 flex flex-col gap-6">
      <SectionHeader title="生成默认值" icon={<Box />} description="图像、视频、音乐和 3D 生成的默认参数。" />
      <SettingsGroup>
        <WorkspaceDefaultsPreview prefs={prefs} setPref={setPref} />
      </SettingsGroup>
    </div>
  );
}
