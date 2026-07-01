use std::{
  fs,
  fs::OpenOptions,
  io::{Read, Write},
  net::{TcpListener, TcpStream, ToSocketAddrs},
  path::{Path, PathBuf},
  process::{Child, Command, Stdio},
  sync::{Arc, Mutex},
  sync::OnceLock,
  thread,
  time::{Duration, SystemTime, UNIX_EPOCH},
};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

use tauri::{
  Emitter, LogicalSize, Manager, PhysicalPosition, PhysicalSize, RunEvent, Url, WebviewWindow,
  WebviewWindowBuilder, WindowEvent,
};
use tauri::webview::PageLoadEvent;

const SERVER_HOST: &str = "127.0.0.1";
const SERVER_PORT_NUMBER: u16 = 8787;
const SERVER_PORT_SCAN_LIMIT: u16 = 40;
const DEV_WEB_PORT_NUMBER: u16 = 5173;
const DEV_WEB_URL: &str = "http://127.0.0.1:5173";
const SERVER_READY_MAX_ATTEMPTS: u32 = 120;
const APP_ID: &str = "taptap-maker-plus";
const READINESS_TOKEN_QUERY_PREFIX: &str = "/api/desktop/readiness?token=";
const READINESS_APP_ID: &str = r#""appId":"taptap-maker-plus""#;
const READINESS_TOKEN_KEY: &str = r#""desktopInstanceToken":""#;
const WEB_IDENTITY_NAME: &str = r#"name="taptap-maker-plus""#;
const WEB_IDENTITY_CONTENT: &str = r#"content="web""#;
const MIN_WINDOW_LOGICAL_WIDTH: f64 = 1366.0;
const MIN_WINDOW_LOGICAL_HEIGHT: f64 = 768.0;
const APP_PACKAGE_VERSION: &str = env!("CARGO_PKG_VERSION");
const SETTINGS_FILE_NAME: &str = "settings.json";
const MAKER_LOGIN_WEBVIEW_LABEL: &str = "maker-login";
const MAKER_PREVIEW_WEBVIEW_LABEL: &str = "maker-preview";
const MAKER_PREVIEW_LOAD_EVENT: &str = "taptap:maker-preview-load";
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;
static APP_DATA_DIR: OnceLock<PathBuf> = OnceLock::new();

const MAKER_PREVIEW_INIT_SCRIPT: &str = r##"
(() => {
  if (window.__TAPTAP_MAKER_PREVIEW_ISOLATOR__) return;
  window.__TAPTAP_MAKER_PREVIEW_ISOLATOR__ = true;

  const state = { isolated: false, previewRequested: false };
  window.__TAPTAP_MAKER_PREVIEW_READY__ = false;

  function isProjectPage() {
    return location.hostname === "maker.taptap.cn" && location.pathname.startsWith("/app/");
  }

  function isGamePage() {
    return location.hostname.endsWith("games.tapapps.cn");
  }

  function findGameIframe() {
    return document.querySelector('iframe[src*="games.tapapps.cn"]') ||
      document.querySelector('iframe[src*=".games.tapapps.cn"]') ||
      document.querySelector('iframe[src*="tapapps.cn"]');
  }

  function applyFullscreenStyle(element, zIndex) {
    element.style.position = "fixed";
    element.style.inset = "0";
    element.style.width = "100vw";
    element.style.height = "100vh";
    element.style.minWidth = "100vw";
    element.style.minHeight = "100vh";
    element.style.maxWidth = "100vw";
    element.style.maxHeight = "100vh";
    element.style.margin = "0";
    element.style.padding = "0";
    element.style.border = "0";
    element.style.overflow = "hidden";
    element.style.transform = "none";
    element.style.background = "#111214";
    if (zIndex) element.style.zIndex = String(zIndex);
  }

  function hideMakerChrome(iframe) {
    for (const child of Array.from(document.body.children)) {
      if (child === iframe) continue;
      if (child.tagName === "SCRIPT" || child.tagName === "STYLE") continue;
      child.style.setProperty("display", "none", "important");
      child.style.setProperty("visibility", "hidden", "important");
    }
  }

  function hideProjectShell() {
    if (!document.body) return;
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.margin = "0";
    document.documentElement.style.padding = "0";
    document.documentElement.style.background = "#111214";
    document.documentElement.style.width = "100vw";
    document.documentElement.style.height = "100vh";
    document.body.style.overflow = "hidden";
    document.body.style.margin = "0";
    document.body.style.padding = "0";
    document.body.style.background = "#111214";
    document.body.style.width = "100vw";
    document.body.style.height = "100vh";
    for (const child of Array.from(document.body.children)) {
      if (child.tagName === "SCRIPT" || child.tagName === "STYLE") continue;
      if (child.getAttribute("data-taptap-maker-preview") === "active") continue;
      child.style.setProperty("display", "none", "important");
      child.style.setProperty("visibility", "hidden", "important");
    }
  }

  function mountIframeFullscreen(iframe) {
    if (iframe.parentElement !== document.body) {
      document.body.appendChild(iframe);
    }
    iframe.setAttribute("data-taptap-maker-preview", "active");
    applyFullscreenStyle(iframe, 2147483647);
    iframe.style.setProperty("display", "block", "important");
    iframe.style.setProperty("visibility", "visible", "important");
    iframe.style.setProperty("object-fit", "fill", "important");
    hideMakerChrome(iframe);
    window.__TAPTAP_MAKER_PREVIEW_READY__ = true;
  }

  function isolateIframeAncestors(iframe) {
    const previewRoot =
      iframe.closest(".flex-1.min-h-0.relative") ||
      iframe.closest(".absolute.top-0.right-0.bottom-0.left-0.overflow-auto") ||
      iframe.parentElement;
    if (previewRoot) {
      applyFullscreenStyle(previewRoot, 2147483645);
    }

    let current = iframe.parentElement;
    while (current && current !== document.body && current !== document.documentElement) {
      current.style.width = "100vw";
      current.style.height = "100vh";
      current.style.minWidth = "100vw";
      current.style.minHeight = "100vh";
      current.style.maxWidth = "100vw";
      current.style.maxHeight = "100vh";
      current.style.margin = "0";
      current.style.padding = "0";
      current.style.overflow = "hidden";
      current.style.background = "#111214";
      if (current === previewRoot) break;
      current = current.parentElement;
    }
  }

  function isolateGamePage() {
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.margin = "0";
    document.documentElement.style.padding = "0";
    document.documentElement.style.background = "#111214";
    document.documentElement.style.width = "100vw";
    document.documentElement.style.height = "100vh";
    document.body.style.overflow = "hidden";
    document.body.style.margin = "0";
    document.body.style.padding = "0";
    document.body.style.background = "#111214";
    document.body.style.width = "100vw";
    document.body.style.height = "100vh";

    const root = document.getElementById("root") || document.querySelector("#app") || document.body.firstElementChild;
    if (root) applyFullscreenStyle(root, 2147483645);

    for (const element of document.querySelectorAll("canvas, video, iframe")) {
      applyFullscreenStyle(element, 2147483647);
      element.style.display = "block";
      element.style.objectFit = "fill";
    }

    state.isolated = true;
    window.__TAPTAP_MAKER_PREVIEW_READY__ = true;
    return true;
  }

  function controlName(element) {
    return [
      element.getAttribute("aria-label"),
      element.getAttribute("title"),
      element.textContent
    ].filter(Boolean).join(" ").trim();
  }

  function requestPreviewTab() {
    if (state.previewRequested) return;
    const controls = Array.from(document.querySelectorAll('button, a, [role="button"], [role="tab"]'));
    const previewControl = controls.find((element) => controlName(element) === "预览");
    if (!previewControl) return;
    state.previewRequested = true;
    previewControl.click();
  }

  function isolatePreview() {
    if (isGamePage()) {
      return isolateGamePage();
    }

    if (!isProjectPage()) {
      state.isolated = false;
      window.__TAPTAP_MAKER_PREVIEW_READY__ = false;
      return false;
    }

    const iframe = findGameIframe();
    if (!iframe) {
      state.isolated = false;
      requestPreviewTab();
      window.__TAPTAP_MAKER_PREVIEW_READY__ = false;
      return false;
    }

    hideProjectShell();

    isolateIframeAncestors(iframe);
    mountIframeFullscreen(iframe);

    state.isolated = true;
    return true;
  }

  function schedule() {
    window.requestAnimationFrame(() => isolatePreview());
  }

  schedule();
  window.addEventListener("DOMContentLoaded", schedule, { once: false });
  window.addEventListener("load", schedule, { once: false });
  window.addEventListener("resize", schedule);
  window.setInterval(schedule, 500);

  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src", "class", "style"]
  });
})();
"##;

