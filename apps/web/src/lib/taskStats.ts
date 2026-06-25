import type { TaskRecord } from "../api";

/**
 * Calculate average duration for a specific tool from historical tasks
 * Only counts succeeded tasks with finishedAt timestamps
 */
export function calculateAverageDuration(
  tasks: TaskRecord[],
  toolName: string
): number | undefined {
  const completedTasks = tasks.filter(
    (task) =>
      task.toolName === toolName &&
      task.status === "succeeded" &&
      task.finishedAt
  );

  if (completedTasks.length === 0) return undefined;

  const totalDuration = completedTasks.reduce((sum, task) => {
    const start = new Date(task.startedAt).getTime();
    const end = new Date(task.finishedAt!).getTime();
    return sum + (end - start);
  }, 0);

  const averageMs = totalDuration / completedTasks.length;
  return Math.floor(averageMs / 1000); // Convert to seconds
}