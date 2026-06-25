# TapTap Maker Plus Productization Graph

Date: 2026-06-23
Workspace: `G:\TapTap_Maker\MCP`

This graph records the intended product architecture and productization path.

## 1. Runtime Architecture

```mermaid
flowchart LR
  User["User"]
  UI["Workbench UI<br/>React + Vite"]
  API["Fastify Local Server"]
  Runtime["Project MCP Runtime<br/>one runtime per selected project"]
  MakerMCP["@taptap/maker<br/>stdio MCP server"]
  Project["Selected TapTap Maker Project"]
  DB["SQLite<br/>tools, tasks, generations, workflows"]
  Assets["Project assets<br/>images, video, audio, model packages"]
  Logs["Maker logs<br/>runtime/build diagnostics"]

  User --> UI
  UI --> API
  API --> Runtime
  Runtime --> MakerMCP
  MakerMCP --> Project
  API --> DB
  API --> Assets
  API --> Logs
```

## 2. Workbench Areas

```mermaid
flowchart TB
  Shell["App Shell"]
  Top["Top Bar"]
  Left["Project Sidebar"]
  Center["Workbench Viewport"]
  Right["Inspector / MCP / Logs / Errors"]
  ErrorPanel["Error Panel<br/>only when needed"]

  Shell --> Top
  Shell --> Left
  Shell --> Center
  Shell --> Right
  Shell --> ErrorPanel

  Center --> Workspace["Workspace"]
  Center --> AssetHub["Asset Hub"]
  Center --> Studio["Generation Studios"]
  Center --> Workflow["Workflow Canvas"]
  Center --> Runs["Runs"]
  Center --> Settings["Settings"]
```

## 3. Capability Center

```mermaid
flowchart LR
  ToolsList["Persisted tools/list"]
  ToolDisplay["Chinese + original tool display"]
  Schema["Real input schema"]
  Form["Schema-driven form"]
  Call["Project-level tools/call"]
  Task["Task record<br/>input + raw result + error"]
  Generation["Generation record<br/>only explicit generation tools"]
  AssetIndex["Asset scan / provenance"]

  ToolsList --> ToolDisplay
  ToolsList --> Schema
  Schema --> Form
  Form --> Call
  Call --> Task
  Task --> Generation
  Generation --> AssetIndex
```

## 4. Asset Governance

```mermaid
flowchart TB
  AssetManager["Ordinary Asset Manager"]
  Image["assets/image"]
  Video["assets/video"]
  Audio["assets/audio"]
  Other["assets/*"]

  ModelGov["3D Model Package Governance"]
  Source["Source files<br/>GLB / GBM"]
  RuntimeMdl["Runtime MDL"]
  Material["Materials / Textures"]
  ResourceTable[".project/resources.json"]
  ProjectRefs["Literal references<br/>Lua / flow json"]

  AssetManager --> Image
  AssetManager --> Video
  AssetManager --> Audio
  AssetManager --> Other

  ModelGov --> Source
  ModelGov --> RuntimeMdl
  ModelGov --> Material
  ModelGov --> ResourceTable
  ModelGov --> ProjectRefs
```

## 5. Productization Roadmap

```mermaid
flowchart LR
  R1["Round 1<br/>safety + docs + scanner"]
  R2["Round 2<br/>shared execution + safer assets + static serving"]
  Desktop["Desktop shell<br/>Tauri after package inspection"]
  Agent["Embedded assistant<br/>Mastra after package inspection"]
  Release["Productized Maker++ app"]

  R1 --> R2
  R2 --> Desktop
  R2 --> Agent
  Desktop --> Release
  Agent --> Release
```

## 6. Guardrails

- Browser calls local Fastify only.
- Fastify owns MCP runtime processes.
- Each project owns its own MCP runtime and cwd.
- MCP calls use real tool names and real schemas.
- Asset operations use project-relative paths and backend path safety.
- Agent features must go through existing server APIs and require human confirmation for tool calls or filesystem mutations.
- Desktop shell wraps the existing Web + Fastify kernel first; it does not rewrite the architecture.
