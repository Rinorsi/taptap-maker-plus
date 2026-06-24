import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  applyEdgeChanges,
  applyNodeChanges,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import Form from "@rjsf/core";
import validator from "@rjsf/validator-ajv8";
import type { RJSFSchema, UiSchema } from "@rjsf/utils";
import {
  Activity,
  Boxes,
  Braces,
  CircleAlert,
  Copy,
  Database,
  Eye,
  GitBranch,
  Maximize2,
  MousePointer2,
  Play,
  Plus,
  Save,
  Trash2,
  WandSparkles,
} from "lucide-react";
import {
  deleteWorkflow,
  deleteWorkflowRun,
  listWorkflowRuns,
  listWorkflows,
  runWorkflow,
  saveWorkflow,
  type MakerWorkflowGraph,
  type ProjectSummary,
  type TaskRecord,
  type ToolSummary,
  type WorkflowGraphRecord,
  type WorkflowRunRecord,
} from "../../api";
import { Button } from "../../components/ui/Button";
import {
  AppContextMenu,
  clampContextMenuPosition,
  CONTEXT_MENU_CLOSE_EVENT,
  CONTEXT_MENU_OPEN_EVENT,
  notifyContextMenuOpen,
  shouldIgnoreContextMenuEvent,
  shouldUseNativeContextMenu,
} from "../../commands";
import { cn } from "../../lib/utils";

type Props = {
  project?: ProjectSummary;
  tools: ToolSummary[];
  tasks: TaskRecord[];
  onSelectTool: (tool: ToolSummary) => void;
};

type ToolInputs = Record<string, Record<string, unknown>>;
type FlowGraph = { nodes: Node[]; edges: Edge[] };
type WorkflowCommandDetail =
  | { action: "fitView" | "selectAll" | "clear" }
  | { action: "copyNode" | "deleteNode" | "runNode" | "toggleNodeCollapse" | "copyNodeId" | "showNodePayload"; nodeId?: string }
  | { action: "deleteEdge" | "copyEdgeId" | "showEdgePayload"; edgeId?: string };
type WorkflowMenu =
  | {
      type: "pane";
      x: number;
      y: number;
      flowPosition: { x: number; y: number };
    }
  | { type: "node"; x: number; y: number; nodeId: string }
  | { type: "edge"; x: number; y: number; edgeId: string };
type ClipboardNode = { node: Node; inputs?: Record<string, unknown> };
type PayloadDialog = { title: string; body: string };

const categoryOrder = [
  "status",
  "image",
  "video",
  "music",
  "model3d",
  "build",
  "other",
];

const workflowFormUiSchema: UiSchema = {
  "ui:submitButtonOptions": { norender: true },
  "ui:globalOptions": { label: true },
};

