import {
  Box,
  ChevronRight,
  Folder,
  FolderSync,
  Image as ImageIcon,
  Music,
  Play,
  RefreshCw,
  Scan,
  Trash2,
  Video,
  XCircle,
} from "lucide-react";
import type { AssetSummary, ProjectSummary, RuntimeSummary, TaskRecord, ToolSummary } from "../../api";
import type { WorkbenchModule } from "../../app/routes";

type Props = {
  projects: ProjectSummary[];
  selectedProjectId: string;
  runtime?: RuntimeSummary;
  tools: ToolSummary[];
  tasks: TaskRecord[];
  assets: AssetSummary[];
  onSelectProject: (projectId: string) => void;
  onScanProjects: () => void;
  onScanAssets: () => void;
  onRefreshProject?: () => void | Promise<void>;
  onStartRuntime: () => void;
  onRemoveProjectRecord: (projectId: string) => void;
  onDeleteProjectLocalFolder: (projectId: string) => void;
  onOpenModule: (module: WorkbenchModule) => void;
  busy: boolean;
};

const quickEntries: Array<{ module: WorkbenchModule; label: string; icon: React.ElementType }> = [
  { module: "studio-video", label: "视频画布", icon: Video },
  { module: "studio-image", label: "图像工作室", icon: ImageIcon },
  { module: "studio-music", label: "音频工作室", icon: Music },
  { module: "studio-3d", label: "3D 工作室", icon: Box },
  { module: "assets", label: "素材扫描", icon: Scan },
  { module: "runs", label: "任务列表", icon: Play },
];