#[derive(serde::Serialize, serde::Deserialize)]
struct SettingsPreferencesFile {
  #[serde(default)]
  preferences: serde_json::Map<String, serde_json::Value>,
  #[serde(rename = "updatedAt", skip_serializing_if = "Option::is_none")]
  updated_at: Option<String>,
}

#[derive(serde::Serialize)]
struct SettingsPreferencesFileResponse {
  preferences: serde_json::Map<String, serde_json::Value>,
  #[serde(rename = "updatedAt", skip_serializing_if = "Option::is_none")]
  updated_at: Option<String>,
  path: String,
  exists: bool,
}

#[derive(Clone, Default)]
struct MakerPreviewState {
  webview: Arc<Mutex<Option<WebviewWindow>>>,
  project_id: Arc<Mutex<Option<String>>>,
  loading: Arc<Mutex<bool>>,
}
struct LocalPortProbe {
  host: &'static str,
  port: u16,
}

struct DesktopServerLaunch {
  port: u16,
  instance_token: String,
}

struct StartupResourceReport {
  ok: bool,
  missing: Vec<PathBuf>,
}

#[derive(Clone, Default)]
struct DesktopServer {
  child: Arc<Mutex<Option<Child>>>,
  launch: Arc<Mutex<Option<DesktopServerLaunch>>>,
}

impl DesktopServer {
  fn start(&self, app: &tauri::AppHandle) -> Result<(), String> {
    if self.child.lock().map_err(|error| error.to_string())?.is_some() {
      return Ok(());
    }

    let app_data_dir = app.path().app_data_dir().map_err(|error| error.to_string())?;
    let npm_cache_dir = app_data_dir.join("npm-cache");
    let mcp_log_dir = app_data_dir.join("mcp-logs");
    let desktop_log_path = app_data_dir.join("desktop.log");
    let server_log_path = app_data_dir.join("server.log");
    fs::create_dir_all(&npm_cache_dir).map_err(|error| error.to_string())?;
    fs::create_dir_all(&mcp_log_dir).map_err(|error| error.to_string())?;

    let workspace_root = normalize_windows_path(workspace_root(app)?);
    append_log(&desktop_log_path, &format!("starting Fastify from {}", workspace_root.display()));
    append_log(&desktop_log_path, &format!("server log {}", server_log_path.display()));
    let resource_report = check_startup_resources(&workspace_root);
    if !resource_report.ok {
      for missing_path in &resource_report.missing {
        append_log(&desktop_log_path, &format!("missing startup resource: {}", missing_path.display()));
      }
      return Err(format_missing_startup_resources(&resource_report.missing));
    }
    seed_maker_npm_cache(&workspace_root, &npm_cache_dir, &desktop_log_path);
    let server_port = find_available_local_port(SERVER_HOST, SERVER_PORT_NUMBER, SERVER_PORT_SCAN_LIMIT)
      .ok_or_else(|| format!("Unable to find available local port from {SERVER_PORT_NUMBER}"))?;
    let instance_token = make_desktop_instance_token();
    append_log(&desktop_log_path, &format!("Fastify target port {server_port}"));
    let mut command = server_command(&workspace_root);
    let node_runtime_dir = workspace_root.join("node-runtime");
    let server_stdout = OpenOptions::new()
      .create(true)
      .append(true)
      .open(&server_log_path)
      .map_err(|error| error.to_string())?;
    let server_stderr = server_stdout.try_clone().map_err(|error| error.to_string())?;
    command
      .current_dir(&workspace_root)
      .env("NODE_ENV", if cfg!(debug_assertions) { "development" } else { "production" })
      .env("TAPTAP_WORKSPACE_ROOT", &workspace_root)
      .env("TAPTAP_WEB_DIST_DIR", workspace_root.join("apps").join("web").join("dist"))
      .env("TAPTAP_MAKER_PROJECTS_ROOT", maker_projects_root())
      .env("TAPTAP_DESKTOP_PARENT_PID", std::process::id().to_string())
      .env("TAPTAP_DATA_DIR", &app_data_dir)
      .env("TAPTAP_MAKER_NPM_CACHE_DIR", &npm_cache_dir)
      .env("TAPTAP_MCP_LOG_DIR", &mcp_log_dir)
      .env("TAPTAP_SERVER_HOST", SERVER_HOST)
      .env("TAPTAP_SERVER_PORT", server_port.to_string())
      .env("TAPTAP_DESKTOP_INSTANCE_TOKEN", &instance_token)
      .env("TAPTAP_MCP_ENV", "production")
      .stdin(Stdio::null())
      .stdout(Stdio::from(server_stdout))
      .stderr(Stdio::from(server_stderr));
    if node_runtime_is_usable(&node_runtime_dir) {
      command.env("TAPTAP_NODE_RUNTIME_DIR", &node_runtime_dir);
    }

    let child = command.spawn().map_err(|error| error.to_string())?;
    append_log(&desktop_log_path, &format!("Fastify child pid {}", child.id()));
    *self.child.lock().map_err(|error| error.to_string())? = Some(child);
    *self.launch.lock().map_err(|error| error.to_string())? = Some(DesktopServerLaunch {
      port: server_port,
      instance_token,
    });
    Ok(())
  }

