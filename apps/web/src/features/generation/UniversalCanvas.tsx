import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Boxes, ChevronLeft, PanelRightClose, PanelRightOpen } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { AssetDirectoryNode, AssetSummary, ProjectSummary, TaskRecord, ToolSummary } from "../../api";
import type { AppCommandContext } from "../../commands";
import { StudioHeader } from "../../components/studio/StudioKit";
import { Button } from "../../components/ui/Button";
import { AssetManagerPanel } from "../assets/AssetManagerPanel";
import { cn } from "../../lib/utils";
import { VideoFlowCanvas } from "./VideoFlowCanvas";
import { writeAssetDragData } from "./dragData";
import { ResizablePanelHandle, useResizablePanelWidth } from "./ResizablePanelWidth";

type Props = {
  project?: ProjectSummary;
  tools: ToolSummary[];
  assets: AssetSummary[];
  assetTree?: AssetDirectoryNode;
  tasks: TaskRecord[];
  onCallTool: (toolName: string, args: Record<string, unknown>) => Promise<unknown>;
  onSelectAsset?: (asset: AssetSummary) => void;
  onScanAssets: () => void;
  onDeleteAssets: (relativePaths: string[]) => Promise<void>;
  onMoveAssets: (relativePaths: string[], targetFolder: string) => Promise<void>;
  onCopyAssets: (relativePaths: string[], targetFolder: string) => Promise<void>;
  onRenameAsset: (relativePath: string, newName: string) => Promise<void>;
  onRenameDirectory: (directoryPath: string, newName: string) => Promise<void>;
  onMoveDirectory: (directoryPath: string, targetFolder: string) => Promise<void>;
  onCopyDirectory: (directoryPath: string, targetFolder: string) => Promise<void>;
  onDeleteDirectory: (directoryPath: string) => Promise<void>;
  onOpenLocalPath: (relativePath: string, mode: "file" | "directory") => Promise<void>;
  onImportAssets: (files: File[], targetFolder: string) => Promise<void>;
  onCreateFolder: (parentFolder: string) => Promise<void>;
  onScanReferences: (relativePaths: string[]) => Promise<void>;
  onShowError?: () => void;
  onCommandContextChange?: (context?: AppCommandContext) => void;
  onCollapseSidebar?: () => void;
};

const canvasToolNames = ["generate_image", "edit_image", "create_video_task", "text_to_music"];
const canvasRuntimeToolNames = [...canvasToolNames, "query_video_task"];

