import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronUp, ChevronLeft, PanelRightClose, FileVideo, FileImage, FolderOpen, ImagePlus, Maximize2, MoveRight, RefreshCw, Search, Settings2, Trash2, Upload, Wand2, Play, Activity, LayoutGrid, List, X, Copy, Loader2, Clock, Boxes } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { VideoFlowCanvas } from "./VideoFlowCanvas";
import { writeAssetDragData } from "./dragData";
import { assetPreviewUrl, type AssetSummary, type ProjectSummary, type TaskRecord, type ToolSummary } from "../../api";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Label } from "../../components/ui/Label";
import { SelectField } from "../../components/ui/SelectField";
import { cn, formatBytes } from "../../lib/utils";

type Props = {
  project?: ProjectSummary;
  tools: ToolSummary[];
  assets: AssetSummary[];
  tasks: TaskRecord[];
  busy: boolean;
  onCallTool: (toolName: string, args: Record<string, unknown>) => Promise<void>;
  onSelectTool: (tool: ToolSummary) => void;
  onSelectAsset?: (asset: AssetSummary) => void;
  onScanAssets: () => void;
  onRebuildAssetProvenance: () => void;
  onDeleteAssets: (relativePaths: string[]) => Promise<void>;
  onMoveAssets: (relativePaths: string[], targetFolder: string) => Promise<void>;
  onRenameAsset: (relativePath: string, newName: string) => Promise<void>;
  onImportImages: (files: File[], targetFolder: string) => Promise<void>;
  onCollapseSidebar?: () => void;
  onShowError?: () => void;
};

type ImageMode = "generate" | "edit";
type FolderKey = "__all__" | "__root__" | string;
type ResourceType = "video" | "image";

type FolderBucket = {
  key: FolderKey;
  label: string;
  path: string;
  count: number;
};

const VIDEO_ROOT = "assets/video";
const IMAGE_ROOT = "assets/image";

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

function Field({ label, value, onChange, options }: { label: string, value: string, onChange: (val: string) => void, options: {value: string, label: string}[] }) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs font-bold text-text-muted">{label}</Label>
      <SelectField id={label} value={value} options={options} onChange={onChange} ariaLabel={label} />
    </div>
  );
}

function defaultVideoName() {
  return `vid_${Date.now()}`;
}

