import { Bug, Cpu, FileJson, FolderCog, type LucideIcon } from "lucide-react";

export type SettingsTab = "project" | "runtime" | "schema" | "diagnostics";

export const settingsTabs: Array<{ id: SettingsTab; label: string; icon: LucideIcon }> = [
  { id: "project", label: "项目绑定", icon: FolderCog },
  { id: "runtime", label: "Runtime", icon: Cpu },
  { id: "schema", label: "MCP Schema", icon: FileJson },
  { id: "diagnostics", label: "诊断日志", icon: Bug },
];