export function WelcomeView({
  projects,
  selectedProjectId,
  runtime,
  tools,
  tasks,
  assets,
  onSelectProject,
  onScanProjects,
  onScanAssets,
  onRefreshProject,
  onStartRuntime,
  onRemoveProjectRecord,
  onDeleteProjectLocalFolder,
  onOpenModule,
  busy,
}: Props) {
  const selectedProject =
    projects.find((project) => project.id === selectedProjectId);
  const selectedProjectTasks = selectedProject
    ? tasks.filter((task) => task.projectId === selectedProject.id)
    : [];
  const selectedProjectAssets = selectedProject
    ? assets.filter((asset) => asset.projectId === selectedProject.id)
    : [];
  const latestAssetScanAt = latestTimestamp(
    selectedProjectAssets.map((asset) => asset.updatedAt),
  );
  const runningTaskCount = selectedProjectTasks.filter(
    (task) => task.status === "queued" || task.status === "running",
  ).length;
  const failedTaskCount = selectedProjectTasks.filter(
    (task) => task.status === "failed",
  ).length;

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden text-text">
      <div className="flex min-h-0 w-full flex-1 flex-col gap-6 p-6 lg:flex-row lg:p-8">
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="mb-6 shrink-0">
            <div className="mb-3 flex items-center gap-2 select-none">
              <img src="/files.png" alt="Plus" className="h-10 rounded-lg object-contain" />
              <img src="/logo-text.png" alt="TapTap Maker Plus" className="h-9 object-contain" />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h1 className="m-0 text-lg font-bold text-text">项目首页</h1>
                <p className="mt-1 text-xs font-medium text-text-subtle">
                  本地 MCP 工作台项目状态与入口
                </p>
              </div>
              <button
                onClick={onScanProjects}
                disabled={busy}
                className="inline-flex h-8 items-center gap-2 rounded-control border border-border bg-surface-panel px-3 text-xs font-semibold text-text hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
              >
                <FolderSync className="h-3.5 w-3.5" />
                扫描项目
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pr-2">
            {projects.length === 0 ? (
              <div className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-large border border-dashed border-border bg-surface-panel/60 text-center">
                <Folder className="mb-4 h-12 w-12 text-text-muted opacity-60" />
                <p className="mb-1 text-sm font-bold text-text">暂无项目记录</p>
                <p className="text-xs text-text-subtle">扫描本地 Maker 项目后会显示真实状态。</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {projects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    selected={project.id === selectedProjectId}
                    onSelectProject={onSelectProject}
                    onRemoveProjectRecord={onRemoveProjectRecord}
                    onDeleteProjectLocalFolder={onDeleteProjectLocalFolder}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-[340px]">
          <section className="rounded-large border border-border bg-surface-panel shadow-sm">
            <div className="border-b border-border-soft px-4 py-3">
              <h2 className="m-0 text-sm font-bold text-text">当前项目</h2>
              <p className="mt-1 truncate text-xs text-text-subtle" title={selectedProject?.rootPath}>
                {selectedProject?.name ?? "未选择项目"}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 p-3">
              {quickEntries.map((entry) => {
                const Icon = entry.icon;
                return (
                  <button
                    key={entry.module}
                    type="button"
                    disabled={!selectedProject}
                    onClick={() => onOpenModule(entry.module)}
                    className="flex h-20 flex-col items-start justify-between rounded-control border border-border-soft bg-surface-app p-3 text-left text-xs font-semibold text-text hover:border-brand/40 hover:bg-brand/5 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Icon className="h-4 w-4 text-brand-strong" />
                    <span>{entry.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-large border border-border bg-surface-panel shadow-sm">
            <div className="flex items-center justify-between border-b border-border-soft px-4 py-3">
              <h2 className="m-0 text-sm font-bold text-text">状态摘要</h2>
              <button
                type="button"
                disabled={!selectedProject || busy}
                onClick={() => void onRefreshProject?.()}
                className="inline-flex h-7 items-center gap-1.5 rounded-control px-2 text-xs font-semibold text-text-muted hover:bg-surface-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                刷新
              </button>
            </div>
            <div className="p-2">
              <SummaryRow label="Runtime" value={runtime?.status ?? selectedProject?.runtime?.status ?? "idle"} />
              <SummaryRow label="tools/list" value={`${tools.length || runtime?.toolCount || selectedProject?.runtime?.toolCount || 0} 个工具`} />
              <SummaryRow label="任务" value={`${selectedProjectTasks.length} 条，运行 ${runningTaskCount}，失败 ${failedTaskCount}`} />
              <SummaryRow label="素材索引" value={`${selectedProjectAssets.length} 个文件`} />
              <SummaryRow label="last scan" value={latestAssetScanAt ?? selectedProject?.lastScannedAt ?? "-"} />
            </div>
            <div className="flex gap-2 border-t border-border-soft p-3">
              <button
                type="button"
                disabled={!selectedProject || busy}
                onClick={onStartRuntime}
                className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-control bg-brand px-3 text-xs font-semibold text-black hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Play className="h-3.5 w-3.5" />
                启动 Runtime
              </button>
              <button
                type="button"
                disabled={!selectedProject || busy}
                onClick={onScanAssets}
                className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-control border border-border bg-surface-app px-3 text-xs font-semibold text-text hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Scan className="h-3.5 w-3.5" />
                扫描素材
              </button>
            </div>
          </section>
        </aside>
      </div>
      <div className="absolute bottom-4 right-6 flex items-center gap-2 opacity-30 select-none pointer-events-none">
        <span className="text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-text">
          Maker Plus v0.1.0-alpha
        </span>
      </div>
    </div>
  );
}

function ProjectCard({
  project,
  selected,
  onSelectProject,
  onRemoveProjectRecord,
  onDeleteProjectLocalFolder,
}: {
  project: ProjectSummary;
  selected: boolean;
  onSelectProject: (projectId: string) => void;
  onRemoveProjectRecord: (projectId: string) => void;
  onDeleteProjectLocalFolder: (projectId: string) => void;
}) {
  const runtimeStatus = project.runtime?.status ?? "idle";
  const toolsCount = project.runtime?.toolCount ?? project.toolCount ?? 0;
  return (
    <article
      className={[
        "group rounded-large border bg-surface-panel p-4 shadow-sm transition-colors",
        selected ? "border-brand/45" : "border-border hover:border-brand/30",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={() => onSelectProject(project.id)}
        className="flex w-full items-start gap-3 text-left"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-muted ring-1 ring-border-soft">
          <span className="text-sm font-bold text-text-muted">
            {project.name.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <strong className="min-w-0 truncate text-sm font-bold text-text">{project.name}</strong>
            {selected ? (
              <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-bold text-brand-strong">
                当前
              </span>
            ) : null}
          </div>
          <p className="mt-1 truncate font-mono text-[11px] text-text-muted" title={project.rootPath}>
            {project.rootPath}
          </p>
        </div>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-text-muted" />
      </button>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
        <StatusPill label="project_id" value={project.makerProjectId} />
        <StatusPill label="config" value={project.configExists ? "present" : "missing"} tone={project.configExists ? "ok" : "bad"} />
        <StatusPill label="runtime" value={runtimeStatus} tone={runtimeStatus === "ready" ? "ok" : runtimeStatus === "error" ? "bad" : "neutral"} />
        <StatusPill label="tools" value={String(toolsCount)} />
        <StatusPill label="last scan" value={project.lastScannedAt ?? "-"} wide />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 border-t border-border-soft pt-3">
        <button
          type="button"
          onClick={() => onRemoveProjectRecord(project.id)}
          className="inline-flex h-7 items-center gap-1.5 rounded-control border border-border bg-surface-app px-2.5 text-[11px] font-semibold text-text-muted hover:bg-surface-muted hover:text-text"
        >
          <XCircle className="h-3.5 w-3.5" />
          移除记录
        </button>
        <button
          type="button"
          onClick={() => onDeleteProjectLocalFolder(project.id)}
          className="inline-flex h-7 items-center gap-1.5 rounded-control border border-red-500/20 bg-red-500/5 px-2.5 text-[11px] font-semibold text-red-600 hover:bg-red-500/10"
        >
          <Trash2 className="h-3.5 w-3.5" />
          删除本地文件夹
        </button>
      </div>
    </article>
  );
}

function StatusPill({
  label,
  value,
  tone = "neutral",
  wide = false,
}: {
  label: string;
  value: string;
  tone?: "neutral" | "ok" | "bad";
  wide?: boolean;
}) {
  const toneClass =
    tone === "ok"
      ? "text-emerald-600"
      : tone === "bad"
        ? "text-red-600"
        : "text-text";
  return (
    <div className={["min-w-0 rounded-control bg-surface-app px-2 py-1.5", wide ? "col-span-2" : ""].join(" ")}>
      <div className="text-[10px] font-semibold uppercase text-text-subtle">{label}</div>
      <div className={`truncate font-mono text-[11px] font-semibold ${toneClass}`} title={value}>
        {value}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-control px-3 py-2 hover:bg-surface-muted">
      <span className="text-xs font-semibold text-text-subtle">{label}</span>
      <strong className="min-w-0 truncate text-right text-xs font-semibold text-text" title={value}>
        {value}
      </strong>
    </div>
  );
}

function latestTimestamp(values: Array<string | undefined>) {
  const sorted = values
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => Date.parse(b) - Date.parse(a));
  return sorted[0];
}
