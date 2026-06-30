import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Terminal } from "lucide-react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal as XTerm } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import type { DesktopReadiness, RuntimeStatus } from "../../../api";
import { runAgentTerminalSnapshot, type AgentContextSnapshot, type AgentTerminalSnapshot, type AgentTerminalSnapshotCommandId, type PiAgentRuntimeStatus } from "../api";
import { Button } from "../../../components/ui/Button";
import { formatRuntimeStatus } from "../../../lib/runtimeStatus";
import { AgentSection } from "./AgentPanelPrimitives";

export function AgentTerminalTab({ context, readiness, runtimeStatus, pi }: { context?: AgentContextSnapshot; readiness?: DesktopReadiness; runtimeStatus: RuntimeStatus; pi?: PiAgentRuntimeStatus }) {
  const [snapshot, setSnapshot] = useState<AgentTerminalSnapshot>();
  const [history, setHistory] = useState<AgentTerminalSnapshot[]>([]);
  const [runningCommand, setRunningCommand] = useState<AgentTerminalSnapshotCommandId>();
  const [error, setError] = useState("");
  const lines = useMemo(() => {
    const header = [
    "TapTap Maker Agent terminal",
    `MCP: ${formatRuntimeStatus(runtimeStatus)}`,
    `Project: ${context?.project?.name ?? "-"}`,
    `cwd: ${context?.runtime?.cwd ?? context?.project?.rootPath ?? "-"}`,
    `API: ${readiness ? `${readiness.server.host}:${readiness.server.port}` : "-"}`,
    `Pi Runtime: ${pi?.connected ? "connected" : "not connected"}`,
    ""
  ];
    if (error) return [...header, `[error] ${error}`];
    if (!snapshot) return [...header, "选择上方预设命令后，这里会显示真实命令输出。"];
    const historyLines = history.slice(1).flatMap((item) => [
      "",
      `# previous: ${item.label} · exit ${item.exitCode ?? "-"} · ${item.generatedAt}`,
      `$ ${formatTerminalCommand(item)}`,
      item.stdout || "<stdout empty>",
      item.stderr ? `[stderr]\n${item.stderr}` : ""
    ]);
    return [
      ...header,
      `$ ${formatTerminalCommand(snapshot)}`,
      `cwd: ${snapshot.cwd}`,
      `exit: ${snapshot.exitCode ?? "-"} · ${snapshot.durationMs}ms · ${snapshot.generatedAt}`,
      "",
      snapshot.stdout || "<stdout empty>",
      snapshot.stderr ? `\n[stderr]\n${snapshot.stderr}` : "",
      ...historyLines
    ];
  }, [context, error, history, pi, readiness, runtimeStatus, snapshot]);

  async function run(commandId: AgentTerminalSnapshotCommandId) {
    setRunningCommand(commandId);
    setError("");
    try {
      const nextSnapshot = await runAgentTerminalSnapshot({ commandId, projectId: context?.project?.id });
      setSnapshot(nextSnapshot);
      setHistory((items) => [nextSnapshot, ...items].slice(0, 8));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setRunningCommand(undefined);
    }
  }

  return (
    <AgentSection
      icon={<Terminal className="h-4 w-4" />}
      title="终端"
      actions={
        <div className="flex items-center gap-1">
          {[
            ["workspace_status", "工作区"],
            ["git_status", "项目 Git"],
            ["node_version", "Node"],
            ["npm_version", "npm"],
            ["where_node_npm_npx", "命令路径"],
            ["npm_cache_config", "npm cache"]
          ].map(([commandId, label]) => (
            <Button key={commandId} type="button" variant="outline" size="sm" className="h-7 gap-1 px-2 text-[11px]" onClick={() => void run(commandId as AgentTerminalSnapshotCommandId)} disabled={Boolean(runningCommand)}>
              {runningCommand === commandId ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              {label}
            </Button>
          ))}
        </div>
      }
    >
      <XTermPane lines={lines} />
    </AgentSection>
  );
}

function formatTerminalCommand(snapshot: AgentTerminalSnapshot) {
  return `${snapshot.displayCommand ?? snapshot.command} ${(snapshot.displayArgs ?? snapshot.args).join(" ")}`.trim();
}

function XTermPane({ lines }: { lines: string[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const terminal = new XTerm({
      convertEol: true,
      cursorBlink: false,
      disableStdin: true,
      fontFamily: "Consolas, 'Cascadia Code', monospace",
      fontSize: 12,
      lineHeight: 1.35,
      theme: {
        background: "#101418",
        foreground: "#d6dde3",
        cursor: "#00d9c5",
        selectionBackground: "#00d9c533"
      }
    });
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(containerRef.current);
    terminalRef.current = terminal;
    fitRef.current = fit;
    fit.fit();
    const observer = new ResizeObserver(() => fit.fit());
    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
      terminal.dispose();
      terminalRef.current = null;
      fitRef.current = null;
    };
  }, []);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;
    terminal.clear();
    for (const line of lines) {
      terminal.writeln(line);
    }
  }, [lines]);

  return <div ref={containerRef} className="h-full min-h-[240px] bg-[#101418] p-2" />;
}
