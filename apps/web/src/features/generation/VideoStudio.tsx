import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, ChevronLeft, PanelRightClose, FileVideo, RefreshCw, Settings2, Trash2, Wand2, Play, Activity, Loader2, Clock, Boxes } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { VideoFlowCanvas } from "./VideoFlowCanvas";
import { writeAssetDragData } from "./dragData";
import { assetPreviewUrl, type AssetSummary, type ProjectSummary, type TaskRecord, type ToolSummary } from "../../api";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Label } from "../../components/ui/Label";
import { StudioHeader, StudioMediaDropzone, StudioModeButton, StudioPromptField, StudioSelectField } from "../../components/studio/StudioKit";
import { AssetManagerPanel } from "../assets/AssetManagerPanel";
import { defaultAssetImportFolders, managedAssetRoots } from "../assets/assetGovernance";
import { cn } from "../../lib/utils";

type Props = {
  project?: ProjectSummary;
  tools: ToolSummary[];
  assets: AssetSummary[];
  tasks: TaskRecord[];
  busy: boolean;
  onCallTool: (toolName: string, args: Record<string, unknown>) => Promise<unknown>;
  onSelectTool: (tool: ToolSummary) => void;
  onSelectAsset?: (asset: AssetSummary) => void;
  onScanAssets: () => void;
  onDeleteAssets: (relativePaths: string[]) => Promise<void>;
  onMoveAssets: (relativePaths: string[], targetFolder: string) => Promise<void>;
  onRenameAsset: (relativePath: string, newName: string) => Promise<void>;
  onImportAssets: (files: File[], targetFolder: string) => Promise<void>;
  onCollapseSidebar?: () => void;
  onShowError?: () => void;
};

type ResourceType = "video" | "image" | "audio";

const videoModeOptions = [
  { value: "text_to_video", label: "纯文本生视频" },
  { value: "first_frame", label: "首帧图生视频" },
  { value: "first_last_frame", label: "首尾帧图生视频" }
];

const resolutionOptions = [
  { value: "720p", label: "720p (推荐)" },
  { value: "480p", label: "480p (省流)" }
];

const ratioOptions = [
  { value: "16:9", label: "横屏 16:9" },
  { value: "9:16", label: "竖屏 9:16" },
  { value: "1:1", label: "方图 1:1" },
  { value: "4:3", label: "横屏 4:3" },
  { value: "3:4", label: "竖屏 3:4" },
  { value: "21:9", label: "超宽屏 21:9" },
  { value: "adaptive", label: "自适应 (Adaptive)" }
];

const durationOptions = [
  { value: "4", label: "4 秒" },
  { value: "5", label: "5 秒" },
  { value: "10", label: "10 秒" },
  { value: "15", label: "15 秒" },
  { value: "-1", label: "自动检测" }
];

const modelOptions = [
  { value: "default", label: "标准模式 (Default)" },
  { value: "fast", label: "极速模式 (Fast)" }
];

function isVideoTaskStatusRunning(rawResultJson: string) {
  const runningStatuses = new Set(["running", "queued", "processing", "starting"]);
  for (const value of readVideoTaskStatuses(rawResultJson)) {
    if (runningStatuses.has(value)) return true;
  }
  return false;
}

function readVideoTaskStatuses(rawResultJson: string) {
  const statuses: string[] = [];
  try {
    const raw = JSON.parse(rawResultJson) as {
      status?: unknown;
      provider_status?: unknown;
      structuredContent?: unknown;
      content?: unknown;
    };
    pushStatus(statuses, raw.status);
    pushStatus(statuses, raw.provider_status);

    if (raw.structuredContent && typeof raw.structuredContent === "object" && !Array.isArray(raw.structuredContent)) {
      const structured = raw.structuredContent as { status?: unknown; provider_status?: unknown };
      pushStatus(statuses, structured.status);
      pushStatus(statuses, structured.provider_status);
    }

    if (Array.isArray(raw.content)) {
      for (const item of raw.content) {
        if (!item || typeof item !== "object") continue;
        const text = (item as { type?: unknown; text?: unknown }).text;
        if (typeof text !== "string") continue;
        try {
          const parsed = JSON.parse(text) as { status?: unknown; provider_status?: unknown };
          pushStatus(statuses, parsed.status);
          pushStatus(statuses, parsed.provider_status);
        } catch {
          // ignore non-JSON text chunks
        }
      }
    }
  } catch {
    return statuses;
  }
  return statuses;
}

