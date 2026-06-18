import { motion, AnimatePresence } from "framer-motion";
import type { AssetSummary, ProjectSummary, RuntimeSummary, TaskRecord, ToolSummary } from "../../api";
import type { InspectorSelection } from "./AgentInspectorPanel";
import type { WorkbenchModule } from "../../app/routes";
import { ProjectOverview } from "../../features/projects/ProjectOverview";
import { WelcomeView } from "../../features/projects/WelcomeView";
import { AssetHub } from "../../features/assets/AssetHub";
import { ToolStudio } from "../../features/generation/ToolStudio";
import { ImageStudio } from "../../features/generation/ImageStudio";
import { RunsView } from "../../features/runs/RunsView";
import { SettingsView } from "../../features/settings/SettingsView";
import { BuildCenter } from "../../features/build/BuildCenter";
import { WorkflowCanvas } from "../../features/workflow/WorkflowCanvas";

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
  onRebuildAssetProvenance: () => void;
  onDeleteAssets: (relativePaths: string[]) => Promise<void>;
  onMoveAssets: (relativePaths: string[], targetFolder: string) => Promise<void>;
  onRenameAsset: (relativePath: string, newName: string) => Promise<void>;
  onImportImages: (files: File[], targetFolder: string) => Promise<void>;
  onCallStatusLite: () => void;
  onCallTool: (toolName: string, args: Record<string, unknown>) => Promise<void>;
  onSelect: (selection: InspectorSelection) => void;
  projects: ProjectSummary[];
  onSelectProject: (projectId: string) => void;
  onScanProjects: () => void;
  onOpenModule: (module: WorkbenchModule) => void;
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
          {props.activeModule === "assets" ? <AssetHub project={props.project} assets={props.assets} onScanAssets={props.onScanAssets} onRebuildAssetProvenance={props.onRebuildAssetProvenance} onDeleteAssets={props.onDeleteAssets} onMoveAssets={props.onMoveAssets}
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
              onRebuildAssetProvenance={props.onRebuildAssetProvenance}
              onDeleteAssets={props.onDeleteAssets}
              onMoveAssets={props.onMoveAssets}
              onRenameAsset={props.onRenameAsset}
              onImportImages={props.onImportImages}
            />
          ) : null}
          {props.activeModule === "studio-video" ? (
            <ToolStudio category="video" title="视频工作室" project={props.project} tools={props.tools} assets={props.assets} tasks={props.tasks} busy={props.busy} onCallTool={props.onCallTool} onSelectTool={(tool) => props.onSelect({ type: "tool", item: tool })} onSelectAsset={(asset) => props.onSelect({ type: "asset", item: asset })} />
          ) : null}
          {props.activeModule === "studio-music" ? (
            <ToolStudio category="music" title="音频工作室" project={props.project} tools={props.tools} assets={props.assets} tasks={props.tasks} busy={props.busy} onCallTool={props.onCallTool} onSelectTool={(tool) => props.onSelect({ type: "tool", item: tool })} onSelectAsset={(asset) => props.onSelect({ type: "asset", item: asset })} />
          ) : null}
          {props.activeModule === "studio-3d" ? (
            <ToolStudio category="model3d" title="3D 工作室" project={props.project} tools={props.tools} assets={props.assets} tasks={props.tasks} busy={props.busy} onCallTool={props.onCallTool} onSelectTool={(tool) => props.onSelect({ type: "tool", item: tool })} onSelectAsset={(asset) => props.onSelect({ type: "asset", item: asset })} />
          ) : null}
          {props.activeModule === "workflow" ? <WorkflowCanvas project={props.project} tools={props.tools} tasks={props.tasks} onSelectTool={(tool) => props.onSelect({ type: "tool", item: tool })} /> : null}
          
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
          {props.activeModule === "settings" ? <SettingsView project={props.project} runtime={props.runtime} tools={props.tools} /> : null}
        </motion.div>
      </AnimatePresence>
    </main>
  );
}
