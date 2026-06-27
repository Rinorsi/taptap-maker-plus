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

use tauri::{LogicalSize, Manager, RunEvent, Url, WebviewWindowBuilder};

const SERVER_HOST: &str = "127.0.0.1";
const SERVER_PORT_NUMBER: u16 = 8787;
const SERVER_PORT_SCAN_LIMIT: u16 = 40;
const DEV_WEB_PORT_NUMBER: u16 = 5173;
const DEV_WEB_URL: &str = "http://127.0.0.1:5173";
const APP_ID: &str = "taptap-maker-plus";
const READINESS_TOKEN_QUERY_PREFIX: &str = "/api/desktop/readiness?token=";
const READINESS_APP_ID: &str = r#""appId":"taptap-maker-plus""#;
const READINESS_TOKEN_KEY: &str = r#""desktopInstanceToken":""#;
const WEB_IDENTITY_NAME: &str = r#"name="taptap-maker-plus""#;
const WEB_IDENTITY_CONTENT: &str = r#"content="web""#;
const MIN_WINDOW_LOGICAL_WIDTH: f64 = 1366.0;
const MIN_WINDOW_LOGICAL_HEIGHT: f64 = 768.0;
const APP_PACKAGE_VERSION: &str = env!("CARGO_PKG_VERSION");
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;
static APP_DATA_DIR: OnceLock<PathBuf> = OnceLock::new();
struct LocalPortProbe {
  host: &'static str,
  port: u16,
}

struct DesktopServerLaunch {
  port: u16,
  instance_token: String,
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
      let _ = child.kill();
      let _ = child.wait();
    }
    if let Ok(mut launch) = self.launch.lock() {
      *launch = None;
    }
  }
}

fn append_log(log_path: &Path, message: &str) {
  if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(log_path) {
    let _ = writeln!(file, "{message}");
  }
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

fn wait_for_desktop_server_identity_until_ready(host: &'static str, port: u16, instance_token: &str, desktop_log_path: &Path) {
  let mut attempts = 0u32;
  loop {
    attempts += 1;
    if has_readiness_identity(host, port, instance_token) && has_web_identity(host, port) {
      if attempts > 1 {
        append_log(desktop_log_path, &format!("desktop server identity ready after retry batch {attempts}"));
      }
      return;
    }
    if attempts % 120 == 0 {
      append_log(desktop_log_path, "still waiting for desktop server identity");
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
) {
  let mut attempts = 0u32;
  loop {
    attempts += 1;
    let web_ready = web_probes.iter().any(|probe| has_web_identity(probe.host, probe.port));
    let server_ready = has_readiness_identity(server_host, server_port, instance_token);
    if web_ready && server_ready {
      if attempts > 1 {
        append_log(desktop_log_path, &format!("dev desktop identity ready after retry batch {attempts}"));
      }
      return;
    }
    if attempts % 120 == 0 {
      append_log(desktop_log_path, &format!("still waiting for dev desktop identity: web_ready={web_ready}, server_ready={server_ready}"));
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
fn open_devtools(app: tauri::AppHandle) -> Result<(), String> {
  let Some(_window) = app.get_webview_window("main") else {
    return Err("Unable to find main window".to_string());
  };

  #[cfg(any(debug_assertions, feature = "devtools"))]
  {
    window.open_devtools();
    return Ok(());
  }

  #[cfg(not(any(debug_assertions, feature = "devtools")))]
  {
    Err("DevTools is only available in debug builds.".to_string())
  }
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
      server.start(&app_handle).map_err(|error| {
        if let Ok(app_data_dir) = app.path().app_data_dir() {
          append_log(&app_data_dir.join("desktop.log"), &format!("failed to start Fastify: {error}"));
        }
        tauri::Error::Io(std::io::Error::new(std::io::ErrorKind::Other, error))
      })?;
      let server_launch = server.launch().map_err(|error| {
        if let Ok(app_data_dir) = app.path().app_data_dir() {
          append_log(&app_data_dir.join("desktop.log"), &format!("failed to read Fastify launch: {error}"));
        }
        tauri::Error::Io(std::io::Error::new(std::io::ErrorKind::Other, error))
      })?;
      app.manage(server.clone());

      let dev_web_probes = [
        LocalPortProbe { host: "127.0.0.1", port: DEV_WEB_PORT_NUMBER },
      ];
      let desktop_log_path = app.path().app_data_dir().map(|dir| dir.join("desktop.log")).ok();
      thread::spawn(move || {
        if cfg!(debug_assertions) {
          wait_for_dev_desktop_identity_until_ready(
            &dev_web_probes,
            SERVER_HOST,
            server_launch.port,
            &server_launch.instance_token,
            desktop_log_path.as_deref().unwrap_or_else(|| Path::new("desktop.log")),
          );
        } else {
          wait_for_desktop_server_identity_until_ready(
            SERVER_HOST,
            server_launch.port,
            &server_launch.instance_token,
            desktop_log_path.as_deref().unwrap_or_else(|| Path::new("desktop.log")),
          );
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
    .invoke_handler(tauri::generate_handler![open_devtools, open_external_url])
    .build(tauri::generate_context!())
    .expect("error while building tauri application");

  app.run(move |app_handle, event| {
    if matches!(event, RunEvent::Exit | RunEvent::ExitRequested { .. }) {
      app_handle.state::<DesktopServer>().stop();
    }
  });
}
