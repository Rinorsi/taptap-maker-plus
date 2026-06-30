import { ClipboardList } from "lucide-react";
import type { ProjectSummary } from "../../../api";
import type { AgentContextSnapshot, AgentPageState, CompressedAgentContext } from "../api";
import { RawViewer } from "../../../components/developer/RawViewer";
import { describeSelection } from "../utils";
import { AgentInfoRow, AgentMetric, AgentSection } from "./AgentPanelPrimitives";

export function AgentContextTab({
  context,
  compressedContext,
  compressedContextSnapshotId,
  selectedProject,
  page,
  contextRows
}: {
  context?: AgentContextSnapshot;
  compressedContext?: CompressedAgentContext;
  compressedContextSnapshotId?: string;
  selectedProject?: ProjectSummary;
  page: AgentPageState;
  contextRows: Array<{ label: string; value: string }>;
}) {
  const compressed = compressedContext ? JSON.stringify(compressedContext, null, 2) : "";
  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-agent-bg p-4 gap-4">
      <AgentSection icon={<ClipboardList className="h-4 w-4" />} title="环境信息">
        <div className="grid gap-3">
          <div className="rounded-panel border border-agent-border bg-agent-panel p-2 shadow-sm">
            <AgentInfoRow label="项目" value={selectedProject?.name ?? "-"} />
            <AgentInfoRow label="路径" value={selectedProject?.rootPath ?? "-"} />
            <AgentInfoRow label="面板" value={context?.page.activeTab ?? page.activeTab ?? "-"} />
            <AgentInfoRow label="选择" value={describeSelection(context?.page.selection ?? page.selection)} />
            <AgentInfoRow label="快照" value={compressedContextSnapshotId ?? "实时上下文"} />
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {contextRows.map((row) => <AgentMetric key={row.label} label={row.label} value={row.value} />)}
          </div>
        </div>
      </AgentSection>
      
      <details className="group mt-4 rounded-panel border border-agent-border bg-agent-panel">
        <summary className="cursor-pointer select-none px-4 py-3 text-xs font-semibold uppercase tracking-wider text-agent-subtle transition-colors hover:text-agent-text">
          原始上下文数据 (Raw JSON)
        </summary>
        <div className="h-[400px] border-t border-agent-border">
          <RawViewer title="compressed-context.json" value={compressed} language="json" emptyText="暂无上下文" height="100%" compactGutter />
        </div>
      </details>
    </div>
  );
}
