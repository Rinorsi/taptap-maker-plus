import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clearTasks, listTasks, type TaskRecord } from "../api";

export const taskQueryKeys = {
  all: ["tasks"] as const,
  list: (projectId?: string) => [...taskQueryKeys.all, "list", projectId ?? "all"] as const
};

export function useTasksQuery(projectId?: string) {
  return useQuery({
    queryKey: taskQueryKeys.list(projectId),
    queryFn: () => listTasks(projectId),
    refetchInterval: (query) => activeTaskRefetchInterval(query.state.data)
  });
}

export function useClearTasksMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: clearTasks,
    onSuccess: (_data, projectId) => {
      void queryClient.invalidateQueries({ queryKey: taskQueryKeys.list(projectId) });
      if (projectId) void queryClient.invalidateQueries({ queryKey: taskQueryKeys.list() });
    }
  });
}

export function activeTaskRefetchInterval(tasks?: TaskRecord[]) {
  return tasks?.some((task) => task.status === "queued" || task.status === "running") ? 5_000 : false;
}
