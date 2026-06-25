import type { CanvasCompileResult, CanvasExecutionAdapter } from "./types";

export async function executeCompiledCanvasTool(
  adapter: CanvasExecutionAdapter,
  toolName: string,
  compiled: CanvasCompileResult,
) {
  if (!compiled.ok || !compiled.payload) {
    throw new Error(
      compiled.issues
        .filter((issue) => issue.severity === "error")
        .map((issue) => issue.message)
        .join("\n") || "画布尚未生成可执行 payload。",
    );
  }
  return adapter.callTool(toolName, compiled.payload);
}

