import { motion, AnimatePresence } from "framer-motion";
import type { AgentPageState, AssetSummary, ProjectSummary, RuntimeSummary, TaskRecord, ToolSummary } from "../../api";
import type { InspectorSelection } from "./AgentInspectorPanel";
import type { WorkbenchModule } from "../../app/routes";
import type { AppCommandContext } from "../../commands";
import { ProjectOverview } from "../../features/projects/ProjectOverview";
import { WelcomeView } from "../../features/projects/WelcomeView";
import { AssetHub } from "../../features/assets/AssetHub";
import { ToolStudio } from "../../features/generation/ToolStudio";
import { ImageStudio } from "../../features/generation/ImageStudio";
import { VideoStudio } from "../../features/generation/VideoStudio";
import { RunsView } from "../../features/runs/RunsView";
import { SettingsView } from "../../features/settings/SettingsView";
import { BuildCenter } from "../../features/build/BuildCenter";
import { WorkflowCanvas } from "../../features/workflow/WorkflowCanvas";
import { MusicStudio } from "../../features/generation/MusicStudio";
import { Model3DStudio } from "../../features/generation/Model3DStudio";
import { AgentContextView } from "../../features/agent/AgentContextView";

type Props = {
  activeModule: WorkbenchModule;
  project?: ProjectSummary;
  runtime?: RuntimeSummary;
  tools: ToolSummary[];
  assets: AssetSummary[];
  tasks: TaskRecord[];
  statusText: string;
  busy: boolean;
  onStartRuntime: () => void;
  onScanAssets: () => void;
  onDeleteAssets: (relativePaths: string[]) => Promise<void>;
  onMoveAssets: (relativePaths: string[], targetFolder: string) => Promise<void>;
  onCopyAssets: (relativePaths: string[], targetFolder: string) => Promise<void>;
  onRenameAsset: (relativePath: string, newName: string) => Promise<void>;
  onImportAssets: (files: File[], targetFolder: string) => Promise<void>;
  onCallStatusLite: () => void;
  onCallTool: (toolName: string, args: Record<string, unknown>) => Promise<unknown>;
  onSelect: (selection: InspectorSelection) => void;
  agentPage: AgentPageState;
  projects: ProjectSummary[];
  onSelectProject: (projectId: string) => void;
  onScanProjects: () => void;
  onOpenModule: (module: WorkbenchModule) => void;
  onCollapseSidebar?: () => void;
  onShowError?: () => void;
  onCanvasCommandContextChange?: (context?: AppCommandContext) => void;
};

export function WorkbenchViewport(props: Props) {
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
          {props.activeModule === "home" ? (
            <WelcomeView
              projects={props.projects}
              onSelectProject={props.onSelectProject}
              onScanProjects={props.onScanProjects}
              onOpenModule={props.onOpenModule}
              busy={props.busy}
            />
          ) : null}
          {props.activeModule === "assets" ? <AssetHub project={props.project} assets={props.assets} onScanAssets={props.onScanAssets} onDeleteAssets={props.onDeleteAssets} onMoveAssets={props.onMoveAssets} onCopyAssets={props.onCopyAssets}
              onImportAssets={props.onImportAssets}
              onSelectAsset={(asset) => props.onSelect({ type: "asset", item: asset })} /> : null}
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
              onImportAssets={props.onImportAssets}
            />
          ) : null}
          {props.activeModule === "studio-video" ? (
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
              onImportAssets={props.onImportAssets}
              onCollapseSidebar={props.onCollapseSidebar}
              onShowError={props.onShowError}
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
              onDeleteAssets={props.onDeleteAssets}
              onMoveAssets={props.onMoveAssets}
              onRenameAsset={props.onRenameAsset}
              onImportAssets={props.onImportAssets}
              onScanAssets={props.onScanAssets}
            />
          ) : null}
          {props.activeModule === "workflow" ? <WorkflowCanvas project={props.project} tools={props.tools} tasks={props.tasks} onSelectTool={(tool) => props.onSelect({ type: "tool", item: tool })} onCommandContextChange={props.onCanvasCommandContextChange} /> : null}

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
          {props.activeModule === "runs" ? <RunsView tasks={props.tasks} onSelectTask={(task) => props.onSelect({ type: "task", item: task })} /> : null}
          {props.activeModule === "agent" ? <AgentContextView project={props.project} page={props.agentPage} /> : null}
          {props.activeModule === "settings" ? <SettingsView project={props.project} runtime={props.runtime} tools={props.tools} /> : null}
        </motion.div>
      </AnimatePresence>
    </main>
  );
}
