import { useEffect, useMemo, useRef, useState } from "react";
import { DndContext } from "@dnd-kit/core";
import { motion, AnimatePresence } from "framer-motion";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Activity, CheckCircle2, ChevronDown, ChevronRight, Copy, File as FileIcon, FileAudio, FileBox, FileImage, FileVideo, Folder, FolderOpen, LayoutGrid, List, PanelLeft, Play, RefreshCw, Upload, X } from "lucide-react";
import { assetPreviewUrl, type AssetSummary } from "../../api";
import { AssetDraggable } from "../../components/interaction/AssetDraggable";
import { AssetDropzone } from "../../components/interaction/AssetDropzone";
import { VirtualGrid } from "../../components/interaction/VirtualGrid";
import { VirtualList } from "../../components/interaction/VirtualList";
import {
  clearAssetDirectoryDragData,
  clearAssetDragData,
  readAssetDirectoryDragData,
  readAssetDragPath,
  writeAssetDirectoryDragData,
  writeAssetDragData
} from "../../components/interaction/assetDragData";
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
  directoryTree?: AssetDirectoryNode;
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
  onCreateFolder?: (parentFolder: string) => Promise<void>;
  onDeleteAssets: (relativePaths: string[]) => Promise<void>;
  onMoveAssets: (relativePaths: string[], targetFolder: string) => Promise<void>;
  onCopyAssets?: (relativePaths: string[], targetFolder: string) => Promise<void>;
  onRenameAsset?: (relativePath: string, newName: string) => Promise<void>;
  onRenameDirectory?: (directoryPath: string, newName: string) => Promise<void>;
  onMoveDirectory?: (directoryPath: string, targetFolder: string) => Promise<void>;
  onCopyDirectory?: (directoryPath: string, targetFolder: string) => Promise<void>;
  onDeleteDirectory?: (directoryPath: string) => Promise<void>;
  onOpenLocalPath?: (relativePath: string, mode: "file" | "directory") => Promise<void>;
  onScanReferences?: (relativePaths: string[]) => Promise<void>;
  onSelectAsset: (asset: AssetSummary) => void;
  onAssetDragStart?: (event: React.DragEvent, asset: AssetSummary) => void;
};

type ExplorerSelectionItem =
  | { type: "asset"; path: string }
  | { type: "directory"; path: string };

type AssetClipboard = {
  mode: "copy" | "cut";
  items: ExplorerSelectionItem[];
};

type DirectoryPickerState = {
  title: string;
  actionLabel: string;
  item: ExplorerSelectionItem;
  mode: "copyAsset" | "moveAsset" | "copyDirectory" | "moveDirectory";
};

type ImportFile = File & {
  localPath?: string;
};

type RenameTarget =
  | { type: "asset"; path: string; value: string }
  | { type: "directory"; path: string; value: string };

type ExplorerSelection = {
  assetPaths: string[];
  directoryPaths: string[];
};

const typeIcons: Record<string, React.ElementType> = {
  image: FileImage,
  video: FileVideo,
  audio: FileAudio,
  model3d: FileBox,
  other: FileIcon
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

async function pickFilesFromNativeOpenDialog() {
  const tauriPaths = await pickTauriImportPaths("files");
  return tauriPathsToFiles(tauriPaths);
}

async function pickFilesFromNativeDirectory() {
  const tauriPaths = await pickTauriImportPaths("folder");
  return tauriPathsToFiles(tauriPaths);
}

async function pickTauriImportPaths(mode: "files" | "folder") {
  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open(
      mode === "folder"
        ? { directory: true, title: "选择要导入的文件夹" }
        : { multiple: true, title: "选择要导入的文件" },
    );
    if (!selected) return [];
    return Array.isArray(selected) ? selected : [selected];
  } catch {
    return [];
  }
}

function tauriPathsToFiles(paths: string[]): ImportFile[] {
  return paths.map((localPath) => {
    const name = localPath.split(/[\\/]/).filter(Boolean).at(-1) ?? localPath;
    const file = new File([], name) as ImportFile;
    file.localPath = localPath;
    return file;
  });
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, value]);
  return debounced;
}

let assetManagerPanelIdSeed = 0;

