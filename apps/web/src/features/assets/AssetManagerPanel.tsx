import { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { CheckCircle2, ChevronRight, Copy, File, FileAudio, FileBox, FileImage, FileVideo, FolderOpen, GitBranch, LayoutGrid, List, RefreshCw, Upload, X } from "lucide-react";
import { assetPreviewUrl, type AssetSummary } from "../../api";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { StudioBulkActionBar, StudioSearchInput } from "../../components/studio/StudioKit";
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
  onRebuildAssetProvenance?: () => void;
  onImportAssets?: (files: File[], targetFolder: string) => Promise<void>;
  onDeleteAssets: (relativePaths: string[]) => Promise<void>;
  onMoveAssets: (relativePaths: string[], targetFolder: string) => Promise<void>;
  onSelectAsset: (asset: AssetSummary) => void;
  onAssetDragStart?: (event: React.DragEvent, asset: AssetSummary) => void;
};

const typeIcons: Record<string, React.ElementType> = {
  image: FileImage,
  video: FileVideo,
  audio: FileAudio,
  model3d: FileBox,
  other: File
};

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
  onRebuildAssetProvenance,
  onImportAssets,
  onDeleteAssets,
  onMoveAssets,
  onSelectAsset,
  onAssetDragStart
}: AssetManagerPanelProps) {
  const [view, setView] = useState<"grid" | "table">("grid");
  const [type, setType] = useState("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "linked" | "unlinked">("all");
  const [query, setQuery] = useState("");
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [targetFolder, setTargetFolder] = useState(defaultTargetFolder);
  const [activeDirectory, setActiveDirectory] = useState(rootPath);
  const [recursive, setRecursive] = useState(true);
  const importInputRef = useRef<HTMLInputElement>(null);

  const scopedAssets = useMemo(() => assetTypeFilter ? assets.filter((asset) => asset.assetType === assetTypeFilter) : assets, [assetTypeFilter, assets]);
  const tree = useMemo(() => buildAssetDirectoryTree(scopedAssets, rootPath), [rootPath, scopedAssets]);
  const directories = useMemo(() => flattenDirectoryTree(tree), [tree]);
  const activeNode = directories.find((directory) => directory.path === activeDirectory) ?? tree;
  const linkedCount = scopedAssets.filter((asset) => (asset.provenance?.length ?? 0) > 0).length;
  const selectedSet = useMemo(() => new Set(selectedPaths), [selectedPaths]);

  const filteredAssets = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return filterAssetsForDirectory(scopedAssets, activeNode.path, recursive).filter((asset) => {
      if (type !== "all" && asset.assetType !== type) return false;
      if (sourceFilter === "linked" && (asset.provenance?.length ?? 0) === 0) return false;
      if (sourceFilter === "unlinked" && (asset.provenance?.length ?? 0) > 0) return false;
      if (!needle) return true;
      return asset.fileName.toLowerCase().includes(needle) || asset.relativePath.toLowerCase().includes(needle);
    });
  }, [activeNode.path, query, recursive, scopedAssets, sourceFilter, type]);

  const counts = ordinaryAssetTypeOrder.reduce<Record<string, number>>((acc, next) => {
    const directoryAssets = filterAssetsForDirectory(scopedAssets, activeNode.path, true);
    acc[next] = next === "all" ? directoryAssets.length : directoryAssets.filter((asset) => asset.assetType === next).length;
    return acc;
  }, {});

  const allVisibleSelected = filteredAssets.length > 0 && filteredAssets.every((asset) => selectedSet.has(asset.relativePath));

  function toggleAsset(asset: AssetSummary) {
    setSelectedPaths((current) => current.includes(asset.relativePath) ? current.filter((path) => path !== asset.relativePath) : [...current, asset.relativePath]);
  }

  async function deleteSelected() {
    if (disabled || selectedPaths.length === 0) return;
    await onDeleteAssets(selectedPaths);
    setSelectedPaths([]);
  }

  async function moveSelected() {
    if (disabled || selectedPaths.length === 0) return;
    await onMoveAssets(selectedPaths, targetFolder);
    setSelectedPaths([]);
  }

  function selectDirectory(directory: AssetDirectoryNode) {
    setActiveDirectory(directory.path);
    setTargetFolder(directory.path);
    setSelectedPaths([]);
  }

  function handleDropOnDirectory(event: React.DragEvent, directoryPath: string) {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer.files.length > 0 && onImportAssets && !disabled) {
      void onImportAssets(Array.from(event.dataTransfer.files), directoryPath);
      return;
    }
    const draggedRelativePath = event.dataTransfer.getData("text/plain");
    if (!draggedRelativePath || disabled) return;
    const pathsToMove = selectedPaths.includes(draggedRelativePath) ? selectedPaths : [draggedRelativePath];
    void onMoveAssets(pathsToMove, directoryPath).then(() => setSelectedPaths([]));
  }

  function handleDropOnPanel(event: React.DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer.files.length === 0 || !onImportAssets || disabled) return;
    void onImportAssets(Array.from(event.dataTransfer.files), activeNode.path);
  }

  async function copyPath(relativePath: string) {
    await navigator.clipboard.writeText(relativePath).catch(() => undefined);
  }

  return (
    <div
      className="flex min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-surface-panel shadow-sm"
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) event.preventDefault();
      }}
      onDrop={handleDropOnPanel}
    >
      {showDirectoryTree ? <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface-muted/20 md:flex">
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3">
          <span className="truncate text-xs font-extrabold text-text">{title}</span>
          <span className="rounded bg-surface-panel px-1.5 py-0.5 text-[10px] font-bold text-text-subtle">{tree.totalAssetCount}</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2 scrollbar-thin">
          {directories.map((directory) => (
            <DirectoryRow
              key={directory.path}
              directory={directory}
              active={directory.path === activeNode.path}
              onClick={() => selectDirectory(directory)}
              onDrop={(event) => handleDropOnDirectory(event, directory.path)}
            />
          ))}
        </div>
      </aside> : null}

      <div className="flex min-w-0 flex-1 flex-col">
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
                  <Input value={targetFolder} onChange={(event) => setTargetFolder(event.target.value)} className="h-8 w-52 text-xs" placeholder="目标文件夹" />
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
                      { id: "move", label: "移动", onClick: () => void moveSelected() },
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
                className="flex flex-col gap-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Breadcrumb path={activeNode.path} onSelectPath={(path) => selectDirectory(directories.find((directory) => directory.path === path) ?? tree)} />
                  <div className="flex items-center gap-2">
                    <label className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-text-subtle">
                      <input type="checkbox" checked={recursive} onChange={(event) => setRecursive(event.target.checked)} className="h-3.5 w-3.5 rounded border-border bg-surface-app text-brand focus:ring-brand/30" />
                      包含子目录
                    </label>
                    <StudioSearchInput value={query} onChange={setQuery} className="w-44 xl:w-56" />
                    <div className="flex shrink-0 items-center gap-0.5 rounded-md border border-border-soft bg-surface-muted p-0.5">
                      <button type="button" title="网格视图" className={cn("rounded-[4px] p-1.5 transition-colors", view === "grid" ? "bg-surface-panel text-text shadow-sm" : "text-text-muted hover:text-text")} onClick={() => setView("grid")}>
                        <LayoutGrid className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" title="列表视图" className={cn("rounded-[4px] p-1.5 transition-colors", view === "table" ? "bg-surface-panel text-text shadow-sm" : "text-text-muted hover:text-text")} onClick={() => setView("table")}>
                        <List className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onScanAssets} disabled={disabled} className="h-8 w-8 rounded-md hover:bg-surface-raised" title="刷新资产">
                      <RefreshCw className="h-4 w-4 text-text-muted" />
                    </Button>
                    {onImportAssets ? (
                      <>
                        <Button variant="ghost" size="icon" disabled={disabled} className="h-8 w-8 rounded-md hover:bg-surface-raised" title="导入到当前目录" onClick={() => importInputRef.current?.click()}>
                          <Upload className="h-4 w-4 text-text-muted" />
                        </Button>
                        <input
                          ref={importInputRef}
                          type="file"
                          multiple
                          accept={importAccept}
                          className="hidden"
                          onChange={(event) => {
                            const files = event.currentTarget.files;
                            if (files && files.length > 0) void onImportAssets(Array.from(files), activeNode.path);
                            event.currentTarget.value = "";
                          }}
                        />
                      </>
                    ) : null}
                    {onRebuildAssetProvenance ? (
                      <Button variant="ghost" size="icon" onClick={onRebuildAssetProvenance} disabled={disabled} className="h-8 w-8 rounded-md hover:bg-surface-raised" title="重建来源索引">
                        <GitBranch className="h-4 w-4 text-text-muted" />
                      </Button>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 overflow-x-auto scrollbar-none">
                  {showTypeFilter ? <div className="flex items-center gap-1">
                    {ordinaryAssetTypeOrder.map((nextType) => (
                      <button
                        key={nextType}
                        type="button"
                        className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors", type === nextType ? "bg-brand/10 text-brand-strong" : "text-text-muted hover:bg-surface-raised hover:text-text")}
                        onClick={() => setType(nextType)}
                      >
                        <span>{ordinaryAssetTypeLabels[nextType] ?? nextType}</span>
                        <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-mono", type === nextType ? "bg-brand/20" : "bg-surface-muted text-text-subtle")}>{counts[nextType]}</span>
                      </button>
                    ))}
                  </div> : <div className="text-[11px] font-semibold text-text-subtle">当前目录 {counts.all} 项</div>}
                  <div className="flex shrink-0 items-center gap-0.5 rounded-md border border-border-soft bg-surface-muted p-0.5">
                    {["all", "linked", "unlinked"].map((option) => (
                      <button key={option} type="button" className={cn("rounded-[4px] px-2 py-1 text-[10px] font-bold transition-colors", sourceFilter === option ? "bg-surface-panel text-text shadow-sm" : "text-text-muted hover:text-text")} onClick={() => setSourceFilter(option as typeof sourceFilter)}>
                        {option === "all" ? "全部来源" : option === "linked" ? `已关联 ${linkedCount}` : "未关联"}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
          {view === "grid" ? (
            <AssetGrid assets={filteredAssets} selectedSet={selectedSet} onToggleAsset={toggleAsset} onSelectAsset={onSelectAsset} onCopyPath={copyPath} onAssetDragStart={onAssetDragStart} />
          ) : (
            <AssetTable assets={filteredAssets} selectedSet={selectedSet} onToggleAsset={toggleAsset} onSelectAsset={onSelectAsset} onCopyPath={copyPath} onAssetDragStart={onAssetDragStart} />
          )}
        </div>
      </div>
    </div>
  );
}

function DirectoryRow({ directory, active, onClick, onDrop }: { directory: AssetDirectoryNode; active: boolean; onClick: () => void; onDrop: (event: React.DragEvent) => void }) {
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
      <FolderOpen className={cn("h-3.5 w-3.5 shrink-0", active ? "text-brand" : "text-text-subtle")} />
      <span className="min-w-0 flex-1 truncate font-semibold">{directory.depth === 0 ? directory.name : directory.name}</span>
      <span className="rounded-pill bg-surface-panel px-1.5 py-0.5 text-[10px] font-bold text-text-subtle">{directory.totalAssetCount}</span>
    </button>
  );
}

function Breadcrumb({ path, onSelectPath }: { path: string; onSelectPath: (path: string) => void }) {
  const breadcrumbs = getDirectoryBreadcrumbs(path);
  return (
    <div className="flex min-w-0 items-center gap-1 text-xs font-bold text-text-muted">
      {breadcrumbs.map((crumb, index) => (
        <span key={crumb.path} className="flex min-w-0 items-center gap-1">
          {index > 0 ? <ChevronRight className="h-3 w-3 shrink-0 text-text-subtle" /> : null}
          <button type="button" className={cn("max-w-[120px] truncate rounded px-1.5 py-1 hover:bg-surface-raised hover:text-brand", index === breadcrumbs.length - 1 && "text-text")} onClick={() => onSelectPath(crumb.path)} title={crumb.path}>
            {crumb.name}
          </button>
        </span>
      ))}
    </div>
  );
}

function AssetGrid({ assets, selectedSet, onToggleAsset, onSelectAsset, onCopyPath, onAssetDragStart }: { assets: AssetSummary[]; selectedSet: Set<string>; onToggleAsset: (asset: AssetSummary) => void; onSelectAsset: (asset: AssetSummary) => void; onCopyPath: (relativePath: string) => void; onAssetDragStart?: (event: React.DragEvent, asset: AssetSummary) => void }) {
  if (assets.length === 0) return <EmptyState />;

  return (
    <div className="grid content-start gap-3 p-4 [grid-template-columns:repeat(auto-fill,minmax(112px,1fr))]">
      {assets.map((asset) => {
        const isSelected = selectedSet.has(asset.relativePath);
        const Icon = typeIcons[asset.assetType] || File;
        return (
          <div
            key={asset.id}
            draggable
            onDragStart={(event) => {
              if (onAssetDragStart) {
                onAssetDragStart(event, asset);
                return;
              }
              event.dataTransfer.setData("text/plain", asset.relativePath);
              event.dataTransfer.effectAllowed = "move";
            }}
            className={cn("group relative flex cursor-pointer flex-col overflow-hidden rounded-lg border bg-surface-panel transition-all duration-200", isSelected ? "border-brand shadow-[0_2px_8px_rgba(0,217,197,0.15)] ring-1 ring-brand/50" : "border-border hover:border-border-strong hover:shadow-sm")}
          >
            <label className={cn("absolute left-1.5 top-1.5 z-10 flex h-5 w-5 cursor-pointer items-center justify-center rounded border bg-surface-panel/90 shadow-sm backdrop-blur-sm transition-opacity", isSelected ? "border-brand opacity-100" : "border-border opacity-0 hover:border-brand group-hover:opacity-100")}>
              {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-brand" />}
              <input type="checkbox" className="sr-only" checked={isSelected} onChange={() => onToggleAsset(asset)} />
            </label>
            <div
              role="button"
              tabIndex={0}
              className="flex h-full w-full flex-col text-left"
              onClick={() => onSelectAsset(asset)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") onSelectAsset(asset);
              }}
            >
              <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden border-b border-border-soft bg-surface-muted">
                {asset.assetType === "image" ? (
                  <img src={assetPreviewUrl(asset.projectId, asset.relativePath)} alt={asset.fileName} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
                ) : asset.assetType === "video" ? (
                  <div className="h-full w-full bg-black/10">
                    <video
                      src={assetPreviewUrl(asset.projectId, asset.relativePath)}
                      className="h-full w-full object-cover"
                      muted
                      loop
                      preload="metadata"
                      onMouseEnter={(event) => void event.currentTarget.play()}
                      onMouseLeave={(event) => {
                        event.currentTarget.pause();
                        event.currentTarget.currentTime = 0;
                      }}
                    />
                  </div>
                ) : asset.assetType === "audio" ? (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-surface-raised to-surface-muted px-2">
                    <FileAudio className="h-8 w-8 text-brand opacity-80" />
                    <span className="max-w-full truncate text-[9px] font-bold uppercase tracking-widest text-text-subtle">{asset.extension.replace(".", "") || "audio"}</span>
                    <div className="w-full" onClick={(event) => event.stopPropagation()}>
                      <audio controls preload="none" className="h-7 w-full">
                        <source src={assetPreviewUrl(asset.projectId, asset.relativePath)} />
                      </audio>
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
                  <SourceBadge count={asset.provenance?.length ?? 0} />
                  <span className="text-[9px] text-text-subtle">{formatBytes(asset.sizeBytes)}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AssetTable({ assets, selectedSet, onToggleAsset, onSelectAsset, onCopyPath, onAssetDragStart }: { assets: AssetSummary[]; selectedSet: Set<string>; onToggleAsset: (asset: AssetSummary) => void; onSelectAsset: (asset: AssetSummary) => void; onCopyPath: (relativePath: string) => void; onAssetDragStart?: (event: React.DragEvent, asset: AssetSummary) => void }) {
  const columnHelper = createColumnHelper<AssetSummary>();
  const columns = useMemo(() => [
    columnHelper.display({
      id: "select",
      header: "",
      cell: ({ row }) => {
        const asset = row.original;
        const isSelected = selectedSet.has(asset.relativePath);
        return (
          <label className="flex cursor-pointer items-center">
            <div className={cn("flex h-4 w-4 items-center justify-center rounded border transition-colors", isSelected ? "border-brand bg-brand text-surface-app" : "border-border-soft bg-surface-panel group-hover:border-brand/50")}>
              {isSelected && <CheckCircle2 className="h-3 w-3" />}
            </div>
            <input type="checkbox" className="sr-only" checked={isSelected} onChange={() => onToggleAsset(asset)} />
          </label>
        );
      }
    }),
    columnHelper.accessor("fileName", {
      header: "文件",
      cell: ({ row, getValue }) => {
        const asset = row.original;
        const Icon = typeIcons[asset.assetType] || File;
        const isSelected = selectedSet.has(asset.relativePath);
        return (
          <button type="button" className="flex w-full items-center gap-2.5 text-left" onClick={() => onSelectAsset(asset)}>
            <Icon className={cn("h-4 w-4 shrink-0", isSelected ? "text-brand" : "text-text-muted")} />
            <span className={cn("truncate text-[12px]", isSelected ? "font-semibold text-brand-strong" : "font-medium text-text")}>{getValue()}</span>
          </button>
        );
      }
    }),
    columnHelper.accessor("relativePath", {
      header: "路径",
      cell: ({ getValue }) => (
        <button
          type="button"
          className="flex w-full min-w-0 items-center gap-1 text-left text-[11px] text-text-subtle opacity-70 hover:text-brand hover:opacity-100"
          title={`${getValue()}，点击复制`}
          onClick={(event) => {
            event.stopPropagation();
            onCopyPath(getValue());
          }}
        >
          <span className="min-w-0 flex-1 truncate">{getValue()}</span>
          <Copy className="h-3 w-3 shrink-0" />
        </button>
      )
    }),
    columnHelper.accessor("assetType", {
      header: "类型",
      cell: ({ row, getValue }) => <span className="text-[10px] font-mono uppercase text-text-muted">{row.original.extension.replace(".", "") || getValue()}</span>
    }),
    columnHelper.accessor("sizeBytes", {
      header: "大小",
      cell: ({ getValue }) => <span className="block text-right font-mono text-[10px] text-text-muted">{formatBytes(getValue())}</span>
    }),
    columnHelper.display({
      id: "provenance",
      header: "来源",
      cell: ({ row }) => <SourceBadge count={row.original.provenance?.length ?? 0} />
    })
  ], [columnHelper, onCopyPath, onSelectAsset, onToggleAsset, selectedSet]);
  const table = useReactTable({ data: assets, columns, getCoreRowModel: getCoreRowModel() });
  if (assets.length === 0) return <EmptyState />;

  return (
    <div className="flex w-full flex-col bg-surface-panel text-left">
      <div className="sticky top-0 z-10 flex items-center border-b border-border bg-surface-muted/30 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-text-subtle backdrop-blur-md">
        {table.getHeaderGroups()[0]?.headers.map((header) => (
          <div key={header.id} className={cn(header.id === "select" ? "w-8 shrink-0" : header.id === "relativePath" ? "w-56 xl:w-80 shrink-0 px-2" : header.id === "assetType" ? "w-24 shrink-0 px-2" : header.id === "sizeBytes" || header.id === "provenance" ? "w-28 shrink-0 px-2 text-right" : "min-w-0 flex-1 pr-4")}>
            {flexRender(header.column.columnDef.header, header.getContext())}
          </div>
        ))}
      </div>
      <div className="flex flex-col">
        {table.getRowModel().rows.map((row) => {
          const asset = row.original;
          const isSelected = selectedSet.has(asset.relativePath);
          return (
            <div
              key={asset.id}
              draggable
              onDragStart={(event) => {
                if (onAssetDragStart) {
                  onAssetDragStart(event, asset);
                  return;
                }
                event.dataTransfer.setData("text/plain", asset.relativePath);
                event.dataTransfer.effectAllowed = "move";
              }}
              className={cn("group flex items-center border-b border-border-soft px-4 py-1.5 text-left transition-colors hover:bg-surface-raised", isSelected ? "border-brand/20 bg-brand/5" : "bg-transparent")}
            >
              {row.getVisibleCells().map((cell) => (
                <div key={cell.id} className={cn(cell.column.id === "select" ? "w-8 shrink-0" : cell.column.id === "relativePath" ? "w-56 xl:w-80 shrink-0 px-2" : cell.column.id === "assetType" ? "w-24 shrink-0 px-2" : cell.column.id === "sizeBytes" || cell.column.id === "provenance" ? "w-28 shrink-0 px-2" : "min-w-0 flex-1 pr-4")}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
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

function SourceBadge({ count }: { count: number }) {
  return (
    <span className={cn("inline-flex items-center rounded-pill px-1.5 py-0.5 text-[9px] font-bold", count > 0 ? "bg-brand/10 text-brand-strong" : "bg-surface-muted text-text-subtle")}>
      {count > 0 ? `已关联 ${count}` : "未关联"}
    </span>
  );
}
