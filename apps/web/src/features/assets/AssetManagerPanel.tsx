import { useEffect, useMemo, useRef, useState } from "react";
import { DndContext } from "@dnd-kit/core";
import { motion, AnimatePresence } from "framer-motion";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Activity, CheckCircle2, ChevronDown, ChevronRight, Copy, File, FileAudio, FileBox, FileImage, FileVideo, Folder, FolderOpen, LayoutGrid, List, PanelLeft, Play, RefreshCw, Upload, X } from "lucide-react";
import { assetPreviewUrl, type AssetSummary } from "../../api";
import { AssetDraggable } from "../../components/interaction/AssetDraggable";
import { AssetDropzone } from "../../components/interaction/AssetDropzone";
import { VirtualList } from "../../components/interaction/VirtualList";
import { clearAssetDragData, readAssetDragPath, writeAssetDragData } from "../../components/interaction/assetDragData";
import { Button } from "../../components/ui/Button";
import { SelectionBox, StudioBulkActionBar, StudioSearchInput } from "../../components/studio/StudioKit";
import {
  AppContextMenu,
  isEditableShortcutTarget,
  requestCommandRun,
  type AppCommandContext,
} from "../../commands";
import { copyText } from "../../lib/clipboard";
import { cn, formatBytes } from "../../lib/utils";
import { ordinaryAssetTypeLabels, ordinaryAssetTypeOrder } from "./assetGovernance";
import { buildAssetDirectoryTree, filterAssetsForDirectory, flattenDirectoryTree, getAssetDirectory, getDirectoryBreadcrumbs, type AssetDirectoryNode } from "./assetTree";

type AssetManagerPanelProps = {
  assets: AssetSummary[];
  disabled?: boolean;
  rootPath?: string;
  title?: string;
  defaultTargetFolder?: string;
  assetTypeFilter?: string;
  showTypeFilter?: boolean;
  showDirectoryTree?: boolean;
  importAccept?: string;
  onScanAssets: () => void;
  onImportAssets?: (files: File[], targetFolder: string) => Promise<void>;
  onDeleteAssets: (relativePaths: string[]) => Promise<void>;
  onMoveAssets: (relativePaths: string[], targetFolder: string) => Promise<void>;
  onCopyAssets?: (relativePaths: string[], targetFolder: string) => Promise<void>;
  onSelectAsset: (asset: AssetSummary) => void;
  onAssetDragStart?: (event: React.DragEvent, asset: AssetSummary) => void;
};

type AssetClipboard = {
  mode: "copy" | "cut";
  paths: string[];
};

type DirectoryPickerState = {
  title: string;
  actionLabel: string;
  paths: string[];
  mode: "copy" | "move";
};

const typeIcons: Record<string, React.ElementType> = {
  image: FileImage,
  video: FileVideo,
  audio: FileAudio,
  model3d: FileBox,
  other: File
};

