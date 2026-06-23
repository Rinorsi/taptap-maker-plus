import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listProjects, scanProjects, selectProject } from "../api";

export const projectQueryKeys = {
  all: ["projects"] as const,
  list: () => [...projectQueryKeys.all, "list"] as const,
  scan: () => [...projectQueryKeys.all, "scan"] as const,
  selected: () => [...projectQueryKeys.all, "selected"] as const
};

export function useProjectsQuery() {
  return useQuery({
    queryKey: projectQueryKeys.list(),
    queryFn: listProjects
  });
}

export function useScanProjectsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: scanProjects,
    onSuccess: (data) => {
      queryClient.setQueryData(projectQueryKeys.list(), data);
      void queryClient.invalidateQueries({ queryKey: projectQueryKeys.all });
    }
  });
}

export function useSelectProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: selectProject,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectQueryKeys.all });
    }
  });
}
