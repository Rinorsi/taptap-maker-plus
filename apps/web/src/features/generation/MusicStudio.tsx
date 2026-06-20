import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronDown, ChevronUp, FileAudio, FolderOpen, Maximize2, MoveRight, RefreshCw, Search, Settings2, Trash2, Upload, Wand2, Play, Activity, LayoutGrid, List, Layers, X, Loader2, Clock, Music, Copy, Tag } from "lucide-react";
import { assetPreviewUrl, listAssets, type AssetSummary, type ProjectSummary, type TaskRecord, type ToolSummary } from "../../api";
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
  onSelectTool?: (tool: ToolSummary) => void;
  onSelectAsset?: (asset: AssetSummary) => void;
  onScanAssets: () => void;
  onRebuildAssetProvenance: () => void;
  onDeleteAssets: (relativePaths: string[]) => Promise<void>;
  onMoveAssets: (relativePaths: string[], targetFolder: string) => Promise<void>;
  onRenameAsset: (relativePath: string, newName: string) => Promise<void>;
  onImportImages: (files: File[], targetFolder: string) => Promise<void>;
};

type FolderKey = "__all__" | "__root__" | string;
type FolderBucket = {
  key: FolderKey;
  label: string;
  path: string;
  count: number;
};

const AUDIO_ROOT = "assets/audio";
const DEFAULT_IMPORT_FOLDER = "assets/audio/maker_plus";

const PRESETS = [
  { label: "电子", style: "electronic, upbeat" },
  { label: "氛围", style: "ambient, relaxing" },
  { label: "战斗", style: "epic, orchestral, battle" },
  { label: "菜单", style: "casual, lo-fi, chill" },
  { label: "赛博", style: "cyberpunk, synthwave" },
  { label: "幻想", style: "fantasy, magical" },
  { label: "可爱", style: "cute, kawaii, cheerful" },
  { label: "低保真", style: "lofi hiphop, chill" },
  { label: "管弦", style: "orchestral, cinematic" },
  { label: "钢琴", style: "piano solo, emotional" },
  { label: "合成器", style: "synthpop, 80s" },
  { label: "节奏感", style: "rhythmic, percussion, groovy" },
  { label: "轻快", style: "upbeat, happy, acoustic" },
  { label: "黑暗", style: "dark, creepy, horror" },
];

const MODELS = [
  { value: "V4_5", label: "V4_5 (推荐)" },
  { value: "V5", label: "V5 (最新)" },
  { value: "V4_5PLUS", label: "V4_5 PLUS" },
  { value: "V4", label: "V4" },
  { value: "V3_5", label: "V3_5" },
];

function Field({ label, value, onChange, options }: { label: string, value: string, onChange: (val: string) => void, options: {value: string, label: string}[] }) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs font-bold text-text-muted">{label}</Label>
      <SelectField id={label} value={value} options={options} onChange={onChange} ariaLabel={label} />
    </div>
  );
}

