import { useCallback, useEffect, useMemo, useState } from "react";
import { ReactFlow, Background, Controls, MiniMap, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import Form from "@rjsf/core";
import validator from "@rjsf/validator-ajv8";
import type { RJSFSchema, UiSchema } from "@rjsf/utils";
import { Activity, Boxes, Braces, CircleAlert, Database, GitBranch, Play, Save, Trash2, WandSparkles } from "lucide-react";
import { deleteWorkflow, deleteWorkflowRun, listWorkflowRuns, listWorkflows, runWorkflow, saveWorkflow, type MakerWorkflowGraph, type ProjectSummary, type TaskRecord, type ToolSummary, type WorkflowGraphRecord, type WorkflowRunRecord } from "../../api";
import { Button } from "../../components/ui/Button";
import { AppContextMenu } from "../../commands";
import { cn } from "../../lib/utils";

type Props = {
  project?: ProjectSummary;
  tools: ToolSummary[];
  tasks: TaskRecord[];
  onSelectTool: (tool: ToolSummary) => void;
};

type ToolInputs = Record<string, Record<string, unknown>>;

const categoryOrder = ["status", "image", "video", "music", "model3d", "build", "other"];

const workflowFormUiSchema: UiSchema = {
  "ui:submitButtonOptions": { norender: true },
  "ui:globalOptions": { label: true }
};

export function WorkflowCanvas({ project, tools, tasks, onSelectTool }: Props) {
  const [workflows, setWorkflows] = useState<WorkflowGraphRecord[]>([]);
  const [runs, setRuns] = useState<WorkflowRunRecord[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [toolInputs, setToolInputs] = useState<ToolInputs>({});
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const generatedGraph = useMemo(() => buildGraph(tools, tasks, toolInputs, runs[0]), [tools, tasks, toolInputs, runs]);
  const selectedWorkflow = workflows.find((workflow) => workflow.id === selectedWorkflowId);
  const visibleGraph = selectedWorkflow ? graphToFlow(selectedWorkflow.graph, tools, tasks, runs[0]) : generatedGraph;
  const { nodes, edges } = visibleGraph;
  const selectedToolNode = useMemo(() => findToolForNode(nodes, tools, selectedNodeId), [nodes, tools, selectedNodeId]);
  const executableNodeIds = useMemo(() => nodes.filter((node) => isToolNode(node) && hasConfiguredInput(node, tools)).map((node) => node.id), [nodes, tools]);
  const failedCount = tasks.filter((task) => task.status === "failed").length;
  const latestRun = runs[0];

  useEffect(() => {
    if (!project) {
      setWorkflows([]);
      setRuns([]);
      setSelectedWorkflowId("");
      setSelectedNodeId("");
      setToolInputs({});
      return;
    }
    void refreshWorkflowData(project.id);
  }, [project?.id]);

  useEffect(() => {
    if (!selectedWorkflow) return;
    setToolInputs(inputsFromGraph(selectedWorkflow.graph));
  }, [selectedWorkflow?.id]);

  async function refreshWorkflowData(projectId: string) {
    const [nextWorkflows, nextRuns] = await Promise.all([
      listWorkflows(projectId).catch(() => []),
      listWorkflowRuns(projectId).catch(() => [])
    ]);
    setWorkflows(nextWorkflows);
    setRuns(nextRuns);
    setSelectedWorkflowId((current) => current && nextWorkflows.some((workflow) => workflow.id === current) ? current : "");
  }

  const handleNodesChange = useCallback((_changes: unknown) => undefined, []);

  function activeGraph(): MakerWorkflowGraph {
    return flowToGraph(nodes, edges, toolInputs);
  }

  async function handleSave() {
    if (!project) return;
    setBusy(true);
    setNotice("保存节点流...");
    try {
      const name = selectedWorkflow?.name ?? `${project.name} MCP Workflow`;
      const response = await saveWorkflow(project.id, name, activeGraph(), selectedWorkflow?.id);
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
      const response = await runWorkflow(project.id, activeGraph(), nodeIds, selectedWorkflow?.name ?? `${project.name} workflow run`, selectedWorkflow?.id);
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

  useEffect(() => {
    const saveCurrent = () => {
      void handleSave();
    };
    const runCurrent = () => {
      void handleRun(executableNodeIds);
    };
    window.addEventListener("taptap:workflow-save", saveCurrent);
    window.addEventListener("taptap:workflow-run", runCurrent);
    return () => {
      window.removeEventListener("taptap:workflow-save", saveCurrent);
      window.removeEventListener("taptap:workflow-run", runCurrent);
    };
  }, [executableNodeIds, handleSave, handleRun]);

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
          <h1 className="m-0 truncate text-xl font-bold text-text">MCP 节点流</h1>
          <p className="mt-1 text-xs text-text-muted">节点来自真实 tools/list；执行参数来自节点表单，不自动填 Maker 字段。</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <StatusChip icon={<Boxes className="h-3.5 w-3.5" />} label={`${tools.length} tools`} tone="brand" />
          <StatusChip icon={<Activity className="h-3.5 w-3.5" />} label={`${tasks.length} tasks`} tone="neutral" />
          <StatusChip icon={<Save className="h-3.5 w-3.5" />} label={`${workflows.length} saved`} tone="neutral" />
          {latestRun ? <StatusChip icon={<Play className="h-3.5 w-3.5" />} label={`last ${latestRun.status}`} tone={latestRun.status === "failed" ? "bad" : "neutral"} /> : null}
          {failedCount > 0 ? <StatusChip icon={<CircleAlert className="h-3.5 w-3.5" />} label={`${failedCount} errors`} tone="bad" /> : null}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[240px_minmax(420px,1fr)_320px] gap-4 max-[1220px]:grid-cols-[220px_minmax(420px,1fr)] max-[960px]:grid-cols-1 max-[960px]:overflow-y-auto">
        <aside className="flex min-h-0 flex-col rounded-large border border-border bg-surface-panel shadow-sm">
          <div className="border-b border-border-soft px-4 py-3">
            <h2 className="m-0 text-xs font-bold uppercase tracking-wider text-text-subtle">节点库</h2>
          </div>
          <div className="border-b border-border-soft p-2">
            <div className="mb-2 grid grid-cols-[1fr_36px] gap-2">
              <Button size="sm" onClick={handleSave} disabled={!project || busy || tools.length === 0} className="gap-1.5">
                <Save className="h-3.5 w-3.5" />保存图
              </Button>
              <Button size="icon" variant="ghost" onClick={handleDelete} disabled={!project || busy || !selectedWorkflowId} title="删除保存的节点流">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <select value={selectedWorkflowId} onChange={(event) => setSelectedWorkflowId(event.target.value)} className="h-8 w-full rounded-control border border-border bg-surface-panel px-2 text-xs text-text outline-none focus:border-brand" disabled={!project || busy}>
              <option value="">当前 tools/list 图</option>
              {workflows.map((workflow) => <option key={workflow.id} value={workflow.id}>{workflow.name}</option>)}
            </select>
            <Button size="sm" variant="outline" onClick={() => void handleRun(executableNodeIds)} disabled={!project || busy || executableNodeIds.length === 0} className="mt-2 w-full gap-1.5">
              <Play className="h-3.5 w-3.5" />运行已配置节点
            </Button>
            <p className="mt-2 min-h-[16px] truncate text-[10px] text-text-subtle">{notice || `${executableNodeIds.length} 个节点已有可执行输入`}</p>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {tools.map((tool) => (
              <button key={tool.name} type="button" onClick={() => onSelectTool(tool)} className="mb-1 flex w-full flex-col gap-1 rounded-card px-3 py-2 text-left text-text-muted hover:bg-surface-muted hover:text-text">
                <strong className="truncate text-xs">{tool.name}</strong>
                <span className="text-[10px] uppercase tracking-wide text-text-subtle">{tool.required.length ? `required: ${tool.required.join(", ")}` : tool.category}</span>
              </button>
            ))}
            {tools.length === 0 ? <div className="p-4 text-xs text-text-muted">启动 MCP 后展示节点。</div> : null}
          </div>
        </aside>

        <AppContextMenu context={{ objectType: "workflowCanvas" }}>
          <div className="min-h-0 overflow-hidden rounded-large border border-border bg-surface-panel shadow-sm">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={handleNodesChange}
              onNodeClick={(_, node) => setSelectedNodeId(node.id)}
              defaultViewport={{ x: 48, y: 130, zoom: 0.92 }}
              minZoom={0.45}
              maxZoom={1.35}
              nodesDraggable
              nodesConnectable={false}
              elementsSelectable
              className="workflow-flow"
            >
              <Background gap={18} size={1} color="rgba(6, 10, 38, 0.12)" />
              <MiniMap pannable zoomable nodeColor={(node) => String(node.data?.tone ?? "#00D9C5")} />
              <Controls />
            </ReactFlow>
          </div>
        </AppContextMenu>

        <aside className="flex min-h-0 flex-col gap-4 overflow-hidden max-[1220px]:hidden">
          {selectedNodeId ? (
            <AppContextMenu context={{ objectType: "workflowNode", nodeId: selectedNodeId }}>
              <NodeConfigPanel
                project={project}
                nodeId={selectedNodeId}
                selected={selectedToolNode}
                inputs={selectedNodeId ? toolInputs[selectedNodeId] ?? {} : {}}
                busy={busy}
                onChange={(inputs) => selectedNodeId && updateNodeInputs(selectedNodeId, inputs)}
                onRun={() => selectedNodeId && void handleRun([selectedNodeId])}
              />
            </AppContextMenu>
          ) : (
            <NodeConfigPanel
              project={project}
              nodeId={selectedNodeId}
              selected={selectedToolNode}
              inputs={selectedNodeId ? toolInputs[selectedNodeId] ?? {} : {}}
              busy={busy}
              onChange={(inputs) => selectedNodeId && updateNodeInputs(selectedNodeId, inputs)}
              onRun={() => selectedNodeId && void handleRun([selectedNodeId])}
            />
          )}
          <RunHistoryPanel runs={runs} busy={busy} onDeleteRun={handleDeleteRun} />
        </aside>
      </div>
    </section>
  );
}

function NodeConfigPanel({ project, nodeId, selected, inputs, busy, onChange, onRun }: { project?: ProjectSummary; nodeId: string; selected?: ToolSummary; inputs: Record<string, unknown>; busy: boolean; onChange: (inputs: Record<string, unknown>) => void; onRun: () => void }) {
  const schema = selected?.inputSchema as RJSFSchema | undefined;
  const missing = selected ? selected.required.filter((field) => !Object.prototype.hasOwnProperty.call(inputs, field)) : [];
  return (
    <section className="flex min-h-0 flex-[1.15] flex-col rounded-large border border-border bg-surface-panel shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-border-soft px-4 py-3">
        <div className="min-w-0">
          <h2 className="m-0 truncate text-xs font-bold uppercase tracking-wider text-text-subtle">节点输入</h2>
          <p className="mt-1 truncate text-[11px] text-text-muted">{selected?.name ?? "选择一个工具节点"}</p>
        </div>
        <Button size="sm" onClick={onRun} disabled={!project || busy || !selected || !nodeId || missing.length > 0} className="h-8 gap-1.5 px-2.5">
          <Play className="h-3.5 w-3.5" />运行
        </Button>
      </div>
      {selected && schema ? (
        <div className="schema-form-host flex-1 overflow-y-auto p-3">
          {missing.length ? <p className="mb-3 rounded-control bg-[#b03939]/10 px-2 py-1.5 text-[10px] font-semibold text-[#b03939]">缺少必填：{missing.join(", ")}</p> : null}
          <Form
            schema={schema}
            uiSchema={workflowFormUiSchema}
            validator={validator}
            formData={inputs}
            disabled={busy || !project}
            showErrorList={false}
            onChange={(event) => onChange((event.formData ?? {}) as Record<string, unknown>)}
          />
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center p-5 text-center text-xs text-text-muted">点击画布里的工具节点后编辑真实 schema 输入。</div>
      )}
    </section>
  );
}

function RunHistoryPanel({ runs, busy, onDeleteRun }: { runs: WorkflowRunRecord[]; busy: boolean; onDeleteRun: (runId: string) => void }) {
  const [expandedRunId, setExpandedRunId] = useState("");
  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-large border border-border bg-surface-panel shadow-sm">
      <div className="border-b border-border-soft px-4 py-3">
        <h2 className="m-0 text-xs font-bold uppercase tracking-wider text-text-subtle">执行记录</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {runs.length === 0 ? <div className="p-4 text-xs text-text-muted">暂无 workflow run。</div> : runs.slice(0, 12).map((run) => {
          const expanded = expandedRunId === run.id;
          return (
            <article key={run.id} className="mb-2 rounded-card border border-border-soft bg-surface-raised p-3">
              <button type="button" onClick={() => setExpandedRunId(expanded ? "" : run.id)} className="w-full text-left">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <strong className="truncate text-xs text-text">{run.name}</strong>
                  <span className={cn("rounded-pill px-2 py-0.5 text-[9px] font-bold", run.status === "failed" ? "bg-[#b03939]/10 text-[#b03939]" : run.status === "partial" ? "bg-[#d99732]/10 text-[#8a5a00]" : "bg-brand/10 text-brand-strong")}>{run.status}</span>
                </div>
                <span className="block truncate text-[10px] text-text-subtle">{run.createdAt}</span>
              </button>
              <div className="mt-2 flex justify-end">
                <button type="button" disabled={busy} onClick={() => onDeleteRun(run.id)} className="inline-flex items-center gap-1 rounded-control px-2 py-1 text-[10px] font-semibold text-text-subtle hover:bg-surface-muted hover:text-text disabled:opacity-50">
                  <Trash2 className="h-3 w-3" />删除记录
                </button>
              </div>
              {expanded ? (
                <div className="mt-2 grid gap-1.5">
                  {run.nodeResults.map((node) => (
                    <div key={`${run.id}-${node.nodeId}`} className="rounded-control bg-surface-muted px-2 py-1.5 text-[10px]">
                      <div className="flex items-center justify-between gap-2">
                        <strong className="truncate text-text-muted">{node.toolName ?? node.nodeId}</strong>
                        <span className="shrink-0 font-bold text-text-subtle">{node.status}</span>
                      </div>
                      {node.missingRequired?.length ? <p className="m-0 mt-1 text-[#b03939]">missing: {node.missingRequired.join(", ")}</p> : null}
                      {node.errorMessage ? <p className="m-0 mt-1 line-clamp-2 text-[#b03939]">{node.errorMessage}</p> : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function flowToGraph(nodes: Node[], edges: Edge[], toolInputs: ToolInputs): MakerWorkflowGraph {
  return {
    version: 1,
    source: "tools-list",
    nodes: nodes.map((node) => ({
      id: node.id,
      type: node.type ?? "default",
      position: node.position,
      data: serializableNodeData(node, toolInputs)
    })),
    edges: edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, animated: edge.animated ?? false }))
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
      inputs: toolInputs[node.id] ?? data.inputs ?? {}
    };
  }
  return { kind: "static", title: data?.title, subtitle: data?.subtitle, tone: data?.tone };
}

function graphToFlow(graph: MakerWorkflowGraph, tools: ToolSummary[], tasks: TaskRecord[], latestRun?: WorkflowRunRecord): { nodes: Node[]; edges: Edge[] } {
  const nodes = graph.nodes.map((raw) => restoreNode(raw, tools, tasks, latestRun)).filter((node): node is Node => !!node);
  const edges = graph.edges.map((raw) => restoreEdge(raw)).filter((edge): edge is Edge => !!edge);
  return { nodes, edges };
}

function restoreNode(raw: unknown, tools: ToolSummary[], tasks: TaskRecord[], latestRun?: WorkflowRunRecord): Node | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const node = raw as { id?: unknown; type?: unknown; position?: unknown; data?: unknown };
  if (typeof node.id !== "string" || !node.position || typeof node.position !== "object") return undefined;
  const data = node.data && typeof node.data === "object" ? node.data as Record<string, unknown> : {};
  if (data.kind === "tool" && typeof data.toolName === "string") {
    const tool = tools.find((item) => item.name === data.toolName) ?? { name: data.toolName, category: typeof data.category === "string" ? data.category : "other", required: requiredArray(data.required), inputSchema: {} };
    const recentTask = tasks.find((task) => task.toolName === tool.name);
    const runNode = latestRun?.nodeResults.find((item) => item.nodeId === node.id);
    return {
      id: node.id,
      type: typeof node.type === "string" ? node.type : "default",
      position: node.position as Node["position"],
      data: { ...data, inputs: isRecord(data.inputs) ? data.inputs : {}, label: <ToolNodeLabel tool={tool} status={runNode?.status ?? recentTask?.status ?? data.status as TaskRecord["status"] | undefined} configured={isConfiguredInput(data.inputs, tool)} />, tone: data.tone ?? toneForCategory(tool.category) }
    };
  }
  const title = typeof data.title === "string" ? data.title : node.id;
  const subtitle = typeof data.subtitle === "string" ? data.subtitle : "saved node";
  return { id: node.id, type: typeof node.type === "string" ? node.type : "default", position: node.position as Node["position"], data: { ...data, label: <StaticNodeLabel icon={<Database className="h-4 w-4" />} title={title} subtitle={subtitle} />, tone: data.tone ?? "#7b8794" } };
}

function restoreEdge(raw: unknown): Edge | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const edge = raw as { id?: unknown; source?: unknown; target?: unknown; animated?: unknown };
  if (typeof edge.id !== "string" || typeof edge.source !== "string" || typeof edge.target !== "string") return undefined;
  return { id: edge.id, source: edge.source, target: edge.target, animated: edge.animated === true, style: { stroke: "rgba(0, 217, 197, 0.55)" } };
}

function buildGraph(tools: ToolSummary[], tasks: TaskRecord[], toolInputs: ToolInputs, latestRun?: WorkflowRunRecord): { nodes: Node[]; edges: Edge[] } {
  const orderedTools = categoryOrder.flatMap((category) => tools.filter((tool) => tool.category === category));
  const grouped = orderedTools.map((tool, index) => {
    const id = `tool-${tool.name}`;
    const recentTask = tasks.find((task) => task.toolName === tool.name);
    const runNode = latestRun?.nodeResults.find((item) => item.nodeId === id);
    return {
      id,
      type: "default",
      position: { x: 260 + (index % 3) * 205, y: 40 + Math.floor(index / 3) * 108 },
      data: { kind: "tool", toolName: tool.name, category: tool.category, required: tool.required, status: recentTask?.status, inputs: toolInputs[id] ?? {}, label: <ToolNodeLabel tool={tool} status={runNode?.status ?? recentTask?.status} configured={isConfiguredInput(toolInputs[id], tool)} />, tone: toneForCategory(tool.category) }
    } satisfies Node;
  });

  const sourceNodes: Node[] = [
    { id: "input-assets", position: { x: 20, y: 80 }, data: { kind: "static", title: "Asset Hub", subtitle: "项目内图片 / 视频 / 音频 / 模型", label: <StaticNodeLabel icon={<Database className="h-4 w-4" />} title="Asset Hub" subtitle="项目内图片 / 视频 / 音频 / 模型" />, tone: "#00D9C5" } },
    { id: "input-schema", position: { x: 20, y: 210 }, data: { kind: "static", title: "Tool Schema", subtitle: "真实 inputSchema 表单", label: <StaticNodeLabel icon={<Braces className="h-4 w-4" />} title="Tool Schema" subtitle="真实 inputSchema 表单" />, tone: "#4D4DAD" } }
  ];

  const edges: Edge[] = grouped.map((node, index) => ({ id: `edge-${node.id}`, source: index % 2 === 0 ? "input-assets" : "input-schema", target: node.id, animated: true, style: { stroke: "rgba(0, 217, 197, 0.55)" } }));
  return { nodes: [...sourceNodes, ...grouped], edges };
}

function ToolNodeLabel({ tool, status, configured }: { tool: ToolSummary; status?: TaskRecord["status"] | "skipped"; configured: boolean }) {
  return (
    <div className="min-w-[170px]">
      <div className="mb-1 flex items-center justify-between gap-2">
        <strong className="truncate text-[12px] text-text">{tool.name}</strong>
        <span className={cn("rounded-pill px-1.5 py-0.5 text-[8px] font-bold uppercase", status === "failed" ? "bg-[#b03939]/10 text-[#b03939]" : status === "running" ? "bg-brand/10 text-brand-strong" : status === "succeeded" ? "bg-[#246b2f]/10 text-[#246b2f]" : status === "skipped" ? "bg-[#d99732]/10 text-[#8a5a00]" : configured ? "bg-brand/10 text-brand-strong" : "bg-surface-muted text-text-subtle")}>{status ?? (configured ? "ready" : tool.category)}</span>
      </div>
      <div className="truncate text-[10px] text-text-subtle">{tool.required.length ? tool.required.join(", ") : "no required fields"}</div>
    </div>
  );
}

function StaticNodeLabel({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex min-w-[160px] items-center gap-2">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-brand/10 text-brand-strong">{icon}</div>
      <div className="min-w-0"><strong className="block truncate text-xs text-text">{title}</strong><span className="block truncate text-[10px] text-text-subtle">{subtitle}</span></div>
    </div>
  );
}

function StatusChip({ icon, label, tone }: { icon: React.ReactNode; label: string; tone: "brand" | "neutral" | "bad" }) {
  return <span className={cn("inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-xs font-semibold", tone === "brand" ? "border-brand/30 bg-brand/10 text-brand-strong" : tone === "bad" ? "border-[#b03939]/20 bg-[#b03939]/10 text-[#b03939]" : "border-border bg-surface-panel text-text-muted")}>{icon}{label}</span>;
}

function inputsFromGraph(graph: MakerWorkflowGraph): ToolInputs {
  const inputs: ToolInputs = {};
  for (const raw of graph.nodes) {
    if (!raw || typeof raw !== "object") continue;
    const node = raw as { id?: unknown; data?: unknown };
    const data = node.data && typeof node.data === "object" ? node.data as { kind?: unknown; inputs?: unknown } : undefined;
    if (typeof node.id === "string" && data?.kind === "tool" && isRecord(data.inputs)) inputs[node.id] = data.inputs;
  }
  return inputs;
}

function findToolForNode(nodes: Node[], tools: ToolSummary[], nodeId: string) {
  const node = nodes.find((item) => item.id === nodeId);
  const toolName = node?.data?.toolName;
  return typeof toolName === "string" ? tools.find((tool) => tool.name === toolName) : undefined;
}

function isToolNode(node: Node) {
  return node.data?.kind === "tool" && typeof node.data.toolName === "string";
}

function hasConfiguredInput(node: Node, tools: ToolSummary[]) {
  const toolName = node.data?.toolName;
  const tool = typeof toolName === "string" ? tools.find((item) => item.name === toolName) : undefined;
  return !!tool && isConfiguredInput(node.data?.inputs, tool);
}

function isConfiguredInput(input: unknown, tool: ToolSummary) {
  const record = isRecord(input) ? input : {};
  if (tool.required.length === 0) return true;
  return tool.required.every((field) => Object.prototype.hasOwnProperty.call(record, field));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function requiredArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
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