function pushStatus(statuses: string[], value: unknown) {
  if (typeof value === "string") statuses.push(value);
}

function defaultVideoName() {
  return `vid_${Date.now()}`;
}

export function VideoStudio({
  project, tools, assets, tasks, busy, onCallTool, onSelectAsset, onScanAssets, onDeleteAssets, onMoveAssets, onImportAssets, onCollapseSidebar, onShowError
}: Props) {
  const [videoMode, setVideoMode] = useState("text_to_video");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [name, setName] = useState("");
  const [resolution, setResolution] = useState("720p");
  const [ratio, setRatio] = useState("16:9");
  const [duration, setDuration] = useState("5");
  const [model, setModel] = useState("default");
  const [seed, setSeed] = useState("");
  const [generateAudio, setGenerateAudio] = useState(false);
  const [returnLastFrame, setReturnLastFrame] = useState(true);
  const [enableWebSearch, setEnableWebSearch] = useState(false);
  
  const [firstFrame, setFirstFrame] = useState("");
  const [lastFrame, setLastFrame] = useState("");

  const [resourceType, setResourceType] = useState<ResourceType>("video");
  const [viewTab, setViewTab] = useState<"preview" | "manage">("preview");
  const [studioMode, setStudioMode] = useState<"standard" | "flow">("standard");
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [previewAsset, setPreviewAsset] = useState<AssetSummary | null>(null);

  const generateTool = useMemo(() => tools.find((tool) => tool.category === "video" && (tool.name.includes("generate") || tool.name.includes("create_video"))), [tools]);

  const currentRoot = resourceType === "video" ? managedAssetRoots.video : resourceType === "image" ? managedAssetRoots.image : managedAssetRoots.audio;
  const currentImportFolder = resourceType === "video" ? defaultAssetImportFolders.video : resourceType === "image" ? defaultAssetImportFolders.image : defaultAssetImportFolders.audio;

  const projectAssets = useMemo(() => {
    if (!project) return [];
    return assets.filter(a => a.projectId === project.id).sort((a, b) => b.mtimeMs - a.mtimeMs);
  }, [assets, project]);

  const currentAssets = useMemo(() => {
    return projectAssets.filter((asset) => {
      if (asset.assetType !== resourceType) return false;
      const normalized = asset.relativePath.replace(/\\/g, "/");
      return normalized.startsWith(`${currentRoot}/`);
    });
  }, [projectAssets, resourceType, currentRoot]);

  const videoAssets = useMemo(() => {
    return projectAssets.filter((asset) => {
      if (asset.assetType !== "video") return false;
      const normalized = asset.relativePath.replace(/\\/g, "/");
      return normalized.startsWith(`${managedAssetRoots.video}/`);
    });
  }, [projectAssets]);

  const activeGenerationTask = useMemo(() => {
    return tasks.find(t => t.projectId === project?.id && t.status === "running" && t.toolName.includes("video"));
  }, [tasks, project]);

  // Auto-switch to preview video when task finishes
  const previousActiveTask = useRef(activeGenerationTask);
  useEffect(() => {
    if (previousActiveTask.current && !activeGenerationTask) {
      setResourceType("video");
      setViewTab("preview");
      setPreviewAsset(null);
    }
    previousActiveTask.current = activeGenerationTask;
  }, [activeGenerationTask]);

  const taskRecord = useMemo(() => {
    if (!project) return undefined;
    return tasks.find((task) => task.projectId === project.id && task.toolName.includes("video") && (task.status === "queued" || task.status === "running"));
  }, [project, tasks]);

  const isCloudVideoRunning = useMemo(() => {
    if (!project) return false;
    const videoTasks = tasks.filter(t => t.projectId === project.id && (t.toolName === "create_video_task" || t.toolName === "query_video_task"));
    const latestCompleted = videoTasks.find(t => t.status === "succeeded" && t.rawResultJson);
    if (!latestCompleted || !latestCompleted.rawResultJson) return false;
    return isVideoTaskStatusRunning(latestCompleted.rawResultJson);
  }, [project, tasks]);

  const displayAsset = previewAsset?.assetType === "video" ? previewAsset : (videoAssets.length > 0 ? videoAssets[0] : null);
  const isLastGenerated = !previewAsset && displayAsset !== null;

  const previewMetadata = useMemo(() => {
    if (!displayAsset) return null;
    const task = tasks.find(t => t.status === "succeeded" && t.rawResultJson && t.rawResultJson.includes(displayAsset.fileName));
    if (!task) return null;
    try {
      const parsed = JSON.parse(task.inputJson);
      return parsed;
    } catch {
      return null;
    }
  }, [displayAsset, tasks]);

  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (!activeGenerationTask) {
      setElapsedTime(0);
      return;
    }
    const start = new Date(activeGenerationTask.startedAt).getTime();
    setElapsedTime(Math.floor((Date.now() - start) / 1000));
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [activeGenerationTask]);

  const handleCallTool = async (toolName: string, args: Record<string, unknown>) => {
    setViewTab("preview");
    setIsRightPanelOpen(true);
    await onCallTool(toolName, args);
  };

  function handleGenerate() {
    const tool = generateTool;
    if (!tool || !project) return;
    setPreviewAsset(null);
    
    const payload: Record<string, unknown> = {
      mode: videoMode,
      model,
      prompt: prompt.trim(),
      resolution,
      ratio,
      duration: Number(duration),
      generate_audio: generateAudio,
      return_last_frame: returnLastFrame
    };
    
    if (videoMode === "text_to_video") {
      payload.enable_web_search = enableWebSearch;
    }
    
    const numericSeed = seed.trim();
    if (numericSeed) payload.seed = Number(numericSeed);
    
    const images: { url: string, role: string }[] = [];
    if (videoMode === "first_frame" && firstFrame) {
      images.push({ url: firstFrame, role: "first_frame" });
    } else if (videoMode === "first_last_frame" || videoMode === "multi_modal_reference") {
      if (firstFrame) images.push({ url: firstFrame, role: "first_frame" });
      if (lastFrame) images.push({ url: lastFrame, role: "last_frame" });
    }
    
    if (images.length > 0) {
      payload.images = images;
    }
    
    void handleCallTool(tool.name, payload);
  }

  async function deleteAssetsAndClearPreview(paths: string[]) {
    if (!paths.length) return;
    await onDeleteAssets(paths);
    setPreviewAsset(null);
  }

  function openPreview(asset: AssetSummary) {
    setPreviewAsset(asset);
  }
  return (
    <div className="flex flex-col gap-5 p-6 h-full min-h-0 w-full max-w-[1600px] mx-auto overflow-hidden">
      <StudioHeader
        icon={<FileVideo className="w-3.5 h-3.5" />}
        eyebrow="Video Studio"
        title="视频生成工作室"
        projectName={project?.name}
        actions={
          <div className="flex items-center p-1 bg-surface-muted rounded-pill border border-border-soft">
            <StudioModeButton active={studioMode === "standard"} onClick={() => setStudioMode("standard")} icon={<FileVideo className="w-4 h-4" />}>标准生成</StudioModeButton>
            <StudioModeButton
              active={studioMode === "flow"}
              onClick={() => {
                setStudioMode("flow");
                setIsRightPanelOpen(false);
                onCollapseSidebar?.();
              }}
              icon={<Boxes className="w-4 h-4" />}
            >
              多模态参考画布
            </StudioModeButton>
          </div>
        }
      />

      <div className="flex-1 flex gap-5 min-h-0 overflow-hidden">
        
      {studioMode === "standard" ? (
        <div className="w-[280px] md:w-[320px] lg:w-[360px] xl:w-[420px] shrink-0 bg-surface-app/40 backdrop-blur-2xl border border-white/5 rounded-3xl flex flex-col min-h-0 shadow-[0_8px_30px_rgb(0,0,0,0.12)] overflow-hidden relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-32 bg-brand/10 blur-[60px] rounded-full pointer-events-none" />
          
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 min-h-0 relative z-10">
            <div className="flex items-center justify-between border-b border-white/5 pb-4 shrink-0">
              <div className="flex items-center gap-2">
                 <Wand2 className="w-4 h-4 text-brand" />
                 <span className="text-sm font-black text-text uppercase tracking-widest">导演控制台</span>
              </div>
              <span className="text-[10px] text-brand-strong bg-brand/10 px-2.5 py-1 rounded-full font-bold">Video Mode</span>
            </div>
            
            <div className="grid gap-4">
              <StudioSelectField label="生成模式" value={videoMode} onChange={setVideoMode} options={videoModeOptions} />
            </div>

            <StudioPromptField
                id="prompt"
                value={prompt}
                onChange={setPrompt}
                label="画面提示词 (Prompt)"
                placeholder={"描述视频画面、运镜及动作，越详细越好...\n例如：镜头缓缓向前推进，清晨的阳光穿透树林..."}
                required
                minHeightClass="min-h-[120px]"
              />

            {(videoMode === "first_frame" || videoMode === "first_last_frame" || videoMode === "multi_modal_reference") && (
              <div className="flex gap-3">
                <div className="flex-1 flex flex-col gap-2">
                  <Label className="text-[11px] font-bold text-text-muted">参考首帧</Label>
                  <StudioMediaDropzone image={firstFrame ? assetPreviewUrl(project?.id ?? "", firstFrame) : ""} onChange={setFirstFrame} height="h-28" emptyLabel="拖拽图片至此" emptySubLabel="作为首帧参考" />
                </div>

                {(videoMode === "first_last_frame" || videoMode === "multi_modal_reference") && (
                  <div className="flex-1 flex flex-col gap-2">
                    <Label className="text-[11px] font-bold text-text-muted">参考尾帧 (可选)</Label>
                    <StudioMediaDropzone image={lastFrame ? assetPreviewUrl(project?.id ?? "", lastFrame) : ""} onChange={setLastFrame} height="h-28" emptyLabel="拖拽图片至此" emptySubLabel="作为尾帧参考" />
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-1">
                <StudioSelectField label="视频比例" value={ratio} onChange={setRatio} options={ratioOptions} />
              </div>
              <div className="col-span-1">
                <StudioSelectField label="视频时长" value={duration} onChange={setDuration} options={durationOptions} />
              </div>
            </div>

            <div className="pt-2">
              <button 
                type="button" 
                onClick={() => setShowAdvanced(!showAdvanced)}
                className={cn("flex items-center justify-center gap-2 text-[13px] font-bold transition-all w-full py-3 rounded-2xl group", showAdvanced ? "bg-brand/10 text-brand" : "bg-surface-raised text-text-muted hover:bg-surface-panel hover:text-text")}
              >
                <Settings2 className={cn("w-4 h-4 transition-transform", showAdvanced && "rotate-90")} />
                高级控制参数
                {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />}
              </button>
              
              <AnimatePresence>
                {showAdvanced && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-2 gap-5 pt-5 pb-2">
                      <div className="col-span-1 flex flex-col gap-2">
                        <Label htmlFor="name" className="text-xs font-bold text-text-subtle">视频名称 (可选)</Label>
                        <Input 
                          id="name" 
                          value={name} 
                          onChange={(e) => setName(e.target.value)} 
                          placeholder="留空自动生成" 
                          className="h-10 rounded-xl bg-surface-raised border-transparent focus:border-brand shadow-inner text-[13px]"
                        />
                      </div>
                      <div className="col-span-1 flex flex-col gap-2">
                        <Label htmlFor="seed" className="text-xs font-bold text-text-subtle">随机种子 (Seed)</Label>
                        <Input 
                          id="seed" 
                          value={seed} 
                          onChange={(e) => setSeed(e.target.value)} 
                          placeholder="留空则随机" 
                          type="number"
                          className="h-10 rounded-xl bg-surface-raised border-transparent focus:border-brand shadow-inner text-[13px]"
                        />
                      </div>
                      
                      {/* Switches */}
                      <div className="col-span-2 flex flex-col gap-4 pt-2">
                         <label className="flex items-center gap-3 cursor-pointer group">
                           <div className="relative">
                             <input type="checkbox" className="sr-only peer" checked={generateAudio} onChange={(e) => setGenerateAudio(e.target.checked)} />
                             <div className="w-9 h-5 bg-surface-raised peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand"></div>
                           </div>
                           <span className="text-xs font-bold text-text-muted group-hover:text-text transition-colors">生成有声视频 (Generate Audio)</span>
                         </label>
                         
                         <label className="flex items-center gap-3 cursor-pointer group">
                           <div className="relative">
                             <input type="checkbox" className="sr-only peer" checked={returnLastFrame} onChange={(e) => setReturnLastFrame(e.target.checked)} />
                             <div className="w-9 h-5 bg-surface-raised peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand"></div>
                           </div>
                           <span className="text-xs font-bold text-text-muted group-hover:text-text transition-colors">返回尾帧图 (Return Last Frame)</span>
                         </label>

                         {videoMode === "text_to_video" && (
                           <label className="flex items-center gap-3 cursor-pointer group">
                             <div className="relative">
                               <input type="checkbox" className="sr-only peer" checked={enableWebSearch} onChange={(e) => setEnableWebSearch(e.target.checked)} />
                               <div className="w-9 h-5 bg-surface-raised peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand"></div>
                             </div>
                             <span className="text-xs font-bold text-text-muted group-hover:text-text transition-colors">联网搜索增强 (Web Search)</span>
                           </label>
                         )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          
          <div className="flex flex-col gap-4 p-6 pt-5 border-t border-white/5 bg-surface-panel/40 backdrop-blur-md shrink-0 relative z-10">
            <div className="flex items-end justify-between gap-4">
               <div className="flex-1">
                 <StudioSelectField label="模型 (Model)" value={model} onChange={setModel} options={modelOptions} />
               </div>
               <div className="flex-1">
                 <StudioSelectField label="分辨率" value={resolution} onChange={setResolution} options={resolutionOptions} />
               </div>
            </div>
            <Button 
              size="lg" 
              onClick={handleGenerate} 
              disabled={busy || !project || activeGenerationTask !== undefined || isCloudVideoRunning || !prompt || (videoMode !== "text_to_video" && !firstFrame)}
              className="gap-2 w-full text-[15px] h-12 font-black rounded-2xl bg-gradient-to-r from-brand to-brand-strong text-[#04202a] shadow-lg shadow-brand/20 hover:shadow-brand/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {(activeGenerationTask || isCloudVideoRunning) ? <Activity className="h-5 w-5 animate-pulse" /> : <Play className="w-5 h-5 fill-current" />}
              {activeGenerationTask ? "视频渲染请求发送中..." : isCloudVideoRunning ? "当前视频任务运行中，120 秒后刷新" : videoMode === "text_to_video" ? "生成视频" : "以图生视频"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-w-0 min-h-0 overflow-hidden bg-surface-panel/40 border border-white/5 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] relative">
          <VideoFlowCanvas project={project} allAssets={projectAssets} activeGenerationTask={activeGenerationTask} isCloudVideoRunning={isCloudVideoRunning} generateTool={generateTool} onCallTool={handleCallTool} onShowError={onShowError} />
        </div>
      )}

      {/* Right Gallery Panel */}
      <AnimatePresence initial={false}>
        {(isRightPanelOpen || studioMode === "standard") && (
          <motion.div 
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: studioMode === "standard" ? "100%" : 360, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className={cn(
              "bg-surface-panel border border-border rounded-large flex flex-col min-h-0 overflow-hidden shadow-sm shrink-0",
              studioMode === "standard" ? "flex-1" : ""
            )}
            style={{ originX: 1 }}
          >
            <div className="px-4 py-2.5 border-b border-border flex flex-wrap items-center justify-between gap-4 shrink-0 bg-surface-raised/40">
              
              {/* Left: Context & Navigation */}
              <div className="flex flex-wrap items-center gap-3 min-w-0 flex-1">
                <div className="flex p-1 bg-surface-app border border-border-soft rounded-lg shadow-inner shrink-0">
                  <button onClick={() => setViewTab("preview")} className={cn("px-3 py-1 text-[11px] font-bold rounded transition-all", viewTab === "preview" ? "bg-surface-raised shadow-sm text-text border border-border-soft" : "text-text-subtle hover:text-text")}>预览</button>
                  <button onClick={() => { setViewTab("manage"); setResourceType("video"); }} className={cn("px-3 py-1 text-[11px] font-bold rounded transition-all", viewTab === "manage" && resourceType === "video" ? "bg-surface-raised shadow-sm text-text border border-border-soft" : "text-text-subtle hover:text-text")}>视频库</button>
                  <button onClick={() => { setViewTab("manage"); setResourceType("image"); }} className={cn("px-3 py-1 text-[11px] font-bold rounded transition-all", viewTab === "manage" && resourceType === "image" ? "bg-surface-raised shadow-sm text-text border border-border-soft" : "text-text-subtle hover:text-text")}>图片库</button>
                  <button onClick={() => { setViewTab("manage"); setResourceType("audio"); }} className={cn("px-3 py-1 text-[11px] font-bold rounded transition-all", viewTab === "manage" && resourceType === "audio" ? "bg-surface-raised shadow-sm text-text border border-border-soft" : "text-text-subtle hover:text-text")}>音频库</button>
                </div>

              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                {studioMode !== "standard" && (
                  <button onClick={() => setIsRightPanelOpen(false)} className="ml-2 p-1.5 rounded-full hover:bg-surface-app text-text-subtle hover:text-text transition-colors" title="收起素材库">
                    <PanelRightClose className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            
          <div className="flex min-h-0 flex-1 gap-0 overflow-hidden">
            {viewTab === "preview" ? (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center bg-surface-panel p-6 overflow-y-auto relative">
                 {activeGenerationTask ? (
                   <div className="flex flex-col items-center justify-center w-full h-full max-w-md mx-auto animate-in fade-in duration-500">
                      <div className="relative mb-8">
                        <div className="absolute inset-0 bg-brand/20 blur-xl rounded-full"></div>
                        <Loader2 className="w-16 h-16 text-brand animate-spin relative z-10" />
                      </div>
                      <h3 className="text-xl font-bold text-text mb-2 tracking-wide">视频生成中</h3>
                      <p className="text-sm text-text-subtle mb-8 text-center px-4">
                        正在调度视频生成任务，请耐心等待...
                      </p>
                      
                      <div className="w-full bg-surface-raised rounded-2xl p-6 shadow-inner border border-white/5 relative overflow-hidden">
                        <div className="flex items-center justify-between mb-3">
                           <div className="flex items-center gap-2 text-brand">
                             <Clock className="w-4 h-4" />
                             <span className="text-sm font-bold">已用时: {elapsedTime} 秒</span>
                           </div>
                           <span className="text-xs font-bold text-text-muted">预计 180 秒</span>
                        </div>
                        
                        <div className="h-2 w-full bg-surface-app rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-brand transition-all ease-linear duration-1000" 
                            style={{ width: `${Math.min(100, (elapsedTime / 180) * 100)}%` }}
                          ></div>
                        </div>
                      </div>
                   </div>
                 ) : displayAsset ? (
                   <div className="flex flex-col items-center max-w-full w-full mt-4">
                     <div className="relative mb-4 shrink-0">
                       <video src={assetPreviewUrl(project?.id ?? "", displayAsset.relativePath)} controls autoPlay loop className="max-h-[55vh] object-contain rounded-xl shadow-2xl bg-black/20" />
                       {isLastGenerated && (
                         <div className="absolute -top-3 -left-3 bg-brand text-[#04202a] text-[10px] font-black px-2 py-1 rounded-lg shadow-lg border border-brand/20 rotate-[-5deg] z-10">上次生成</div>
                       )}
                     </div>
                     
                     <div className="w-full max-w-4xl shrink-0 bg-surface-raised/80 p-2.5 pr-3 rounded-xl border border-border flex items-center justify-between gap-4 text-[11px] text-text-subtle shadow-sm relative overflow-hidden">
                       <div className="absolute top-0 left-0 w-1 h-full bg-brand/50"></div>
                       
                       <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pl-3 flex-1 min-w-0">
                         {previewMetadata?.prompt && (
                           <div className="flex items-center min-w-0">
                             <span className="font-bold text-text-muted mr-1.5 shrink-0">Prompt:</span>
                             <span className="text-text truncate max-w-[200px]" title={previewMetadata.prompt}>{previewMetadata.prompt}</span>
                           </div>
                         )}
                         
                         <div className="flex items-center shrink-0">
                           <span className="font-bold text-text-muted mr-1.5">Model:</span>
                           <span className="bg-surface-app px-1.5 py-0.5 rounded text-text">{previewMetadata?.model || "default"}</span>
                         </div>
                         
                         <div className="flex items-center shrink-0">
                           <span className="font-bold text-text-muted mr-1.5">Mode:</span>
                           <span className="bg-surface-app px-1.5 py-0.5 rounded text-text">{previewMetadata?.mode || "-"}</span>
                         </div>
                         
                         {previewMetadata?.seed !== undefined && (
                           <div className="flex items-center shrink-0">
                             <span className="font-bold text-text-muted mr-1.5">Seed:</span>
                             <span className="bg-surface-app px-1.5 py-0.5 rounded text-text">{previewMetadata.seed}</span>
                           </div>
                         )}
                         
                         <div className="flex items-center min-w-0 shrink-0">
                           <span className="font-bold text-text-muted mr-1.5 shrink-0">File:</span>
                           <span className="truncate max-w-[120px]" title={displayAsset.fileName}>{displayAsset.fileName}</span>
                         </div>
                       </div>

                       <div className="shrink-0 pl-3 border-l border-white/5">
                         <Button 
                           variant="outline" 
                           size="sm" 
                           className="text-red-400 hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-500 text-[11px] h-7 px-3 rounded-lg"
                           onClick={() => {
                             void deleteAssetsAndClearPreview([displayAsset.relativePath]);
                             setPreviewAsset(null);
                           }}
                         >
                           <Trash2 className="w-3.5 h-3.5 mr-1" />
                           废弃
                         </Button>
                       </div>
                     </div>
                   </div>
                 ) : (
                   <div className="flex flex-col items-center text-text-subtle opacity-60">
                      <FileVideo className="w-16 h-16 mb-4 opacity-50" />
                      <p className="text-sm font-medium">暂无当前视频</p>
                      <p className="text-xs mt-1">请生成新视频或从管理面板选择</p>
                   </div>
                 )}
              </div>
            ) : (
            <AssetManagerPanel
              assets={currentAssets}
              disabled={!project}
              rootPath={currentRoot}
              title={resourceType === "video" ? "视频管理" : resourceType === "image" ? "图片管理" : "音频管理"}
              defaultTargetFolder={currentImportFolder}
              assetTypeFilter={resourceType}
              showTypeFilter={false}
              showDirectoryTree={false}
              importAccept={resourceType === "video" ? "video/*" : resourceType === "image" ? "image/*" : "audio/*"}
              onScanAssets={onScanAssets}
              onImportAssets={onImportAssets}
              onDeleteAssets={async (paths) => {
                await onDeleteAssets(paths);
                if (previewAsset && paths.includes(previewAsset.relativePath)) setPreviewAsset(null);
              }}
              onMoveAssets={onMoveAssets}
              onSelectAsset={(asset) => {
                onSelectAsset?.(asset);
                openPreview(asset);
              }}
              onAssetDragStart={writeAssetDragData}
            />
            )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>

      {!isRightPanelOpen && studioMode !== "standard" && (
        <button 
          onClick={() => setIsRightPanelOpen(true)}
          className="absolute right-0 top-1/2 -translate-y-1/2 p-2.5 bg-surface-panel border-y border-l border-border rounded-l-2xl shadow-xl hover:bg-surface-raised hover:text-brand transition-all duration-300 z-50 flex items-center justify-center text-text-subtle group"
          title="展开素材库"
        >
          <ChevronLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
        </button>
      )}

      <AnimatePresence>
      {previewAsset && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-6" onClick={() => setPreviewAsset(null)}>
          {previewAsset.assetType === "video" ? (
             <video src={assetPreviewUrl(previewAsset.projectId, previewAsset.relativePath)} controls autoPlay className="max-h-[95vh] max-w-[95vw] object-contain shadow-2xl cursor-default" onClick={(e) => e.stopPropagation()} />
          ) : (
             <motion.img 
               initial={{ scale: 0.95, opacity: 0 }} 
               animate={{ scale: 1, opacity: 1 }} 
               exit={{ scale: 0.95, opacity: 0 }} 
               src={assetPreviewUrl(previewAsset.projectId, previewAsset.relativePath)} 
               alt={previewAsset.fileName} 
               className="max-h-[95vh] max-w-[95vw] object-contain shadow-2xl cursor-default" 
               onClick={(e) => e.stopPropagation()}
             />
          )}
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}