function formatDuration(seconds?: number) {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return "-";
  const totalSeconds = Math.round(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function AudioDuration({ asset }: { asset: AssetSummary }) {
  const [duration, setDuration] = useState<number>();

  useEffect(() => {
    if (asset.assetType !== "audio") return;
    const audio = new Audio();
    audio.preload = "metadata";
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleError = () => setDuration(undefined);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("error", handleError);
    audio.src = assetPreviewUrl(asset.projectId, asset.relativePath);
    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("error", handleError);
      audio.src = "";
    };
  }, [asset.assetType, asset.projectId, asset.relativePath]);

  return (
    <span className="block text-right font-mono text-[10px] text-text-subtle">
      {formatDuration(duration)}
    </span>
  );
}

export function AssetManagerPanel({
  assets,
  disabled,
  rootPath = "assets",
  title = "资产管理",
  defaultTargetFolder = rootPath,
  assetTypeFilter,
  showTypeFilter = true,
  showDirectoryTree = true,
  importAccept,
  onScanAssets,
  onImportAssets,
  onDeleteAssets,
  onMoveAssets,
  onCopyAssets,
  onSelectAsset,
  onAssetDragStart
}: AssetManagerPanelProps) {
  const [view, setView] = useState<"grid" | "table">("grid");
  const [type, setType] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [playingAsset, setPlayingAsset] = useState<AssetSummary | null>(null);
  const [previewAsset, setPreviewAsset] = useState<AssetSummary | null>(null);
  const [activeDirectory, setActiveDirectory] = useState(rootPath);
  const [recursive, setRecursive] = useState(false);
  const [treeOpen, setTreeOpen] = useState(false);
  const [collapsedDirectories, setCollapsedDirectories] = useState<string[]>([]);
  const [assetClipboard, setAssetClipboard] = useState<AssetClipboard | null>(null);
  const [directoryPicker, setDirectoryPicker] = useState<DirectoryPickerState | null>(null);
  const importTargetDirectoryRef = useRef<string | null>(null);
  const importOpenRef = useRef<(() => void) | null>(null);

  const scopedAssets = useMemo(() => assetTypeFilter ? assets.filter((asset) => asset.assetType === assetTypeFilter) : assets, [assetTypeFilter, assets]);
  const tree = useMemo(() => buildAssetDirectoryTree(scopedAssets, rootPath), [rootPath, scopedAssets]);
  const directories = useMemo(() => flattenDirectoryTree(tree), [tree]);
  const activeNode = directories.find((directory) => directory.path === activeDirectory) ?? tree;
  const childDirectories = activeNode.children;
  const selectedSet = useMemo(() => new Set(selectedPaths), [selectedPaths]);
  const visibleDirectories = useMemo(() => {
    const collapsed = new Set(collapsedDirectories);
    return directories.filter((directory) => {
      if (directory.depth === 0) return true;
      let parentPath = directory.parentPath;
      while (parentPath) {
        if (collapsed.has(parentPath)) return false;
        const parent = directories.find((item) => item.path === parentPath);
        parentPath = parent?.parentPath ?? "";
      }
      return true;
    });
  }, [collapsedDirectories, directories]);

  const filteredAssets = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return filterAssetsForDirectory(scopedAssets, activeNode.path, recursive).filter((asset) => {
      if (type !== "all" && asset.assetType !== type) return false;
      if (!needle) return true;
      return asset.fileName.toLowerCase().includes(needle) || asset.relativePath.toLowerCase().includes(needle);
    });
  }, [activeNode.path, query, recursive, scopedAssets, type]);

  const counts = ordinaryAssetTypeOrder.reduce<Record<string, number>>((acc, next) => {
    const directoryAssets = filterAssetsForDirectory(scopedAssets, activeNode.path, true);
    acc[next] = next === "all" ? directoryAssets.length : directoryAssets.filter((asset) => asset.assetType === next).length;
    return acc;
  }, {});

  const allVisibleSelected = filteredAssets.length > 0 && filteredAssets.every((asset) => selectedSet.has(asset.relativePath));

  function selectAsset(asset: AssetSummary) {
    if (asset.assetType === "audio") {
      setPlayingAsset((current) => current?.relativePath === asset.relativePath ? null : asset);
      return;
    }
    if (asset.assetType === "image" || asset.assetType === "video") {
      setPreviewAsset(asset);
      return;
    }
    onSelectAsset(asset);
  }

  function toggleAsset(asset: AssetSummary) {
    setSelectedPaths((current) => current.includes(asset.relativePath) ? current.filter((path) => path !== asset.relativePath) : [...current, asset.relativePath]);
  }

  async function deleteSelected() {
    if (disabled || selectedPaths.length === 0) return;
    await onDeleteAssets(selectedPaths);
    setSelectedPaths([]);
  }

  function openMovePicker(paths: string[]) {
    if (disabled || paths.length === 0) return;
    setDirectoryPicker({
      title: "移动到...",
      actionLabel: "移动",
      paths,
      mode: "move",
    });
  }

  function openCopyPicker(paths: string[]) {
    if (disabled || paths.length === 0 || !onCopyAssets) return;
    setDirectoryPicker({
      title: "复制到...",
      actionLabel: "复制",
      paths,
      mode: "copy",
    });
  }

  async function confirmDirectoryPicker(targetPath: string) {
    if (!directoryPicker || disabled) return;
    if (directoryPicker.mode === "move") {
      await onMoveAssets(directoryPicker.paths, targetPath);
      setSelectedPaths([]);
    } else {
      await onCopyAssets?.(directoryPicker.paths, targetPath);
    }
    setDirectoryPicker(null);
  }

  async function pasteClipboard(targetPath = activeNode.path) {
    if (!assetClipboard || assetClipboard.paths.length === 0 || disabled) return;
    if (assetClipboard.mode === "cut") {
      await onMoveAssets(assetClipboard.paths, targetPath);
      setAssetClipboard(null);
      setSelectedPaths([]);
      return;
    }
    await onCopyAssets?.(assetClipboard.paths, targetPath);
  }

  function selectDirectory(directory: AssetDirectoryNode) {
    setActiveDirectory(directory.path);
    setSelectedPaths([]);
    setTreeOpen(false);
  }

  function selectDirectoryPath(directoryPath: string) {
    selectDirectory(directories.find((directory) => directory.path === directoryPath) ?? tree);
  }

  function toggleDirectoryCollapse(directory: AssetDirectoryNode) {
    if (directory.children.length === 0) return;
    setCollapsedDirectories((current) => current.includes(directory.path) ? current.filter((path) => path !== directory.path) : [...current, directory.path]);
  }

  function collapseAllDirectories() {
    setCollapsedDirectories(directories.filter((directory) => directory.children.length > 0).map((directory) => directory.path));
  }

  function expandAllDirectories() {
    setCollapsedDirectories([]);
  }

  const hasCollapsedDirectories = collapsedDirectories.length > 0;

  function handleDropOnDirectory(event: React.DragEvent, directoryPath: string) {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer.files.length > 0 && onImportAssets && !disabled) {
      void onImportAssets(Array.from(event.dataTransfer.files), directoryPath);
      return;
    }
    const draggedRelativePath = readAssetDragPath(event.dataTransfer);
    if (!draggedRelativePath || disabled) return;
    const pathsToMove = selectedPaths.includes(draggedRelativePath) ? selectedPaths : [draggedRelativePath];
    void onMoveAssets(pathsToMove, directoryPath).then(() => setSelectedPaths([]));
  }

  function copySelectedToClipboard(mode: AssetClipboard["mode"]) {
    if (selectedPaths.length === 0) return;
    setAssetClipboard({ mode, paths: selectedPaths });
  }

  function importFiles(files: File[]) {
    if (files.length === 0 || !onImportAssets || disabled) return;
    const directoryPath = importTargetDirectoryRef.current ?? activeNode.path;
    importTargetDirectoryRef.current = null;
    void onImportAssets(files, directoryPath);
  }

  function openImportDialog(open: () => void, directoryPath?: string) {
    importTargetDirectoryRef.current = directoryPath ?? activeNode.path;
    open();
  }

  async function copyPath(relativePath: string) {
    await copyText(relativePath, { successMessage: "资产路径已复制" });
  }

  useEffect(() => {
    const onDirectoryCommand = (event: Event) => {
      const detail = (event as CustomEvent<{ action?: string; directoryPath?: string }>).detail;
      if (!detail?.directoryPath) return;
      if (detail.action === "open") {
        selectDirectoryPath(detail.directoryPath);
        return;
      }
      if (detail.action === "importHere") {
        importTargetDirectoryRef.current = detail.directoryPath;
        importOpenRef.current?.();
      }
    };
    window.addEventListener("taptap:asset-directory-command", onDirectoryCommand);
    return () => window.removeEventListener("taptap:asset-directory-command", onDirectoryCommand);
  }, [directories, tree]);

  useEffect(() => {
    const onAssetListCommand = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          action?: string;
          paths?: string[];
        }>
      ).detail;
      if (detail?.action === "selectPaths") {
        setSelectedPaths(detail.paths ?? []);
        return;
      }
      if (detail?.action === "clearSelection") {
        setSelectedPaths([]);
        return;
      }
      if (detail?.action === "movePaths") {
        openMovePicker(detail.paths ?? []);
        return;
      }
      if (detail?.action === "copyPaths") {
        openCopyPicker(detail.paths ?? []);
      }
    };
    window.addEventListener("taptap:asset-list-command", onAssetListCommand);
    return () =>
      window.removeEventListener("taptap:asset-list-command", onAssetListCommand);
  }, [disabled, onCopyAssets]);

  useEffect(() => {
    if (!previewAsset) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewAsset(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewAsset]);

  function assetListCommandContext(): AppCommandContext {
    return {
      objectType: "assetList",
      visiblePaths: filteredAssets.map((asset) => asset.relativePath),
      selectedPaths,
      primaryPath: selectedPaths[0],
    };
  }

  function handleAssetKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (disabled || isEditableShortcutTarget(event.target)) return;
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && key === "a") {
      event.preventDefault();
      requestCommandRun("assetList.addVisibleToSelection", assetListCommandContext());
      return;
    }
    if ((event.ctrlKey || event.metaKey) && key === "a") {
      event.preventDefault();
      requestCommandRun("assetList.selectAll", assetListCommandContext());
      return;
    }
    if ((event.ctrlKey || event.metaKey) && key === "c" && selectedPaths.length > 0) {
      event.preventDefault();
      copySelectedToClipboard("copy");
      return;
    }
    if ((event.ctrlKey || event.metaKey) && key === "x" && selectedPaths.length > 0) {
      event.preventDefault();
      copySelectedToClipboard("cut");
      return;
    }
    if ((event.ctrlKey || event.metaKey) && key === "v" && assetClipboard) {
      event.preventDefault();
      void pasteClipboard();
      return;
    }
    if (event.key === "Delete" && selectedPaths.length > 0) {
      event.preventDefault();
      requestCommandRun("assetList.deleteSelected", assetListCommandContext());
      return;
    }
    if (event.key === " " && selectedPaths.length > 0) {
      event.preventDefault();
      requestCommandRun("assetList.previewPrimary", assetListCommandContext());
    }
  }

  return (
    <DndContext>
      <AssetDropzone accept={importAccept} disabled={disabled || !onImportAssets} onDropFiles={importFiles}>
        {({ getRootProps, getInputProps, isDragActive, open }) => (
    <div
      {...getRootProps({
        tabIndex: 0,
        onKeyDown: handleAssetKeyDown,
        className: cn(
          "flex min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-surface-panel shadow-sm",
          isDragActive && "border-brand/60 ring-2 ring-brand/15"
        )
      })}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden relative">
        <RefBinder bind={() => {
          importOpenRef.current = open;
        }} />
        <div className="shrink-0 border-b border-border bg-surface-panel p-2">
          <AnimatePresence mode="wait">
            {selectedPaths.length > 0 ? (
              <motion.div
                key="bulk-actions"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.15 }}
                className="flex flex-wrap items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setSelectedPaths([])} className="rounded-md p-1.5 text-text-subtle transition-colors hover:bg-surface-raised hover:text-text">
                    <X className="h-4 w-4" />
                  </button>
                  <span className="rounded-md bg-brand/10 px-2 py-1 text-xs font-bold text-brand-strong">已选 {selectedPaths.length} 项</span>
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <StudioBulkActionBar
                    selectedCount={selectedPaths.length}
                    allSelected={allVisibleSelected}
                    onSelectAll={() => setSelectedPaths(filteredAssets.map((asset) => asset.relativePath))}
                    onInvertSelection={() => {
                      const visible = new Set(filteredAssets.map((asset) => asset.relativePath));
                      setSelectedPaths((current) => [
                        ...current.filter((path) => !visible.has(path)),
                        ...filteredAssets.filter((asset) => !current.includes(asset.relativePath)).map((asset) => asset.relativePath)
                      ]);
                    }}
                    onClear={() => setSelectedPaths([])}
                    showSelectionRow={false}
                    actions={[
                      { id: "copy", label: "复制到", onClick: () => openCopyPicker(selectedPaths) },
                      { id: "cut", label: "剪切", onClick: () => copySelectedToClipboard("cut") },
                      { id: "move", label: "移动到", onClick: () => openMovePicker(selectedPaths) },
                      { id: "delete", label: "删除", tone: "danger", onClick: () => void deleteSelected() }
                    ]}
                  />
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="filters"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.15 }}
                className="@container flex flex-col gap-1 w-full pb-1"
              >
                <div className="grid w-full gap-y-1 gap-x-2 grid-cols-[1fr_auto] px-1">
                  
                  {/* Search and Toggles */}
                  <div className="col-span-2 @lg:col-span-1 @lg:col-start-2 @lg:row-start-1 flex h-9 items-center gap-1.5 w-full">
                    <StudioSearchInput value={query} onChange={setQuery} className="min-w-0 flex-1 @lg:w-[260px] @lg:flex-none" />
                    <div className="flex shrink-0 items-center gap-0.5 rounded-md border border-border-soft bg-surface-muted p-0.5">
                      <button type="button" title="网格视图" className={cn("rounded-[4px] p-1.5 transition-colors", view === "grid" ? "bg-surface-panel text-text shadow-sm" : "text-text-muted hover:text-text")} onClick={() => setView("grid")}>
                        <LayoutGrid className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" title="列表视图" className={cn("rounded-[4px] p-1.5 transition-colors", view === "table" ? "bg-surface-panel text-text shadow-sm" : "text-text-muted hover:text-text")} onClick={() => setView("table")}>
                        <List className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onScanAssets} disabled={disabled} className="h-7 w-7 rounded-md hover:bg-surface-raised" title="刷新资产">
                      <RefreshCw className="h-3.5 w-3.5 text-text-muted" />
                    </Button>
                    {onImportAssets ? (
                      <>
                        <Button variant="ghost" size="icon" disabled={disabled} className="h-7 w-7 rounded-md hover:bg-surface-raised" title="导入到当前目录" onClick={() => openImportDialog(open)}>
                          <Upload className="h-3.5 w-3.5 text-text-muted" />
                        </Button>
                        <input
                          {...getInputProps()}
                          data-asset-import-input="true"
                          className="hidden"
                        />
                      </>
                    ) : null}
                  </div>
                  
                  {/* Breadcrumb */}
                  <div className="col-start-1 row-start-2 @lg:row-start-1 flex h-7 items-center min-w-0 overflow-hidden pr-2">
                    {activeNode.parentPath ? (
                      <button
                        type="button"
                        className="mr-1 shrink-0 rounded px-1.5 py-1 text-[11px] font-bold text-text-muted hover:bg-surface-raised hover:text-brand"
                        onClick={() => selectDirectoryPath(activeNode.parentPath)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => handleDropOnDirectory(event, activeNode.parentPath)}
                        title={`返回 ${activeNode.parentPath}`}
                      >
                        上一级
                      </button>
                    ) : null}
                    <Breadcrumb
                      path={activeNode.path}
                      onSelectPath={(path) => selectDirectory(directories.find((directory) => directory.path === path) ?? tree)}
                      onDropOnPath={(event, path) => handleDropOnDirectory(event, path)}
                    />
                  </div>

                  {/* Meta */}
                  <div className="col-start-2 row-start-2 flex h-7 items-center gap-2.5 justify-end text-[10px] text-text-subtle">
                    {showDirectoryTree ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setTreeOpen(true)}
                        className="h-7 shrink-0 gap-1.5 rounded-md px-2 text-[11px] font-semibold"
                      >
                        <PanelLeft className="h-3.5 w-3.5" />
                        目录
                        <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[9px] font-bold text-text-subtle">{tree.totalAssetCount}</span>
                      </Button>
                    ) : null}
                    <label className="flex shrink-0 cursor-pointer items-center gap-1 text-[11px] font-semibold text-text-subtle hover:text-text" title="包含子目录">
                      <input type="checkbox" checked={recursive} onChange={(event) => setRecursive(event.target.checked)} className="h-3.5 w-3.5 cursor-pointer rounded border-border bg-surface-app text-brand focus:ring-brand/30" />
                      <span className="hidden xl:inline">包含</span>子目录
                    </label>
                    {assetClipboard ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 shrink-0 px-2 text-[11px] font-semibold"
                        onClick={() => void pasteClipboard()}
                        disabled={disabled || (assetClipboard.mode === "copy" && !onCopyAssets)}
                        title={`${assetClipboard.mode === "cut" ? "剪切" : "复制"} ${assetClipboard.paths.length} 项到当前目录`}
                      >
                        粘贴 {assetClipboard.paths.length}
                      </Button>
                    ) : null}
                    {!showTypeFilter && <span className="hidden lg:inline shrink-0 text-[10px] font-semibold text-text-subtle opacity-70">共{counts.all}项</span>}
                  </div>

                  {/* Type Filters */}
                  {showTypeFilter ? (
                    <div className="col-span-2 row-start-3 @lg:col-span-1 @lg:col-start-1 @lg:row-start-2 flex h-7 items-center gap-1 overflow-x-auto whitespace-nowrap scrollbar-thin">
                      {ordinaryAssetTypeOrder.map((nextType) => (
                        <button
                          key={nextType}
                          type="button"
                          className={cn("flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold transition-colors", type === nextType ? "bg-brand/10 text-brand-strong" : "text-text-muted hover:bg-surface-raised hover:text-text")}
                          onClick={() => setType(nextType)}
                        >
                          <span>{ordinaryAssetTypeLabels[nextType] ?? nextType}</span>
                          <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-mono", type === nextType ? "bg-brand/20" : "bg-surface-muted text-text-subtle")}>{counts[nextType]}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {showDirectoryTree && treeOpen ? (
            <>
              <motion.button
                type="button"
                aria-label="关闭目录抽屉"
                className="absolute inset-0 z-30 bg-black/30 backdrop-blur-[1px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setTreeOpen(false)}
              />
              <motion.aside
                initial={{ x: -280, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -280, opacity: 0 }}
                transition={{ duration: 0.16 }}
                className="absolute bottom-0 left-0 top-0 z-40 flex w-[280px] max-w-[82%] flex-col border-r border-border bg-surface-panel shadow-2xl"
              >
                <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3">
                  <div className="min-w-0">
                    <span className="block truncate text-xs font-extrabold text-text">{title}</span>
                    <span className="block truncate text-[10px] text-text-subtle">{activeNode.path}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-bold text-text-subtle">{tree.totalAssetCount}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 rounded-md px-2 text-[11px]"
                      onClick={hasCollapsedDirectories ? expandAllDirectories : collapseAllDirectories}
                      title={hasCollapsedDirectories ? "展开全部目录" : "折叠全部目录"}
                    >
                      {hasCollapsedDirectories ? "展开全部" : "收起全部"}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" onClick={() => setTreeOpen(false)} title="关闭目录">
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-2 scrollbar-thin">
                  {visibleDirectories.map((directory) => (
                    <AppContextMenu key={directory.path} context={{ objectType: "assetDirectory", directoryPath: directory.path }}>
                      <DirectoryRow
                        directory={directory}
                        active={directory.path === activeNode.path}
                        collapsed={collapsedDirectories.includes(directory.path)}
                        onClick={() => selectDirectory(directory)}
                        onToggleCollapse={() => toggleDirectoryCollapse(directory)}
                        onDrop={(event) => handleDropOnDirectory(event, directory.path)}
                      />
                    </AppContextMenu>
                  ))}
                </div>
              </motion.aside>
            </>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {directoryPicker ? (
            <motion.div
              className="absolute inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDirectoryPicker(null)}
            >
              <motion.div
                className="flex max-h-[78vh] w-[420px] max-w-full flex-col overflow-hidden rounded-lg border border-border bg-surface-panel shadow-2xl"
                initial={{ scale: 0.98, y: 8 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.98, y: 8 }}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-3 py-3">
                  <div className="min-w-0">
                    <h3 className="m-0 text-sm font-extrabold text-text">{directoryPicker.title}</h3>
                    <p className="m-0 mt-1 truncate text-[11px] text-text-subtle">
                      {directoryPicker.paths.length} 个资产
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" onClick={() => setDirectoryPicker(null)} title="关闭">
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-2 scrollbar-thin">
                  {directories.map((directory) => (
                    <DirectoryRow
                      key={directory.path}
                      directory={directory}
                      active={directory.path === activeNode.path}
                      collapsed={false}
                      onClick={() => void confirmDirectoryPicker(directory.path)}
                      onToggleCollapse={() => undefined}
                      onDrop={(event) => handleDropOnDirectory(event, directory.path)}
                    />
                  ))}
                </div>
                <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-3 py-2">
                  <span className="min-w-0 truncate text-[10px] text-text-subtle">当前目录：{activeNode.path}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setDirectoryPicker(null)}>
                      取消
                    </Button>
                    <Button size="sm" className="h-8 text-xs" onClick={() => void confirmDirectoryPicker(activeNode.path)}>
                      {directoryPicker.actionLabel}到当前目录
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AppContextMenu context={assetListCommandContext()}>
          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
            {view === "grid" ? (
              <AssetGrid
                assets={filteredAssets}
                directories={childDirectories}
                selectedSet={selectedSet}
                onSelectDirectory={selectDirectory}
                onDropOnDirectory={handleDropOnDirectory}
                onToggleAsset={toggleAsset}
                onSelectAsset={selectAsset}
                onCopyPath={copyPath}
                onAssetDragStart={onAssetDragStart}
                onPlayAudio={setPlayingAsset}
                onPreviewAsset={setPreviewAsset}
                playingAssetPath={playingAsset?.relativePath}
              />
            ) : (
              <AssetTable
                assets={filteredAssets}
                directories={childDirectories}
                selectedSet={selectedSet}
                onSelectDirectory={selectDirectory}
                onDropOnDirectory={handleDropOnDirectory}
                onToggleAsset={toggleAsset}
                onSelectAsset={selectAsset}
                onCopyPath={copyPath}
                onAssetDragStart={onAssetDragStart}
                onPlayAudio={setPlayingAsset}
                onPreviewAsset={setPreviewAsset}
                playingAssetPath={playingAsset?.relativePath}
              />
            )}
          </div>
        </AppContextMenu>

        <AnimatePresence>
          {previewAsset && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
              onClick={() => setPreviewAsset(null)}
            >
              <button
                type="button"
                className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white/75 backdrop-blur-sm transition-colors hover:bg-black/70 hover:text-white"
                onClick={(event) => {
                  event.stopPropagation();
                  setPreviewAsset(null);
                }}
                title="关闭预览"
              >
                <X className="h-5 w-5" />
              </button>
              {previewAsset.assetType === "image" ? (
                <img
                  draggable={false}
                  src={assetPreviewUrl(previewAsset.projectId, previewAsset.relativePath)}
                  alt={previewAsset.fileName}
                  className="max-h-[96vh] max-w-[96vw] object-contain shadow-2xl"
                  onClick={(event) => event.stopPropagation()}
                />
              ) : (
                <video
                  src={assetPreviewUrl(previewAsset.projectId, previewAsset.relativePath)}
                  controls
                  autoPlay
                  className="max-h-[96vh] max-w-[96vw] bg-black object-contain shadow-2xl"
                  onClick={(event) => event.stopPropagation()}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {playingAsset && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="sticky bottom-0 left-0 right-0 z-20 flex shrink-0 flex-col gap-2 border-t border-border-soft bg-surface-panel/95 px-3 py-2 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] backdrop-blur-md"
            >
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand/10">
                  <FileAudio className="h-4 w-4 text-brand" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-semibold text-text">{playingAsset.fileName}</span>
                  <span className="block truncate text-[9px] text-text-subtle">{getAssetDirectory(playingAsset.relativePath) || "/"}</span>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 rounded-full hover:bg-surface-raised" onClick={() => setPlayingAsset(null)} title="关闭播放器">
                  <X className="h-4 w-4 text-text-muted" />
                </Button>
              </div>
              <audio controls autoPlay src={assetPreviewUrl(playingAsset.projectId, playingAsset.relativePath)} className="h-9 w-full min-w-0 opacity-90" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
        )}
      </AssetDropzone>
    </DndContext>
  );
}

function RefBinder({ bind }: { bind: () => void }) {
  useEffect(bind, [bind]);
  return null;
}

function DirectoryRow({
  directory,
  active,
  collapsed,
  onClick,
  onToggleCollapse,
  onDrop
}: {
  directory: AssetDirectoryNode;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
  onToggleCollapse: () => void;
  onDrop: (event: React.DragEvent) => void;
}) {
  const hasChildren = directory.children.length > 0;
  return (
    <button
      type="button"
      title={directory.path}
      onClick={onClick}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
      className={cn("flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-left text-xs transition-colors", active ? "bg-brand/10 text-brand-strong" : "text-text-muted hover:bg-surface-raised hover:text-text")}
      style={{ paddingLeft: `${8 + directory.depth * 14}px` }}
    >
      <span
        role="button"
        tabIndex={0}
        className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] text-text-subtle", hasChildren ? "hover:bg-surface-muted hover:text-text" : "opacity-30")}
        onClick={(event) => {
          event.stopPropagation();
          onToggleCollapse();
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          event.stopPropagation();
          onToggleCollapse();
        }}
        title={hasChildren ? (collapsed ? "展开目录" : "折叠目录") : undefined}
      >
        {hasChildren ? (collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />) : null}
      </span>
      <FolderOpen className={cn("h-3.5 w-3.5 shrink-0", active ? "text-brand" : "text-text-subtle")} />
      <span className="min-w-0 flex-1 truncate font-semibold">{directory.depth === 0 ? directory.name : directory.name}</span>
      <span className="rounded-pill bg-surface-panel px-1.5 py-0.5 text-[10px] font-bold text-text-subtle">{directory.totalAssetCount}</span>
    </button>
  );
}

function Breadcrumb({
  path,
  onSelectPath,
  onDropOnPath
}: {
  path: string;
  onSelectPath: (path: string) => void;
  onDropOnPath: (event: React.DragEvent, path: string) => void;
}) {
  const breadcrumbs = getDirectoryBreadcrumbs(path);
  return (
    <div className="flex min-w-0 items-center gap-1 text-xs font-bold text-text-muted">
      {breadcrumbs.map((crumb, index) => (
        <span key={crumb.path} className="flex min-w-0 items-center gap-1">
          {index > 0 ? <ChevronRight className="h-3 w-3 shrink-0 text-text-subtle" /> : null}
          <button
            type="button"
            className={cn("max-w-[120px] truncate rounded px-1.5 py-1 hover:bg-surface-raised hover:text-brand", index === breadcrumbs.length - 1 && "text-text")}
            onClick={() => onSelectPath(crumb.path)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => onDropOnPath(event, crumb.path)}
            title={crumb.path}
          >
            {crumb.name}
          </button>
        </span>
      ))}
    </div>
  );
}

function AssetGrid({
  assets,
  directories,
  selectedSet,
  onSelectDirectory,
  onDropOnDirectory,
  onToggleAsset,
  onSelectAsset,
  onCopyPath,
  onAssetDragStart,
  onPlayAudio,
  onPreviewAsset,
  playingAssetPath
}: {
  assets: AssetSummary[];
  directories: AssetDirectoryNode[];
  selectedSet: Set<string>;
  onSelectDirectory: (directory: AssetDirectoryNode) => void;
  onDropOnDirectory: (event: React.DragEvent, directoryPath: string) => void;
  onToggleAsset: (asset: AssetSummary) => void;
  onSelectAsset: (asset: AssetSummary) => void;
  onCopyPath: (relativePath: string) => void;
  onAssetDragStart?: (event: React.DragEvent, asset: AssetSummary) => void;
  onPlayAudio?: (asset: AssetSummary | null) => void;
  onPreviewAsset?: (asset: AssetSummary) => void;
  playingAssetPath?: string;
}) {
  if (assets.length === 0 && directories.length === 0) return <EmptyState />;

  return (
    <div className="grid content-start gap-3 p-4 [grid-template-columns:repeat(auto-fill,minmax(112px,1fr))]">
      {directories.map((directory) => (
        <AppContextMenu key={directory.path} context={{ objectType: "assetDirectory", directoryPath: directory.path }}>
          <button
            type="button"
            title={directory.path}
            onClick={() => onSelectDirectory(directory)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => onDropOnDirectory(event, directory.path)}
            className="group flex cursor-pointer flex-col overflow-hidden rounded-xl border border-border-soft bg-surface-app text-left transition-all hover:border-brand/40 hover:bg-surface-raised hover:shadow-md"
          >
            <div className="flex aspect-square w-full items-center justify-center border-b border-border-soft bg-surface-muted">
              <Folder className="h-10 w-10 text-text-subtle transition-colors group-hover:text-brand" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 bg-surface-panel p-2 transition-colors group-hover:bg-surface-raised">
              <span className="truncate text-[11px] font-semibold leading-tight text-text" title={directory.name}>{directory.name}</span>
              <span className="truncate text-[9px] text-text-subtle">{directory.totalAssetCount} 项</span>
            </div>
          </button>
        </AppContextMenu>
      ))}
      {assets.map((asset) => {
        const isSelected = selectedSet.has(asset.relativePath);
        const Icon = typeIcons[asset.assetType] || File;
        const isAudio = asset.assetType === "audio";
        const isPlaying = playingAssetPath === asset.relativePath;
        return (
          <AppContextMenu key={asset.id} context={{ objectType: "asset", relativePath: asset.relativePath }}>
            <AssetDraggable asset={asset} onDragStart={onAssetDragStart}>
              {({ ref, draggableProps, isDragging }) => (
            <div
              ref={ref}
              {...draggableProps}
              className={cn(
                "group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border transition-all hover:shadow-md hover:ring-1 hover:ring-brand/30",
                isDragging && "opacity-70",
                isPlaying ? "border-brand bg-brand/5 ring-1 ring-brand shadow-[0_0_15px_rgba(0,0,0,0.1)]" : isSelected ? "border-brand ring-1 ring-brand bg-surface-app" : "border-border-soft bg-surface-app"
              )}
            >
              <label className={cn("absolute left-1.5 top-1.5 z-10 flex h-5 w-5 cursor-pointer items-center justify-center rounded border bg-surface-panel/90 shadow-sm backdrop-blur-sm transition-opacity", isSelected ? "border-brand opacity-100" : "border-border opacity-0 hover:border-brand group-hover:opacity-100")}>
                {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-brand" />}
                <input type="checkbox" className="sr-only" checked={isSelected} onChange={(e) => { e.stopPropagation(); onToggleAsset(asset); }} />
              </label>
              <div
                role="button"
                tabIndex={0}
                className="flex h-full w-full flex-col text-left"
                onClick={() => {
                  onSelectAsset(asset);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectAsset(asset);
                  }
                }}
              >
              <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden border-b border-border-soft bg-surface-muted">
                {asset.assetType === "image" ? (
                  <AssetImageThumb asset={asset} />
                ) : asset.assetType === "video" ? (
                  <div className="group/video relative h-full w-full bg-black/10">
                    <video
                      src={assetPreviewUrl(asset.projectId, asset.relativePath)}
                      className="h-full w-full object-cover"
                      muted
                      playsInline
                      preload="metadata"
                    />
                    <button
                      type="button"
                      className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover/video:opacity-100"
                      onClick={(event) => {
                        event.stopPropagation();
                        onPreviewAsset?.(asset);
                      }}
                      title="播放视频"
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur-sm">
                        <Play className="ml-0.5 h-4 w-4 fill-current" />
                      </span>
                    </button>
                  </div>
                ) : isAudio ? (
                  <div className={cn("group/preview relative flex h-full w-full flex-col items-center justify-center gap-1.5 transition-all", isPlaying ? "bg-brand/10" : "bg-gradient-to-br from-surface-raised to-surface-muted group-hover:to-surface-panel")}>
                    <FileAudio className={cn("h-8 w-8 transition-all", isPlaying ? "text-brand opacity-100" : "text-text-muted opacity-40 group-hover/preview:text-brand group-hover/preview:opacity-80")} />
                    <span className={cn("text-[9px] font-bold uppercase tracking-widest transition-opacity", isPlaying ? "text-brand opacity-100" : "text-text-subtle opacity-40 group-hover/preview:opacity-100")}>{asset.extension.replace(".", "") || "audio"}</span>
                    <div className={cn("absolute inset-0 flex items-center justify-center backdrop-blur-[2px] transition-opacity", isPlaying ? "bg-brand/10 opacity-100" : "bg-black/40 opacity-0 group-hover/preview:opacity-100")}>
                      <button
                        type="button"
                        draggable={false}
                        onPointerDown={(event) => event.stopPropagation()}
                        onMouseDown={(event) => event.stopPropagation()}
                        onDragStart={(event) => event.preventDefault()}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          onPlayAudio?.(isPlaying ? null : asset);
                        }}
                        className={cn("flex h-10 w-10 items-center justify-center rounded-full text-white shadow-lg transition-all hover:scale-110 active:scale-95", isPlaying ? "bg-surface-panel ring-2 ring-brand animate-pulse" : "bg-brand")}
                        title={isPlaying ? "正在播放 (点击关闭)" : "播放音频"}
                      >
                        {isPlaying ? <Activity className="h-5 w-5 text-brand" /> : <Play className="h-4 w-4 ml-0.5 fill-current" />}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-surface-raised to-surface-muted transition-all group-hover:to-surface-panel">
                    <Icon className="h-8 w-8 text-text-muted opacity-40 transition-all group-hover:text-brand group-hover:opacity-80" />
                    <span className="text-[9px] font-bold uppercase tracking-widest text-text-subtle opacity-40 transition-opacity group-hover:opacity-100">{asset.extension.replace(".", "") || asset.assetType}</span>
                  </div>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 bg-surface-panel p-2 transition-colors group-hover:bg-surface-raised">
                <span className="truncate text-[11px] font-medium leading-tight text-text" title={asset.fileName}>{asset.fileName}</span>
                <button
                  type="button"
                  className="flex min-w-0 items-center gap-1 truncate text-left text-[9px] text-text-subtle opacity-70 hover:text-brand hover:opacity-100"
                  title={`${asset.relativePath}，点击复制`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onCopyPath(asset.relativePath);
                  }}
                >
                  <span className="min-w-0 flex-1 truncate">{getAssetDirectory(asset.relativePath) || "/"}</span>
                  <Copy className="h-2.5 w-2.5 shrink-0" />
                </button>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="text-[9px] text-text-subtle">{formatBytes(asset.sizeBytes)}</span>
                </div>
              </div>
              </div>
            </div>
              )}
            </AssetDraggable>
          </AppContextMenu>
        );
      })}
    </div>
  );
}

function AssetImageThumb({ asset, compact = false }: { asset: AssetSummary; compact?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className={cn(
        "flex h-full w-full flex-col items-center justify-center gap-1 bg-surface-raised text-center",
        compact ? "p-0.5" : "p-2"
      )}>
        <FileImage className={cn("text-text-subtle opacity-60", compact ? "h-3.5 w-3.5" : "h-6 w-6")} />
        {!compact ? (
          <span className="max-w-full truncate px-1 text-[9px] font-semibold text-text-subtle" title={asset.relativePath}>预览失败</span>
        ) : null}
      </div>
    );
  }
  return (
    <img
      draggable={false}
      src={assetPreviewUrl(asset.projectId, asset.relativePath)}
      alt={asset.fileName}
      className={cn(
        "pointer-events-none object-contain",
        compact ? "max-h-[82%] max-w-[82%]" : "max-h-[84%] max-w-[84%] transition-transform duration-300 group-hover:scale-105"
      )}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function AssetTable({
  assets,
  directories,
  selectedSet,
  onSelectDirectory,
  onDropOnDirectory,
  onToggleAsset,
  onSelectAsset,
  onCopyPath,
  onAssetDragStart,
  onPlayAudio,
  onPreviewAsset,
  playingAssetPath
}: {
  assets: AssetSummary[];
  directories: AssetDirectoryNode[];
  selectedSet: Set<string>;
  onSelectDirectory: (directory: AssetDirectoryNode) => void;
  onDropOnDirectory: (event: React.DragEvent, directoryPath: string) => void;
  onToggleAsset: (asset: AssetSummary) => void;
  onSelectAsset: (asset: AssetSummary) => void;
  onCopyPath: (relativePath: string) => void;
  onAssetDragStart?: (event: React.DragEvent, asset: AssetSummary) => void;
  onPlayAudio?: (asset: AssetSummary | null) => void;
  onPreviewAsset?: (asset: AssetSummary) => void;
  playingAssetPath?: string;
}) {
  const columnHelper = createColumnHelper<AssetSummary>();

  const columns = useMemo(() => [
    columnHelper.display({
      id: "select",
      header: "",
      cell: ({ row }) => {
        const asset = row.original;
        const isSelected = selectedSet.has(asset.relativePath);
        return (
          <div className="flex items-center justify-center h-full pt-1">
             <SelectionBox selected={isSelected} onClick={(e) => { e.stopPropagation(); onToggleAsset(asset); }} />
          </div>
        );
      }
    }),
    columnHelper.accessor("fileName", {
      header: "文件与路径",
      cell: ({ row, getValue }) => {
        const asset = row.original;
        const Icon = typeIcons[asset.assetType] || File;
        const isSelected = selectedSet.has(asset.relativePath);
        const isImage = asset.assetType === "image";
        const isVideo = asset.assetType === "video";
        const isAudio = asset.assetType === "audio";
        const isPlaying = playingAssetPath === asset.relativePath;
        return (
          <div className="flex min-w-0 w-full items-start gap-2.5 text-left py-1">
            {isImage ? (
              <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] bg-surface-muted ring-1 mt-0.5", isSelected ? "ring-brand" : "ring-border-soft")}>
                <AssetImageThumb asset={asset} compact />
              </span>
            ) : isVideo ? (
              <button type="button" onClick={(e) => { e.stopPropagation(); onPreviewAsset?.(asset); }} className={cn("group/play flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] ring-1 mt-0.5 transition-all hover:bg-brand hover:ring-brand", isSelected ? "ring-border-soft bg-brand/10" : "ring-border-soft bg-surface-raised")} title="播放视频">
                <Icon className="h-4 w-4 text-text-muted group-hover/play:hidden" />
                <Play className="h-3.5 w-3.5 text-white hidden group-hover/play:block fill-current" />
              </button>
            ) : isAudio ? (
              <button type="button" onClick={(e) => { e.stopPropagation(); isPlaying ? onPlayAudio?.(null) : onPlayAudio?.(asset); }} className={cn("group/play flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] ring-1 mt-0.5 transition-all hover:bg-brand hover:ring-brand", isPlaying ? "ring-brand bg-brand/20 animate-pulse" : isSelected ? "ring-border-soft bg-brand/10" : "ring-border-soft bg-surface-raised")} title={isPlaying ? "正在播放" : "播放音频"}>
                {isPlaying ? <Activity className="h-4 w-4 text-brand" /> : (
                  <>
                    <Icon className="h-4 w-4 text-text-muted group-hover/play:hidden" />
                    <Play className="h-3.5 w-3.5 text-white hidden group-hover/play:block fill-current" />
                  </>
                )}
              </button>
            ) : (
              <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] ring-1 ring-border-soft mt-0.5", isSelected ? "bg-brand/10" : "bg-surface-raised")}>
                <Icon className={cn("h-4 w-4", isSelected ? "text-brand" : "text-text-muted")} />
              </div>
            )}
            <div className="flex min-w-0 flex-1 flex-col justify-center">
              <span className={cn("truncate text-[12px] leading-tight transition-colors", isPlaying ? "font-bold text-brand" : isSelected ? "font-semibold text-brand-strong" : "font-medium text-text")}>{getValue()}</span>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="truncate text-[9px] text-text-subtle opacity-70" title={asset.relativePath}>{getAssetDirectory(asset.relativePath) || "/"}</span>
                <button type="button" title="复制路径" onClick={(event) => { event.stopPropagation(); onCopyPath(asset.relativePath); }} className="opacity-0 transition-opacity group-hover:opacity-100 flex items-center justify-center">
                  <Copy className="h-2.5 w-2.5 shrink-0 text-text-subtle hover:text-brand" />
                </button>
              </div>
            </div>
          </div>
        );
      }
    }),
    columnHelper.accessor("assetType", {
      header: "类型",
      cell: ({ row, getValue }) => <span className="block text-center text-[10px] font-mono uppercase font-bold text-text-subtle">{row.original.extension.replace(".", "") || getValue()}</span>
    }),
    columnHelper.display({
      id: "duration",
      header: "时长",
      cell: ({ row }) => <AudioDuration asset={row.original} />
    }),
    columnHelper.accessor("sizeBytes", {
      header: "大小",
      cell: ({ getValue }) => <span className="block text-right font-mono text-[10px] text-text-subtle">{formatBytes(getValue())}</span>
    })
  ], [columnHelper, onAssetDragStart, onCopyPath, onPlayAudio, onPreviewAsset, onSelectAsset, onToggleAsset, playingAssetPath, selectedSet]);
  const table = useReactTable({ data: assets, columns, getCoreRowModel: getCoreRowModel() });
  if (assets.length === 0 && directories.length === 0) return <EmptyState />;

  return (
    <div className="flex w-full flex-col bg-surface-panel text-left overflow-x-auto scrollbar-thin">
      <div className="sticky top-0 z-10 flex h-9 min-w-[400px] items-center border-b border-border bg-surface-panel/90 px-4 text-[10px] font-bold uppercase tracking-widest text-text-subtle backdrop-blur-md">
        {table.getHeaderGroups()[0]?.headers.map((header) => (
          <div key={header.id} className={tableColumnClass(header.id)}>
            {flexRender(header.column.columnDef.header, header.getContext())}
          </div>
        ))}
      </div>
      <div className="flex min-w-[400px] flex-col">
        {directories.map((directory) => (
          <AppContextMenu key={directory.path} context={{ objectType: "assetDirectory", directoryPath: directory.path }}>
            <button
              type="button"
              title={directory.path}
              onClick={() => onSelectDirectory(directory)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => onDropOnDirectory(event, directory.path)}
              className="group flex min-h-[48px] items-center border-b border-border-soft bg-transparent px-4 py-2 text-left transition-colors hover:bg-surface-raised"
            >
              <div className="w-8 shrink-0" />
              <div className="flex min-w-[140px] flex-1 items-center gap-2.5 pr-4">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] bg-surface-raised ring-1 ring-border-soft">
                  <Folder className="h-4 w-4 text-text-subtle transition-colors group-hover:text-brand" />
                </div>
                <div className="min-w-0">
                  <span className="block truncate text-[12px] font-semibold text-text">{directory.name}</span>
                  <span className="block truncate text-[9px] text-text-subtle">{directory.path}</span>
                </div>
              </div>
              <div className="w-16 shrink-0 px-3">
                <span className="text-[10px] font-mono font-bold uppercase text-text-subtle">folder</span>
              </div>
              <div className="w-16 shrink-0 px-3 text-right">
                <span className="font-mono text-[10px] text-text-subtle">-</span>
              </div>
              <div className="w-20 shrink-0 px-3 text-right">
                <span className="font-mono text-[10px] text-text-subtle">{directory.totalAssetCount} 项</span>
              </div>
            </button>
          </AppContextMenu>
        ))}
        <VirtualList
          items={table.getRowModel().rows}
          estimateSize={48}
          getKey={(row) => row.original.id}
          renderItem={(row) => {
          const asset = row.original;
          const isSelected = selectedSet.has(asset.relativePath);
          const isPlaying = playingAssetPath === asset.relativePath;
          return (
            <AppContextMenu key={asset.id} context={{ objectType: "asset", relativePath: asset.relativePath }}>
              <div
                draggable
                onDragStart={(event) => {
                  writeAssetDragData(event, asset);
                  onAssetDragStart?.(event, asset);
                }}
                onDragEnd={clearAssetDragData}
                className={cn(
                  "group flex min-h-[48px] py-2 items-center border-b px-4 text-left transition-colors hover:bg-surface-raised cursor-pointer",
                  isPlaying ? "bg-brand/5 border-brand/30" : isSelected ? "border-brand/20 bg-brand/5 hover:bg-brand/10" : "border-border-soft bg-transparent"
                )}
                onClick={() => onSelectAsset(asset)}
              >
                {row.getVisibleCells().map((cell) => (
                  <div
                    key={cell.id}
                    className={tableColumnClass(cell.column.id)}
                    onClick={(event) => {
                      if (cell.column.id === "select") event.stopPropagation();
                    }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </div>
                ))}
              </div>
            </AppContextMenu>
          );
        }}
        />
      </div>
    </div>
  );
}

function tableColumnClass(columnId: string) {
  return cn(
    columnId === "select"
      ? "w-8 shrink-0"
      : columnId === "assetType"
        ? "w-16 shrink-0 px-3 text-center"
        : columnId === "duration"
          ? "w-16 shrink-0 px-3 text-right"
          : columnId === "sizeBytes"
            ? "w-20 shrink-0 px-3 text-right"
            : "min-w-[140px] flex-1 pr-4",
  );
}

function EmptyState() {
  return (
    <div className="flex h-full min-h-[360px] flex-col items-center justify-center gap-4 p-12 text-text-muted">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border-soft bg-surface-muted/50 shadow-sm">
        <FolderOpen className="h-8 w-8 text-text opacity-40" />
      </div>
      <div className="text-center">
        <p className="m-0 text-sm font-semibold text-text">当前目录为空</p>
        <p className="m-0 mt-1.5 text-xs text-text-subtle">没有找到匹配资产。</p>
      </div>
    </div>
  );
}