  fn launch(&self) -> Result<DesktopServerLaunch, String> {
    let launch = self.launch.lock().map_err(|error| error.to_string())?;
    let Some(launch) = launch.as_ref() else {
      return Err("Desktop server has not been launched".to_string());
    };
    Ok(DesktopServerLaunch {
      port: launch.port,
      instance_token: launch.instance_token.clone(),
    })
  }

  fn stop(&self) {
    let Ok(mut child) = self.child.lock() else {
      return;
    };
    if let Some(mut child) = child.take() {
      terminate_child_process_tree(&mut child);
    }
    if let Ok(mut launch) = self.launch.lock() {
      *launch = None;
    }
  }
}

fn terminate_child_process_tree(child: &mut Child) {
  #[cfg(windows)]
  {
    let status = Command::new("taskkill.exe")
      .args(["/PID", &child.id().to_string(), "/T", "/F"])
      .stdin(Stdio::null())
      .stdout(Stdio::null())
      .stderr(Stdio::null())
      .creation_flags(CREATE_NO_WINDOW)
      .status();
    if status.as_ref().map(|item| item.success()).unwrap_or(false) {
      let _ = child.wait();
      return;
    }
  }

  let _ = child.kill();
  let _ = child.wait();
}

fn append_log(log_path: &Path, message: &str) {
  if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(log_path) {
    let _ = writeln!(file, "{message}");
  }
}

fn append_desktop_event_log(app_handle: &tauri::AppHandle, message: &str) {
  if let Ok(app_data_dir) = app_handle.path().app_data_dir() {
    append_log(&app_data_dir.join("desktop.log"), message);
  }
}

fn safe_url_for_log(url: &Url) -> String {
  let mut output = format!("{}://{}", url.scheme(), url.host_str().unwrap_or(""));
  if let Some(port) = url.port() {
    output.push_str(&format!(":{port}"));
  }
  output.push_str(url.path());
  if url.query().is_some() {
    output.push_str("?<redacted>");
  }
  if url.fragment().is_some() {
    output.push_str("#<redacted>");
  }
  output
}

fn show_loading_error(app: &tauri::AppHandle, detail: &str) {
  let Some(window) = app.get_webview_window("main") else {
    return;
  };
  let escaped_detail = serde_json::to_string(detail).unwrap_or_else(|_| "\"Desktop startup failed\"".to_string());
  thread::spawn(move || {
    for _ in 0..8 {
      let script = format!(
        "window.__TAPTAP_DESKTOP_LOADING_ERROR__ && window.__TAPTAP_DESKTOP_LOADING_ERROR__({escaped_detail});"
      );
      let _ = window.eval(script);
      thread::sleep(Duration::from_millis(500));
    }
  });
}

fn check_startup_resources(workspace_root: &Path) -> StartupResourceReport {
  let mut missing = Vec::new();
  let required_files = [
    workspace_root.join("apps").join("server").join("dist").join("index.js"),
    workspace_root.join("apps").join("web").join("dist").join("index.html"),
    workspace_root.join("node_modules").join("better-sqlite3").join("build").join("Release").join("better_sqlite3.node"),
  ];
  for file_path in required_files {
    if !file_path.is_file() {
      missing.push(file_path);
    }
  }

  if cfg!(not(debug_assertions)) {
    let node_name = if cfg!(windows) { "node.exe" } else { "node" };
    let required_release_files = [
      workspace_root.join("desktop-runtime-manifest.json"),
      workspace_root.join("node-runtime").join(node_name),
      workspace_root.join("node-runtime").join(if cfg!(windows) { "npm.cmd" } else { "npm" }),
      workspace_root.join("node-runtime").join(if cfg!(windows) { "npx.cmd" } else { "npx" }),
    ];
    for file_path in required_release_files {
      if !file_path.is_file() {
        missing.push(file_path);
      }
    }
    if !has_cached_maker_package(&workspace_root.join("data").join("npm-cache")) {
      missing.push(workspace_root.join("data").join("npm-cache").join("_npx").join("@taptap-maker"));
    }
  }

  StartupResourceReport {
    ok: missing.is_empty(),
    missing,
  }
}

fn format_missing_startup_resources(missing: &[PathBuf]) -> String {
  let details = missing
    .iter()
    .map(|path| path.to_string_lossy().to_string())
    .collect::<Vec<_>>()
    .join("; ");
  format!("Missing required startup resources: {details}")
}

fn seed_maker_npm_cache(workspace_root: &Path, npm_cache_dir: &Path, desktop_log_path: &Path) {
  let seed_dir = workspace_root.join("data").join("npm-cache");
  if !seed_dir.is_dir() {
    append_log(desktop_log_path, &format!("bundled maker npm cache seed not found: {}", seed_dir.display()));
    return;
  }
  if has_cached_maker_package(npm_cache_dir) {
    return;
  }
  let _ = fs::remove_dir_all(npm_cache_dir.join("_npx"));
  let _ = fs::remove_dir_all(npm_cache_dir.join("_cacache"));
  if let Err(error) = copy_dir_contents(&seed_dir, npm_cache_dir) {
    append_log(
      desktop_log_path,
      &format!(
        "failed to seed maker npm cache from {} to {}: {error}",
        seed_dir.display(),
        npm_cache_dir.display()
      ),
    );
  } else {
    append_log(
      desktop_log_path,
      &format!("seeded maker npm cache from {} to {}", seed_dir.display(), npm_cache_dir.display()),
    );
  }
}

fn has_cached_maker_package(cache_root: &Path) -> bool {
  let npx_root = cache_root.join("_npx");
  if !npx_root.is_dir() {
    return false;
  }
  let mut stack = vec![npx_root];
  while let Some(current) = stack.pop() {
    let Ok(entries) = fs::read_dir(&current) else {
      continue;
    };
    for entry in entries.flatten() {
      let path = entry.path();
      if path.is_dir() {
        stack.push(path);
        continue;
      }
      if path.file_name().and_then(|name| name.to_str()) != Some("package.json") {
        continue;
      }
      let Ok(text) = fs::read_to_string(&path) else {
        continue;
      };
      if text.contains(r#""name":"@taptap/maker""#) || text.contains(r#""name": "@taptap/maker""#) {
        return true;
      }
    }
  }
  false
}

fn copy_dir_contents(source: &Path, target: &Path) -> Result<(), String> {
  fs::create_dir_all(target).map_err(|error| error.to_string())?;
  for entry in fs::read_dir(source).map_err(|error| error.to_string())? {
    let entry = entry.map_err(|error| error.to_string())?;
    let source_path = entry.path();
    let target_path = target.join(entry.file_name());
    let file_type = entry.file_type().map_err(|error| error.to_string())?;
    if file_type.is_dir() {
      fs::create_dir_all(&target_path).map_err(|error| error.to_string())?;
      copy_dir_contents(&source_path, &target_path)?;
    } else if file_type.is_file() {
      fs::copy(&source_path, &target_path).map_err(|error| error.to_string())?;
    }
  }
  Ok(())
}

