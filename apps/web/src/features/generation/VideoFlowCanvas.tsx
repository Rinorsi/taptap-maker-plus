import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { 
  ReactFlow, 
  Background, 
  Controls,
  addEdge, 
  type Node, 
  type Edge, 
  type Connection,
  Panel,
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  ReactFlowProvider, 
  useReactFlow,
  useNodesState,
  useEdgesState,
  MiniMap
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { X, Activity, AlertCircle, Boxes, LibrarySquare } from "lucide-react";
import { cn } from "../../lib/utils";
import { assetPreviewUrl, type AssetSummary, type ProjectSummary, type TaskRecord, type ToolSummary, getFlow, autoSaveFlow } from "../../api";
import { Button } from "../../components/ui/Button";
import { NodeLibraryDrawer } from "./NodeLibraryDrawer";
import { getPresetById } from "./nodeRegistry";
import { buildVideoPayloadFromGraph } from "./VideoFlowPayloadBuilder";
import { readAssetDragPath } from "./dragData";
import { 
  GenericTextNode, 
  GenericMediaNode, 
  GenericSettingsNode, 
  GenericCollectorNode, 
  GenericExecutorNode,
  GenericResultNode
} from "./VideoFlowNodes";

// Custom Edge 
function CustomEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd, data }: any) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
  });

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          <button
            className="w-5 h-5 bg-surface-panel hover:bg-red-500 hover:text-white text-red-500 rounded-full flex items-center justify-center text-[10px] backdrop-blur-md border border-red-500/50 transition-colors shadow-sm"
            onClick={(e) => {
              e.stopPropagation();
              data?.onDelete?.(id);
            }}
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

const nodeTypes = {
  textNode: GenericTextNode,
  mediaNode: GenericMediaNode,
  settingsNode: GenericSettingsNode,
  collectorNode: GenericCollectorNode,
  executorNode: GenericExecutorNode,
  resultNode: GenericResultNode
};

const edgeTypes = {
  custom: CustomEdge
};

const defaultEdgeOptions = {
  animated: true,
  type: 'custom',
  style: { stroke: '#00D9C5', strokeWidth: 2 }
};

type VideoFlowCanvasProps = {
  project?: ProjectSummary;
  allAssets: AssetSummary[];
  activeGenerationTask?: TaskRecord;
  isCloudVideoRunning?: boolean;
  generateTool?: ToolSummary;
  onCallTool: (toolName: string, args: Record<string, unknown>) => Promise<unknown>;
  onShowError?: () => void;
};

export function VideoFlowCanvas(props: VideoFlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <VideoFlowCanvasInner {...props} />
    </ReactFlowProvider>
  )
}

