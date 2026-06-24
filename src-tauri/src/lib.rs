use std::{
  fs,
  fs::OpenOptions,
  io::Write,
  net::{TcpStream, ToSocketAddrs},
  path::{Path, PathBuf},
  process::{Child, Command, Stdio},
  sync::{Arc, Mutex},
  thread,
  time::Duration,
};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

use tauri::{Manager, PhysicalSize, RunEvent, Url, WindowEvent};

const SERVER_HOST: &str = "127.0.0.1";
const SERVER_PORT: &str = "8787";
const SERVER_PORT_NUMBER: u16 = 8787;
const SERVER_URL: &str = "http://127.0.0.1:8787";
const DEV_WEB_PORT_NUMBER: u16 = 5173;
const DEV_WEB_URL: &str = "http://localhost:5173";
const ASPECT_WIDTH: u32 = 16;
const ASPECT_HEIGHT: u32 = 9;
const ASPECT_TOLERANCE: u32 = 3;
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

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

fn wait_for_local_port(host: &str, port: u16) -> bool {
  if let Ok(addresses) = (host, port).to_socket_addrs() {
    for address in addresses {
      if TcpStream::connect_timeout(&address, Duration::from_millis(250)).is_ok() {
        return true;
      }
    }
  }
  TcpStream::connect((host, port)).is_ok()
}

fn wait_for_any_local_port(probes: &[LocalPortProbe]) -> bool {
  for _ in 0..120 {
    for probe in probes {
      if wait_for_local_port(probe.host, probe.port) {
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let aspect_ratio_lock = Arc::new(Mutex::new(AspectRatioLock::default()));
  let aspect_ratio_lock_for_run = aspect_ratio_lock.clone();
  let app = tauri::Builder::default()
    .setup(|app| {
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
        tauri::Error::Io(std::io::Error::new(std::io::ErrorKind::Other, error))
      })?;
      app.manage(server.clone());

      let dev_web_probes = [
        LocalPortProbe { host: "localhost", port: DEV_WEB_PORT_NUMBER },
        LocalPortProbe { host: "127.0.0.1", port: DEV_WEB_PORT_NUMBER },
        LocalPortProbe { host: "::1", port: DEV_WEB_PORT_NUMBER },
      ];
      let production_probe = [LocalPortProbe { host: SERVER_HOST, port: SERVER_PORT_NUMBER }];
      thread::spawn(move || {
        let target_ready = if cfg!(debug_assertions) {
          wait_for_any_local_port(&dev_web_probes)
        } else {
          wait_for_any_local_port(&production_probe)
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
    .invoke_handler(tauri::generate_handler![open_devtools])
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
