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
  const activeTasks = tasks?.filter((task) => task.status === "queued" || task.status === "running");
  if (!activeTasks?.length) return false;

  // 计算最早的活跃任务已运行时长
  const now = Date.now();
  const earliestStartTime = Math.min(...activeTasks.map((task) => new Date(task.startedAt).getTime()));
  const elapsed = now - earliestStartTime;

  // 指数退避：5s -> 10s -> 20s -> 30s（最大）
  if (elapsed < 30_000) return 5_000;   // 0-30秒：5秒
  if (elapsed < 120_000) return 10_000; // 30秒-2分钟：10秒
  if (elapsed < 300_000) return 20_000; // 2-5分钟：20秒
  return 30_000;                         // >5分钟：30秒
}
