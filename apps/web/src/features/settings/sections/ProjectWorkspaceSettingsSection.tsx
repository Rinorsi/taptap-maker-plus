import { Folder, FolderCog } from "lucide-react";
import type { MakerProjectsRootSettings } from "../../../api";
import { Button } from "../../../components/ui/Button";
import { SectionHeader, SettingContainer, SettingsGroup } from "../settingsUi";

export function ProjectWorkspaceSettingsSection({
  makerRootSettings,
  makerRootDraft,
  makerRootNotice,
  setMakerRootDraft,
  onSaveMakerRoot,
}: {
  makerRootSettings?: MakerProjectsRootSettings;
  makerRootDraft: string;
  makerRootNotice: string;
  setMakerRootDraft: (value: string) => void;
  onSaveMakerRoot: () => void;
}) {
  const draftChanged = makerRootDraft.trim() !== (makerRootSettings?.rootPath ?? "");

  return (
    <div id="settings-project-workspace" className="scroll-mt-12 flex flex-col gap-6">
      <SectionHeader title="项目与工作区" icon={<FolderCog />} description="项目根目录、项目扫描和当前打开项目相关行为。" />
      <SettingsGroup>
        <SettingContainer
          label="Maker 项目根目录"
          description={
            <div className="flex flex-col gap-1">
              <span>扫描项目和删除本地项目文件夹时都会使用该根目录作为边界。</span>
              {makerRootNotice ? <span className="text-[11px] text-text-subtle">{makerRootNotice}</span> : null}
            </div>
          }
        >
          <div className="flex min-w-[280px] max-w-[520px] flex-wrap items-center gap-2 md:flex-nowrap">
            <div className="relative flex h-9 min-w-[260px] flex-1 items-center overflow-hidden rounded-control border border-border bg-surface-app transition-colors focus-within:border-brand">
              <input
                value={makerRootDraft}
                onChange={(event) => setMakerRootDraft(event.target.value)}
                className="min-w-0 flex-1 bg-transparent py-0 pl-3 pr-[76px] font-mono text-[11px] text-text outline-none"
                placeholder={makerRootSettings?.defaultRootPath ?? "请输入精确的 Maker 项目根目录路径"}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void pickMakerRootDirectory(setMakerRootDraft)}
                className="absolute right-1 top-1/2 h-7 -translate-y-1/2 shrink-0 gap-1 px-2 text-[11px]"
                title="浏览并选择 Maker 项目根目录"
              >
                <Folder className="h-3.5 w-3.5" /> 浏览
              </Button>
            </div>
            {draftChanged ? (
              <Button
                variant="outline"
                size="sm"
                onClick={onSaveMakerRoot}
                disabled={!makerRootDraft.trim()}
                className="shrink-0"
              >
                保存
              </Button>
            ) : null}
          </div>
        </SettingContainer>
      </SettingsGroup>
    </div>
  );
}

async function pickMakerRootDirectory(setMakerRootDraft: (value: string) => void) {
  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({
      title: "选择 Maker 项目根目录",
      directory: true,
      multiple: false,
      canCreateDirectories: true,
    });
    if (typeof selected === "string") {
      setMakerRootDraft(selected);
    }
  } catch {
    const selected = window.prompt("输入 Maker 项目根目录路径");
    if (selected) setMakerRootDraft(selected);
  }
}
