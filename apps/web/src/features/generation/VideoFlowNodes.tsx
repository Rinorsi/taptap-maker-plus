import React from "react";
import { Handle, Position } from "@xyflow/react";
import { Trash2, AlertCircle, Play, Activity, ImagePlus, Film } from "lucide-react";
import { getPresetById, NODE_PRESETS } from "./nodeRegistry";
import { cn } from "../../lib/utils";
import { assetPreviewUrl } from "../../api";
import { Button } from "../../components/ui/Button";
import { StudioSelectField } from "../../components/studio/StudioKit";
import { readAssetDragPath } from "./dragData";

const DeleteButton = ({ onDelete, id }: { onDelete?: (id: string) => void, id: string }) => (
  <button
    onClick={() => onDelete?.(id)}
    className="absolute -top-2 -right-2 w-6 h-6 bg-surface-panel border border-border-soft rounded-full flex items-center justify-center text-text-muted hover:text-red-500 hover:border-red-500/50 shadow-sm opacity-0 group-hover:opacity-100 transition-all z-50"
  >
    <Trash2 className="w-3.5 h-3.5" />
  </button>
);

export function GenericTextNode({ data, id }: any) {
  const preset = getPresetById(data.presetId);
  const Icon = preset?.icon;

  return (
    <div className="group w-[260px] relative">
      <div className="bg-surface-panel/80 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl shadow-popover overflow-hidden transition-all duration-300 group-hover:shadow-[0_16px_48px_rgba(0,217,197,0.15)] group-hover:border-brand/40">
        <div className="bg-gradient-to-r from-brand/10 to-transparent p-3 flex items-center gap-2 border-b border-border-soft">
          {Icon && <Icon className="w-4 h-4 text-brand" />}
          <span className="text-xs font-bold text-text">{preset?.label || '文本节点'}</span>
        </div>
        <div className="p-4 flex flex-col gap-3">
          <textarea
            className="w-full h-[60px] text-[13px] bg-surface-app/50 rounded-lg border border-border-soft p-2 text-text resize-none focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand transition-all shadow-inner"
            placeholder={`${preset?.label || '输入内容'}...`}
            value={data.text || ""}
            onChange={(e) => data.onChange(id, "text", e.target.value)}
          />
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!w-4 !h-4 !bg-surface-app !border-2 !border-brand transition-transform group-hover:scale-125 z-50 !-right-2" />
      <DeleteButton onDelete={data.onDelete} id={id} />
    </div>
  );
}

export function GenericMediaNode({ data, id }: any) {
  const preset = getPresetById(data.presetId);
  const Icon = preset?.icon;
  const isVideo = preset?.category === "video";
  const isAudio = preset?.category === "audio";
  const borderColor = isAudio ? "border-blue-500" : isVideo ? "border-purple-500" : "border-brand";

  return (
    <div className="group w-[200px] relative transition-all duration-300 hover:-translate-y-1">
      <div className={cn(
        "bg-surface-panel/80 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl shadow-popover overflow-hidden transition-all duration-300 group-hover:shadow-[0_16px_48px_rgba(0,217,197,0.15)]",
        isAudio ? "hover:border-blue-500/40" : isVideo ? "hover:border-purple-500/40" : "hover:border-brand/40"
      )}>
        <div className="relative">
          <div
             className={`h-[120px] w-full flex items-center justify-center bg-surface-app/50 overflow-hidden ${isAudio ? 'bg-gradient-to-br from-blue-500/10 to-transparent flex-col gap-2' : ''}`}
             onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'copy'; }}
             onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  const file = e.dataTransfer.files[0];
                  if (file.type.startsWith('image/') || file.type.startsWith('video/') || file.type.startsWith('audio/')) {
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
                <span className="text-[10px] font-medium text-text-subtle">拖拽素材至此</span>
              </div>
            ) : isAudio ? (
              <>
                <div className="w-10 h-10 rounded-full bg-surface-app shadow-inner flex items-center justify-center">
                  {Icon && <Icon className="w-5 h-5 text-blue-500" />}
                </div>
                <span className="text-[10px] font-medium text-text-subtle truncate max-w-[80%] text-center" title={data.fileName}>{data.fileName}</span>
              </>
            ) : isVideo ? (
              <video src={data.url} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
            ) : (
              <img src={data.url} alt="Image Ref" className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
            )}
          </div>
          {!isAudio && data.url && (
            <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-white flex items-center gap-1">
              {Icon && <Icon className={`w-3 h-3 ${isVideo ? 'text-purple-400' : ''}`} />}
            </div>
          )}
        </div>
        <div className="p-3 border-t border-border-soft bg-surface-panel flex flex-col gap-2">
           <StudioSelectField
             id={`field-${id}-preset`}
             label="参考类型"
             value={data.presetId}
             onChange={(val: string) => data.onChange(id, "presetId", val)}
             options={NODE_PRESETS.filter(p => p.category === preset?.category).map(p => ({ value: p.id, label: p.label }))}
           />
        </div>
      </div>
      <Handle type="source" position={Position.Right} className={`!w-4 !h-4 !bg-surface-app !border-2 !${borderColor} transition-transform group-hover:scale-125 z-50 !-right-2`} />
      <DeleteButton onDelete={data.onDelete} id={id} />
    </div>
  );
}

