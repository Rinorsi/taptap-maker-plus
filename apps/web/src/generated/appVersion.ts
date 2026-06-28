export const appVersion = {
  "appId": "taptap-maker-plus",
  "productName": "TapTap Maker Plus",
  "windowTitle": "TapTap Maker Plus",
  "displayVersion": "v0.13.6-ALPHA",
  "packageVersion": "0.13.6-alpha",
  "channel": "ALPHA",
  "publisher": "TapTap Maker",
  "description": "TapTap Maker 本地桌面工作台",
  "announcementTitle": "v0.13.6-ALPHA 多源更新下载与仓库规范",
  "announcementBody": "## v0.13.6-ALPHA 多源更新下载与仓库规范\n\n这是 Alpha 测试版本，重点把软件更新下载链路做成可兜底、可校验、可继续扩展的结构。\n\n### 更新内容\n\n* 更新清单支持为安装包配置多个下载源。\n* 下载更新时会按清单顺序尝试下载源，失败后自动切换到下一个源。\n* 下载完成后会计算安装包 SHA256；清单提供校验值时，必须校验通过才会打开安装程序。\n* 更新页会展示当前下载源、下载进度、失败源和校验结果。\n* 关于页补充 GitHub 仓库和 Issues 入口。\n* 仓库新增 MIT License 文件，协议不再只停留在页面说明里。\n\n### 已知说明\n\n当前仍是 Alpha 版本。第三方加速源只作为临时下载兜底，后续会逐步替换为更稳定的官方维护镜像源。遇到下载失败、校验失败、启动异常或 MCP 连接问题时，请优先导出诊断包再反馈。",
  "announcementMarkdown": "## TapTap Maker Plus Alpha 公告\n\n欢迎来到 TapTap Maker Plus。它现在还是 **Alpha 版本**，但已经可以作为一个本地桌面工作台，帮你把 TapTap Maker 项目、MCP Runtime、素材管理和常用生成流程放到同一个地方处理。\n\n### 你现在可以先用起来的部分\n\n* 接入本地 TapTap Maker 项目，进入工作台继续制作\n* 管理 MCP 包、本地运行时和项目工具列表\n* 扫描素材库，整理图片、视频、音乐和 3D 资源\n* 使用图像、视频、音乐和 3D 工作室处理生成任务\n* 在视频多模态画布里组织分镜、参考素材和提示词流程\n* 查看任务记录、运行状态和错误信息\n\n### 这还是一个正在长大的版本\n\n有些地方还会粗糙，比如首次启动、项目识别、MCP 安装、网络环境、错误提示和个别页面的完成度。重要项目建议保留独立备份；如果你看到某个流程绕、卡、提示看不懂，基本都值得反馈。\n\n### 遇到问题可以直接反馈\n\n如果软件卡在启动页、白屏、闪退、MCP 安装失败、项目无法绑定，或者生成任务结果不对，可以把截图、操作步骤和诊断包一起发来。即使只有一句“我点了这里没反应”，也比憋着强。\n\n> 这是云端公告不可用时显示的本地备用公告。",
  "announcements": [
    {
      "title": "静态更新清单",
      "body": "版本号和更新日志来自 updates/app-update-manifest.json。"
    },
    {
      "title": "v0.13.6-ALPHA 多源更新下载与仓库规范",
      "body": "## v0.13.6-ALPHA 多源更新下载与仓库规范\n\n这是 Alpha 测试版本，重点把软件更新下载链路做成可兜底、可校验、可继续扩展的结构。\n\n### 更新内容\n\n* 更新清单支持为安装包配置多个下载源。\n* 下载更新时会按清单顺序尝试下载源，失败后自动切换到下一个源。\n* 下载完成后会计算安装包 SHA256；清单提供校验值时，必须校验通过才会打开安装程序。\n* 更新页会展示当前下载源、下载进度、失败源和校验结果。\n* 关于页补充 GitHub 仓库和 Issues 入口。\n* 仓库新增 MIT License 文件，协议不再只停留在页面说明里。\n\n### 已知说明\n\n当前仍是 Alpha 版本。第三方加速源只作为临时下载兜底，后续会逐步替换为更稳定的官方维护镜像源。遇到下载失败、校验失败、启动异常或 MCP 连接问题时，请优先导出诊断包再反馈。"
    }
  ]
} as const;
