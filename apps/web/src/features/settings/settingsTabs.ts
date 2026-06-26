import {
  Bell,
  Box,
  Bot,
  Bug,
  Cpu,
  FolderCog,
  Grid3X3,
  Images,
  Keyboard,
  MonitorCog,
  Palette,
  Settings,
  Shield,
  Workflow,
  type LucideIcon,
} from "lucide-react";

export type SettingsTab =
  | "general"
  | "appearance"
  | "personalization"
  | "shortcuts"
  | "browser"
  | "permissions"
  | "project"
  | "workspaces"
  | "canvas"
  | "assets"
  | "tasks"
  | "runtime"
  | "logs"
  | "developer";

export const settingsTabs: Array<{ id: SettingsTab; label: string; icon: LucideIcon }> = [
  { id: "workspaces", label: "工作区", icon: Box },
  { id: "project", label: "项目", icon: FolderCog },
  { id: "general", label: "通用", icon: Settings },
  { id: "appearance", label: "外观", icon: Palette },
  { id: "personalization", label: "个性化", icon: Bot },
  { id: "shortcuts", label: "快捷键", icon: Keyboard },
  { id: "canvas", label: "画布", icon: Workflow },
  { id: "tasks", label: "任务", icon: Grid3X3 },
  { id: "assets", label: "资产", icon: Images },
  { id: "runtime", label: "运行时", icon: Cpu },
  { id: "browser", label: "浏览器", icon: MonitorCog },
  { id: "permissions", label: "权限", icon: Shield },
  { id: "logs", label: "日志与通知", icon: Bell },
  { id: "developer", label: "开发者", icon: Bug },
];
