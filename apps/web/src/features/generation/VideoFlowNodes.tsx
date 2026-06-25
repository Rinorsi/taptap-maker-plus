import React from "react";
import { Handle, Position, NodeResizer } from "@xyflow/react";
import {
  Trash2,
  AlertCircle,
  Play,
  Activity,
  ImagePlus,
  Film,
} from "lucide-react";
import { getPresetById, NODE_PRESETS } from "./nodeRegistry";
import { cn } from "../../lib/utils";
import { assetPreviewUrl } from "../../api";
import { Button } from "../../components/ui/Button";
import { StudioSelectField } from "../../components/studio/StudioKit";
import { readAssetDragPath } from "./dragData";
import { describeAssetUse, type CanvasAssetReference, type CanvasMentionToken } from "../canvas-core";

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

function allowNodeSurfaceDrop(event: React.DragEvent<HTMLDivElement>) {
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
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
  const syncMentionTokens = (text: string) => {
    const tokens = references
      .filter((reference) => text.includes(`@${reference.alias}`))
      .map((reference) => ({
        id: `${id}-${reference.nodeId}`,
        alias: reference.alias,
        nodeId: reference.nodeId,
        kind: reference.kind,
        use: reference.use,
      }));
    data.onChange(id, "mentionTokens", tokens);
  };

  return (
    <div
      className="group w-full h-full min-w-[220px] min-h-[140px] relative flex"
      onDragOverCapture={allowNodeSurfaceDrop}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={220}
        minHeight={140}
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
            <textarea
              className="w-full h-full min-h-[60px] text-[13px] bg-surface-app/50 rounded-xl border border-border-soft p-2 text-text resize-none focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand transition-all shadow-inner"
              placeholder="输入导演提示词，可写：@图1 作为角色参考，@视频1 参考运镜，@音频1 参考节奏..."
              value={data.text || ""}
              onChange={(e) => {
                data.onChange(id, "text", e.target.value);
                syncMentionTokens(e.target.value);
              }}
            />
            {references.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {references.map((reference) => (
                  <button
                    key={reference.nodeId}
                    type="button"
                    className="rounded-full border border-brand/25 bg-brand/10 px-2 py-1 text-[10px] font-bold text-brand hover:bg-brand/15"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      const insertion = `@${reference.alias} 作为${describeAssetUse(reference.use)}`;
                      const current = String(data.text || "");
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
      className="group w-full h-full min-w-[200px] min-h-[160px] relative flex transition-transform duration-300 hover:-translate-y-1"
      onDragOverCapture={allowNodeSurfaceDrop}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={200}
        minHeight={160}
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
                className={`relative min-h-0 h-full max-h-[220px] flex-1 w-full flex items-center justify-center bg-surface-app/50 overflow-hidden ${isAudio ? "bg-gradient-to-br from-blue-500/10 to-transparent flex-col gap-2" : ""}`}
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
                  <img
                    src={data.url}
                    alt="Image Ref"
                    draggable={false}
                    className="absolute inset-0 h-full w-full object-contain opacity-90 group-hover:opacity-100 transition-opacity"
                  />
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
        minWidth={200}
        minHeight={100}
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
          <div className="p-4 flex flex-col justify-center flex-1">
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

  const isPayload = data.presetId === "MultiModalPayloadNode";

  return (
    <div
      className="group w-full h-full min-w-[280px] min-h-[160px] relative flex transition-transform duration-300 hover:-translate-y-1"
      onDragOverCapture={allowNodeSurfaceDrop}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={280}
        minHeight={160}
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
          <div className="p-4 flex flex-col gap-3 bg-surface-app/30 flex-1">
            {isPayload && (
              <div className="grid grid-cols-5 gap-2 h-full">
                <div className="bg-surface-panel rounded-xl p-2 text-center flex flex-col justify-center gap-1 border border-border-soft shadow-sm flex-1">
                  <span className="text-[10px] text-text-subtle font-bold">
                    提示
                  </span>
                  <span
                    className={cn(
                      "text-sm font-black",
                      data.promptCount ? "text-brand" : "text-text-muted",
                    )}
                  >
                    {data.promptCount || 0}
                  </span>
                </div>
                <div className="bg-surface-panel rounded-xl p-2 text-center flex flex-col justify-center gap-1 border border-border-soft shadow-sm flex-1">
                  <span className="text-[10px] text-text-subtle font-bold">
                    图片
                  </span>
                  <span
                    className={cn(
                      "text-sm font-black",
                      data.imagesCount > 9
                        ? "text-red-500"
                        : data.imagesCount === 0
                          ? "text-text-muted"
                          : "text-brand",
                    )}
                  >
                    {data.imagesCount || 0}/9
                  </span>
                </div>
                <div className="bg-surface-panel rounded-xl p-2 text-center flex flex-col justify-center gap-1 border border-border-soft shadow-sm flex-1">
                  <span className="text-[10px] text-text-subtle font-bold">
                    视频
                  </span>
                  <span
                    className={cn(
                      "text-sm font-black",
                      data.videosCount > 3
                        ? "text-red-500"
                        : data.videosCount === 0
                          ? "text-text-muted"
                          : "text-purple-500",
                    )}
                  >
                    {data.videosCount || 0}/3
                  </span>
                </div>
                <div className="bg-surface-panel rounded-xl p-2 text-center flex flex-col justify-center gap-1 border border-border-soft shadow-sm flex-1">
                  <span className="text-[10px] text-text-subtle font-bold">
                    音频
                  </span>
                  <span
                    className={cn(
                      "text-sm font-black",
                      data.audiosCount > 3
                        ? "text-red-500"
                        : data.audiosCount === 0
                          ? "text-text-muted"
                          : "text-blue-500",
                    )}
                  >
                    {data.audiosCount || 0}/3
                  </span>
                </div>
                <div className="bg-surface-panel rounded-xl p-2 text-center flex flex-col justify-center gap-1 border border-border-soft shadow-sm flex-1">
                  <span className="text-[10px] text-text-subtle font-bold">
                    参数
                  </span>
                  <span
                    className={cn(
                      "text-sm font-black",
                      data.settingsCount ? "text-brand" : "text-text-muted",
                    )}
                  >
                    {data.settingsCount || 0}
                  </span>
                </div>
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
  const isBusy = Boolean(data.busy || data.isCloudVideoRunning);
  const resultAssets = (data.resultAssets || []) as ResultAsset[];
  const resultVideo = resultAssets.find((asset) => asset.kind === "video" || asset.role === "video_result");
  const resultImage = resultAssets.find((asset) => asset.kind === "image" && asset.role !== "last_frame");
  const resultAudio = resultAssets.find((asset) => asset.kind === "audio");

  const latestVideo = data.allAssets?.find(
    (a: any) =>
      a.relativePath.toLowerCase().endsWith(".mp4") ||
      a.relativePath.toLowerCase().endsWith(".webm") ||
      a.relativePath.toLowerCase().endsWith(".mov"),
  );
  const displayVideo = resultVideo
    ? {
        assetType: "video",
        fileName: fileNameFromPath(resultVideo.path),
        relativePath: resultVideo.path,
        src: previewSrc(data.project?.id, resultVideo.path),
      }
      : latestVideo
      ? {
          assetType: latestVideo.assetType,
          fileName: latestVideo.fileName,
          relativePath: latestVideo.relativePath,
          src: assetPreviewUrl(data.project?.id || "", latestVideo.relativePath),
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

  return (
    <div
      className="group w-full h-full min-w-[300px] min-h-[220px] relative flex transition-transform duration-300 hover:-translate-y-1"
      onDragOverCapture={allowNodeSurfaceDrop}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={300}
        minHeight={220}
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
          <div className="p-3 flex-1 flex flex-col min-h-0">
            {isBusy ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-text flex-1">
                <Activity className="w-8 h-8 text-brand animate-spin" />
                <div className="text-center">
                  <span className="block text-sm font-bold text-text">
                    视频生成中
                  </span>
                  <span className="mt-1 block text-[11px] text-text-subtle">
                    任务完成后会刷新生成结果
                  </span>
                </div>
              </div>
            ) : displayImage ? (
              <div className="flex flex-col gap-2 h-full">
                <div className="relative flex-1 rounded-xl overflow-hidden bg-black/5 border border-border-soft group-hover:border-brand/30 transition-colors min-h-0">
                  <img
                    src={displayImage.src}
                    alt={displayImage.fileName}
                    draggable={false}
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="text-[10px] text-text-subtle truncate px-1 shrink-0">
                  {displayImage.fileName}
                </div>
              </div>
            ) : displayAudio ? (
              <div className="flex h-full flex-col justify-center gap-3 rounded-xl border border-border-soft bg-surface-app p-3">
                <div className="min-w-0">
                  <div className="truncate text-xs font-bold text-text">
                    {displayAudio.fileName}
                  </div>
                  <div className="mt-1 truncate text-[10px] text-text-subtle">
                    {displayAudio.relativePath}
                  </div>
                </div>
                <audio src={displayAudio.src} controls className="w-full" />
              </div>
            ) : displayVideo ? (
              <div className="flex flex-col gap-2 h-full">
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
              <div className="h-full flex flex-col items-center justify-center gap-2 text-text-muted bg-surface-app/30 rounded-xl border border-dashed border-border flex-1">
                <Film className="w-8 h-8 opacity-20" />
                <span className="text-xs">暂无生成结果</span>
              </div>
            )}
          </div>
        )}
      </div>
      <DeleteButton onDelete={data.onDelete} id={id} selected={selected} />
    </div>
  );
}
