import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Search, LayoutGrid, List, FileImage, FileVideo, FileAudio, FileBox, File, RefreshCw, FolderOpen, Trash2, MoveRight, CheckCircle2, X, GitBranch } from "lucide-react";
import { assetPreviewUrl, type AssetSummary, type ProjectSummary } from "../../api";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { cn } from "../../lib/utils";

type Props = {
  project?: ProjectSummary;
  assets: AssetSummary[];
  onScanAssets: () => void;
  onRebuildAssetProvenance: () => void;
  onDeleteAssets: (relativePaths: string[]) => Promise<void>;
  onMoveAssets: (relativePaths: string[], targetFolder: string) => Promise<void>;
  onSelectAsset: (asset: AssetSummary) => void;
};

const assetTypes = ["all", "image", "video", "audio", "model3d", "other"];

const typeIcons: Record<string, React.ElementType> = {
  "image": FileImage,
  "video": FileVideo,
  "audio": FileAudio,
  "model3d": FileBox,
  "other": File,
};

export function AssetHub({ project, assets, onScanAssets, onRebuildAssetProvenance, onDeleteAssets, onMoveAssets, onSelectAsset }: Props) {
  const [view, setView] = useState<"grid" | "table">("grid");
  const [type, setType] = useState("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "linked" | "unlinked">("all");
  const [query, setQuery] = useState("");
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [targetFolder, setTargetFolder] = useState("assets/image/maker_plus");
  
  const filteredAssets = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return assets.filter((asset) => {
      if (type !== "all" && asset.assetType !== type) return false;
      if (sourceFilter === "linked" && (asset.provenance?.length ?? 0) === 0) return false;
      if (sourceFilter === "unlinked" && (asset.provenance?.length ?? 0) > 0) return false;
      if (!needle) return true;
      return asset.fileName.toLowerCase().includes(needle) || asset.relativePath.toLowerCase().includes(needle);
    });
  }, [assets, query, sourceFilter, type]);
  
  const counts = assetTypes.reduce<Record<string, number>>((acc, next) => {
    acc[next] = next === "all" ? assets.length : assets.filter((asset) => asset.assetType === next).length;
    return acc;
  }, {});

  const selectedSet = useMemo(() => new Set(selectedPaths), [selectedPaths]);
  const canOperate = selectedPaths.length > 0 && !!project;
  const linkedCount = assets.filter((asset) => (asset.provenance?.length ?? 0) > 0).length;

  function toggleAsset(asset: AssetSummary) {
    setSelectedPaths((current) => current.includes(asset.relativePath) ? current.filter((path) => path !== asset.relativePath) : [...current, asset.relativePath]);
  }

  async function deleteSelected() {
    if (!canOperate) return;
    await onDeleteAssets(selectedPaths);
    setSelectedPaths([]);
  }

  async function moveSelected() {
    if (!canOperate) return;
    await onMoveAssets(selectedPaths, targetFolder);
    setSelectedPaths([]);
  }

  return (
    <section className="flex flex-col p-4 md:p-6 max-w-[1600px] mx-auto min-h-0 w-full h-full bg-surface-app text-text gap-4">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 mb-2">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-text-muted" />
            基础资产库
          </h1>
        </div>
      </div>

      {/* Advanced Action Bar */}
      <div className="relative flex items-center justify-between p-2 bg-surface-panel border border-border rounded-lg shadow-sm shrink-0 min-h-[52px]">
        
        <AnimatePresence mode="wait">
          {selectedPaths.length > 0 ? (
            <motion.div 
              key="bulk-actions"
              initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.15 }}
              className="flex w-full items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setSelectedPaths([])} className="p-1.5 hover:bg-surface-raised rounded-md text-text-subtle hover:text-text transition-colors">
                  <X className="w-4 h-4" />
                </button>
                <span className="text-xs font-bold text-brand-strong bg-brand/10 px-2 py-1 rounded-md">
                  已选 {selectedPaths.length} 个项目
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Input value={targetFolder} onChange={(event) => setTargetFolder(event.target.value)} className="h-8 w-48 text-xs" placeholder="目标文件夹..." />
                <Button variant="outline" size="sm" disabled={!canOperate} onClick={moveSelected} className="h-8 gap-1.5 text-xs">
                  <MoveRight className="w-3 h-3" /> 移动
                </Button>
                <Button variant="outline" size="sm" disabled={!canOperate} onClick={deleteSelected} className="h-8 gap-1.5 text-xs text-[#b03939] hover:text-[#b03939] border-border hover:border-[#b03939]/30 hover:bg-[#b03939]/10">
                  <Trash2 className="w-3 h-3" /> 删除
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="filters"
              initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.15 }}
              className="flex w-full items-center justify-between gap-4"
            >
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
                {assetTypes.map((nextType) => (
                  <button 
                    key={nextType} 
                    type="button" 
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200",
                      type === nextType ? "bg-brand/10 text-brand-strong" : "text-text-muted hover:text-text hover:bg-surface-raised"
                    )}
                    onClick={() => setType(nextType)}
                  >
                    <span className="capitalize">{nextType}</span>
                    <span className={cn(
                      "px-1.5 py-0.5 rounded text-[9px] font-mono",
                      type === nextType ? "bg-brand/20 text-brand-strong" : "bg-surface-muted text-text-subtle"
                    )}>
                      {counts[nextType]}
                    </span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-0.5 p-0.5 bg-surface-muted border border-border-soft rounded-md shrink-0">
                  {["all", "linked", "unlinked"].map((option) => (
                    <button key={option} type="button" className={cn("px-2 py-1 rounded-[4px] text-[10px] font-bold transition-colors", sourceFilter === option ? "bg-surface-panel text-text shadow-sm" : "text-text-muted hover:text-text")} onClick={() => setSourceFilter(option as typeof sourceFilter)}>
                      {option === "all" ? "全部来源" : option === "linked" ? `已关联 ${linkedCount}` : "未关联"}
                    </button>
                  ))}
                </div>
                <div className="relative w-48 xl:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-subtle" />
                  <Input 
                    value={query} 
                    placeholder="搜索文件..." 
                    onChange={(event) => setQuery(event.target.value)} 
                    className="pl-8 h-8 text-xs bg-surface-muted/30"
                  />
                </div>
                <div className="w-[1px] h-4 bg-border mx-1" />
                <div className="flex items-center gap-0.5 p-0.5 bg-surface-muted border border-border-soft rounded-md shrink-0">
                  <button type="button" title="网格视图" className={cn("p-1.5 rounded-[4px] transition-colors", view === "grid" ? "bg-surface-panel shadow-sm text-text" : "text-text-muted hover:text-text")} onClick={() => setView("grid")}>
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" title="列表视图" className={cn("p-1.5 rounded-[4px] transition-colors", view === "table" ? "bg-surface-panel shadow-sm text-text" : "text-text-muted hover:text-text")} onClick={() => setView("table")}>
                    <List className="w-3.5 h-3.5" />
                  </button>
                </div>
                <Button variant="ghost" size="icon" onClick={onScanAssets} disabled={!project} className="w-8 h-8 rounded-md hover:bg-surface-raised" title="刷新资产">
                  <RefreshCw className="w-4 h-4 text-text-muted" />
                </Button>
                <Button variant="ghost" size="icon" onClick={onRebuildAssetProvenance} disabled={!project} className="w-8 h-8 rounded-md hover:bg-surface-raised" title="重建来源索引">
                  <GitBranch className="w-4 h-4 text-text-muted" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin rounded-lg border border-border bg-surface-panel shadow-sm relative">
        <AnimatePresence mode="wait">
          <motion.div 
            key={view + type + query}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="min-h-full"
          >
            {view === "grid" ? <AssetGrid assets={filteredAssets} selectedSet={selectedSet} onToggleAsset={toggleAsset} onSelectAsset={onSelectAsset} /> : <AssetTable assets={filteredAssets} selectedSet={selectedSet} onToggleAsset={toggleAsset} onSelectAsset={onSelectAsset} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

function AssetGrid({ assets, selectedSet, onToggleAsset, onSelectAsset }: { assets: AssetSummary[]; selectedSet: Set<string>; onToggleAsset: (asset: AssetSummary) => void; onSelectAsset: (asset: AssetSummary) => void }) {
  if (assets.length === 0) return <EmptyState />;
  
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3 p-4 content-start">
      {assets.map((asset) => {
        const isSelected = selectedSet.has(asset.relativePath);
        const Icon = typeIcons[asset.assetType] || File;
        return (
          <div 
            key={asset.id} 
            className={cn(
              "group relative flex flex-col cursor-pointer rounded-lg border transition-all duration-200 overflow-hidden bg-surface-panel",
              isSelected ? "border-brand ring-1 ring-brand/50 shadow-[0_2px_8px_rgba(0,217,197,0.15)]" : "border-border hover:border-border-strong hover:shadow-sm"
            )}
          >
            <label className={cn(
              "absolute left-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded bg-surface-panel/90 border shadow-sm cursor-pointer transition-opacity backdrop-blur-sm",
              isSelected ? "opacity-100 border-brand" : "opacity-0 group-hover:opacity-100 border-border hover:border-brand"
            )}>
              {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-brand" />}
              <input type="checkbox" className="sr-only" checked={isSelected} onChange={() => onToggleAsset(asset)} />
            </label>

            <button type="button" className="flex flex-col text-left w-full h-full" onClick={() => onSelectAsset(asset)}>
              <div className="w-full aspect-square bg-surface-muted relative border-b border-border-soft overflow-hidden flex items-center justify-center">
                {asset.assetType === "image" ? (
                  <img src={assetPreviewUrl(asset.projectId, asset.relativePath)} alt={asset.fileName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-surface-raised to-surface-muted group-hover:to-surface-panel transition-all">
                    <Icon className="w-8 h-8 text-text-muted opacity-40 group-hover:opacity-80 group-hover:text-brand transition-all" />
                    <span className="text-[9px] font-bold text-text-subtle tracking-widest uppercase opacity-40 group-hover:opacity-100 transition-opacity">{asset.assetType}</span>
                  </div>
                )}
              </div>
              <div className="p-2 flex flex-col gap-0.5 min-w-0 bg-surface-panel group-hover:bg-surface-raised transition-colors flex-1">
                <span className="text-[11px] font-medium text-text truncate leading-tight" title={asset.fileName}>{asset.fileName}</span>
                <span className="text-[9px] text-text-subtle truncate opacity-70" title={asset.relativePath}>{asset.relativePath.split(/[/\\]/).slice(0, -1).join('/') || '/'}</span>
                <div className="mt-1 flex items-center gap-1.5">
                  <SourceBadge count={asset.provenance?.length ?? 0} />
                  {asset.provenance?.[0]?.toolName ? <span className="truncate text-[9px] text-text-subtle">{asset.provenance[0].toolName}</span> : null}
                </div>
              </div>
            </button>
          </div>
        );
      })}
    </div>
  );
}

function AssetTable({ assets, selectedSet, onToggleAsset, onSelectAsset }: { assets: AssetSummary[]; selectedSet: Set<string>; onToggleAsset: (asset: AssetSummary) => void; onSelectAsset: (asset: AssetSummary) => void }) {
  const columnHelper = createColumnHelper<AssetSummary>();
  const columns = useMemo(() => [
    columnHelper.display({
      id: "select",
      header: "",
      cell: ({ row }) => {
        const asset = row.original;
        const isSelected = selectedSet.has(asset.relativePath);
        return (
          <label className="flex items-center cursor-pointer">
            <div className={cn("flex h-4 w-4 items-center justify-center rounded border transition-colors", isSelected ? "bg-brand border-brand text-surface-app" : "border-border-soft group-hover:border-brand/50 bg-surface-panel")}>
              {isSelected && <CheckCircle2 className="w-3 h-3" />}
            </div>
            <input type="checkbox" className="sr-only" checked={isSelected} onChange={() => onToggleAsset(asset)} />
          </label>
        );
      }
    }),
    columnHelper.accessor("fileName", {
      header: "Name",
      cell: ({ row, getValue }) => {
        const asset = row.original;
        const Icon = typeIcons[asset.assetType] || File;
        const isSelected = selectedSet.has(asset.relativePath);
        return (
          <button type="button" className="flex w-full items-center gap-2.5 text-left" onClick={() => onSelectAsset(asset)}>
            <Icon className={cn("w-4 h-4 shrink-0", isSelected ? "text-brand" : "text-text-muted")} />
            <span className={cn("truncate text-[12px]", isSelected ? "text-brand-strong font-semibold" : "text-text font-medium")}>{getValue()}</span>
          </button>
        );
      }
    }),
    columnHelper.accessor("relativePath", {
      header: "Path",
      cell: ({ getValue }) => <span className="block truncate text-[11px] text-text-subtle opacity-70">{getValue().split(/[/\\]/).slice(0, -1).join("/") || "/"}</span>
    }),
    columnHelper.accessor("assetType", {
      header: "Type",
      cell: ({ getValue }) => <span className="text-[10px] font-mono text-text-muted capitalize">{getValue()}</span>
    }),
    columnHelper.accessor("sizeBytes", {
      header: "Size",
      cell: ({ getValue }) => <span className="block text-right text-[10px] font-mono text-text-muted">{Math.max(1, Math.round(getValue() / 1024))} KB</span>
    }),
    columnHelper.display({
      id: "provenance",
      header: "Source",
      cell: ({ row }) => <SourceBadge count={row.original.provenance?.length ?? 0} />
    })
  ], [columnHelper, onSelectAsset, onToggleAsset, selectedSet]);
  const table = useReactTable({ data: assets, columns, getCoreRowModel: getCoreRowModel() });
  if (assets.length === 0) return <EmptyState />;

  return (
    <div className="flex flex-col w-full text-left bg-surface-panel">
      <div className="flex items-center px-4 py-2 border-b border-border bg-surface-muted/30 text-[10px] uppercase tracking-widest text-text-subtle font-bold sticky top-0 z-10 backdrop-blur-md">
        {table.getHeaderGroups()[0]?.headers.map((header) => (
          <div key={header.id} className={cn(header.id === "select" ? "w-8 shrink-0" : header.id === "relativePath" ? "w-48 xl:w-64 shrink-0 px-2" : header.id === "assetType" ? "w-24 shrink-0 px-2" : header.id === "sizeBytes" || header.id === "provenance" ? "w-28 shrink-0 text-right px-2" : "flex-1 min-w-0 pr-4")}> 
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
              className={cn(
                "group flex items-center px-4 py-1.5 border-b border-border-soft hover:bg-surface-raised transition-colors text-left",
                isSelected ? "bg-brand/5 border-brand/20" : "bg-transparent"
              )}
            >
              {row.getVisibleCells().map((cell) => (
                <div key={cell.id} className={cn(cell.column.id === "select" ? "w-8 shrink-0" : cell.column.id === "relativePath" ? "w-48 xl:w-64 shrink-0 px-2" : cell.column.id === "assetType" ? "w-24 shrink-0 px-2" : cell.column.id === "sizeBytes" || cell.column.id === "provenance" ? "w-28 shrink-0 px-2" : "flex-1 min-w-0 pr-4")}> 
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
    <div className="h-full flex flex-col items-center justify-center gap-4 text-text-muted p-12 min-h-[400px]">
      <div className="w-16 h-16 rounded-2xl bg-surface-muted/50 border border-border-soft flex items-center justify-center shadow-sm">
        <FolderOpen className="w-8 h-8 opacity-40 text-text" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-text m-0">文件夹为空</p>
        <p className="text-xs text-text-subtle m-0 mt-1.5">没有找到匹配的资产，请尝试更换筛选条件或扫描目录。</p>
      </div>
    </div>
  );
}

function SourceBadge({ count }: { count: number }) {
  return (
    <span className={cn("inline-flex items-center rounded-pill px-1.5 py-0.5 text-[9px] font-bold", count > 0 ? "bg-brand/10 text-brand-strong" : "bg-surface-muted text-text-subtle") }>
      {count > 0 ? `${count} src` : "no src"}
    </span>
  );
}
