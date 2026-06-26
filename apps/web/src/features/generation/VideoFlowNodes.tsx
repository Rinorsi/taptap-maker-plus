import React from "react";
import { Handle, Position, NodeResizer } from "@xyflow/react";
import {
  Trash2,
  AlertCircle,
  Play,
  Activity,
  ImagePlus,
  ImageIcon,
  Film,
  CornerDownRight,
  Table2,
} from "lucide-react";
import { getPresetById, NODE_PRESETS } from "./nodeRegistry";
import { cn } from "../../lib/utils";
import { assetPreviewUrl } from "../../api";
import { Button } from "../../components/ui/Button";
import { CanvasAudioPlayer } from "../../components/studio/CanvasAudioPlayer";
import { StudioSelectField } from "../../components/studio/StudioKit";
import { readAssetDragPath } from "./dragData";
import { describeAssetUse, type CanvasAssetReference, type CanvasMentionToken } from "../canvas-core";
import { MentionPromptEditor } from "./MentionPromptEditor";

type ResultAsset = {
  kind: string;
  role: string;
  path: string;
};

function fileNameFromPath(path: string) {
  return path.split(/[\\/]/).pop() || path;
}

function previewSrc(projectId: string | undefined, path: string) {
  if (/^https?:\/\//i.test(path) || path.startsWith("data:")) return path;
  return projectId ? assetPreviewUrl(projectId, path) : path;
}

function videoPreviewSrc(projectId: string | undefined, path: string) {
  const src = previewSrc(projectId, path);
  return src.includes("#") ? src : `${src}#t=0.1`;
}

function allowNodeSurfaceDrop(event: React.DragEvent<HTMLDivElement>) {
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isLongTextSettingType(type: unknown) {
  return type === "style" || type === "negativeTags";
}

const DeleteButton = ({
  onDelete,
  id,
  selected,
}: {
  onDelete?: (id: string) => void;
  id: string;
  selected?: boolean;
}) => {
  if (!selected) return null;
  return (
    <button
      onClick={() => onDelete?.(id)}
      className="absolute -top-3 -right-3 w-7 h-7 bg-surface-panel/90 backdrop-blur-md border border-red-500/50 rounded-full flex items-center justify-center text-red-500 hover:text-white hover:bg-red-500 hover:border-red-500 shadow-lg transition-all z-50 animate-in zoom-in-75 duration-200"
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  );
};

export function GenericTextNode({ data, id, selected }: any) {
  const preset = getPresetById(data.presetId);
  const Icon = preset?.icon;
  const collapsed = Boolean(data.collapsed);
  const references = (data.references || []) as CanvasAssetReference[];
  const brokenPromptReferences = (data.promptReferences || []).filter(
    (reference: any) => reference.promptNodeId === id && reference.broken,
  );
  const brokenNodeIds = new Set<string>(
    brokenPromptReferences.map((reference: any) => String(reference.nodeId)),
  );

  return (
    <div
      className="group w-full h-full min-w-[260px] min-h-[220px] relative flex"
      onDragOverCapture={allowNodeSurfaceDrop}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={260}
        minHeight={220}
        color="var(--color-brand)"
        handleStyle={{ width: 8, height: 8, borderRadius: 4 }}
      />
      <div className="flex-1 flex flex-col bg-surface-panel/80 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-3xl shadow-popover overflow-hidden transition-all duration-300 group-hover:shadow-[0_16px_48px_rgba(0,217,197,0.15)] group-hover:border-brand/40">
        <div className="bg-gradient-to-r from-brand/10 to-transparent p-3 flex items-center gap-2 border-b border-border-soft shrink-0">
          {Icon && <Icon className="w-4 h-4 text-brand" />}
          <span className="text-xs font-bold text-text">
            {preset?.label || "文本节点"}
          </span>
        </div>
        {!collapsed && (
          <div className="p-4 flex flex-col gap-3 flex-1 min-h-0">
            <MentionPromptEditor
              promptNodeId={id}
              text={String(data.text || "")}
              mentionTokens={(data.mentionTokens || []) as CanvasMentionToken[]}
              references={references}
              brokenNodeIds={brokenNodeIds}
              onFocusReference={data.onFocusReference}
              onChange={(nextText, nextTokens) => {
                data.onChange(id, "text", nextText);
                data.onChange(id, "mentionTokens", nextTokens);
              }}
            />
            {references.length > 0 && (
              <div className="flex max-h-16 shrink-0 flex-wrap gap-1.5 overflow-y-auto pr-1 scrollbar-thin">
                {references.map((reference) => (
                  <button
                    key={reference.nodeId}
                    type="button"
                    className="rounded-full border border-brand/25 bg-brand/10 px-2 py-1 text-[10px] font-bold text-brand hover:bg-brand/15"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      const insertion = `@${reference.alias} 作为${describeAssetUse(reference.use)}`;
                      const tokens = (data.mentionTokens || []) as CanvasMentionToken[];
                      const nextTokens = tokens.some((token) => token.nodeId === reference.nodeId)
                        ? tokens
                        : [
                            ...tokens,
                            {
                              id: `${id}-${reference.nodeId}`,
                              alias: reference.alias,
                              nodeId: reference.nodeId,
                              kind: reference.kind,
                              use: reference.use,
                            },
                          ];
                      const current = String(data.text || "");
                      data.onChange(id, "text", current ? `${current}，${insertion}` : insertion);
                      data.onChange(id, "mentionTokens", nextTokens);
                      data.onFocusReference?.(reference.nodeId);
                    }}
                    title={reference.relativePath || reference.fileName || reference.alias}
                  >
                    @{reference.alias}
                  </button>
                ))}
              </div>
            )}
            {brokenPromptReferences.length > 0 && (
              <div className="flex max-h-16 shrink-0 flex-col gap-1 overflow-y-auto rounded-lg border border-yellow-500/25 bg-yellow-500/10 p-2 pr-1 scrollbar-thin">
                {brokenPromptReferences.map((reference: any) => (
                  <button
                    key={reference.tokenId}
                    type="button"
                    className="flex items-center gap-1.5 text-left text-[10px] font-bold text-yellow-600"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      data.onFocusReference?.(reference.nodeId);
                    }}
                  >
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    <span className="truncate">@{reference.alias} 的素材节点已丢失</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!w-4 !h-4 !bg-surface-app !border-2 !border-brand transition-transform group-hover:scale-125 z-50 !-right-2"
      />
      <DeleteButton onDelete={data.onDelete} id={id} selected={selected} />
    </div>
  );
}

export function StoryboardTableNode({ data, id, selected }: any) {
  const columns = Array.isArray(data.columns) && data.columns.length > 0 ? data.columns.map(String) : ["内容"];
  const rows = Array.isArray(data.rows)
    ? data.rows.map((row: unknown) => (Array.isArray(row) ? row.map(String) : [String(row ?? "")]))
    : [];
  const sourceName = typeof data.sourceName === "string" ? data.sourceName : "当前片段分镜表";
  const collapsed = Boolean(data.collapsed);

  return (
    <div className="group w-full h-full min-w-[420px] min-h-[300px] relative flex">
      <NodeResizer
        isVisible={selected}
        minWidth={420}
        minHeight={300}
        color="var(--color-brand)"
        handleStyle={{ width: 8, height: 8, borderRadius: 4 }}
      />
      <div className="flex-1 flex flex-col bg-surface-panel/85 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-3xl shadow-popover overflow-hidden transition-all duration-300 group-hover:shadow-[0_16px_48px_rgba(0,217,197,0.15)] group-hover:border-brand/40">
        <div className="bg-gradient-to-r from-brand/10 to-transparent p-3 flex items-center justify-between gap-3 border-b border-border-soft shrink-0">
          <div className="flex min-w-0 items-center gap-2">
            <Table2 className="w-4 h-4 shrink-0 text-brand" />
            <span className="truncate text-xs font-bold text-text">当前片段分镜表</span>
          </div>
          <span className="shrink-0 rounded-full bg-surface-app px-2 py-0.5 text-[10px] font-bold text-text-subtle">
            {rows.length} 镜
          </span>
        </div>
        {!collapsed && (
          <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
            <div className="flex shrink-0 items-center justify-between gap-3">
              <input
                className="nodrag min-w-0 flex-1 rounded-lg border border-border-soft bg-surface-app px-2 py-1.5 text-xs font-bold text-text outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                value={sourceName}
                onPointerDown={(event) => event.stopPropagation()}
                onChange={(event) => data.onChange?.(id, "sourceName", event.target.value)}
                title={sourceName}
              />
              <span className="shrink-0 text-[10px] font-bold text-text-subtle">
                {columns.length} 列
              </span>
            </div>
            <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-border-soft bg-surface-app scrollbar-thin">
              <table className="min-w-full border-separate border-spacing-0 text-left text-[11px]">
                <thead className="sticky top-0 z-10 bg-surface-muted">
                  <tr>
                    {columns.map((column: string, index: number) => (
                      <th
                        key={`${column}-${index}`}
                        className="border-b border-border-soft px-2 py-1.5 font-black text-text-subtle whitespace-nowrap"
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row: string[], rowIndex: number) => (
                    <tr key={rowIndex} className="odd:bg-surface-panel/30">
                      {columns.map((_: string, columnIndex: number) => (
                        <td
                          key={`${rowIndex}-${columnIndex}`}
                          className="max-w-[240px] border-b border-border-soft/60 px-2 py-1.5 align-top text-text"
                        >
                          <span className="line-clamp-3 break-words">
                            {row[columnIndex] || "-"}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!w-4 !h-4 !bg-surface-app !border-2 !border-brand transition-transform group-hover:scale-125 z-50 !-right-2"
      />
      <DeleteButton onDelete={data.onDelete} id={id} selected={selected} />
    </div>
  );
}

export function GenericMediaNode({ data, id, selected }: any) {
  const preset = getPresetById(data.presetId);
  const Icon = preset?.icon;
  const collapsed = Boolean(data.collapsed);
  const isVideo = preset?.category === "video";
  const isAudio = preset?.category === "audio";
  const inboundPromptReferences = (data.promptReferences || []).filter(
    (reference: any) => reference.nodeId === id && !reference.broken,
  );
  const borderColor = isAudio
    ? "border-blue-500"
    : isVideo
      ? "border-purple-500"
      : "border-brand";
  const glowColor = isAudio
    ? "rgba(59,130,246,0.15)"
    : isVideo
      ? "rgba(168,85,247,0.15)"
      : "rgba(0,217,197,0.15)";

  return (
    <div
      className="group w-full h-full min-w-[260px] min-h-[230px] relative flex transition-transform duration-300 hover:-translate-y-1"
      onDragOverCapture={allowNodeSurfaceDrop}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={260}
        minHeight={230}
        color={isAudio ? "#3b82f6" : isVideo ? "#a855f7" : "var(--color-brand)"}
        handleStyle={{ width: 8, height: 8, borderRadius: 4 }}
      />
      <div
        className={cn(
          "flex-1 flex flex-col bg-surface-panel/80 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-3xl shadow-popover overflow-hidden transition-all duration-300",
          isAudio
            ? "hover:border-blue-500/40"
            : isVideo
              ? "hover:border-purple-500/40"
              : "hover:border-brand/40",
        )}
        style={{ boxShadow: `0 16px 48px ${glowColor}` }}
      >
        {collapsed && (
          <div className="bg-surface-panel p-3 flex items-center gap-2 shrink-0">
            {Icon && <Icon className="w-4 h-4 text-brand" />}
            <span className="text-xs font-bold text-text truncate">
              {preset?.label || "媒体节点"}
            </span>
          </div>
        )}
        {!collapsed && (
          <>
            <div className="relative flex-1 flex flex-col min-h-0">
              <div
                data-flow-media-dropzone
                className={`relative aspect-video w-full shrink-0 flex items-center justify-center bg-surface-app/50 overflow-hidden ${isAudio ? "bg-gradient-to-br from-blue-500/10 to-transparent flex-col gap-2" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.dataTransfer.dropEffect = "copy";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    const file = e.dataTransfer.files[0];
                    if (
                      file.type.startsWith("image/") ||
                      file.type.startsWith("video/") ||
                      file.type.startsWith("audio/")
                    ) {
                      if (data.onOSFileDrop) data.onOSFileDrop(id, file);
                      return;
                    }
                  }
                  const relPath = readAssetDragPath(e.dataTransfer);
                  if (relPath && data.onAssetDrop) {
                    data.onAssetDrop(id, relPath);
                  }
                }}
              >
                {!data.url ? (
                  <div className="flex flex-col items-center justify-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                    <ImagePlus className="w-6 h-6 text-brand/70" />
                    <span className="text-[10px] font-medium text-text-subtle">
                      拖拽素材至此
                    </span>
                  </div>
                ) : isAudio ? (
                  <div className="relative flex h-full w-full flex-col items-center justify-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-surface-app shadow-inner flex items-center justify-center">
                      {Icon && <Icon className="w-5 h-5 text-blue-500" />}
                    </div>
                    <span
                      className="text-[10px] font-medium text-text-subtle truncate max-w-[80%] text-center"
                      title={data.fileName}
                    >
                      {data.fileName}
                    </span>
                    <button
                      type="button"
                      className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={(event) => {
                        event.stopPropagation();
                        data.onPreviewMedia?.({
                          assetType: "audio",
                          fileName: data.fileName || "音频参考",
                          relativePath: data.relativePath,
                          url: data.url,
                        });
                      }}
                      title="播放音频"
                    >
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/65 text-white shadow-xl backdrop-blur-sm transition-transform hover:scale-105 active:scale-95">
                        <Play className="ml-0.5 h-5 w-5 fill-current" />
                      </span>
                    </button>
                  </div>
                ) : isVideo ? (
                  <div className="relative h-full w-full">
                    <video
                      src={data.url}
                      className="absolute inset-0 h-full w-full object-contain opacity-90 group-hover:opacity-100 transition-opacity"
                      preload="metadata"
                      muted
                      playsInline
                    />
                    <button
                      type="button"
                      className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={(event) => {
                        event.stopPropagation();
                        data.onPreviewMedia?.({
                          assetType: "video",
                          fileName: data.fileName || "视频参考",
                          relativePath: data.relativePath,
                          url: data.url,
                        });
                      }}
                      title="播放视频"
                    >
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/65 text-white shadow-xl backdrop-blur-sm transition-transform hover:scale-105 active:scale-95">
                        <Play className="ml-0.5 h-5 w-5 fill-current" />
                      </span>
                    </button>
                  </div>
                ) : (
                  <div className="relative h-full w-full">
                    <img
                      src={data.url}
                      alt="Image Ref"
                      draggable={false}
                      className="absolute inset-0 h-full w-full object-contain opacity-90 group-hover:opacity-100 transition-opacity"
                    />
                    <button
                      type="button"
                      className="absolute inset-0 flex items-center justify-center bg-black/10 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={(event) => {
                        event.stopPropagation();
                        data.onPreviewMedia?.({
                          assetType: "image",
                          fileName: data.fileName || "图片参考",
                          relativePath: data.relativePath,
                          url: data.url,
                        });
                      }}
                      title="预览图片"
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white shadow-xl backdrop-blur-sm transition-transform hover:scale-105 active:scale-95">
                        <ImageIcon className="h-4 w-4" />
                      </span>
                    </button>
                  </div>
                )}
              </div>
              {!isAudio && data.url && (
                <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-white flex items-center gap-1">
                  {Icon && (
                    <Icon
                      className={`w-3 h-3 ${isVideo ? "text-purple-400" : ""}`}
                    />
                  )}
                </div>
              )}
            </div>
            <div className="p-3 border-t border-border-soft bg-surface-panel flex flex-col gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <input
                  className="nodrag min-w-0 flex-1 rounded-lg border border-border-soft bg-surface-app px-2 py-1.5 text-xs font-bold text-text outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                  value={data.fileName || ""}
                  placeholder="素材名称"
                  onPointerDown={(event) => event.stopPropagation()}
                  onChange={(event) => data.onChange(id, "fileName", event.target.value)}
                  title={data.relativePath || data.fileName}
                />
                <input
                  className="nodrag w-20 rounded-lg border border-border-soft bg-surface-app px-2 py-1.5 text-xs font-black text-brand outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                  value={data.alias || ""}
                  placeholder="图1"
                  onPointerDown={(event) => event.stopPropagation()}
                  onChange={(event) => data.onChange(id, "alias", event.target.value)}
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-black text-brand">
                  @{data.alias || "未命名"}
                </span>
                <span className="rounded-full bg-surface-app px-2 py-0.5 text-[10px] font-bold text-text-subtle">
                  {describeAssetUse(data.referenceUse || data.role || "generic")}
                </span>
              </div>
              <StudioSelectField
                id={`field-${id}-preset`}
                label="参考类型"
                value={data.presetId}
                onChange={(val: string) => data.onChange(id, "presetId", val)}
                options={NODE_PRESETS.filter(
                  (p) => p.category === preset?.category,
                ).map((p) => ({ value: p.id, label: p.label }))}
              />
              {inboundPromptReferences.length > 0 && (
                <div className="flex max-h-16 flex-col gap-1 overflow-y-auto rounded-lg border border-border-soft bg-surface-app p-1.5 pr-1 scrollbar-thin">
                  {inboundPromptReferences.map((reference: any) => (
                    <button
                      key={`${reference.promptNodeId}-${reference.tokenId}`}
                      type="button"
                      className="flex items-center gap-1.5 rounded px-1 py-0.5 text-left text-[10px] text-text-subtle hover:bg-surface-raised hover:text-brand"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        data.onFocusReference?.(reference.promptNodeId);
                      }}
                    >
                      <CornerDownRight className="h-3 w-3 shrink-0" />
                      <span className="truncate">被提示词 @{reference.alias} 引用</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className={`!w-4 !h-4 !bg-surface-app !border-2 !${borderColor} transition-transform group-hover:scale-125 z-50 !-right-2`}
      />
      <DeleteButton onDelete={data.onDelete} id={id} selected={selected} />
    </div>
  );
}

export function GenericSettingsNode({ data, id, selected }: any) {
  const preset = getPresetById(data.presetId);
  const Icon = preset?.icon;
  const collapsed = Boolean(data.collapsed);

  const renderInput = () => {
    if (data.type === "mode")
      return (
        <StudioSelectField
          id={`field-${id}-mode`}
          label="生成模式 (Mode)"
          value={data.value}
          onChange={(val: string) => data.onChange(id, "value", val)}
          options={[
            { value: "text_to_video", label: "文生视频" },
            { value: "first_frame", label: "首帧生成" },
            { value: "first_last_frame", label: "首尾帧" },
            { value: "multi_modal_reference", label: "多模态参考" },
          ]}
        />
      );
    if (data.type === "ratio")
      return (
        <StudioSelectField
          id={`field-${id}-ratio`}
          label="比例 (Ratio)"
          value={data.value}
          onChange={(val: string) => data.onChange(id, "value", val)}
          options={[
            { value: "16:9", label: "16:9" },
            { value: "4:3", label: "4:3" },
            { value: "9:16", label: "9:16" },
            { value: "1:1", label: "1:1" },
            { value: "3:4", label: "3:4" },
            { value: "21:9", label: "21:9" },
            { value: "adaptive", label: "adaptive" },
          ]}
        />
      );
    if (data.type === "resolution" && data.presetId === "ImageResolutionNode")
      return (
        <StudioSelectField
          id={`field-${id}-image-resolution`}
          label="图片精度 (resolution)"
          value={data.value}
          onChange={(val: string) => data.onChange(id, "value", val)}
          options={[
            { value: "0.5K", label: "0.5K" },
            { value: "1K", label: "1K" },
            { value: "2K", label: "2K" },
            { value: "4K", label: "4K" },
          ]}
        />
      );
    if (data.type === "resolution")
      return (
        <StudioSelectField
          id={`field-${id}-resolution`}
          label="分辨率 (Resolution)"
          value={data.value}
          onChange={(val: string) => data.onChange(id, "value", val)}
          options={[
            { value: "720p", label: "720p" },
            { value: "480p", label: "480p" },
          ]}
        />
      );
    if (data.type === "duration")
      return (
        <StudioSelectField
          id={`field-${id}-duration`}
          label="时长 (Duration)"
          value={String(data.value)}
          onChange={(val: string) => data.onChange(id, "value", val)}
          options={[
            { value: "4", label: "4s" },
            { value: "5", label: "5s" },
            { value: "6", label: "6s" },
            { value: "8", label: "8s" },
            { value: "10", label: "10s" },
            { value: "15", label: "15s" },
            { value: "-1", label: "自动" },
          ]}
        />
      );
    if (data.type === "model" && data.presetId === "ImageModelNode")
      return (
        <StudioSelectField
          id={`field-${id}-image-model`}
          label="图片模型 (model)"
          value={data.value}
          onChange={(val: string) => data.onChange(id, "value", val)}
          options={[
            { value: "", label: "自动选择" },
            { value: "nanobanana", label: "nanobanana" },
            { value: "gpt", label: "gpt" },
          ]}
        />
      );
    if (data.type === "model" && data.presetId === "MusicModelNode")
      return (
        <StudioSelectField
          id={`field-${id}-music-model`}
          label="音乐模型 (model)"
          value={data.value}
          onChange={(val: string) => data.onChange(id, "value", val)}
          options={[
            { value: "V3_5", label: "V3_5" },
            { value: "V4", label: "V4" },
            { value: "V4_5", label: "V4_5" },
            { value: "V4_5PLUS", label: "V4_5PLUS" },
            { value: "V5", label: "V5" },
          ]}
        />
      );
    if (data.type === "model")
      return (
        <StudioSelectField
          id={`field-${id}-model`}
          label="模型 (Model)"
          value={data.value}
          onChange={(val: string) => data.onChange(id, "value", val)}
          options={[
            { value: "default", label: "默认" },
            { value: "fast", label: "极速" },
          ]}
        />
      );
    if (data.type === "generate_audio")
      return (
        <StudioSelectField
          id={`field-${id}-generate-audio`}
          label="生成音频 (GenAudio)"
          value={String(data.value)}
          onChange={(val: string) => data.onChange(id, "value", val)}
          options={[
            { value: "false", label: "否" },
            { value: "true", label: "是" },
          ]}
        />
      );
    if (data.type === "return_last_frame")
      return (
        <StudioSelectField
          id={`field-${id}-return-last-frame`}
          label="返回尾帧 (LastFrame)"
          value={String(data.value)}
          onChange={(val: string) => data.onChange(id, "value", val)}
          options={[
            { value: "false", label: "否" },
            { value: "true", label: "是" },
          ]}
        />
      );
    if (data.type === "enable_web_search")
      return (
        <StudioSelectField
          id={`field-${id}-enable-web-search`}
          label="联网增强 (WebSearch)"
          value={String(data.value)}
          onChange={(val: string) => data.onChange(id, "value", val)}
          options={[
            { value: "false", label: "否" },
            { value: "true", label: "是" },
          ]}
        />
      );
    if (data.type === "execution_expires_after")
      return (
        <input
          type="number"
          min={3600}
          max={259200}
          step={1}
          className="w-full h-8 px-3 text-[13px] bg-surface-app rounded-lg border border-border-soft text-text focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand transition-all shadow-inner"
          placeholder="默认 172800，范围 3600-259200"
          value={data.value || ""}
          onChange={(e) => data.onChange(id, "value", e.target.value)}
        />
      );
    if (data.type === "aspect_ratio")
      return (
        <StudioSelectField
          id={`field-${id}-aspect-ratio`}
          label="图片比例 (aspect_ratio)"
          value={data.value}
          onChange={(val: string) => data.onChange(id, "value", val)}
          options={[
            { value: "1:1", label: "1:1" },
            { value: "2:3", label: "2:3" },
            { value: "3:2", label: "3:2" },
            { value: "3:4", label: "3:4" },
            { value: "4:3", label: "4:3" },
            { value: "9:16", label: "9:16" },
            { value: "16:9", label: "16:9" },
            { value: "21:9", label: "21:9" },
            { value: "5:4", label: "5:4" },
            { value: "4:5", label: "4:5" },
          ]}
        />
      );
    if (data.type === "target_size")
      return (
        <input
          type="text"
          className="w-full h-8 px-3 text-[13px] bg-surface-app rounded-lg border border-border-soft text-text focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand transition-all shadow-inner"
          placeholder="1024x1024"
          value={data.value || ""}
          onChange={(e) => data.onChange(id, "value", e.target.value)}
        />
      );
    if (data.type === "transparent" || data.type === "customMode" || data.type === "instrumental")
      return (
        <StudioSelectField
          id={`field-${id}-${data.type}`}
          label={String(data.type)}
          value={String(data.value)}
          onChange={(val: string) => data.onChange(id, "value", val)}
          options={[
            { value: "false", label: "否" },
            { value: "true", label: "是" },
          ]}
        />
      );
    if (data.type === "thinking_level")
      return (
        <StudioSelectField
          id={`field-${id}-thinking-level`}
          label="思考强度 (thinking_level)"
          value={String(data.value)}
          onChange={(val: string) => data.onChange(id, "value", val)}
          options={[
            { value: "minimal", label: "minimal" },
            { value: "high", label: "high" },
          ]}
        />
      );
    if (data.type === "vocalGender")
      return (
        <StudioSelectField
          id={`field-${id}-vocal-gender`}
          label="人声性别 (vocalGender)"
          value={String(data.value)}
          onChange={(val: string) => data.onChange(id, "value", val)}
          options={[
            { value: "", label: "不指定" },
            { value: "m", label: "m" },
            { value: "f", label: "f" },
          ]}
        />
      );
    if (isLongTextSettingType(data.type))
      return (
        <textarea
          className="h-full min-h-[96px] w-full resize-none rounded-xl border border-border-soft bg-surface-app px-3 py-2 text-[13px] leading-5 text-text shadow-inner transition-all focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          placeholder={data.type === "style" ? "填写音乐风格、乐器、节奏、氛围..." : "填写要排除的风格、唱法、情绪..."}
          value={data.value || ""}
          onChange={(e) => data.onChange(id, "value", e.target.value)}
        />
      );

    return (
      <input
        type="text"
        className="w-full h-8 px-3 text-[13px] bg-surface-app rounded-lg border border-border-soft text-text focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand transition-all shadow-inner"
        placeholder="值..."
        value={data.value || ""}
        onChange={(e) => data.onChange(id, "value", e.target.value)}
      />
    );
  };

  return (
    <div
      className="group w-full h-full min-w-[200px] min-h-[100px] relative flex"
      onDragOverCapture={allowNodeSurfaceDrop}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={isLongTextSettingType(data.type) ? 280 : 200}
        minHeight={isLongTextSettingType(data.type) ? 160 : 100}
        maxWidth={isLongTextSettingType(data.type) ? 560 : 420}
        maxHeight={isLongTextSettingType(data.type) ? 360 : 220}
        color="var(--color-brand)"
        handleStyle={{ width: 8, height: 8, borderRadius: 4 }}
      />
      <div className="flex-1 flex flex-col bg-surface-panel/80 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-3xl shadow-popover overflow-hidden transition-all duration-300 group-hover:shadow-[0_16px_48px_rgba(0,217,197,0.15)] group-hover:border-brand/40">
        <div className="bg-gradient-to-r from-brand/10 to-transparent p-3 flex items-center gap-2 border-b border-border-soft shrink-0">
          {Icon && <Icon className="w-4 h-4 text-brand" />}
          <span className="text-xs font-bold text-text truncate">
            {preset?.label || "设置参数"}
          </span>
        </div>
        {!collapsed && (
          <div className={cn("p-4 flex flex-col flex-1 min-h-0", isLongTextSettingType(data.type) ? "justify-stretch" : "justify-center")}>
            {renderInput()}
          </div>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!w-4 !h-4 !bg-surface-app !border-2 !border-brand transition-transform group-hover:scale-125 z-50 !-right-2"
      />
      <DeleteButton onDelete={data.onDelete} id={id} selected={selected} />
    </div>
  );
}

export function GenericCollectorNode({ data, id, selected }: any) {
  const preset = getPresetById(data.presetId);
  const Icon = preset?.icon;
  const collapsed = Boolean(data.collapsed);
  const sourceResizeRef = React.useRef<{ pointerY: number; height: number } | null>(null);
  const sourceResizeCleanupRef = React.useRef<(() => void) | null>(null);

  const isPayload = data.presetId === "MultiModalPayloadNode";
  const isPromptComposer = data.presetId === "PromptComposerNode";
  const activeTab = (data.payloadTab || "json") as "json" | "sources" | "issues" | "raw";
  const payload = data.payload;
  const fieldSources = (data.fieldSources || []) as Array<{ path: string; nodeId: string; label: string; value?: unknown }>;
  const issues = (data.issues || []) as Array<{ severity: string; message: string; nodeId?: string; field?: string }>;
  const rawResult = data.rawResult;
  const composedPrompt = String(data.composedPrompt ?? "");
  const composedPromptSources = (data.composedPromptSources || []) as Array<{ nodeId: string; text: string }>;
  const sourcePaneHeight = clampNumber(Number(data.sourcePaneHeight ?? 180), 96, 420);
  const startSourcePaneResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    sourceResizeRef.current = {
      pointerY: event.clientY,
      height: sourcePaneHeight,
    };
    sourceResizeCleanupRef.current?.();
    const handleMove = (moveEvent: PointerEvent) => {
      const start = sourceResizeRef.current;
      if (!start) return;
      moveEvent.preventDefault();
      const nextHeight = clampNumber(start.height - (moveEvent.clientY - start.pointerY), 96, 420);
      data.onChange?.(id, "sourcePaneHeight", nextHeight);
    };
    const handleEnd = () => {
      sourceResizeRef.current = null;
      sourceResizeCleanupRef.current?.();
      sourceResizeCleanupRef.current = null;
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleEnd, { once: true });
    window.addEventListener("pointercancel", handleEnd, { once: true });
    sourceResizeCleanupRef.current = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleEnd);
      window.removeEventListener("pointercancel", handleEnd);
    };
  };
  const resizeSourcePane = (event: React.PointerEvent<HTMLButtonElement>) => {
    const start = sourceResizeRef.current;
    if (!start) return;
    event.preventDefault();
    event.stopPropagation();
    const nextHeight = clampNumber(start.height - (event.clientY - start.pointerY), 96, 420);
    data.onChange?.(id, "sourcePaneHeight", nextHeight);
  };
  const stopSourcePaneResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!sourceResizeRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    sourceResizeRef.current = null;
    sourceResizeCleanupRef.current?.();
    sourceResizeCleanupRef.current = null;
  };

  return (
    <div
      className="group w-full h-full min-w-[320px] min-h-[190px] relative flex transition-transform duration-300 hover:-translate-y-1"
      onDragOverCapture={allowNodeSurfaceDrop}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={isPromptComposer ? 360 : 320}
        minHeight={isPromptComposer ? 260 : 190}
        maxWidth={isPromptComposer ? 760 : 720}
        maxHeight={isPromptComposer ? 900 : 680}
        color="var(--color-brand)"
        handleStyle={{ width: 8, height: 8, borderRadius: 4 }}
      />
      <Handle
        type="target"
        position={Position.Left}
        className="!w-4 !h-4 !bg-surface-app !border-2 !border-brand transition-transform group-hover:scale-125 z-50 !-left-2"
      />
      <div className="flex-1 flex flex-col bg-surface-panel/80 backdrop-blur-xl border border-border-soft rounded-3xl shadow-popover overflow-hidden transition-all duration-300 group-hover:border-brand/30">
        <div className="bg-gradient-to-r from-brand/10 to-transparent p-3 flex flex-col gap-1 border-b border-border-soft shrink-0">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="w-5 h-5 text-brand" />}
            <span className="text-sm font-bold text-text">
              {preset?.label || "采集器"}
            </span>
          </div>
          <span className="text-[10px] text-text-subtle">
            {preset?.description}
          </span>
        </div>
        {!collapsed && (
          <div className="p-3 flex flex-col gap-2 bg-surface-app/30 flex-1 min-h-0">
            {isPayload && (
              <div className="flex min-h-0 flex-1 flex-col gap-2">
                <div className="grid grid-cols-5 gap-1.5 shrink-0">
                  {[
                    ["提示", data.promptCount || 0, data.promptCount ? "text-brand" : "text-text-muted"],
                    ["图片", `${data.imagesCount || 0}/9`, data.imagesCount > 9 ? "text-red-500" : data.imagesCount ? "text-brand" : "text-text-muted"],
                    ["视频", `${data.videosCount || 0}/3`, data.videosCount > 3 ? "text-red-500" : data.videosCount ? "text-purple-500" : "text-text-muted"],
                    ["音频", `${data.audiosCount || 0}/3`, data.audiosCount > 3 ? "text-red-500" : data.audiosCount ? "text-blue-500" : "text-text-muted"],
                    ["参数", data.settingsCount || 0, data.settingsCount ? "text-brand" : "text-text-muted"],
                  ].map(([label, value, color]) => (
                    <div key={String(label)} className="rounded-lg border border-border-soft bg-surface-panel px-1.5 py-1 text-center shadow-sm">
                      <span className="block text-[9px] font-bold text-text-subtle">{label}</span>
                      <span className={cn("block truncate text-xs font-black", String(color))}>{value}</span>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-4 gap-1 rounded-lg border border-border-soft bg-surface-app p-1 shrink-0">
                  {[
                    ["json", "JSON"],
                    ["sources", "Sources"],
                    ["issues", "Issues"],
                    ["raw", "Raw"],
                  ].map(([tab, label]) => (
                    <button
                      key={tab}
                      type="button"
                      className={cn(
                        "rounded px-1 py-1 text-[9px] font-black transition-colors",
                        activeTab === tab ? "bg-surface-raised text-brand" : "text-text-subtle hover:text-text",
                      )}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        data.onChange?.(id, "payloadTab", tab);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border-soft bg-surface-panel p-2 text-[10px] scrollbar-thin">
                  {activeTab === "json" && (
                    <pre className="m-0 whitespace-pre-wrap break-words font-mono text-text-subtle">
                      {payload ? JSON.stringify(payload, null, 2) : "Payload 暂不可用，请先修复 Issues。"}
                    </pre>
                  )}
                  {activeTab === "sources" && (
                    <div className="flex flex-col gap-1">
                      {fieldSources.length === 0 ? (
                        <span className="text-text-muted">暂无字段来源。</span>
                      ) : (
                        fieldSources.map((source, index) => (
                          <button
                            key={`${source.path}-${source.nodeId}-${index}`}
                            type="button"
                            className="flex items-center justify-between gap-2 rounded border border-border-soft bg-surface-app px-2 py-1 text-left hover:border-brand/40"
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                              event.stopPropagation();
                              data.onFocusReference?.(source.nodeId);
                            }}
                          >
                            <span className="min-w-0 truncate font-mono text-text-subtle">{source.path}</span>
                            <span className="max-w-[45%] truncate text-text">{String(source.value ?? source.label)}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                  {activeTab === "issues" && (
                    <div className="flex flex-col gap-1">
                      {issues.length === 0 ? (
                        <span className="text-text-muted">当前没有错误或警告。</span>
                      ) : (
                        issues.map((issue, index) => (
                          <button
                            key={`${issue.message}-${index}`}
                            type="button"
                            className={cn(
                              "flex items-start gap-1.5 rounded border px-2 py-1 text-left",
                              issue.severity === "error"
                                ? "border-red-500/20 bg-red-500/10 text-red-500"
                                : "border-yellow-500/20 bg-yellow-500/10 text-yellow-600",
                            )}
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (issue.nodeId) data.onFocusReference?.(issue.nodeId);
                            }}
                          >
                            <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                            <span className="min-w-0 leading-tight">{issue.message}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                  {activeTab === "raw" && (
                    <pre className="m-0 whitespace-pre-wrap break-words font-mono text-text-subtle">
                      {rawResult !== undefined ? JSON.stringify(rawResult, null, 2) : "运行后显示 raw execution result。"}
                    </pre>
                  )}
                </div>
              </div>
            )}
            {!isPayload && (
              <div
                className="grid min-h-0 flex-1 gap-2"
                style={{
                  gridTemplateRows:
                    composedPromptSources.length > 0
                      ? `auto minmax(80px, 1fr) 16px ${sourcePaneHeight}px`
                      : "auto minmax(80px, 1fr)",
                }}
              >
                <div className="flex items-center justify-between rounded-lg border border-border-soft bg-surface-panel px-2 py-1.5 text-[10px]">
                  <span className="font-bold text-text-subtle">上游提示词</span>
                  <span className="rounded-full bg-brand/10 px-2 py-0.5 font-black text-brand">
                    {data.promptCount || 0}
                  </span>
                </div>
                <div className="min-h-0 overflow-y-auto rounded-lg border border-border-soft bg-surface-panel p-2 text-[10px] scrollbar-thin">
                  {composedPrompt ? (
                    <pre className="m-0 whitespace-pre-wrap break-words font-mono leading-relaxed text-text-subtle">
                      {composedPrompt}
                    </pre>
                  ) : (
                    <div className="flex h-full min-h-[80px] items-center justify-center text-center text-xs text-text-muted">
                      连接提示词节点后显示合并内容。
                    </div>
                  )}
                </div>
                {composedPromptSources.length > 0 && (
                  <>
                    <button
                      type="button"
                      className="nodrag nopan group/source-resize flex h-4 shrink-0 cursor-row-resize items-center justify-center rounded-md"
                      title="拖动调整来源列表高度，双击恢复默认"
                      onPointerDown={startSourcePaneResize}
                      onPointerMove={resizeSourcePane}
                      onPointerUp={stopSourcePaneResize}
                      onPointerCancel={stopSourcePaneResize}
                      onDoubleClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        data.onChange?.(id, "sourcePaneHeight", 180);
                      }}
                    >
                      <span className="h-px w-full rounded-full bg-border-soft transition-colors group-hover/source-resize:bg-brand/60" />
                      <span className="absolute h-1.5 w-16 rounded-full bg-surface-raised opacity-0 ring-1 ring-border-soft transition-opacity group-hover/source-resize:opacity-100" />
                    </button>
                    <div
                      className="flex min-h-0 shrink-0 flex-col gap-1 overflow-y-auto rounded-lg border border-border-soft bg-surface-app p-1.5 scrollbar-thin"
                      style={{ height: sourcePaneHeight }}
                    >
                      {composedPromptSources.map((source, index) => (
                        <button
                          key={`${source.nodeId}-${index}`}
                          type="button"
                          className="flex items-center justify-between gap-2 rounded px-1.5 py-1 text-left text-[10px] text-text-subtle hover:bg-surface-raised hover:text-brand"
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={(event) => {
                            event.stopPropagation();
                            data.onFocusReference?.(source.nodeId);
                          }}
                        >
                          <span className="truncate font-mono">{source.nodeId}</span>
                          <span className="max-w-[55%] truncate">{source.text}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            {data.error && (
              <div className="text-[11px] font-bold text-red-500 bg-red-500/10 p-2 rounded-lg flex gap-1.5 items-start mt-auto">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span className="leading-tight">{data.error}</span>
              </div>
            )}
          </div>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!w-4 !h-4 !bg-surface-app !border-2 !border-brand transition-transform group-hover:scale-125 z-50 !-right-2"
      />
      <DeleteButton onDelete={data.onDelete} id={id} selected={selected} />
    </div>
  );
}

export function GenericExecutorNode({ data, id, selected }: any) {
  const preset = getPresetById(data.presetId);
  const collapsed = Boolean(data.collapsed);

  return (
    <div
      className="group w-full h-full min-w-[240px] min-h-[160px] relative flex transition-transform duration-300 hover:-translate-y-1"
      onDragOverCapture={allowNodeSurfaceDrop}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={240}
        minHeight={160}
        color="var(--color-brand)"
        handleStyle={{ width: 8, height: 8, borderRadius: 4 }}
      />
      <Handle
        type="target"
        position={Position.Left}
        className="!w-4 !h-4 !bg-surface-app !border-2 !border-brand transition-transform group-hover:scale-125 z-50 !-left-2"
      />
      <div className="flex-1 flex flex-col bg-surface-panel/80 backdrop-blur-2xl border-2 border-brand/50 rounded-3xl shadow-[0_0_40px_rgba(0,217,197,0.15)] overflow-hidden relative group-hover:shadow-[0_0_60px_rgba(0,217,197,0.25)] group-hover:border-brand">
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-brand/50" />

        <div className="bg-gradient-to-br from-brand/20 to-transparent p-6 flex flex-col items-center justify-center gap-3 flex-1">
          <div className="w-14 h-14 rounded-full bg-surface-panel shadow-lg flex items-center justify-center relative shrink-0">
            <div className="absolute inset-0 rounded-full border border-brand/30 animate-[spin_4s_linear_infinite]" />
            {preset?.icon &&
              React.createElement(preset.icon, {
                className: "w-7 h-7 text-brand",
              })}
          </div>
          <span className="text-[15px] font-black text-text text-center tracking-wide">
            {preset?.label || "运行节点"}
          </span>
        </div>
        {!collapsed && (
          <div className="p-5 pt-2 nodrag shrink-0">
            <Button
              className="w-full font-black text-[13px] h-11 rounded-xl shadow-lg shadow-brand/20 transition-all hover:shadow-brand/40 bg-gradient-to-r from-brand to-brand-strong text-[#04202a]"
              onClick={(e) => {
                e.stopPropagation();
                data.onRun();
              }}
              disabled={data.busy}
            >
              {data.busy ? (
                <Activity className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <Play className="w-5 h-5 mr-2 fill-current" />
              )}
              {data.isCloudVideoRunning
                ? "当前视频任务运行中"
                : data.busy
                  ? "生成中..."
                  : "开始生成"}
            </Button>
          </div>
        )}
      </div>
      {preset?.outputHandles?.includes("right") && (
        <Handle
          type="source"
          position={Position.Right}
          className="!w-4 !h-4 !bg-surface-app !border-2 !border-brand transition-transform group-hover:scale-125 z-50 !-right-2"
        />
      )}
      <DeleteButton onDelete={data.onDelete} id={id} selected={selected} />
    </div>
  );
}

export function GenericResultNode({ data, id, selected }: any) {
  const preset = getPresetById(data.presetId);
  const collapsed = Boolean(data.collapsed);
  const resultAssets = (data.resultAssets || []) as ResultAsset[];
  const resultVideo = resultAssets.find((asset) => asset.kind === "video" || asset.role === "video_result");
  const lastFrame = resultAssets.find((asset) => asset.role === "last_frame");
  const resultImage = resultAssets.find((asset) => asset.kind === "image" && asset.role !== "last_frame");
  const resultAudio = resultAssets.find((asset) => asset.kind === "audio");
  const taskId = typeof data.taskId === "string" ? data.taskId : undefined;
  const resultKindLabel =
    data.resultKind === "image"
      ? "图片"
      : data.resultKind === "audio"
        ? "音频"
        : "视频";

  const displayVideo = resultVideo
    ? {
        assetType: "video",
        fileName: fileNameFromPath(resultVideo.path),
        relativePath: resultVideo.path,
        src: videoPreviewSrc(data.project?.id, resultVideo.path),
      }
      : undefined;
  const displayImage = resultImage
    ? {
        assetType: "image",
        fileName: fileNameFromPath(resultImage.path),
        relativePath: resultImage.path,
        src: previewSrc(data.project?.id, resultImage.path),
      }
    : undefined;
  const displayAudio = resultAudio
    ? {
        assetType: "audio",
        fileName: fileNameFromPath(resultAudio.path),
        relativePath: resultAudio.path,
        src: previewSrc(data.project?.id, resultAudio.path),
      }
    : undefined;
  const displayLastFrame = lastFrame
    ? {
        assetType: "image",
        fileName: fileNameFromPath(lastFrame.path),
        relativePath: lastFrame.path,
        src: previewSrc(data.project?.id, lastFrame.path),
      }
    : undefined;
  const canCreateReference =
    Boolean(data.onCreateReferenceFromResult) &&
    (Boolean(displayImage) || Boolean(displayAudio) || Boolean(displayVideo));
  const hasDisplayResult = Boolean(displayImage || displayAudio || displayVideo);
  const isBusy = Boolean(data.busy) && !hasDisplayResult;

  return (
    <div
      className="group w-full h-full min-w-[260px] min-h-[190px] relative flex transition-transform duration-300 hover:-translate-y-1"
      onDragOverCapture={allowNodeSurfaceDrop}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={260}
        minHeight={190}
        color="var(--color-brand)"
        handleStyle={{ width: 8, height: 8, borderRadius: 4 }}
      />
      <Handle
        type="target"
        position={Position.Left}
        className="!w-4 !h-4 !bg-surface-app !border-2 !border-brand transition-transform group-hover:scale-125 z-50 !-left-2"
      />
      <div className="flex-1 flex flex-col bg-surface-panel/80 backdrop-blur-2xl border-2 border-border-soft rounded-3xl shadow-lg overflow-hidden relative group-hover:border-brand/50">
        <div className="bg-surface-app/50 p-3 border-b border-border flex items-center gap-2 shrink-0">
          {preset?.icon &&
            React.createElement(preset.icon, {
              className: "w-4 h-4 text-brand",
            })}
          <span className="text-xs font-bold text-text">
            {preset?.label || "生成结果"}
          </span>
        </div>

        {!collapsed && (
          <div className="p-3 flex-1 flex flex-col min-h-0 gap-2">
            {isBusy ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-text flex-1">
                <Activity className="w-8 h-8 text-brand animate-spin" />
                <div className="text-center">
                  <span className="block text-sm font-bold text-text">
                    {resultKindLabel}生成中
                  </span>
                  <span className="mt-1 block text-[11px] text-text-subtle">
                    任务完成后会刷新生成结果
                  </span>
                </div>
              </div>
            ) : displayImage ? (
              <div className="flex min-h-0 flex-1 flex-col gap-2">
                <div className="relative flex-1 rounded-xl overflow-hidden bg-black/5 border border-border-soft group-hover:border-brand/30 transition-colors min-h-0">
                  <img
                    src={displayImage.src}
                    alt={displayImage.fileName}
                    draggable={false}
                    className="h-full w-full object-contain"
                  />
                  <button
                    type="button"
                    className="absolute inset-0 cursor-zoom-in bg-black/0 transition-colors hover:bg-black/10 focus:outline-none focus:ring-2 focus:ring-brand/70"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      data.onPreviewMedia?.(displayImage);
                    }}
                    title="预览图片"
                  />
                </div>
                <div className="text-[10px] text-text-subtle truncate px-1 shrink-0">
                  {displayImage.fileName}
                </div>
              </div>
            ) : displayAudio ? (
              <div className="flex min-h-0 flex-1 flex-col justify-center gap-3 rounded-xl bg-surface-app/35 px-3 py-3">
                <div className="min-w-0">
                  <div className="truncate text-xs font-bold text-text">
                    {displayAudio.fileName}
                  </div>
                  <div className="mt-1 truncate text-[10px] text-text-muted">
                    {displayAudio.relativePath}
                  </div>
                </div>
                <CanvasAudioPlayer
                  src={displayAudio.src}
                  className="border-border-soft/50 bg-surface-panel/20"
                />
              </div>
            ) : displayVideo ? (
              <div className="flex min-h-0 flex-1 flex-col gap-2">
                <div className="relative flex-1 rounded-xl overflow-hidden bg-black border border-border-soft group-hover:border-brand/30 transition-colors min-h-0">
                  <video
                    src={displayVideo.src}
                    className="w-full h-full object-contain"
                    preload="metadata"
                    muted
                    playsInline
                  />
                  <button
                    type="button"
                    className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      data.onPreviewMedia?.(displayVideo);
                    }}
                    title="播放视频"
                  >
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/65 text-white shadow-xl backdrop-blur-sm transition-transform hover:scale-105 active:scale-95">
                      <Play className="ml-1 h-6 w-6 fill-current" />
                    </span>
                  </button>
                </div>
                <div className="text-[10px] text-text-subtle truncate px-1 shrink-0">
                  {displayVideo.fileName}
                </div>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 text-text-muted bg-surface-app/30 rounded-xl border border-dashed border-border">
                <Film className="w-8 h-8 opacity-20" />
                <span className="text-xs">暂无生成结果</span>
              </div>
            )}
            {displayLastFrame && (
              <div className="flex shrink-0 items-center gap-2 rounded-lg border border-border-soft bg-surface-app p-2">
                <div className="h-12 w-16 shrink-0 overflow-hidden rounded-md bg-black/10">
                  <img
                    src={displayLastFrame.src}
                    alt={displayLastFrame.fileName}
                    draggable={false}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold text-text">尾帧预览</div>
                  <div className="mt-0.5 truncate text-[9px] text-text-subtle">
                    {displayLastFrame.relativePath}
                  </div>
                </div>
              </div>
            )}
            {(taskId || lastFrame || canCreateReference) && (
              <div className="flex shrink-0 gap-1.5">
                {taskId && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 flex-1 px-2 text-[10px]"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      data.onQueryVideoTask?.(id);
                    }}
                  >
                    查询任务
                  </Button>
                )}
                {lastFrame && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 flex-1 px-2 text-[10px]"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      data.onContinueFromLastFrame?.(id);
                    }}
                  >
                    尾帧继续
                  </Button>
                )}
                {canCreateReference && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 flex-1 px-2 text-[10px]"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      data.onCreateReferenceFromResult?.(id);
                    }}
                  >
                    创建参考节点
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <DeleteButton onDelete={data.onDelete} id={id} selected={selected} />
    </div>
  );
}