export function GenericSettingsNode({ data, id }: any) {
  const preset = getPresetById(data.presetId);
  const Icon = preset?.icon;

  const renderInput = () => {
    if (data.type === "ratio") return <StudioSelectField id={`field-${id}-ratio`} label="比例 (Ratio)" value={data.value} onChange={(val: string) => data.onChange(id, "value", val)} options={[{value: "16:9", label: "16:9"}, {value: "9:16", label: "9:16"}, {value: "1:1", label: "1:1"}]} />;
    if (data.type === "resolution") return <StudioSelectField id={`field-${id}-resolution`} label="分辨率 (Resolution)" value={data.value} onChange={(val: string) => data.onChange(id, "value", val)} options={[{value: "720p", label: "720p"}, {value: "480p", label: "480p"}]} />;
    if (data.type === "duration") return <StudioSelectField id={`field-${id}-duration`} label="时长 (Duration)" value={String(data.value)} onChange={(val: string) => data.onChange(id, "value", val)} options={[{value: "5", label: "5s"}, {value: "10", label: "10s"}]} />;
    if (data.type === "model") return <StudioSelectField id={`field-${id}-model`} label="模型 (Model)" value={data.value} onChange={(val: string) => data.onChange(id, "value", val)} options={[{value: "default", label: "默认"}, {value: "fast", label: "极速"}]} />;
    if (data.type === "generate_audio") return <StudioSelectField id={`field-${id}-generate-audio`} label="生成音频 (GenAudio)" value={String(data.value)} onChange={(val: string) => data.onChange(id, "value", val)} options={[{value: "false", label: "否"}, {value: "true", label: "是"}]} />;
    if (data.type === "return_last_frame") return <StudioSelectField id={`field-${id}-return-last-frame`} label="返回尾帧 (LastFrame)" value={String(data.value)} onChange={(val: string) => data.onChange(id, "value", val)} options={[{value: "false", label: "否"}, {value: "true", label: "是"}]} />;

    return (
      <input
        type="text"
        className="w-full h-8 px-2 text-[12px] bg-surface-app rounded-md border border-border-soft text-text focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand transition-all"
        placeholder="值..."
        value={data.value || ""}
        onChange={(e) => data.onChange(id, "value", e.target.value)}
      />
    );
  };

  return (
    <div className="group w-[200px] relative">
      <div className="bg-surface-panel/80 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl shadow-popover overflow-hidden transition-all duration-300 group-hover:shadow-[0_16px_48px_rgba(0,217,197,0.15)] group-hover:border-brand/40">
        <div className="bg-gradient-to-r from-brand/10 to-transparent p-3 flex items-center gap-2 border-b border-border-soft">
          {Icon && <Icon className="w-4 h-4 text-brand" />}
          <span className="text-xs font-bold text-text truncate">{preset?.label || '设置参数'}</span>
        </div>
        <div className="p-4 flex flex-col gap-3">
          {renderInput()}
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!w-4 !h-4 !bg-surface-app !border-2 !border-brand transition-transform group-hover:scale-125 z-50 !-right-2" />
      <DeleteButton onDelete={data.onDelete} id={id} />
    </div>
  );
}

