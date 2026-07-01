export const appVersion = {
  "appId": "taptap-maker-plus",
  "productName": "TapTap Maker Plus",
  "windowTitle": "TapTap Maker Plus",
  "displayVersion": "v0.14.1",
  "packageVersion": "0.14.1",
  "channel": "ALPHA",
  "publisher": "TapTap Maker",
  "description": "TapTap Maker 本地桌面工作台",
  "announcementTitle": "v0.14.1 预览与开发体验修复",
  "announcementBody": "## v0.14.1 预览与开发体验修复\n\n这个版本集中修复游戏开发页的 TapTap Maker 原生预览容器、隐藏预览、刷新遮罩、登录态设置入口和桌面开发启动流程。\n\n### 更新内容\n\n* 游戏开发页加入自适应、PC、手机、平板、横竖屏、窗口比例、胶囊和灵动岛外壳预览控制。\n* 原生 Maker 预览改为容器内嵌定位，并修复窗口移动、尺寸变化和主题遮罩时的同步问题。\n* 隐藏预览会中断原生 WebView，停止后台声音，并显示占位状态。\n* 刷新预览只在 iframe ready 后显示画面，避免暴露 Maker 原始浏览器控件和黑屏画面。\n* 设置页新增游戏开发相关设置入口，预留登录态、后台保留、后台静音和独立窗口模式配置。\n* 桌面开发启动流程改为复用已有 Vite dev server，并在启动前清理残留 Tauri 开发进程。\n* 仓库协议切换为 MPL-2.0。\n\n### 已知说明\n\nTapTap Maker 登录会话仍依赖桌面端 WebView 环境；如果远程 Maker 页面结构变化，预览容器可能需要重新适配。遇到预览无法抓取时，请先尝试刷新预览。",
  "announcementMarkdown": "## TapTap Maker Plus Alpha 公告\n\n欢迎来到 TapTap Maker Plus。它现在还是 **Alpha 版本**，但已经可以作为一个本地桌面工作台，帮你把 TapTap Maker 项目、MCP Runtime、素材管理和常用生成流程放到同一个地方处理。\n\n### 你现在可以先用起来的部分\n\n* 接入本地 TapTap Maker 项目，进入工作台继续制作\n* 管理 MCP 包、本地运行时和项目工具列表\n* 扫描素材库，整理图片、视频、音乐和 3D 资源\n* 使用图像、视频、音乐和 3D 工作室处理生成任务\n* 在视频多模态画布里组织分镜、参考素材和提示词流程\n* 查看任务记录、运行状态和错误信息\n\n### 这还是一个正在长大的版本\n\n有些地方还会粗糙，比如首次启动、项目识别、MCP 安装、网络环境、错误提示和个别页面的完成度。重要项目建议保留独立备份；如果你看到某个流程绕、卡、提示看不懂，基本都值得反馈。\n\n### 遇到问题可以直接反馈\n\n如果软件卡在启动页、白屏、闪退、MCP 安装失败、项目无法绑定，或者生成任务结果不对，可以把截图、操作步骤和诊断包一起发来。即使只有一句“我点了这里没反应”，也比憋着强。\n\n> 这是云端公告不可用时显示的本地备用公告。",
  "announcements": [
    {
      "title": "静态更新清单",
      "body": "版本号和更新日志来自本地 app-version.json。"
    },
    {
      "title": "v0.14.1 预览与开发体验修复",
      "body": "## v0.14.1 预览与开发体验修复\n\n这个版本集中修复游戏开发页的 TapTap Maker 原生预览容器、隐藏预览、刷新遮罩、登录态设置入口和桌面开发启动流程。\n\n### 更新内容\n\n* 游戏开发页加入自适应、PC、手机、平板、横竖屏、窗口比例、胶囊和灵动岛外壳预览控制。\n* 原生 Maker 预览改为容器内嵌定位，并修复窗口移动、尺寸变化和主题遮罩时的同步问题。\n* 隐藏预览会中断原生 WebView，停止后台声音，并显示占位状态。\n* 刷新预览只在 iframe ready 后显示画面，避免暴露 Maker 原始浏览器控件和黑屏画面。\n* 设置页新增游戏开发相关设置入口，预留登录态、后台保留、后台静音和独立窗口模式配置。\n* 桌面开发启动流程改为复用已有 Vite dev server，并在启动前清理残留 Tauri 开发进程。\n* 仓库协议切换为 MPL-2.0。\n\n### 已知说明\n\nTapTap Maker 登录会话仍依赖桌面端 WebView 环境；如果远程 Maker 页面结构变化，预览容器可能需要重新适配。遇到预览无法抓取时，请先尝试刷新预览。"
    }
  ]
} as const;
