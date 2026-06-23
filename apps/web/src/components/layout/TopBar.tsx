import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Settings, Moon, Sun, Search, Boxes, FolderOpen, Wrench, File, Activity, Minus, Square, X, Copy } from "lucide-react";
import { Button } from "../ui/Button";
import type { AssetSummary, ProjectSummary, RuntimeSummary, TaskRecord, ToolSummary } from "../../api";
import type { WorkbenchModule } from "../../app/routes";
import type { InspectorSelection } from "./AgentInspectorPanel";
import { cn } from "../../lib/utils";

type Props = {
  project?: ProjectSummary;
  runtime?: RuntimeSummary;
  notice: string;
  toolCount: number;
  theme: "light" | "dark";
  projects: ProjectSummary[];
  tools: ToolSummary[];
  assets: AssetSummary[];
  tasks: TaskRecord[];
  onThemeToggle: () => void;
  onOpenSettings: () => void;
  onSelectProject: (projectId: string) => void;
  onOpenModule: (module: WorkbenchModule) => void;
  onSelect: (selection: InspectorSelection) => void;
  appMenu?: ReactNode;
  searchFocusSignal?: number;
};

type SearchResult =
  | { id: string; type: "project"; title: string; subtitle: string; project: ProjectSummary }
  | { id: string; type: "tool"; title: string; subtitle: string; tool: ToolSummary }
  | { id: string; type: "asset"; title: string; subtitle: string; asset: AssetSummary }
  | { id: string; type: "task"; title: string; subtitle: string; task: TaskRecord };

export function TopBar({ project, runtime, notice, toolCount, theme, projects = [], tools = [], assets = [], tasks = [], onThemeToggle, onOpenSettings, onSelectProject, onOpenModule, onSelect, appMenu, searchFocusSignal = 0 }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const searchSources = useMemo(() => ({
    projects: Array.isArray(projects) ? projects : [],
    tools: Array.isArray(tools) ? tools : [],
    assets: Array.isArray(assets) ? assets : [],
    tasks: Array.isArray(tasks) ? tasks : []
  }), [projects, tools, assets, tasks]);
  const results = useMemo(() => buildSearchResults(query, searchSources.projects, searchSources.tools, searchSources.assets, searchSources.tasks), [query, searchSources]);

  function activate(result: SearchResult) {
    setQuery("");
    setOpen(false);
    if (result.type === "project") {
      onSelectProject(result.project.id);
      return;
    }
    if (result.type === "tool") {
      onSelect({ type: "tool", item: result.tool });
      onOpenModule(moduleForTool(result.tool));
      return;
    }
    if (result.type === "asset") {
      onSelect({ type: "asset", item: result.asset });
      onOpenModule("assets");
      return;
    }
    onSelect({ type: "task", item: result.task });
    onOpenModule("runs");
  }

  const runtimeStatus = runtime?.status?.toUpperCase() ?? "IDLE";

  useEffect(() => {
    if (!searchFocusSignal) return;
    inputRef.current?.focus();
    inputRef.current?.select();
    setOpen(true);
  }, [searchFocusSignal]);

  return (
    <header
      className="flex items-center gap-4 px-4 h-[52px] border-b border-border bg-surface-panel z-10 shrink-0 relative select-none"
      onMouseDown={(event) => {
        if (event.button !== 0) return;
        if ((event.target as HTMLElement).closest("button, input, label, a, [data-no-window-drag]")) return;
        dragDesktopWindow().catch(() => undefined);
      }}
      onDoubleClick={async (event) => {
        if ((event.target as HTMLElement).closest("[data-no-window-drag]")) return;
        try {
          const { getCurrentWindow } = await import("@tauri-apps/api/window");
          await getCurrentWindow().toggleMaximize();
        } catch {
          // ignore
        }
      }}
    >
      <div className="flex items-center min-w-0 shrink-0 w-[520px] pl-1 gap-3" data-no-window-drag>
        <div className="flex items-center gap-1.5 select-none pointer-events-none mr-2">
          <img src="/files.png" alt="Plus" className="h-[28px] object-contain" />
        </div>
        <div className="min-w-0">{appMenu}</div>
      </div>

      <div className="flex-1 min-w-[220px] max-w-[560px] mx-auto relative" data-no-window-drag>
        <label className="flex items-center gap-3 px-4 h-[44px] rounded-full bg-surface-muted hover:bg-surface-muted/80 focus-within:bg-surface-panel focus-within:shadow-[0_0_0_2px_rgba(0,217,197,0.2)] transition-all cursor-text" aria-label="命令搜索">
          <Search className="w-5 h-5 text-text-muted" strokeWidth={2.5} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && results[0]) activate(results[0]);
              if (event.key === "Escape") setOpen(false);
            }}
            className="w-full bg-transparent border-none outline-none text-[14px] text-text placeholder:text-text-muted/80"
            placeholder="搜索项目、工具、资产、任务"
          />
        </label>
        {open && query.trim() ? (
          <div className="absolute left-0 right-0 top-[50px] z-30 overflow-hidden rounded-large border border-border bg-surface-panel shadow-popover">
            <div className="max-h-[360px] overflow-y-auto p-2">
              {results.length === 0 ? (
                <div className="p-4 text-center text-xs text-text-muted">没有匹配结果</div>
              ) : results.map((result) => (
                <button key={result.id} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => activate(result)} className="flex w-full items-center gap-3 rounded-card px-3 py-2 text-left hover:bg-surface-muted">
                  <ResultIcon type={result.type} />
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-xs text-text">{result.title}</strong>
                    <span className="block truncate text-[10px] text-text-subtle">{result.subtitle}</span>
                  </span>
                  <span className="rounded-pill bg-surface-muted px-2 py-0.5 text-[9px] font-bold uppercase text-text-subtle">{result.type}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-2 justify-end shrink-0" data-no-window-drag>
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-pill bg-surface-muted border border-border-soft text-xs whitespace-nowrap font-medium mr-2 text-text-subtle">
          <Boxes className="w-3.5 h-3.5" />
          <span>Tools {toolCount}</span>
        </div>
        
        <Button variant="ghost" size="icon" onClick={onThemeToggle} title="切换主题">
          {theme === "light" ? <Moon className="w-[18px] h-[18px]" /> : <Sun className="w-[18px] h-[18px]" />}
        </Button>
        
        <Button variant="ghost" size="icon" onClick={onOpenSettings} title="设置">
          <Settings className="w-[18px] h-[18px]" />
        </Button>
        <DesktopWindowControls />
      </div>
    </header>
  );
}

async function dragDesktopWindow() {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().startDragging();
}

function DesktopWindowControls() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
      const appWindow = getCurrentWindow();
      appWindow.isMaximized().then(setMaximized).catch(() => undefined);
      appWindow.onResized(() => {
        appWindow.isMaximized().then(setMaximized).catch(() => undefined);
      }).then(u => unlisten = u).catch(() => undefined);
    }).catch(() => undefined);
    return () => unlisten?.();
  }, []);

  async function runWindowAction(action: "minimize" | "maximize" | "close") {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const appWindow = getCurrentWindow();
    if (action === "minimize") {
      await appWindow.minimize();
      return;
    }
    if (action === "maximize") {
      await appWindow.toggleMaximize();
      return;
    }
    await appWindow.close();
  }

  return (
    <div className="ml-1 flex h-9 items-center overflow-hidden rounded-control border border-border-soft bg-surface-muted" data-no-window-drag>
      <button type="button" className="flex h-9 w-10 items-center justify-center text-text-muted hover:bg-surface-panel hover:text-text" title="最小化" onClick={() => runWindowAction("minimize").catch(() => undefined)}>
        <Minus className="h-4 w-4" strokeWidth={2.2} />
      </button>
      <button type="button" className="flex h-9 w-10 items-center justify-center text-text-muted hover:bg-surface-panel hover:text-text" title={maximized ? "向下还原" : "最大化"} onClick={() => runWindowAction("maximize").catch(() => undefined)}>
        {maximized ? <Copy className="h-3.5 w-3.5" strokeWidth={2.2} /> : <Square className="h-3.5 w-3.5" strokeWidth={2.2} />}
      </button>
      <button type="button" className="flex h-9 w-10 items-center justify-center text-text-muted hover:bg-red-500 hover:text-white" title="关闭" onClick={() => runWindowAction("close").catch(() => undefined)}>
        <X className="h-4 w-4" strokeWidth={2.2} />
      </button>
    </div>
  );
}

