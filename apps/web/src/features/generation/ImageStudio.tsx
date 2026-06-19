import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, ChevronUp, FileImage, FolderOpen, ImagePlus, Maximize2, MoveRight, RefreshCw, Search, Settings2, Trash2, Upload, Wand2, Play, Activity, LayoutGrid, List, Layers, X, Loader2, Clock, ImageIcon, Copy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { assetPreviewUrl, type AssetSummary, type ProjectSummary, type TaskRecord, type ToolSummary } from "../../api";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Label } from "../../components/ui/Label";
import { SelectField } from "../../components/ui/SelectField";
import { cn } from "../../lib/utils";

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
};

type ImageMode = "generate" | "batch" | "edit";
type FolderKey = "__all__" | "__root__" | string;
type ImageModelValue = "auto" | "nanobanana" | "gpt";
type ResolutionValue = "0.5K" | "1K" | "2K" | "4K";
type ThinkingValue = "minimal" | "high";

type FolderBucket = {
  key: FolderKey;
  label: string;
  path: string;
  count: number;
};

const IMAGE_ROOT = "assets/image";
const DEFAULT_IMPORT_FOLDER = "assets/image/maker_plus";

const targetSizeOptions = [
  { value: "512x512", label: "512 x 512" },
  { value: "1024x1024", label: "1024 x 1024" },
  { value: "1536x1536", label: "1536 x 1536" },
  { value: "1920x1080", label: "1920 x 1080" },
  { value: "1080x1920", label: "1080 x 1920" }
];

const aspectRatioOptions = [
  { value: "1:1", label: "1:1" },
  { value: "2:3", label: "2:3" },
  { value: "3:2", label: "3:2" },
  { value: "3:4", label: "3:4" },
  { value: "4:3", label: "4:3" },
  { value: "9:16", label: "9:16" },
  { value: "16:9", label: "16:9" },
  { value: "21:9", label: "21:9" },
  { value: "5:4", label: "5:4" },
  { value: "4:5", label: "4:5" }
];

const modelOptions = [
  { value: "auto", label: "自动选择 (Auto)" },
  { value: "nanobanana", label: "Nano Banana 2 / Gemini" },
  { value: "gpt", label: "GPT Image 2 / OpenAI" }
];

const resolutionOptions = [
  { value: "0.5K", label: "0.5K" },
  { value: "1K", label: "1K" },
  { value: "2K", label: "2K" },
  { value: "4K", label: "4K" }
];

const thinkingOptions = [
  { value: "minimal", label: "minimal" },
  { value: "high", label: "high" }
];

