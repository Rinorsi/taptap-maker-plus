use std::{
  fs,
  fs::OpenOptions,
  io::{Read, Write},
  net::{TcpStream, ToSocketAddrs},
  path::{Path, PathBuf},
  process::{Child, Command, Stdio},
  sync::{Arc, Mutex},
  thread,
  time::Duration,
};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

use tauri::{
  menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder},
  Emitter, Manager, PhysicalSize, RunEvent, Url, WindowEvent,
};

const SERVER_HOST: &str = "127.0.0.1";
const SERVER_PORT: &str = "8787";
const SERVER_PORT_NUMBER: u16 = 8787;
const SERVER_URL: &str = "http://127.0.0.1:8787";
const DEV_WEB_PORT_NUMBER: u16 = 5173;
const DEV_WEB_URL: &str = "http://127.0.0.1:5173";
const WEB_IDENTITY_NAME: &str = r#"name="taptap-maker-plus""#;
const WEB_IDENTITY_CONTENT: &str = r#"content="web""#;
const ASPECT_WIDTH: u32 = 16;
const ASPECT_HEIGHT: u32 = 9;
const ASPECT_TOLERANCE: u32 = 3;
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;
const NATIVE_MENU_EVENT: &str = "taptap://native-menu";
const MENU_COMMAND_PREFIX: &str = "command:";
const MENU_QUIT_ID: &str = "app.quit";

struct LocalPortProbe {
  host: &'static str,
  port: u16,
}

#[derive(Clone, Default)]
struct DesktopServer {
  child: Arc<Mutex<Option<Child>>>,
}

#[derive(Default)]
struct AspectRatioLock {
  adjusting: bool,
  last_size: Option<PhysicalSize<u32>>,
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
    let mut command = server_command(&workspace_root);
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
      .env("TAPTAP_SERVER_PORT", SERVER_PORT)
      .env("TAPTAP_MCP_ENV", "production")
      .stdin(Stdio::null())
      .stdout(Stdio::from(server_stdout))
      .stderr(Stdio::from(server_stderr));

    let child = command.spawn().map_err(|error| error.to_string())?;
    append_log(&desktop_log_path, &format!("Fastify child pid {}", child.id()));
    *self.child.lock().map_err(|error| error.to_string())? = Some(child);
    Ok(())
  }

  fn stop(&self) {
    let Ok(mut child) = self.child.lock() else {
      return;
    };
    if let Some(mut child) = child.take() {
      let _ = child.kill();
      let _ = child.wait();
    }
  }
}

fn append_log(log_path: &Path, message: &str) {
  if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(log_path) {
    let _ = writeln!(file, "{message}");
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

  let mut command = Command::new("node");
  command.arg(workspace_root.join("apps").join("server").join("dist").join("index.js"));
  hide_command_window(&mut command);
  command
}

fn hide_command_window(command: &mut Command) {
  #[cfg(windows)]
  {
    command.creation_flags(CREATE_NO_WINDOW);
  }
}

fn read_local_http_root(host: &str, port: u16) -> Option<String> {
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
      "GET / HTTP/1.1\r\nHost: {host}:{port}\r\nConnection: close\r\nAccept: text/html\r\n\r\n"
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
          if response_text.contains(WEB_IDENTITY_NAME) && response_text.contains(WEB_IDENTITY_CONTENT) {
            return Some(String::from_utf8_lossy(&response).into_owned());
          }
        }
        Err(_) => break,
      }
    }
  }
  None
}

fn wait_for_web_identity(probes: &[LocalPortProbe]) -> bool {
  for _ in 0..120 {
    for probe in probes {
      if read_local_http_root(probe.host, probe.port).is_some() {
        return true;
      }
    }
    thread::sleep(Duration::from_millis(250));
  }
  false
}

