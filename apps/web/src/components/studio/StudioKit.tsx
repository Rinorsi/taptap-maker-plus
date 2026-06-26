import { type ReactNode, useState } from "react";
import { Check, ImagePlus, Search, Trash2, X } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Label } from "../ui/Label";
import { SelectField } from "../ui/SelectField";
import { AssetDropzone } from "../interaction/AssetDropzone";
import { readAssetDragData } from "../interaction/assetDragData";
import { cn } from "../../lib/utils";

export type StudioOption = {
  value: string;
  label: string;
};

export function StudioHeader({
  icon,
  eyebrow,
  title,
  projectName,
  actions,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  projectName?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex shrink-0 flex-col items-start justify-between gap-4 md:flex-row md:items-center">
      <div className="min-w-0">
        <span className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-text-subtle">
          {icon}
          {eyebrow}
        </span>
        <h1 className="m-0 truncate text-xl font-extrabold text-text md:text-2xl">{title}</h1>
        <p className="mt-1 max-w-xl truncate text-xs text-text-muted">
          {projectName ? `当前项目：${projectName}` : "请先选择项目"}
        </p>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}

export function StudioSelectField({
  label,
  value,
  onChange,
  options,
  id = label,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: StudioOption[];
  id?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-[13px] font-bold text-text">{label}</Label>
      <SelectField id={id} value={value} onChange={onChange} options={options} ariaLabel={label} />
    </div>
  );
}

export function StudioPromptField({
  id,
  label,
  value,
  onChange,
  placeholder,
  required,
  meta,
  minHeightClass = "min-h-[140px]",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
  meta?: ReactNode;
  minHeightClass?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="flex items-center justify-between text-xs font-bold text-text-muted">
        <span>{label}</span>
        <span className="flex items-center gap-2">
          {meta}
          {required ? <span className="rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-bold text-brand">必填</span> : null}
        </span>
      </Label>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full resize-y rounded-2xl border border-transparent bg-surface-panel px-4 py-3 text-[13px] shadow-sm transition-all placeholder:text-text-subtle focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10",
          minHeightClass
        )}
      />
    </div>
  );
}

export function StudioSearchInput({
  value,
  onChange,
  placeholder = "搜索文件...",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative w-[120px] md:w-[150px] lg:w-[180px]", className)}>
      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-subtle" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-8 rounded-full border-border-soft bg-surface-app pl-8 text-xs transition-all focus:border-brand/50"
      />
    </div>
  );
}

export function StudioSelectionActionBar({
  selectedCount,
  busy,
  onDelete,
  onClear,
}: {
  selectedCount: number;
  busy?: boolean;
  onDelete: () => void;
  onClear: () => void;
}) {
  if (selectedCount <= 0) return null;
  return (
    <div className="relative z-10 flex shrink-0 flex-nowrap items-center justify-between gap-3 border-b border-border bg-surface-raised px-4 py-2 text-xs shadow-sm">
      <div className="flex min-w-0 items-center gap-2 text-text">
        <span className="shrink-0 rounded bg-brand/10 px-2 py-0.5 font-bold text-brand-strong">已选 {selectedCount} 项</span>
      </div>
      <div className="flex shrink-0 flex-nowrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={onDelete} disabled={!selectedCount || busy} className="shrink-0 gap-1.5 text-red-400 hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-500">
          <Trash2 className="h-3.5 w-3.5" />
          删除
        </Button>
        <Button variant="ghost" size="sm" onClick={onClear} className="shrink-0 gap-1.5">
          <X className="h-3.5 w-3.5" />
          取消
        </Button>
      </div>
    </div>
  );
}

export function StudioModeButton({
  active,
  onClick,
  icon,
  children,
  layoutId = "studio-mode-bg",
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
  layoutId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-bold transition-all",
        active ? "text-text shadow-sm" : "text-text-subtle hover:bg-surface-raised hover:text-text"
      )}
    >
      {active && <motion.div layoutId={layoutId} className="absolute inset-0 rounded-full border border-border-soft bg-surface-app shadow" />}
      <span className="relative z-10 flex items-center gap-2">{icon}{children}</span>
    </button>
  );
}

