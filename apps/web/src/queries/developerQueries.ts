import { useQuery } from "@tanstack/react-query";
import { getAgentContext, getBuildLogs, listCredits, type AgentPageState } from "../api";

export const developerQueryKeys = {
  all: ["developer"] as const,
  buildLogs: (projectId: string) => [...developerQueryKeys.all, "build-logs", projectId] as const,
  agentContext: (projectId?: string, page?: AgentPageState) => [...developerQueryKeys.all, "agent-context", projectId ?? "none", page ?? {}] as const,
  credits: (projectId?: string) => [...developerQueryKeys.all, "credits", projectId ?? "all"] as const
};

export function useBuildLogsQuery(projectId?: string) {
  return useQuery({
    queryKey: projectId ? developerQueryKeys.buildLogs(projectId) : [...developerQueryKeys.all, "build-logs", "disabled"],
    queryFn: () => getBuildLogs(projectId!),
    enabled: Boolean(projectId)
  });
}

export function useAgentContextQuery(projectId?: string, page?: AgentPageState) {
  return useQuery({
    queryKey: developerQueryKeys.agentContext(projectId, page),
    queryFn: () => getAgentContext(projectId, page)
  });
}

export function useCreditsQuery(projectId?: string) {
  return useQuery({
    queryKey: developerQueryKeys.credits(projectId),
    queryFn: () => listCredits(projectId)
  });
}
