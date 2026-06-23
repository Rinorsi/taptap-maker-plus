import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getRuntimeStatus,
  getStatusLite,
  listTools,
  refreshTools,
  startRuntime,
  stopRuntime,
  type RuntimeSummary
} from "../api";
import { projectQueryKeys } from "./projectQueries";

export const mcpQueryKeys = {
  all: ["mcp"] as const,
  project: (projectId: string) => [...mcpQueryKeys.all, "project", projectId] as const,
  status: (projectId: string) => [...mcpQueryKeys.project(projectId), "status"] as const,
  tools: (projectId: string) => [...mcpQueryKeys.project(projectId), "tools"] as const
};

export function useRuntimeStatusQuery(projectId?: string) {
  return useQuery({
    queryKey: projectId ? mcpQueryKeys.status(projectId) : [...mcpQueryKeys.all, "status", "disabled"],
    queryFn: () => getRuntimeStatus(projectId!),
    enabled: Boolean(projectId),
    refetchInterval: (query) => {
      const runtime = query.state.data?.runtime ?? query.state.data?.project.runtime;
      return shouldPollRuntime(runtime) ? 3_000 : false;
    }
  });
}

export function useToolsQuery(projectId?: string) {
  return useQuery({
    queryKey: projectId ? mcpQueryKeys.tools(projectId) : [...mcpQueryKeys.all, "tools", "disabled"],
    queryFn: () => listTools(projectId!),
    enabled: Boolean(projectId)
  });
}

export function useStartRuntimeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: startRuntime,
    onSuccess: (_data, projectId) => {
      void queryClient.invalidateQueries({ queryKey: mcpQueryKeys.project(projectId) });
      void queryClient.invalidateQueries({ queryKey: projectQueryKeys.all });
    }
  });
}

export function useStopRuntimeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: stopRuntime,
    onSuccess: (_data, projectId) => {
      void queryClient.invalidateQueries({ queryKey: mcpQueryKeys.project(projectId) });
      void queryClient.invalidateQueries({ queryKey: projectQueryKeys.all });
    }
  });
}

export function useRefreshToolsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: refreshTools,
    onSuccess: (_data, projectId) => {
      void queryClient.invalidateQueries({ queryKey: mcpQueryKeys.project(projectId) });
      void queryClient.invalidateQueries({ queryKey: projectQueryKeys.all });
    }
  });
}

export function useStatusLiteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, args = {} }: { projectId: string; args?: Record<string, unknown> }) => getStatusLite(projectId, args),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: mcpQueryKeys.project(variables.projectId) });
      void queryClient.invalidateQueries({ queryKey: projectQueryKeys.all });
    }
  });
}

function shouldPollRuntime(runtime?: RuntimeSummary) {
  return runtime?.status === "starting";
}