export function GenericCollectorNode({ data, id }: any) {
  const preset = getPresetById(data.presetId);
  const Icon = preset?.icon;

  const isPayload = data.presetId === "MultiModalPayloadNode";

  return (
    <div className="group w-[280px] relative transition-all duration-300 hover:-translate-y-1">
      <Handle type="target" position={Position.Left} className="!w-4 !h-4 !bg-surface-app !border-2 !border-brand transition-transform group-hover:scale-125 z-50 !-left-2" />
      <div className="bg-surface-panel/80 backdrop-blur-xl border border-border-soft rounded-2xl shadow-popover overflow-hidden transition-all duration-300">
        <div className="bg-gradient-to-r from-brand/10 to-transparent p-3 flex flex-col gap-1 border-b border-border-soft">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="w-5 h-5 text-brand" />}
            <span className="text-sm font-bold text-text">{preset?.label || '采集器'}</span>
          </div>
          <span className="text-[10px] text-text-subtle">{preset?.description}</span>
        </div>
        <div className="p-4 flex flex-col gap-3 bg-surface-app/30">
          {isPayload && (
            <div className="grid grid-cols-5 gap-2">
               <div className="bg-surface-panel rounded p-2 text-center flex flex-col gap-1 border border-border-soft shadow-sm">
                 <span className="text-[10px] text-text-subtle font-bold">提示</span>
                 <span className={cn("text-sm font-black", data.promptCount ? "text-brand" : "text-text-muted")}>{data.promptCount || 0}</span>
               </div>
               <div className="bg-surface-panel rounded p-2 text-center flex flex-col gap-1 border border-border-soft shadow-sm">
                 <span className="text-[10px] text-text-subtle font-bold">图片</span>
                 <span className={cn("text-sm font-black", data.imagesCount > 9 ? "text-red-500" : (data.imagesCount === 0 ? "text-text-muted" : "text-brand"))}>{data.imagesCount || 0}/9</span>
               </div>
               <div className="bg-surface-panel rounded p-2 text-center flex flex-col gap-1 border border-border-soft shadow-sm">
                 <span className="text-[10px] text-text-subtle font-bold">视频</span>
                 <span className={cn("text-sm font-black", data.videosCount > 3 ? "text-red-500" : (data.videosCount === 0 ? "text-text-muted" : "text-purple-500"))}>{data.videosCount || 0}/3</span>
               </div>
               <div className="bg-surface-panel rounded p-2 text-center flex flex-col gap-1 border border-border-soft shadow-sm">
                 <span className="text-[10px] text-text-subtle font-bold">音频</span>
                 <span className={cn("text-sm font-black", data.audiosCount > 3 ? "text-red-500" : (data.audiosCount === 0 ? "text-text-muted" : "text-blue-500"))}>{data.audiosCount || 0}/3</span>
               </div>
               <div className="bg-surface-panel rounded p-2 text-center flex flex-col gap-1 border border-border-soft shadow-sm">
                 <span className="text-[10px] text-text-subtle font-bold">参数</span>
                 <span className={cn("text-sm font-black", data.settingsCount ? "text-brand" : "text-text-muted")}>{data.settingsCount || 0}</span>
               </div>
            </div>
          )}
          {data.error && (
            <div className="text-[11px] font-bold text-red-500 bg-red-500/10 p-2 rounded flex gap-1.5 items-start mt-1">
               <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
               <span className="leading-tight">{data.error}</span>
            </div>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!w-4 !h-4 !bg-surface-app !border-2 !border-brand transition-transform group-hover:scale-125 z-50 !-right-2" />
      <DeleteButton onDelete={data.onDelete} id={id} />
    </div>
  );
}

export function GenericExecutorNode({ data, id }: any) {
  const preset = getPresetById(data.presetId);

  return (
    <div className="group w-[240px] relative transition-all duration-300 hover:-translate-y-1">
      <Handle type="target" position={Position.Left} className="!w-4 !h-4 !bg-surface-app !border-2 !border-brand transition-transform group-hover:scale-125 z-50 !-left-2" />
      <div className="bg-surface-panel/80 backdrop-blur-2xl border-2 border-brand/50 rounded-2xl shadow-[0_0_40px_rgba(0,217,197,0.15)] overflow-hidden relative group-hover:shadow-[0_0_60px_rgba(0,217,197,0.25)] group-hover:border-brand">
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-brand/50" />

        <div className="bg-gradient-to-br from-brand/20 to-transparent p-6 flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-surface-panel shadow-lg flex items-center justify-center relative">
            <div className="absolute inset-0 rounded-full border border-brand/30 animate-[spin_4s_linear_infinite]" />
            {preset?.icon && React.createElement(preset.icon, { className: "w-7 h-7 text-brand" })}
          </div>
          <span className="text-[15px] font-black text-text text-center tracking-wide">{preset?.label || "运行节点"}</span>
        </div>
        <div className="p-5 pt-2 nodrag">
          <Button
            className="w-full font-black text-[13px] h-11 rounded-xl shadow-lg shadow-brand/20 transition-all hover:shadow-brand/40 bg-gradient-to-r from-brand to-brand-strong text-[#04202a]"
            onClick={(e) => { e.stopPropagation(); data.onRun(); }}
            disabled={data.busy}
          >
            {data.busy ? <Activity className="w-5 h-5 mr-2 animate-spin" /> : <Play className="w-5 h-5 mr-2 fill-current" />}
            {data.isCloudVideoRunning ? "当前视频任务运行中" : data.busy ? "生成中..." : "开始生成"}
          </Button>
        </div>
      </div>
      {preset?.outputHandles?.includes("right") && (
        <Handle type="source" position={Position.Right} className="!w-4 !h-4 !bg-surface-app !border-2 !border-brand transition-transform group-hover:scale-125 z-50 !-right-2" />
      )}
      <DeleteButton onDelete={data.onDelete} id={id} />
    </div>
  );
}

export function GenericResultNode({ data, id }: any) {
  const preset = getPresetById(data.presetId);

  // Get latest video asset from project
  const latestVideo = data.allAssets?.find((a: any) =>
    a.relativePath.toLowerCase().endsWith('.mp4') ||
    a.relativePath.toLowerCase().endsWith('.webm') ||
    a.relativePath.toLowerCase().endsWith('.mov')
  );

  return (
    <div className="group w-[280px] relative transition-all duration-300 hover:-translate-y-1">
      <Handle type="target" position={Position.Left} className="!w-4 !h-4 !bg-surface-app !border-2 !border-brand transition-transform group-hover:scale-125 z-50 !-left-2" />
      <div className="bg-surface-panel/80 backdrop-blur-2xl border-2 border-border-soft rounded-2xl shadow-lg overflow-hidden relative group-hover:border-brand/50">
        <div className="bg-surface-app/50 p-3 border-b border-border flex items-center gap-2">
          {preset?.icon && React.createElement(preset.icon, { className: "w-4 h-4 text-brand" })}
          <span className="text-xs font-bold text-text">{preset?.label || "生成结果"}</span>
        </div>

        <div className="p-3">
          {latestVideo ? (
            <div className="flex flex-col gap-2">
              <div className="relative aspect-video rounded-lg overflow-hidden bg-black border border-border-soft group-hover:border-brand/30 transition-colors">
                <video
                  src={assetPreviewUrl(data.project?.id || '', latestVideo.relativePath)}
                  className="w-full h-full object-contain"
                  controls
                  controlsList="nodownload"
                  preload="metadata"
                />
              </div>
              <div className="text-[10px] text-text-subtle truncate px-1">
                {latestVideo.fileName}
              </div>
            </div>
          ) : (
            <div className="aspect-video flex flex-col items-center justify-center gap-2 text-text-muted bg-surface-app/30 rounded-lg border border-dashed border-border">
              <Film className="w-8 h-8 opacity-20" />
              <span className="text-xs">暂无生成的视频</span>
            </div>
          )}
        </div>
      </div>
      <DeleteButton onDelete={data.onDelete} id={id} />
    </div>
  );
}