function VideoFlowCanvasInner({ project, allAssets, activeGenerationTask, isCloudVideoRunning, generateTool, onCallTool, onShowError }: VideoFlowCanvasProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const reactFlow = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [isPayloadPanelOpen, setIsPayloadPanelOpen] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(false);

  const [validationError, setValidationError] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<{nodes: Node[], edges: Edge[]} | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in input/textarea
      const activeTagName = document.activeElement?.tagName.toLowerCase();
      if (activeTagName === 'input' || activeTagName === 'textarea') return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        const selectedNodes = reactFlow.getNodes().filter(n => n.selected);
        if (selectedNodes.length > 0) {
          const selectedNodeIds = new Set(selectedNodes.map(n => n.id));
          const selectedEdges = reactFlow.getEdges().filter(edge => selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target));
          setClipboard({ nodes: selectedNodes, edges: selectedEdges });
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        if (clipboard) {
          const newNodes: Node[] = [];
          const newEdges: Edge[] = [];
          const idMap = new Map<string, string>();
          
          clipboard.nodes.forEach(n => {
            const newId = n.type + "-" + Date.now() + Math.random().toString(36).slice(2, 6);
            idMap.set(n.id, newId);
            newNodes.push({
              ...n,
              id: newId,
              selected: true,
              position: { x: n.position.x + 30, y: n.position.y + 30 }
            });
          });

          clipboard.edges.forEach(edge => {
            if (idMap.has(edge.source) && idMap.has(edge.target)) {
              newEdges.push({
                ...edge,
                id: "e" + idMap.get(edge.source) + "-" + idMap.get(edge.target),
                source: idMap.get(edge.source)!,
                target: idMap.get(edge.target)!,
                selected: true
              });
            }
          });

          setNodes(nds => [...nds.map(n => ({ ...n, selected: false })), ...newNodes]);
          setEdges(eds => [...eds.map(e => ({ ...e, selected: false })), ...newEdges]);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setNodes(nds => nds.map(n => ({ ...n, selected: true })));
        setEdges(eds => eds.map(edge => ({ ...edge, selected: true })));
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [reactFlow, clipboard, setNodes, setEdges]);

  // Auto-load on mount
  const hasLoadedRef = useRef(false);
  useEffect(() => {
    if (!project || hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    getFlow(project.id, "_autosave")
      .then(data => {
        if (data && data.nodes && data.edges) {
          setNodes(data.nodes || []);
          setEdges(data.edges || []);
          if (data.viewport) reactFlow.setViewport(data.viewport);
        }
      })
      .catch(() => { /* ignore, probably doesn't exist yet */ });
  }, [project, setNodes, setEdges, reactFlow]);

  // Auto-save every 30s
  useEffect(() => {
    if (!project) return;
    const interval = setInterval(() => {
      const data = reactFlow.toObject();
      if (data.nodes.length > 0) {
        autoSaveFlow(project.id, data).catch(console.error);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [project, reactFlow]);

  const handleNodeDataChange = useCallback((id: string, key: string, value: string) => {
    setNodes((nds) =>
      nds.map((n) => n.id === id ? { ...n, data: { ...n.data, [key]: value } } : n)
    );
  }, [setNodes]);

  const updateNodeData = useCallback((id: string, data: Record<string, unknown>) => {
    setNodes((nds) =>
      nds.map((n) => n.id === id ? { ...n, data: { ...n.data, ...data } } : n)
    );
  }, [setNodes]);

  const handleDeleteNode = useCallback((id: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  }, [setNodes, setEdges]);

  const handleDeleteEdge = useCallback((id: string) => {
    setEdges((eds) => eds.filter((e) => e.id !== id));
  }, [setEdges]);

  const validationResult = useMemo(() => {
    return buildVideoPayloadFromGraph(nodes, edges);
  }, [nodes, edges]);

  const handleRun = useCallback(() => {
    if (!generateTool || !project) return;
    
    if (!validationResult.ok) {
      setValidationError(validationResult.errors?.join("\\n") || "配置错误");
      onShowError?.();
      setTimeout(() => setValidationError(null), 3000);
      return;
    }

    void onCallTool(generateTool.name, validationResult.payload!);
    
  }, [validationResult, generateTool, project, onCallTool, onShowError]);

  // Inject callbacks into nodes
  const nodesWithCallbacks = useMemo(() => {
    // Find payload nodes for live stats
    const prevMap = new Map<string, Node[]>();
    for (const e of edges) {
      if (!prevMap.has(e.target)) prevMap.set(e.target, []);
      const sourceNode = nodes.find(n => n.id === e.source);
      if (sourceNode) prevMap.get(e.target)!.push(sourceNode);
    }

    return nodes.map(n => {
      const base = { ...n, data: { ...n.data, onDelete: handleDeleteNode } };
      
      if (n.type === "textNode" || n.type === "mediaNode" || n.type === "settingsNode" || n.type === "resultNode") {
        return { 
          ...base, 
          data: { 
            ...base.data, 
            onChange: handleNodeDataChange,
            allAssets,
            project,
            onAssetDrop: (id: string, assetPath: string) => {
              const asset = allAssets.find(a => a.relativePath === assetPath);
              const targetNode = nodes.find(node => node.id === id);
              const preset = targetNode ? getPresetById(targetNode.data.presetId as string) : undefined;
              if (!asset || !project || !preset) return;

              if (preset.category === "image" && asset.assetType !== "image") {
                setValidationError("这个节点只能接收图片素材");
                setTimeout(() => setValidationError(null), 3000);
                return;
              }
              if (preset.category === "video" && asset.assetType !== "video") {
                setValidationError("这个节点只能接收视频素材");
                setTimeout(() => setValidationError(null), 3000);
                return;
              }
              if (preset.category === "audio" && asset.assetType !== "audio") {
                setValidationError("这个节点只能接收音频素材");
                setTimeout(() => setValidationError(null), 3000);
                return;
              }

              if (asset && project) {
                 updateNodeData(id, {
                   relativePath: asset.relativePath,
                   fileName: asset.fileName,
                   url: assetPreviewUrl(project.id, asset.relativePath)
                 });
              }
            }
          } 
        };
      }
      
      if (n.type === "collectorNode" && n.data.presetId === "MultiModalPayloadNode") {
        // Collect stats
        let promptCount = 0; let imagesCount = 0; let videosCount = 0; let audiosCount = 0; let settingsCount = 0; let error = null;
        const executor = nodes.find(node => node.type === "executorNode" && node.data.presetId === "CreateVideoTaskNode");
        const directPrevs = executor ? prevMap.get(executor.id) || [] : [n];
        
        const visited = new Set<string>();
        const traverse = (nodeId: string) => {
          if (visited.has(nodeId)) return;
          visited.add(nodeId);
          const prevs = prevMap.get(nodeId) || [];
          for (const p of prevs) {
            const preset = getPresetById(p.data.presetId as string);
            if (preset?.category === "prompt" && p.data.text) promptCount++;
            if (preset?.category === "image") imagesCount++;
            if (preset?.category === "video") videosCount++;
            if (preset?.category === "audio") audiosCount++;
            if (preset?.category === "settings") settingsCount++;
            traverse(p.id);
          }
        };
        for (const inputNode of directPrevs) {
          const preset = getPresetById(inputNode.data.presetId as string);
          if (preset?.category === "prompt" && inputNode.data.text) promptCount++;
          if (preset?.category === "image") imagesCount++;
          if (preset?.category === "video") videosCount++;
          if (preset?.category === "audio") audiosCount++;
          if (preset?.category === "settings") settingsCount++;
          traverse(inputNode.id);
        }

        if (imagesCount > 9) error = "最多 9 张图片";
        else if (videosCount > 3) error = "最多 3 个视频";
        else if (audiosCount > 3) error = "最多 3 个音频";
        else if (audiosCount > 0 && imagesCount === 0) error = "缺少必需的图片参考";

        return { ...base, data: { ...base.data, promptCount, imagesCount, videosCount, audiosCount, settingsCount, error } };
      }
      
      if (n.type === "executorNode") {
        return { ...base, data: { ...base.data, onRun: handleRun, busy: activeGenerationTask !== undefined || isCloudVideoRunning, isCloudVideoRunning } };
      }
      return base;
    });
  }, [nodes, edges, handleNodeDataChange, updateNodeData, handleRun, handleDeleteNode, activeGenerationTask, isCloudVideoRunning, allAssets, project]);

  const edgesWithCallbacks = useMemo(() => {
    return edges.map(e => ({
      ...e,
      data: { ...e.data, onDelete: handleDeleteEdge }
    }));
  }, [edges, handleDeleteEdge]);

  const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge({ ...params, type: 'custom' }, eds)), [setEdges]);

  // Drag and Drop
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      // Check if dropped file is JSON
      if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
        const file = event.dataTransfer.files[0];
        if (file.name.endsWith('.json')) {
          const reader = new FileReader();
          reader.onload = (e) => {
            try {
              const flowData = JSON.parse(e.target?.result as string);
              if (flowData && Array.isArray(flowData.nodes) && Array.isArray(flowData.edges)) {
                setNodes(flowData.nodes);
                setEdges(flowData.edges);
                setTimeout(() => reactFlow.fitView(), 50);
              }
            } catch (err) {
              console.error("Invalid JSON flow file", err);
            }
          };
          reader.readAsText(file);
          return;
        }
      }

      if (!wrapperRef.current) return;

      const position = reactFlow.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Check if dropped from Node Library
      const presetId = event.dataTransfer.getData('application/reactflow');
      if (presetId) {
        const preset = getPresetById(presetId);
        if (!preset) return;

        let type = "";
        if (preset.category === "prompt") type = "textNode";
        else if (["image", "video", "audio"].includes(preset.category)) type = "mediaNode";
        else if (preset.category === "settings") type = "settingsNode";
        else if (preset.category === "collector") type = "collectorNode";
        else if (preset.category === "executor") {
          if (preset.id === "VideoResultNode") type = "resultNode";
          else type = "executorNode";
        } else if (preset.category === "utility") type = "executorNode";
        
        const baseNode: Node = {
          id: `${type}-${Date.now()}`,
          type,
          position,
          data: { presetId: preset.id, ...preset.defaultData }
        };
        
        // Auto-connect to executor if dropping a result node
        if (type === "resultNode") {
           const executor = reactFlow.getNodes().find(n => n.type === "executorNode");
           if (executor) {
             setEdges(eds => [...eds, { id: `e-${executor.id}-${baseNode.id}`, source: executor.id, target: baseNode.id, ...defaultEdgeOptions }]);
           }
        }

        setNodes((nds) => nds.concat(baseNode));
        return;
      }
      
      // Check if dropped from Asset Library
      if (!project) return;
      const relativePath = readAssetDragPath(event.dataTransfer);
      if (!relativePath) return;
      
      const asset = allAssets.find(a => a.relativePath === relativePath);
      if (!asset) return;
      
      let presetIdMap = "";
      if (asset.assetType === "image") presetIdMap = "GenericImageNode";
      else if (asset.assetType === "video") presetIdMap = "GenericVideoNode";
      else if (asset.assetType === "audio") presetIdMap = "GenericAudioNode";
      else return;

      const preset = getPresetById(presetIdMap);

      const newNode: Node = {
        id: `ref-${Math.random().toString(36).substr(2, 9)}`,
        type: "mediaNode",
        position,
        data: { 
          presetId: presetIdMap,
          ...(preset?.defaultData || {}),
          relativePath: asset.relativePath,
          fileName: asset.fileName,
          url: assetPreviewUrl(project.id, asset.relativePath),
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlow, setNodes, project, allAssets]
  );

  return (
    <div className="flex h-full w-full bg-surface-app relative" ref={wrapperRef}>
      <NodeLibraryDrawer 
        isOpen={isDrawerOpen} 
        project={project}
        onLoaded={(data) => {
          setNodes(data.nodes || []);
          setEdges(data.edges || []);
          if (data.viewport) reactFlow.setViewport(data.viewport);
        }}
      />
      
      {/* Canvas */}
      <div className="flex-1 relative min-w-0 transition-all duration-300">
        <ReactFlow
          nodes={nodesWithCallbacks}
          edges={edgesWithCallbacks}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          fitView
          snapToGrid={snapToGrid}
          snapGrid={[20, 20]}
          className="bg-transparent"
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#9ca3af" variant={"dots" as any} gap={24} size={1.5} className="opacity-40" />
          <Controls className="bg-surface-panel border-border-soft fill-text-subtle" />
          <Panel position="top-left" className="flex flex-wrap items-start justify-between w-[calc(100%-16px)] pointer-events-none mt-2 ml-2 mr-2 z-50 gap-2">
            
            {/* Left Controls */}
            <div className="flex flex-wrap items-center gap-2 bg-surface-panel/90 backdrop-blur-md p-2 rounded-xl shadow-lg border border-border pointer-events-auto">
              <Button variant="outline" size="sm" className="h-8 text-xs bg-surface-app" onClick={() => setIsDrawerOpen(!isDrawerOpen)}>
                <LibrarySquare className="w-4 h-4 mr-1.5 text-brand" />
                {isDrawerOpen ? "收起节点与布局" : "展开节点与布局"}
              </Button>
              <div className="w-[1px] h-4 bg-border mx-1" />
              <Button variant="outline" size="sm" className={cn("h-8 text-xs", snapToGrid ? "bg-brand/10 text-brand border-brand/30 hover:bg-brand/20" : "bg-surface-app text-text-subtle hover:text-text")} onClick={() => setSnapToGrid(!snapToGrid)}>
                <Boxes className="w-4 h-4 mr-1.5" />
                网格吸附
              </Button>
              <div className="w-[1px] h-4 bg-border mx-1" />
              <Button variant="outline" size="sm" className="h-8 text-xs bg-brand/10 text-brand border-brand/30 hover:bg-brand/20" onClick={() => {
                // Built-in basic preset
                const taskId = `task-${Date.now()}`;
                const payloadId = `payload-${Date.now()}`;
                const promptId = `prompt-${Date.now()}`;
                const settingsId = `settings-${Date.now()}`;
                setNodes([
                  { id: promptId, type: 'textNode', position: { x: 50, y: 50 }, data: { presetId: 'MainPromptNode', text: '一个赛博朋克城市的夜景，霓虹闪烁，高画质，电影级运镜...' } },
                  { id: settingsId, type: 'settingsNode', position: { x: 50, y: 350 }, data: { presetId: 'VideoModelNode', value: 'default', type: 'model' } },
                  { id: payloadId, type: 'collectorNode', position: { x: 450, y: 150 }, data: { presetId: 'MultiModalPayloadNode' } },
                  { id: taskId, type: 'executorNode', position: { x: 800, y: 150 }, data: { presetId: 'CreateVideoTaskNode' } },
                ]);
                setEdges([
                  { id: `e-${promptId}-${payloadId}`, source: promptId, target: payloadId, ...defaultEdgeOptions },
                  { id: `e-${settingsId}-${payloadId}`, source: settingsId, target: payloadId, ...defaultEdgeOptions },
                  { id: `e-${payloadId}-${taskId}`, source: payloadId, target: taskId, ...defaultEdgeOptions }
                ]);
              }}>一键模板</Button>
              <Button variant="outline" size="sm" className="h-8 text-xs bg-surface-app" onClick={() => {
                setNodes([]);
                setEdges([]);
              }}>清空画布</Button>
            </div>

            {/* Right Payload */}
            <div className="flex flex-col items-end gap-2 pointer-events-none ml-auto">
              <Button variant="outline" size="sm" className="h-8 text-xs bg-surface-panel/90 backdrop-blur-md shadow-lg border-border pointer-events-auto" onClick={() => setIsPayloadPanelOpen(!isPayloadPanelOpen)}>
                <Activity className="w-4 h-4 mr-1.5 text-brand" />
                {isPayloadPanelOpen ? "收起 Payload" : "检查 Payload"}
                {validationResult.errors.length > 0 && <span className="ml-1.5 w-2 h-2 rounded-full bg-[#b03939]" />}
              </Button>
              
              {isPayloadPanelOpen && (
                <div className="bg-surface-panel/95 backdrop-blur-md p-3 rounded-xl shadow-lg border border-border w-80 max-h-[70vh] flex flex-col gap-3 overflow-hidden pointer-events-auto">
                  <div className="flex items-center gap-2 border-b border-border pb-2 shrink-0">
                    <Activity className="w-4 h-4 text-brand" />
                    <span className="text-xs font-bold">Payload 预览与检查</span>
                  </div>
              
              <div className="flex-1 overflow-y-auto scrollbar-thin flex flex-col gap-3 pr-1">
                {validationResult.errors.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-[#b03939]">错误 (阻断执行)</span>
                    {validationResult.errors.map((err, i) => (
                      <div key={i} className="text-[10px] bg-[#b03939]/10 border border-[#b03939]/20 text-[#b03939] p-1.5 rounded flex items-start gap-1.5">
                        <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                        <span className="leading-tight">{err}</span>
                      </div>
                    ))}
                  </div>
                )}
                {validationResult.warnings.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-yellow-500">警告 (建议修复)</span>
                    {validationResult.warnings.map((warn, i) => (
                      <div key={i} className="text-[10px] bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 p-1.5 rounded flex items-start gap-1.5">
                        <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                        <span className="leading-tight">{warn}</span>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Quick Fixes */}
                {(validationResult.errors.length > 0 || validationResult.warnings.length > 0) && (
                  <div className="flex flex-wrap gap-1.5 mt-1 pt-2 border-t border-border-soft">
                    <span className="text-[10px] font-bold text-text-subtle w-full mb-0.5">快捷修复:</span>
                    <button 
                      onClick={() => {
                        setNodes(nds => nds.filter(n => {
                          if (["GenericImageNode", "GenericVideoNode", "GenericAudioNode"].includes(n.data.presetId as string)) {
                            return !!(n.data.relativePath || n.data.url);
                          }
                          return true;
                        }));
                      }}
                      className="text-[9px] bg-surface-raised hover:bg-surface-muted text-text-muted px-2 py-1 rounded border border-border-soft transition-colors"
                    >
                      删除空素材
                    </button>
                    <button 
                      onClick={() => {
                        setNodes(nds => nds.map(n => {
                          if (n.data.type === "seed") return { ...n, data: { ...n.data, value: "" } };
                          return n;
                        }));
                      }}
                      className="text-[9px] bg-surface-raised hover:bg-surface-muted text-text-muted px-2 py-1 rounded border border-border-soft transition-colors"
                    >
                      清空种子
                    </button>
                    <button 
                      onClick={() => {
                        setNodes(nds => nds.filter(n => !["GenericImageNode", "GenericVideoNode", "GenericAudioNode"].includes(n.data.presetId as string)));
                      }}
                      className="text-[9px] bg-surface-raised hover:bg-surface-muted text-text-muted px-2 py-1 rounded border border-border-soft transition-colors"
                    >
                      转为纯文生视频
                    </button>
                  </div>
                )}
                
                <div className="flex flex-col gap-1 mt-1">
                  <span className="text-[10px] font-bold text-text-muted flex justify-between items-center">
                    <span>最终 Payload (模拟)</span>
                    <button 
                      className="text-brand hover:text-brand-strong disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      disabled={!validationResult.ok}
                      onClick={() => {
                         if (validationResult.payload) {
                           navigator.clipboard.writeText(JSON.stringify(validationResult.payload, null, 2));
                         }
                      }}
                    >
                      复制 JSON
                    </button>
                  </span>
                  <pre className="text-[9px] font-mono bg-[#0a0f1d] border border-border p-2 rounded text-white/70 overflow-x-auto whitespace-pre-wrap max-h-48 scrollbar-thin">
                    {validationResult.payload ? JSON.stringify(validationResult.payload, null, 2) : "无法生成 Payload (请先修复错误)"}
                  </pre>
                </div>
              </div>
              </div>
              )}
            </div>
          </Panel>

          <MiniMap 
            className="bg-surface-panel border-border-soft" 
            nodeColor={(n) => {
              if (n.type === 'executorNode') return '#00D9C5';
              if (n.type === 'settingsNode') return 'var(--color-text-subtle)';
              return 'var(--color-text-muted)';
            }} 
            maskColor="var(--surface-app)"
          />
        </ReactFlow>

        {validationError && (
          <div className="fixed top-12 left-1/2 -translate-x-1/2 bg-red-500/95 text-white px-6 py-3 rounded-2xl flex items-center gap-3 shadow-[0_20px_40px_rgba(239,68,68,0.4)] z-[9999] animate-in slide-in-from-top-4 fade-in pointer-events-none">
            <AlertCircle className="w-5 h-5" />
            <span className="text-[14px] font-bold">{validationError}</span>
          </div>
        )}
      </div>
    </div>
  );
}