fn settings_preferences_file_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
  Ok(app
    .path()
    .app_data_dir()
    .map_err(|error| error.to_string())?
    .join(SETTINGS_FILE_NAME))
}

fn unix_timestamp_millis() -> String {
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|duration| duration.as_millis().to_string())
    .unwrap_or_else(|_| "0".to_string())
}

fn install_panic_logger() {
  std::panic::set_hook(Box::new(|panic_info| {
    let log_dir = APP_DATA_DIR
      .get()
      .cloned()
      .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")));
    let _ = fs::create_dir_all(&log_dir);
    let log_path = log_dir.join("desktop-crash.log");
    append_log(&log_path, &format!("panic: {panic_info}"));
  }));
}

fn maintain_webview_cache(app: &tauri::App) {
  let Ok(app_data_dir) = app.path().app_data_dir() else {
    return;
  };
  let log_path = app_data_dir.join("desktop.log");
  let Ok(app_local_data_dir) = app.path().app_local_data_dir() else {
    append_log(&log_path, "unable to resolve app local data dir for webview cache maintenance");
    return;
  };
  let marker_path = app_local_data_dir.join("webview-cache-version.txt");
  let previous_version = fs::read_to_string(&marker_path).unwrap_or_default();
  if previous_version.trim() == APP_PACKAGE_VERSION {
    return;
  }

  append_log(
    &log_path,
    &format!(
      "webview cache version changed from '{}' to '{}'; clearing regenerated cache directories",
      previous_version.trim(),
      APP_PACKAGE_VERSION
    ),
  );

  let webview_root = app_local_data_dir.join("EBWebView");
  let relative_paths = [
    Path::new("Default").join("Cache"),
    Path::new("Default").join("Code Cache"),
    Path::new("Default").join("Service Worker").join("CacheStorage"),
    Path::new("Default").join("Service Worker").join("ScriptCache"),
    Path::new("Default").join("GPUCache"),
    Path::new("Default").join("DawnCache"),
    Path::new("Default").join("blob_storage"),
    PathBuf::from("Cache"),
    PathBuf::from("Code Cache"),
    PathBuf::from("GPUCache"),
    PathBuf::from("GrShaderCache"),
    PathBuf::from("ShaderCache"),
    PathBuf::from("component_crx_cache"),
  ];

  for relative_path in relative_paths {
    remove_webview_cache_path(&app_local_data_dir, &webview_root.join(relative_path), &log_path);
  }

  if let Err(error) = fs::create_dir_all(&app_local_data_dir) {
    append_log(&log_path, &format!("failed to create app local data dir: {error}"));
    return;
  }
  if let Err(error) = fs::write(&marker_path, APP_PACKAGE_VERSION) {
    append_log(&log_path, &format!("failed to write webview cache version marker: {error}"));
  }
}

fn remove_webview_cache_path(base_dir: &Path, target_path: &Path, log_path: &Path) {
  if !target_path.exists() {
    return;
  }

  let Ok(base_dir) = base_dir.canonicalize() else {
    append_log(log_path, "failed to canonicalize app local data dir before cache cleanup");
    return;
  };
  let Ok(canonical_target) = target_path.canonicalize() else {
    append_log(
      log_path,
      &format!("failed to canonicalize webview cache path {}", target_path.display()),
    );
    return;
  };
  if !canonical_target.starts_with(&base_dir) {
    append_log(
      log_path,
      &format!("refused to remove webview cache path outside app local data dir: {}", canonical_target.display()),
    );
    return;
  }

  let result = if canonical_target.is_dir() {
    fs::remove_dir_all(&canonical_target)
  } else {
    fs::remove_file(&canonical_target)
  };
  match result {
    Ok(()) => append_log(log_path, &format!("removed webview cache path {}", canonical_target.display())),
    Err(error) => append_log(
      log_path,
      &format!("failed to remove webview cache path {}: {error}", canonical_target.display()),
    ),
  }
}

fn normalize_windows_path(path: PathBuf) -> PathBuf {
  let text = path.to_string_lossy();
  if let Some(stripped) = text.strip_prefix(r"\\?\") {
    return PathBuf::from(stripped);
  }
  path
}

fn maker_projects_root() -> PathBuf {
  PathBuf::from(env!("CARGO_MANIFEST_DIR"))
    .parent()
    .and_then(Path::parent)
    .map(Path::to_path_buf)
    .unwrap_or_else(|| PathBuf::from(r"G:\TapTap_Maker"))
}

fn workspace_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
  if cfg!(debug_assertions) {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    return manifest_dir
      .parent()
      .map(Path::to_path_buf)
      .ok_or_else(|| "Unable to resolve workspace root".to_string());
  }

  Ok(app.path().resource_dir().map_err(|error| error.to_string())?)
}

fn server_command(workspace_root: &Path) -> Command {
  if cfg!(debug_assertions) {
    let mut command = Command::new("cmd.exe");
    command.args(["/d", "/s", "/c", "npm.cmd", "run", "dev:server"]);
    hide_command_window(&mut command);
    return command;
  }

  let node_exe = workspace_root.join("node-runtime").join(if cfg!(windows) { "node.exe" } else { "node" });
  let mut command = Command::new(node_exe);
  command.arg(workspace_root.join("apps").join("server").join("dist").join("index.js"));
  hide_command_window(&mut command);
  command
}

fn node_runtime_is_usable(node_runtime_dir: &Path) -> bool {
  let node_name = if cfg!(windows) { "node.exe" } else { "node" };
  let npm_name = if cfg!(windows) { "npm.cmd" } else { "npm" };
  let npx_name = if cfg!(windows) { "npx.cmd" } else { "npx" };
  node_runtime_dir.join(node_name).is_file()
    && node_runtime_dir.join(npm_name).is_file()
    && node_runtime_dir.join(npx_name).is_file()
}

fn hide_command_window(command: &mut Command) {
  #[cfg(windows)]
  {
    command.creation_flags(CREATE_NO_WINDOW);
  }
}

fn find_available_local_port(host: &str, preferred_port: u16, scan_limit: u16) -> Option<u16> {
  for offset in 0..=scan_limit {
    let port = preferred_port.checked_add(offset)?;
    if TcpListener::bind((host, port)).is_ok() {
      return Some(port);
    }
  }
  None
}

fn make_desktop_instance_token() -> String {
  let now = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|duration| duration.as_nanos())
    .unwrap_or_default();
  format!("{APP_ID}-{}-{now}", std::process::id())
}