export function StudioMediaDropzone({
  image,
  onChange,
  height = "h-32",
  onPickClick,
  accept = "image/*",
  onImportFiles,
  onAssetDrop,
  emptyLabel = "将图片拖拽至此",
  emptySubLabel = "或点击拾取",
}: {
  image: string;
  onChange: (image: string) => void;
  height?: string;
  onPickClick?: () => void;
  accept?: string;
  onImportFiles?: (files: File[]) => void;
  onAssetDrop?: (asset: { relativePath: string; projectId?: string; fileName?: string; assetType?: string }) => void;
  emptyLabel?: string;
  emptySubLabel?: string;
}) {
  const [localDragActive, setLocalDragActive] = useState(false);

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setLocalDragActive(false);

    const asset = readAssetDragData(event.dataTransfer);
    if (asset) {
      onAssetDrop?.(asset);
      onChange(asset.relativePath);
      return;
    }

    const files = Array.from(event.dataTransfer.files ?? []);
    if (files.length > 0) onImportFiles?.(files);
  }

  return (
    <AssetDropzone accept={accept} disabled={false} onDropFiles={(files) => onImportFiles?.(files)}>
      {({ getRootProps, getInputProps, isDragActive }) => (
        <div
          {...getRootProps({
            onDragOverCapture: (event) => {
              event.preventDefault();
              event.stopPropagation();
              setLocalDragActive(true);
            },
            onDropCapture: handleDrop,
            onDragOver: (event) => {
              event.preventDefault();
              event.stopPropagation();
              setLocalDragActive(true);
            },
            onDragEnter: (event) => {
              event.preventDefault();
              event.stopPropagation();
              setLocalDragActive(true);
            },
            onDragLeave: (event) => {
              event.preventDefault();
              event.stopPropagation();
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setLocalDragActive(false);
              }
            },
            onDrop: handleDrop,
            className: cn(
              height,
              "group relative flex min-h-24 flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 border-dashed text-xs transition-all duration-300",
              image ? "border-brand/50 bg-brand/5" : "cursor-pointer border-border-strong text-text-muted hover:border-brand/50 hover:bg-brand/5",
              (isDragActive || localDragActive) && "border-brand/70 bg-brand/10"
            )
          })}
        >
          <input {...getInputProps()} />
          {image ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface-panel p-2">
              <img src={image} className="max-h-full max-w-full rounded-xl object-contain shadow-lg" />
            </div>
          ) : (
            <>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-panel shadow-sm transition-transform duration-300 group-hover:scale-110">
                <ImagePlus className="h-5 w-5 text-brand" />
              </div>
              <span className="px-2 text-center text-[10px] font-medium text-text-subtle">
                {emptyLabel}
                <br />
                {emptySubLabel}
              </span>
            </>
          )}
          {!image && (
            <button type="button" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" onClick={onPickClick} title="拾取素材" />
          )}
          {image && (
            <button
              type="button"
              className="absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded bg-black/50 text-white transition-colors hover:bg-red-500"
              onClick={(event) => {
                event.stopPropagation();
                onChange("");
              }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </AssetDropzone>
  );
}

export function StatusBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "brand" | "success" | "warning" | "danger" | "muted" }) {
  const tones = {
    neutral: "border-border-soft bg-surface-raised text-text-muted",
    brand: "border-brand/20 bg-brand/10 text-brand-strong",
    success: "border-green-500/20 bg-green-500/10 text-green-600",
    warning: "border-amber-500/20 bg-amber-500/10 text-amber-600",
    danger: "border-red-500/20 bg-red-500/10 text-red-600",
    muted: "border-border-soft bg-surface-muted text-text-subtle",
  };
  return <span className={cn("shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-bold", tones[tone])}>{children}</span>;
}

export function FileTypeChips({
  items,
  missing = [],
  limit = 7,
  pathsByType = {},
}: {
  items: { type: string; count: number }[];
  missing?: string[];
  limit?: number;
  pathsByType?: Record<string, string[]>;
}) {
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {items.slice(0, limit).map((item) => {
        const paths = pathsByType[item.type] ?? [];
        const title = paths.length > 0 ? paths.join("\n") : undefined;
        return (
        <button
          key={item.type}
          type="button"
          title={title}
          onClick={(event) => {
            if (paths.length === 0) return;
            event.stopPropagation();
            navigator.clipboard.writeText(paths.join("\n")).catch(() => undefined);
          }}
          className={cn(
            "rounded border border-border-soft bg-surface-raised px-1.5 py-0.5 text-[9px] font-bold text-text-muted transition-colors",
            paths.length > 0 && "cursor-copy hover:border-brand/40 hover:bg-brand/10 hover:text-brand"
          )}
        >
          {item.type}{item.count > 1 ? ` ${item.count}` : ""}
        </button>
      );})}
      {missing.length > 0 && <StatusBadge tone="danger">缺 {missing.join("/")}</StatusBadge>}
    </div>
  );
}

export function SelectionBox({
  selected,
  onClick,
  title,
}: {
  selected: boolean;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
        selected ? "border-brand bg-brand text-[#04202a]" : "border-border-strong bg-surface-panel hover:border-brand"
      )}
      title={title}
    >
      {selected && <Check className="h-3 w-3" />}
    </button>
  );
}

export type BulkAction = {
  id: string;
  label: string;
  tone?: "default" | "warning" | "danger";
  onClick: () => void;
};

export function StudioBulkActionBar({
  selectedCount,
  allSelected,
  onSelectAll,
  onInvertSelection,
  onClear,
  actions,
  showSelectionRow = true,
}: {
  selectedCount: number;
  allSelected: boolean;
  onSelectAll: () => void;
  onInvertSelection?: () => void;
  onClear: () => void;
  actions: BulkAction[];
  showSelectionRow?: boolean;
}) {
  return (
    <div className="mt-3">
      {showSelectionRow && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button type="button" onClick={allSelected ? onClear : onSelectAll} className="text-[11px] font-semibold text-text-muted transition-colors hover:text-brand">
              {allSelected ? "清空" : "全选"}
            </button>
            {onInvertSelection ? (
              <button type="button" onClick={onInvertSelection} className="text-[11px] font-semibold text-text-muted transition-colors hover:text-brand">
                反选
              </button>
            ) : null}
          </div>
          <span className="text-[11px] text-text-subtle">已选 {selectedCount}</span>
        </div>
      )}
      {selectedCount > 0 && (
        <div className={cn("flex flex-wrap gap-1.5", showSelectionRow && "mt-2")}>
          {actions.map((action) => (
            <Button
              key={action.id}
              size="sm"
              variant="secondary"
              className={cn(
                "h-6 px-2.5 text-[10px]",
                action.tone === "warning" && "bg-orange-500/10 text-orange-600 hover:bg-orange-500/20",
                action.tone === "danger" && "bg-red-500/10 text-red-600 hover:bg-red-500/20"
              )}
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
