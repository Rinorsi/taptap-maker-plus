import React, { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronRight, Save, Download, Upload, Trash2, Clock, FileJson } from "lucide-react";
import { NODE_PRESETS, type NodeCategory, getPresetsByCategory } from "./nodeRegistry";
import { cn } from "../../lib/utils";
import { useReactFlow } from "@xyflow/react";
import { ProjectSummary, listFlows, saveFlow, deleteFlow, getFlow } from "../../api";

const CATEGORIES: { id: NodeCategory; label: string }[] = [
  { id: "prompt", label: "提示词 (Prompt)" },
  { id: "image", label: "图片参考 (Image Ref)" },
  { id: "video", label: "视频参考 (Video Ref)" },
  { id: "audio", label: "音频参考 (Audio Ref)" },
  { id: "settings", label: "参数设置 (Settings)" },
  { id: "collector", label: "聚合器 (Collector)" },
  { id: "executor", label: "执行器 (Executor)" }
];

declare global {
  interface Window {
    __taptapNodePresetDrag?: string;
  }
}

export function NodeLibraryDrawer({ isOpen, project, onLoaded }: { isOpen: boolean, project?: ProjectSummary, onLoaded?: (data: any) => void }) {
  const [activeTab, setActiveTab] = useState<"presets" | "saved">("presets");
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    prompt: true,
    image: true,
    collector: true,
    executor: true
  });
  
  const [savedFlows, setSavedFlows] = useState<{name: string, mtimeMs: number}[]>([]);
  const reactFlow = useReactFlow();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeTab === "saved" && project) {
      refreshFlows();
    }
  }, [activeTab, project]);

  const refreshFlows = async () => {
    if (!project) return;
    try {
      const flows = await listFlows(project.id);
      setSavedFlows(flows);
    } catch (e) {
      console.error("Failed to list flows", e);
    }
  };

  const toggleCategory = (catId: string) => {
    setExpandedCategories(prev => ({ ...prev, [catId]: !prev[catId] }));
  };

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    window.__taptapNodePresetDrag = nodeType;
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.setData('text/plain', `taptap-node-preset:${nodeType}`);
    event.dataTransfer.effectAllowed = 'copy';
  };

  const onDragEnd = () => {
    window.__taptapNodePresetDrag = undefined;
  };

  const handleSaveCurrent = async () => {
    if (!project) return;
    const name = prompt("请输入保存的名称", "我的画布-" + new Date().toLocaleTimeString().replace(/:/g, '-'));
    if (!name) return;
    try {
      const data = reactFlow.toObject();
      await saveFlow(project.id, name, data);
      await refreshFlows();
    } catch (e) {
      alert("保存失败: " + String(e));
    }
  };

  const handleLoadFlow = async (name: string) => {
    if (!project || !onLoaded) return;
    try {
      const data = await getFlow(project.id, name);
      onLoaded(data);
    } catch (e) {
      alert("加载失败: " + String(e));
    }
  };

  const handleDeleteFlow = async (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    if (!project) return;
    if (!confirm(`确定要删除 ${name} 吗？`)) return;
    try {
      await deleteFlow(project.id, name);
      await refreshFlows();
    } catch (err) {
      alert("删除失败: " + String(err));
    }
  };

  const handleExportLocal = () => {
    const data = reactFlow.toObject();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `multimodal-flow-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportLocal = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onLoaded) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        onLoaded(data);
      } catch (err) {
        alert("无效的 JSON 文件");
      }
    };
    reader.readAsText(file);
    e.target.value = ""; // reset
  };

  return (
    <div
      className={cn(
        "h-full bg-surface-panel border-r border-border-soft flex flex-col overflow-hidden shrink-0 transition-[width,opacity,transform] duration-300 ease-out relative z-50",
        isOpen
          ? "w-[320px] opacity-100 translate-x-0"
          : "w-0 opacity-0 -translate-x-3 pointer-events-none border-r-0"
      )}
      aria-hidden={!isOpen}
    >
      <div className="p-4 border-b border-border-soft bg-surface-app/30 flex flex-col gap-3">
        <div>
          <h3 className="font-bold text-text">节点与布局</h3>
          <p className="text-xs text-text-subtle mt-1">拖拽预设或管理画布配置</p>
        </div>
        <div className="flex bg-surface-app rounded-md p-1 border border-border-soft">
          <button 
            className={cn("flex-1 text-xs font-bold py-1.5 rounded transition-colors", activeTab === "presets" ? "bg-surface-raised shadow-sm text-text" : "text-text-subtle hover:text-text")}
            onClick={() => setActiveTab("presets")}
          >预设库</button>
          <button 
            className={cn("flex-1 text-xs font-bold py-1.5 rounded transition-colors", activeTab === "saved" ? "bg-surface-raised shadow-sm text-brand" : "text-text-subtle hover:text-text")}
            onClick={() => setActiveTab("saved")}
          >我的保存</button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 flex flex-col gap-1 custom-scrollbar">
        {activeTab === "presets" && CATEGORIES.map(category => {
          const presets = getPresetsByCategory(category.id);
          if (presets.length === 0) return null;
          
          const isExpanded = expandedCategories[category.id];
          
          return (
            <div key={category.id} className="flex flex-col mb-1">
              <button 
                onClick={() => toggleCategory(category.id)}
                className="flex items-center gap-2 p-2 w-full hover:bg-surface-app rounded-md transition-colors text-left"
              >
                {isExpanded ? <ChevronDown className="w-4 h-4 text-text-subtle" /> : <ChevronRight className="w-4 h-4 text-text-subtle" />}
                <span className="text-sm font-bold text-text-muted">{category.label}</span>
                <span className="text-[10px] bg-surface-app px-1.5 py-0.5 rounded text-text-subtle ml-auto">{presets.length}</span>
              </button>
              
              {isExpanded && (
                <div className="flex flex-col gap-1 pl-2 pr-1 mt-1">
                  {presets.map(preset => {
                    const Icon = preset.icon;
                    return (
                      <div 
                        key={preset.id}
                        draggable
                        onDragStart={(e) => onDragStart(e, preset.id)}
                        onDragEnd={onDragEnd}
                        className="flex flex-col p-2.5 bg-surface-app/50 hover:bg-surface-app border border-transparent hover:border-brand/30 rounded-lg cursor-grab active:cursor-grabbing transition-all group"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className="w-4 h-4 text-brand opacity-80 group-hover:opacity-100" />
                          <span className="text-xs font-bold text-text">{preset.label}</span>
                        </div>
                        <span className="text-[10px] text-text-subtle leading-tight line-clamp-2">{preset.description}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {activeTab === "saved" && (
          <div className="flex flex-col gap-3 p-2">
            <div className="flex gap-2 items-stretch">
              <button 
                onClick={handleSaveCurrent}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-brand/10 hover:bg-brand/20 text-brand rounded-lg text-xs font-bold transition-colors"
              >
                <Save className="w-3.5 h-3.5" /> 保存当前画布
              </button>
              <button 
                onClick={() => fileInputRef.current?.click()}
                title="导入外部 JSON"
                className="flex items-center justify-center px-3 bg-surface-app hover:bg-surface-raised border border-border-soft rounded-lg transition-colors text-text-muted hover:text-text"
              >
                <Upload className="w-3.5 h-3.5" />
              </button>
              <input type="file" accept=".json" ref={fileInputRef} className="hidden" onChange={handleImportLocal} />
            </div>
            
            <div className="h-px bg-border-soft my-1" />

            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-bold text-text-subtle px-1 mb-1">自动保存</span>
              {(() => {
                const autoSave = savedFlows.find(f => f.name === "_autosave");
                if (!autoSave) return <div className="px-2 py-1 text-[10px] text-text-muted">暂无自动保存记录</div>;
                return (
                  <div 
                    onClick={() => handleLoadFlow(autoSave.name)}
                    className="flex items-center justify-between p-2.5 bg-surface-app/40 hover:bg-surface-app border border-transparent hover:border-brand/30 rounded-lg cursor-pointer transition-all group"
                  >
                    <div className="flex flex-col gap-1 overflow-hidden">
                      <div className="flex items-center gap-2">
                        <FileJson className="w-3.5 h-3.5 text-brand shrink-0" />
                        <span className="text-xs font-bold text-text truncate">自动存档 (恢复点)</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-text-subtle">
                        <Clock className="w-3 h-3" />
                        {new Date(autoSave.mtimeMs).toLocaleString()}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="h-px bg-border-soft my-1" />

            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-bold text-text-subtle px-1 mb-1">手动保存</span>
              {savedFlows.filter(f => f.name !== "_autosave").length === 0 && (
                <div className="text-center p-4 text-[11px] text-text-muted bg-surface-app/30 rounded-lg border border-dashed border-border">
                  暂无手动保存的画布
                </div>
              )}
              {savedFlows.filter(f => f.name !== "_autosave").sort((a,b) => b.mtimeMs - a.mtimeMs).map(flow => (
                <div 
                  key={flow.name}
                  onClick={() => handleLoadFlow(flow.name)}
                  className="flex items-center justify-between p-2.5 bg-surface-app/50 hover:bg-surface-app border border-transparent hover:border-brand/30 rounded-lg cursor-pointer transition-all group"
                >
                  <div className="flex flex-col gap-1 overflow-hidden flex-1 pr-2">
                    <div className="flex items-center gap-2">
                      <FileJson className="w-3.5 h-3.5 text-brand shrink-0" />
                      <span className="text-xs font-bold text-text truncate">{flow.name}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-text-subtle">
                      <Clock className="w-3 h-3" />
                      {new Date(flow.mtimeMs).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button 
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!project) return;
                        try {
                          const flowData = await getFlow(project.id, flow.name);
                          if (!flowData) return;
                          const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(flowData));
                          const a = document.createElement('a');
                          a.setAttribute("href", dataStr);
                          a.setAttribute("download", `${flow.name}.json`);
                          a.click();
                        } catch (err) {
                          console.error(err);
                        }
                      }}
                      className="p-1.5 text-text-subtle hover:text-brand hover:bg-brand/10 rounded-md transition-colors"
                      title="导出 JSON"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={(e) => handleDeleteFlow(e, flow.name)}
                      className="p-1.5 text-text-subtle hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
                      title="删除记录"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