fn read_local_http_path(host: &str, port: u16, path: &str) -> Option<String> {
  let Ok(addresses) = (host, port).to_socket_addrs() else {
    return None;
  };
  for address in addresses {
    let Ok(mut stream) = TcpStream::connect_timeout(&address, Duration::from_millis(250)) else {
      continue;
    };
    let _ = stream.set_read_timeout(Some(Duration::from_millis(500)));
    let _ = stream.set_write_timeout(Some(Duration::from_millis(500)));
    let request = format!(
      "GET {path} HTTP/1.1\r\nHost: {host}:{port}\r\nConnection: close\r\nAccept: */*\r\n\r\n"
    );
    if stream.write_all(request.as_bytes()).is_err() {
      continue;
    }
    let mut response = Vec::new();
    let mut buffer = [0; 2048];
    loop {
      match stream.read(&mut buffer) {
        Ok(0) => break,
        Ok(bytes_read) => {
          response.extend_from_slice(&buffer[..bytes_read]);
          let response_text = String::from_utf8_lossy(&response);
          if response_text.contains("</html>") || response_text.contains(r#""ok":true"#) {
            return Some(response_text.into_owned());
          }
        }
        Err(_) => break,
      }
    }
  }
  None
}

fn read_local_http_root(host: &str, port: u16) -> Option<String> {
  read_local_http_path(host, port, "/")
}

fn has_web_identity(host: &str, port: u16) -> bool {
  let Some(response) = read_local_http_root(host, port) else {
    return false;
  };
  response.contains(WEB_IDENTITY_NAME) && response.contains(WEB_IDENTITY_CONTENT)
}

fn response_has_readiness_identity(response: &str, instance_token: &str) -> bool {
  response.contains(READINESS_APP_ID)
    && response.contains(READINESS_TOKEN_KEY)
    && response.contains(instance_token)
}

fn has_readiness_identity(host: &str, port: u16, instance_token: &str) -> bool {
  let path = format!("{READINESS_TOKEN_QUERY_PREFIX}{instance_token}");
  let Some(response) = read_local_http_path(host, port, &path) else {
    return false;
  };
  response_has_readiness_identity(&response, instance_token)
}

fn wait_for_desktop_server_identity_until_ready(host: &'static str, port: u16, instance_token: &str, desktop_log_path: &Path) -> bool {
  let mut attempts = 0u32;
  loop {
    attempts += 1;
    if has_readiness_identity(host, port, instance_token) && has_web_identity(host, port) {
      if attempts > 1 {
        append_log(desktop_log_path, &format!("desktop server identity ready after retry batch {attempts}"));
      }
      return true;
    }
    if attempts % 120 == 0 {
      append_log(desktop_log_path, "still waiting for desktop server identity");
    }
    if attempts >= SERVER_READY_MAX_ATTEMPTS {
      append_log(desktop_log_path, "timed out waiting for desktop server identity");
      return false;
    }
    thread::sleep(Duration::from_millis(250));
  }
}

fn wait_for_dev_desktop_identity_until_ready(
  web_probes: &[LocalPortProbe],
  server_host: &'static str,
  server_port: u16,
  instance_token: &str,
  desktop_log_path: &Path,
) -> bool {
  let mut attempts = 0u32;
  loop {
    attempts += 1;
    let web_ready = web_probes.iter().any(|probe| has_web_identity(probe.host, probe.port));
    let server_ready = has_readiness_identity(server_host, server_port, instance_token);
    if web_ready && server_ready {
      if attempts > 1 {
        append_log(desktop_log_path, &format!("dev desktop identity ready after retry batch {attempts}"));
      }
      return true;
    }
    if attempts % 120 == 0 {
      append_log(desktop_log_path, &format!("still waiting for dev desktop identity: web_ready={web_ready}, server_ready={server_ready}"));
    }
    if attempts >= SERVER_READY_MAX_ATTEMPTS {
      append_log(desktop_log_path, &format!("timed out waiting for dev desktop identity: web_ready={web_ready}, server_ready={server_ready}"));
      return false;
    }
    thread::sleep(Duration::from_millis(250));
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn finds_next_port_when_preferred_port_is_bound() {
    let listener = TcpListener::bind((SERVER_HOST, 0)).expect("bind ephemeral port");
    let occupied_port = listener.local_addr().expect("read local address").port();
    let selected_port = find_available_local_port(SERVER_HOST, occupied_port, 4)
      .expect("find available fallback port");
    assert_ne!(selected_port, occupied_port);
  }

  #[test]
  fn readiness_identity_requires_app_id_and_matching_instance_token() {
    let token = "test-token";
    let matching_response = format!(
      r#"HTTP/1.1 200 OK
Content-Type: application/json

{{"ok":true,"appId":"taptap-maker-plus","desktopInstanceToken":"{token}"}}"#
    );
    let wrong_token_response = r#"HTTP/1.1 200 OK
Content-Type: application/json

{"ok":true,"appId":"taptap-maker-plus","desktopInstanceToken":"other-token"}"#;
    let wrong_app_response = format!(
      r#"HTTP/1.1 200 OK
Content-Type: application/json

{{"ok":true,"appId":"other-app","desktopInstanceToken":"{token}"}}"#
    );

    assert!(response_has_readiness_identity(&matching_response, token));
    assert!(!response_has_readiness_identity(wrong_token_response, token));
    assert!(!response_has_readiness_identity(&wrong_app_response, token));
  }
}

#[tauri::command]
#[cfg(any(debug_assertions, feature = "devtools"))]
fn open_devtools(app: tauri::AppHandle) -> Result<(), String> {
  let Some(window) = app.get_webview_window("main") else {
    return Err("Unable to find main window".to_string());
  };
  window.open_devtools();
  Ok(())
}

#[tauri::command]
#[cfg(not(any(debug_assertions, feature = "devtools")))]
fn open_devtools() -> Result<(), String> {
  Err("DevTools is only available in debug builds.".to_string())
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
  if !(url.starts_with("https://") || url.starts_with("http://")) {
    return Err("Only http and https URLs can be opened externally.".to_string());
  }

  #[cfg(windows)]
  {
    let status = Command::new("cmd.exe")
      .args(["/d", "/s", "/c", "start", "", &url])
      .creation_flags(CREATE_NO_WINDOW)
      .status()
      .map_err(|error| error.to_string())?;
    if status.success() {
      return Ok(());
    }
    return Err(format!("Failed to open external URL: {status}"));
  }

  #[cfg(target_os = "macos")]
  {
    Command::new("open")
      .arg(&url)
      .status()
      .map_err(|error| error.to_string())?;
    return Ok(());
  }

  #[cfg(all(unix, not(target_os = "macos")))]
  {
    Command::new("xdg-open")
      .arg(&url)
      .status()
      .map_err(|error| error.to_string())?;
    return Ok(());
  }
}

fn validate_maker_project_id(project_id: &str) -> Result<(), String> {
  let valid = !project_id.is_empty()
    && project_id.len() <= 96
    && project_id
      .chars()
      .all(|item| item.is_ascii_alphanumeric() || item == '-' || item == '_');
  if valid {
    Ok(())
  } else {
    Err("Invalid Maker project id".to_string())
  }
}

fn maker_preview_url(project_id: &str) -> Result<Url, String> {
  validate_maker_project_id(project_id)?;
  Url::parse(&format!("https://maker.taptap.cn/app/{project_id}")).map_err(|error| error.to_string())
}

fn maker_home_url() -> Result<Url, String> {
  Url::parse("https://maker.taptap.cn/").map_err(|error| error.to_string())
}

fn maker_preview_webview(app: &tauri::AppHandle) -> Result<WebviewWindow, String> {
  let state = app.state::<MakerPreviewState>();
  if let Some(webview) = state.webview.lock().map_err(|error| error.to_string())?.as_ref().cloned() {
    return Ok(webview);
  }
  if let Some(webview) = app.get_webview_window(MAKER_PREVIEW_WEBVIEW_LABEL) {
    append_desktop_event_log(app, "maker preview window handle recovered");
    *state.webview.lock().map_err(|error| error.to_string())? = Some(webview.clone());
    return Ok(webview);
  }
  Err("Maker preview webview has not been opened".to_string())
}

fn maker_preview_ready_probe_script() -> String {
  format!(
    r#"(() => {{
      try {{
        {script}
        return Boolean(window.__TAPTAP_MAKER_PREVIEW_READY__);
      }} catch (_error) {{
        return false;
      }}
    }})()"#,
    script = MAKER_PREVIEW_INIT_SCRIPT,
  )
}

