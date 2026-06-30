import { lazy, Suspense, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { AgentPageState, AssetDirectoryNode, AssetMutationResponse, AssetSummary, ProjectSummary, RuntimeSummary, TaskRecord, ToolSummary } from "../../api";
import type { InspectorSelection } from "./AgentInspectorPanel";
import { workbenchRoutes, type WorkbenchModule } from "../../app/routes";
import type { AppCommandContext, Command } from "../../commands";
import type { SettingsTab } from "../../features/settings/settingsTabs";
import { AlertTriangle, X } from "lucide-react";

const DISMISSED_UNFINISHED_MODULES_STORAGE_KEY = "taptap.dismissedUnfinishedModules";

const WelcomeView = lazy(() =>
  import("../../features/projects/WelcomeView").then((module) => ({
    default: module.WelcomeView,
  })),
);
const AssetHub = lazy(() =>
  import("../../features/assets/AssetHub").then((module) => ({
    default: module.AssetHub,
  })),
);
const ImageStudio = lazy(() =>
  import("../../features/generation/ImageStudio").then((module) => ({
    default: module.ImageStudio,
  })),
);
const VideoStudio = lazy(() =>
  import("../../features/generation/VideoStudio").then((module) => ({
    default: module.VideoStudio,
  })),
);
const MusicStudio = lazy(() =>
  import("../../features/generation/MusicStudio").then((module) => ({
    default: module.MusicStudio,
  })),
);
const Model3DStudio = lazy(() =>
  import("../../features/generation/Model3DStudio").then((module) => ({
    default: module.Model3DStudio,
  })),
);
const AboutView = lazy(() =>
  import("../../features/about/AboutView").then((module) => ({
    default: module.AboutView,
  })),
);
const BuildCenter = lazy(() =>
  import("../../features/build/BuildCenter").then((module) => ({
    default: module.BuildCenter,
  })),
);
const AgentContextView = lazy(() =>
  import("../../features/agent/AgentContextView").then((module) => ({
    default: module.AgentContextView,
  })),
);
const RunsView = lazy(() =>
  import("../../features/runs/RunsView").then((module) => ({
    default: module.RunsView,
  })),
);
const SettingsView = lazy(() =>
  import("../../features/settings/SettingsView").then((module) => ({
    default: module.SettingsView,
  })),
);

type Props = {
  activeModule: WorkbenchModule;
  project?: ProjectSummary;
  runtime?: RuntimeSummary;
  tools: ToolSummary[];
  assets: AssetSummary[];
  assetTree?: AssetDirectoryNode;
  tasks: TaskRecord[];
  statusText: string;
  busy: boolean;
  onStartRuntime: () => void;
  onStopRuntime: () => void;
  onRefreshTools: () => void;
  onScanAssets: () => void;
  onRemoveProjectRecord: (projectId: string) => void;
  onDeleteProjectLocalFolder: (projectId: string) => void;
  onDeleteAssets: (relativePaths: string[]) => Promise<void>;
  onMoveAssets: (relativePaths: string[], targetFolder: string) => Promise<void>;
  onCopyAssets: (relativePaths: string[], targetFolder: string) => Promise<void>;
  onRenameAsset: (relativePath: string, newName: string) => Promise<void>;
  onRenameDirectory: (directoryPath: string, newName: string) => Promise<void>;
  onMoveDirectory: (directoryPath: string, targetFolder: string) => Promise<void>;
  onCopyDirectory: (directoryPath: string, targetFolder: string) => Promise<void>;
  onDeleteDirectory: (directoryPath: string) => Promise<void>;
  onOpenLocalAssetPath: (relativePath: string, mode: "file" | "directory") => Promise<void>;
  onImportAssets: (files: File[], targetFolder: string) => Promise<void>;
  onCreateFolder: (parentFolder: string) => Promise<void>;
  onConfirmReferenceMutation: (relativePaths: string[], actionLabel: string, allowUpdateReferences: boolean) => Promise<"update" | "skip" | "cancel">;
  onAssetMutationResult: (prefix: string, result: AssetMutationResponse) => void;
  onScanAssetReferences: (relativePaths: string[]) => Promise<void>;
  onRefreshProject?: () => void | Promise<void>;
  onProjectsRootChanged?: (projects: ProjectSummary[], selectedProjectId?: string) => void;
  onResetInitialState?: () => void;
  onThemePreferenceChange?: (themePreference: "system" | "light" | "dark") => void;
  onNotice: (notice: string) => void;
  onCallStatusLite: () => void;
  onCallTool: (toolName: string, args: Record<string, unknown>) => Promise<unknown>;
  onSelect: (selection: InspectorSelection) => void;
  agentPage: AgentPageState;
  projects: ProjectSummary[];
  onSelectProject: (projectId: string) => void;
  onScanProjects: () => void;
  onOpenCloudProjects?: () => void;
  onOpenVersionHistory?: () => void;
  appUpdateAvailable?: boolean;
  appLatestVersion?: string;
  onOpenModule: (module: WorkbenchModule) => void;
  onExitAgent: () => void;
  activeSettingsTab: SettingsTab;
  sidebarCollapsed: boolean;
  onActiveSettingsTabChange: (tab: SettingsTab) => void;
  onExitSettings: () => void;
  onCollapseSidebar?: () => void;
  onShowError?: () => void;
  onCanvasCommandContextChange?: (context?: AppCommandContext) => void;
  commands: Command[];
};

export function WorkbenchViewport(props: Props) {
  const activeRoute = workbenchRoutes.find((route) => route.id === props.activeModule);
  const unfinishedRouteNote = activeRoute?.developerOnly ? activeRoute.hiddenPageNote : undefined;
  const [dismissedUnfinishedModules, setDismissedUnfinishedModules] = useState<WorkbenchModule[]>(() =>
    readDismissedUnfinishedModules(),
  );
  const showUnfinishedCard = Boolean(
    unfinishedRouteNote && !dismissedUnfinishedModules.includes(props.activeModule),
  );
  const dismissUnfinishedModule = () => {
    setDismissedUnfinishedModules((current) => {
      if (current.includes(props.activeModule)) return current;
      const next = [...current, props.activeModule];
      writeDismissedUnfinishedModules(next);
      return next;
    });
  };
  const moduleView = (
    <>
      {props.activeModule === "home" ? (
        <WelcomeView
          projects={props.projects}
          selectedProjectId={props.project?.id ?? ""}
          runtime={props.runtime}
          tools={props.tools}
          tasks={props.tasks}
          assets={props.assets}
          onSelectProject={props.onSelectProject}
          onScanProjects={props.onScanProjects}
          onOpenCloudProjects={props.onOpenCloudProjects}
          onScanAssets={props.onScanAssets}
          onRefreshProject={props.onRefreshProject}
          onStartRuntime={props.onStartRuntime}
          onRemoveProjectRecord={props.onRemoveProjectRecord}
          onDeleteProjectLocalFolder={props.onDeleteProjectLocalFolder}
          onOpenModule={props.onOpenModule}
          onOpenVersionHistory={props.onOpenVersionHistory}
          appUpdateAvailable={props.appUpdateAvailable}
          appLatestVersion={props.appLatestVersion}
          busy={props.busy}
        />
      ) : null}
      {props.activeModule === "assets" ? (
        <AssetHub
          project={props.project}
          assets={props.assets}
          assetTree={props.assetTree}
          onScanAssets={props.onScanAssets}
          onDeleteAssets={props.onDeleteAssets}
          onMoveAssets={props.onMoveAssets}
          onCopyAssets={props.onCopyAssets}
          onRenameAsset={props.onRenameAsset}
          onRenameDirectory={props.onRenameDirectory}
          onMoveDirectory={props.onMoveDirectory}
          onCopyDirectory={props.onCopyDirectory}
          onDeleteDirectory={props.onDeleteDirectory}
          onOpenLocalPath={props.onOpenLocalAssetPath}
          onImportAssets={props.onImportAssets}
          onCreateFolder={props.onCreateFolder}
          onConfirmReferenceMutation={props.onConfirmReferenceMutation}
          onAssetMutationResult={props.onAssetMutationResult}
          onScanReferences={props.onScanAssetReferences}
          onNotice={props.onNotice}
          onSelectAsset={(asset) => props.onSelect({ type: "asset", item: asset })}
        />
      ) : null}
      {props.activeModule === "studio-image" ? (
        <ImageStudio
          project={props.project}
          tools={props.tools}
          assets={props.assets}
          tasks={props.tasks}
          busy={props.busy}
          onCallTool={props.onCallTool}
          onSelectTool={(tool) => props.onSelect({ type: "tool", item: tool })}
          onSelectAsset={(asset) => props.onSelect({ type: "asset", item: asset })}
          onScanAssets={props.onScanAssets}
          onDeleteAssets={props.onDeleteAssets}
          onMoveAssets={props.onMoveAssets}
          onCopyAssets={props.onCopyAssets}
          onRenameAsset={props.onRenameAsset}
          onRenameDirectory={props.onRenameDirectory}
          onMoveDirectory={props.onMoveDirectory}
          onCopyDirectory={props.onCopyDirectory}
          onDeleteDirectory={props.onDeleteDirectory}
          onCreateFolder={props.onCreateFolder}
          onOpenLocalPath={props.onOpenLocalAssetPath}
          onScanReferences={props.onScanAssetReferences}
          onImportAssets={props.onImportAssets}
        />
      ) : null}
      {props.activeModule === "studio-video" || props.activeModule === "studio-canvas" || props.activeModule === "workflow" ? (
        <VideoStudio
          project={props.project}
          tools={props.tools}
          assets={props.assets}
          tasks={props.tasks}
          busy={props.busy}
          onCallTool={props.onCallTool}
          onSelectTool={(tool) => props.onSelect({ type: "tool", item: tool })}
          onSelectAsset={(asset) => props.onSelect({ type: "asset", item: asset })}
          onScanAssets={props.onScanAssets}
          onDeleteAssets={props.onDeleteAssets}
          onMoveAssets={props.onMoveAssets}
          onCopyAssets={props.onCopyAssets}
          onRenameAsset={props.onRenameAsset}
          onRenameDirectory={props.onRenameDirectory}
          onMoveDirectory={props.onMoveDirectory}
          onCopyDirectory={props.onCopyDirectory}
          onDeleteDirectory={props.onDeleteDirectory}
          onCreateFolder={props.onCreateFolder}
          onOpenLocalPath={props.onOpenLocalAssetPath}
          onScanReferences={props.onScanAssetReferences}
          onImportAssets={props.onImportAssets}
          onCollapseSidebar={props.onCollapseSidebar}
          onShowError={props.onShowError}
          onRequestProjectRefresh={props.onRefreshProject}
          onCommandContextChange={props.onCanvasCommandContextChange}
        />
      ) : null}
      {props.activeModule === "studio-music" ? (
        <MusicStudio
          project={props.project}
          tools={props.tools}
          assets={props.assets}
          tasks={props.tasks}
          busy={props.busy}
          onCallTool={props.onCallTool}
          onSelectTool={(tool) => props.onSelect({ type: "tool", item: tool })}
          onSelectAsset={(asset) => props.onSelect({ type: "asset", item: asset })}
          onScanAssets={props.onScanAssets}
          onDeleteAssets={props.onDeleteAssets}
          onMoveAssets={props.onMoveAssets}
          onCopyAssets={props.onCopyAssets}
          onRenameAsset={props.onRenameAsset}
          onRenameDirectory={props.onRenameDirectory}
          onMoveDirectory={props.onMoveDirectory}
          onCopyDirectory={props.onCopyDirectory}
          onDeleteDirectory={props.onDeleteDirectory}
          onCreateFolder={props.onCreateFolder}
          onOpenLocalPath={props.onOpenLocalAssetPath}
          onScanReferences={props.onScanAssetReferences}
          onImportAssets={props.onImportAssets}
        />
      ) : null}
      {props.activeModule === "studio-3d" ? (
        <Model3DStudio
          project={props.project}
          tools={props.tools}
          assets={props.assets}
          tasks={props.tasks}
          busy={props.busy}
          onCallTool={props.onCallTool}
          onSelectTool={(tool) => props.onSelect({ type: "tool", item: tool })}
          onSelectAsset={(asset) => props.onSelect({ type: "asset", item: asset })}
          onScanAssets={props.onScanAssets}
          onDeleteAssets={props.onDeleteAssets}
          onMoveAssets={props.onMoveAssets}
          onCopyAssets={props.onCopyAssets}
          onRenameAsset={props.onRenameAsset}
          onRenameDirectory={props.onRenameDirectory}
          onMoveDirectory={props.onMoveDirectory}
          onCopyDirectory={props.onCopyDirectory}
          onDeleteDirectory={props.onDeleteDirectory}
          onCreateFolder={props.onCreateFolder}
          onOpenLocalPath={props.onOpenLocalAssetPath}
          onScanReferences={props.onScanAssetReferences}
          onImportAssets={props.onImportAssets}
        />
      ) : null}
      {props.activeModule === "about" ? (
        <AboutView />
      ) : null}
      {props.activeModule === "build" ? (
        <BuildCenter
          project={props.project}
          runtime={props.runtime}
          tools={props.tools}
          tasks={props.tasks}
          busy={props.busy}
          onCallTool={props.onCallTool}
          onSelectTool={(tool) => props.onSelect({ type: "tool", item: tool })}
        />
      ) : null}
      {props.activeModule === "agent" ? (
        <AgentContextView project={props.project} page={props.agentPage} onExit={props.onExitAgent} />
      ) : null}
      {props.activeModule === "runs" ? (
        <RunsView
          tasks={props.tasks}
          onSelectTask={(task) => props.onSelect({ type: "task", item: task })}
        />
      ) : null}
      {props.activeModule === "settings" ? (
        <SettingsView
          project={props.project}
          runtime={props.runtime}
          tools={props.tools}
          busy={props.busy}
          activeTab={props.activeSettingsTab}
          sidebarCollapsed={props.sidebarCollapsed}
          onActiveTabChange={props.onActiveSettingsTabChange}
          onExitSettings={props.onExitSettings}
          onStartRuntime={props.onStartRuntime}
          onStopRuntime={props.onStopRuntime}
          onRefreshTools={props.onRefreshTools}
          onStatusLite={props.onCallStatusLite}
          onProjectsRootChanged={props.onProjectsRootChanged}
          onResetInitialState={props.onResetInitialState}
          onThemePreferenceChange={props.onThemePreferenceChange}
          commands={props.commands}
        />
      ) : null}
    </>
  );

  return (
    <main className="workbench-page-scrim flex-1 min-h-0 relative">
      <AnimatePresence mode="wait">
        <motion.div
          key={props.activeModule}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className={props.activeModule === "agent" ? "absolute inset-0 overflow-hidden" : "absolute inset-0 overflow-auto"}
        >
          <Suspense fallback={<WorkbenchModuleFallback />}>
            {moduleView}
          </Suspense>
          {unfinishedRouteNote ? (
            <UnfinishedModuleOverlay
              title={activeRoute?.label ?? "隐藏页面"}
              note={unfinishedRouteNote}
              showCard={showUnfinishedCard}
              onDismiss={dismissUnfinishedModule}
              onReturn={() => props.onOpenModule(props.project ? "assets" : "home")}
            />
          ) : null}
        </motion.div>
      </AnimatePresence>
    </main>
  );
}

function readDismissedUnfinishedModules(): WorkbenchModule[] {
  try {
    const text = localStorage.getItem(DISMISSED_UNFINISHED_MODULES_STORAGE_KEY);
    if (!text) return [];
    const parsed = JSON.parse(text) as unknown;
    if (!Array.isArray(parsed)) return [];
    const routeIds = new Set(workbenchRoutes.map((route) => route.id));
    return parsed.filter((item): item is WorkbenchModule => typeof item === "string" && routeIds.has(item as WorkbenchModule));
  } catch {
    return [];
  }
}

function writeDismissedUnfinishedModules(modules: WorkbenchModule[]) {
  try {
    localStorage.setItem(DISMISSED_UNFINISHED_MODULES_STORAGE_KEY, JSON.stringify(modules));
  } catch {
    // Ignore storage failures; the current session still keeps the dismissed state.
  }
}

function UnfinishedModuleOverlay({
  title,
  note,
  showCard,
  onDismiss,
  onReturn,
}: {
  title: string;
  note: string;
  showCard: boolean;
  onDismiss: () => void;
  onReturn: () => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex flex-col">
      <div className="flex min-h-[44px] shrink-0 items-center justify-between gap-3 border-b border-[#b03939]/25 bg-[#b03939]/10 px-5 text-[#b03939]">
        <div className="flex min-w-0 items-center gap-2 text-[12px] font-bold">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="truncate">{title} 是未完成隐藏页面，禁止在正式工作流中使用。</span>
        </div>
        <button
          type="button"
          onClick={onReturn}
          className="pointer-events-auto inline-flex h-7 shrink-0 items-center justify-center rounded-control px-2 text-[11px] font-semibold text-[#b03939] hover:bg-[#b03939]/10"
          title="关闭并返回工作区"
        >
          返回工作区
        </button>
      </div>
      {showCard ? (
        <div className="pointer-events-auto flex flex-1 items-start justify-center bg-surface-app/82 px-6 py-10 backdrop-blur-sm">
          <div className="relative w-full max-w-xl rounded-large border border-[#b03939]/30 bg-surface-panel p-5 shadow-xl">
            <button
              type="button"
              onClick={onDismiss}
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-control text-text-muted hover:bg-surface-muted hover:text-text"
              title="关闭提示"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#b03939]/10 text-[#b03939]">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0 pr-8">
                <div className="text-[11px] font-bold uppercase tracking-wide text-[#b03939]">未完成隐藏页面</div>
                <h2 className="m-0 mt-1 text-lg font-bold text-text">{title} 禁止使用</h2>
                <p className="m-0 mt-2 text-sm leading-relaxed text-text-muted">
                  {note}。当前仅在开发者模式下暴露，用于后续开发定位；不要在正式工作流里使用这个页面。
                </p>
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={onDismiss}
                    className="inline-flex h-9 items-center justify-center rounded-control bg-[#b03939] px-4 text-sm font-bold text-white hover:bg-[#943030]"
                  >
                    我知道了，关闭提示
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function WorkbenchModuleFallback() {
  return (
    <div className="flex flex-col h-full min-h-[320px] items-center justify-center gap-4 text-text-subtle">
      <div className="relative flex items-center justify-center w-10 h-10">
        {/* Subtle background ring */}
        <div className="absolute inset-0 rounded-full border-2 border-brand/10 dark:border-brand/5"></div>
        {/* Fast spinning outer ring */}
        <div className="absolute inset-0 rounded-full border-2 border-brand border-t-transparent border-l-transparent animate-[spin_0.8s_linear_infinite]"></div>
        {/* Slow spinning inner dash */}
        <div className="absolute inset-[4px] rounded-full border-[1.5px] border-brand/40 border-b-transparent border-r-transparent animate-[spin_1.2s_linear_infinite_reverse]"></div>
        {/* Core pulsing dot */}
        <div className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse shadow-[0_0_8px_rgba(0,217,197,0.6)]"></div>
      </div>
      <div className="text-[13px] font-medium tracking-wider text-text-muted animate-pulse">
        正在加载模块...
      </div>
    </div>
  );
}
