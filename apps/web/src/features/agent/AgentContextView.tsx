import type { AgentPageState, ProjectSummary } from "../../api";
import { AgentAppShell } from "./shell/AgentAppShell";

type Props = {
  project?: ProjectSummary;
  page: AgentPageState;
  onExit: () => void;
};

export function AgentContextView({
  project,
  page,
  onExit,
}: Props) {
  return (
    <AgentAppShell
      project={project}
      page={page}
      onExit={onExit}
    />
  );
}
