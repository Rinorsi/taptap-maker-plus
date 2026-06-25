import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
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
  onOpenLogs: () => void;
  onSelect: (selection: InspectorSelection) => void;
  appMenu?: ReactNode;
  searchFocusSignal?: number;
};

type SearchResult =
  | { id: string; type: "project"; title: string; subtitle: string; project: ProjectSummary }
  | { id: string; type: "tool"; title: string; subtitle: string; tool: ToolSummary }
  | { id: string; type: "asset"; title: string; subtitle: string; asset: AssetSummary }
  | { id: string; type: "task"; title: string; subtitle: string; task: TaskRecord };

const TITLEBAR_DRAG_THRESHOLD_PX = 4;

function isWindowDragTarget(target: EventTarget | null) {
  return !(
    target instanceof HTMLElement &&
    target.closest("button, input, label, a, [data-no-window-drag]")
  );
}

export function TopBar({ project, runtime, notice, toolCount, theme, projects = [], tools = [], assets = [], tasks = [], onThemeToggle, onOpenSettings, onSelectProject, onOpenModule, onOpenLogs, onSelect, appMenu, searchFocusSignal = 0 }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const titlebarDragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
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
    onOpenLogs();
  }

  const runtimeStatus = runtime?.status?.toUpperCase() ?? "IDLE";

  useEffect(() => {
    if (!searchFocusSignal) return;
    inputRef.current?.focus();
    inputRef.current?.select();
    setOpen(true);
  }, [searchFocusSignal]);

  function handleTitlebarPointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (event.button !== 0) return;
    if (!isWindowDragTarget(event.target)) return;
    if (event.detail >= 2) return;
    titlebarDragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY
    };
  }

  function handleTitlebarPointerMove(event: ReactPointerEvent<HTMLElement>) {
    const dragState = titlebarDragRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    const movedX = Math.abs(event.clientX - dragState.x);
    const movedY = Math.abs(event.clientY - dragState.y);
    if (movedX < TITLEBAR_DRAG_THRESHOLD_PX && movedY < TITLEBAR_DRAG_THRESHOLD_PX) return;
    titlebarDragRef.current = null;
    dragDesktopWindow({
      clientX: event.clientX,
      clientY: event.clientY,
      screenX: event.screenX,
      screenY: event.screenY,
    }).catch(() => undefined);
  }

  function clearTitlebarPointer(event: ReactPointerEvent<HTMLElement>) {
    if (titlebarDragRef.current?.pointerId === event.pointerId) {
      titlebarDragRef.current = null;
    }
  }

  async function handleTitlebarDoubleClick(event: ReactPointerEvent<HTMLElement>) {
    if (!isWindowDragTarget(event.target)) return;
    titlebarDragRef.current = null;
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().toggleMaximize();
    } catch {
      // ignore
    }
  }

  return (
    <header
      className="flex items-center gap-4 px-4 h-[52px] border-b border-border bg-surface-panel z-[80] shrink-0 relative select-none"
      onPointerDown={handleTitlebarPointerDown}
      onPointerMove={handleTitlebarPointerMove}
      onPointerUp={clearTitlebarPointer}
      onPointerCancel={clearTitlebarPointer}
      onDoubleClick={handleTitlebarDoubleClick}
    >
      <div className="flex items-center min-w-0 shrink-0 w-[520px] pl-1 gap-3">
        <div className="flex items-center gap-1.5 select-none pointer-events-none mr-2">
          <img src="/files.png" alt="Plus" className="h-[28px] rounded-lg object-contain" />
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
          <div className="absolute left-0 right-0 top-[50px] z-[90] overflow-hidden rounded-large border border-border bg-surface-panel shadow-popover">
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
          <ThemeToggleIcon theme={theme} />
        </Button>
        
        <Button variant="ghost" size="icon" onClick={onOpenSettings} title="设置">
          <Settings className="w-[18px] h-[18px]" />
        </Button>
        <DesktopWindowControls />
      </div>
    </header>
  );
}

function ThemeToggleIcon({ theme }: { theme: "light" | "dark" }) {
  const isDark = theme === "dark";
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transform: isDark ? "rotate(-90deg)" : "rotate(0deg)",
        transition: "transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)"
      }}
    >
      <mask id="moon-mask-topbar">
        <rect x="0" y="0" width="100%" height="100%" fill="white" />
        <circle
          cx={isDark ? "12" : "25"}
          cy={isDark ? "4" : "0"}
          r="6"
          fill="black"
          style={{ transition: "cx 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), cy 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
        />
      </mask>
      <circle
        cx="12"
        cy="12"
        r={isDark ? "9" : "5"}
        fill="currentColor"
        mask="url(#moon-mask-topbar)"
        style={{ transition: "r 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
      />
      <g
        style={{
          opacity: isDark ? 0 : 1,
          transform: isDark ? "scale(0.5)" : "scale(1)",
          transformOrigin: "center",
          transition: "opacity 0.5s ease, transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)"
        }}
      >
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </g>
    </svg>
  );
}

async function dragDesktopWindow(pointer: {
  clientX: number;
  clientY: number;
  screenX: number;
  screenY: number;
}) {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const { PhysicalPosition } = await import("@tauri-apps/api/dpi");
  const appWindow = getCurrentWindow();
  if (await appWindow.isMaximized()) {
    const viewportWidth = Math.max(window.innerWidth, 1);
    const horizontalRatio = Math.min(Math.max(pointer.clientX / viewportWidth, 0), 1);
    const titlebarGrabY = Math.max(pointer.clientY, 0);
    await appWindow.toggleMaximize();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const restoredSize = await appWindow.outerSize();
    await appWindow.setPosition(
      new PhysicalPosition(
        Math.round(pointer.screenX - restoredSize.width * horizontalRatio),
        Math.round(pointer.screenY - titlebarGrabY),
      ),
    );
  }
  await appWindow.startDragging();
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