export function MusicStudio({
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
  // Config state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [style, setStyle] = useState("");
  const [negativeTags, setNegativeTags] = useState("");
  const [model, setModel] = useState<string>("V4_5");
  const [instrumental, setInstrumental] = useState<boolean>(false);
  const [vocalGender, setVocalGender] = useState<"m" | "f">("f");

  // File manager state
  const [search, setSearch] = useState("");
  const [flattenAll, setFlattenAll] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [viewTab, setViewTab] = useState<"preview" | "manage">("manage");
  const [selectedFolderKey, setSelectedFolderKey] = useState<FolderKey>("__all__");
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [moveTargetFolder, setMoveTargetFolder] = useState(DEFAULT_IMPORT_FOLDER);
  const [audioLibraryAssets, setAudioLibraryAssets] = useState<AssetSummary[]>([]);
  
  const [elapsedTime, setElapsedTime] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Computed File Manager data
  function getFolderKey(relativePath: string) {
    const normalized = relativePath.replace(/\\/g, "/");
    if (!normalized.startsWith(`${AUDIO_ROOT}/`)) return "__root__";
    const sub = normalized.slice(`${AUDIO_ROOT}/`.length);
    const slashIdx = sub.indexOf("/");
    if (slashIdx === -1) return "__root__";
    return sub.slice(0, slashIdx);
  }

  async function refreshAudioLibrary(projectId = project?.id) {
    if (!projectId) {
      setAudioLibraryAssets([]);
      return;
    }
    const nextAssets = await listAssets(projectId, { assetType: "audio", rootPrefix: AUDIO_ROOT, limit: 1000 }).catch(() => []);
    setAudioLibraryAssets(nextAssets);
  }

  useEffect(() => {
    if (!project) {
      setAudioLibraryAssets([]);
      return;
    }
    let canceled = false;
    listAssets(project.id, { assetType: "audio", rootPrefix: AUDIO_ROOT, limit: 1000 })
      .then((nextAssets) => {
        if (!canceled) setAudioLibraryAssets(nextAssets);
      })
      .catch(() => {
        if (!canceled) setAudioLibraryAssets([]);
      });
    return () => {
      canceled = true;
    };
  }, [project]);

  const audioAssets = useMemo(() => {
    if (!project) return [];
    const byPath = new Map<string, AssetSummary>();
    for (const asset of assets) byPath.set(asset.relativePath, asset);
    for (const asset of audioLibraryAssets) byPath.set(asset.relativePath, asset);
    return Array.from(byPath.values())
      .filter((asset) => {
        if (asset.projectId !== project.id || asset.assetType !== "audio") return false;
        const normalized = asset.relativePath.replace(/\\/g, "/");
        return normalized.startsWith(`${AUDIO_ROOT}/`);
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
  }, [assets, audioLibraryAssets, project]);

  const folders = useMemo<FolderBucket[]>(() => {
    const counts = new Map<string, number>();
    let rootCount = 0;
    for (const asset of audioAssets) {
      const key = getFolderKey(asset.relativePath);
      if (key === "__root__") rootCount += 1;
      else counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [
      { key: "__all__", label: "全部音频", path: AUDIO_ROOT, count: audioAssets.length },
      { key: "__root__", label: "未分类", path: AUDIO_ROOT, count: rootCount },
      ...Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b, "zh-Hans-CN")).map(([key, count]) => ({ key, label: key, path: `${AUDIO_ROOT}/${key}`, count }))
    ];
  }, [audioAssets]);

  useEffect(() => {
    if (!folders.some((folder) => folder.key === selectedFolderKey)) {
      setSelectedFolderKey("__all__");
    }
  }, [folders, selectedFolderKey]);

  useEffect(() => {
    if (selectedFolderKey === "__all__") {
      setMoveTargetFolder(DEFAULT_IMPORT_FOLDER);
      return;
    }
    if (selectedFolderKey === "__root__") {
      setMoveTargetFolder(AUDIO_ROOT);
      return;
    }
    setMoveTargetFolder(`${AUDIO_ROOT}/${selectedFolderKey}`);
  }, [selectedFolderKey]);

  const visibleAssets = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return audioAssets.filter((asset) => {
      const key = getFolderKey(asset.relativePath);
      if (!flattenAll) {
         if (selectedFolderKey === "__all__" && key !== "__root__") return false;
         if (selectedFolderKey !== "__all__" && key !== selectedFolderKey) return false;
      }
      if (!needle) return true;
      return asset.fileName.toLowerCase().includes(needle) || asset.relativePath.toLowerCase().includes(needle);
    });
  }, [audioAssets, search, selectedFolderKey, flattenAll]);

  const assetMap = useMemo(() => new Map(audioAssets.map((asset) => [asset.relativePath, asset])), [audioAssets]);
  const selectedAssets = selectedPaths.map((path) => assetMap.get(path)).filter((asset): asset is AssetSummary => !!asset);
  const selectedCount = selectedPaths.length;
  const currentFolderPath = selectedFolderKey === "__all__" ? AUDIO_ROOT : selectedFolderKey === "__root__" ? AUDIO_ROOT : `${AUDIO_ROOT}/${selectedFolderKey}`;
  
  const activeGenerationTask = useMemo(() => {
    if (!project) return undefined;
    return tasks.find((task) => task.projectId === project.id && task.toolName === "text_to_music" && (task.status === "queued" || task.status === "running"));
  }, [project, tasks]);

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

  const musicTool = tools.find((t) => t.name === "text_to_music");

  function createFallbackTitle() {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, "0");
    return `Track-${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  }

  function handleGenerate() {
    if (!musicTool || !project || !prompt.trim()) return;

    const isCustom = showAdvanced && !!(title.trim() || style.trim());

    const payload: Record<string, unknown> = {
      prompt: prompt.trim(),
      customMode: isCustom,
      model,
    };

    if (showAdvanced && negativeTags.trim()) {
      payload.negativeTags = negativeTags.trim();
    }

    if (isCustom) {
      // both are required by schema if customMode=true
      if (!title.trim() || !style.trim()) {
        if (!style.trim()) return;
      }
      payload.title = title.trim() || createFallbackTitle();
      payload.style = style.trim();
      payload.instrumental = instrumental;
      
      if (!instrumental) {
        payload.vocalGender = vocalGender;
      }
    }

    void onCallTool(musicTool.name, payload);
  }

  const isPresetActive = (preset: typeof PRESETS[0]) => {
    if (!style) return false;
    const currentStyles = style.split(',').map(s => s.trim()).filter(Boolean);
    const presetStyles = preset.style.split(',').map(s => s.trim()).filter(Boolean);
    return presetStyles.length > 0 && presetStyles.every(ps => currentStyles.includes(ps));
  };

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setStyle(prev => {
      const currentStyles = prev ? prev.split(',').map(s => s.trim()).filter(Boolean) : [];
      const presetStyles = preset.style.split(',').map(s => s.trim()).filter(Boolean);
      
      const hasAll = presetStyles.every(ps => currentStyles.includes(ps));
      
      if (hasAll) {
        // Remove preset styles
        const newStyles = currentStyles.filter(cs => !presetStyles.includes(cs));
        return newStyles.join(', ');
      } else {
        // Add preset styles, avoiding duplicates
        const newStyles = [...currentStyles];
        for (const ps of presetStyles) {
          if (!newStyles.includes(ps)) {
            newStyles.push(ps);
          }
        }
        return newStyles.join(', ');
      }
    });
  };

  function formatBytes(bytes: number) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  async function deleteSelection(paths = selectedPaths) {
    if (!paths.length) return;
    await onDeleteAssets(paths);
    await refreshAudioLibrary();
    setSelectedPaths([]);
  }

  async function moveSelection(paths = selectedPaths, targetFolder = moveTargetFolder) {
    if (!paths.length) return;
    await onMoveAssets(paths, targetFolder);
    await refreshAudioLibrary();
    setSelectedPaths([]);
  }

  function openPicker() {
    fileInputRef.current?.click();
  }

  function toggleSelected(relativePath: string) {
    setSelectedPaths((current) => current.includes(relativePath) ? current.filter((item) => item !== relativePath) : [...current, relativePath]);
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  }

  async function handleImport(files: File[] | FileList, targetFolder: string) {
    // Basic import logic handling only audios
    const list = Array.from(files).filter((file) => file.type.startsWith("audio/"));
    if (!list.length || !project) return;
    // Note: Assuming onImportImages can handle audio if we pass files. Might need to rename to onImportMedia but we'll use it as is.
    await onImportImages(list, targetFolder);
    await refreshAudioLibrary(project.id);
  }

  return (
    <div className="flex flex-col gap-5 p-6 h-full min-h-0 w-full max-w-[1600px] mx-auto overflow-hidden">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shrink-0">
        <div>
          <span className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-text-subtle font-semibold mb-1">
            <Music className="w-3.5 h-3.5" />
            Music Studio
          </span>
          <h1 className="text-xl md:text-2xl font-extrabold text-text m-0">音频生成工作室</h1>
          <p className="text-xs text-text-muted mt-1 max-w-xl">
            {project ? `当前项目：${project.name}` : "请先选择项目"}
          </p>
        </div>
      </div>

      <div className="flex-1 flex gap-5 min-h-0 overflow-hidden">
        
        {/* Left Parameters Panel */}
        <div className="w-[280px] md:w-[320px] lg:w-[360px] xl:w-[420px] shrink-0 bg-surface-app/40 backdrop-blur-2xl border border-white/5 rounded-3xl flex flex-col min-h-0 shadow-[0_8px_30px_rgb(0,0,0,0.12)] overflow-hidden relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-32 bg-brand/10 blur-[60px] rounded-full pointer-events-none" />
          
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 min-h-0 relative z-10 scrollbar-thin">
            <div className="flex items-center justify-between border-b border-white/5 pb-4 shrink-0">
              <div className="flex items-center gap-2">
                 <Wand2 className="w-4 h-4 text-brand" />
                 <span className="text-sm font-black text-text uppercase tracking-widest">创作台</span>
              </div>
              <span className="text-[10px] text-brand-strong bg-brand/10 px-2.5 py-1 rounded-full font-bold">Music Studio</span>
            </div>
            
            {/* Prompt */}
            <div className="flex flex-col gap-2">
              <Label className="text-xs font-bold text-text-muted flex items-center justify-between">
                <span>{showAdvanced ? "提示词/歌词 (Prompt)" : "音乐描述 (Prompt)"}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-text-muted font-normal">{prompt.length}/500</span>
                  <span className="text-[10px] text-brand font-bold bg-brand/10 px-1.5 py-0.5 rounded">必填</span>
                </div>
              </Label>
              <textarea
                className="w-full min-h-[140px] rounded-2xl border-2 border-transparent bg-surface-panel px-4 py-3 text-[13px] placeholder:text-text-subtle focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition-all resize-y shadow-sm"
                placeholder={showAdvanced ? "输入多行详尽的歌词及风格指令..." : "输入简单的描述，例如：一首欢快的流行歌曲"}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
              />
            </div>

            <div className="pt-2">
              <button 
                type="button" 
                onClick={() => setShowAdvanced(!showAdvanced)}
                className={cn("flex items-center justify-center gap-2 text-[13px] font-bold transition-all w-full py-3 rounded-2xl group", showAdvanced ? "bg-brand/10 text-brand" : "bg-surface-raised text-text-muted hover:bg-surface-panel hover:text-text")}
              >
                <Settings2 className={cn("w-4 h-4 transition-transform", showAdvanced && "rotate-90")} />
                高级控制参数 (自定义音乐)
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
                    <div className="flex flex-col gap-6 pt-5 pb-2">
                      {/* Presets Panel */}
                      <div className="flex flex-col gap-2">
                        <Label className="text-xs font-bold text-text-subtle">风格预设 (快捷填充)</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {PRESETS.map((p, i) => {
                            const active = isPresetActive(p);
                            return (
                              <button
                                key={i}
                                className={cn("px-2 py-1 border rounded text-[10px] font-medium transition-colors flex items-center gap-1", active ? "bg-brand/20 border-brand text-brand" : "bg-surface-muted hover:bg-brand/10 hover:text-brand border-border-soft text-text-subtle")}
                                onClick={() => applyPreset(p)}
                              >
                                <Tag className="w-2.5 h-2.5" />
                                {p.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Title & Style */}
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2">
                          <Label className="text-xs font-bold text-text-muted flex items-center justify-between">
                            <span>曲名 (Title)</span>
                            <div className="flex items-center gap-2">
                               <span className="text-[10px] text-text-muted font-normal">{title.length}/80</span>
                               <span className="text-[10px] text-brand font-bold bg-brand/10 px-1.5 py-0.5 rounded">自定必备</span>
                            </div>
                          </Label>
                          <Input 
                            value={title} 
                            onChange={e => setTitle(e.target.value.substring(0, 80))} 
                            placeholder="例如: Epic Battle" 
                            className="h-10 rounded-xl bg-surface-raised border-transparent focus:border-brand focus:bg-surface-panel transition-all shadow-inner text-[13px]" 
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label className="text-xs font-bold text-text-muted flex items-center justify-between">
                            <span>风格 (Style)</span>
                            <span className="text-[10px] text-brand font-bold bg-brand/10 px-1.5 py-0.5 rounded">自定必备</span>
                          </Label>
                          <textarea 
                            value={style} 
                            onChange={e => setStyle(e.target.value)} 
                            placeholder="electronic, ambient, epic... 可以输入多个风格标签，用逗号分隔" 
                            className="w-full min-h-[80px] rounded-xl border-2 border-transparent bg-surface-raised px-3 py-2 text-[13px] placeholder:text-text-subtle focus:outline-none focus:border-brand focus:bg-surface-panel transition-all shadow-inner resize-y" 
                          />
                        </div>
                      </div>

                      {/* Negative Tags */}
                      <div className="flex flex-col gap-2">
                        <Label className="text-xs font-bold text-text-muted">排除元素 (Negative Tags)</Label>
                        <Input 
                          value={negativeTags} 
                          onChange={e => setNegativeTags(e.target.value)} 
                          placeholder="不需要的声音..." 
                          className="h-10 rounded-xl bg-surface-raised border-transparent focus:border-brand focus:bg-surface-panel transition-all shadow-inner text-[13px]" 
                        />
                      </div>
                      
                      {/* Vocal Gender - Only show if not instrumental */}
                      {!instrumental && (
                        <div className="flex flex-col gap-2">
                          <Label className="text-xs font-bold text-text-muted">人声选项</Label>
                          <div className="flex items-center gap-2">
                             <button type="button" onClick={() => setVocalGender("m")} className={cn("inline-flex items-center gap-2 rounded-xl border-2 h-10 px-4 text-[13px] font-bold transition-all", vocalGender === "m" ? "bg-brand/10 border-brand text-brand-strong" : "bg-surface-raised border-transparent text-text-muted hover:bg-surface-panel hover:text-text")}>
                                <div className={cn("w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-colors", vocalGender === "m" ? "border-brand bg-brand text-[#04202a]" : "border-text-muted")}>
                                  {vocalGender === "m" && <div className="w-1.5 h-1.5 bg-[#04202a] rounded-full" />}
                                </div>
                                男声
                             </button>
                             <button type="button" onClick={() => setVocalGender("f")} className={cn("inline-flex items-center gap-2 rounded-xl border-2 h-10 px-4 text-[13px] font-bold transition-all", vocalGender === "f" ? "bg-brand/10 border-brand text-brand-strong" : "bg-surface-raised border-transparent text-text-muted hover:bg-surface-panel hover:text-text")}>
                                <div className={cn("w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-colors", vocalGender === "f" ? "border-brand bg-brand text-[#04202a]" : "border-text-muted")}>
                                  {vocalGender === "f" && <div className="w-1.5 h-1.5 bg-[#04202a] rounded-full" />}
                                </div>
                                女声
                             </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="p-6 bg-surface-raised/40 border-t border-white/5 backdrop-blur-xl relative z-10 shrink-0 flex flex-col gap-4">
             {/* Bottom Bar Options */}
             <div className="grid grid-cols-2 gap-4 w-full">
               <div className="col-span-1">
                 <Field 
                    label="模型 (Model)"
                    value={model}
                    onChange={setModel}
                    options={MODELS}
                  />
               </div>
               <div className="col-span-1">
                 <Field 
                    label="音乐类型"
                    value={instrumental ? "true" : "false"}
                    onChange={(v) => setInstrumental(v === "true")}
                    options={[
                      { value: "true", label: "纯音乐 (Instrumental)" },
                      { value: "false", label: "含人声 (Vocal)" }
                    ]}
                  />
               </div>
             </div>

             <Button 
              size="lg" 
              onClick={handleGenerate} 
              disabled={busy || !prompt.trim() || Boolean(showAdvanced && (title.trim() || style.trim()) && !style.trim())}
              className="gap-2 w-full text-[15px] h-12 font-black rounded-2xl bg-gradient-to-r from-brand to-brand-strong text-[#04202a] shadow-lg shadow-brand/20 hover:shadow-brand/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {activeGenerationTask ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Music className="w-5 h-5" />}
              {activeGenerationTask ? "生成调度中..." : "启动生成"}
            </Button>
          </div>
        </div>

        {/* Right Gallery & File Manager Panel */}
        <div className="flex-1 bg-surface-panel border border-border rounded-large flex flex-col min-h-0 overflow-hidden shadow-sm">
          <div className="px-4 py-2.5 border-b border-border flex flex-wrap items-center justify-between gap-4 shrink-0 bg-surface-raised/40">
            
            {/* Left: Context & Navigation */}
            <div className="flex flex-wrap items-center gap-3 min-w-0 flex-1">
              <div className="flex p-1 bg-surface-app border border-border-soft rounded-lg shadow-inner shrink-0">
                <button onClick={() => setViewTab("manage")} className={cn("px-3 py-1 text-[11px] font-bold rounded transition-all bg-surface-raised shadow-sm text-text border border-border-soft")}>媒体库</button>
              </div>
              
              {selectedFolderKey !== "__all__" && (
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
                <button onClick={() => setViewMode("grid")} className={cn("p-1.5 rounded-sm transition-colors", viewMode === "grid" ? "bg-surface-panel shadow-sm text-brand" : "text-text-subtle hover:text-text")} title="网格模式"><LayoutGrid className="w-3.5 h-3.5" /></button>
                <button onClick={() => setViewMode("list")} className={cn("p-1.5 rounded-sm transition-colors", viewMode === "list" ? "bg-surface-panel shadow-sm text-brand" : "text-text-subtle hover:text-text")} title="列表模式"><List className="w-3.5 h-3.5" /></button>
              </div>

              <Button variant="outline" size="icon" onClick={onScanAssets} disabled={!project} className="h-8 w-8 shrink-0 rounded-full bg-surface-app" title="刷新目录"><RefreshCw className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
          
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
                         title={folder.path}
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
                           const targetPath = `${AUDIO_ROOT}/${folder.key}`;
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
                          <div className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden -translate-x-1/2 whitespace-nowrap rounded-control border border-border bg-surface-panel px-2 py-1 text-[10px] font-semibold text-text shadow-lg group-hover:block">
                            {folder.label}
                          </div>
                       </div>
                    ))}
                 </div>
              )}

              {visibleAssets.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-text-muted mt-20">
                  <FileAudio className="w-12 h-12 mb-3 opacity-20" />
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
                        <div key={asset.id} draggable onDragStart={(event) => { event.dataTransfer.setData("text/plain", asset.relativePath); event.dataTransfer.effectAllowed = "move"; }} className={cn("flex flex-col p-2 rounded-card border transition-all group", selected ? "border-brand bg-brand/5 shadow-sm" : "border-border hover:border-brand/50 bg-surface-panel hover:bg-surface-raised")} onClick={() => toggleSelected(asset.relativePath)}>
                          <div className="flex items-center gap-4 cursor-pointer">
                            <div className="relative w-12 h-12 shrink-0 bg-brand/10 rounded flex items-center justify-center">
                              <Music className="w-6 h-6 text-brand" />
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
                          
                          {/* Audio Player for list view */}
                          <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                            <audio controls className="w-full h-8 outline-none">
                              <source src={assetPreviewUrl(asset.projectId, asset.relativePath)} type="audio/mpeg" />
                            </audio>
                          </div>
                        </div>
                      );
                    })}
                  </div>
              ) : (
                <div className="grid gap-3 pb-8" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
                  {activeGenerationTask && (
                    <div className="flex flex-col bg-surface-muted/30 border border-brand/40 rounded-card overflow-hidden animate-pulse shadow-sm h-32">
                       <div className="flex-1 bg-surface-app flex items-center justify-center">
                         <RefreshCw className="w-8 h-8 text-brand animate-spin" />
                       </div>
                    </div>
                  )}
                  
                  {visibleAssets.map((asset) => {
                    const selected = selectedPaths.includes(asset.relativePath);
                    return (
                      <div 
                        key={asset.id} 
                        draggable 
                        onDragStart={(event) => { event.dataTransfer.setData("text/plain", asset.relativePath); event.dataTransfer.effectAllowed = "move"; }}
                        className={cn("flex flex-col bg-surface-panel border rounded-2xl overflow-hidden cursor-pointer group transition-all aspect-square relative", selected ? "border-brand ring-2 ring-brand/20 shadow-md" : "border-border hover:border-brand/50 hover:shadow-md")}
                        onClick={() => onSelectAsset?.(asset)}
                      >
                        <div className={cn("absolute top-2 right-2 flex justify-end z-10", selected ? "opacity-100" : "opacity-0 group-hover:opacity-100 transition-opacity")}>
                          <label className={cn("flex h-5 w-5 items-center justify-center rounded border cursor-pointer shadow-sm", selected ? "border-brand bg-brand text-[#04202a]" : "border-border-strong bg-surface-app text-brand-strong hover:bg-brand hover:border-brand hover:text-[#04202a]")} onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" className="sr-only" checked={selected} onChange={(event) => { event.stopPropagation(); toggleSelected(asset.relativePath); }} />
                            {selected ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : null}
                          </label>
                        </div>

                        <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-b from-brand/5 to-transparent p-3 overflow-hidden relative">
                           <div className="w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                             <Music className="w-6 h-6 text-brand" />
                           </div>
                           <span className="text-[11px] font-bold text-text truncate w-full text-center px-2 relative z-10">{asset.fileName}</span>
                           <span className="text-[10px] text-text-muted mt-0.5">{formatBytes(asset.sizeBytes)}</span>
                           
                           {/* Quick play overlay in grid */}
                           <div className="absolute inset-x-0 bottom-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity bg-surface-raised/90 backdrop-blur-md flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                             <audio controls className="w-full h-8 outline-none scale-90 origin-bottom">
                                <source src={assetPreviewUrl(asset.projectId, asset.relativePath)} type="audio/mpeg" />
                             </audio>
                           </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <input type="file" ref={fileInputRef} className="hidden" multiple accept="audio/*" onChange={(e) => { if (e.target.files && e.target.files.length > 0) { void handleImport(e.target.files, currentFolderPath); } e.target.value = ""; }} />
    </div>
  );
}
