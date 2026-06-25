import { useMemo } from "react";
import { Boxes } from "lucide-react";
import type { AssetSummary, ProjectSummary, TaskRecord, ToolSummary } from "../../api";
import type { AppCommandContext } from "../../commands";
import { StudioHeader } from "../../components/studio/StudioKit";
import { VideoFlowCanvas } from "./VideoFlowCanvas";

type Props = {
  project?: ProjectSummary;
  tools: ToolSummary[];
  assets: AssetSummary[];
  tasks: TaskRecord[];
  onCallTool: (toolName: string, args: Record<string, unknown>) => Promise<unknown>;
  onShowError?: () => void;
  onCommandContextChange?: (context?: AppCommandContext) => void;
};

const canvasToolNames = ["generate_image", "edit_image", "create_video_task", "text_to_music"];

export function UniversalCanvas({
  project,
  tools,
  assets,
  tasks,
  onCallTool,
  onShowError,
  onCommandContextChange,
}: Props) {
  const canvasTools = useMemo(
    () => tools.filter((tool) => canvasToolNames.includes(tool.name)),
    [tools],
  );
  const projectAssets = useMemo(() => {
    if (!project) return [];
    return assets
      .filter((asset) => asset.projectId === project.id)
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
  }, [assets, project]);
  const activeGenerationTask = useMemo(() => {
    if (!project) return undefined;
    return tasks.find(
      (task) =>
        task.projectId === project.id &&
        canvasToolNames.includes(task.toolName) &&
        (task.status === "queued" || task.status === "running"),
    );
  }, [project, tasks]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-4 p-4">
      <StudioHeader
        icon={<Boxes className="h-3.5 w-3.5" />}
        eyebrow="Creative Canvas"
        title="全能节点画布"
        projectName={project?.name}
      />
      <div className="min-h-0 flex-1 overflow-hidden rounded-3xl border border-white/5 bg-surface-panel/40 shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
        <VideoFlowCanvas
          project={project}
          allAssets={projectAssets}
          activeGenerationTask={activeGenerationTask}
          isCloudVideoRunning={false}
          canvasTools={canvasTools}
          canvasKind="universal"
          onCallTool={onCallTool}
          onShowError={onShowError}
          onCommandContextChange={onCommandContextChange}
        />
      </div>
    </div>
  );
}