export function AssetManagerPanel({
  assets,
  directoryTree,
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
  onCreateFolder,
  onDeleteAssets,
  onMoveAssets,
  onCopyAssets,
  onRenameAsset,
  onRenameDirectory,
  onMoveDirectory,
  onCopyDirectory,
  onDeleteDirectory,
  onOpenLocalPath,
  onScanReferences,
  onSelectAsset,
  onAssetDragStart
}: AssetManagerPanelProps) {
  const panelIdRef = useRef(`asset-manager-panel-${++assetManagerPanelIdSeed}`);
  const panelId = panelIdRef.current;
  const [view, setView] = useState<"grid" | "table">("grid");
  const [type, setType] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [selectedDirectoryPaths, setSelectedDirectoryPaths] = useState<string[]>([]);
  const [playingAsset, setPlayingAsset] = useState<AssetSummary | null>(null);
  const [previewAsset, setPreviewAsset] = useState<AssetSummary | null>(null);
  const [activeDirectory, setActiveDirectory] = useState(rootPath);
  const [recursive, setRecursive] = useState(false);
  const [treeOpen, setTreeOpen] = useState(false);
  const [collapsedDirectories, setCollapsedDirectories] = useState<string[]>([]);
  const [assetClipboard, setAssetClipboard] = useState<AssetClipboard | null>(null);
  const [directoryPicker, setDirectoryPicker] = useState<DirectoryPickerState | null>(null);
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null);
  const importTargetDirectoryRef = useRef<string | null>(null);
  const debouncedQuery = useDebouncedValue(query, 180);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1000);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const isNarrow = containerWidth < 600;

  const scopedAssets = useMemo(() => assetTypeFilter ? assets.filter((asset) => asset.assetType === assetTypeFilter) : assets, [assetTypeFilter, assets]);
  const tree = useMemo(() => directoryTree ?? buildAssetDirectoryTree(scopedAssets, rootPath), [directoryTree, rootPath, scopedAssets]);
  const directories = useMemo(() => flattenDirectoryTree(tree), [tree]);
  const activeNode = directories.find((directory) => directory.path === activeDirectory) ?? tree;
  const childDirectories = activeNode.children;
  const selectedSet = useMemo(() => new Set(selectedPaths), [selectedPaths]);
  const selectedDirectorySet = useMemo(() => new Set(selectedDirectoryPaths), [selectedDirectoryPaths]);
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
    const needle = debouncedQuery.trim().toLowerCase();
    return filterAssetsForDirectory(scopedAssets, activeNode.path, recursive).filter((asset) => {
      if (type !== "all" && asset.assetType !== type) return false;
      if (!needle) return true;
      return asset.fileName.toLowerCase().includes(needle) || asset.relativePath.toLowerCase().includes(needle);
    });
  }, [activeNode.path, debouncedQuery, recursive, scopedAssets, type]);
  const directoryAssets = useMemo(
    () => filterAssetsForDirectory(scopedAssets, activeNode.path, true),
    [activeNode.path, scopedAssets]
  );

  const counts = ordinaryAssetTypeOrder.reduce<Record<string, number>>((acc, next) => {
    acc[next] = next === "all" ? directoryAssets.length : directoryAssets.filter((asset) => asset.assetType === next).length;
    return acc;
  }, {});

  const allVisibleSelected =
    filteredAssets.length + childDirectories.length > 0 &&
    filteredAssets.every((asset) => selectedSet.has(asset.relativePath)) &&
    childDirectories.every((directory) => selectedDirectorySet.has(directory.path));
  const selectedDirectory = useMemo(() => {
    const [directoryPath] = selectedDirectoryPaths;
    return directoryPath ? directories.find((directory) => directory.path === directoryPath) : undefined;
  }, [directories, selectedDirectoryPaths]);
  const selectedItems = useMemo<ExplorerSelectionItem[]>(() => {
    return [
      ...selectedDirectoryPaths.map((path) => ({ type: "directory" as const, path })),
      ...selectedPaths.map((path) => ({ type: "asset" as const, path }))
    ];
  }, [selectedDirectoryPaths, selectedPaths]);
  const canPasteClipboard = !!assetClipboard && assetClipboard.items.length > 0 && (
    assetClipboard.items.some((item) => item.type === "asset") ? !!onCopyAssets || assetClipboard.mode === "cut" : true
  ) && (
    assetClipboard.items.some((item) => item.type === "directory") ? assetClipboard.mode === "cut" ? !!onMoveDirectory : !!onCopyDirectory : true
  );

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

  function selectAssetEntry(asset: AssetSummary) {
    setSelectedPaths([asset.relativePath]);
    setSelectedDirectoryPaths([]);
  }

  function replaceSelection(next: ExplorerSelection) {
    setSelectedPaths(next.assetPaths);
    setSelectedDirectoryPaths(next.directoryPaths.filter((path) => path !== rootPath));
  }

  function addToSelection(next: ExplorerSelection) {
    setSelectedPaths((current) => Array.from(new Set([...current, ...next.assetPaths])));
    setSelectedDirectoryPaths((current) => Array.from(new Set([...current, ...next.directoryPaths.filter((path) => path !== rootPath)])));
  }

  function toggleDirectoryEntry(directory: AssetDirectoryNode) {
    setSelectedDirectoryPaths((current) =>
      current.includes(directory.path)
        ? current.filter((path) => path !== directory.path)
        : [...current, directory.path]
    );
  }

  async function deleteSelected() {
    if (disabled) return;
    const directoriesToDelete = selectedDirectoryPaths.filter((path) => path !== rootPath);
    if (directoriesToDelete.length > 0 && onDeleteDirectory) {
      for (const directoryPath of directoriesToDelete) {
        await onDeleteDirectory(directoryPath);
      }
      setSelectedDirectoryPaths([]);
    }
    if (selectedPaths.length > 0) {
      await onDeleteAssets(selectedPaths);
      setSelectedPaths([]);
    }
  }

  function openDirectoryPicker(item: ExplorerSelectionItem, mode: DirectoryPickerState["mode"]) {
    if (disabled) return;
    setDirectoryPicker({
      title: mode === "copyAsset" || mode === "copyDirectory" ? "复制到..." : "移动到...",
      actionLabel: mode === "copyAsset" || mode === "copyDirectory" ? "复制" : "移动",
      item,
      mode,
    });
  }

  function openMovePicker(paths: string[]) {
    if (disabled || paths.length === 0) return;
    openDirectoryPicker({ type: "asset", path: paths[0] }, "moveAsset");
  }

  function openCopyPicker(paths: string[]) {
    if (disabled || paths.length === 0 || !onCopyAssets) return;
    openDirectoryPicker({ type: "asset", path: paths[0] }, "copyAsset");
  }

  function openMovePickerForSelection(assetPaths: string[], directoryPaths: string[]) {
    const [directoryPath] = directoryPaths.filter((path) => path !== rootPath);
    if (directoryPath) {
      openDirectoryMovePicker(directoryPath);
      return;
    }
    openMovePicker(assetPaths);
  }

  function openCopyPickerForSelection(assetPaths: string[], directoryPaths: string[]) {
    const [directoryPath] = directoryPaths.filter((path) => path !== rootPath);
    if (directoryPath) {
      openDirectoryCopyPicker(directoryPath);
      return;
    }
    openCopyPicker(assetPaths);
  }

  function openDirectoryMovePicker(directoryPath: string) {
    if (disabled || !onMoveDirectory || directoryPath === rootPath) return;
    openDirectoryPicker({ type: "directory", path: directoryPath }, "moveDirectory");
  }

  function openDirectoryCopyPicker(directoryPath: string) {
    if (disabled || !onCopyDirectory || directoryPath === rootPath) return;
    openDirectoryPicker({ type: "directory", path: directoryPath }, "copyDirectory");
  }

  function directoryPickerAssetPaths() {
    if (!directoryPicker || directoryPicker.item.type !== "asset") return [];
    return selectedPaths.includes(directoryPicker.item.path) ? selectedPaths : [directoryPicker.item.path];
  }

  function directoryPickerDirectoryPaths() {
    if (!directoryPicker || directoryPicker.item.type !== "directory") return [];
    return selectedDirectoryPaths.includes(directoryPicker.item.path)
      ? selectedDirectoryPaths.filter((path) => path !== rootPath)
      : [directoryPicker.item.path].filter((path) => path !== rootPath);
  }

  async function confirmDirectoryPicker(targetPath: string) {
    if (!directoryPicker || disabled) return;
    if (directoryPicker.mode === "moveAsset") {
      await onMoveAssets(directoryPickerAssetPaths(), targetPath);
      setSelectedPaths([]);
    } else if (directoryPicker.mode === "copyAsset") {
      await onCopyAssets?.(directoryPickerAssetPaths(), targetPath);
    } else if (directoryPicker.mode === "moveDirectory") {
      const directoryPaths = directoryPickerDirectoryPaths();
      for (const directoryPath of directoryPaths) {
        await onMoveDirectory?.(directoryPath, targetPath);
      }
      setSelectedDirectoryPaths((current) => current.filter((path) => !directoryPaths.includes(path)));
    } else {
      for (const directoryPath of directoryPickerDirectoryPaths()) {
        await onCopyDirectory?.(directoryPath, targetPath);
      }
    }
    setDirectoryPicker(null);
  }

  async function pasteClipboard(targetPath = activeNode.path) {
    if (!assetClipboard || assetClipboard.items.length === 0 || disabled) return;
    for (const item of assetClipboard.items) {
      if (item.type === "asset") {
        if (assetClipboard.mode === "cut") await onMoveAssets([item.path], targetPath);
        else await onCopyAssets?.([item.path], targetPath);
        continue;
      }
      if (assetClipboard.mode === "cut") await onMoveDirectory?.(item.path, targetPath);
      else await onCopyDirectory?.(item.path, targetPath);
    }
    if (assetClipboard.mode === "cut") {
      setAssetClipboard(null);
      setSelectedPaths([]);
      setSelectedDirectoryPaths([]);
    }
  }

  function copySelectionToClipboard(mode: AssetClipboard["mode"]) {
    if (selectedItems.length === 0) return;
    setAssetClipboard({ mode, items: selectedItems });
  }

  function selectedItemCountLabel() {
    if (!assetClipboard) return "0";
    return String(assetClipboard.items.length);
  }

  function selectDirectory(directory: AssetDirectoryNode) {
    setActiveDirectory(directory.path);
    setSelectedPaths([]);
    setSelectedDirectoryPaths([]);
    setTreeOpen(false);
  }

  function selectDirectoryEntry(directory: AssetDirectoryNode) {
    setSelectedPaths([]);
    setSelectedDirectoryPaths([directory.path]);
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
    const draggedDirectoryPath = readAssetDirectoryDragData(event.dataTransfer)?.directoryPath;
    if (draggedDirectoryPath && !disabled) {
      const directoriesToMove = (selectedDirectoryPaths.includes(draggedDirectoryPath)
        ? selectedDirectoryPaths
        : [draggedDirectoryPath]
      ).filter((path) => path !== rootPath && path !== directoryPath && !directoryPath.startsWith(`${path}/`));
      const assetsToMove = selectedDirectoryPaths.includes(draggedDirectoryPath) ? selectedPaths : [];
      void Promise.all([
        ...directoriesToMove.map((path) => onMoveDirectory?.(path, directoryPath)),
        assetsToMove.length > 0 ? onMoveAssets(assetsToMove, directoryPath) : Promise.resolve()
      ]).then(() => {
        setSelectedDirectoryPaths([]);
        setSelectedPaths([]);
      });
      return;
    }
    if (!draggedRelativePath || disabled) return;
    const pathsToMove = selectedPaths.includes(draggedRelativePath) ? selectedPaths : [draggedRelativePath];
    const directoriesToMove = selectedPaths.includes(draggedRelativePath)
      ? selectedDirectoryPaths.filter((path) => path !== rootPath && path !== directoryPath && !directoryPath.startsWith(`${path}/`))
      : [];
    void Promise.all([
      onMoveAssets(pathsToMove, directoryPath),
      ...directoriesToMove.map((path) => onMoveDirectory?.(path, directoryPath))
    ]).then(() => {
      setSelectedPaths([]);
      setSelectedDirectoryPaths([]);
    });
  }

  function copySelectedToClipboard(mode: AssetClipboard["mode"]) {
    copySelectionToClipboard(mode);
  }

  function importFiles(files: File[]) {
    if (files.length === 0 || !onImportAssets || disabled) return;
    const directoryPath = importTargetDirectoryRef.current ?? activeNode.path;
    importTargetDirectoryRef.current = null;
    void onImportAssets(files, directoryPath);
  }

  async function openNativeImportDialog(mode: "files" | "folder", directoryPath?: string) {
    if (disabled || !onImportAssets) return;
    const targetDirectory = directoryPath ?? activeNode.path;
    importTargetDirectoryRef.current = targetDirectory;
    const files =
      mode === "folder"
        ? await pickFilesFromNativeDirectory()
        : await pickFilesFromNativeOpenDialog();
    if (files.length > 0) importFiles(files);
  }

  async function copyPath(relativePath: string) {
    await copyText(relativePath, { successMessage: "资产路径已复制" });
  }

  function beginRenameAsset(asset: AssetSummary) {
    if (disabled) return;
    if (!onRenameAsset) {
      console.warn("[AssetManagerPanel] rename asset ignored: onRenameAsset is not provided", asset.relativePath);
      return;
    }
    setRenameTarget({ type: "asset", path: asset.relativePath, value: asset.fileName });
    setSelectedPaths([asset.relativePath]);
  }

  function beginRenameDirectory(directory: AssetDirectoryNode) {
    if (disabled || directory.path === rootPath) return;
    if (!onRenameDirectory) {
      console.warn("[AssetManagerPanel] rename directory ignored: onRenameDirectory is not provided", directory.path);
      return;
    }
    setRenameTarget({ type: "directory", path: directory.path, value: directory.name });
    setSelectedDirectoryPaths([directory.path]);
  }

  async function commitRename(nextName: string) {
    const target = renameTarget;
    if (!target) return;
    const trimmed = nextName.trim();
    setRenameTarget(null);
    if (!trimmed || trimmed === target.value) return;
    if (target.type === "asset") await onRenameAsset?.(target.path, trimmed);
    else await onRenameDirectory?.(target.path, trimmed);
  }

  function cancelRename() {
    setRenameTarget(null);
  }
  useEffect(() => {
    const onDirectoryCommand = (event: Event) => {
      const detail = (event as CustomEvent<{ action?: string; directoryPath?: string; panelId?: string }>).detail;
      if (!detail?.directoryPath) return;
      if (detail.panelId && detail.panelId !== panelId) return;
      console.debug("[AssetManagerPanel] asset-directory-command", detail);
      if (detail.action === "open") {
        selectDirectoryPath(detail.directoryPath);
        return;
      }
      if (detail.action === "importFilesHere") {
        openNativeImportDialog("files", detail.directoryPath);
        return;
      }
      if (detail.action === "importFolderHere") {
        openNativeImportDialog("folder", detail.directoryPath);
        return;
      }
      if (detail.action === "rename") {
        const directory = directories.find((item) => item.path === detail.directoryPath);
        if (directory) beginRenameDirectory(directory);
        return;
      }
      if (detail.action === "move") {
        openDirectoryMovePicker(detail.directoryPath);
        return;
      }
      if (detail.action === "copyFolder") {
        openDirectoryCopyPicker(detail.directoryPath);
        return;
      }
      if (detail.action === "copyDirectory") {
        if (detail.directoryPath !== rootPath) {
          setAssetClipboard({ mode: "copy", items: [{ type: "directory", path: detail.directoryPath }] });
          setSelectedPaths([]);
          setSelectedDirectoryPaths([detail.directoryPath]);
        }
        return;
      }
      if (detail.action === "cutDirectory") {
        if (detail.directoryPath !== rootPath) {
          setAssetClipboard({ mode: "cut", items: [{ type: "directory", path: detail.directoryPath }] });
          setSelectedPaths([]);
          setSelectedDirectoryPaths([detail.directoryPath]);
        }
        return;
      }
      if (detail.action === "pasteHere") {
        void pasteClipboard(detail.directoryPath);
        return;
      }
      if (detail.action === "delete") {
        if (!onDeleteDirectory) {
          console.warn("[AssetManagerPanel] delete directory ignored: onDeleteDirectory is not provided", detail.directoryPath);
          return;
        }
        void onDeleteDirectory(detail.directoryPath).then(() => setSelectedDirectoryPaths((current) => current.filter((path) => path !== detail.directoryPath)));
        return;
      }
      if (detail.action === "openInExplorer") {
        if (!onOpenLocalPath) console.warn("[AssetManagerPanel] open directory ignored: onOpenLocalPath is not provided", detail.directoryPath);
        void onOpenLocalPath?.(detail.directoryPath, "directory");
        return;
      }
      if (detail.action === "scanReferences") {
        const paths = assets
          .filter((asset) => asset.relativePath === detail.directoryPath || asset.relativePath.startsWith(`${detail.directoryPath}/`))
          .map((asset) => asset.relativePath);
        void onScanReferences?.(paths);
      }
    };
    window.addEventListener("taptap:asset-directory-command", onDirectoryCommand);
    return () => window.removeEventListener("taptap:asset-directory-command", onDirectoryCommand);
  }, [
    assetClipboard,
    assets,
    directories,
    disabled,
    onCopyDirectory,
    onDeleteDirectory,
    onMoveDirectory,
    onOpenLocalPath,
    onRenameDirectory,
    onScanReferences,
    tree,
  ]);

  useEffect(() => {
    const onAssetListCommand = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          action?: string;
          panelId?: string;
          paths?: string[];
          directoryPaths?: string[];
        }>
      ).detail;
      if (!detail?.action) return;
      if (detail.panelId && detail.panelId !== panelId) return;
      console.debug("[AssetManagerPanel] asset-list-command", detail);
      if (detail?.action === "selectPaths") {
        replaceSelection({
          assetPaths: detail.paths ?? [],
          directoryPaths: detail.directoryPaths ?? []
        });
        return;
      }
      if (detail?.action === "addPaths") {
        addToSelection({
          assetPaths: detail.paths ?? [],
          directoryPaths: detail.directoryPaths ?? []
        });
        return;
      }
      if (detail?.action === "clearSelection") {
        setSelectedPaths([]);
        setSelectedDirectoryPaths([]);
        return;
      }
      if (detail?.action === "deleteSelected") {
        void deleteSelected();
        return;
      }
      if (detail?.action === "movePaths") {
        if (!onMoveAssets && !onMoveDirectory) console.warn("[AssetManagerPanel] move ignored: move handlers are not provided", detail);
        openMovePickerForSelection(detail.paths ?? [], detail.directoryPaths ?? []);
        return;
      }
      if (detail?.action === "renamePrimary") {
        const [primaryPath] = detail.paths ?? [];
        const [primaryDirectoryPath] = detail.directoryPaths ?? [];
        if (primaryDirectoryPath) {
          const directory = directories.find((item) => item.path === primaryDirectoryPath);
          if (directory) beginRenameDirectory(directory);
          return;
        }
        const asset = primaryPath ? assets.find((item) => item.relativePath === primaryPath) : undefined;
        if (asset) beginRenameAsset(asset);
        return;
      }
      if (detail?.action === "copyPaths") {
        if (!onCopyAssets && !onCopyDirectory) console.warn("[AssetManagerPanel] copy ignored: copy handlers are not provided", detail);
        openCopyPickerForSelection(detail.paths ?? [], detail.directoryPaths ?? []);
        return;
      }
      if (detail?.action === "copySelection") {
        if (detail.paths?.length || detail.directoryPaths?.length) {
          setAssetClipboard({
            mode: "copy",
            items: [
              ...(detail.directoryPaths ?? []).filter((path) => path !== rootPath).map((path) => ({ type: "directory" as const, path })),
              ...(detail.paths ?? []).map((path) => ({ type: "asset" as const, path }))
            ]
          });
        } else {
          copySelectionToClipboard("copy");
        }
        return;
      }
      if (detail?.action === "cutSelection") {
        if (detail.paths?.length || detail.directoryPaths?.length) {
          setAssetClipboard({
            mode: "cut",
            items: [
              ...(detail.directoryPaths ?? []).filter((path) => path !== rootPath).map((path) => ({ type: "directory" as const, path })),
              ...(detail.paths ?? []).map((path) => ({ type: "asset" as const, path }))
            ]
          });
        } else {
          copySelectionToClipboard("cut");
        }
        return;
      }
      if (detail?.action === "pasteHere") {
        void pasteClipboard();
        return;
      }
      if (detail?.action === "createFolder") {
        void onCreateFolder?.(activeNode.path);
        return;
      }
      if (detail?.action === "openCurrentDirectory") {
        void onOpenLocalPath?.(activeNode.path, "directory");
        return;
      }
      if (detail?.action === "importFilesHere") {
        openNativeImportDialog("files");
        return;
      }
      if (detail?.action === "importFolderHere") {
        openNativeImportDialog("folder");
      }
    };
    window.addEventListener("taptap:asset-list-command", onAssetListCommand);
    return () =>
      window.removeEventListener("taptap:asset-list-command", onAssetListCommand);
  }, [
    activeNode.path,
    assetClipboard,
    assets,
    directories,
    disabled,
    onCopyAssets,
    onCopyDirectory,
    onCreateFolder,
    onMoveAssets,
    onMoveDirectory,
    onOpenLocalPath,
    onRenameAsset,
    onRenameDirectory,
    selectedItems,
  ]);

  useEffect(() => {
    if (!previewAsset) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewAsset(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewAsset]);

  function assetListCommandContext(menuMode: "blank" | "selection" = "blank"): AppCommandContext {
    return {
      objectType: "assetList",
      panelId,
      visiblePaths: filteredAssets.map((asset) => asset.relativePath),
      selectedPaths,
      visibleDirectoryPaths: childDirectories.map((directory) => directory.path),
      selectedDirectoryPaths,
      primaryPath: selectedPaths[0],
      primaryDirectoryPath: selectedDirectoryPaths[0],
      currentDirectoryPath: activeNode.path,
      canPaste: canPasteClipboard,
      menuMode,
    };
  }

  function handleAssetKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (disabled || isEditableShortcutTarget(event.target)) return;
    const key = event.key.toLowerCase();
    if (event.key === "Escape") {
      event.preventDefault();
      if (renameTarget) {
        cancelRename();
        return;
      }
      setSelectedPaths([]);
      setSelectedDirectoryPaths([]);
      return;
    }
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
    if ((event.ctrlKey || event.metaKey) && key === "c" && selectedItems.length > 0) {
      event.preventDefault();
      copySelectedToClipboard("copy");
      return;
    }
    if ((event.ctrlKey || event.metaKey) && key === "x" && selectedItems.length > 0) {
      event.preventDefault();
      copySelectedToClipboard("cut");
      return;
    }
    if ((event.ctrlKey || event.metaKey) && key === "v" && canPasteClipboard) {
      event.preventDefault();
      void pasteClipboard();
      return;
    }
    if (event.key === "Delete" && selectedItems.length > 0) {
      event.preventDefault();
      void deleteSelected();
      return;
    }
    if (event.key === "F2") {
      event.preventDefault();
      if (selectedDirectory) {
        beginRenameDirectory(selectedDirectory);
        return;
      }
      if (selectedPaths.length === 1) {
        const asset = assets.find((item) => item.relativePath === selectedPaths[0]);
        if (asset) beginRenameAsset(asset);
      }
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (selectedDirectory) {
        selectDirectory(selectedDirectory);
        return;
      }
      if (selectedPaths.length === 1) {
        const asset = assets.find((item) => item.relativePath === selectedPaths[0]);
        if (asset) selectAsset(asset);
      }
      return;
    }
    if (event.key === "Backspace" && activeNode.parentPath) {
      event.preventDefault();
      selectDirectoryPath(activeNode.parentPath);
      return;
    }
    if (event.key === " " && selectedPaths.length > 0) {
      event.preventDefault();
      requestCommandRun("assetList.previewPrimary", assetListCommandContext());
    }
  }

  const blankAssetListContext = assetListCommandContext("blank");
  const selectionAssetListContext = assetListCommandContext("selection");

  return (
    <DndContext>
      <AssetDropzone accept={importAccept} disabled={disabled || !onImportAssets} onDropFiles={importFiles}>
        {({ getRootProps, isDragActive }) => (
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
      <div ref={containerRef} className="flex min-h-0 flex-1 flex-col overflow-hidden relative">
        <div className="shrink-0 border-b border-border bg-surface-panel px-3 py-2 flex flex-col gap-2">
          
          {/* Top Row: Search & Actions */}
          <div className="flex items-center justify-between gap-2 w-full">
            {!isNarrow && (
              <div className="flex flex-1 items-center min-w-0">
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
                  panelId={panelId}
                  path={activeNode.path}
                  onSelectPath={(path) => selectDirectory(directories.find((directory) => directory.path === path) ?? tree)}
                  onDropOnPath={(event, path) => handleDropOnDirectory(event, path)}
                />
              </div>
            )}
            <div className={cn("flex shrink-0 items-center gap-1", isNarrow && "w-full justify-between")}>
              <StudioSearchInput value={query} onChange={setQuery} className={isNarrow ? "flex-1 min-w-0" : "w-[120px] sm:w-[260px]"} />
              <div className="flex shrink-0 items-center gap-0.5 rounded-md border border-border-soft bg-surface-muted p-0.5 ml-1 hidden sm:flex">
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
              {onCreateFolder ? (
                <Button variant="ghost" size="icon" disabled={disabled} className="h-7 w-7 rounded-md hover:bg-surface-raised" title="新建文件夹" onClick={() => void onCreateFolder(activeNode.path)}>
                  <Folder className="h-3.5 w-3.5 text-text-muted" />
                </Button>
              ) : null}
              {onImportAssets ? (
                <Button variant="ghost" size="icon" disabled={disabled} className="h-7 w-7 rounded-md hover:bg-surface-raised" title="导入到当前目录" onClick={() => openNativeImportDialog("files")}>
                  <Upload className="h-3.5 w-3.5 text-text-muted" />
                </Button>
              ) : null}
              
              {!isNarrow && (
                <>
                  <div className="mx-1 h-4 w-px bg-border-soft hidden sm:block" />
                  <label className="flex shrink-0 cursor-pointer items-center gap-1 text-[11px] font-semibold text-text-subtle hover:text-text" title="包含子目录">
                    <input type="checkbox" checked={recursive} onChange={(event) => setRecursive(event.target.checked)} className="h-3.5 w-3.5 cursor-pointer rounded border-border bg-surface-app text-brand focus:ring-brand/30" />
                    <span className="hidden xl:inline">包含</span>子目录
                  </label>
                  <span className="shrink-0 text-[10px] font-semibold text-text-subtle opacity-70 px-1">共{counts.all}项</span>
                </>
              )}
            </div>
          </div>

          {/* Bottom Row: Swaps between Filters/Meta and Bulk Actions */}
          {(selectedItems.length > 0 || isNarrow || showTypeFilter || showDirectoryTree || assetClipboard) && (
            <div className="relative min-h-[28px] w-full">
            <AnimatePresence mode="wait">
              {selectedItems.length > 0 ? (
                <motion.div
                  key="bulk-actions"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.15 }}
                  className="absolute inset-0 flex items-center justify-between gap-3 bg-surface-panel z-10"
                >
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => { setSelectedPaths([]); setSelectedDirectoryPaths([]); }} className="rounded-md p-1.5 text-text-subtle transition-colors hover:bg-surface-raised hover:text-text">
                      <X className="h-4 w-4" />
                    </button>
                    <span className="rounded-md bg-brand/10 px-2 py-1 text-xs font-bold text-brand-strong">已选 {selectedItems.length} 项</span>
                  </div>
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <StudioBulkActionBar
                      selectedCount={selectedItems.length}
                      allSelected={allVisibleSelected}
                      onSelectAll={() => replaceSelection({
                        assetPaths: filteredAssets.map((asset) => asset.relativePath),
                        directoryPaths: childDirectories.map((directory) => directory.path)
                      })}
                      onInvertSelection={() => {
                        const visible = new Set(filteredAssets.map((asset) => asset.relativePath));
                        const visibleDirectories = new Set(childDirectories.map((directory) => directory.path));
                        setSelectedPaths((current) => [
                          ...current.filter((path) => !visible.has(path)),
                          ...filteredAssets.filter((asset) => !current.includes(asset.relativePath)).map((asset) => asset.relativePath)
                        ]);
                        setSelectedDirectoryPaths((current) => [
                          ...current.filter((path) => !visibleDirectories.has(path)),
                          ...childDirectories.filter((directory) => !current.includes(directory.path)).map((directory) => directory.path)
                        ]);
                      }}
                      onClear={() => { setSelectedPaths([]); setSelectedDirectoryPaths([]); }}
                      showSelectionRow={false}
                      actions={[
                        { id: "copy", label: "复制到", onClick: () => openCopyPickerForSelection(selectedPaths, selectedDirectoryPaths) },
                        { id: "cut", label: "剪切", onClick: () => copySelectedToClipboard("cut") },
                        { id: "move", label: "移动到", onClick: () => openMovePickerForSelection(selectedPaths, selectedDirectoryPaths) },
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
                  className="absolute inset-0 flex items-center justify-between gap-4 w-full"
                >
                  <div className="flex flex-1 items-center min-w-0 overflow-hidden">
                    {/* Breadcrumbs take up the left space when narrow */}
                    {isNarrow && (
                      <div className="flex shrink-0 items-center mr-3 border-r border-border pr-3">
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
                          panelId={panelId}
                          path={activeNode.path}
                          onSelectPath={(path) => selectDirectory(directories.find((directory) => directory.path === path) ?? tree)}
                          onDropOnPath={(event, path) => handleDropOnDirectory(event, path)}
                        />
                      </div>
                    )}
                    
                    {showDirectoryTree ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setTreeOpen(true)}
                        className={cn("h-7 shrink-0 gap-1.5 rounded-md px-2 text-[11px] font-semibold transition-colors", showTypeFilter ? "mr-3 border-r border-border rounded-r-none pr-3" : "mr-2")}
                      >
                        <PanelLeft className="h-3.5 w-3.5" />
                        目录
                        <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[9px] font-bold text-text-subtle">{tree.totalAssetCount}</span>
                      </Button>
                    ) : null}
                    
                    {/* Type Filters follow Breadcrumbs if they exist */}
                    {showTypeFilter && (
                      <div className="flex flex-1 items-center gap-1 overflow-x-auto whitespace-nowrap scrollbar-thin">
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
                    )}
                  </div>
                  
                  <div className="flex shrink-0 items-center gap-2.5 justify-end text-[10px] text-text-subtle">
                    {isNarrow && (
                      <>
                        <label className="flex shrink-0 cursor-pointer items-center gap-1 text-[11px] font-semibold text-text-subtle hover:text-text" title="包含子目录">
                          <input type="checkbox" checked={recursive} onChange={(event) => setRecursive(event.target.checked)} className="h-3.5 w-3.5 cursor-pointer rounded border-border bg-surface-app text-brand focus:ring-brand/30" />
                          <span className="hidden xl:inline">包含</span>子目录
                        </label>
                        <span className="shrink-0 text-[10px] font-semibold text-text-subtle opacity-70">共{counts.all}项</span>
                      </>
                    )}
                    {assetClipboard ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 shrink-0 px-2 text-[11px] font-semibold"
                        onClick={() => void pasteClipboard()}
                        disabled={disabled || !canPasteClipboard}
                        title={`${assetClipboard.mode === "cut" ? "剪切" : "复制"} ${selectedItemCountLabel()} 项到当前目录`}
                      >
                        粘贴 {selectedItemCountLabel()}
                      </Button>
                    ) : null}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          )}
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
                    <AppContextMenu key={directory.path} context={{ objectType: "assetDirectory", directoryPath: directory.path, panelId }}>
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
                      {directoryPicker.item.type === "directory" ? directoryPicker.item.path : `${directoryPickerAssetPaths().length} 个资产`}
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

        <AppContextMenu context={blankAssetListContext}>
          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
            {view === "grid" ? (
              <AssetGrid
                panelId={panelId}
                assets={filteredAssets}
                directories={childDirectories}
                selectedSet={selectedSet}
                selectedDirectorySet={selectedDirectorySet}
                assetListContext={selectionAssetListContext}
                renameTarget={renameTarget}
                onSelectDirectory={selectDirectory}
                onSelectDirectoryEntry={selectDirectoryEntry}
                onToggleDirectoryEntry={toggleDirectoryEntry}
                onReplaceSelection={replaceSelection}
                onDropOnDirectory={handleDropOnDirectory}
                onToggleAsset={toggleAsset}
                onSelectAssetEntry={selectAssetEntry}
                onSelectAsset={selectAsset}
                onBeginRenameAsset={beginRenameAsset}
                onBeginRenameDirectory={beginRenameDirectory}
                onCommitRename={commitRename}
                onCancelRename={cancelRename}
                onCopyPath={copyPath}
                onAssetDragStart={onAssetDragStart}
                onPlayAudio={setPlayingAsset}
                onPreviewAsset={setPreviewAsset}
                playingAssetPath={playingAsset?.relativePath}
              />
            ) : (
              <AssetTable
                panelId={panelId}
                assets={filteredAssets}
                directories={childDirectories}
                selectedSet={selectedSet}
                selectedDirectorySet={selectedDirectorySet}
                assetListContext={selectionAssetListContext}
                renameTarget={renameTarget}
                onSelectDirectory={selectDirectory}
                onSelectDirectoryEntry={selectDirectoryEntry}
                onToggleDirectoryEntry={toggleDirectoryEntry}
                onDropOnDirectory={handleDropOnDirectory}
                onToggleAsset={toggleAsset}
                onSelectAssetEntry={selectAssetEntry}
                onSelectAsset={selectAsset}
                onBeginRenameAsset={beginRenameAsset}
                onBeginRenameDirectory={beginRenameDirectory}
                onCommitRename={commitRename}
                onCancelRename={cancelRename}
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
  const [isDragOver, setIsDragOver] = useState(false);
  return (
    <button
      type="button"
      title={directory.path}
      onClick={onClick}
      onDragOver={(event) => { event.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(event) => { setIsDragOver(false); onDrop(event); }}
      className={cn("flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-left text-xs transition-all duration-300", 
        isDragOver ? "bg-brand/20 ring-1 ring-brand/50 text-brand-strong scale-[1.02] shadow-sm z-10" : 
        active ? "bg-brand/10 text-brand-strong" : "text-text-muted hover:bg-surface-raised hover:text-text hover:translate-x-1"
      )}
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

function BreadcrumbItem({
  crumb,
  isLast,
  onSelectPath,
  onDropOnPath
}: {
  crumb: { name: string; path: string };
  isLast: boolean;
  onSelectPath: (path: string) => void;
  onDropOnPath: (event: React.DragEvent, path: string) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  return (
    <button
      type="button"
      className={cn("max-w-[120px] truncate rounded-full px-2.5 py-1 transition-all duration-300 border border-transparent",
        isDragOver ? "bg-brand/20 ring-2 ring-brand/50 text-brand-strong scale-105" :
        isLast ? "bg-surface-panel shadow-sm border-border-soft text-brand-strong" : 
        "hover:bg-surface-panel hover:shadow-sm hover:text-brand hover:border-border-soft text-text-muted"
      )}
      onClick={() => onSelectPath(crumb.path)}
      onDragOver={(event) => { event.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(event) => { setIsDragOver(false); onDropOnPath(event, crumb.path); }}
      title={crumb.path}
    >
      {crumb.name}
    </button>
  );
}

function Breadcrumb({
  panelId,
  path,
  onSelectPath,
  onDropOnPath
}: {
  panelId: string;
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
          <AppContextMenu context={{ objectType: "assetDirectory", directoryPath: crumb.path, panelId }}>
            <BreadcrumbItem
              crumb={crumb}
              isLast={index === breadcrumbs.length - 1}
              onSelectPath={onSelectPath}
              onDropOnPath={onDropOnPath}
            />
          </AppContextMenu>
        </span>
      ))}
    </div>
  );
}

function InlineRenameInput({
  value,
  selectBaseName,
  className,
  onCommit,
  onCancel
}: {
  value: string;
  selectBaseName?: boolean;
  className?: string;
  onCommit: (value: string) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    if (selectBaseName) {
      const dotIndex = value.lastIndexOf(".");
      const selectionEnd = dotIndex > 0 ? dotIndex : value.length;
      input.setSelectionRange(0, selectionEnd);
    } else {
      input.select();
    }
  }, [selectBaseName, value]);

  return (
    <input
      ref={inputRef}
      value={draft}
      draggable={false}
      className={cn("min-w-0 rounded border border-brand/40 bg-surface-panel px-1.5 py-1 text-xs font-semibold text-text shadow-sm outline-none ring-2 ring-brand/10", className)}
      onChange={(event) => setDraft(event.target.value)}
      onPointerDownCapture={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDownCapture={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onDragStartCapture={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onDragStart={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          void onCommit(draft);
        }
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
      }}
      onBlur={() => void onCommit(draft)}
    />
  );
}

function AssetGridDirectory({
  panelId,
  directory,
  selected,
  assetListContext,
  renameTarget,
  onSelectDirectory,
  onSelectDirectoryEntry,
  onDropOnDirectory,
  onBeginRenameDirectory,
  onCommitRename,
  onCancelRename,
  onToggleDirectoryEntry
}: {
  panelId: string;
  directory: AssetDirectoryNode;
  selected: boolean;
  assetListContext: AppCommandContext;
  renameTarget: RenameTarget | null;
  onSelectDirectory: (directory: AssetDirectoryNode) => void;
  onSelectDirectoryEntry: (directory: AssetDirectoryNode) => void;
  onDropOnDirectory: (event: React.DragEvent, directoryPath: string) => void;
  onBeginRenameDirectory: (directory: AssetDirectoryNode) => void;
  onCommitRename: (value: string) => void | Promise<void>;
  onCancelRename: () => void;
  onToggleDirectoryEntry: (directory: AssetDirectoryNode) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const isRenaming = renameTarget?.type === "directory" && renameTarget.path === directory.path;
  const useSelectionContext =
    selected &&
    assetListContext.objectType === "assetList" &&
    (assetListContext.selectedPaths.length + (assetListContext.selectedDirectoryPaths?.length ?? 0) > 1);
  return (
    <AppContextMenu
      context={useSelectionContext ? assetListContext : { objectType: "assetDirectory", directoryPath: directory.path, panelId }}
      triggerClassName="block h-full w-full"
    >
      <div
        role="button"
        tabIndex={0}
        data-explorer-item="directory"
        data-explorer-path={directory.path}
        draggable={!isRenaming}
        title={directory.path}
        onClick={(event) => {
          if (event.ctrlKey || event.metaKey) onToggleDirectoryEntry(directory);
          else onSelectDirectoryEntry(directory);
        }}
        onContextMenu={() => undefined}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onSelectDirectory(directory);
          }
          if (event.key === " ") {
            event.preventDefault();
            onToggleDirectoryEntry(directory);
          }
        }}
        onDoubleClick={() => onSelectDirectory(directory)}
        onDragStart={(event) => {
          if (isRenaming) {
            event.preventDefault();
            return;
          }
          writeAssetDirectoryDragData(event, directory.path);
        }}
        onDragEnd={clearAssetDirectoryDragData}
        onDragOver={(event) => { event.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(event) => { setIsDragOver(false); onDropOnDirectory(event, directory.path); }}
        className={cn("group flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-transparent p-2.5 transition-all duration-200",
          isDragOver ? "bg-brand/10 border-brand/30 shadow-sm scale-[1.02] z-10" :
          selected ? "bg-brand/10 border-brand/40 shadow-sm" :
          "hover:bg-surface-raised hover:border-border-soft hover:shadow-sm"
        )}
      >
        <div className="flex w-full flex-1 items-center justify-center py-0.5 transition-transform duration-200 group-hover:scale-105">
          <Folder className={cn("pointer-events-none h-12 w-12 drop-shadow-sm transition-colors", isDragOver ? "text-brand fill-brand/20" : "text-brand/80 group-hover:text-brand group-hover:fill-brand/10")} />
        </div>
        <div className="flex w-full flex-col items-center px-1">
          {isRenaming ? (
            <InlineRenameInput
              value={renameTarget.value}
              className="w-full text-center"
              onCommit={onCommitRename}
              onCancel={onCancelRename}
            />
          ) : (
            <span
              className="line-clamp-2 text-center text-[12px] font-medium leading-tight text-text group-hover:text-brand"
              title={directory.name}
              style={{ wordBreak: "break-all" }}
              onClick={(event) => event.stopPropagation()}
              onDoubleClick={(event) => {
                event.stopPropagation();
                onBeginRenameDirectory(directory);
              }}
            >
              {directory.name}
            </span>
          )}
        </div>
      </div>
    </AppContextMenu>
  );
}

type AssetGridEntry =
  | { kind: "directory"; directory: AssetDirectoryNode }
  | { kind: "asset"; asset: AssetSummary };

function AssetGrid({
  panelId,
  assets,
  directories,
  selectedSet,
  selectedDirectorySet,
  assetListContext,
  renameTarget,
  onSelectDirectory,
  onSelectDirectoryEntry,
  onToggleDirectoryEntry,
  onReplaceSelection,
  onDropOnDirectory,
  onToggleAsset,
  onSelectAssetEntry,
  onSelectAsset,
  onBeginRenameAsset,
  onBeginRenameDirectory,
  onCommitRename,
  onCancelRename,
  onCopyPath,
  onAssetDragStart,
  onPlayAudio,
  onPreviewAsset,
  playingAssetPath
}: {
  panelId: string;
  assets: AssetSummary[];
  directories: AssetDirectoryNode[];
  selectedSet: Set<string>;
  selectedDirectorySet: Set<string>;
  assetListContext: AppCommandContext;
  renameTarget: RenameTarget | null;
  onSelectDirectory: (directory: AssetDirectoryNode) => void;
  onSelectDirectoryEntry: (directory: AssetDirectoryNode) => void;
  onToggleDirectoryEntry: (directory: AssetDirectoryNode) => void;
  onReplaceSelection: (selection: ExplorerSelection) => void;
  onDropOnDirectory: (event: React.DragEvent, directoryPath: string) => void;
  onToggleAsset: (asset: AssetSummary) => void;
  onSelectAssetEntry: (asset: AssetSummary) => void;
  onSelectAsset: (asset: AssetSummary) => void;
  onBeginRenameAsset: (asset: AssetSummary) => void;
  onBeginRenameDirectory: (directory: AssetDirectoryNode) => void;
  onCommitRename: (value: string) => void | Promise<void>;
  onCancelRename: () => void;
  onCopyPath: (relativePath: string) => void;
  onAssetDragStart?: (event: React.DragEvent, asset: AssetSummary) => void;
  onPlayAudio?: (asset: AssetSummary | null) => void;
  onPreviewAsset?: (asset: AssetSummary) => void;
  playingAssetPath?: string;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null);
  const [marqueeRect, setMarqueeRect] = useState<React.CSSProperties | null>(null);
  const entries = useMemo<AssetGridEntry[]>(
    () => [
      ...directories.map((directory) => ({ kind: "directory" as const, directory })),
      ...assets.map((asset) => ({ kind: "asset" as const, asset })),
    ],
    [assets, directories]
  );

  if (entries.length === 0) return <EmptyState />;

  function getMarqueeSelection(end: { x: number; y: number }): ExplorerSelection | null {
    const start = marqueeStartRef.current;
    const gridElement = gridRef.current;
    if (!start || !gridElement) return null;
    const selectionRect = {
      left: Math.min(start.x, end.x),
      right: Math.max(start.x, end.x),
      top: Math.min(start.y, end.y),
      bottom: Math.max(start.y, end.y)
    };
    const selectedElements = Array.from(gridElement.querySelectorAll<HTMLElement>("[data-explorer-item][data-explorer-path]")).filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.right >= selectionRect.left && rect.left <= selectionRect.right && rect.bottom >= selectionRect.top && rect.top <= selectionRect.bottom;
    });
    return {
      assetPaths: selectedElements
        .filter((element) => element.dataset.explorerItem === "asset")
        .map((element) => element.dataset.explorerPath)
        .filter((path): path is string => !!path),
      directoryPaths: selectedElements
        .filter((element) => element.dataset.explorerItem === "directory")
        .map((element) => element.dataset.explorerPath)
        .filter((path): path is string => !!path)
    };
  }

  return (
    <div
      ref={gridRef}
      className="relative h-full"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        if ((event.target as HTMLElement).closest("[data-explorer-item]")) return;
        marqueeStartRef.current = { x: event.clientX, y: event.clientY };
        setMarqueeRect({
          left: event.clientX,
          top: event.clientY,
          width: 0,
          height: 0
        });
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const start = marqueeStartRef.current;
        if (!start) return;
        setMarqueeRect({
          left: Math.min(start.x, event.clientX),
          top: Math.min(start.y, event.clientY),
          width: Math.abs(event.clientX - start.x),
          height: Math.abs(event.clientY - start.y)
        });
        if (Math.abs(event.clientX - start.x) < 4 && Math.abs(event.clientY - start.y) < 4) return;
        const nextSelection = getMarqueeSelection({ x: event.clientX, y: event.clientY });
        if (nextSelection) onReplaceSelection(nextSelection);
      }}
      onPointerUp={(event) => {
        if (!marqueeStartRef.current) return;
        if (Math.abs(event.clientX - marqueeStartRef.current.x) >= 4 || Math.abs(event.clientY - marqueeStartRef.current.y) >= 4) {
          const nextSelection = getMarqueeSelection({ x: event.clientX, y: event.clientY });
          if (nextSelection) onReplaceSelection(nextSelection);
        }
        marqueeStartRef.current = null;
        setMarqueeRect(null);
        (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
      }}
    >
      <VirtualGrid
        items={entries}
        minItemWidth={80}
        estimateRowHeight={116}
        gap={6}
        className="h-full px-3 py-2"
        contentClassName=""
        getKey={(item: AssetGridEntry, index: number) =>
          item.kind === "directory" ? `dir:${item.directory.path}` : `asset:${item.asset.id}:${index}`
        }
        renderItem={(entry: AssetGridEntry) => {
          if (entry.kind === "directory") {
            return (
              <AssetGridDirectory
                panelId={panelId}
                directory={entry.directory}
                selected={selectedDirectorySet.has(entry.directory.path)}
                assetListContext={assetListContext}
                renameTarget={renameTarget}
                onSelectDirectory={onSelectDirectory}
                onSelectDirectoryEntry={onSelectDirectoryEntry}
                onToggleDirectoryEntry={onToggleDirectoryEntry}
                onDropOnDirectory={onDropOnDirectory}
                onBeginRenameDirectory={onBeginRenameDirectory}
                onCommitRename={onCommitRename}
                onCancelRename={onCancelRename}
              />
            );
          }
          const asset = entry.asset;
          const isSelected = selectedSet.has(asset.relativePath);
          const Icon = typeIcons[asset.assetType] || File;
          const isAudio = asset.assetType === "audio";
          const isPlaying = playingAssetPath === asset.relativePath;
          const isRenaming = renameTarget?.type === "asset" && renameTarget.path === asset.relativePath;
          const useSelectionContext =
            isSelected &&
            assetListContext.objectType === "assetList" &&
            (assetListContext.selectedPaths.length + (assetListContext.selectedDirectoryPaths?.length ?? 0) > 1);
          return (
            <AppContextMenu context={useSelectionContext ? assetListContext : { objectType: "asset", relativePath: asset.relativePath, panelId }}>
              <AssetDraggable asset={asset} onDragStart={onAssetDragStart} disabled={isRenaming}>
                {({ ref, draggableProps, isDragging }) => (
                  <div
                    ref={ref}
                    {...draggableProps}
                    data-explorer-item="asset"
                    data-explorer-path={asset.relativePath}
                    className={cn(
                      "group relative flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-transparent p-2.5 transition-all duration-200",
                      isDragging && "scale-95 opacity-70",
                      isPlaying ? "border-brand/30 bg-brand/5 shadow-sm" :
                      isSelected ? "border-brand/40 bg-brand/10 shadow-sm" :
                      "hover:border-border-soft hover:bg-surface-raised hover:shadow-sm"
                    )}
                    onContextMenu={() => undefined}
                    onDoubleClick={() => onSelectAsset(asset)}
                  >
                  <label className={cn("absolute left-1.5 top-1.5 z-10 flex h-5 w-5 cursor-pointer items-center justify-center rounded border bg-surface-panel/90 shadow-sm backdrop-blur-sm transition-opacity duration-200", isSelected ? "border-brand opacity-100" : "border-border opacity-0 hover:border-brand group-hover:opacity-100")}>
                    {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-brand" />}
                    <input type="checkbox" className="sr-only" checked={isSelected} onChange={(e) => { e.stopPropagation(); onToggleAsset(asset); }} />
                  </label>
                  <div
                    role="button"
                    tabIndex={0}
                    className="flex h-full w-full flex-col items-center text-center"
                    onClick={() => onToggleAsset(asset)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelectAsset(asset);
                      }
                    }}
                  >
                    <div className="pointer-events-none relative flex w-full flex-1 items-center justify-center py-0.5 transition-transform duration-200 group-hover:scale-105">
                      {asset.assetType === "image" ? (
                        <div className="flex aspect-square w-full max-h-[64px] items-center justify-center overflow-hidden rounded-[4px] bg-surface-muted ring-1 ring-border-soft/50 shadow-sm">
                          <AssetImageThumb asset={asset} />
                        </div>
                      ) : asset.assetType === "video" ? (
                        <div className="group/video pointer-events-auto relative aspect-square w-full max-h-[64px] overflow-hidden rounded-[4px] bg-black/10 ring-1 ring-border-soft/50 shadow-sm">
                          <VideoThumb asset={asset} />
                          <button
                            type="button"
                            className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover/video:opacity-100"
                            onClick={(event) => {
                              event.stopPropagation();
                              onPreviewAsset?.(asset);
                            }}
                            title="播放视频"
                          >
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur-sm">
                              <Play className="ml-0.5 h-3 w-3 fill-current" />
                            </span>
                          </button>
                        </div>
                      ) : isAudio ? (
                        <div className="group/preview pointer-events-auto relative flex h-full w-full flex-col items-center justify-center gap-1.5 transition-all">
                          <FileAudio className={cn("h-12 w-12 transition-all drop-shadow-sm", isPlaying ? "text-brand" : "text-indigo-500/80 group-hover/preview:text-indigo-500")} />
                          <div className={cn("absolute inset-0 flex items-center justify-center rounded-full backdrop-blur-[2px] transition-opacity", isPlaying ? "bg-brand/10 opacity-100" : "bg-black/40 opacity-0 group-hover/preview:opacity-100")}>
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
                              className={cn("flex h-8 w-8 items-center justify-center rounded-full text-white shadow-xl transition-all hover:scale-110 active:scale-95", isPlaying ? "bg-surface-panel ring-2 ring-brand animate-pulse" : "bg-brand")}
                              title={isPlaying ? "正在播放 (点击关闭)" : "播放音频"}
                            >
                              {isPlaying ? <Activity className="h-4 w-4 text-brand" /> : <Play className="ml-0.5 h-3 w-3 fill-current" />}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 transition-all">
                          <Icon className="pointer-events-none h-12 w-12 text-text-muted/60 drop-shadow-sm transition-all group-hover:text-text-muted" />
                        </div>
                      )}
                    </div>
                    <div className="mt-1 flex w-full flex-col items-center px-1">
                      {isRenaming ? (
                        <InlineRenameInput
                          value={renameTarget.value}
                          selectBaseName
                          className="w-full text-center"
                          onCommit={onCommitRename}
                          onCancel={onCancelRename}
                        />
                      ) : (
                        <button
                          type="button"
                          className="line-clamp-2 text-center text-[12px] font-medium leading-tight text-text group-hover:text-brand"
                          title={asset.fileName}
                          style={{ wordBreak: "break-all" }}
                          onClick={(event) => event.stopPropagation()}
                          onDoubleClick={(event) => {
                            event.stopPropagation();
                            onBeginRenameAsset(asset);
                          }}
                        >
                          {asset.fileName}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </AssetDraggable>
          </AppContextMenu>
        );
      }}
    />
      {marqueeRect ? (
        <div
          className="pointer-events-none fixed z-[90] border border-brand/70 bg-brand/10"
          style={marqueeRect}
        />
      ) : null}
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

function VideoThumb({
  asset,
  compact = false
}: {
  asset: AssetSummary;
  compact?: boolean;
}) {
  const [shouldLoad, setShouldLoad] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setShouldLoad(false);
    setFailed(false);
  }, [asset.projectId, asset.relativePath]);

  const Icon = typeIcons[asset.assetType] || FileVideo;

  return (
    <div
      className={cn(
        "relative flex h-full w-full items-center justify-center overflow-hidden",
        compact ? "rounded-[4px]" : "rounded-md"
      )}
      onPointerEnter={() => setShouldLoad(true)}
      onMouseEnter={() => setShouldLoad(true)}
      onFocus={() => setShouldLoad(true)}
    >
      {shouldLoad && !failed ? (
        <video
          src={assetPreviewUrl(asset.projectId, asset.relativePath)}
          className="h-full w-full object-cover"
          muted
          playsInline
          preload="metadata"
          onError={() => setFailed(true)}
        />
      ) : (
        <Icon className={cn(compact ? "h-4 w-4" : "h-16 w-16", "text-text-muted/60")} />
      )}
    </div>
  );
}

function AssetTable({
  panelId,
  assets,
  directories,
  selectedSet,
  selectedDirectorySet,
  assetListContext,
  renameTarget,
  onSelectDirectory,
  onSelectDirectoryEntry,
  onToggleDirectoryEntry,
  onDropOnDirectory,
  onToggleAsset,
  onSelectAssetEntry,
  onSelectAsset,
  onBeginRenameAsset,
  onBeginRenameDirectory,
  onCommitRename,
  onCancelRename,
  onCopyPath,
  onAssetDragStart,
  onPlayAudio,
  onPreviewAsset,
  playingAssetPath
}: {
  panelId: string;
  assets: AssetSummary[];
  directories: AssetDirectoryNode[];
  selectedSet: Set<string>;
  selectedDirectorySet: Set<string>;
  assetListContext: AppCommandContext;
  renameTarget: RenameTarget | null;
  onSelectDirectory: (directory: AssetDirectoryNode) => void;
  onSelectDirectoryEntry: (directory: AssetDirectoryNode) => void;
  onToggleDirectoryEntry: (directory: AssetDirectoryNode) => void;
  onDropOnDirectory: (event: React.DragEvent, directoryPath: string) => void;
  onToggleAsset: (asset: AssetSummary) => void;
  onSelectAssetEntry: (asset: AssetSummary) => void;
  onSelectAsset: (asset: AssetSummary) => void;
  onBeginRenameAsset: (asset: AssetSummary) => void;
  onBeginRenameDirectory: (directory: AssetDirectoryNode) => void;
  onCommitRename: (value: string) => void | Promise<void>;
  onCancelRename: () => void;
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
        const isRenaming = renameTarget?.type === "asset" && renameTarget.path === asset.relativePath;
        return (
          <div className="flex min-w-0 w-full items-start gap-2.5 text-left py-1">
            {isImage ? (
              <span className={cn("pointer-events-none flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] bg-surface-muted ring-1 mt-0.5", isSelected ? "ring-brand" : "ring-border-soft")}>
                <AssetImageThumb asset={asset} compact />
              </span>
            ) : isVideo ? (
              <button type="button" onClick={(e) => { e.stopPropagation(); onPreviewAsset?.(asset); }} className={cn("group/play relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-[4px] ring-1 mt-0.5 transition-all hover:bg-brand hover:ring-brand", isSelected ? "ring-border-soft bg-brand/10" : "ring-border-soft bg-surface-raised")} title="播放视频">
                <VideoThumb asset={asset} compact />
                <Play className="pointer-events-none absolute hidden h-3.5 w-3.5 fill-current text-white group-hover/play:block" />
              </button>
            ) : isAudio ? (
              <button type="button" onClick={(e) => { e.stopPropagation(); isPlaying ? onPlayAudio?.(null) : onPlayAudio?.(asset); }} className={cn("group/play flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] ring-1 mt-0.5 transition-all hover:bg-brand hover:ring-brand", isPlaying ? "ring-brand bg-brand/20 animate-pulse" : isSelected ? "ring-border-soft bg-brand/10" : "ring-border-soft bg-surface-raised")} title={isPlaying ? "正在播放" : "播放音频"}>
                {isPlaying ? <Activity className="h-4 w-4 text-brand" /> : (
                  <>
                    <Icon className="pointer-events-none h-4 w-4 text-text-muted group-hover/play:hidden" />
                    <Play className="pointer-events-none h-3.5 w-3.5 text-white hidden group-hover/play:block fill-current" />
                  </>
                )}
              </button>
            ) : (
              <div className={cn("pointer-events-none flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] ring-1 ring-border-soft mt-0.5", isSelected ? "bg-brand/10" : "bg-surface-raised")}>
                <Icon className={cn("pointer-events-none h-4 w-4", isSelected ? "text-brand" : "text-text-muted")} />
              </div>
            )}
            <div className="flex min-w-0 flex-1 flex-col justify-center">
              {isRenaming ? (
                <InlineRenameInput
                  value={renameTarget.value}
                  selectBaseName
                  className="w-full"
                  onCommit={onCommitRename}
                  onCancel={onCancelRename}
                />
              ) : (
                <button
                  type="button"
                  className={cn("truncate text-left text-[12px] leading-tight transition-colors", isPlaying ? "font-bold text-brand" : isSelected ? "font-semibold text-brand-strong" : "font-medium text-text")}
                  title={asset.fileName}
                  onClick={(event) => event.stopPropagation()}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    onBeginRenameAsset(asset);
                  }}
                >
                  {getValue()}
                </button>
              )}
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
        {directories.map((directory) => {
          const isDirectorySelected = selectedDirectorySet.has(directory.path);
          const isDirectoryRenaming = renameTarget?.type === "directory" && renameTarget.path === directory.path;
          const useSelectionContext =
            isDirectorySelected &&
            assetListContext.objectType === "assetList" &&
            (assetListContext.selectedPaths.length + (assetListContext.selectedDirectoryPaths?.length ?? 0) > 1);
          return (
          <AppContextMenu
            key={directory.path}
            context={useSelectionContext ? assetListContext : { objectType: "assetDirectory", directoryPath: directory.path, panelId }}
          >
            <div
              title={directory.path}
              data-explorer-item="directory"
              data-explorer-path={directory.path}
              draggable={!isDirectoryRenaming}
              onClick={(event) => {
                if (event.ctrlKey || event.metaKey) onToggleDirectoryEntry(directory);
                else onSelectDirectoryEntry(directory);
              }}
              onContextMenu={() => undefined}
              onDoubleClick={() => onSelectDirectory(directory)}
              onDragStart={(event) => {
                if (isDirectoryRenaming) {
                  event.preventDefault();
                  return;
                }
                writeAssetDirectoryDragData(event, directory.path);
              }}
              onDragEnd={clearAssetDirectoryDragData}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => onDropOnDirectory(event, directory.path)}
              className={cn(
                "group flex min-h-[48px] cursor-pointer items-center border-b px-4 py-2 text-left transition-colors hover:bg-surface-raised",
                isDirectorySelected ? "border-brand/20 bg-brand/5 hover:bg-brand/10" : "border-border-soft bg-transparent"
              )}
            >
              <div className="w-8 shrink-0" />
              <div className="flex min-w-[140px] flex-1 items-center gap-2.5 pr-4">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] bg-surface-raised ring-1 ring-border-soft">
                  <Folder className="pointer-events-none h-4 w-4 text-text-subtle transition-colors group-hover:text-brand" />
                </div>
                <div className="min-w-0">
                  {isDirectoryRenaming ? (
                    <InlineRenameInput
                      value={renameTarget.value}
                      className="w-full"
                      onCommit={onCommitRename}
                      onCancel={onCancelRename}
                    />
                  ) : (
                    <button
                      type="button"
                      className="block truncate text-left text-[12px] font-semibold text-text"
                      onClick={(event) => event.stopPropagation()}
                      onDoubleClick={(event) => {
                        event.stopPropagation();
                        onBeginRenameDirectory(directory);
                      }}
                    >
                      {directory.name}
                    </button>
                  )}
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
            </div>
          </AppContextMenu>
          );
        })}
        <VirtualList
          items={table.getRowModel().rows}
          estimateSize={48}
          getKey={(row) => row.original.id}
          renderItem={(row) => {
          const asset = row.original;
          const isSelected = selectedSet.has(asset.relativePath);
          const isPlaying = playingAssetPath === asset.relativePath;
          const isRenaming = renameTarget?.type === "asset" && renameTarget.path === asset.relativePath;
          const useSelectionContext =
            isSelected &&
            assetListContext.objectType === "assetList" &&
            (assetListContext.selectedPaths.length + (assetListContext.selectedDirectoryPaths?.length ?? 0) > 1);
          return (
            <AppContextMenu key={asset.id} context={useSelectionContext ? assetListContext : { objectType: "asset", relativePath: asset.relativePath, panelId }}>
              <div
                draggable={!isRenaming}
                onDragStart={(event) => {
                  if (isRenaming) {
                    event.preventDefault();
                    return;
                  }
                  writeAssetDragData(event, asset);
                  onAssetDragStart?.(event, asset);
                }}
                onDragEnd={clearAssetDragData}
                className={cn(
                  "group flex min-h-[48px] py-2 items-center border-b px-4 text-left transition-colors hover:bg-surface-raised cursor-pointer",
                  isPlaying ? "bg-brand/5 border-brand/30" : isSelected ? "border-brand/20 bg-brand/5 hover:bg-brand/10" : "border-border-soft bg-transparent"
                )}
                onClick={() => onToggleAsset(asset)}
                onContextMenu={() => undefined}
                onDoubleClick={() => onSelectAsset(asset)}
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