fn start_maker_preview_ready_probe(app: tauri::AppHandle, webview: WebviewWindow) {
  thread::spawn(move || {
    for _attempt in 0..80 {
      let (sender, receiver) = std::sync::mpsc::channel::<String>();
      let eval_result = webview.eval_with_callback(maker_preview_ready_probe_script(), move |value| {
        let _ = sender.send(value);
      });
      if eval_result.is_ok() {
        if let Ok(value) = receiver.recv_timeout(Duration::from_millis(250)) {
          if value.contains("true") {
            if let Some(state) = app.try_state::<MakerPreviewState>() {
              if let Ok(mut loading) = state.loading.lock() {
                *loading = false;
              }
            }
            let _ = app.emit(
              MAKER_PREVIEW_LOAD_EVENT,
              serde_json::json!({
                "event": "ready",
              }),
            );
            return;
          }
        }
      }
      thread::sleep(Duration::from_millis(100));
    }

    append_desktop_event_log(&app, "maker preview ready probe timed out");
    if let Some(state) = app.try_state::<MakerPreviewState>() {
      if let Ok(mut loading) = state.loading.lock() {
        *loading = false;
      }
    }
    let _ = webview.hide();
    let _ = app.emit(
      MAKER_PREVIEW_LOAD_EVENT,
      serde_json::json!({
        "event": "ready-timeout",
      }),
    );
  });
}

#[tauri::command]
async fn maker_preview_open(app: tauri::AppHandle, project_id: String) -> Result<(), String> {
  let url = maker_preview_url(&project_id)?;
  let state = app.state::<MakerPreviewState>();
  append_desktop_event_log(&app, &format!("maker preview open requested: {}", safe_url_for_log(&url)));

  if let Some(webview) = state.webview.lock().map_err(|error| error.to_string())?.as_ref().cloned() {
    let current_project_id = state.project_id.lock().map_err(|error| error.to_string())?.clone();
    if current_project_id.as_deref() == Some(project_id.as_str()) {
      append_desktop_event_log(&app, "maker preview reused without navigation");
      *state.loading.lock().map_err(|error| error.to_string())? = true;
      webview.hide().map_err(|error| error.to_string())?;
      start_maker_preview_ready_probe(app.clone(), webview);
      return Ok(());
    }
    *state.loading.lock().map_err(|error| error.to_string())? = true;
    webview.hide().map_err(|error| error.to_string())?;
    webview.navigate(url).map_err(|error| error.to_string())?;
    *state.project_id.lock().map_err(|error| error.to_string())? = Some(project_id);
    return Ok(());
  }

  if let Some(webview) = app.get_webview_window(MAKER_PREVIEW_WEBVIEW_LABEL) {
    append_desktop_event_log(&app, "maker preview window recovered");
    let current_project_id = state.project_id.lock().map_err(|error| error.to_string())?.clone();
    if current_project_id.as_deref() == Some(project_id.as_str()) {
      append_desktop_event_log(&app, "maker preview recovered without navigation");
      *state.loading.lock().map_err(|error| error.to_string())? = true;
      webview.hide().map_err(|error| error.to_string())?;
      *state.webview.lock().map_err(|error| error.to_string())? = Some(webview.clone());
      start_maker_preview_ready_probe(app.clone(), webview);
      return Ok(());
    }
    *state.loading.lock().map_err(|error| error.to_string())? = true;
    webview.hide().map_err(|error| error.to_string())?;
    webview.navigate(url).map_err(|error| error.to_string())?;
    *state.webview.lock().map_err(|error| error.to_string())? = Some(webview);
    *state.project_id.lock().map_err(|error| error.to_string())? = Some(project_id);
    return Ok(());
  }

  let Some(main_window) = app.get_webview_window("main") else {
    return Err("Unable to find main window".to_string());
  };
  *state.loading.lock().map_err(|error| error.to_string())? = true;
  let app_for_load = app.clone();
  append_desktop_event_log(&app, "maker preview window build starting");
  let webview = WebviewWindowBuilder::new(
    &app,
    MAKER_PREVIEW_WEBVIEW_LABEL,
    tauri::WebviewUrl::App("desktop-loading.html".into()),
  )
    .title("TapTap Maker Preview")
    .decorations(false)
    .skip_taskbar(true)
    .shadow(false)
    .inner_size(1.0, 1.0)
    .parent(&main_window)
    .map_err(|error| error.to_string())?
    .on_navigation(|url| {
      eprintln!("[maker-preview-navigation] {url}");
      true
    })
    .initialization_script(MAKER_PREVIEW_INIT_SCRIPT)
    .on_page_load(move |window, payload| {
      let event = match payload.event() {
        PageLoadEvent::Started => "started",
        PageLoadEvent::Finished => "finished",
      };
      append_desktop_event_log(&app_for_load, &format!("maker preview page load {event}: {}", safe_url_for_log(payload.url())));
      if matches!(payload.event(), PageLoadEvent::Started) {
        let _ = window.hide();
        if let Some(state) = app_for_load.try_state::<MakerPreviewState>() {
          if let Ok(mut loading) = state.loading.lock() {
            *loading = true;
          }
        }
      }
      if matches!(payload.event(), PageLoadEvent::Finished) {
        start_maker_preview_ready_probe(app_for_load.clone(), window.clone());
      }
      let _ = app_for_load.emit(
        MAKER_PREVIEW_LOAD_EVENT,
        serde_json::json!({
          "event": event,
          "url": safe_url_for_log(payload.url()),
        }),
      );
    })
    .build()
    .map_err(|error| error.to_string())?;
  append_desktop_event_log(&app, "maker preview window built");
  webview.hide().map_err(|error| error.to_string())?;
  webview.navigate(url).map_err(|error| error.to_string())?;
  *state.webview.lock().map_err(|error| error.to_string())? = Some(webview);
  *state.project_id.lock().map_err(|error| error.to_string())? = Some(project_id);
  Ok(())
}