export function UniversalCanvas({
  project,
  tools,
  assets,
  assetTree,
  tasks,
  onCallTool,
  onSelectAsset,
  onScanAssets,
  onDeleteAssets,
  onMoveAssets,
  onCopyAssets,
  onRenameAsset,
  onRenameDirectory,
  onMoveDirectory,
  onCopyDirectory,
  onDeleteDirectory,
  onOpenLocalPath,
  onImportAssets,
  onCreateFolder,
  onScanReferences,
  onShowError,
  onCommandContextChange,
  onCollapseSidebar,
}: Props) {
  const [isCanvasFullscreen, setIsCanvasFullscreen] = useState(false);
  const [isAssetDrawerOpen, setIsAssetDrawerOpen] = useState(true);
  const [assetToolbarContent, setAssetToolbarContent] = useState<ReactNode>(null);
  const handleAssetToolbarContent = useCallback((content: ReactNode) => {
    setAssetToolbarContent(content);
  }, []);
  const assetDrawerWidth = useResizablePanelWidth({
    defaultWidth: 420,
    minWidth: 320,
    maxWidth: 680,
    side: "right",
  });
  const canvasTools = useMemo(
    () => tools.filter((tool) => canvasRuntimeToolNames.includes(tool.name)),
    [tools],
  );
  useEffect(() => {
    onCollapseSidebar?.();
  }, [onCollapseSidebar]);
  useEffect(() => {
    if (!isCanvasFullscreen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setIsCanvasFullscreen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCanvasFullscreen]);
  useEffect(() => {
    if (isAssetDrawerOpen) return;
    setAssetToolbarContent(null);
  }, [isAssetDrawerOpen]);
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
    <div
      className={cn(
        "flex h-full min-h-0 w-full flex-col gap-4 overflow-hidden transition-[inset,padding,border-radius,background-color] duration-300",
        isCanvasFullscreen ? "fixed inset-0 z-[90] bg-surface-app p-0" : "p-4",
      )}
    >
      {!isCanvasFullscreen && (
        <StudioHeader
          icon={<Boxes className="h-3.5 w-3.5" />}
          eyebrow="Creative Canvas"
          title="全能节点画布"
          projectName={project?.name}
          actions={
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setIsAssetDrawerOpen((value) => !value)}
            >
              {isAssetDrawerOpen ? (
                <PanelRightClose className="h-4 w-4" />
              ) : (
                <PanelRightOpen className="h-4 w-4" />
              )}
              全部素材
            </Button>
          }
        />
      )}
      <div className="relative flex min-h-0 flex-1 gap-4 overflow-hidden">
        <div
          className={cn(
            "relative min-h-0 flex-1 overflow-hidden",
            isCanvasFullscreen
              ? "rounded-none border-0 bg-surface-app shadow-none"
              : "rounded-3xl border border-white/5 bg-surface-panel/40 shadow-[0_8px_30px_rgb(0,0,0,0.12)]",
          )}
        >
          <VideoFlowCanvas
            project={project}
            allAssets={projectAssets}
            activeGenerationTask={activeGenerationTask}
            isCloudVideoRunning={false}
            canvasTools={canvasTools}
            canvasKind="universal"
            isFullscreen={isCanvasFullscreen}
            onToggleFullscreen={() => setIsCanvasFullscreen((value) => !value)}
            onCallTool={onCallTool}
            onShowError={onShowError}
            onCommandContextChange={onCommandContextChange}
          />
        </div>
        <AnimatePresence initial={false}>
          {isAssetDrawerOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: assetDrawerWidth.width, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={assetDrawerWidth.isResizing ? { duration: 0 } : { duration: 0.3, ease: "easeInOut" }}
              className="relative flex min-h-0 shrink-0 flex-col overflow-hidden rounded-large border border-border bg-surface-panel shadow-sm"
              style={{ originX: 1 }}
            >
              <ResizablePanelHandle
                className="absolute bottom-0 left-0 top-0 z-20 -translate-x-1/2"
                onDoubleClick={assetDrawerWidth.resetWidth}
                {...assetDrawerWidth.resizeHandleProps}
              />
              <div className="flex h-11 shrink-0 items-center gap-3 border-b border-border bg-surface-raised/40 px-3">
                {assetToolbarContent ? (
                  <div className="min-w-0 flex-1 overflow-hidden">
                    {assetToolbarContent}
                  </div>
                ) : null}
                <button
                  type="button"
                  className="ml-auto p-1.5 rounded-full hover:bg-surface-app text-text-subtle hover:text-text transition-colors"
                  onClick={() => setIsAssetDrawerOpen(false)}
                  title="收起素材库"
                >
                  <PanelRightClose className="h-4 w-4" />
                </button>
              </div>
              <AssetManagerPanel
                assets={projectAssets}
                directoryTree={assetTree}
                disabled={!project}
                rootPath="assets"
                title="全部素材"
                defaultTargetFolder="assets"
                showTypeFilter
                showDirectoryTree
                toolbarSlot={handleAssetToolbarContent}
                importAccept="image/*,video/*,audio/*"
                onScanAssets={onScanAssets}
                onImportAssets={onImportAssets}
                onDeleteAssets={async (paths) => {
                  await onDeleteAssets(paths);
                }}
                onMoveAssets={onMoveAssets}
                onCopyAssets={onCopyAssets}
                onRenameAsset={onRenameAsset}
                onRenameDirectory={onRenameDirectory}
                onMoveDirectory={onMoveDirectory}
                onCopyDirectory={onCopyDirectory}
                onDeleteDirectory={onDeleteDirectory}
                onCreateFolder={onCreateFolder}
                onOpenLocalPath={onOpenLocalPath}
                onScanReferences={onScanReferences}
                onSelectAsset={(asset) => onSelectAsset?.(asset)}
                onAssetDragStart={writeAssetDragData}
              />
            </motion.aside>
          )}
        </AnimatePresence>
        {!isAssetDrawerOpen && (
          <button
            type="button"
            className="group absolute right-0 top-1/2 z-50 flex -translate-y-1/2 items-center justify-center rounded-l-2xl border-y border-l border-border bg-surface-panel p-2.5 text-text-subtle shadow-xl transition-all duration-300 hover:bg-surface-raised hover:text-brand"
            onClick={() => setIsAssetDrawerOpen(true)}
            title="展开素材库"
          >
            <ChevronLeft className="h-5 w-5 transition-transform group-hover:-translate-x-0.5" />
          </button>
        )}
      </div>
    </div>
  );
}
