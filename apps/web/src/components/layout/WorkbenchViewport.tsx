import { lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { AgentPageState, AssetDirectoryNode, AssetMutationResponse, AssetSummary, ProjectSummary, RuntimeSummary, TaskRecord, ToolSummary } from "../../api";
import type { InspectorSelection } from "./AgentInspectorPanel";
import type { WorkbenchModule } from "../../app/routes";
import type { AppCommandContext } from "../../commands";
import type { SettingsTab } from "../../features/settings/settingsTabs";

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
  onNotice: (notice: string) => void;
  onCallStatusLite: () => void;
  onCallTool: (toolName: string, args: Record<string, unknown>) => Promise<unknown>;
  onSelect: (selection: InspectorSelection) => void;
  agentPage: AgentPageState;
  projects: ProjectSummary[];
  onSelectProject: (projectId: string) => void;
  onScanProjects: () => void;
  onOpenModule: (module: WorkbenchModule) => void;
  activeSettingsTab: SettingsTab;
  sidebarCollapsed: boolean;
  onActiveSettingsTabChange: (tab: SettingsTab) => void;
  onExitSettings: () => void;
  onCollapseSidebar?: () => void;
  onShowError?: () => void;
  onCanvasCommandContextChange?: (context?: AppCommandContext) => void;
};

export function WorkbenchViewport(props: Props) {
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
          onScanAssets={props.onScanAssets}
          onRefreshProject={props.onRefreshProject}
          onStartRuntime={props.onStartRuntime}
          onRemoveProjectRecord={props.onRemoveProjectRecord}
          onDeleteProjectLocalFolder={props.onDeleteProjectLocalFolder}
          onOpenModule={props.onOpenModule}
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
        <AgentContextView project={props.project} page={props.agentPage} />
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
        />
      ) : null}
    </>
  );

  return (
    <main className="flex-1 min-h-0 relative">
      <AnimatePresence mode="wait">
        <motion.div
          key={props.activeModule}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 overflow-auto"
        >
          <Suspense fallback={<WorkbenchModuleFallback />}>
            {moduleView}
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </main>
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