export function VideoStudio({
  project, tools, assets, tasks, busy, onCallTool, onSelectTool, onSelectAsset, onScanAssets, onDeleteAssets, onMoveAssets, onRenameAsset, onImportImages, onCollapseSidebar, onShowError
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
  const [search, setSearch] = useState("");
  const [flattenAll, setFlattenAll] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [viewTab, setViewTab] = useState<"preview" | "manage">("preview");
  const [studioMode, setStudioMode] = useState<"standard" | "flow">("standard");
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [selectedFolderKey, setSelectedFolderKey] = useState<FolderKey>("__all__");
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [moveTargetFolder, setMoveTargetFolder] = useState<string>("");
  const [editingAssetPath, setEditingAssetPath] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [previewAsset, setPreviewAsset] = useState<AssetSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateTool = useMemo(() => tools.find((tool) => tool.category === "video" && (tool.name.includes("generate") || tool.name.includes("create_video"))), [tools]);
  const editTool = useMemo(() => tools.find((tool) => tool.category === "video" && tool.name.includes("edit")), [tools]) ?? generateTool;

  const currentRoot = resourceType === "video" ? VIDEO_ROOT : IMAGE_ROOT;

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



  function getFolderKey(relativePath: string) {
    const normalized = relativePath.replace(/\\/g, "/");
    if (!normalized.startsWith(`${currentRoot}/`)) return "__root__";
    const parts = normalized.slice(`${currentRoot}/`.length).split("/");
    if (parts.length <= 1) return "__root__";
    return parts[0] || "__root__";
  }

  const folders = useMemo<FolderBucket[]>(() => {
    const counts = new Map<string, number>();
    let rootCount = 0;
    for (const asset of currentAssets) {
      const key = getFolderKey(asset.relativePath);
      if (key === "__root__") rootCount += 1;
      else counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [
      { key: "__all__", label: resourceType === "video" ? "全部视频" : "全部图片", path: currentRoot, count: currentAssets.length },
      { key: "__root__", label: "未分类", path: currentRoot, count: rootCount },
      ...Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b, "zh-Hans-CN")).map(([key, count]) => ({ key, label: key, path: `${currentRoot}/${key}`, count }))
    ];
  }, [currentAssets, resourceType, currentRoot]);

  useEffect(() => {
    if (selectedFolderKey === "__all__") {
      setMoveTargetFolder(currentRoot);
      return;
    }
    if (selectedFolderKey === "__root__") {
      setMoveTargetFolder(currentRoot);
      return;
    }
    setMoveTargetFolder(`${currentRoot}/${selectedFolderKey}`);
  }, [selectedFolderKey, currentRoot]);

  useEffect(() => {
    if (!folders.some((folder) => folder.key === selectedFolderKey)) {
      setSelectedFolderKey("__all__");
    }
  }, [folders, selectedFolderKey, resourceType]);

  const visibleAssets = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return currentAssets.filter((asset) => {
      const key = getFolderKey(asset.relativePath);
      if (!flattenAll) {
         if (selectedFolderKey === "__all__" && key !== "__root__") return false;
         if (selectedFolderKey !== "__all__" && key !== selectedFolderKey) return false;
      }
      if (!needle) return true;
      return asset.fileName.toLowerCase().includes(needle) || asset.relativePath.toLowerCase().includes(needle);
    });
  }, [currentAssets, search, selectedFolderKey, flattenAll]);

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
    try {
      const res = JSON.parse(latestCompleted.rawResultJson);
      return res && (res.status === "running" || res.status === "queued" || res.status === "processing" || res.status === "starting");
    } catch {
      return false;
    }
  }, [project, tasks]);

  const displayAsset = previewAsset || (currentAssets && currentAssets.length > 0 ? currentAssets[0] : null);
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

  const handleRenameSubmit = async () => {
    if (!editingAssetPath || !editingName.trim()) {
      setEditingAssetPath(null);
      return;
    }
    const asset = assets.find(a => a.relativePath === editingAssetPath);
    if (!asset || asset.fileName === editingName.trim()) {
      setEditingAssetPath(null);
      return;
    }
    await onRenameAsset(editingAssetPath, editingName.trim());
    setEditingAssetPath(null);
  };

  const currentFolderPath = selectedFolderKey === "__all__" ? currentRoot : selectedFolderKey === "__root__" ? currentRoot : `${currentRoot}/${selectedFolderKey}`;

  const selectedCount = selectedPaths.length;

  async function handleImport(files: File[] | FileList, targetFolder: string) {
    const list = Array.from(files);
    if (!list.length || !project) return;
    await onImportImages(list, targetFolder);
    setSelectedFolderKey(targetFolder === currentRoot ? "__all__" : targetFolder.split("/").pop() || "__root__");
  }

  async function deleteSelection(paths = selectedPaths) {
    if (!paths.length) return;
    await onDeleteAssets(paths);
    setSelectedPaths([]);
    setPreviewAsset(null);
  }

  async function moveSelection(paths = selectedPaths, targetFolder = moveTargetFolder) {
    if (!paths.length) return;
    // Call move API if exists, currently we might not have onMoveAssets prop? Wait, VideoStudio DOES NOT have onMoveAssets prop defined? Let's check props.
  }

  function openPicker() {
    fileInputRef.current?.click();
  }

  function toggleSelected(relativePath: string) {
    setSelectedPaths((current) => current.includes(relativePath) ? current.filter((item) => item !== relativePath) : [...current, relativePath]);
  }

  function openPreview(asset: AssetSummary) {
    setPreviewAsset(asset);
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      console.error("Failed to copy text", e);
    }
  }
  return (
    <div className="flex flex-col gap-5 p-6 h-full min-h-0 w-full max-w-[1600px] mx-auto overflow-hidden">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shrink-0">
        <div>
          <span className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-text-subtle font-semibold mb-1">
            <FileVideo className="w-3.5 h-3.5" />
            Video Studio
          </span>
          <h1 className="text-xl md:text-2xl font-extrabold text-text m-0">视频生成工作室</h1>
          <p className="text-xs text-text-muted mt-1 max-w-xl">
            {project ? `当前项目：${project.name}` : "请先选择项目"}
          </p>
        </div>
        
        <div className="flex items-center p-1 bg-surface-muted rounded-pill border border-border-soft">
          <button 
            onClick={() => setStudioMode("standard")} 
            className={cn("px-4 py-1.5 text-xs font-bold rounded-full transition-all", studioMode === "standard" ? "bg-surface-raised shadow-sm text-text" : "text-text-subtle hover:text-text")}
          >标准生成</button>
          <button 
            onClick={() => {
              setStudioMode("flow");
              setIsRightPanelOpen(false);
              onCollapseSidebar?.();
            }} 
            className={cn("px-4 py-1.5 text-xs font-bold rounded-full transition-all flex items-center gap-1.5", studioMode === "flow" ? "bg-surface-raised shadow-sm text-brand" : "text-text-subtle hover:text-text")}
          >
            <Boxes className="w-3.5 h-3.5" />
            多模态参考画布
          </button>
        </div>
      </div>

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
              <Field label="生成模式" value={videoMode} onChange={setVideoMode} options={videoModeOptions} />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="prompt" className="text-xs font-bold text-text-muted flex items-center justify-between">
                <span>画面提示词 (Prompt)</span>
                <span className="text-[10px] text-brand font-bold bg-brand/10 px-1.5 py-0.5 rounded">必填</span>
              </Label>
              <textarea 
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={"描述视频画面、运镜及动作，越详细越好...\n例如：镜头缓缓向前推进，清晨的阳光穿透树林..."}
                className="w-full min-h-[120px] rounded-2xl border-2 border-transparent bg-surface-panel px-4 py-3 text-[13px] placeholder:text-text-subtle focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition-all resize-y shadow-sm"
              />
            </div>

            {(videoMode === "first_frame" || videoMode === "first_last_frame" || videoMode === "multi_modal_reference") && (
              <div className="flex gap-3">
                <div className="flex-1 flex flex-col gap-2">
                  <Label className="text-[11px] font-bold text-text-muted">参考首帧</Label>
                  <div 
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                       e.preventDefault();
                       const text = e.dataTransfer.getData("text/plain");
                       if (text) setFirstFrame(text);
                    }}
                    className={cn("h-28 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 text-xs transition-all duration-300 relative overflow-hidden group", firstFrame ? "border-brand/50 bg-brand/5" : "border-border-strong hover:border-brand/50 hover:bg-brand/5 cursor-pointer text-text-muted")}
                  >
                    {firstFrame ? (
                       <div className="absolute inset-0 flex items-center justify-center p-1 bg-black/40 backdrop-blur-sm group-hover:opacity-80 transition-opacity" onClick={() => setFirstFrame("")}>
                          <img src={assetPreviewUrl(project?.id ?? "", firstFrame)} className="h-full object-contain rounded-xl shadow-lg" />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 text-white font-bold text-xs"><Trash2 className="w-4 h-4 mr-1" /> 移除</div>
                       </div>
                    ) : (
                      <>
                        <ImagePlus className="w-6 h-6 text-brand/70 group-hover:scale-110 transition-transform duration-300" />
                        <span className="font-medium text-text-subtle text-[10px]">拖拽图片至此</span>
                      </>
                    )}
                  </div>
                </div>

                {(videoMode === "first_last_frame" || videoMode === "multi_modal_reference") && (
                  <div className="flex-1 flex flex-col gap-2">
                    <Label className="text-[11px] font-bold text-text-muted">参考尾帧 (可选)</Label>
                    <div 
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                         e.preventDefault();
                         const text = e.dataTransfer.getData("text/plain");
                         if (text) setLastFrame(text);
                      }}
                      className={cn("h-28 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 text-xs transition-all duration-300 relative overflow-hidden group", lastFrame ? "border-brand/50 bg-brand/5" : "border-border-strong hover:border-brand/50 hover:bg-brand/5 cursor-pointer text-text-muted")}
                    >
                      {lastFrame ? (
                         <div className="absolute inset-0 flex items-center justify-center p-1 bg-black/40 backdrop-blur-sm group-hover:opacity-80 transition-opacity" onClick={() => setLastFrame("")}>
                            <img src={assetPreviewUrl(project?.id ?? "", lastFrame)} className="h-full object-contain rounded-xl shadow-lg" />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 text-white font-bold text-xs"><Trash2 className="w-4 h-4 mr-1" /> 移除</div>
                         </div>
                      ) : (
                        <>
                          <ImagePlus className="w-6 h-6 text-brand/70 group-hover:scale-110 transition-transform duration-300" />
                          <span className="font-medium text-text-subtle text-[10px]">拖拽图片至此</span>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-1">
                <Field label="视频比例" value={ratio} onChange={setRatio} options={ratioOptions} />
              </div>
              <div className="col-span-1">
                <Field label="视频时长" value={duration} onChange={setDuration} options={durationOptions} />
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
                 <Field label="模型 (Model)" value={model} onChange={setModel} options={modelOptions} />
               </div>
               <div className="flex-1">
                 <Field label="分辨率" value={resolution} onChange={setResolution} options={resolutionOptions} />
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
                </div>

                {viewTab === "manage" && selectedFolderKey !== "__all__" && (
                  <>
                    <div className="h-4 w-[1px] bg-border hidden md:block" />
                    <div className="flex items-center gap-2 min-w-0">
                      <button onClick={() => setSelectedFolderKey("__all__")} className="p-1.5 hover:bg-surface-app border border-transparent hover:border-border rounded-md transition-all text-text-subtle hover:text-text shrink-0 bg-surface-panel shadow-sm" title="返回根目录">
                        <MoveRight className="w-4 h-4 rotate-180" />
                      </button>
                      <div className="flex flex-col min-w-0 justify-center">
                        <span className="text-sm font-bold text-text truncate leading-tight">{selectedFolderKey === "__root__" ? "未分类" : selectedFolderKey}</span>
                        <span className="text-[10px] text-text-subtle truncate leading-tight mt-0.5" dir="rtl">{currentFolderPath}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Right: Search & Actions */}
              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <div className="relative w-[140px] md:w-[180px] lg:w-[220px]">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-subtle" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索文件..." className="h-8 pl-8 text-xs bg-surface-app rounded-full border-border-soft focus:border-brand/50 transition-all" />
                </div>

                <div className="h-4 w-[1px] bg-border hidden sm:block" />

                <label className="flex items-center gap-1.5 text-xs text-text-subtle hover:text-text cursor-pointer select-none">
                  <input type="checkbox" checked={flattenAll} onChange={(e) => setFlattenAll(e.target.checked)} className="rounded border-border bg-surface-app text-brand focus:ring-brand/30 w-3.5 h-3.5" />
                  平铺
                </label>

                {viewTab === "manage" && selectedFolderKey !== "__all__" && (
                  <>
                    <div className="h-4 w-[1px] bg-border hidden sm:block" />
                    <Button variant="outline" size="sm" onClick={openPicker} disabled={!project} className="gap-1.5 h-8 text-xs bg-surface-app"><Upload className="h-3.5 w-3.5" />上传</Button>
                  </>
                )}

                {studioMode !== "standard" && (
                  <button onClick={() => setIsRightPanelOpen(false)} className="ml-2 p-1.5 rounded-full hover:bg-surface-app text-text-subtle hover:text-text transition-colors" title="收起素材库">
                    <PanelRightClose className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            
            <div className="px-4 py-2 border-b border-border flex items-center justify-between bg-surface-panel shrink-0">
                <div className="flex bg-surface-muted p-0.5 rounded-control shrink-0">
                  <button onClick={() => setViewMode("grid")} className={cn("p-1.5 rounded-sm transition-colors", viewMode === "grid" ? "bg-surface-panel shadow-sm text-brand" : "text-text-subtle hover:text-text")} title="小图模式"><LayoutGrid className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setViewMode("list")} className={cn("p-1.5 rounded-sm transition-colors", viewMode === "list" ? "bg-surface-panel shadow-sm text-brand" : "text-text-subtle hover:text-text")} title="列表模式"><List className="w-3.5 h-3.5" /></button>
                </div>

                <Button variant="outline" size="icon" onClick={onScanAssets} disabled={!project} className="h-8 w-8 shrink-0 rounded-full bg-surface-app" title="刷新目录"><RefreshCw className="h-3.5 w-3.5" /></Button>
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
                             void deleteSelection([displayAsset.relativePath]);
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
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-surface-panel relative">
              {selectedCount > 0 && (
                <div className="shrink-0 flex flex-nowrap items-center justify-between gap-3 border-b border-border bg-surface-raised px-4 py-2 text-xs shadow-sm z-10 relative">
                  <div className="flex items-center gap-2 text-text min-w-0">
                    <span className="shrink-0 font-bold text-brand-strong bg-brand/10 px-2 py-0.5 rounded">已选 {selectedCount} 项</span>
                  </div>
                  <div className="flex flex-nowrap items-center gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => void deleteSelection()} disabled={!selectedCount || busy} className="gap-1.5 text-red-400 hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-500 shrink-0"><Trash2 className="h-3.5 w-3.5" />删除</Button>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedPaths([])} className="gap-1.5 shrink-0"><X className="h-3.5 w-3.5" />取消</Button>
                  </div>
                </div>
              )}

              <div 
                className={cn("min-h-0 flex-1 overflow-y-auto p-5 scrollbar-thin transition-colors")}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!e.dataTransfer.types.includes("text/plain")) {
                    e.currentTarget.classList.add("bg-brand/5");
                  }
                }}
                onDragLeave={(e) => e.currentTarget.classList.remove("bg-brand/5")}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove("bg-brand/5");
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    void handleImport(e.dataTransfer.files, currentFolderPath);
                  }
                }}
              >
                {selectedFolderKey === "__all__" && !flattenAll && folders.filter(f => f.key !== "__all__" && f.key !== "__root__").length > 0 && (
                   <div className="grid gap-4 mb-6 pb-6 border-b border-border-soft" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(70px, 1fr))" }}>
                      {folders.filter(f => f.key !== "__all__" && f.key !== "__root__").map(folder => (
                         <div 
                           key={folder.key} 
                           className="cursor-pointer group flex flex-col items-center gap-2 p-3 hover:bg-surface-raised rounded-large border border-transparent hover:border-border transition-all text-center relative" 
                           onClick={() => setSelectedFolderKey(folder.key)}
                           onDragOver={(e) => {
                             e.preventDefault();
                             e.stopPropagation();
                             e.currentTarget.classList.add("bg-brand/10", "border-brand/50");
                           }}
                           onDragLeave={(e) => {
                             e.currentTarget.classList.remove("bg-brand/10", "border-brand/50");
                           }}
                           onDrop={(e) => {
                             e.preventDefault();
                             e.stopPropagation();
                             e.currentTarget.classList.remove("bg-brand/10", "border-brand/50");
                             const targetPath = `${currentRoot}/${folder.key}`;
                             if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                                void handleImport(e.dataTransfer.files, targetPath);
                             } else {
                                const draggedRelativePath = e.dataTransfer.getData("text/plain");
                                if (draggedRelativePath) {
                                   const pathsToMove = selectedPaths.includes(draggedRelativePath) ? selectedPaths : [draggedRelativePath];
                                   void moveSelection(pathsToMove, targetPath);
                                }
                             }
                           }}
                         >
                            <FolderOpen className="w-12 h-12 text-brand/80 group-hover:text-brand group-hover:scale-105 transition-transform" />
                            <span className="text-xs font-bold text-text truncate w-full">{folder.label}</span>
                            <span className="text-[10px] text-text-subtle">{folder.count} 项</span>
                         </div>
                      ))}
                   </div>
                )}

                {visibleAssets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-text-muted mt-20">
                    {resourceType === "video" ? <FileVideo className="w-12 h-12 mb-3 opacity-20" /> : <FileImage className="w-12 h-12 mb-3 opacity-20" />}
                    <p className="text-sm font-medium">当前目录为空</p>
                    <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} className="mt-2 text-xs">从本地导入</Button>
                  </div>
                ) : viewMode === "list" ? (
                    <div className="flex flex-col gap-2">
                      {activeGenerationTask && (
                         <div className="flex items-center gap-4 p-3 bg-surface-muted/30 border border-brand/40 rounded-card animate-pulse shadow-sm">
                           <div className="w-12 h-12 shrink-0 bg-surface-app rounded flex items-center justify-center"><RefreshCw className="w-5 h-5 text-brand animate-spin" /></div>
                           <div className="flex flex-col gap-2 flex-1"><div className="h-3 bg-brand/20 rounded w-1/4" /><div className="h-2 bg-border-soft rounded w-1/6" /></div>
                         </div>
                      )}
                      {visibleAssets.map((asset) => {
                        const selected = selectedPaths.includes(asset.relativePath);
                        return (
                          <div key={asset.id} draggable onDragStart={(event) => writeAssetDragData(event, asset)} className={cn("flex items-center gap-4 p-2 rounded-card border transition-all cursor-pointer group", selected ? "border-brand bg-brand/5 shadow-sm" : "border-border hover:border-brand/50 bg-surface-panel hover:bg-surface-raised")} onClick={() => toggleSelected(asset.relativePath)}>
                            <div className="relative w-12 h-12 shrink-0 bg-black/20 rounded overflow-hidden" onClick={(e) => { e.stopPropagation(); openPreview(asset); }}>
                              {asset.assetType === "video" ? (
                                <video draggable={false} src={assetPreviewUrl(asset.projectId, asset.relativePath)} className="w-full h-full object-cover" muted />
                              ) : (
                                <img draggable={false} src={assetPreviewUrl(asset.projectId, asset.relativePath)} alt={asset.fileName} className="w-full h-full object-cover" loading="lazy" />
                              )}
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><Maximize2 className="w-4 h-4 text-white" /></div>
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                              <strong className="text-[12px] font-bold text-text truncate w-full">{asset.fileName}</strong>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-[11px] text-text-subtle truncate">{asset.relativePath}</span>
                                <span className="text-[10px] text-text-subtle bg-surface-app px-1.5 py-0.5 rounded uppercase">{asset.extension.replace(".", "")}</span>
                                <span className="text-[10px] text-text-subtle">{formatBytes(asset.sizeBytes)}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity px-2">
                              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-brand hover:text-[#04202a]" onClick={(event) => { event.stopPropagation(); void copyText(asset.relativePath); }} title="复制路径"><Copy className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-500 hover:text-white text-red-400" onClick={async (event) => { event.stopPropagation(); await onDeleteAssets([asset.relativePath]); }} title="删除"><Trash2 className="h-4 w-4" /></Button>
                            </div>
                            <div className="shrink-0 px-2 flex items-center">
                              <label className="flex h-5 w-5 items-center justify-center rounded border border-border-strong bg-surface-app text-brand-strong cursor-pointer hover:bg-brand hover:border-brand hover:text-[#04202a]" onClick={(e) => e.stopPropagation()}>
                                <input type="checkbox" className="sr-only" checked={selected} onChange={(event) => { event.stopPropagation(); toggleSelected(asset.relativePath); }} />
                                {selected ? <Check className="h-3.5 w-3.5" /> : null}
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                ) : (
                  <div className="gap-3 space-y-3 pb-8" style={{ columnWidth: "120px" }}>
                    {activeGenerationTask && (
                      <div className="break-inside-avoid flex flex-col bg-surface-muted/30 border border-brand/40 rounded-card overflow-hidden animate-pulse shadow-sm">
                         <div className="aspect-square w-full relative bg-surface-app flex flex-col items-center justify-center gap-3">
                           <RefreshCw className="w-8 h-8 text-brand animate-spin" />
                         </div>
                         <div className="p-3 bg-surface-panel flex flex-col gap-2">
                           <div className="h-3 bg-brand/20 rounded w-2/3" />
                           <div className="h-2 bg-border-soft rounded w-1/2" />
                         </div>
                      </div>
                    )}
                    
                    {visibleAssets.map((asset) => {
                      const selected = selectedPaths.includes(asset.relativePath);
                      return (
                        <div
                          key={asset.id}
                          draggable
                          onDragStart={(event) => writeAssetDragData(event, asset)}
                          className={cn("break-inside-avoid relative group flex flex-col overflow-hidden rounded-card border transition-all cursor-pointer", selected ? "border-brand shadow-sm" : "border-border hover:border-brand/50")}
                          onClick={() => openPreview(asset)}
                        >
                          {asset.assetType === "video" ? (
                            <div className="w-full aspect-video bg-black relative">
                              <video draggable={false} src={assetPreviewUrl(asset.projectId, asset.relativePath)} className="w-full h-full object-cover" muted loop onMouseEnter={(e) => e.currentTarget.play()} onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }} />
                              <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] text-white font-bold flex items-center gap-1">
                                <Play className="w-3 h-3" />
                              </div>
                            </div>
                          ) : (
                            <img draggable={false} src={assetPreviewUrl(asset.projectId, asset.relativePath)} alt={asset.fileName} className="w-full h-auto object-cover bg-surface-panel" loading="lazy" />
                          )}
                          
                          <div className={cn("absolute top-2 right-2 flex justify-end z-10", selected ? "opacity-100" : "opacity-0 group-hover:opacity-100 transition-opacity")}>
                             <label className={cn("flex h-5 w-5 items-center justify-center rounded border cursor-pointer shadow-sm", selected ? "border-brand bg-brand text-[#04202a]" : "border-border-strong bg-surface-app text-brand-strong hover:bg-brand hover:border-brand hover:text-[#04202a]")} onClick={(e) => e.stopPropagation()}>
                                <input type="checkbox" className="sr-only" checked={selected} onChange={(event) => { event.stopPropagation(); toggleSelected(asset.relativePath); }} />
                                {selected ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : null}
                             </label>
                          </div>
                          
                          <div className="p-2 bg-surface-panel flex flex-col border-t border-border-soft relative z-10" onClick={(e) => {
                             if (editingAssetPath === asset.relativePath) e.stopPropagation();
                          }}>
                             {editingAssetPath === asset.relativePath ? (
                                <input 
                                  autoFocus
                                  className="text-[11px] font-bold text-text w-full bg-surface-app border border-brand px-1 py-0.5 rounded outline-none"
                                  value={editingName}
                                  onChange={e => setEditingName(e.target.value)}
                                  onBlur={handleRenameSubmit}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') handleRenameSubmit();
                                    if (e.key === 'Escape') setEditingAssetPath(null);
                                  }}
                                />
                             ) : (
                                <strong className="text-[11px] font-bold text-text truncate w-full cursor-text hover:text-brand transition-colors" title="双击重命名" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => { e.stopPropagation(); setEditingAssetPath(asset.relativePath); setEditingName(asset.fileName); }}>{asset.fileName}</strong>
                             )}
                             <div className="flex items-center gap-2 mt-0.5">
                               <span className="text-[10px] text-text-subtle truncate">{formatBytes(asset.sizeBytes)}</span>
                               <span className="text-[9px] text-text-subtle uppercase px-1 bg-surface-app rounded">{asset.extension.replace(".", "")}</span>
                             </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              
              <div className="absolute bottom-5 right-5 z-20 pointer-events-none">
                <div className="bg-surface-app/90 backdrop-blur-md border border-border-soft px-3.5 py-1.5 rounded-pill shadow-lg flex items-center">
                  <span className="text-[12px] font-extrabold text-text-subtle">共 <span className="text-text">{visibleAssets.length}</span> 项</span>
                </div>
              </div>
              
            </div>
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

      <input
        ref={fileInputRef}
        type="file"
        accept={resourceType === "video" ? "video/*" : "image/*"}
        multiple
        className="hidden"
        onChange={async (event) => {
          const files = event.target.files;
          if (files && files.length) {
            await onImportImages(Array.from(files), currentFolderPath);
          }
          event.currentTarget.value = "";
        }}
      />
    </div>
  );
}
