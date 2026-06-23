import { Command as CommandMenu } from "cmdk";
import { Activity, File, FolderOpen, Search, Wrench } from "lucide-react";
import type { ReactNode } from "react";
import type { AppCommandContext } from "./types";
import { formatShortcut } from "./keyboard";
import { useCommandRegistry } from "./CommandProvider";
import { cn } from "../lib/utils";
import type { AssetSummary, ProjectSummary, TaskRecord, ToolSummary } from "../api";
import type { WorkbenchModule } from "../app/routes";
import type { InspectorSelection } from "../components/layout/AgentInspectorPanel";

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: AppCommandContext;
  projects: ProjectSummary[];
  tools: ToolSummary[];
  assets: AssetSummary[];
  tasks: TaskRecord[];
  onSelectProject: (projectId: string) => void;
  onOpenModule: (module: WorkbenchModule) => void;
  onSelect: (selection: InspectorSelection) => void;
};

export function CommandPalette({ open, onOpenChange, context, projects, tools, assets, tasks, onSelectProject, onOpenModule, onSelect }: CommandPaletteProps) {
  const registry = useCommandRegistry();
  const commands = registry.list(context);
  const trimmedAssets = assets.slice(0, 80);
  const trimmedTasks = tasks.slice(0, 80);

  function close() {
    onOpenChange(false);
  }

  return (
    <CommandMenu.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="命令面板"
      loop
      vimBindings={false}
      overlayClassName="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity"
      contentClassName="fixed left-1/2 top-[12vh] z-50 w-[min(680px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-2xl border border-white/10 bg-[#1a1a1e]/95 backdrop-blur-xl shadow-[0_16px_70px_-10px_rgba(0,0,0,0.5)] ring-1 ring-white/5"
    >
      <div className="flex h-14 items-center gap-3 border-b border-white/5 px-5">
        <Search className="h-5 w-5 shrink-0 text-text-muted" strokeWidth={2.5} />
        <CommandMenu.Input
          autoFocus
          placeholder="搜索命令或资源..."
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] font-medium text-text outline-none placeholder:text-text-muted/60"
        />
        <span className="rounded-md bg-white/5 px-2 py-1 font-mono text-[10px] font-bold tracking-wider text-text-subtle shadow-sm border border-white/5">ESC</span>
      </div>
      <CommandMenu.List className="max-h-[500px] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        <CommandMenu.Empty className="px-3 py-12 text-center text-sm text-text-muted">无相关匹配项</CommandMenu.Empty>
        
        <CommandMenu.Group heading="快捷命令" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-text-muted/60 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest">
          {commands.map((command) => (
            <CommandMenu.Item
              key={command.commandId}
              value={`${command.title} ${command.description ?? ""} ${command.commandId}`}
              keywords={[command.commandId, command.scope]}
              onSelect={() => {
                close();
                void registry.run(command.commandId, context);
              }}
              className={cn(
                "group flex cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-left outline-none transition-colors",
                command.danger ? "aria-selected:bg-red-500/10 text-[#e06c75]" : "aria-selected:bg-brand/15 text-text"
              )}
            >
              <div className="flex-1 min-w-0">
                <div className={cn("text-[13px] font-medium truncate transition-colors", command.danger ? "group-aria-selected:text-red-400" : "group-aria-selected:text-brand-strong")}>
                  {command.title}
                </div>
                {command.description && (
                  <div className="text-[11px] text-text-subtle truncate mt-0.5 group-aria-selected:text-brand/70 transition-colors">
                    {command.description}
                  </div>
                )}
              </div>
              {command.shortcut && (
                <span className="shrink-0 rounded bg-black/20 border border-white/5 px-2 py-1 font-mono text-[10px] font-bold text-text-subtle group-aria-selected:bg-brand/20 group-aria-selected:text-brand group-aria-selected:border-brand/20 transition-all">
                  {formatShortcut(command.shortcut)}
                </span>
              )}
            </CommandMenu.Item>
          ))}
        </CommandMenu.Group>

        <CommandMenu.Group heading="项目" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-text-muted/60 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest">
          {projects.map((project) => (
            <PaletteItem
              key={project.id}
              icon={<FolderOpen className="h-[18px] w-[18px]" />}
              title={project.name}
              subtitle={project.rootPath}
              value={`项目 ${project.name} ${project.rootPath} ${project.makerProjectId}`}
              tag="project"
              onSelect={() => {
                close();
                onSelectProject(project.id);
              }}
            />
          ))}
        </CommandMenu.Group>

        <CommandMenu.Group heading="MCP 工具" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-text-muted/60 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest">
          {tools.map((tool) => (
            <PaletteItem
              key={tool.name}
              icon={<Wrench className="h-[18px] w-[18px]" />}
              title={tool.name}
              subtitle={`${tool.category} · ${tool.required.length ? tool.required.join(", ") : "schema"}`}
              value={`工具 ${tool.name} ${tool.category} ${tool.description ?? ""}`}
              tag="tool"
              onSelect={() => {
                close();
                onSelect({ type: "tool", item: tool });
                onOpenModule(moduleForTool(tool));
              }}
            />
          ))}
        </CommandMenu.Group>

        <CommandMenu.Group heading="资产" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-text-muted/60 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest">
          {trimmedAssets.map((asset) => (
            <PaletteItem
              key={asset.id}
              icon={<File className="h-[18px] w-[18px]" />}
              title={asset.fileName}
              subtitle={asset.relativePath}
              value={`资产 ${asset.fileName} ${asset.relativePath} ${asset.assetType}`}
              tag={asset.assetType}
              onSelect={() => {
                close();
                onSelect({ type: "asset", item: asset });
                onOpenModule("assets");
              }}
            />
          ))}
        </CommandMenu.Group>

        <CommandMenu.Group heading="任务" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-text-muted/60 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest">
          {trimmedTasks.map((task) => (
            <PaletteItem
              key={task.taskId}
              icon={<Activity className="h-[18px] w-[18px]" />}
              title={task.toolName}
              subtitle={`${task.status} · ${task.inputSummary}`}
              value={`任务 ${task.toolName} ${task.status} ${task.taskId} ${task.inputSummary}`}
              tag={task.status}
              onSelect={() => {
                close();
                onSelect({ type: "task", item: task });
                onOpenModule("runs");
              }}
            />
          ))}
        </CommandMenu.Group>
      </CommandMenu.List>
    </CommandMenu.Dialog>
  );
}