#[tauri::command]
async fn maker_preview_open_login(app: tauri::AppHandle, project_id: String) -> Result<(), String> {
  validate_maker_project_id(&project_id)?;
  let url = maker_home_url()?;
  append_desktop_event_log(&app, &format!("maker login window open requested: {}", safe_url_for_log(&url)));

  if let Some(webview) = app.get_webview_window(MAKER_LOGIN_WEBVIEW_LABEL) {
    append_desktop_event_log(&app, "maker login window reused");
    webview.navigate(url).map_err(|error| error.to_string())?;
    webview.show().map_err(|error| error.to_string())?;
    webview.set_focus().map_err(|error| error.to_string())?;
    return Ok(());
  }

  let app_for_navigation = app.clone();
  let app_for_load = app.clone();
  append_desktop_event_log(&app, "maker login window build starting");
  let webview = WebviewWindowBuilder::new(
    &app,
    MAKER_LOGIN_WEBVIEW_LABEL,
    tauri::WebviewUrl::App("desktop-loading.html".into()),
  )
    .title("TapTap Maker Login")
    .inner_size(1180.0, 820.0)
    .center()
    .focused(true)
    .devtools(cfg!(debug_assertions))
    .on_navigation(move |url| {
      append_desktop_event_log(&app_for_navigation, &format!("maker login navigation: {}", safe_url_for_log(url)));
      true
    })
    .on_page_load(move |_window, payload| {
      let event = match payload.event() {
        PageLoadEvent::Started => "started",
        PageLoadEvent::Finished => "finished",
      };
      append_desktop_event_log(&app_for_load, &format!("maker login page load {event}: {}", safe_url_for_log(payload.url())));
    })
    .build()
    .map_err(|error| error.to_string())?;
  append_desktop_event_log(&app, "maker login window built");
  webview.navigate(url).map_err(|error| error.to_string())?;
  append_desktop_event_log(&app, "maker login navigation requested after build");
  Ok(())
}

#[tauri::command]
fn maker_preview_close_login(app: tauri::AppHandle) -> Result<(), String> {
  append_desktop_event_log(&app, "maker login window close requested");
  if let Some(webview) = app.get_webview_window(MAKER_LOGIN_WEBVIEW_LABEL) {
    webview.destroy().map_err(|error| error.to_string())?;
  }
  Ok(())
}

#[tauri::command]
async fn maker_preview_confirm_logged_in(app: tauri::AppHandle, project_id: String) -> Result<(), String> {
  append_desktop_event_log(&app, "maker login confirmation requested");

  maker_preview_open(app.clone(), project_id).await?;
  maker_preview_reload(app)
}

#[tauri::command]
fn maker_preview_set_bounds(app: tauri::AppHandle, x: f64, y: f64, width: f64, height: f64, scale_factor: f64) -> Result<(), String> {
  if width <= 0.0 || height <= 0.0 || scale_factor <= 0.0 {
    return maker_preview_hide(app);
  }
  let webview = maker_preview_webview(&app)?;
  let Some(main_window) = app.get_webview_window("main") else {
    return Err("Unable to find main window".to_string());
  };
  let main_position = main_window.inner_position().map_err(|error| error.to_string())?;
  let x = main_position.x + (x * scale_factor).round() as i32;
  let y = main_position.y + (y * scale_factor).round() as i32;
  let width = (width * scale_factor).round().max(1.0) as u32;
  let height = (height * scale_factor).round().max(1.0) as u32;
  webview.set_position(PhysicalPosition::new(x, y)).map_err(|error| error.to_string())?;
  webview.set_size(PhysicalSize::new(width, height)).map_err(|error| error.to_string())?;
  if *app.state::<MakerPreviewState>().loading.lock().map_err(|error| error.to_string())? {
    return Ok(());
  }
  webview.show().map_err(|error| error.to_string())
}

#[tauri::command]
fn maker_preview_hide(app: tauri::AppHandle) -> Result<(), String> {
  if let Ok(webview) = maker_preview_webview(&app) {
    webview.hide().map_err(|error| error.to_string())?;
  }
  Ok(())
}

#[tauri::command]
fn maker_preview_show(app: tauri::AppHandle) -> Result<(), String> {
  maker_preview_webview(&app)?.show().map_err(|error| error.to_string())
}

#[tauri::command]
fn maker_preview_reload(app: tauri::AppHandle) -> Result<(), String> {
  let state = app.state::<MakerPreviewState>();
  let project_id = state
    .project_id
    .lock()
    .map_err(|error| error.to_string())?
    .clone()
    .ok_or_else(|| "Maker preview project id is not set".to_string())?;
  *state.loading.lock().map_err(|error| error.to_string())? = true;
  let webview = maker_preview_webview(&app)?;
  webview.hide().map_err(|error| error.to_string())?;
  webview
    .navigate(maker_preview_url(&project_id)?)
    .map_err(|error| error.to_string())
}

#[tauri::command]
fn maker_preview_close(app: tauri::AppHandle) -> Result<(), String> {
  let state = app.state::<MakerPreviewState>();
  let webview = state.webview.lock().map_err(|error| error.to_string())?.take();
  if let Some(webview) = webview {
    webview.destroy().map_err(|error| error.to_string())?;
  }
  *state.project_id.lock().map_err(|error| error.to_string())? = None;
  *state.loading.lock().map_err(|error| error.to_string())? = false;
  Ok(())
}

#[tauri::command]
fn desktop_window_action(app: tauri::AppHandle, action: String) -> Result<(), String> {
  let Some(window) = app.get_webview_window("main") else {
    return Err("Unable to find main window".to_string());
  };
  append_desktop_event_log(&app, &format!("desktop window action requested: {action}"));
  match action.as_str() {
    "minimize" => window.minimize().map_err(|error| error.to_string()),
    "toggleMaximize" => {
      if window.is_maximized().map_err(|error| error.to_string())? {
        window.unmaximize().map_err(|error| error.to_string())
      } else {
        window.maximize().map_err(|error| error.to_string())
      }
    },
    "close" => window.close().map_err(|error| error.to_string()),
    _ => Err(format!("Unsupported desktop window action: {action}")),
  }
}

#[tauri::command]
fn read_settings_preferences_file(app: tauri::AppHandle) -> Result<SettingsPreferencesFileResponse, String> {
  let settings_path = settings_preferences_file_path(&app)?;
  if !settings_path.exists() {
    return Ok(SettingsPreferencesFileResponse {
      preferences: serde_json::Map::new(),
      updated_at: None,
      path: settings_path.to_string_lossy().to_string(),
      exists: false,
    });
  }

  let raw = fs::read_to_string(&settings_path).map_err(|error| error.to_string())?;
  let file = serde_json::from_str::<SettingsPreferencesFile>(&raw).map_err(|error| error.to_string())?;
  Ok(SettingsPreferencesFileResponse {
    preferences: file.preferences,
    updated_at: file.updated_at,
    path: settings_path.to_string_lossy().to_string(),
    exists: true,
  })
}