export function ImageStudio({
  project,
  tools,
  assets,
  tasks,
  busy,
  onCallTool,
  onSelectTool,
  onSelectAsset,
  onScanAssets,
  onRebuildAssetProvenance,
  onDeleteAssets,
  onMoveAssets,
  onRenameAsset,
  onImportImages
}: Props) {
  const [mode, setMode] = useState<ImageMode>("generate");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [batchPrompts, setBatchPrompts] = useState("");
  const [editSourceImage, setEditSourceImage] = useState("");
  const [name, setName] = useState("");
  const [targetSize, setTargetSize] = useState("1024x1024");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [transparent, setTransparent] = useState(false);
  const [seed, setSeed] = useState("");
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingValue>("minimal");
  const [resolution, setResolution] = useState<ResolutionValue>("1K");
  const [model, setModel] = useState<ImageModelValue>("auto");
  const [referenceImage, setReferenceImage] = useState("");
  const [search, setSearch] = useState("");
  const [flattenAll, setFlattenAll] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [viewTab, setViewTab] = useState<"preview" | "manage">("preview");
  const [selectedFolderKey, setSelectedFolderKey] = useState<FolderKey>("__all__");
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [moveTargetFolder, setMoveTargetFolder] = useState(DEFAULT_IMPORT_FOLDER);
  const [editingAssetPath, setEditingAssetPath] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>("");
  
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
  const [lightboxAsset, setLightboxAsset] = useState<AssetSummary | null>(null);

  const [elapsedTime, setElapsedTime] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateTool = useMemo(() => tools.find((tool) => tool.name === "generate_image"), [tools]);
  const batchTool = useMemo(() => tools.find((tool) => tool.name === "batch_generate_images"), [tools]);
  const editTool = useMemo(() => tools.find((tool) => tool.name === "edit_image"), [tools]);

  useEffect(() => {
    if (selectedFolderKey === "__all__") {
      setMoveTargetFolder(DEFAULT_IMPORT_FOLDER);
      return;
    }
    if (selectedFolderKey === "__root__") {
      setMoveTargetFolder(IMAGE_ROOT);
      return;
    }
    setMoveTargetFolder(`${IMAGE_ROOT}/${selectedFolderKey}`);
  }, [selectedFolderKey]);

  const imageAssets = useMemo(() => {
    if (!project) return [];
    return assets
      .filter((asset) => {
        if (asset.projectId !== project.id || asset.assetType !== "image") return false;
        const normalized = asset.relativePath.replace(/\\/g, "/");
        return normalized.startsWith(`${IMAGE_ROOT}/`);
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
  }, [assets, project]);

  const folders = useMemo<FolderBucket[]>(() => {
    const counts = new Map<string, number>();
    let rootCount = 0;
    for (const asset of imageAssets) {
      const key = getFolderKey(asset.relativePath);
      if (key === "__root__") rootCount += 1;
      else counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [
      { key: "__all__", label: "全部图片", path: IMAGE_ROOT, count: imageAssets.length },
      { key: "__root__", label: "未分类", path: IMAGE_ROOT, count: rootCount },
      ...Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b, "zh-Hans-CN")).map(([key, count]) => ({ key, label: key, path: `${IMAGE_ROOT}/${key}`, count }))
    ];
  }, [imageAssets]);

  useEffect(() => {
    if (!folders.some((folder) => folder.key === selectedFolderKey)) {
      setSelectedFolderKey("__all__");
    }
  }, [folders, selectedFolderKey]);

  const visibleAssets = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return imageAssets.filter((asset) => {
      const key = getFolderKey(asset.relativePath);
      if (!flattenAll) {
         if (selectedFolderKey === "__all__" && key !== "__root__") return false;
         if (selectedFolderKey !== "__all__" && key !== selectedFolderKey) return false;
      }
      if (!needle) return true;
      return asset.fileName.toLowerCase().includes(needle) || asset.relativePath.toLowerCase().includes(needle);
    });
  }, [imageAssets, search, selectedFolderKey, flattenAll]);

  const assetMap = useMemo(() => new Map(imageAssets.map((asset) => [asset.relativePath, asset])), [imageAssets]);
  const selectedAssets = selectedPaths.map((path) => assetMap.get(path)).filter((asset): asset is AssetSummary => !!asset);
  const selectedCount = selectedPaths.length;
  const currentFolderPath = selectedFolderKey === "__all__" ? IMAGE_ROOT : selectedFolderKey === "__root__" ? IMAGE_ROOT : `${IMAGE_ROOT}/${selectedFolderKey}`;
  const activeGenerationTask = useMemo(() => {
    if (!project) return undefined;
    return tasks.find((task) => task.projectId === project.id && (task.toolName === "generate_image" || task.toolName === "batch_generate_images" || task.toolName === "edit_image") && (task.status === "queued" || task.status === "running"));
  }, [project, tasks]);

  const displayAsset = imageAssets && imageAssets.length > 0 ? imageAssets[0] : null;
  const isLastGenerated = displayAsset !== null;

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

  function handleGenerate() {
    if (!generateTool || !project || !prompt.trim()) return;
    const payload: Record<string, unknown> = {
      prompt: prompt.trim(),
      name: name.trim() || defaultImageName(),
      target_size: targetSize,
      aspect_ratio: aspectRatio,
      transparent,
      resolution,
      thinking_level: thinkingLevel
    };
    const numericSeed = seed.trim();
    if (numericSeed) payload.seed = Number(numericSeed);
    if (referenceImage.trim()) payload.reference_image = referenceImage.trim();
    if (model !== "auto") payload.model = model;
    void onCallTool(generateTool.name, payload);
  }

  function handleBatchGenerate() {
    if (!batchTool || !project || !batchPrompts.trim()) return;
    const prompts = batchPrompts.split("\n").map(p => p.trim()).filter(Boolean);
    if (!prompts.length) return;
    
    const payload = {
      images: prompts.map(p => {
         const obj: Record<string, unknown> = { prompt: p, name: defaultImageName(), target_size: targetSize, aspect_ratio: aspectRatio, transparent };
         if (resolution !== "1K") obj.resolution = resolution;
         if (thinkingLevel !== "minimal") obj.thinking_level = thinkingLevel;
         const numericSeed = seed.trim();
         if (numericSeed) obj.seed = Number(numericSeed);
         if (referenceImage.trim()) obj.reference_images = [referenceImage.trim()];
         if (model !== "auto") obj.model = model;
         return obj;
      })
    };
    void onCallTool(batchTool.name, payload);
  }

  function handleEditImage() {
    if (!editTool || !project || !prompt.trim() || !editSourceImage.trim()) return;
    const payload: Record<string, unknown> = {
      image: editSourceImage.trim(),
      prompt: prompt.trim(),
      name: name.trim() || defaultImageName(),
      target_size: targetSize,
      aspect_ratio: aspectRatio,
      transparent
    };
    if (resolution !== "1K") payload.resolution = resolution;
    if (thinkingLevel !== "minimal") payload.thinking_level = thinkingLevel;
    const numericSeed = seed.trim();
    if (numericSeed) payload.seed = Number(numericSeed);
    if (referenceImage.trim()) payload.reference_images = [referenceImage.trim()];
    if (model !== "auto") payload.model = model;
    void onCallTool(editTool.name, payload);
  }

  async function handleImport(files: File[] | FileList, targetFolder: string) {
    const list = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (!list.length || !project) return;
    await onImportImages(list, targetFolder);
    setSelectedFolderKey(folderKeyFromTarget(targetFolder));
  }

  async function deleteSelection(paths = selectedPaths) {
    if (!paths.length) return;
    await onDeleteAssets(paths);
    setSelectedPaths([]);
  }

  async function moveSelection(paths = selectedPaths, targetFolder = moveTargetFolder) {
    if (!paths.length) return;
    await onMoveAssets(paths, targetFolder);
    setSelectedPaths([]);
  }

  function openPicker() {
    fileInputRef.current?.click();
  }

  function toggleSelected(relativePath: string) {
    setSelectedPaths((current) => current.includes(relativePath) ? current.filter((item) => item !== relativePath) : [...current, relativePath]);
  }

  function openPreview(asset: AssetSummary) {
    setLightboxAsset(asset);
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  }

  function useSelectedImageAsReference() {
    const next = selectedAssets.find((asset) => asset.assetType === "image");
    if (next) setReferenceImage(next.relativePath);
  }

  return (
    <div className="flex flex-col gap-5 p-6 h-full min-h-0 w-full max-w-[1600px] mx-auto overflow-hidden">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shrink-0">
        <div>
          <span className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-text-subtle font-semibold mb-1">
            <ImageIcon className="w-3.5 h-3.5" />
            Image Studio
          </span>
          <h1 className="text-xl md:text-2xl font-extrabold text-text m-0">图像生成工作室</h1>
          <p className="text-xs text-text-muted mt-1 max-w-xl">
            {project ? `当前项目：${project.name}` : "请先选择项目"}
          </p>
        </div>
        
        {/* Mode switcher */}
        <div className="flex items-center p-1 bg-surface-muted rounded-pill border border-border-soft">
          <ModeButton active={mode === "generate"} onClick={() => setMode("generate")} icon={<Wand2 className="w-4 h-4" />}>单图生成</ModeButton>
          <ModeButton active={mode === "batch"} onClick={() => setMode("batch")} icon={<Layers className="w-4 h-4" />}>批量生成</ModeButton>
          <ModeButton active={mode === "edit"} onClick={() => setMode("edit")} icon={<ImagePlus className="w-4 h-4" />}>图片编辑</ModeButton>
        </div>
      </div>

      {(mode === "generate" || mode === "batch" || mode === "edit") && (
        <div className="flex-1 flex gap-5 min-h-0 overflow-hidden">
          
          {/* Left Parameters Panel */}
          <div className="w-[280px] md:w-[320px] lg:w-[360px] xl:w-[420px] shrink-0 bg-surface-app/40 backdrop-blur-2xl border border-white/5 rounded-3xl flex flex-col min-h-0 shadow-[0_8px_30px_rgb(0,0,0,0.12)] overflow-hidden relative">
  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-32 bg-brand/10 blur-[60px] rounded-full pointer-events-none" />
  
  <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 min-h-0 relative z-10">
    <div className="flex items-center justify-between border-b border-white/5 pb-4 shrink-0">
      <div className="flex items-center gap-2">
         <Wand2 className="w-4 h-4 text-brand" />
         <span className="text-sm font-black text-text uppercase tracking-widest">创作台</span>
      </div>
      <span className="text-[10px] text-brand-strong bg-brand/10 px-2.5 py-1 rounded-full font-bold">{mode === "generate" ? (generateTool ? "Image Studio" : "等待工具") : mode === "batch" ? (batchTool ? "Batch Studio" : "等待工具") : (editTool ? "Edit Studio" : "等待工具")}</span>
    </div>
    
        {mode === "edit" && (
      <div className="flex flex-col gap-2">
        <Label className="text-xs font-bold text-text-muted flex items-center justify-between">
          <span>原图 (Source Image)</span>
          <span className="text-[10px] text-brand font-bold bg-brand/10 px-1.5 py-0.5 rounded">必填</span>
        </Label>
        <div 
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
             e.preventDefault();
             const text = e.dataTransfer.getData("text/plain");
             if (text) setEditSourceImage(text);
          }}
          className={cn("h-32 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 text-xs transition-all duration-300 relative overflow-hidden group", editSourceImage ? "border-brand/50 bg-brand/5" : "border-border-strong hover:border-brand/50 hover:bg-brand/5 cursor-pointer text-text-muted")}
        >
          {editSourceImage ? (
             <div className="absolute inset-0 flex items-center justify-center p-1 bg-black/40 backdrop-blur-sm">
                <img src={assetPreviewUrl(project?.id ?? "", editSourceImage)} className="h-full object-contain rounded-xl shadow-lg" />
             </div>
          ) : (
            <>
              <div className="w-10 h-10 rounded-full bg-surface-panel flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300">
                <ImagePlus className="w-5 h-5 text-brand" />
              </div>
              <span className="font-medium text-text-subtle">将图片拖拽至此，或点击使用选中项</span>
            </>
          )}
          <button type="button" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onClick={() => {
             const next = selectedAssets.find((asset) => asset.assetType === "image");
             if (next) setEditSourceImage(next.relativePath);
          }} disabled={!selectedAssets.length} title="使用选中项" />
        </div>
      </div>
    )}

    <div className="flex flex-col gap-2">
      <Label htmlFor="prompt" className="text-xs font-bold text-text-muted flex items-center justify-between">
        <span>{mode === "batch" ? "批量提示词 (Prompts)" : mode === "edit" ? "修改指令 (Prompt)" : "提示词 (Prompt)"}</span>
        <span className="text-[10px] text-brand font-bold bg-brand/10 px-1.5 py-0.5 rounded">必填</span>
      </Label>
      {mode === "batch" ? (
         <textarea 
          id="batchPrompts"
          value={batchPrompts}
          onChange={(e) => setBatchPrompts(e.target.value)}
          placeholder={"每行输入一个提示词，批量生成多张图片...\n例如：\n一只可爱的橘猫\n赛博朋克风格的城市"}
          className="w-full min-h-[140px] rounded-2xl border-2 border-transparent bg-surface-panel px-4 py-3 text-[13px] placeholder:text-text-subtle focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition-all resize-y shadow-sm"
        />
      ) : (
         <textarea 
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={mode === "edit" ? "输入修改指令，例如：把背景变成蓝色..." : "描述你想要生成的图像画面，越详细越好..."}
          className="w-full min-h-[140px] rounded-2xl border-2 border-transparent bg-surface-panel px-4 py-3 text-[13px] placeholder:text-text-subtle focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition-all resize-y shadow-sm"
        />
      )}
    </div>

    <div className={cn("grid gap-4", mode === "batch" ? "grid-cols-1" : "grid-cols-2")}>
      {mode !== "batch" && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="name" className="text-xs font-bold text-text-muted">资源名称</Label>
          <Input 
            id="name" 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            placeholder="留空自动生成" 
            className="h-10 rounded-xl bg-surface-raised border-transparent focus:border-brand focus:bg-surface-panel transition-all shadow-inner text-[13px]"
          />
        </div>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="target_size" className="text-xs font-bold text-text-muted">目标尺寸</Label>
        <SelectField id="target_size" value={targetSize} options={targetSizeOptions} onChange={(size) => {
          setTargetSize(size);
          if (size === "512x512" || size === "1024x1024" || size === "1536x1536") setAspectRatio("1:1");
          else if (size === "1920x1080") setAspectRatio("16:9");
          else if (size === "1080x1920") setAspectRatio("9:16");
        }} ariaLabel="目标尺寸" />
      </div>
    </div>

    <div className="pt-2">
      <button 
        type="button" 
        onClick={() => setShowAdvanced(!showAdvanced)}
        className={cn("flex items-center justify-center gap-2 text-[13px] font-bold transition-all w-full py-3 rounded-2xl group", showAdvanced ? "bg-brand/10 text-brand" : "bg-surface-raised text-text-muted hover:bg-surface-panel hover:text-text")}
      >
        <Settings2 className={cn("w-4 h-4 transition-transform", showAdvanced && "rotate-90")} />
        参数工坊
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
              <Field label="输出分辨率" value={resolution} onChange={(v) => setResolution(v as ResolutionValue)} options={resolutionOptions} />
              <Field label="长宽比" value={aspectRatio} onChange={(ratio) => {
                setAspectRatio(ratio);
                if (ratio === "1:1") setTargetSize("1024x1024");
                else if (ratio === "16:9") setTargetSize("1920x1080");
                else if (ratio === "9:16") setTargetSize("1080x1920");
              }} options={aspectRatioOptions} />
              <Field label="思考层级" value={thinkingLevel} onChange={(v) => setThinkingLevel(v as ThinkingValue)} options={thinkingOptions} />
              
              <div className="flex flex-col gap-2">
                <Label htmlFor="seed" className="text-xs font-bold text-text-subtle">随机种子</Label>
                <Input 
                  id="seed" 
                  value={seed} 
                  onChange={(e) => setSeed(e.target.value)} 
                  placeholder="随机" 
                  type="number"
                  className="h-10 rounded-xl bg-surface-raised border-transparent focus:border-brand shadow-inner text-[13px]"
                />
              </div>

              {mode !== "edit" && (
              <div className="col-span-2 flex flex-col gap-2 pt-2">
                <Label className="text-xs font-bold text-text-subtle flex items-center justify-between">
                  <span>附加参考图</span>
                  {referenceImage && <button type="button" className="text-[10px] text-brand hover:text-brand-strong bg-brand/10 px-2 py-0.5 rounded-full transition-colors" onClick={() => setReferenceImage("")}>清除</button>}
                </Label>
                <div 
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                     e.preventDefault();
                     const text = e.dataTransfer.getData("text/plain");
                     if (text) setReferenceImage(text);
                  }}
                  className={cn("h-32 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 text-xs transition-all duration-300 relative overflow-hidden group", referenceImage ? "border-brand/50 bg-brand/5" : "border-border hover:border-brand/50 hover:bg-surface-raised cursor-pointer text-text-muted")}
                >
                  {referenceImage ? (
                     <div className="absolute inset-0 flex items-center justify-center p-1 bg-black/40 backdrop-blur-sm">
                        <img src={assetPreviewUrl(project?.id ?? "", referenceImage)} className="h-full object-contain rounded-xl shadow-lg" />
                     </div>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-full bg-surface-panel flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300">
                        <ImagePlus className="w-5 h-5 text-brand" />
                      </div>
                      <span className="font-medium text-text-subtle">将图片拖拽至此，或点击拾取选中项</span>
                    </>
                  )}
                  {!referenceImage && (
                     <button type="button" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onClick={useSelectedImageAsReference} disabled={!selectedAssets.length} title="使用选中项" />
                  )}
                </div>
              </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>

  </div>
  
  <div className="flex flex-col gap-4 p-6 pt-5 border-t border-white/5 bg-surface-panel/40 backdrop-blur-md shrink-0 relative z-10">
    <div className="flex items-end justify-between gap-4">
      <div className="flex-1">
        <Field label="生成模型" value={model} onChange={(v) => setModel(v as ImageModelValue)} options={modelOptions} />
      </div>
      <div className="shrink-0 mb-0.5">
         <button type="button" onClick={() => setTransparent(!transparent)} className={cn("inline-flex items-center gap-2 rounded-xl border-2 h-10 px-4 text-[13px] font-bold transition-all", transparent ? "bg-brand/10 border-brand text-brand-strong" : "bg-surface-raised border-transparent text-text-muted hover:bg-surface-panel hover:text-text")}>
            {transparent ? <Check className="h-4 w-4" /> : <Layers className="h-4 w-4 opacity-50" />}
            透明背景
         </button>
      </div>
    </div>
    <Button 
      size="lg" 
      onClick={mode === "generate" ? handleGenerate : mode === "batch" ? handleBatchGenerate : handleEditImage} 
      disabled={
        busy || !project || activeGenerationTask !== undefined ||
        (mode === "generate" && (!generateTool || !prompt)) ||
        (mode === "batch" && (!batchTool || !batchPrompts)) ||
        (mode === "edit" && (!editTool || !prompt || !editSourceImage))
      }
      className="gap-2 w-full text-[15px] h-12 font-black rounded-2xl bg-gradient-to-r from-brand to-brand-strong text-[#04202a] shadow-lg shadow-brand/20 hover:shadow-brand/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 disabled:opacity-50 disabled:hover:translate-y-0"
    >
      {activeGenerationTask ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
      {activeGenerationTask ? "执行跃迁中..." : mode === "generate" ? "启动生成" : mode === "batch" ? "批量生成" : "启动编辑"}
    </Button>
  </div>
</div>
          {/* Right Gallery & File Manager Panel */}
          <div className="flex-1 bg-surface-panel border border-border rounded-large flex flex-col min-h-0 overflow-hidden shadow-sm">
            <div className="px-4 py-2.5 border-b border-border flex flex-wrap items-center justify-between gap-4 shrink-0 bg-surface-raised/40">
              
              {/* Left: Context & Navigation */}
              <div className="flex flex-wrap items-center gap-3 min-w-0 flex-1">
                <div className="flex p-1 bg-surface-app border border-border-soft rounded-lg shadow-inner shrink-0">
                  <button onClick={() => setViewTab("preview")} className={cn("px-3 py-1 text-[11px] font-bold rounded transition-all", viewTab === "preview" ? "bg-surface-raised shadow-sm text-text border border-border-soft" : "text-text-subtle hover:text-text")}>预览</button>
                  <button onClick={() => setViewTab("manage")} className={cn("px-3 py-1 text-[11px] font-bold rounded transition-all", viewTab === "manage" ? "bg-surface-raised shadow-sm text-text border border-border-soft" : "text-text-subtle hover:text-text")}>图片库</button>
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

                <div className="flex bg-surface-muted p-0.5 rounded-control shrink-0">
                  <button onClick={() => setViewMode("grid")} className={cn("p-1.5 rounded-sm transition-colors", viewMode === "grid" ? "bg-surface-panel shadow-sm text-brand" : "text-text-subtle hover:text-text")} title="小图模式"><LayoutGrid className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setViewMode("list")} className={cn("p-1.5 rounded-sm transition-colors", viewMode === "list" ? "bg-surface-panel shadow-sm text-brand" : "text-text-subtle hover:text-text")} title="列表模式"><List className="w-3.5 h-3.5" /></button>
                </div>

                <Button variant="outline" size="icon" onClick={onScanAssets} disabled={!project} className="h-8 w-8 shrink-0 rounded-full bg-surface-app" title="刷新目录"><RefreshCw className="h-3.5 w-3.5" /></Button>
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
                        <h3 className="text-xl font-bold text-text mb-2 tracking-wide">图片生成中</h3>
                        <p className="text-sm text-text-subtle mb-8 text-center px-4">
                          正在调度 {activeGenerationTask.toolName === "generate_image" ? "生成" : "批量生成"} 任务，请稍候...
                        </p>
                        
                        <div className="w-full bg-surface-raised rounded-2xl p-6 shadow-inner border border-white/5 relative overflow-hidden">
                          <div className="flex items-center justify-between mb-3">
                             <div className="flex items-center gap-2 text-brand">
                               <Clock className="w-4 h-4" />
                               <span className="text-sm font-bold">已用时: {elapsedTime} 秒</span>
                             </div>
                             <span className="text-xs font-bold text-text-muted">预计 60 秒</span>
                          </div>
                          
                          <div className="h-2 w-full bg-surface-app rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-brand transition-all ease-linear duration-1000" 
                              style={{ width: `${Math.min(100, (elapsedTime / 60) * 100)}%` }}
                            ></div>
                          </div>
                        </div>
                     </div>
                   ) : displayAsset ? (
                     <div className="flex flex-col items-center max-w-full w-full mt-4">
                       <div className="relative mb-4 shrink-0">
                         <img src={assetPreviewUrl(project?.id ?? "", displayAsset.relativePath)} alt={displayAsset.fileName} className="max-h-[55vh] object-contain rounded-xl shadow-2xl" />
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
                             <span className="font-bold text-text-muted mr-1.5">Size:</span>
                             <span className="bg-surface-app px-1.5 py-0.5 rounded text-text">{previewMetadata?.target_size || "-"}</span>
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
                        <ImagePlus className="w-16 h-16 mb-4 opacity-50" />
                        <p className="text-sm font-medium">暂无当前图片</p>
                        <p className="text-xs mt-1">请生成新图片或从管理面板选择</p>
                     </div>
                   )}
                </div>
              ) : (
                <>
              {/* 画廊区域 */}
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
                               const targetPath = `${IMAGE_ROOT}/${folder.key}`;
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
                      <FileImage className="w-12 h-12 mb-3 opacity-20" />
                      <p className="text-sm font-medium">当前目录为空</p>
                      <Button variant="ghost" size="sm" onClick={openPicker} className="mt-2 text-xs">从本地导入</Button>
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
                            <div key={asset.id} draggable onDragStart={(event) => { event.dataTransfer.setData("text/plain", asset.relativePath); event.dataTransfer.effectAllowed = "move"; }} className={cn("flex items-center gap-4 p-2 rounded-card border transition-all cursor-pointer group", selected ? "border-brand bg-brand/5 shadow-sm" : "border-border hover:border-brand/50 bg-surface-panel hover:bg-surface-raised")} onClick={() => toggleSelected(asset.relativePath)}>
                              <div className="relative w-12 h-12 shrink-0 bg-black/20 rounded overflow-hidden" onClick={(e) => { e.stopPropagation(); openPreview(asset); }}>
                                <img draggable={false} src={assetPreviewUrl(asset.projectId, asset.relativePath)} alt={asset.fileName} className="w-full h-full object-cover" loading="lazy" />
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
                            onDragStart={(event) => {
                              event.dataTransfer.setData("text/plain", asset.relativePath);
                              event.dataTransfer.effectAllowed = "move";
                            }}
                            className={cn("break-inside-avoid relative group flex flex-col overflow-hidden rounded-card border transition-all cursor-pointer", selected ? "border-brand shadow-sm" : "border-border hover:border-brand/50")}
                            onClick={() => openPreview(asset)}
                          >
                            <img draggable={false} src={assetPreviewUrl(asset.projectId, asset.relativePath)} alt={asset.fileName} className="w-full h-auto object-cover" loading="lazy" />
                            
                            <div className={cn("absolute top-2 right-2 flex justify-end z-10", selected ? "opacity-100" : "opacity-0 group-hover:opacity-100 transition-opacity")}>
                               <label className={cn("flex h-5 w-5 items-center justify-center rounded border cursor-pointer shadow-sm", selected ? "border-brand bg-brand text-[#04202a]" : "border-border-strong bg-surface-app text-brand-strong hover:bg-brand hover:border-brand hover:text-[#04202a]")} onClick={(e) => e.stopPropagation()}>
                                  <input type="checkbox" className="sr-only" checked={selected} onChange={(event) => { event.stopPropagation(); toggleSelected(asset.relativePath); }} />
                                  {selected ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : null}
                               </label>
                            </div>
                            
                            <div className="p-2 bg-surface-panel flex flex-col border-t border-border-soft relative z-10" onClick={(e) => {
                               // 如果正在编辑，阻止冒泡防止打开预览
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
                    <span className="text-[12px] font-extrabold text-text-subtle">共 <span className="text-text">{visibleAssets.length}</span> 张图片</span>
                  </div>
                </div>
                
                </div>
              </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Old placeholders removed */}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={async (event) => {
          const files = event.target.files;
          if (files && files.length) {
            await handleImport(files, moveTargetFolder);
          }
          event.currentTarget.value = "";
        }}
      />

      <AnimatePresence>
        {lightboxAsset && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-6" onClick={() => setLightboxAsset(null)}>
             <img 
               src={assetPreviewUrl(lightboxAsset.projectId, lightboxAsset.relativePath)} 
               alt={lightboxAsset.fileName} 
               className="max-h-[95vh] max-w-[95vw] object-contain shadow-2xl cursor-default" 
               onClick={(e) => e.stopPropagation()} 
             />
             <Button variant="ghost" size="icon" className="absolute top-4 right-4 h-12 w-12 text-white/50 hover:text-white hover:bg-white/10 rounded-full bg-black/20 backdrop-blur-md" onClick={() => setLightboxAsset(null)}>
                <X className="h-6 w-6" />
             </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ModeButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: ReactNode; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={cn("inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-xs font-semibold transition-colors", active ? "bg-surface-raised text-brand-strong shadow-sm" : "text-text-muted hover:bg-surface-raised/60 hover:text-text") }>
      {icon}
      {children}
    </button>
  );
}

function Field({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-[11px] font-bold text-text-muted">{label}</Label>
      <SelectField id={label} value={value} options={options} onChange={onChange} ariaLabel={label} />
    </div>
  );
}

function FolderItem({ active, label, count, path, onClick, onDrop }: { active: boolean; label: string; count: number; path: string; onClick: () => void; onDrop: (event: React.DragEvent<HTMLButtonElement>) => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
      className={cn("flex w-full items-center justify-between gap-2 rounded-control px-2 py-1.5 text-left transition-colors", active ? "bg-brand/10 text-brand-strong" : "bg-transparent text-text-subtle hover:bg-surface-raised hover:text-text")}
      title={path}
    >
      <span className="flex min-w-0 items-center gap-2">
        <FolderOpen className={cn("h-3.5 w-3.5 shrink-0", active ? "text-brand" : "text-text-muted")} />
        <span className="min-w-0 truncate text-xs font-medium">{label}</span>
      </span>
      <span className="rounded-pill bg-surface-muted px-1.5 py-0.5 text-[10px] font-semibold text-text-subtle">{count}</span>
    </button>
  );
}

function EmptyAssetState({ onImport, hasProject }: { onImport: () => void; hasProject: boolean }) {
  return (
    <div className="flex min-h-[260px] h-full flex-col items-center justify-center gap-4 p-8 text-center text-text-muted bg-surface-panel/30 backdrop-blur-sm rounded-3xl m-4 border border-white/5">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-panel shadow-sm text-brand"><FileImage className="h-8 w-8 opacity-80" /></div>
      <div className="flex flex-col gap-1.5">
        <div className="text-[15px] font-black text-text">暂无灵感入库</div>
        <div className="max-w-[280px] text-[12px] leading-relaxed text-text-subtle font-medium">{hasProject ? "生图的产物会在这里展现，你也随时可以从外部直接拖拽或者导入图片。" : "请先在主页选中项目。"}</div>
      </div>
      <Button variant="outline" size="sm" onClick={onImport} disabled={!hasProject} className="gap-2 mt-2 rounded-xl shadow-sm hover:shadow-md hover:border-brand/50 transition-all font-bold text-xs h-9 px-4"><Upload className="h-3.5 w-3.5" />手动导入</Button>
    </div>
  );
}

function Placeholder({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center rounded-3xl border border-white/5 bg-surface-panel/40 backdrop-blur-xl p-12 text-center shadow-lg relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-brand/5 blur-[80px] rounded-full pointer-events-none" />
      <div className="flex max-w-md flex-col items-center gap-4 text-text-muted relative z-10">
        <div className="p-4 bg-surface-panel rounded-2xl shadow-sm text-brand/80">{icon}</div>
        <div className="text-xl font-black text-text">{title}</div>
        <div className="text-[13px] leading-relaxed text-text-subtle font-medium">{description}</div>
      </div>
    </div>
  );
}

function getFolderKey(relativePath: string): FolderKey {
  const normalized = relativePath.replace(/\\/g, "/");
  if (!normalized.startsWith(`${IMAGE_ROOT}/`)) return "__root__";
  const rest = normalized.slice(IMAGE_ROOT.length + 1);
  const folder = rest.split("/")[0];
  return folder && folder !== rest ? folder : "__root__";
}

function getFolderPathDisplay(relativePath: string) {
  const key = getFolderKey(relativePath);
  return key === "__root__" ? IMAGE_ROOT : `${IMAGE_ROOT}/${key}`;
}

function folderTargetFromKey(key: FolderKey) {
  if (key === "__all__") return DEFAULT_IMPORT_FOLDER;
  if (key === "__root__") return IMAGE_ROOT;
  return `${IMAGE_ROOT}/${key}`;
}

function folderKeyFromTarget(target: string): FolderKey {
  const normalized = target.replace(/\\/g, "/");
  if (normalized === IMAGE_ROOT) return "__root__";
  if (normalized === DEFAULT_IMPORT_FOLDER) return "maker_plus";
  if (normalized.startsWith(`${IMAGE_ROOT}/`)) return normalized.slice(IMAGE_ROOT.length + 1).split("/")[0] || "__root__";
  return "__all__";
}

function defaultImageName() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `maker_plus_image_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
