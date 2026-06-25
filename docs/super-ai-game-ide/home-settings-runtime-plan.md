# Home, Settings, Runtime, And Inspector Plan

## 1. Direction

The settings page should become a real settings center. Runtime and binding status should live primarily in the right Inspector and only expand when needed.

The homepage should manage projects clearly. It should not become another debug panel.

## 2. Current Repo State

Project discovery:

- local discovery scans `config.makerProjectsRoot`;
- project must have `.maker-mcp/config.json`;
- exact field `project_id` is required.

Project records include:

- `id`;
- `name`;
- `rootPath`;
- `makerProjectId`;
- `configPath`;
- `createdAt`;
- `updatedAt`;
- `runtime`;
- `selected`.

Config and runtime inputs include:

- `TAPTAP_SERVER_PORT`;
- `TAPTAP_DATA_DIR`;
- `TAPTAP_MAKER_NPM_CACHE_DIR`;
- `TAPTAP_MCP_LOG_DIR`;
- `TAPTAP_MAKER_PROJECTS_ROOT`;
- `TAPTAP_MAKER_PACKAGE`;
- `TAPTAP_MCP_ENV`.

Runtime startup:

- Fastify server starts project-bound MCP runtime.
- Runtime launches `taptap-maker` through the configured Maker package.
- MCP stderr is written to `config.mcpLogDir`.

Existing readiness endpoint:

- `/api/desktop/readiness`.

Right Inspector already has:

- `status`;
- `tools`;
- `logs`;
- `errors`.

## 3. Homepage P0

Project cards should show:

- project name;
- `rootPath`;
- `makerProjectId`;
- `.maker-mcp/config.json` presence;
- selected state;
- runtime status;
- tools count;
- last scan time;
- last open time if recorded.

Homepage actions:

- scan local projects;
- manually bind local project directory;
- open project folder;
- remove project record from list;
- open settings;
- open runtime diagnostics through Inspector.

Do not add cloud pull or restore buttons until a real Maker MCP tool schema proves those operations exist.

## 4. Project Removal And Deletion

Separate two actions.

### Remove Project Record

Label:

```text
从首页列表移除项目记录
```

Meaning:

- remove workbench database record and local workbench index data;
- do not delete `rootPath`;
- do not delete Maker project files.

Confirm dialog evidence:

- project name;
- `rootPath`;
- `makerProjectId`;
- `configPath`.

Button:

```text
移除记录
```

### Delete Local Project Folder

This is destructive and should not be the default action from project cards.

Required evidence:

- resolved absolute path;
- project name;
- `makerProjectId`;
- directory size;
- file count;
- whether the path is inside `makerProjectsRoot`.

Confirmation:

- user must type project name or full `makerProjectId`;
- user must check a confirmation box.

Button:

```text
删除本地项目文件夹
```

## 5. Settings P0

Settings should show structured configuration:

- app data directory;
- database path;
- workspace root;
- web dist directory;
- maker projects root;
- MCP log directory;
- Maker npm cache directory;
- `TAPTAP_MCP_ENV`;
- `TAPTAP_MAKER_PACKAGE`;
- server host and port;
- current selected project;
- runtime command summary;
- current tools/list time.

MCP actions:

- start runtime;
- stop runtime;
- restart runtime;
- refresh `tools/list`;
- open MCP stderr log directory;
- copy diagnostics JSON.

Settings must not be dominated by a giant runtime status card. Runtime status belongs in Inspector.

## 6. Right Inspector Policy

Default behavior:

- homepage: collapsed;
- settings: collapsed;
- normal project workbench: open `status`;
- focused canvas: collapse left and right sidebars;
- new failed task: open and switch to `errors`;
- user manual collapse: respect it until explicit error or user action.

For full canvas:

- entering `studio-canvas` can collapse sidebars;
- clicking a node detail opens Inspector;
- clicking logs/errors opens matching tab;
- leaving canvas should not force sidebars back open.

## 7. P1

Homepage:

- sorting by selected, recent, runtime issue, scan time;
- search and filter;
- project icon from verified project config or known resource table only;
- project grouping and favorites.

Settings:

- tabs:
  - General;
  - Projects;
  - MCP Runtime;
  - Logs;
  - Developer.
- config health check:
  - root exists;
  - `.maker-mcp/config.json` parses;
  - `project_id` matches database record;
  - runtime package/env visible;
  - `tools/list` snapshot freshness.

## 8. P2

- Startup preference:
  - open last project;
  - open homepage;
  - ask every time.
- Theme and density settings.
- Notification settings.
- log retention settings.
- Developer tools toggle.

