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
    <div className="grid h-full min-h-0 gap-3 xl:grid-cols-[minmax(360px,0.8fr)_minmax(480px,1.2fr)]">
      <AgentSection icon={<ClipboardList className="h-4 w-4" />} title="上下文压缩">
        <div className="grid gap-3 overflow-y-auto p-3">
          <div className="rounded-large border border-border bg-surface p-2">
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
      <RawViewer title="compressed-context.json" value={compressed} language="json" emptyText="暂无上下文" height="100%" compactGutter />
    </div>
  );
}
