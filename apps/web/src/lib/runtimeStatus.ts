import type { RuntimeStatus } from "../api";

export function formatRuntimeStatus(status?: RuntimeStatus) {
  switch (status) {
    case "ready":
      return "已启动";
    case "starting":
      return "启动中";
    case "disconnected":
      return "已断开";
    case "error":
      return "异常";
    case "idle":
    case undefined:
      return "未启动";
    default:
      return status satisfies never;
  }
}
