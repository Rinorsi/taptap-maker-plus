import { Images, Workflow } from "lucide-react";
import type { SettingsPreferences } from "../preferences";
import { AssetDropPreview, CanvasPreview } from "../SettingsPreviews";
import { SectionHeader, SegmentedSetting, SettingsGroup, SwitchSetting } from "../settingsUi";

export function CanvasAssetsSettingsSection({
  prefs,
  setPref,
}: {
  prefs: SettingsPreferences;
  setPref: <K extends keyof SettingsPreferences>(key: K, value: SettingsPreferences[K]) => void;
}) {
  return (
    <div id="settings-canvas-assets" className="scroll-mt-12 flex flex-col gap-6">
      <SectionHeader title="画布与资产" icon={<Workflow />} description="节点编辑器、素材库和文件流转行为偏好。" />
      <SettingsGroup preview={<CanvasPreview prefs={prefs} />}>
        <SwitchSetting label="显示网格背景" checked={prefs.canvasGrid === "visible"} onChange={(value) => setPref("canvasGrid", value ? "visible" : "hidden")} />
        <SwitchSetting label="显示迷你地图 (MiniMap)" checked={prefs.canvasMiniMap === "visible"} onChange={(value) => setPref("canvasMiniMap", value ? "visible" : "hidden")} />
        <SwitchSetting label="画布更改自动保存" checked={prefs.canvasAutoSave === "on"} onChange={(value) => setPref("canvasAutoSave", value ? "on" : "off")} />
        <SegmentedSetting
          label="进入画布时侧边栏折叠"
          value={prefs.canvasSidebarBehavior}
          options={[
            { label: "保持原状", value: "keep" },
            { label: "折叠左侧", value: "collapse-left" },
            { label: "折叠两侧", value: "collapse-both" },
          ]}
          onChange={(value) => setPref("canvasSidebarBehavior", value)}
        />
        <SwitchSetting
          label="离开画布时恢复侧栏状态"
          checked={prefs.canvasLeaveBehavior === "restore"}
          onChange={(value) => setPref("canvasLeaveBehavior", value ? "restore" : "keep")}
        />
      </SettingsGroup>

      <SectionHeader title="资产" icon={<Images />} description="素材库与文件流转行为偏好。" />
      <SettingsGroup preview={<AssetDropPreview prefs={prefs} />}>
        <SegmentedSetting
          label="外部拖入资产时"
          value={prefs.assetDropBehavior}
          options={[
            { label: "自动复制到项目", value: "copy" },
            { label: "每次询问", value: "ask" },
          ]}
          onChange={(value) => setPref("assetDropBehavior", value)}
        />
        <SegmentedSetting
          label="移动/删除资产前"
          value={prefs.assetReferenceCheck}
          options={[
            { label: "扫描依赖引用", value: "scan" },
            { label: "跳过检查", value: "skip" },
          ]}
          onChange={(value) => setPref("assetReferenceCheck", value)}
        />
      </SettingsGroup>
    </div>
  );
}