#[tauri::command]
fn open_devtools(app: tauri::AppHandle) -> Result<(), String> {
  let Some(window) = app.get_webview_window("main") else {
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

fn rounded_div(value: u64, divisor: u64) -> u32 {
  ((value + (divisor / 2)) / divisor) as u32
}

fn enforce_aspect_ratio(
  app_handle: &tauri::AppHandle,
  label: &str,
  size: PhysicalSize<u32>,
  lock: &Arc<Mutex<AspectRatioLock>>,
) {
  if label != "main" || size.width == 0 || size.height == 0 {
    return;
  }

  let Some(window) = app_handle.get_webview_window(label) else {
    return;
  };
  if window.is_fullscreen().unwrap_or(false) || window.is_maximized().unwrap_or(false) {
    if let Ok(mut state) = lock.lock() {
      state.last_size = Some(size);
    }
    return;
  }

  let Ok(mut state) = lock.lock() else {
    return;
  };
  if state.adjusting {
    state.adjusting = false;
    state.last_size = Some(size);
    return;
  }

  let target_height_from_width = rounded_div(size.width as u64 * ASPECT_HEIGHT as u64, ASPECT_WIDTH as u64);
  if size.height.abs_diff(target_height_from_width) <= ASPECT_TOLERANCE {
    state.last_size = Some(size);
    return;
  }

  let target_width_from_height = rounded_div(size.height as u64 * ASPECT_WIDTH as u64, ASPECT_HEIGHT as u64);
  let (next_width, next_height) = match state.last_size {
    Some(previous) => {
      let width_change = size.width.abs_diff(previous.width);
      let height_change = size.height.abs_diff(previous.height);
      if width_change >= height_change {
        (size.width, target_height_from_width.max(1))
      } else {
        (target_width_from_height.max(1), size.height)
      }
    }
    None => (size.width, target_height_from_width.max(1)),
  };

  let next_size = PhysicalSize::new(next_width, next_height);
  state.adjusting = true;
  state.last_size = Some(next_size);
  drop(state);
  let _ = window.set_size(next_size);
}

fn command_menu_item(
  app: &tauri::App,
  command_id: &'static str,
  title: &'static str,
  accelerator: Option<&'static str>,
) -> tauri::Result<tauri::menu::MenuItem<tauri::Wry>> {
  let id = format!("{MENU_COMMAND_PREFIX}{command_id}");
  let mut builder = MenuItemBuilder::with_id(id, title);
  if let Some(accelerator) = accelerator {
    builder = builder.accelerator(accelerator);
  }
  builder.build(app)
}

fn install_native_menu(app: &tauri::App) -> tauri::Result<()> {
  let file_menu = SubmenuBuilder::new(app, "文件")
    .item(&command_menu_item(app, "app.openCommandPalette", "打开命令面板", Some("Ctrl+K"))?)
    .item(&command_menu_item(app, "app.saveCurrentDraft", "保存当前工作流/草稿", Some("Ctrl+S"))?)
    .separator()
    .text(MENU_QUIT_ID, "退出")
    .build()?;
  let view_menu = SubmenuBuilder::new(app, "视图")
    .item(&command_menu_item(app, "layout.toggleSidebar", "折叠/展开左栏", Some("Ctrl+B"))?)
    .item(&command_menu_item(app, "layout.toggleInspector", "折叠/展开右栏", Some("Ctrl+Shift+I"))?)
    .item(&command_menu_item(app, "app.toggleTheme", "切换主题", None)?)
    .separator()
    .item(&command_menu_item(app, "app.refreshCurrent", "刷新当前数据", Some("Ctrl+R"))?)
    .build()?;
  let project_menu = SubmenuBuilder::new(app, "项目")
    .item(&command_menu_item(app, "project.scanProjects", "扫描项目", None)?)
    .item(&command_menu_item(app, "mcp.startRuntime", "启动 MCP runtime", None)?)
    .item(&command_menu_item(app, "mcp.refreshTools", "刷新 MCP 工具", None)?)
    .item(&command_menu_item(app, "asset.scanCurrentProject", "扫描当前项目资产", None)?)
    .build()?;
  let developer_menu = SubmenuBuilder::new(app, "开发者")
    .item(&command_menu_item(app, "developer.openPanel", "打开开发者面板", None)?)
    .item(&command_menu_item(app, "developer.copyDiagnostics", "复制诊断摘要", None)?)
    .build()?;
  let menu = MenuBuilder::new(app)
    .item(&file_menu)
    .item(&view_menu)
    .item(&project_menu)
    .item(&developer_menu)
    .build()?;
  app.set_menu(menu)?;
  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let aspect_ratio_lock = Arc::new(Mutex::new(AspectRatioLock::default()));
  let aspect_ratio_lock_for_run = aspect_ratio_lock.clone();
  let app = tauri::Builder::default()
    .on_menu_event(|app, event| {
      let id = event.id().0.as_str();
      if id == MENU_QUIT_ID {
        app.exit(0);
        return;
      }
      if let Some(command_id) = id.strip_prefix(MENU_COMMAND_PREFIX) {
        let _ = app.emit(NATIVE_MENU_EVENT, command_id);
      }
    })
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      install_native_menu(app)?;
      let server = DesktopServer::default();
      let app_handle = app.handle().clone();
      server.start(&app_handle).map_err(|error| {
        tauri::Error::Io(std::io::Error::new(std::io::ErrorKind::Other, error))
      })?;
      app.manage(server.clone());

      let dev_web_probes = [
        LocalPortProbe { host: "127.0.0.1", port: DEV_WEB_PORT_NUMBER },
      ];
      let production_probe = [LocalPortProbe { host: SERVER_HOST, port: SERVER_PORT_NUMBER }];
      thread::spawn(move || {
        let target_ready = if cfg!(debug_assertions) {
          wait_for_web_identity(&dev_web_probes)
        } else {
          wait_for_web_identity(&production_probe)
        };
        let target_url = if target_ready {
          if cfg!(debug_assertions) { DEV_WEB_URL } else { SERVER_URL }
        } else {
          return;
        };
        let window_app_handle = app_handle.clone();
        let _ = app_handle.run_on_main_thread(move || {
          if let Some(window) = window_app_handle.get_webview_window("main") {
            if let Ok(url) = Url::parse(target_url) {
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
    if let RunEvent::WindowEvent { label, event: WindowEvent::Resized(size), .. } = &event {
      enforce_aspect_ratio(app_handle, label, *size, &aspect_ratio_lock_for_run);
    }
    if matches!(event, RunEvent::Exit | RunEvent::ExitRequested { .. }) {
      app_handle.state::<DesktopServer>().stop();
    }
  });
}
