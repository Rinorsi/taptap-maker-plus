import type { AgentPageState, ProjectSummary } from "../../api";
import { AgentAppShell } from "./shell/AgentAppShell";

type Props = {
  project?: ProjectSummary;
  page: AgentPageState;
  theme: "light" | "dark";
  onExit: () => void;
};

export function AgentContextView({
  project,
  page,
  theme,
  onExit,
}: Props) {
  return (
    <AgentAppShell
      project={project}
      page={page}
      theme={theme}
      onExit={onExit}
    />
  );
}
