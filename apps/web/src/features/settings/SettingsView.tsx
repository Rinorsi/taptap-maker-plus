import { Cpu, Database, FileJson, ServerCog, Settings } from "lucide-react";
import type { ProjectSummary, RuntimeSummary, ToolSummary } from "../../api";

type Props = { project?: ProjectSummary; runtime?: RuntimeSummary; tools: ToolSummary[] };

export function SettingsView({ project, runtime, tools }: Props) {
  const categories = tools.reduce<Record<string, number>>((acc, tool) => {
    acc[tool.category] = (acc[tool.category] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <section className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto bg-surface-app p-4 md:p-6">
      <div className="shrink-0">
        <span className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-text-subtle">
          <Settings className="h-3.5 w-3.5" />
          Settings
        </span>
        <h1 className="m-0 text-xl font-bold text-text">运行与绑定状态</h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SettingsPanel icon={<ServerCog className="h-4 w-4" />} title="当前项目">
          <SettingRow label="项目名" value={project?.name ?? "-"} />
          <SettingRow label="项目路径" value={project?.rootPath ?? "-"} />
          <SettingRow label="project_id" value={project?.makerProjectId ?? "-"} />
          <SettingRow label="config.json" value={project?.configPath ?? "-"} />
        </SettingsPanel>

        <SettingsPanel icon={<Cpu className="h-4 w-4" />} title="MCP Runtime">
          <SettingRow label="状态" value={runtime?.status ?? "idle"} />
          <SettingRow label="processId" value={runtime?.processId ? String(runtime.processId) : "-"} />
          <SettingRow label="cwd" value={runtime?.cwd ?? project?.rootPath ?? "-"} />
          <SettingRow label="tools/list 更新时间" value={runtime?.toolsListUpdatedAt ?? "-"} />
          <SettingRow label="启动命令" value="cmd.exe /d /s /c npx.cmd -y -p @taptap/maker taptap-maker" />
        </SettingsPanel>

        <SettingsPanel icon={<FileJson className="h-4 w-4" />} title="真实 MCP Schema">
          <SettingRow label="工具总数" value={String(tools.length)} />
          {Object.entries(categories).map(([category, count]) => (
            <SettingRow key={category} label={category} value={`${count} tools`} />
          ))}
          <SettingRow label="表单来源" value="tools/list inputSchema" />
        </SettingsPanel>

        <SettingsPanel icon={<Database className="h-4 w-4" />} title="本地工作台能力">
          <SettingRow label="HTTP API" value="Fastify / 127.0.0.1:8787" />
          <SettingRow label="前端" value="React + Vite" />
          <SettingRow label="Schema Form" value="@rjsf/core + validator-ajv8" />
          <SettingRow label="Workflow Canvas" value="@xyflow/react" />
          <SettingRow label="Asset Table" value="@tanstack/react-table" />
        </SettingsPanel>
      </div>

      {runtime?.lastError ? (
        <div className="rounded-large border border-[#b03939]/25 bg-[#b03939]/5 p-4">
          <h2 className="m-0 mb-2 text-sm font-bold text-[#b03939]">Runtime Error</h2>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words text-[11px] text-[#b03939]">{runtime.lastError}</pre>
        </div>
      ) : null}
    </section>
  );
}

function SettingsPanel({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-large border border-border bg-surface-panel shadow-sm">
      <div className="flex items-center gap-2 border-b border-border-soft px-4 py-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-control bg-brand/10 text-brand-strong">{icon}</div>
        <h2 className="m-0 text-sm font-bold text-text">{title}</h2>
      </div>
      <div className="p-2">{children}</div>
    </section>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-control px-3 py-2 hover:bg-surface-muted">
      <span className="shrink-0 text-xs font-semibold text-text-subtle">{label}</span>
      <strong className="min-w-0 truncate text-right text-xs font-semibold text-text" title={value}>{value}</strong>
    </div>
  );
}