export function WorkflowCanvas({ project, tools, tasks, onSelectTool }: Props) {
  const [workflows, setWorkflows] = useState<WorkflowGraphRecord[]>([]);
  const [runs, setRuns] = useState<WorkflowRunRecord[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [toolInputs, setToolInputs] = useState<ToolInputs>({});
  const [draftGraph, setDraftGraph] = useState<FlowGraph>();
  const [clipboardNode, setClipboardNode] = useState<ClipboardNode>();
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [workflowMenu, setWorkflowMenu] = useState<WorkflowMenu>();
  const [payloadDialog, setPayloadDialog] = useState<PayloadDialog>();
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const reactFlowRef = useRef<ReactFlowInstance<Node, Edge> | null>(null);
  const hoveredObjectRef = useRef<
    { type: "node"; node: Node } | { type: "edge"; edge: Edge } | null
  >(null);

  const generatedGraph = useMemo(
    () => buildGraph(tools, tasks, toolInputs, runs[0]),
    [tools, tasks, toolInputs, runs],
  );
  const selectedWorkflow = workflows.find(
    (workflow) => workflow.id === selectedWorkflowId,
  );
  const baseGraph = useMemo(
    () =>
      selectedWorkflow
        ? graphToFlow(selectedWorkflow.graph, tools, tasks, runs[0])
        : generatedGraph,
    [generatedGraph, runs, selectedWorkflow, tasks, tools],
  );
  const visibleGraph = draftGraph ?? baseGraph;
  const { nodes: graphNodes, edges } = visibleGraph;
  const latestRun = runs[0];
  const nodes = useMemo(
    () =>
      graphNodes.map((node) =>
        applyDisplayState(
          node,
          collapsedNodeIds.has(node.id),
          tools,
          tasks,
          latestRun,
          toolInputs,
        ),
      ),
    [collapsedNodeIds, graphNodes, latestRun, tasks, toolInputs, tools],
  );
  const selectedToolNode = useMemo(
    () => findToolForNode(nodes, tools, selectedNodeId),
    [nodes, tools, selectedNodeId],
  );
  const executableNodeIds = useMemo(
    () =>
      nodes
        .filter((node) => isToolNode(node) && hasConfiguredInput(node, tools))
        .map((node) => node.id),
    [nodes, tools],
  );
  const failedCount = tasks.filter((task) => task.status === "failed").length;

  useEffect(() => {
    if (!project) {
      setWorkflows([]);
      setRuns([]);
      setSelectedWorkflowId("");
      setSelectedNodeId("");
      setToolInputs({});
      setDraftGraph(undefined);
      setCollapsedNodeIds(new Set());
      setWorkflowMenu(undefined);
      return;
    }
    void refreshWorkflowData(project.id);
  }, [project?.id]);

  useEffect(() => {
    if (!selectedWorkflow) return;
    setToolInputs(inputsFromGraph(selectedWorkflow.graph));
  }, [selectedWorkflow?.id]);

  useEffect(() => {
    setDraftGraph(undefined);
    setCollapsedNodeIds(new Set());
    setWorkflowMenu(undefined);
  }, [selectedWorkflowId, tools]);

  useEffect(() => {
    const onContextMenu = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as globalThis.Node | null))
        return;
      if (shouldUseNativeContextMenu(event.target))
        return;
      event.preventDefault();
      event.stopPropagation();
      if (
        (event.target as HTMLElement | null)?.closest(
          "[data-workflow-menu-surface]",
        )
      )
        return;
      const hoveredObject = hoveredObjectRef.current;
      const position = clampContextMenuPosition(
        { x: event.clientX, y: event.clientY },
        { width: 260, height: 360 },
      );
      notifyContextMenuOpen("workflow");
      if (hoveredObject?.type === "node") {
        setSelectedNodeId(hoveredObject.node.id);
        setWorkflowMenu({
          type: "node",
          x: position.x,
          y: position.y,
          nodeId: hoveredObject.node.id,
        });
        return;
      }
      if (hoveredObject?.type === "edge") {
        setWorkflowMenu({
          type: "edge",
          x: position.x,
          y: position.y,
          edgeId: hoveredObject.edge.id,
        });
        return;
      }
      const flowPosition = reactFlowRef.current?.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      }) ?? { x: 80, y: 80 };
      setWorkflowMenu({
        type: "pane",
        x: position.x,
        y: position.y,
        flowPosition,
      });
    };
    const onCloseContextMenus = () => setWorkflowMenu(undefined);
    const onOtherContextMenuOpen = (event: Event) => {
      if (shouldIgnoreContextMenuEvent(event, "workflow")) return;
      setWorkflowMenu(undefined);
    };
    window.addEventListener("contextmenu", onContextMenu, { capture: true });
    window.addEventListener(CONTEXT_MENU_CLOSE_EVENT, onCloseContextMenus);
    window.addEventListener(CONTEXT_MENU_OPEN_EVENT, onOtherContextMenuOpen);
    return () => {
      window.removeEventListener("contextmenu", onContextMenu, {
        capture: true,
      });
      window.removeEventListener(CONTEXT_MENU_CLOSE_EVENT, onCloseContextMenus);
      window.removeEventListener(CONTEXT_MENU_OPEN_EVENT, onOtherContextMenuOpen);
    };
  }, []);

  async function refreshWorkflowData(projectId: string) {
    const [nextWorkflows, nextRuns] = await Promise.all([
      listWorkflows(projectId).catch(() => []),
      listWorkflowRuns(projectId).catch(() => []),
    ]);
    setWorkflows(nextWorkflows);
    setRuns(nextRuns);
    setSelectedWorkflowId((current) =>
      current && nextWorkflows.some((workflow) => workflow.id === current)
        ? current
        : "",
    );
  }

  const handleNodesChange = useCallback(
    (changes: NodeChange<Node>[]) => {
      setDraftGraph((current) => ({
        ...(current ?? visibleGraph),
        nodes: applyNodeChanges(changes, (current ?? visibleGraph).nodes),
      }));
    },
    [visibleGraph],
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => {
      setDraftGraph((current) => ({
        ...(current ?? visibleGraph),
        edges: applyEdgeChanges(changes, (current ?? visibleGraph).edges),
      }));
    },
    [visibleGraph],
  );

  function activeGraph(): MakerWorkflowGraph {
    return flowToGraph(graphNodes, edges, toolInputs);
  }

  async function handleSave() {
    if (!project) return;
    setBusy(true);
    setNotice("保存节点流...");
    try {
      const name = selectedWorkflow?.name ?? `${project.name} MCP Workflow`;
      const response = await saveWorkflow(
        project.id,
        name,
        activeGraph(),
        selectedWorkflow?.id,
      );
      setWorkflows(response.workflows);
      setSelectedWorkflowId(response.workflow.id);
      setNotice(`已保存：${response.workflow.name}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!project || !selectedWorkflowId) return;
    setBusy(true);
    setNotice("删除节点流...");
    try {
      const response = await deleteWorkflow(project.id, selectedWorkflowId);
      setWorkflows(response.workflows);
      setSelectedWorkflowId("");
      setSelectedNodeId("");
      setNotice("已删除保存的节点流");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleRun(nodeIds: string[]) {
    if (!project || nodeIds.length === 0) return;
    setBusy(true);
    setNotice("运行节点流...");
    try {
      const response = await runWorkflow(
        project.id,
        activeGraph(),
        nodeIds,
        selectedWorkflow?.name ?? `${project.name} workflow run`,
        selectedWorkflow?.id,
      );
      setRuns(response.runs);
      setNotice(`运行完成：${response.run.status}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteRun(runId: string) {
    if (!project) return;
    setBusy(true);
    setNotice("删除执行记录...");
    try {
      const response = await deleteWorkflowRun(project.id, runId);
      setRuns(response.runs);
      setNotice("已删除执行记录");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  function setGraph(updater: (current: FlowGraph) => FlowGraph) {
    setDraftGraph((current) => updater(current ?? visibleGraph));
  }

  function addNode(
    kind: "tool" | "input" | "static",
    position?: { x: number; y: number },
  ) {
    const nodePosition = position ?? { x: 120, y: 120 };
    const id = `${kind}-${Date.now()}`;
    if (kind === "tool") {
      const tool = tools[0];
      if (!tool) {
        setNotice("没有可用工具节点");
        return;
      }
      const node = createToolNode(
        tool,
        id,
        nodePosition,
        toolInputs[id],
        tasks,
        latestRun,
      );
      setGraph((current) => ({
        ...current,
        nodes: current.nodes.concat(node),
      }));
      setSelectedNodeId(id);
      setNotice(`已新增工具节点：${tool.name}`);
      return;
    }

    const node =
      kind === "input"
        ? createStaticNode(
            id,
            nodePosition,
            "Input",
            "手动输入 / 上游数据",
            <Braces className="h-4 w-4" />,
            "#4D4DAD",
          )
        : createStaticNode(
            id,
            nodePosition,
            "Static",
            "静态说明节点",
            <Database className="h-4 w-4" />,
            "#7b8794",
          );
    setGraph((current) => ({ ...current, nodes: current.nodes.concat(node) }));
    setSelectedNodeId(id);
    setNotice(kind === "input" ? "已新增输入节点" : "已新增静态节点");
  }

  function pasteNode(position?: { x: number; y: number }) {
    if (!clipboardNode) return;
    const nextId = `${clipboardNode.node.id}-copy-${Date.now()}`;
    const node = cloneNodeForCanvas(
      clipboardNode.node,
      nextId,
      position ?? {
        x: clipboardNode.node.position.x + 36,
        y: clipboardNode.node.position.y + 36,
      },
      tools,
      tasks,
      latestRun,
      clipboardNode.inputs,
    );
    setGraph((current) => ({ ...current, nodes: current.nodes.concat(node) }));
    if (clipboardNode.inputs)
      setToolInputs((current) => ({
        ...current,
        [nextId]: clipboardNode.inputs ?? {},
      }));
    setSelectedNodeId(nextId);
    setNotice("已粘贴节点");
  }

  function copyNode(nodeId: string) {
    const node = nodes.find((item) => item.id === nodeId);
    if (!node) return;
    const inputs = isToolNode(node)
      ? (toolInputs[nodeId] ?? asRecord(node.data.inputs) ?? {})
      : undefined;
    setClipboardNode({ node, inputs });
    setNotice("已复制节点");
  }

  function deleteNode(nodeId: string) {
    setGraph((current) => ({
      nodes: current.nodes.filter((node) => node.id !== nodeId),
      edges: current.edges.filter(
        (edge) => edge.source !== nodeId && edge.target !== nodeId,
      ),
    }));
    setToolInputs((current) => removeRecordKey(current, nodeId));
    setCollapsedNodeIds((current) => withoutSetValue(current, nodeId));
    setSelectedNodeId((current) => (current === nodeId ? "" : current));
    setNotice("已删除节点");
  }

  function deleteEdge(edgeId: string) {
    setGraph((current) => ({
      ...current,
      edges: current.edges.filter((edge) => edge.id !== edgeId),
    }));
    setNotice("已删除连线");
  }

  function copyTextToClipboard(text: string, message: string) {
    void navigator.clipboard?.writeText(text).catch(() => undefined);
    setNotice(message);
  }

  function showNodePayload(nodeId: string) {
    const node = nodes.find((item) => item.id === nodeId);
    if (!node) return;
    setPayloadDialog({
      title: `节点 payload：${nodeId}`,
      body: stringifyPayload(serializableNodeData(node, toolInputs)),
    });
  }

  function showEdgePayload(edgeId: string) {
    const edge = edges.find((item) => item.id === edgeId);
    if (!edge) return;
    setPayloadDialog({
      title: `连接数据：${edgeId}`,
      body: stringifyPayload(edgeToPayload(edge)),
    });
  }

  function toggleNodeCollapse(nodeId: string) {
    setCollapsedNodeIds((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }

  function selectAll() {
    setGraph((current) => ({
      nodes: current.nodes.map((node) => ({ ...node, selected: true })),
      edges: current.edges.map((edge) => ({ ...edge, selected: true })),
    }));
    setNotice("已全选画布对象");
  }

  function clearCanvas() {
    if (visibleGraph.nodes.length > 0 || visibleGraph.edges.length > 0) {
      const confirmed = window.confirm("确认清空当前节点流画布？");
      if (!confirmed) return;
    }
    setDraftGraph({ nodes: [], edges: [] });
    setToolInputs({});
    setSelectedNodeId("");
    setCollapsedNodeIds(new Set());
    setNotice("已清空画布");
  }

  function fitCanvas() {
    void reactFlowRef.current?.fitView({ padding: 0.18, duration: 180 });
  }

  function openPaneMenu(event: React.MouseEvent | MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    const flowPosition = reactFlowRef.current?.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    }) ?? { x: 80, y: 80 };
    setWorkflowMenu({
      type: "pane",
      x: event.clientX,
      y: event.clientY,
      flowPosition,
    });
  }

  function openNodeMenu(event: React.MouseEvent, node: Node) {
    event.preventDefault();
    event.stopPropagation();
    setSelectedNodeId(node.id);
    setWorkflowMenu({
      type: "node",
      x: event.clientX,
      y: event.clientY,
      nodeId: node.id,
    });
  }

  function openEdgeMenu(event: React.MouseEvent, edge: Edge) {
    event.preventDefault();
    event.stopPropagation();
    setWorkflowMenu({
      type: "edge",
      x: event.clientX,
      y: event.clientY,
      edgeId: edge.id,
    });
  }

  useEffect(() => {
    const saveCurrent = () => {
      void handleSave();
    };
    const runCurrent = () => {
      void handleRun(executableNodeIds);
    };
    const runCommand = (event: Event) => {
      const detail = (event as CustomEvent<WorkflowCommandDetail>).detail;
      if (!detail) return;
      if (detail.action === "fitView") {
        fitCanvas();
        return;
      }
      if (detail.action === "selectAll") {
        selectAll();
        return;
      }
      if (detail.action === "clear") {
        clearCanvas();
        return;
      }
      const nodeId = "nodeId" in detail ? detail.nodeId ?? selectedNodeId : "";
      const edgeId = "edgeId" in detail ? detail.edgeId : "";
      if (detail.action === "copyNode" && nodeId) copyNode(nodeId);
      if (detail.action === "deleteNode" && nodeId) deleteNode(nodeId);
      if (detail.action === "runNode" && nodeId) void handleRun([nodeId]);
      if (detail.action === "toggleNodeCollapse" && nodeId)
        toggleNodeCollapse(nodeId);
      if (detail.action === "copyNodeId" && nodeId)
        copyTextToClipboard(nodeId, "节点 ID 已复制");
      if (detail.action === "showNodePayload" && nodeId)
        showNodePayload(nodeId);
      if (detail.action === "deleteEdge" && edgeId) deleteEdge(edgeId);
      if (detail.action === "copyEdgeId" && edgeId)
        copyTextToClipboard(edgeId, "连线 ID 已复制");
      if (detail.action === "showEdgePayload" && edgeId)
        showEdgePayload(edgeId);
    };
    window.addEventListener("taptap:workflow-save", saveCurrent);
    window.addEventListener("taptap:workflow-run", runCurrent);
    window.addEventListener("taptap:workflow-command", runCommand);
    return () => {
      window.removeEventListener("taptap:workflow-save", saveCurrent);
      window.removeEventListener("taptap:workflow-run", runCurrent);
      window.removeEventListener("taptap:workflow-command", runCommand);
    };
  }, [
    clearCanvas,
    copyNode,
    deleteEdge,
    deleteNode,
    executableNodeIds,
    fitCanvas,
    handleRun,
    handleSave,
    selectedNodeId,
    selectAll,
    showEdgePayload,
    showNodePayload,
    toggleNodeCollapse,
  ]);

  function updateNodeInputs(nodeId: string, inputs: Record<string, unknown>) {
    setToolInputs((current) => ({ ...current, [nodeId]: inputs }));
  }

  return (
    <section className="flex h-full min-h-0 flex-col bg-surface-app p-4 md:p-6">
      <div className="mb-4 flex shrink-0 items-center justify-between gap-4">
        <div className="min-w-0">
          <span className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-text-subtle">
            <GitBranch className="h-3.5 w-3.5" />
            Workflow Canvas
          </span>
          <h1 className="m-0 truncate text-xl font-bold text-text">
            MCP 节点流
          </h1>
          <p className="mt-1 text-xs text-text-muted">
            节点来自真实 tools/list；执行参数来自节点表单，不自动填 Maker 字段。
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <StatusChip
            icon={<Boxes className="h-3.5 w-3.5" />}
            label={`${tools.length} tools`}
            tone="brand"
          />
          <StatusChip
            icon={<Activity className="h-3.5 w-3.5" />}
            label={`${tasks.length} tasks`}
            tone="neutral"
          />
          <StatusChip
            icon={<Save className="h-3.5 w-3.5" />}
            label={`${workflows.length} saved`}
            tone="neutral"
          />
          {latestRun ? (
            <StatusChip
              icon={<Play className="h-3.5 w-3.5" />}
              label={`last ${latestRun.status}`}
              tone={latestRun.status === "failed" ? "bad" : "neutral"}
            />
          ) : null}
          {failedCount > 0 ? (
            <StatusChip
              icon={<CircleAlert className="h-3.5 w-3.5" />}
              label={`${failedCount} errors`}
              tone="bad"
            />
          ) : null}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[240px_minmax(420px,1fr)_320px] gap-4 max-[1220px]:grid-cols-[220px_minmax(420px,1fr)] max-[960px]:grid-cols-1 max-[960px]:overflow-y-auto">
        <aside className="flex min-h-0 flex-col rounded-large border border-border bg-surface-panel shadow-sm">
          <div className="border-b border-border-soft px-4 py-3">
            <h2 className="m-0 text-xs font-bold uppercase tracking-wider text-text-subtle">
              节点库
            </h2>
          </div>
          <div className="border-b border-border-soft p-2">
            <div className="mb-2 grid grid-cols-[1fr_36px] gap-2">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!project || busy || tools.length === 0}
                className="gap-1.5"
              >
                <Save className="h-3.5 w-3.5" />
                保存图
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleDelete}
                disabled={!project || busy || !selectedWorkflowId}
                title="删除保存的节点流"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <select
              value={selectedWorkflowId}
              onChange={(event) => setSelectedWorkflowId(event.target.value)}
              className="h-8 w-full rounded-control border border-border bg-surface-panel px-2 text-xs text-text outline-none focus:border-brand"
              disabled={!project || busy}
            >
              <option value="">当前 tools/list 图</option>
              {workflows.map((workflow) => (
                <option key={workflow.id} value={workflow.id}>
                  {workflow.name}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleRun(executableNodeIds)}
              disabled={!project || busy || executableNodeIds.length === 0}
              className="mt-2 w-full gap-1.5"
            >
              <Play className="h-3.5 w-3.5" />
              运行已配置节点
            </Button>
            <p className="mt-2 min-h-[16px] truncate text-[10px] text-text-subtle">
              {notice || `${executableNodeIds.length} 个节点已有可执行输入`}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {tools.map((tool) => (
              <button
                key={tool.name}
                type="button"
                onClick={() => onSelectTool(tool)}
                className="mb-1 flex w-full flex-col gap-1 rounded-card px-3 py-2 text-left text-text-muted hover:bg-surface-muted hover:text-text"
              >
                <strong className="truncate text-xs">{tool.name}</strong>
                <span className="text-[10px] uppercase tracking-wide text-text-subtle">
                  {tool.required.length
                    ? `required: ${tool.required.join(", ")}`
                    : tool.category}
                </span>
              </button>
            ))}
            {tools.length === 0 ? (
              <div className="p-4 text-xs text-text-muted">
                启动 MCP 后展示节点。
              </div>
            ) : null}
          </div>
        </aside>

        <div
          ref={wrapperRef}
          className="relative min-h-0 overflow-hidden rounded-large border border-border bg-surface-panel shadow-sm"
          onClick={() => setWorkflowMenu(undefined)}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onInit={(instance) => {
              reactFlowRef.current = instance;
            }}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            onPaneContextMenu={openPaneMenu}
            onNodeContextMenu={openNodeMenu}
            onNodeMouseEnter={(_, node) => {
              hoveredObjectRef.current = { type: "node", node };
            }}
            onNodeMouseLeave={() => {
              if (hoveredObjectRef.current?.type === "node")
                hoveredObjectRef.current = null;
            }}
            onEdgeContextMenu={openEdgeMenu}
            onEdgeMouseEnter={(_, edge) => {
              hoveredObjectRef.current = { type: "edge", edge };
            }}
            onEdgeMouseLeave={() => {
              if (hoveredObjectRef.current?.type === "edge")
                hoveredObjectRef.current = null;
            }}
            defaultViewport={{ x: 48, y: 130, zoom: 0.92 }}
            minZoom={0.45}
            maxZoom={1.35}
            nodesDraggable
            nodesConnectable={false}
            elementsSelectable
            className="workflow-flow"
          >
            <Background gap={18} size={1} color="rgba(6, 10, 38, 0.12)" />
            <MiniMap
              pannable
              zoomable
              nodeColor={(node) => String(node.data?.tone ?? "#00D9C5")}
            />
            <Controls />
          </ReactFlow>
          {workflowMenu ? (
            <>
              <div
                className="fixed inset-0 z-[69]"
                data-local-context-menu
                onPointerDown={() => setWorkflowMenu(undefined)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setWorkflowMenu(undefined);
                }}
                onWheel={() => setWorkflowMenu(undefined)}
              />
              <WorkflowContextMenu
                menu={workflowMenu}
                clipboardReady={!!clipboardNode}
                collapsed={
                  workflowMenu.type === "node"
                    ? collapsedNodeIds.has(workflowMenu.nodeId)
                    : false
                }
                onClose={() => setWorkflowMenu(undefined)}
                onAddNode={addNode}
                onPasteNode={pasteNode}
                onFitCanvas={fitCanvas}
                onSelectAll={selectAll}
                onClearCanvas={clearCanvas}
                onRunNode={(nodeId) => void handleRun([nodeId])}
                onCopyNode={copyNode}
                onDeleteNode={deleteNode}
                onCopyNodeId={(nodeId) =>
                  copyTextToClipboard(nodeId, "节点 ID 已复制")
                }
                onShowNodePayload={showNodePayload}
                onToggleNodeCollapse={toggleNodeCollapse}
                onDeleteEdge={deleteEdge}
                onCopyEdgeId={(edgeId) =>
                  copyTextToClipboard(edgeId, "连线 ID 已复制")
                }
                onShowEdgePayload={showEdgePayload}
              />
            </>
          ) : null}
          {payloadDialog ? (
            <PayloadDialogView
              dialog={payloadDialog}
              onClose={() => setPayloadDialog(undefined)}
            />
          ) : null}
        </div>

        <aside className="flex min-h-0 flex-col gap-4 overflow-hidden max-[1220px]:hidden">
          {selectedNodeId ? (
            <AppContextMenu
              context={{ objectType: "workflowNode", nodeId: selectedNodeId }}
            >
              <NodeConfigPanel
                project={project}
                nodeId={selectedNodeId}
                selected={selectedToolNode}
                inputs={
                  selectedNodeId ? (toolInputs[selectedNodeId] ?? {}) : {}
                }
                busy={busy}
                onChange={(inputs) =>
                  selectedNodeId && updateNodeInputs(selectedNodeId, inputs)
                }
                onRun={() => selectedNodeId && void handleRun([selectedNodeId])}
              />
            </AppContextMenu>
          ) : (
            <NodeConfigPanel
              project={project}
              nodeId={selectedNodeId}
              selected={selectedToolNode}
              inputs={selectedNodeId ? (toolInputs[selectedNodeId] ?? {}) : {}}
              busy={busy}
              onChange={(inputs) =>
                selectedNodeId && updateNodeInputs(selectedNodeId, inputs)
              }
              onRun={() => selectedNodeId && void handleRun([selectedNodeId])}
            />
          )}
          <RunHistoryPanel
            runs={runs}
            busy={busy}
            onDeleteRun={handleDeleteRun}
          />
        </aside>
      </div>
    </section>
  );
}

function WorkflowContextMenu({
  menu,
  clipboardReady,
  collapsed,
  onClose,
  onAddNode,
  onPasteNode,
  onFitCanvas,
  onSelectAll,
  onClearCanvas,
  onRunNode,
  onCopyNode,
  onDeleteNode,
  onCopyNodeId,
  onShowNodePayload,
  onToggleNodeCollapse,
  onDeleteEdge,
  onCopyEdgeId,
  onShowEdgePayload,
}: {
  menu: WorkflowMenu;
  clipboardReady: boolean;
  collapsed: boolean;
  onClose: () => void;
  onAddNode: (
    kind: "tool" | "input" | "static",
    position?: { x: number; y: number },
  ) => void;
  onPasteNode: (position?: { x: number; y: number }) => void;
  onFitCanvas: () => void;
  onSelectAll: () => void;
  onClearCanvas: () => void;
  onRunNode: (nodeId: string) => void;
  onCopyNode: (nodeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onCopyNodeId: (nodeId: string) => void;
  onShowNodePayload: (nodeId: string) => void;
  onToggleNodeCollapse: (nodeId: string) => void;
  onDeleteEdge: (edgeId: string) => void;
  onCopyEdgeId: (edgeId: string) => void;
  onShowEdgePayload: (edgeId: string) => void;
}) {
  function run(action: () => void) {
    action();
    onClose();
  }

  const panePosition = menu.type === "pane" ? menu.flowPosition : undefined;
  return (
    <div
      className="fixed z-[70] min-w-[240px] rounded-md border border-border/70 bg-surface-panel/98 p-1 shadow-[0_12px_34px_-14px_rgba(0,0,0,0.65)] ring-1 ring-white/5 backdrop-blur-xl"
      data-workflow-menu-surface
      style={{ left: menu.x, top: menu.y }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <div className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest text-text-muted/60">
        {menu.type === "pane"
          ? "画布操作"
          : menu.type === "node"
            ? "节点操作"
            : "连线操作"}
      </div>
      <div className="mb-1.5 mx-2 h-px bg-border/50" />
      {menu.type === "pane" ? (
        <>
          <WorkflowMenuButton
            icon={<Plus className="h-4 w-4" />}
            label="新增工具节点"
            onClick={() => run(() => onAddNode("tool", panePosition))}
          />
          <WorkflowMenuButton
            icon={<Braces className="h-4 w-4" />}
            label="新增输入节点"
            onClick={() => run(() => onAddNode("input", panePosition))}
          />
          <WorkflowMenuButton
            icon={<Database className="h-4 w-4" />}
            label="新增静态节点"
            onClick={() => run(() => onAddNode("static", panePosition))}
          />
          <WorkflowMenuSeparator />
          <WorkflowMenuButton
            icon={<Copy className="h-4 w-4" />}
            label="粘贴节点"
            disabled={!clipboardReady}
            onClick={() => run(() => onPasteNode(panePosition))}
          />
          <WorkflowMenuButton
            icon={<Maximize2 className="h-4 w-4" />}
            label="适应画布"
            onClick={() => run(onFitCanvas)}
          />
          <WorkflowMenuButton
            icon={<MousePointer2 className="h-4 w-4" />}
            label="全选"
            onClick={() => run(onSelectAll)}
          />
          <WorkflowMenuButton
            icon={<Trash2 className="h-4 w-4" />}
            label="清空画布"
            danger
            onClick={() => run(onClearCanvas)}
          />
        </>
      ) : menu.type === "node" ? (
        <>
          <WorkflowMenuButton
            icon={<Play className="h-4 w-4" />}
            label="运行节点"
            onClick={() => run(() => onRunNode(menu.nodeId))}
          />
          <WorkflowMenuButton
            icon={<Copy className="h-4 w-4" />}
            label="复制节点"
            onClick={() => run(() => onCopyNode(menu.nodeId))}
          />
          <WorkflowMenuButton
            icon={<Trash2 className="h-4 w-4" />}
            label="删除节点"
            danger
            onClick={() => run(() => onDeleteNode(menu.nodeId))}
          />
          <WorkflowMenuSeparator />
          <WorkflowMenuButton
            icon={<Copy className="h-4 w-4" />}
            label="复制节点 ID"
            onClick={() => run(() => onCopyNodeId(menu.nodeId))}
          />
          <WorkflowMenuButton
            icon={<Eye className="h-4 w-4" />}
            label="查看 payload"
            onClick={() => run(() => onShowNodePayload(menu.nodeId))}
          />
          <WorkflowMenuButton
            icon={<Boxes className="h-4 w-4" />}
            label={collapsed ? "展开节点" : "收起节点"}
            onClick={() => run(() => onToggleNodeCollapse(menu.nodeId))}
          />
        </>
      ) : (
        <>
          <WorkflowMenuButton
            icon={<Trash2 className="h-4 w-4" />}
            label="删除连线"
            danger
            onClick={() => run(() => onDeleteEdge(menu.edgeId))}
          />
          <WorkflowMenuButton
            icon={<Copy className="h-4 w-4" />}
            label="复制连线 ID"
            onClick={() => run(() => onCopyEdgeId(menu.edgeId))}
          />
          <WorkflowMenuButton
            icon={<Eye className="h-4 w-4" />}
            label="查看连接数据"
            onClick={() => run(() => onShowEdgePayload(menu.edgeId))}
          />
        </>
      )}
    </div>
  );
}

function WorkflowMenuButton({
  icon,
  label,
  disabled,
  danger,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "flex w-full cursor-pointer select-none items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium outline-none transition-all disabled:cursor-not-allowed disabled:opacity-45",
        danger
          ? "text-red-500 hover:bg-red-500/10 hover:text-red-400"
          : "text-text hover:bg-brand/15 hover:text-brand-strong",
      )}
      onClick={onClick}
    >
      <span className="shrink-0 text-text-muted">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  );
}

function WorkflowMenuSeparator() {
  return <div className="my-1.5 mx-2 h-px bg-border/50" />;
}

function PayloadDialogView({
  dialog,
  onClose,
}: {
  dialog: PayloadDialog;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/25 p-4"
      data-workflow-menu-surface
      onClick={onClose}
    >
      <section
        className="flex max-h-[72vh] w-full max-w-[640px] flex-col rounded-xl border border-white/10 bg-surface-panel shadow-[0_24px_90px_-20px_rgba(0,0,0,0.55)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border-soft px-4 py-3">
          <h2 className="m-0 truncate text-sm font-bold text-text">
            {dialog.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-control px-2 py-1 text-xs font-semibold text-text-subtle hover:bg-surface-muted hover:text-text"
          >
            关闭
          </button>
        </div>
        <pre className="m-0 overflow-auto p-4 text-xs leading-relaxed text-text-muted">
          {dialog.body}
        </pre>
      </section>
    </div>
  );
}

function NodeConfigPanel({
  project,
  nodeId,
  selected,
  inputs,
  busy,
  onChange,
  onRun,
}: {
  project?: ProjectSummary;
  nodeId: string;
  selected?: ToolSummary;
  inputs: Record<string, unknown>;
  busy: boolean;
  onChange: (inputs: Record<string, unknown>) => void;
  onRun: () => void;
}) {
  const schema = selected?.inputSchema as RJSFSchema | undefined;
  const missing = selected
    ? selected.required.filter(
        (field) => !Object.prototype.hasOwnProperty.call(inputs, field),
      )
    : [];
  return (
    <section className="flex min-h-0 flex-[1.15] flex-col rounded-large border border-border bg-surface-panel shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-border-soft px-4 py-3">
        <div className="min-w-0">
          <h2 className="m-0 truncate text-xs font-bold uppercase tracking-wider text-text-subtle">
            节点输入
          </h2>
          <p className="mt-1 truncate text-[11px] text-text-muted">
            {selected?.name ?? "选择一个工具节点"}
          </p>
        </div>
        <Button
          size="sm"
          onClick={onRun}
          disabled={
            !project || busy || !selected || !nodeId || missing.length > 0
          }
          className="h-8 gap-1.5 px-2.5"
        >
          <Play className="h-3.5 w-3.5" />
          运行
        </Button>
      </div>
      {selected && schema ? (
        <div className="schema-form-host flex-1 overflow-y-auto p-3">
          {missing.length ? (
            <p className="mb-3 rounded-control bg-[#b03939]/10 px-2 py-1.5 text-[10px] font-semibold text-[#b03939]">
              缺少必填：{missing.join(", ")}
            </p>
          ) : null}
          <Form
            schema={schema}
            uiSchema={workflowFormUiSchema}
            validator={validator}
            formData={inputs}
            disabled={busy || !project}
            showErrorList={false}
            onChange={(event) =>
              onChange((event.formData ?? {}) as Record<string, unknown>)
            }
          />
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center p-5 text-center text-xs text-text-muted">
          点击画布里的工具节点后编辑真实 schema 输入。
        </div>
      )}
    </section>
  );
}

function RunHistoryPanel({
  runs,
  busy,
  onDeleteRun,
}: {
  runs: WorkflowRunRecord[];
  busy: boolean;
  onDeleteRun: (runId: string) => void;
}) {
  const [expandedRunId, setExpandedRunId] = useState("");
  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-large border border-border bg-surface-panel shadow-sm">
      <div className="border-b border-border-soft px-4 py-3">
        <h2 className="m-0 text-xs font-bold uppercase tracking-wider text-text-subtle">
          执行记录
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {runs.length === 0 ? (
          <div className="p-4 text-xs text-text-muted">暂无 workflow run。</div>
        ) : (
          runs.slice(0, 12).map((run) => {
            const expanded = expandedRunId === run.id;
            return (
              <article
                key={run.id}
                className="mb-2 rounded-card border border-border-soft bg-surface-raised p-3"
              >
                <button
                  type="button"
                  onClick={() => setExpandedRunId(expanded ? "" : run.id)}
                  className="w-full text-left"
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <strong className="truncate text-xs text-text">
                      {run.name}
                    </strong>
                    <span
                      className={cn(
                        "rounded-pill px-2 py-0.5 text-[9px] font-bold",
                        run.status === "failed"
                          ? "bg-[#b03939]/10 text-[#b03939]"
                          : run.status === "partial"
                            ? "bg-[#d99732]/10 text-[#8a5a00]"
                            : "bg-brand/10 text-brand-strong",
                      )}
                    >
                      {run.status}
                    </span>
                  </div>
                  <span className="block truncate text-[10px] text-text-subtle">
                    {run.createdAt}
                  </span>
                </button>
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onDeleteRun(run.id)}
                    className="inline-flex items-center gap-1 rounded-control px-2 py-1 text-[10px] font-semibold text-text-subtle hover:bg-surface-muted hover:text-text disabled:opacity-50"
                  >
                    <Trash2 className="h-3 w-3" />
                    删除记录
                  </button>
                </div>
                {expanded ? (
                  <div className="mt-2 grid gap-1.5">
                    {run.nodeResults.map((node) => (
                      <div
                        key={`${run.id}-${node.nodeId}`}
                        className="rounded-control bg-surface-muted px-2 py-1.5 text-[10px]"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <strong className="truncate text-text-muted">
                            {node.toolName ?? node.nodeId}
                          </strong>
                          <span className="shrink-0 font-bold text-text-subtle">
                            {node.status}
                          </span>
                        </div>
                        {node.missingRequired?.length ? (
                          <p className="m-0 mt-1 text-[#b03939]">
                            missing: {node.missingRequired.join(", ")}
                          </p>
                        ) : null}
                        {node.errorMessage ? (
                          <p className="m-0 mt-1 line-clamp-2 text-[#b03939]">
                            {node.errorMessage}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

function flowToGraph(
  nodes: Node[],
  edges: Edge[],
  toolInputs: ToolInputs,
): MakerWorkflowGraph {
  return {
    version: 1,
    source: "tools-list",
    nodes: nodes.map((node) => ({
      id: node.id,
      type: node.type ?? "default",
      position: node.position,
      data: serializableNodeData(node, toolInputs),
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      animated: edge.animated ?? false,
    })),
  };
}

function serializableNodeData(node: Node, toolInputs: ToolInputs) {
  const data = node.data;
  if (data?.kind === "tool") {
    return {
      kind: "tool",
      toolName: data.toolName,
      category: data.category,
      required: data.required,
      status: data.status,
      tone: data.tone,
      inputs: toolInputs[node.id] ?? data.inputs ?? {},
    };
  }
  return {
    kind: "static",
    title: data?.title,
    subtitle: data?.subtitle,
    tone: data?.tone,
  };
}

function graphToFlow(
  graph: MakerWorkflowGraph,
  tools: ToolSummary[],
  tasks: TaskRecord[],
  latestRun?: WorkflowRunRecord,
): { nodes: Node[]; edges: Edge[] } {
  const nodes = graph.nodes
    .map((raw) => restoreNode(raw, tools, tasks, latestRun))
    .filter((node): node is Node => !!node);
  const edges = graph.edges
    .map((raw) => restoreEdge(raw))
    .filter((edge): edge is Edge => !!edge);
  return { nodes, edges };
}

function restoreNode(
  raw: unknown,
  tools: ToolSummary[],
  tasks: TaskRecord[],
  latestRun?: WorkflowRunRecord,
): Node | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const node = raw as {
    id?: unknown;
    type?: unknown;
    position?: unknown;
    data?: unknown;
  };
  if (
    typeof node.id !== "string" ||
    !node.position ||
    typeof node.position !== "object"
  )
    return undefined;
  const data =
    node.data && typeof node.data === "object"
      ? (node.data as Record<string, unknown>)
      : {};
  if (data.kind === "tool" && typeof data.toolName === "string") {
    const tool = tools.find((item) => item.name === data.toolName) ?? {
      name: data.toolName,
      category: typeof data.category === "string" ? data.category : "other",
      required: requiredArray(data.required),
      inputSchema: {},
    };
    const recentTask = tasks.find((task) => task.toolName === tool.name);
    const runNode = latestRun?.nodeResults.find(
      (item) => item.nodeId === node.id,
    );
    return {
      id: node.id,
      type: typeof node.type === "string" ? node.type : "default",
      position: node.position as Node["position"],
      data: {
        ...data,
        inputs: isRecord(data.inputs) ? data.inputs : {},
        label: (
          <ToolNodeLabel
            tool={tool}
            status={
              runNode?.status ??
              recentTask?.status ??
              (data.status as TaskRecord["status"] | undefined)
            }
            configured={isConfiguredInput(data.inputs, tool)}
          />
        ),
        tone: data.tone ?? toneForCategory(tool.category),
      },
    };
  }
  const title = typeof data.title === "string" ? data.title : node.id;
  const subtitle =
    typeof data.subtitle === "string" ? data.subtitle : "saved node";
  return {
    id: node.id,
    type: typeof node.type === "string" ? node.type : "default",
    position: node.position as Node["position"],
    data: {
      ...data,
      label: (
        <StaticNodeLabel
          icon={<Database className="h-4 w-4" />}
          title={title}
          subtitle={subtitle}
        />
      ),
      tone: data.tone ?? "#7b8794",
    },
  };
}

function restoreEdge(raw: unknown): Edge | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const edge = raw as {
    id?: unknown;
    source?: unknown;
    target?: unknown;
    animated?: unknown;
  };
  if (
    typeof edge.id !== "string" ||
    typeof edge.source !== "string" ||
    typeof edge.target !== "string"
  )
    return undefined;
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    animated: edge.animated === true,
    style: { stroke: "rgba(0, 217, 197, 0.55)" },
  };
}

function buildGraph(
  tools: ToolSummary[],
  tasks: TaskRecord[],
  toolInputs: ToolInputs,
  latestRun?: WorkflowRunRecord,
): { nodes: Node[]; edges: Edge[] } {
  const orderedTools = categoryOrder.flatMap((category) =>
    tools.filter((tool) => tool.category === category),
  );
  const grouped = orderedTools.map((tool, index) => {
    const id = `tool-${tool.name}`;
    return createToolNode(
      tool,
      id,
      { x: 260 + (index % 3) * 205, y: 40 + Math.floor(index / 3) * 108 },
      toolInputs[id],
      tasks,
      latestRun,
    );
  });

  const sourceNodes: Node[] = [
    createStaticNode(
      "input-assets",
      { x: 20, y: 80 },
      "Asset Hub",
      "项目内图片 / 视频 / 音频 / 模型",
      <Database className="h-4 w-4" />,
      "#00D9C5",
    ),
    createStaticNode(
      "input-schema",
      { x: 20, y: 210 },
      "Tool Schema",
      "真实 inputSchema 表单",
      <Braces className="h-4 w-4" />,
      "#4D4DAD",
    ),
  ];

  const edges: Edge[] = grouped.map((node, index) => ({
    id: `edge-${node.id}`,
    source: index % 2 === 0 ? "input-assets" : "input-schema",
    target: node.id,
    animated: true,
    style: { stroke: "rgba(0, 217, 197, 0.55)" },
  }));
  return { nodes: [...sourceNodes, ...grouped], edges };
}

function createToolNode(
  tool: ToolSummary,
  id: string,
  position: Node["position"],
  inputs: Record<string, unknown> | undefined,
  tasks: TaskRecord[],
  latestRun?: WorkflowRunRecord,
): Node {
  const recentTask = tasks.find((task) => task.toolName === tool.name);
  const runNode = latestRun?.nodeResults.find((item) => item.nodeId === id);
  const nodeInputs = inputs ?? {};
  return {
    id,
    type: "default",
    position,
    data: {
      kind: "tool",
      toolName: tool.name,
      category: tool.category,
      required: tool.required,
      status: recentTask?.status,
      inputs: nodeInputs,
      label: (
        <ToolNodeLabel
          tool={tool}
          status={runNode?.status ?? recentTask?.status}
          configured={isConfiguredInput(nodeInputs, tool)}
        />
      ),
      tone: toneForCategory(tool.category),
    },
  };
}

function createStaticNode(
  id: string,
  position: Node["position"],
  title: string,
  subtitle: string,
  icon: React.ReactNode,
  tone: string,
): Node {
  return {
    id,
    type: "default",
    position,
    data: {
      kind: "static",
      title,
      subtitle,
      label: <StaticNodeLabel icon={icon} title={title} subtitle={subtitle} />,
      tone,
    },
  };
}

function cloneNodeForCanvas(
  node: Node,
  id: string,
  position: Node["position"],
  tools: ToolSummary[],
  tasks: TaskRecord[],
  latestRun?: WorkflowRunRecord,
  inputs?: Record<string, unknown>,
) {
  const toolName = node.data?.toolName;
  if (typeof toolName === "string") {
    const tool = tools.find((item) => item.name === toolName) ?? {
      name: toolName,
      category:
        typeof node.data.category === "string" ? node.data.category : "other",
      required: requiredArray(node.data.required),
      inputSchema: {},
    };
    return createToolNode(tool, id, position, inputs, tasks, latestRun);
  }
  const title =
    typeof node.data?.title === "string"
      ? `${node.data.title} Copy`
      : "Static Copy";
  const subtitle =
    typeof node.data?.subtitle === "string"
      ? node.data.subtitle
      : "静态说明节点";
  return createStaticNode(
    id,
    position,
    title,
    subtitle,
    <Database className="h-4 w-4" />,
    typeof node.data?.tone === "string" ? node.data.tone : "#7b8794",
  );
}

function applyDisplayState(
  node: Node,
  collapsed: boolean,
  tools: ToolSummary[],
  tasks: TaskRecord[],
  latestRun: WorkflowRunRecord | undefined,
  toolInputs: ToolInputs,
): Node {
  const title = nodeTitle(node, tools);
  if (collapsed)
    return {
      ...node,
      data: { ...node.data, label: <CollapsedNodeLabel title={title} /> },
    };

  const toolName = node.data?.toolName;
  if (typeof toolName === "string") {
    const tool = tools.find((item) => item.name === toolName) ?? {
      name: toolName,
      category:
        typeof node.data.category === "string" ? node.data.category : "other",
      required: requiredArray(node.data.required),
      inputSchema: {},
    };
    const recentTask = tasks.find((task) => task.toolName === tool.name);
    const runNode = latestRun?.nodeResults.find(
      (item) => item.nodeId === node.id,
    );
    const inputs = toolInputs[node.id] ?? asRecord(node.data.inputs) ?? {};
    return {
      ...node,
      data: {
        ...node.data,
        inputs,
        label: (
          <ToolNodeLabel
            tool={tool}
            status={
              runNode?.status ??
              recentTask?.status ??
              (node.data.status as TaskRecord["status"] | undefined)
            }
            configured={isConfiguredInput(inputs, tool)}
          />
        ),
        tone: node.data.tone ?? toneForCategory(tool.category),
      },
    };
  }

  if (node.data?.kind === "static") {
    const subtitle =
      typeof node.data.subtitle === "string"
        ? node.data.subtitle
        : "saved node";
    return {
      ...node,
      data: {
        ...node.data,
        label: (
          <StaticNodeLabel
            icon={<Database className="h-4 w-4" />}
            title={title}
            subtitle={subtitle}
          />
        ),
      },
    };
  }

  return node;
}

function ToolNodeLabel({
  tool,
  status,
  configured,
}: {
  tool: ToolSummary;
  status?: TaskRecord["status"] | "skipped";
  configured: boolean;
}) {
  return (
    <div className="min-w-[170px]">
      <div className="mb-1 flex items-center justify-between gap-2">
        <strong className="truncate text-[12px] text-text">{tool.name}</strong>
        <span
          className={cn(
            "rounded-pill px-1.5 py-0.5 text-[8px] font-bold uppercase",
            status === "failed"
              ? "bg-[#b03939]/10 text-[#b03939]"
              : status === "running"
                ? "bg-brand/10 text-brand-strong"
                : status === "succeeded"
                  ? "bg-[#246b2f]/10 text-[#246b2f]"
                  : status === "skipped"
                    ? "bg-[#d99732]/10 text-[#8a5a00]"
                    : configured
                      ? "bg-brand/10 text-brand-strong"
                      : "bg-surface-muted text-text-subtle",
          )}
        >
          {status ?? (configured ? "ready" : tool.category)}
        </span>
      </div>
      <div className="truncate text-[10px] text-text-subtle">
        {tool.required.length ? tool.required.join(", ") : "no required fields"}
      </div>
    </div>
  );
}

function StaticNodeLabel({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex min-w-[160px] items-center gap-2">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-brand/10 text-brand-strong">
        {icon}
      </div>
      <div className="min-w-0">
        <strong className="block truncate text-xs text-text">{title}</strong>
        <span className="block truncate text-[10px] text-text-subtle">
          {subtitle}
        </span>
      </div>
    </div>
  );
}

function CollapsedNodeLabel({ title }: { title: string }) {
  return (
    <div className="flex min-w-[132px] items-center gap-2">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-control bg-surface-muted text-text-subtle">
        <Boxes className="h-3.5 w-3.5" />
      </div>
      <strong className="truncate text-xs text-text">{title}</strong>
    </div>
  );
}

function StatusChip({
  icon,
  label,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  tone: "brand" | "neutral" | "bad";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-xs font-semibold",
        tone === "brand"
          ? "border-brand/30 bg-brand/10 text-brand-strong"
          : tone === "bad"
            ? "border-[#b03939]/20 bg-[#b03939]/10 text-[#b03939]"
            : "border-border bg-surface-panel text-text-muted",
      )}
    >
      {icon}
      {label}
    </span>
  );
}

function inputsFromGraph(graph: MakerWorkflowGraph): ToolInputs {
  const inputs: ToolInputs = {};
  for (const raw of graph.nodes) {
    if (!raw || typeof raw !== "object") continue;
    const node = raw as { id?: unknown; data?: unknown };
    const data =
      node.data && typeof node.data === "object"
        ? (node.data as { kind?: unknown; inputs?: unknown })
        : undefined;
    if (
      typeof node.id === "string" &&
      data?.kind === "tool" &&
      isRecord(data.inputs)
    )
      inputs[node.id] = data.inputs;
  }
  return inputs;
}

function findToolForNode(nodes: Node[], tools: ToolSummary[], nodeId: string) {
  const node = nodes.find((item) => item.id === nodeId);
  const toolName = node?.data?.toolName;
  return typeof toolName === "string"
    ? tools.find((tool) => tool.name === toolName)
    : undefined;
}

function isToolNode(node: Node) {
  return node.data?.kind === "tool" && typeof node.data.toolName === "string";
}

function hasConfiguredInput(node: Node, tools: ToolSummary[]) {
  const toolName = node.data?.toolName;
  const tool =
    typeof toolName === "string"
      ? tools.find((item) => item.name === toolName)
      : undefined;
  return !!tool && isConfiguredInput(node.data?.inputs, tool);
}

function isConfiguredInput(input: unknown, tool: ToolSummary) {
  const record = isRecord(input) ? input : {};
  if (tool.required.length === 0) return true;
  return tool.required.every((field) =>
    Object.prototype.hasOwnProperty.call(record, field),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function asRecord(value: unknown) {
  return isRecord(value) ? value : undefined;
}

function requiredArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function removeRecordKey<T>(record: Record<string, T>, key: string) {
  const next = { ...record };
  delete next[key];
  return next;
}

function withoutSetValue(values: Set<string>, value: string) {
  const next = new Set(values);
  next.delete(value);
  return next;
}

function nodeTitle(node: Node, tools: ToolSummary[]) {
  const toolName = node.data?.toolName;
  if (typeof toolName === "string")
    return tools.find((tool) => tool.name === toolName)?.name ?? toolName;
  return typeof node.data?.title === "string" ? node.data.title : node.id;
}

function edgeToPayload(edge: Edge) {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    animated: edge.animated ?? false,
    data: edge.data ?? null,
  };
}

function stringifyPayload(value: unknown) {
  return JSON.stringify(
    value,
    (_key, item) => {
      if (typeof item === "function") return undefined;
      if (isReactElementLike(item)) return "[ReactNode]";
      return item;
    },
    2,
  );
}

function isReactElementLike(value: unknown) {
  return isRecord(value) && "$$typeof" in value;
}

function toneForCategory(category: string) {
  if (category === "image") return "#00D9C5";
  if (category === "video") return "#2f80ed";
  if (category === "music") return "#d99732";
  if (category === "model3d") return "#8b5cf6";
  if (category === "build") return "#0a7f72";
  if (category === "status") return "#4D4DAD";
  return "#7b8794";
}