#[tauri::command]
fn write_settings_preferences_file(
  app: tauri::AppHandle,
  preferences: serde_json::Map<String, serde_json::Value>,
) -> Result<SettingsPreferencesFileResponse, String> {
  let settings_path = settings_preferences_file_path(&app)?;
  let app_data_dir = settings_path
    .parent()
    .ok_or_else(|| "Unable to resolve settings file parent directory".to_string())?;
  fs::create_dir_all(app_data_dir).map_err(|error| error.to_string())?;
  let updated_at = unix_timestamp_millis();
  let file = SettingsPreferencesFile {
    preferences,
    updated_at: Some(updated_at.clone()),
  };
  let raw = serde_json::to_string_pretty(&file).map_err(|error| error.to_string())?;
  fs::write(&settings_path, raw).map_err(|error| error.to_string())?;

  Ok(SettingsPreferencesFileResponse {
    preferences: file.preferences,
    updated_at: Some(updated_at),
    path: settings_path.to_string_lossy().to_string(),
    exists: true,
  })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  install_panic_logger();
  let app = tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .setup(|app| {
      if let Ok(app_data_dir) = app.path().app_data_dir() {
        let _ = fs::create_dir_all(&app_data_dir);
        let _ = APP_DATA_DIR.set(app_data_dir);
      }
      maintain_webview_cache(app);
      let window_config = app
        .config()
        .app
        .windows
        .first()
        .ok_or_else(|| tauri::Error::Io(std::io::Error::new(
          std::io::ErrorKind::Other,
          "Missing main window config",
        )))?;
      WebviewWindowBuilder::from_config(app.handle(), window_config)?.build()?;
      if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_min_size(Some(LogicalSize::new(
          MIN_WINDOW_LOGICAL_WIDTH,
          MIN_WINDOW_LOGICAL_HEIGHT,
        )));
      }
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
          .build(),
        )?;
      }
      let server = DesktopServer::default();
      let app_handle = app.handle().clone();
      if let Err(error) = server.start(&app_handle) {
        if let Ok(app_data_dir) = app.path().app_data_dir() {
          append_log(&app_data_dir.join("desktop.log"), &format!("failed to start Fastify: {error}"));
        }
        let detail = if let Ok(app_data_dir) = app.path().app_data_dir() {
          format!(
            "{error}\n\ndesktop.log: {}\nserver.log: {}",
            app_data_dir.join("desktop.log").display(),
            app_data_dir.join("server.log").display()
          )
        } else {
          error.clone()
        };
        show_loading_error(app.handle(), &detail);
        app.manage(server.clone());
        return Ok(());
      }
      let server_launch = server.launch().map_err(|error| {
        if let Ok(app_data_dir) = app.path().app_data_dir() {
          append_log(&app_data_dir.join("desktop.log"), &format!("failed to read Fastify launch: {error}"));
        }
        tauri::Error::Io(std::io::Error::new(std::io::ErrorKind::Other, error))
      })?;
      app.manage(server.clone());
      app.manage(MakerPreviewState::default());

      let dev_web_probes = [
        LocalPortProbe { host: "127.0.0.1", port: DEV_WEB_PORT_NUMBER },
      ];
      let desktop_log_path = app.path().app_data_dir().map(|dir| dir.join("desktop.log")).ok();
      thread::spawn(move || {
        let ready = if cfg!(debug_assertions) {
          wait_for_dev_desktop_identity_until_ready(
            &dev_web_probes,
            SERVER_HOST,
            server_launch.port,
            &server_launch.instance_token,
            desktop_log_path.as_deref().unwrap_or_else(|| Path::new("desktop.log")),
          )
        } else {
          wait_for_desktop_server_identity_until_ready(
            SERVER_HOST,
            server_launch.port,
            &server_launch.instance_token,
            desktop_log_path.as_deref().unwrap_or_else(|| Path::new("desktop.log")),
          )
        };
        if !ready {
          let detail = if let Some(path) = desktop_log_path.as_ref() {
            let server_log_path = path.parent().map(|dir| dir.join("server.log"));
            format!(
              "本地桌面服务启动后没有在规定时间内完成接管。\n\ndesktop.log: {}\nserver.log: {}",
              path.display(),
              server_log_path
                .as_ref()
                .map(|item| item.display().to_string())
                .unwrap_or_else(|| "无法解析 server.log 路径".to_string())
            )
          } else {
            "本地桌面服务启动后没有在规定时间内完成接管。".to_string()
          };
          let error_app_handle = app_handle.clone();
          let _ = app_handle.run_on_main_thread(move || {
            show_loading_error(&error_app_handle, &detail);
          });
          return;
        }
        let api_base = format!("http://{SERVER_HOST}:{}", server_launch.port);
        let target_url = if cfg!(debug_assertions) {
          format!("{DEV_WEB_URL}?apiBase={api_base}&appVersion={APP_PACKAGE_VERSION}")
        } else {
          format!("{api_base}?apiBase={api_base}&appVersion={APP_PACKAGE_VERSION}")
        };
        let window_app_handle = app_handle.clone();
        let _ = app_handle.run_on_main_thread(move || {
          if let Some(window) = window_app_handle.get_webview_window("main") {
            if let Ok(url) = Url::parse(&target_url) {
              let _ = window.navigate(url);
            }
          }
        });
      });
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      desktop_window_action,
      maker_preview_close,
      maker_preview_close_login,
      maker_preview_confirm_logged_in,
      maker_preview_hide,
      maker_preview_open_login,
      maker_preview_open,
      maker_preview_reload,
      maker_preview_set_bounds,
      maker_preview_show,
      open_devtools,
      open_external_url,
      read_settings_preferences_file,
      write_settings_preferences_file
    ])
    .build(tauri::generate_context!())
    .expect("error while building tauri application");

  app.run(move |app_handle, event| {
    match event {
      RunEvent::WindowEvent {
        label,
        event: WindowEvent::CloseRequested { .. },
        ..
      } => {
        append_desktop_event_log(&app_handle, &format!("window close requested: {label}"));
      }
      RunEvent::WindowEvent {
        label,
        event: WindowEvent::Destroyed,
        ..
      } => {
        append_desktop_event_log(&app_handle, &format!("window destroyed: {label}"));
      }
      RunEvent::ExitRequested { code, .. } => {
        append_desktop_event_log(&app_handle, &format!("app exit requested: {code:?}"));
        app_handle.state::<DesktopServer>().stop();
      }
      RunEvent::Exit => {
        append_desktop_event_log(&app_handle, "app event loop exit");
        app_handle.state::<DesktopServer>().stop();
      }
      _ => {}
    }
  });
}
