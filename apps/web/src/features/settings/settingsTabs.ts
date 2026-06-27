import {
  Box,
  Bug,
  Cpu,
  Download,
  FolderCog,
  Grid3X3,
  Keyboard,
  Palette,
  Settings,
  Workflow,
  type LucideIcon,
} from "lucide-react";

export type SettingsTab =
  | "general"
  | "project-workspace"
  | "appearance"
  | "generation-defaults"
  | "canvas-assets"
  | "tasks"
  | "runtime"
  | "software-update"
  | "shortcuts"
  | "advanced";

export const settingsTabs: Array<{ id: SettingsTab; label: string; icon: LucideIcon; keywords: string[] }> = [
  { id: "general", label: "通用", icon: Settings, keywords: ["基础应用", "启动时打开", "上次的项目", "主页", "项目选择器", "默认工作区", "资产库", "视频", "图像", "音频", "3D", "UI 密度", "舒适", "标准", "紧凑", "界面最小尺寸", "最低 UI 宽高", "窗口最小宽高", "1366", "768", "危险操作确认强度", "侧边栏偏好", "左栏默认状态", "右栏 Inspector 默认状态", "自动保存", "语言"] },
  { id: "project-workspace", label: "项目与工作区", icon: FolderCog, keywords: ["Maker 项目根目录", "Maker", "项目根目录", "项目目录", "扫描项目", "删除本地项目文件夹", "确认目录", "选择目录", "保存并扫描", "当前打开项目", "项目", "工作区", "工作空间"] },
  { id: "appearance", label: "外观与编辑器", icon: Palette, keywords: ["界面", "主题", "深色", "暗色", "浅色", "亮色", "跟随系统", "代码编辑器", "编辑器主题", "字号", "字体大小", "自动换行", "显示行号", "行号"] },
  { id: "generation-defaults", label: "生成默认值", icon: Box, keywords: ["默认值", "新项目", "全局初始化", "模板", "工作空间", "项目初始化", "工作区默认值", "图像生成", "视频生成", "音乐", "音效", "3D 模型", "默认模型"] },
  { id: "canvas-assets", label: "画布与资产", icon: Workflow, keywords: ["节点", "节点编辑器", "画布自动保存", "画布更改自动保存", "进入画布", "侧边栏折叠", "离开画布", "恢复侧栏", "恢复侧栏状态", "网格", "显示网格背景", "迷你地图", "MiniMap", "吸附", "素材库", "素材", "资产", "文件流转", "外部拖入", "拖入资产", "自动复制", "每次询问", "移动资产", "删除资产", "移动删除资产前", "引用扫描", "项目资产", "资源"] },
  { id: "tasks", label: "任务与通知", icon: Grid3X3, keywords: ["任务面板", "任务详情", "点击任务默认展示", "状态", "日志", "错误", "异常通知", "桌面通知", "任务失败", "自动弹出错误日志", "生成类任务", "生成完成", "刷新资产", "完成后刷新资产", "通知策略"] },
  { id: "runtime", label: "MCP 运行时", icon: Cpu, keywords: ["MCP", "Runtime", "运行时", "自动启动策略", "手动控制", "选中项目后启动", "服务管理", "启动 MCP", "启动服务", "停止服务", "刷新工具", "MCP 包", "包更新", "安装", "重装", "卸载", "云端版本", "本地版本", "npm-cache"] },
  { id: "software-update", label: "软件更新", icon: Download, keywords: ["软件版本", "软件更新", "更新检查", "版本列表", "版本历史", "下载安装器", "覆盖安装", "GitHub Releases", "静态更新清单", "公告", "更新日志", "最新版本"] },
  { id: "shortcuts", label: "快捷键", icon: Keyboard, keywords: ["命令", "快捷键", "键盘", "Command Palette", "命令面板", "只读"] },
  { id: "advanced", label: "高级", icon: Bug, keywords: ["高级", "诊断", "日志", "通知", "开发者", "开发者模式", "调试日志", "系统级调试日志", "Chromium DevTools", "Open Devtools", "检查器", "重置软件", "恢复初始", "初始状态", "未绑定", "清空项目列表", "项目列表", "任务资产索引", "设置偏好", "停止 MCP runtime", "确认重置", "输入重置软件", "浏览器", "Chromium", "DevTools", "同源策略", "CORS", "缓存", "硬性重新加载", "右键菜单", "原生菜单", "权限", "工作区访问", "工作区访问策略", "自动执行", "确认机制", "工具权限", "执行终端命令", "终端命令", "总是询问", "管理策略", "个性化", "GPT-5.4", "项目上下文", "AI 助手", "助手偏好", "自动附加项目上下文", "自定义指令", "编辑规则", "高级诊断报告", "诊断报告", "诊断包", "导出诊断包", "本地运行日志", "日志缓存", "清空日志", "保留策略", "14 天", "运行记录"] },
];
