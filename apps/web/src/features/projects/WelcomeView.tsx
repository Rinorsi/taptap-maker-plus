import {
  Box,
  ChevronRight,
  Folder,
  FolderSync,
  Image as ImageIcon,
  MoreHorizontal,
  Music,
  Play,
  RefreshCw,
  Scan,
  Trash2,
  Video,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { AssetSummary, ProjectSummary, RuntimeSummary, TaskRecord, ToolSummary } from "../../api";
import type { WorkbenchModule } from "../../app/routes";
import { isDeveloperModeEnabled } from "../../lib/developerMode";
import { AppUpdatePanel, useAppUpdateUi, VersionPill } from "../updates/appUpdateUi";

type Props = {
  projects: ProjectSummary[];
  selectedProjectId: string;
  runtime?: RuntimeSummary;
  tools: ToolSummary[];
  tasks: TaskRecord[];
  assets: AssetSummary[];
  onSelectProject: (projectId: string) => void;
  onScanProjects: () => void;
  onOpenCloudProjects?: () => void;
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
  onOpenCloudProjects,
  onScanAssets,
  onRefreshProject,
  onStartRuntime,
  onRemoveProjectRecord,
  onDeleteProjectLocalFolder,
  onOpenModule,
  busy,
}: Props) {
  const updateState = useAppUpdateUi(isDeveloperModeEnabled());
  const [versionPanelOpen, setVersionPanelOpen] = useState(false);
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

  useEffect(() => {
    const latestVersion = updateState.status?.latestVersion;
    if (!updateState.status?.updateAvailable || !latestVersion) return;
    const storageKey = `taptap.updatePromptSeen.${latestVersion}`;
    if (localStorage.getItem(storageKey) === "true") return;
    localStorage.setItem(storageKey, "true");
    setVersionPanelOpen(true);
  }, [updateState.status?.latestVersion, updateState.status?.updateAvailable]);

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-y-auto text-text">
      
      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col gap-12 p-8 lg:flex-row lg:items-center lg:p-12 xl:p-16">
        {/* Left Column (Start & Recent) */}
        <section className="flex w-full shrink-0 flex-col lg:w-[320px]">
          <div className="mb-10">
            <div className="mb-4 flex items-center gap-3 select-none">
              <img src="/files.png" alt="Plus" className="h-10 rounded-xl object-contain shadow-sm" />
              <img src="/logo-text.png" alt="TapTap Maker Plus" className="h-8 object-contain" />
            </div>
          </div>

          <div className="mb-8">
            <h2 className="mb-3 text-xs font-bold text-text-muted tracking-wider">快速开始</h2>
            <button
              onClick={onScanProjects}
              disabled={busy}
              className="group flex w-full items-center gap-3 rounded-lg py-2 text-left text-sm font-medium text-text transition-colors hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded bg-surface-panel text-text-muted transition-colors group-hover:bg-brand/10 group-hover:text-brand">
                <FolderSync className="h-4 w-4" />
              </div>
              选择本地项目...
            </button>
            <button
              onClick={onOpenCloudProjects}
              disabled={busy || !onOpenCloudProjects}
              className="group mt-1 flex w-full items-center gap-3 rounded-lg py-2 text-left text-sm font-medium text-text transition-colors hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded bg-surface-panel text-text-muted transition-colors group-hover:bg-brand/10 group-hover:text-brand">
                <RefreshCw className="h-4 w-4" />
              </div>
              从云端拉取项目...
            </button>
          </div>

          <div>
            <h2 className="mb-3 text-xs font-bold text-text-muted tracking-wider">最近项目</h2>
            {projects.length === 0 ? (
              <p className="text-sm text-text-subtle">没有最近项目</p>
            ) : (
              <div className="flex flex-col gap-1">
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

        {/* Right Column (Dashboard) */}
        <section className="flex min-w-0 flex-1 flex-col pt-2 lg:pt-0">
          {!selectedProject ? (
            <div className="flex h-64 flex-col items-center justify-center text-center opacity-60">
              <img src="/files.png" alt="Logo" className="mb-4 h-16 w-16 rounded-xl object-contain opacity-20 grayscale" />
              <p className="text-sm text-text-muted">请选择本地项目，或从云端拉取项目后开始工作</p>
            </div>
          ) : (
            <div className="flex flex-col gap-10">
              {/* Hero Header */}
              <div className="flex flex-col gap-4">
                <div className="min-w-0">
                  <h1 className="m-0 text-3xl font-bold text-text truncate">{selectedProject.name}</h1>
                  <div className="mt-2 flex items-center gap-2 text-sm text-text-subtle font-mono">
                    <Folder className="h-4 w-4 opacity-70" />
                    <span className="truncate">{selectedProject.rootPath}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={onStartRuntime}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded bg-brand px-5 text-sm font-bold text-white hover:brightness-110 transition-all disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    启动引擎
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onRefreshProject?.()}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded bg-surface-panel px-4 text-sm font-medium text-text hover:bg-surface-muted transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RefreshCw className="h-4 w-4 text-text-muted" />
                    同步状态
                  </button>
                </div>
              </div>

              {/* Metrics */}
              <div>
                <h2 className="mb-4 text-xs font-bold text-text-muted tracking-wider">环境状态</h2>
                <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                  <MetricCard label="引擎状态" value={runtime?.status ?? selectedProject?.runtime?.status ?? "idle"} />
                  <MetricCard
                    label="运行任务"
                    value={
                      <span className="flex items-baseline gap-1.5" title={`总计: ${selectedProjectTasks.length}, 运行中: ${runningTaskCount}`}>
                        <span>{selectedProjectTasks.length}</span>
                        {runningTaskCount > 0 ? (
                          <span className="text-xs text-brand-strong font-sans opacity-90">({runningTaskCount} 运行中)</span>
                        ) : null}
                      </span>
                    }
                  />
                  <MetricCard label="资产数量" value={`${selectedProjectAssets.length}`} />
                  <MetricCard label="工具数量" value={`${tools.length || runtime?.toolCount || selectedProject?.runtime?.toolCount || 0}`} />
                </div>
              </div>

              {/* Launchpad Grid */}
              <div>
                <h2 className="mb-4 text-xs font-bold text-text-muted tracking-wider">工作室与工作流</h2>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {quickEntries.map((entry) => {
                    const Icon = entry.icon;
                    return (
                      <button
                        key={entry.module}
                        type="button"
                        onClick={() => onOpenModule(entry.module)}
                        className="group flex items-center gap-4 rounded-xl border border-transparent p-4 text-left transition-all hover:bg-surface-panel hover:border-border-soft"
                      >
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface-panel text-text-muted transition-colors group-hover:bg-brand/10 group-hover:text-brand">
                          <Icon className="h-6 w-6" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="block text-sm font-bold text-text group-hover:text-brand-strong transition-colors">{entry.label}</span>
                          <span className="mt-0.5 block text-[11px] text-text-subtle truncate">打开模块</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
      
      {/* Footer Version */}
      <div className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2 select-none">
        <VersionPill
          status={updateState.status}
          onClick={() => setVersionPanelOpen(true)}
          className={updateState.status?.updateAvailable ? "opacity-100" : "opacity-35 hover:opacity-100"}
        />
      </div>
      {versionPanelOpen ? (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-surface-app/70 px-5 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-xl border border-border bg-surface-panel p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="m-0 text-base font-bold text-text">
                  {updateState.status?.updateAvailable
                    ? `检测到最新版本 ${updateState.status.latestVersion}`
                    : "版本历史"}
                </h2>
                <p className="m-0 mt-1 text-xs text-text-subtle">
                  版本信息来自 GitHub Releases。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setVersionPanelOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-control text-text-muted hover:bg-surface-muted hover:text-text"
                title="关闭"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>
            <AppUpdatePanel state={updateState} />
          </div>
        </div>
      ) : null}
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
  return (
    <article
      className={[
        "group relative flex items-center rounded-lg px-3 py-2 transition-colors",
        selected 
          ? "bg-surface-panel text-brand-strong before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-r before:bg-brand" 
          : "text-text hover:bg-surface-panel/50",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={() => onSelectProject(project.id)}
        className="flex w-full min-w-0 flex-1 items-center gap-3 text-left"
      >
        <div className="min-w-0 flex-1 flex flex-col">
          <span className="truncate text-[13px] font-bold">
            {project.name}
          </span>
          <span className="truncate text-[11px] opacity-60 font-mono mt-0.5" title={project.rootPath}>
            {project.rootPath}
          </span>
        </div>
      </button>

      {/* Hover Actions */}
      <div className="ml-2 flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          title="移除记录"
          onClick={(e) => { e.stopPropagation(); onRemoveProjectRecord(project.id); }}
          className="p-1.5 text-text-muted hover:text-text hover:bg-surface-muted rounded transition-colors"
        >
          <XCircle className="h-3.5 w-3.5" />
        </button>
      </div>
    </article>
  );
}

function MetricCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-bold text-text-muted">{label}</span>
      <strong className="text-lg font-mono font-bold text-text truncate" title={typeof value === 'string' ? value : undefined}>{value}</strong>
    </div>
  );
}

function latestTimestamp(values: Array<string | undefined>) {
  const sorted = values
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => Date.parse(b) - Date.parse(a));
  return sorted[0];
}
