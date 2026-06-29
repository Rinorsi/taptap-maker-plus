import { Keyboard } from "lucide-react";
import type { Command } from "../../../commands";
import { CommandShortcutList, PreferenceNote, SectionHeader, SettingsGroup } from "../settingsUi";

export function ShortcutsSettingsSection({ commands }: { commands: Command[] }) {
  return (
    <div id="settings-shortcuts" className="scroll-mt-12 flex flex-col gap-6">
      <SectionHeader title="快捷键" icon={<Keyboard />} badge="只读" description="查看当前可用命令与快捷键；改键功能尚未接入。" />
      <SettingsGroup>
        <PreferenceNote text="已读取真实命令注册表；当前只能查看，不能修改快捷键绑定。" />
        <CommandShortcutList commands={commands} />
      </SettingsGroup>
    </div>
  );
}