function PaletteItem({ icon, title, subtitle, value, tag, onSelect }: { icon: ReactNode; title: string; subtitle: string; value: string; tag: string; onSelect: () => void }) {
  return (
    <CommandMenu.Item
      value={value}
      onSelect={onSelect}
      className="group flex cursor-pointer items-center gap-3.5 rounded-xl px-3 py-3 text-left outline-none aria-selected:bg-brand/15 transition-colors"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 border border-white/5 text-text-muted group-aria-selected:bg-brand/20 group-aria-selected:text-brand group-aria-selected:border-brand/20 transition-all shadow-sm">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <strong className="block truncate text-[13px] font-medium text-text group-aria-selected:text-brand-strong transition-colors">{title}</strong>
        <span className="mt-0.5 block truncate text-[11px] text-text-subtle group-aria-selected:text-brand/70 transition-colors">{subtitle}</span>
      </div>
      <span className="shrink-0 rounded-md bg-black/20 border border-white/5 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-text-subtle group-aria-selected:bg-brand/20 group-aria-selected:text-brand group-aria-selected:border-brand/20 transition-all">{tag}</span>
    </CommandMenu.Item>
  );
}

function moduleForTool(tool: ToolSummary): WorkbenchModule {
  if (tool.category === "image") return "studio-image";
  if (tool.category === "video") return "studio-video";
  if (tool.category === "music") return "studio-music";
  if (tool.category === "model3d") return "studio-3d";
  if (tool.category === "build") return "build";
  if (tool.category === "status") return "settings";
  return "workflow";
}
