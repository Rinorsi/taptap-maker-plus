export const appVersion = {
  "appId": "taptap-maker-plus",
  "productName": "TapTap Maker Plus",
  "windowTitle": "TapTap Maker Plus",
  "displayVersion": "v0.14.0",
  "packageVersion": "0.14.0",
  "channel": "ALPHA",
  "publisher": "TapTap Maker",
  "description": "TapTap Maker 本地桌面工作台",
  "announcementTitle": "v0.14.0 开箱即用测试版",
  "announcementBody": "## v0.14.0 开箱即用测试版\n\n这个版本把重点放在普通用户安装后的本地可用性：桌面端随包携带 Node/npm/npx 运行时，并预热默认 Maker MCP 包缓存，降低用户电脑缺少开发环境导致无法启动 MCP 的概率。\n\n### 更新内容\n\n* 桌面安装包资源中加入内置 Node 运行时、npm/npx 命令和服务端生产依赖。\n* 默认预热 @taptap/maker 缓存，首次启动会把随包缓存复制到用户数据目录。\n* MCP 包安装、修复、版本切换优先使用桌面端管理的 npm-cache 和内置运行时。\n* 新增高级诊断导出能力，便于收集桌面日志、server 日志、MCP 日志、npm 缓存日志和运行时资源检查结果。\n* 设置页和 MCP 包管理页补充本地版本、云端版本、Beta 版本筛选、更新日志和安装失败提示。\n* 首页、侧栏和项目展示优化游戏名称、图标、MCP 状态和中文状态文案。\n\n### 已知说明\n\n当前仍是测试版本。默认内置 MCP 版本可以离线启动，但切换到未缓存的 MCP 版本仍需要访问 npm registry。Windows WebView2 仍按 Tauri 默认安装策略处理，极端精简或离线系统可能需要单独处理 WebView2。遇到启动异常、MCP 安装失败或版本切换失败时，请优先导出高级诊断包再反馈。",
  "announcementMarkdown": "## TapTap Maker Plus Alpha 公告\n\n欢迎来到 TapTap Maker Plus。它现在还是 **Alpha 版本**，但已经可以作为一个本地桌面工作台，帮你把 TapTap Maker 项目、MCP Runtime、素材管理和常用生成流程放到同一个地方处理。\n\n### 你现在可以先用起来的部分\n\n* 接入本地 TapTap Maker 项目，进入工作台继续制作\n* 管理 MCP 包、本地运行时和项目工具列表\n* 扫描素材库，整理图片、视频、音乐和 3D 资源\n* 使用图像、视频、音乐和 3D 工作室处理生成任务\n* 在视频多模态画布里组织分镜、参考素材和提示词流程\n* 查看任务记录、运行状态和错误信息\n\n### 这还是一个正在长大的版本\n\n有些地方还会粗糙，比如首次启动、项目识别、MCP 安装、网络环境、错误提示和个别页面的完成度。重要项目建议保留独立备份；如果你看到某个流程绕、卡、提示看不懂，基本都值得反馈。\n\n### 遇到问题可以直接反馈\n\n如果软件卡在启动页、白屏、闪退、MCP 安装失败、项目无法绑定，或者生成任务结果不对，可以把截图、操作步骤和诊断包一起发来。即使只有一句“我点了这里没反应”，也比憋着强。\n\n> 这是云端公告不可用时显示的本地备用公告。",
  "announcements": [
    {
      "title": "静态更新清单",
      "body": "版本号和更新日志来自 updates/app-update-manifest.json。"
    },
    {
      "title": "v0.14.0 开箱即用测试版",
      "body": "## v0.14.0 开箱即用测试版\n\n这个版本把重点放在普通用户安装后的本地可用性：桌面端随包携带 Node/npm/npx 运行时，并预热默认 Maker MCP 包缓存，降低用户电脑缺少开发环境导致无法启动 MCP 的概率。\n\n### 更新内容\n\n* 桌面安装包资源中加入内置 Node 运行时、npm/npx 命令和服务端生产依赖。\n* 默认预热 @taptap/maker 缓存，首次启动会把随包缓存复制到用户数据目录。\n* MCP 包安装、修复、版本切换优先使用桌面端管理的 npm-cache 和内置运行时。\n* 新增高级诊断导出能力，便于收集桌面日志、server 日志、MCP 日志、npm 缓存日志和运行时资源检查结果。\n* 设置页和 MCP 包管理页补充本地版本、云端版本、Beta 版本筛选、更新日志和安装失败提示。\n* 首页、侧栏和项目展示优化游戏名称、图标、MCP 状态和中文状态文案。\n\n### 已知说明\n\n当前仍是测试版本。默认内置 MCP 版本可以离线启动，但切换到未缓存的 MCP 版本仍需要访问 npm registry。Windows WebView2 仍按 Tauri 默认安装策略处理，极端精简或离线系统可能需要单独处理 WebView2。遇到启动异常、MCP 安装失败或版本切换失败时，请优先导出高级诊断包再反馈。"
    }
  ]
} as const;