function StatusPill({ label, tone }: { label: string; tone: "ok" | "idle" | "bad" }) {
  return (
    <span className={cn(
      "shrink-0 rounded-pill border px-2 py-0.5 text-[10px] font-bold tracking-normal",
      tone === "ok" ? "border-brand/30 bg-brand/10 text-brand-strong" : tone === "bad" ? "border-red-500/25 bg-red-500/10 text-red-500" : "border-border-soft bg-surface-muted text-text-subtle"
    )}>
      {label}
    </span>
  );
}

function buildSearchResults(query: string, projects: ProjectSummary[], tools: ToolSummary[], assets: AssetSummary[], tasks: TaskRecord[]): SearchResult[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const matches = (values: Array<string | undefined>) => values.some((value) => (value ?? "").toLowerCase().includes(needle));
  return [
    ...projects.filter((project) => matches([project.name, project.rootPath, project.makerProjectId])).map((project) => ({
      id: `project:${project.id}`,
      type: "project" as const,
      title: project.name,
      subtitle: project.rootPath,
      project
    })),
    ...tools.filter((tool) => matches([tool.name, tool.category, tool.description ?? ""])).map((tool) => ({
      id: `tool:${tool.name}`,
      type: "tool" as const,
      title: tool.name,
      subtitle: `${tool.category} · ${tool.required?.length ? tool.required.join(", ") : "schema"}`,
      tool
    })),
    ...assets.filter((asset) => matches([asset.fileName, asset.relativePath, asset.assetType])).slice(0, 12).map((asset) => ({
      id: `asset:${asset.id}`,
      type: "asset" as const,
      title: asset.fileName,
      subtitle: asset.relativePath,
      asset
    })),
    ...tasks.filter((task) => matches([task.toolName, task.status, task.inputSummary, task.taskId])).slice(0, 12).map((task) => ({
      id: `task:${task.taskId}`,
      type: "task" as const,
      title: task.toolName,
      subtitle: `${task.status} · ${task.inputSummary}`,
      task
    }))
  ].slice(0, 20);
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

function ResultIcon({ type }: { type: SearchResult["type"] }) {
  const className = "h-4 w-4";
  return (
    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-control", type === "project" ? "bg-brand/10 text-brand-strong" : "bg-surface-muted text-text-muted")}>
      {type === "project" ? <FolderOpen className={className} /> : type === "tool" ? <Wrench className={className} /> : type === "asset" ? <File className={className} /> : <Activity className={className} />}
    </span>
  );
}
