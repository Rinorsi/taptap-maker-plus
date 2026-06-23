import type { ToolSummary } from "../../api";

type ToolDisplay = {
  title: string;
  summary: string;
  details: string;
  translatedDescription: string;
};

const toolDisplays: Record<string, ToolDisplay> = {
  maker_status_lite: {
    title: "Maker 状态自检",
    summary: "读取当前项目的 MCP、环境和绑定状态。",
    details: "用于确认当前项目是否正确绑定 Maker MCP、运行环境是否可用、项目路径和工具链状态是否正常。适合放在启动后第一步检查。",
    translatedDescription: "面向使用工具输出而不是 maker://status 资源的客户端提供兼容状态信息。若资源可用，应优先读取 maker://status。该工具会展示用户当前工作目录的本地 Maker 状态，包括 Git、Python 运行环境、用于本地 Lua 诊断的 maker-lua-lsp、PAT/TapTap 鉴权、项目绑定、AI 开发套件状态、Maker 代理工具状态与失败信息、Maker Git 工作流策略、Maker 创意资产工具策略、受支持的本地路径/远程 URL/data URL 输入，以及内置工作流指南文档路径。Maker 初始化下一步为 taptap-maker init。若用户明确要求在未绑定目录中创建项目或游戏，优先使用 taptap-maker init --create，而不是匹配同名应用。"
  },
  generate_image: {
    title: "单张图片生成",
    summary: "基于提示词和参考图生成图片，并写入当前 Maker 项目。",
    details: "支持提示词、资源名称、比例、目标尺寸、透明背景、参考图、种子、生成分辨率、思考强度和模型选择。生成结果应进入当前项目资产库。",
    translatedDescription: `根据文本描述生成图片，可自定义宽高比、透明背景、尺寸和参考图。

该工具使用 AI 从简短中文描述生成图片，提示词最大 50KB。

**图片尺寸的工作方式（两步处理）：**
1. AI 会先根据 aspect_ratio 生成固定比例的图片。
2. 然后再缩放到 target_size 指定的最终尺寸，该参数必填。

**第 1 步：选择 aspect_ratio（决定画面形状）：**
- 1:1：1024×1024，图标、头像、方形素材，默认。
- 2:3：832×1248，竖版海报、角色插画。
- 3:2：1248×832，横向场景、风景图。
- 3:4：864×1184，竖版卡片、手机壁纸。
- 4:3：1184×864，传统横版图、PPT 图片。
- 9:16：768×1344，竖屏全屏、短视频封面。
- 16:9：1344×768，宽屏、游戏场景、视频封面。
- 21:9：1536×672，超宽电影画幅。
- 5:4：1152×896，近似方形的横图。
- 4:5：896×1152，近似方形的竖图、社交媒体图片。

**第 2 步：指定 target_size（决定最终像素尺寸）：**
常见游戏资产尺寸，建议使用 2 的幂：
- 图标：64x64、128x128、256x256。
- UI 元素：256x256、512x512。
- 角色精灵：256x512、512x1024。
- 贴图：512x512、1024x1024。

示例：aspect_ratio="1:1" + target_size="256x256" 会得到 256×256 的游戏图标。

**透明背景检测：**
系统会根据关键词自动判断是否需要透明背景：
- 透明
- 透明背景
- 抠图
- 无背景

**参考图：**
可提供一张或多张参考图用于风格或内容引导，最多 14 张。
- reference_images：文件路径或 base64 data URL 数组，推荐使用，支持多张。
- reference_image：单张文件路径，保留用于兼容旧写法。
示例：["assets/cat.png", "assets/style.png"]

**高级选项：**
- seed：整数种子，用于复现结果，例如 42。
- thinking_level：minimal 更快，high 更适合复杂提示词。
- resolution：生成分辨率，支持 0.5K、1K、2K、4K，默认 1K。

**命名规则：**
文件保存为 {name}_{timestamp}.png。
示例：小猫_20250107143052.png

**Maker 资产工作流提示：**
在已绑定 Maker 项目中，应优先使用该 Maker MCP 代理工具生成项目资产。成功结果会下载到 Maker 项目，并记录远程映射，便于后续编辑或视频引用。大体积本地文件或 data URL 可能较慢或失败：图片输入通常约 10 MB，视频任务图片输入约 30 MB，视频约 50 MB，音频约 15 MB。若该 Maker 代理工具失败或返回 isError，应保留完整 remote_result/error payload 以便开发者排查。`
  },
  batch_generate_images: {
    title: "批量图片生成",
    summary: "一次提交多张图片生成请求，适合图标、角色变体和素材批量产出。",
    details: "用于同时生成多张图片，适合 UI 图标、角色变体、道具素材和批量风格探索。每个子任务包含自己的提示词、名称和目标尺寸。",
    translatedDescription: `并行批量生成多张图片。需要一次生成 2 张或更多图片时，应使用该工具，而不是多次调用 generate_image。

**适用场景：**
- 生成一组游戏 UI 图标，例如金币、宝石、爱心、星星等。
- 创建多个角色精灵或角色变体。
- 批量生成贴图或背景。
- 任何需要一次产出多张图片的场景。

**相比多次调用 generate_image 的优势：**
- 所有图片并行生成，总等待时间明显更短。
- 只需要一次工具调用，而不是多次往返。
- 返回结果集中汇总。

批量中的每一张图都支持和 generate_image 相同的参数，例如 prompt、name、aspect_ratio、transparent、target_size、reference_image。详细参数请参考 generate_image 的说明。

**输入示例：**
\`\`\`json
{
  "images": [
    { "prompt": "金币图标，像素风格", "name": "金币", "target_size": "128x128" },
    { "prompt": "红色宝石图标，像素风格", "name": "宝石", "target_size": "128x128" },
    { "prompt": "红色爱心图标，像素风格", "name": "爱心", "target_size": "128x128" }
  ]
}
\`\`\`

**Maker 资产工作流提示：**
在已绑定 Maker 项目中，应优先使用该 Maker MCP 代理工具生成项目资产。成功结果会下载到 Maker 项目，并记录远程映射，便于后续编辑或视频引用。大体积本地文件或 data URL 可能较慢或失败：图片输入通常约 10 MB，视频任务图片输入约 30 MB，视频约 50 MB，音频约 15 MB。若该 Maker 代理工具失败或返回 isError，应保留完整 remote_result/error payload 以便开发者排查。`
  },
  edit_image: {
    title: "图片编辑",
    summary: "对已有图片做风格、背景、内容等编辑，并保存为新资产。",
    details: "以已有图片为基础，根据文本指令进行修改。适合换背景、统一风格、补充元素、局部重绘和生成同风格版本。",
    translatedDescription: `根据文本指令编辑或修改已有图片。

该工具使用 AI 按照提示词对图片进行编辑。

**用法：**
- 提供本地图片路径，相对于 workspace，或远程 http/https 图片 URL。
- 描述需要对图片做什么修改。

**示例：**
- “把背景改成蓝色”
- “添加一个太阳”
- “去除水印”
- “把图片风格改成卡通”

**图片尺寸的工作方式（两步处理）：**
1. AI 会先根据 aspect_ratio 生成固定比例的图片。
2. 然后再缩放到 target_size 指定的最终尺寸，该参数必填。

**第 1 步：选择 aspect_ratio（决定画面形状）：**
- 1:1：1024×1024，图标、头像、方形素材，默认。
- 2:3：832×1248，竖版海报、角色插画。
- 3:2：1248×832，横向场景、风景图。
- 3:4：864×1184，竖版卡片、手机壁纸。
- 4:3：1184×864，传统横版图、PPT 图片。
- 9:16：768×1344，竖屏全屏、短视频封面。
- 16:9：1344×768，宽屏、游戏场景、视频封面。
- 21:9：1536×672，超宽电影画幅。
- 5:4：1152×896，近似方形的横图。
- 4:5：896×1152，近似方形的竖图、社交媒体图片。

**第 2 步：指定 target_size（决定最终像素尺寸）：**
常见游戏资产尺寸，建议使用 2 的幂：
- 图标：64x64、128x128、256x256。
- UI 元素：256x256、512x512。
- 角色精灵：256x512、512x1024。

示例：aspect_ratio="1:1" + target_size="256x256" 会得到 256×256 的游戏图标。

**透明背景检测：**
系统会根据关键词自动判断是否需要透明背景：
- 透明
- 透明背景
- 抠图
- 无背景

**参考图（保持风格或角色一致）：**
可额外提供最多 13 张参考图。原始图片本身算 1 张，因此总数最多 14 张。
每一项可以是相对 workspace root 的文件路径、远程 http/https 图片 URL，或 base64 data URL。

**高级选项：**
- seed：整数种子，用于复现结果，例如 42。
- thinking_level：minimal 更快，high 对复杂编辑质量更好。
- resolution：生成分辨率，支持 0.5K、1K、2K、4K，默认 1K。

**命名规则：**
编辑后的文件保存为 edited_{name}_{timestamp}.png。

**Maker 资产工作流提示：**
在已绑定 Maker 项目中，应优先使用该 Maker MCP 代理工具进行图片编辑。大体积本地文件或 data URL 可能较慢或失败：图片输入通常约 10 MB，视频任务图片输入约 30 MB，视频约 50 MB，音频约 15 MB。若该 Maker 代理工具失败或返回 isError，应保留完整 remote_result/error payload 以便开发者排查。`
  },
  create_video_task: {
    title: "视频生成任务",
    summary: "创建文生视频、首帧、首尾帧或多模态参考视频生成任务。",
    details: "支持纯文本生视频、首帧生成视频、首帧加尾帧生成视频、多模态参考画布。可配置模型档位、比例、分辨率、时长、是否生成音频和随机种子。",
    translatedDescription: `创建视频生成任务，并同步等待最终结果，常规情况下不需要客户端自己轮询。

mode 参数必填，且必须是 4 种互斥模式之一：
- text_to_video：纯文本生视频。
- first_frame：使用 1 张图片作为首帧。
- first_last_frame：使用 2 张图片，分别作为首帧和尾帧。
- multi_modal_reference：使用 1 到 9 张参考图片，并可选加入视频或音频参考。

常规情况下，任务会在约 50 分钟以内完成，并返回最终查询结果，其中包含 workspace_video_path、workspace_last_frame_path 和可展示的媒体链接。优先展示 workspace 路径和元数据；只有用户需要外部分享链接时才展示 CDN URL。

如果服务端等待时间内任务仍未完成，该工具会返回仍处于 pending/running 的 task_id，并带有 agent_instruction，提示后续使用 query_video_task 查询，查询间隔不要短于 120 秒。

**Maker 资产工作流提示：**
应优先使用该 Maker MCP 代理工具进行 Maker 视频生成。图片、视频和音频参考可以使用远程 URL、已有 data URL，或本地代理可解析的本地文件。本地文件和 data URL 体积较大时可能较慢或失败：图片输入通常约 10 MB，视频任务图片输入约 30 MB，视频约 50 MB，音频约 15 MB。若该 Maker 代理工具失败或返回 isError，应保留完整 remote_result/error payload 以便开发者排查。`
  },
  query_video_task: {
    title: "查询视频任务",
    summary: "查询云端视频任务状态，刷新并发占用和生成结果。",
    details: "用于查询已有视频任务的状态和结果，也用于释放云端视频任务并发占用。并发超限时优先用它查询旧任务。",
    translatedDescription: `查询视频生成任务状态并获取最终结果。

如果任务仍然是 pending 或 running，应先继续处理其他工作，至少等待 120 秒后再查询，不要连续轮询。

任务成功后，应展示视频时长、分辨率、比例、本地 workspace 视频路径 workspace_video_path，以及尾帧是否可用。工具输出中若包含可展示媒体链接，可以用于界面展示；只有用户需要外部分享链接时才展示 CDN URL。

**Maker 资产工作流提示：**
应优先使用该 Maker MCP 代理工具刷新视频任务状态、释放已完成任务额度，并把成功的视频结果落到 Maker 项目中。当 create_video_task 返回 task_id 或报告视频并发限制时，也应使用该工具刷新任务状态。若该 Maker 代理工具失败或返回 isError，应保留完整 remote_result/error payload 以便开发者排查。`
  },
  text_to_music: {
    title: "音乐生成",
    summary: "生成游戏背景音乐或歌曲音轨，不用于短音效。",
    details: "用于生成背景音乐、主题音乐或带歌词音轨。支持简单模式和自定义模式，可配置风格、标题、是否纯音乐、排除标签和人声音色。",
    translatedDescription: `使用 AI 生成音乐。适用于用户想为游戏创建背景音乐或人声音轨的场景。

注意：该工具不适合生成短音效，请不要用于音效生成。

**重要行为：**
该工具会每 20 秒自动查询任务状态直到完成，最长等待 50 分钟。如果任务耗时更长，会超时并返回 task_id，此时需要使用 query_music_task 手动查询状态。

生成成功时会返回音频 URL 和元数据。

**两种模式：**
- 简单模式（默认）：只需要提供 prompt 描述想要的音乐，最多 500 字符。例如 upbeat electronic game menu music。
- 自定义模式（customMode=true）：提供更细的控制，包括 style、title 和是否纯音乐。该模式必须提供 style 和 title。

**Maker 资产工作流提示：**
应优先使用该 Maker MCP 代理工具进行 Maker 音乐生成，使生成音频可以落到项目中，并记录下来供后续 Maker 引用。若该 Maker 代理工具失败或返回 isError，应保留完整 remote_result/error payload 以便开发者排查。`
  },
  create_3d_model_task: {
    title: "3D 模型生成任务",
    summary: "通过文本、单图或多视图创建 3D 模型生成任务。",
    details: "支持文生模型、图生模型和多视图生成模型。可配置主体类型、面数限制、贴图质量、骨骼绑定、模型种子、贴图种子和四视图确认路径。",
    translatedDescription: `创建异步 3D 模型生成任务。支持三种模式：

- text_to_model：交互式两阶段流程。
  第一阶段：不传 confirmed_image_paths。系统会先根据提示词生成正面图，再用 AI 生成 front、left、back、right 四视图，保存到 assets/image/，并返回路径供用户检查。用户明确确认前不要继续。
  第二阶段：用户确认后，再次调用该工具，并传入第一阶段返回路径组成的 confirmed_image_paths。系统随后提交确认过的图片创建 3D 模型任务。

- image_to_model：交互式两阶段流程。注意：输入图片必须是主体的正面 0° 视图。
  第一阶段：传入正面图，但不传 confirmed_image_paths。系统会根据该图生成 front、left、back、right 四视图，保存到 assets/image/，并返回路径供用户检查。用户明确确认前不要继续。
  第二阶段：用户确认后，传入 confirmed_image_paths，系统再提交确认过的图片创建 3D 模型任务。

- multiview_to_model：直接使用开发者提供的多视图图片生成模型，front 必填，back、left、right 可选。

可设置 rig=true 自动对双足骨骼角色应用骨骼绑定 FBX，仅支持 A-Pose 人形角色。第二阶段或多视图提交时，服务端会同步等待任务完全完成，包含模型生成和可选骨骼绑定，通常约 5 到 25 分钟，并返回 workspace_model_path、model_cdn_url 等最终结果。若服务端等待预算约 40 分钟耗尽，会返回 task_id 和 agent_instruction，提示后续使用 query_3d_model_task 查询，查询间隔不要短于 30 秒。`
  },
  query_3d_model_task: {
    title: "查询 3D 模型任务",
    summary: "查询 3D 模型生成、预览、下载和绑定状态。",
    details: "用于刷新 3D 模型任务状态，获取模型文件、预览图、下载结果和绑定流程状态。长任务应通过它继续查询。",
    translatedDescription: `查询 3D 模型生成任务。

如果状态是 queued 或 running，至少等待 30 秒后再查询，不要连续轮询。

当状态为 success 时，workspace_model_path 是本地保存的模型文件，应展示给用户；rendered_image_url 是预览图，若存在也应展示；download_error 表示文件无法保存到本地。

如果创建任务时设置了 rig=true，模型生成成功后会自动触发骨骼绑定任务。继续用同一个 task_id 查询，返回结果会透明展示绑定状态。不要向用户暴露内部实现细节。`
  },
  maker_build_current_directory: {
    title: "构建当前项目",
    summary: "通过 Maker MCP 提交当前项目并触发远端构建。",
    details: "通过 Maker MCP 对当前项目执行同步、提交和构建流程。适合构建中心使用，不替代 TapTap 官方后台。",
    translatedDescription: `同步并构建当前 Maker 游戏。适用于用户在 Maker 项目中提出“构建”、“build”、“跑一下”、“预览”、“验证一下”、“提交”、“提交代码”、“推送”或“push”等请求。

在 Maker 项目中，应忽略通用本地 Git 技能，遵循 taptap-maker-local 的 Maker Git Workflow Policy。构建前，应读取 maker://status 或 maker_status_lite，并检查 Python 环境和 Lua LSP 环境。如果缺少 Python 或 maker-lua-lsp，且需要本地 Lua 诊断，应运行 taptap-maker python setup，因为它会准备 Python 并尽力安装 maker-lua-lsp。缺少 Python 或 Lua LSP 不应阻塞远端构建流程。

不要创建分支，不要使用通用 git commit/push，不要为 Maker 项目的提交或构建请求创建 PR/MR。

创建 commit 前，该工具会检查 Maker 远端同步状态。如果本地 main 落后、分叉、不在 main，或无法验证远端同步，会在 commit/push 前停止并返回恢复信息。

正常构建请求中，该工具总是在远端 Maker 构建前先 push：有本地改动时提交并 push，有未推送提交时 push，工作区干净时创建空的唤醒提交。Maker 生成的 .gitignore 属于必要项目文件，即使 files 选择较小变更集也会提交。

如果 push 失败，不会启动构建，并会返回恢复详情供本地 Agent 处理合并或冲突。如果 push 成功但远端构建失败，应说明代码已经在 Maker 远端，并附上构建失败详情。

构建成功后，会启动本地运行时日志 watcher。需要诊断玩法或运行时问题时读取 runtime_logs.local_file；需要检查 watcher 健康状态时读取 runtime_logs.state_file。

只有用户明确说不提交本地改动、只想构建当前远端版本时，才设置 confirm_remote_build_without_submit=true。在这种模式下，应先打开返回的 maker_page_url/maker_url，让用户查看远端 Maker 项目并帮助唤醒服务器。`
  }
};

const categoryLabels: Record<string, string> = {
  status: "状态",
  image: "图片",
  video: "视频",
  music: "音频",
  model3d: "3D",
  build: "构建",
  other: "其他"
};

export function getToolDisplay(tool: ToolSummary): ToolDisplay {
  return toolDisplays[tool.name] ?? {
    title: tool.name,
    summary: tool.description ? "来自真实 tools/list 的 MCP 工具，详情页保留原始描述和输入 Schema。" : "来自真实 tools/list 的 MCP 工具，详情页可查看输入 Schema。",
    details: tool.description ? "该工具来自真实 tools/list，目前没有内置中文说明；原始 MCP 描述仍可在详情页查看。" : "该工具来自真实 tools/list，目前没有内置中文说明；请参考输入 Schema。",
    translatedDescription: "该工具来自真实 tools/list，目前没有内置中文说明；请切换到原始描述查看 MCP 返回的原文。"
  };
}

export function getToolCategoryLabel(category: string) {
  return categoryLabels[category] ?? category;
}
