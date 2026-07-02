use std::{
  fs,
  fs::OpenOptions,
  io::{Read, Write},
  net::{TcpListener, TcpStream, ToSocketAddrs},
  path::{Path, PathBuf},
  process::{Child, Command, Stdio},
  sync::OnceLock,
  sync::{Arc, Mutex},
  thread,
  time::{Duration, SystemTime, UNIX_EPOCH},
};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

use tauri::webview::PageLoadEvent;
use tauri::{
  Emitter, LogicalPosition, LogicalSize, Manager, PhysicalPosition, PhysicalSize, RunEvent, Size,
  Url, Webview, WebviewBuilder, WebviewWindowBuilder, WindowEvent,
};

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
static MAKER_PREVIEW_INIT_SCRIPT: OnceLock<String> = OnceLock::new();

const MAKER_PREVIEW_SHELL_STYLE_TEMPLATE: &str =
  include_str!("../injected/maker-preview-shell.css");

const MAKER_PREVIEW_INIT_SCRIPT_TEMPLATE: &str = r##"
(() => {
  if (window.top !== window) return;
  if (window.__TAPTAP_MAKER_PREVIEW_ISOLATOR__) {
    const existingShell = document.getElementById("taptap-maker-preview-shell");
    if (existingShell && typeof window.__TAPTAP_MAKER_PREVIEW_SCHEDULE__ === "function") {
      window.__TAPTAP_MAKER_PREVIEW_SCHEDULE__();
      return;
    }
  }
  window.__TAPTAP_MAKER_PREVIEW_ISOLATOR__ = true;

  const SHELL_ID = "taptap-maker-preview-shell";
  const STYLE_ID = "taptap-maker-preview-style";
  const STORAGE_KEY = "taptap.makerPreview.shellSettings";
  const state = {
    isolated: false,
    previewRequested: false,
    shell: null,
    stage: null,
    frame: null,
    viewport: null,
    chrome: null,
    settingsOpen: false,
    toastTimer: 0,
    theme: "light",
    settings: readSettings(),
  };
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

  function readSettings() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return {
        device: ["adaptive", "pc", "phone", "tablet"].includes(value.device) ? value.device : "adaptive",
        orientation: value.orientation === "portrait" ? "portrait" : "landscape",
        scale: ["1", "0.89", "0.75", "0.5"].includes(String(value.scale)) ? String(value.scale) : "1",
        chrome: ["none", "capsule", "island", "capsule+island"].includes(value.chrome) ? value.chrome : "none",
      };
    } catch (_error) {
      return { device: "adaptive", orientation: "landscape", scale: "1", chrome: "none" };
    }
  }

  function writeSettings() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings)); } catch (_error) {}
  }

  function normalizeTheme(value) {
    return value === "dark" ? "dark" : "light";
  }

  function applyShellTheme(value) {
    state.theme = normalizeTheme(value);
    if (state.shell) state.shell.dataset.theme = state.theme;
  }

  window.__TAPTAP_MAKER_PREVIEW_SET_THEME__ = applyShellTheme;

  function deviceDimensions() {
    const sizes = {
      pc: [1920, 1080],
      phone: [390, 867],
      tablet: [820, 1180],
    };
    const size = sizes[state.settings.device];
    if (!size) return null;
    const width = Math.min(size[0], size[1]);
    const height = Math.max(size[0], size[1]);
    return state.settings.orientation === "landscape" ? [height, width] : [width, height];
  }

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = __TAPTAP_MAKER_SHELL_STYLE__;
    document.head.appendChild(style);
  }

  function controlName(element) {
    return [element.getAttribute("aria-label"), element.getAttribute("title"), element.textContent]
      .filter(Boolean)
      .join(" ")
      .trim();
  }

  function normalizedControlName(element) {
    return controlName(element).replace(/\s+/g, "").trim().toLowerCase();
  }

  function nativeControls() {
    return Array.from(document.querySelectorAll('button, a, [role="button"], [role="tab"]'))
      .filter((element) => !element.closest(`#${SHELL_ID}`));
  }

  function clickNativeControlByNames(names) {
    const normalizedNames = names.map((name) => String(name).replace(/\s+/g, "").trim().toLowerCase());
    const control = nativeControls().find((element) => normalizedNames.includes(normalizedControlName(element)));
    if (!control) return false;
    control.click();
    return true;
  }

  function currentPreviewLink() {
    const iframe = findGameIframe();
    if (iframe && iframe.src) return iframe.src;
    return location.href;
  }

  function showToast(message) {
    if (!state.shell) return;
    const toast = state.shell.querySelector(".tmp-toast");
    if (!toast) return;
    toast.textContent = message;
    toast.dataset.open = "true";
    window.clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(() => {
      toast.dataset.open = "false";
    }, 1600);
  }

  async function copyText(value) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch (_error) {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      textarea.remove();
      return ok;
    }
  }

  function reloadPreview() {
    if (clickNativeControlByNames(["重载预览", "重新预览", "刷新预览", "刷新"])) {
      showToast("已触发 Maker 原生刷新");
      return;
    }
    window.location.reload();
  }

  async function copyPreviewLink() {
    if (clickNativeControlByNames(["分享测试链接", "复制测试链接", "分享", "复制链接"])) {
      showToast("已触发 Maker 原生分享");
      return;
    }
    const ok = await copyText(currentPreviewLink());
    showToast(ok ? "已复制当前预览链接" : "复制失败");
  }

  function requestPreviewTab() {
    if (state.previewRequested) return;
    try {
      if (new URLSearchParams(location.search).get("tab") === "preview") return;
    } catch (_error) {}
    const controls = Array.from(document.querySelectorAll('button, a, [role="button"], [role="tab"]'))
      .filter((element) => !element.closest(`#${SHELL_ID}`));
    const previewControl = controls.find((element) => {
      const name = controlName(element);
      const normalizedName = name.replace(/\s+/g, "").trim();
      const role = element.getAttribute("role");
      return normalizedName === "预览" ||
        normalizedName === "Preview" ||
        ((role === "tab" || role === "button") && /^预览$/.test(normalizedName)) ||
        ((role === "tab" || role === "button") && /^preview$/i.test(normalizedName));
    });
    if (!previewControl) return;
    state.previewRequested = true;
    previewControl.click();
  }

  function createToolbarButton(label, icon) {
    const button = document.createElement("button");
    button.className = "tmp-button";
    button.type = "button";
    button.title = label;
    button.setAttribute("aria-label", label);
    button.innerHTML = icon;
    return button;
  }

  function createSelect(label, value, options, onChange) {
    const field = document.createElement("label");
    field.className = "tmp-field";
    const text = document.createElement("span");
    text.textContent = label;
    const select = document.createElement("select");
    select.className = "tmp-select";
    select.value = value;
    for (const option of options) {
      const item = document.createElement("option");
      item.value = option.value;
      item.textContent = option.label;
      select.appendChild(item);
    }
    select.addEventListener("change", () => onChange(select.value));
    field.append(text, select);
    return field;
  }

  function buildShell() {
    installStyle();
    const existing = document.getElementById(SHELL_ID);
    if (existing) {
      state.shell = existing;
      state.stage = existing.querySelector(".tmp-stage");
      state.frame = existing.querySelector(".tmp-frame");
      state.viewport = existing.querySelector(".tmp-viewport");
      state.chrome = existing.querySelector(".tmp-host-chrome");
      return;
    }

    const shell = document.createElement("div");
    shell.id = SHELL_ID;
    shell.setAttribute("data-taptap-maker-preview", "shell");

    const toolbar = document.createElement("div");
    toolbar.className = "tmp-toolbar";
    const leftEdge = document.createElement("div");
    leftEdge.className = "tmp-toolbar-edge";
    const actions = document.createElement("div");
    actions.className = "tmp-toolbar-actions";
    const rightEdge = document.createElement("div");
    rightEdge.className = "tmp-toolbar-edge";

    const reload = createToolbarButton("重载预览", '<svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>');
    reload.addEventListener("click", reloadPreview);

    const hidden = createToolbarButton("隐藏预览", '<svg viewBox="0 0 24 24"><path d="M10.7 5.1A10.94 10.94 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a10.76 10.76 0 0 0 5.39-1.39"/><path d="M2 2l20 20"/><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/></svg>');
    hidden.disabled = true;
    hidden.style.opacity = "0.45";

    const settings = createToolbarButton("打开设备预览设置", '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8"/><path d="M12 16v4"/><path d="M17 8h1"/></svg>');
    settings.addEventListener("click", () => {
      state.settingsOpen = !state.settingsOpen;
      applySettings();
    });

    const screenshot = createToolbarButton("截图", '<svg viewBox="0 0 24 24"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>');
    screenshot.disabled = true;
    screenshot.style.opacity = "0.45";

    const record = createToolbarButton("录制", '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="14" height="14" rx="2"/><path d="M17 9l4-2v10l-4-2z"/></svg>');
    record.disabled = true;
    record.style.opacity = "0.45";

    const fullscreen = createToolbarButton("全屏", '<svg viewBox="0 0 24 24"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>');
    fullscreen.disabled = true;
    fullscreen.style.opacity = "0.45";

    const share = createToolbarButton("复制预览链接", '<svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4"/><path d="M15.4 6.5l-6.8 4"/></svg>');
    share.addEventListener("click", () => { void copyPreviewLink(); });

    actions.append(reload, hidden, settings, screenshot, record, fullscreen, share);
    toolbar.append(leftEdge, actions, rightEdge);

    const settingsPanel = document.createElement("div");
    settingsPanel.className = "tmp-settings";
    settingsPanel.append(
      createSelect("设备", state.settings.device, [
        { value: "adaptive", label: "自适应" },
        { value: "pc", label: "PC 1920x1080" },
        { value: "phone", label: "手机 390x867" },
        { value: "tablet", label: "平板 820x1180" },
      ], (value) => {
        state.settings.device = value;
        if (value === "adaptive") {
          state.settings.scale = "1";
          state.settings.chrome = "none";
        }
        if (value === "pc") state.settings.orientation = "landscape";
        writeSettings();
        rebuildSettingsPanel(settingsPanel);
        applySettings();
      }),
      createSelect("方向", state.settings.orientation, [
        { value: "landscape", label: "横屏" },
        { value: "portrait", label: "竖屏" },
      ], (value) => {
        state.settings.orientation = value;
        writeSettings();
        applySettings();
      }),
      createSelect("缩放", state.settings.scale, [
        { value: "1", label: "100%" },
        { value: "0.89", label: "89%" },
        { value: "0.75", label: "75%" },
        { value: "0.5", label: "50%" },
      ], (value) => {
        state.settings.scale = value;
        writeSettings();
        applySettings();
      }),
      createSelect("外壳", state.settings.chrome, [
        { value: "none", label: "无" },
        { value: "capsule", label: "小程序按钮" },
        { value: "island", label: "灵动岛" },
        { value: "capsule+island", label: "按钮 + 灵动岛" },
      ], (value) => {
        state.settings.chrome = value;
        writeSettings();
        applySettings();
      })
    );

    const stage = document.createElement("div");
    stage.className = "tmp-stage";
    const frame = document.createElement("div");
    frame.className = "tmp-frame";
    const viewport = document.createElement("div");
    viewport.className = "tmp-viewport";
    const chrome = document.createElement("div");
    chrome.className = "tmp-host-chrome";
    chrome.innerHTML = '<div class="tmp-island"></div><div class="tmp-capsule"><span class="tmp-capsule-dot"></span><span class="tmp-capsule-dot"></span><span class="tmp-capsule-ring"></span></div>';
    const loading = document.createElement("div");
    loading.className = "tmp-loading";
    loading.textContent = "正在等待 TapTap Maker 返回游戏 iframe";
    const toast = document.createElement("div");
    toast.className = "tmp-toast";
    toast.dataset.open = "false";
    frame.append(viewport, chrome);
    stage.append(frame, loading);
    shell.append(toolbar, settingsPanel, stage, toast);
    document.body.appendChild(shell);

    state.shell = shell;
    state.stage = stage;
    state.frame = frame;
    state.viewport = viewport;
    state.chrome = chrome;
    applyShellTheme(state.theme);
    applySettings();
  }

  function rebuildSettingsPanel(panel) {
    panel.replaceChildren();
    panel.append(
      createSelect("设备", state.settings.device, [
        { value: "adaptive", label: "自适应" },
        { value: "pc", label: "PC 1920x1080" },
        { value: "phone", label: "手机 390x867" },
        { value: "tablet", label: "平板 820x1180" },
      ], (value) => {
        state.settings.device = value;
        if (value === "adaptive") {
          state.settings.scale = "1";
          state.settings.chrome = "none";
        }
        if (value === "pc") state.settings.orientation = "landscape";
        writeSettings();
        rebuildSettingsPanel(panel);
        applySettings();
      }),
      createSelect("方向", state.settings.orientation, [
        { value: "landscape", label: "横屏" },
        { value: "portrait", label: "竖屏" },
      ], (value) => { state.settings.orientation = value; writeSettings(); applySettings(); }),
      createSelect("缩放", state.settings.scale, [
        { value: "1", label: "100%" },
        { value: "0.89", label: "89%" },
        { value: "0.75", label: "75%" },
        { value: "0.5", label: "50%" },
      ], (value) => { state.settings.scale = value; writeSettings(); applySettings(); }),
      createSelect("外壳", state.settings.chrome, [
        { value: "none", label: "无" },
        { value: "capsule", label: "小程序按钮" },
        { value: "island", label: "灵动岛" },
        { value: "capsule+island", label: "按钮 + 灵动岛" },
      ], (value) => { state.settings.chrome = value; writeSettings(); applySettings(); })
    );
  }

  function applySettings() {
    if (!state.shell || !state.stage || !state.frame || !state.chrome) return;
    const panel = state.shell.querySelector(".tmp-settings");
    const settingsButton = Array.from(state.shell.querySelectorAll(".tmp-button")).find((button) => button.getAttribute("aria-label") === "打开设备预览设置");
    if (panel) panel.dataset.open = String(state.settingsOpen);
    if (settingsButton) settingsButton.dataset.active = String(state.settingsOpen);
    state.stage.dataset.settings = String(state.settingsOpen);
    state.stage.dataset.device = state.settings.device;
    state.frame.dataset.device = state.settings.device;
    state.chrome.dataset.mode = state.settings.chrome;

    const dimensions = deviceDimensions();
    if (!dimensions) {
      state.frame.style.width = "100%";
      state.frame.style.height = "100%";
      state.frame.style.minWidth = "100%";
      state.frame.style.minHeight = "100%";
      state.frame.style.maxWidth = "100%";
      state.frame.style.maxHeight = "100%";
      state.frame.style.aspectRatio = "auto";
      return;
    }

    const scale = Number(state.settings.scale) || 1;
    state.frame.style.minWidth = "";
    state.frame.style.minHeight = "";
    state.frame.style.aspectRatio = `${dimensions[0]} / ${dimensions[1]}`;
    if (dimensions[0] >= dimensions[1]) {
      state.frame.style.width = `${Math.round(scale * 100)}%`;
      state.frame.style.height = "auto";
      state.frame.style.maxWidth = `${Math.round(scale * 100)}%`;
      state.frame.style.maxHeight = `${Math.round(scale * 100)}%`;
    } else {
      state.frame.style.height = `${Math.round(scale * 100)}%`;
      state.frame.style.width = "auto";
      state.frame.style.maxWidth = `${Math.round(scale * 100)}%`;
      state.frame.style.maxHeight = `${Math.round(scale * 100)}%`;
    }
  }

  function hideMakerChrome() {
    if (!document.body) return;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    for (const child of Array.from(document.body.children)) {
      if (child.id === SHELL_ID || child.id === STYLE_ID) continue;
      if (child.tagName === "SCRIPT" || child.tagName === "STYLE") continue;
      child.style.setProperty("display", "none", "important");
      child.style.setProperty("visibility", "hidden", "important");
    }
  }

  function mountInViewport(element) {
    buildShell();
    if (!state.viewport) return false;
    const alreadyMounted = state.isolated && element.parentElement === state.viewport;
    if (!alreadyMounted && element.parentElement !== state.viewport) state.viewport.appendChild(element);
    if (!alreadyMounted) {
      element.setAttribute("data-taptap-maker-preview", "active");
      element.style.setProperty("display", "block", "important");
      element.style.setProperty("visibility", "visible", "important");
      const loading = state.shell.querySelector(".tmp-loading");
      if (loading) loading.dataset.hidden = "true";
      hideMakerChrome();
      applySettings();
    }
    window.__TAPTAP_MAKER_PREVIEW_READY__ = true;
    state.isolated = true;
    return true;
  }

  function isolateGamePage() {
    const root = document.getElementById("root") || document.querySelector("#app") || document.body.firstElementChild;
    if (!root) return false;
    return mountInViewport(root);
  }

  function isolatePreview() {
    if (!document.body) return false;
    if (isGamePage()) return isolateGamePage();

    if (!isProjectPage()) {
      state.isolated = false;
      window.__TAPTAP_MAKER_PREVIEW_READY__ = false;
      return false;
    }

    if (state.isolated && state.viewport && state.viewport.querySelector('iframe[src*="tapapps.cn"]')) {
      window.__TAPTAP_MAKER_PREVIEW_READY__ = true;
      return true;
    }

    const iframe = findGameIframe();
    if (!iframe) {
      state.isolated = false;
      window.__TAPTAP_MAKER_PREVIEW_READY__ = false;
      const existingShell = document.getElementById(SHELL_ID);
      if (existingShell && existingShell.parentElement) {
        existingShell.parentElement.removeChild(existingShell);
      }
      state.shell = null;
      state.stage = null;
      state.frame = null;
      state.viewport = null;
      state.chrome = null;
      requestPreviewTab();
      return false;
    }
    return mountInViewport(iframe);
  }

  function schedule() {
    isolatePreview();
    window.requestAnimationFrame(() => {
      isolatePreview();
    });
    window.setTimeout(() => {
      isolatePreview();
    }, 0);
  }

  window.__TAPTAP_MAKER_PREVIEW_SCHEDULE__ = schedule;

  schedule();
  window.addEventListener("DOMContentLoaded", schedule, { once: false });
  window.addEventListener("load", schedule, { once: false });
  window.addEventListener("resize", () => { applySettings(); schedule(); });
  window.setInterval(schedule, 500);

  new MutationObserver((mutations) => {
    const shouldSchedule = mutations.some((mutation) => {
      const target = mutation.target;
      if (target instanceof Element && target.closest(`#${SHELL_ID}`)) return false;
      return true;
    });
    if (shouldSchedule) schedule();
  }).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src", "class", "style"]
  });
})();
"##;

fn encode_base64(input: &[u8]) -> String {
  const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let mut output = String::with_capacity(((input.len() + 2) / 3) * 4);
  let mut index = 0;
  while index + 3 <= input.len() {
    let chunk = &input[index..index + 3];
    output.push(TABLE[(chunk[0] >> 2) as usize] as char);
    output.push(TABLE[(((chunk[0] & 0b0000_0011) << 4) | (chunk[1] >> 4)) as usize] as char);
    output.push(TABLE[(((chunk[1] & 0b0000_1111) << 2) | (chunk[2] >> 6)) as usize] as char);
    output.push(TABLE[(chunk[2] & 0b0011_1111) as usize] as char);
    index += 3;
  }

  match input.len() - index {
    1 => {
      let byte = input[index];
      output.push(TABLE[(byte >> 2) as usize] as char);
      output.push(TABLE[((byte & 0b0000_0011) << 4) as usize] as char);
      output.push('=');
      output.push('=');
    }
    2 => {
      let first = input[index];
      let second = input[index + 1];
      output.push(TABLE[(first >> 2) as usize] as char);
      output.push(TABLE[(((first & 0b0000_0011) << 4) | (second >> 4)) as usize] as char);
      output.push(TABLE[((second & 0b0000_1111) << 2) as usize] as char);
      output.push('=');
    }
    _ => {}
  }

  output
}

fn maker_preview_shell_style_template(app: Option<&tauri::AppHandle>) -> String {
  if cfg!(debug_assertions) {
    if let Some(app_handle) = app {
      if let Ok(root) = workspace_root(app_handle) {
        let path = root
          .join("src-tauri")
          .join("injected")
          .join("maker-preview-shell.css");
        if let Ok(style) = fs::read_to_string(path) {
          return style;
        }
      }
    }
  }
  MAKER_PREVIEW_SHELL_STYLE_TEMPLATE.to_string()
}

fn maker_preview_shell_style(app: Option<&tauri::AppHandle>) -> String {
  let light_background = format!(
    "data:image/jpeg;base64,{}",
    encode_base64(include_bytes!(
      "../../apps/web/public/taptap-backgrounds/bg-pattern_white.jpg"
    ))
  );
  let dark_background = format!(
    "data:image/png;base64,{}",
    encode_base64(include_bytes!(
      "../../apps/web/public/taptap-backgrounds/bg-pattern_black.png"
    ))
  );
  maker_preview_shell_style_template(app)
    .replace("__TAPTAP_MAKER_LIGHT_BACKGROUND__", &light_background)
    .replace("__TAPTAP_MAKER_DARK_BACKGROUND__", &dark_background)
}

fn maker_preview_init_script() -> &'static str {
  MAKER_PREVIEW_INIT_SCRIPT.get_or_init(|| {
    let shell_style = maker_preview_shell_style(None);
    let shell_style = serde_json::to_string(&shell_style).unwrap_or_else(|_| "\"\"".to_string());
    MAKER_PREVIEW_INIT_SCRIPT_TEMPLATE
      .replace("__TAPTAP_MAKER_SHELL_STYLE__", &shell_style)
  })
}

#[cfg(debug_assertions)]
fn start_maker_preview_shell_style_dev_watcher(app: tauri::AppHandle) {
  thread::spawn(move || {
    let Ok(root) = workspace_root(&app) else {
      return;
    };
    let path = root
      .join("src-tauri")
      .join("injected")
      .join("maker-preview-shell.css");
    let mut last_modified = fs::metadata(&path).and_then(|metadata| metadata.modified()).ok();
    loop {
      thread::sleep(Duration::from_millis(500));
      let modified = fs::metadata(&path).and_then(|metadata| metadata.modified()).ok();
      if modified.is_none() || modified == last_modified {
        continue;
      }
      last_modified = modified;
      let _ = maker_preview_reload_shell_style(app.clone());
    }
  });
}

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
  webview: Arc<Mutex<Option<Webview>>>,
  project_id: Arc<Mutex<Option<String>>>,
  loading: Arc<Mutex<bool>>,
  probe_id: Arc<Mutex<u64>>,
}

#[derive(Clone, Default)]
struct MakerPreviewReadyProbeSnapshot {
  ready: bool,
  href: Option<String>,
  game_iframe_src: Option<String>,
  game_page: bool,
  shell_installed: bool,
  shell_has_viewport: bool,
  shell_child_count: u64,
  raw: String,
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
    if self
      .child
      .lock()
      .map_err(|error| error.to_string())?
      .is_some()
    {
      return Ok(());
    }

    let app_data_dir = app
      .path()
      .app_data_dir()
      .map_err(|error| error.to_string())?;
    let npm_cache_dir = app_data_dir.join("npm-cache");
    let mcp_log_dir = app_data_dir.join("mcp-logs");
    let desktop_log_path = app_data_dir.join("desktop.log");
    let server_log_path = app_data_dir.join("server.log");
    fs::create_dir_all(&npm_cache_dir).map_err(|error| error.to_string())?;
    fs::create_dir_all(&mcp_log_dir).map_err(|error| error.to_string())?;

    let workspace_root = normalize_windows_path(workspace_root(app)?);
    append_log(
      &desktop_log_path,
      &format!("starting Fastify from {}", workspace_root.display()),
    );
    append_log(
      &desktop_log_path,
      &format!("server log {}", server_log_path.display()),
    );
    let resource_report = check_startup_resources(&workspace_root);
    if !resource_report.ok {
      for missing_path in &resource_report.missing {
        append_log(
          &desktop_log_path,
          &format!("missing startup resource: {}", missing_path.display()),
        );
      }
      return Err(format_missing_startup_resources(&resource_report.missing));
    }
    seed_maker_npm_cache(&workspace_root, &npm_cache_dir, &desktop_log_path);
    let server_port =
      find_available_local_port(SERVER_HOST, SERVER_PORT_NUMBER, SERVER_PORT_SCAN_LIMIT)
        .ok_or_else(|| format!("Unable to find available local port from {SERVER_PORT_NUMBER}"))?;
    let instance_token = make_desktop_instance_token();
    append_log(
      &desktop_log_path,
      &format!("Fastify target port {server_port}"),
    );
    let mut command = server_command(&workspace_root);
    let node_runtime_dir = workspace_root.join("node-runtime");
    let server_stdout = OpenOptions::new()
      .create(true)
      .append(true)
      .open(&server_log_path)
      .map_err(|error| error.to_string())?;
    let server_stderr = server_stdout
      .try_clone()
      .map_err(|error| error.to_string())?;
    command
      .current_dir(&workspace_root)
      .env(
        "NODE_ENV",
        if cfg!(debug_assertions) {
          "development"
        } else {
          "production"
        },
      )
      .env("TAPTAP_WORKSPACE_ROOT", &workspace_root)
      .env(
        "TAPTAP_WEB_DIST_DIR",
        workspace_root.join("apps").join("web").join("dist"),
      )
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
    append_log(
      &desktop_log_path,
      &format!("Fastify child pid {}", child.id()),
    );
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
  let escaped_detail =
    serde_json::to_string(detail).unwrap_or_else(|_| "\"Desktop startup failed\"".to_string());
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
    workspace_root
      .join("apps")
      .join("server")
      .join("dist")
      .join("index.js"),
    workspace_root
      .join("apps")
      .join("web")
      .join("dist")
      .join("index.html"),
    workspace_root
      .join("node_modules")
      .join("better-sqlite3")
      .join("build")
      .join("Release")
      .join("better_sqlite3.node"),
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
      workspace_root
        .join("node-runtime")
        .join(if cfg!(windows) { "npm.cmd" } else { "npm" }),
      workspace_root
        .join("node-runtime")
        .join(if cfg!(windows) { "npx.cmd" } else { "npx" }),
    ];
    for file_path in required_release_files {
      if !file_path.is_file() {
        missing.push(file_path);
      }
    }
    if !has_cached_maker_package(&workspace_root.join("data").join("npm-cache")) {
      missing.push(
        workspace_root
          .join("data")
          .join("npm-cache")
          .join("_npx")
          .join("@taptap-maker"),
      );
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
    append_log(
      desktop_log_path,
      &format!(
        "bundled maker npm cache seed not found: {}",
        seed_dir.display()
      ),
    );
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
      &format!(
        "seeded maker npm cache from {} to {}",
        seed_dir.display(),
        npm_cache_dir.display()
      ),
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
  Ok(
    app
      .path()
      .app_data_dir()
      .map_err(|error| error.to_string())?
      .join(SETTINGS_FILE_NAME),
  )
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
    append_log(
      &log_path,
      "unable to resolve app local data dir for webview cache maintenance",
    );
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
    Path::new("Default")
      .join("Service Worker")
      .join("CacheStorage"),
    Path::new("Default")
      .join("Service Worker")
      .join("ScriptCache"),
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
    remove_webview_cache_path(
      &app_local_data_dir,
      &webview_root.join(relative_path),
      &log_path,
    );
  }

  if let Err(error) = fs::create_dir_all(&app_local_data_dir) {
    append_log(
      &log_path,
      &format!("failed to create app local data dir: {error}"),
    );
    return;
  }
  if let Err(error) = fs::write(&marker_path, APP_PACKAGE_VERSION) {
    append_log(
      &log_path,
      &format!("failed to write webview cache version marker: {error}"),
    );
  }
}

fn remove_webview_cache_path(base_dir: &Path, target_path: &Path, log_path: &Path) {
  if !target_path.exists() {
    return;
  }

  let Ok(base_dir) = base_dir.canonicalize() else {
    append_log(
      log_path,
      "failed to canonicalize app local data dir before cache cleanup",
    );
    return;
  };
  let Ok(canonical_target) = target_path.canonicalize() else {
    append_log(
      log_path,
      &format!(
        "failed to canonicalize webview cache path {}",
        target_path.display()
      ),
    );
    return;
  };
  if !canonical_target.starts_with(&base_dir) {
    append_log(
      log_path,
      &format!(
        "refused to remove webview cache path outside app local data dir: {}",
        canonical_target.display()
      ),
    );
    return;
  }

  let result = if canonical_target.is_dir() {
    fs::remove_dir_all(&canonical_target)
  } else {
    fs::remove_file(&canonical_target)
  };
  match result {
    Ok(()) => append_log(
      log_path,
      &format!("removed webview cache path {}", canonical_target.display()),
    ),
    Err(error) => append_log(
      log_path,
      &format!(
        "failed to remove webview cache path {}: {error}",
        canonical_target.display()
      ),
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

  Ok(
    app
      .path()
      .resource_dir()
      .map_err(|error| error.to_string())?,
  )
}

fn server_command(workspace_root: &Path) -> Command {
  if cfg!(debug_assertions) {
    let mut command = Command::new("cmd.exe");
    command.args(["/d", "/s", "/c", "npm.cmd", "run", "dev:server"]);
    hide_command_window(&mut command);
    return command;
  }

  let node_exe =
    workspace_root
      .join("node-runtime")
      .join(if cfg!(windows) { "node.exe" } else { "node" });
  let mut command = Command::new(node_exe);
  command.arg(
    workspace_root
      .join("apps")
      .join("server")
      .join("dist")
      .join("index.js"),
  );
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

fn wait_for_desktop_server_identity_until_ready(
  host: &'static str,
  port: u16,
  instance_token: &str,
  desktop_log_path: &Path,
) -> bool {
  let mut attempts = 0u32;
  loop {
    attempts += 1;
    if has_readiness_identity(host, port, instance_token) && has_web_identity(host, port) {
      if attempts > 1 {
        append_log(
          desktop_log_path,
          &format!("desktop server identity ready after retry batch {attempts}"),
        );
      }
      return true;
    }
    if attempts % 120 == 0 {
      append_log(
        desktop_log_path,
        "still waiting for desktop server identity",
      );
    }
    if attempts >= SERVER_READY_MAX_ATTEMPTS {
      append_log(
        desktop_log_path,
        "timed out waiting for desktop server identity",
      );
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
    let web_ready = web_probes
      .iter()
      .any(|probe| has_web_identity(probe.host, probe.port));
    let server_ready = has_readiness_identity(server_host, server_port, instance_token);
    if web_ready && server_ready {
      if attempts > 1 {
        append_log(
          desktop_log_path,
          &format!("dev desktop identity ready after retry batch {attempts}"),
        );
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
    assert!(!response_has_readiness_identity(
      wrong_token_response,
      token
    ));
    assert!(!response_has_readiness_identity(&wrong_app_response, token));
  }

  #[test]
  fn maker_preview_ready_probe_value_extracts_game_iframe_src() {
    let value = r#"{"ready":true,"href":"https://maker.taptap.cn/app/test-project","gameIframeSrc":"https://test-project.games.tapapps.cn/play?token=abc","gamePage":false}"#;

    let snapshot = maker_preview_ready_probe_value(value);

    assert!(snapshot.ready);
    assert_eq!(
      snapshot.href.as_deref(),
      Some("https://maker.taptap.cn/app/test-project")
    );
    assert_eq!(
      snapshot.game_iframe_src.as_deref(),
      Some("https://test-project.games.tapapps.cn/play?token=abc")
    );
    assert!(!snapshot.game_page);
    assert!(snapshot.raw.contains("gameIframeSrc"));
  }

  #[test]
  fn maker_preview_should_probe_only_remote_preview_pages() {
    let project_url =
      Url::parse("https://maker.taptap.cn/app/test-project").expect("parse project url");
    let game_url =
      Url::parse("https://test-project.games.tapapps.cn/play").expect("parse game url");
    let loading_url =
      Url::parse("tauri://localhost/desktop-loading.html").expect("parse loading url");
    let maker_home_url = Url::parse("https://maker.taptap.cn/").expect("parse maker home url");

    assert!(maker_preview_should_probe_url(&project_url));
    assert!(maker_preview_should_probe_url(&game_url));
    assert!(!maker_preview_should_probe_url(&loading_url));
    assert!(!maker_preview_should_probe_url(&maker_home_url));
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
  Url::parse(&format!(
    "https://maker.taptap.cn/app/{project_id}?hide_chat=1&tab=preview"
  ))
    .map_err(|error| error.to_string())
}

fn maker_preview_should_probe_url(url: &Url) -> bool {
  if url.scheme() != "https" {
    return false;
  }
  let Some(host) = url.host_str() else {
    return false;
  };
  (host == "maker.taptap.cn" && url.path().starts_with("/app/"))
    || host.ends_with("games.tapapps.cn")
}

fn maker_home_url() -> Result<Url, String> {
  Url::parse("https://maker.taptap.cn/").map_err(|error| error.to_string())
}

fn maker_preview_webview(app: &tauri::AppHandle) -> Result<Webview, String> {
  let state = app.state::<MakerPreviewState>();
  if let Some(webview) = state
    .webview
    .lock()
    .map_err(|error| error.to_string())?
    .as_ref()
    .cloned()
  {
    return Ok(webview);
  }
  if let Some(webview) = app.get_webview(MAKER_PREVIEW_WEBVIEW_LABEL) {
    append_desktop_event_log(app, "maker preview webview handle recovered");
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
        const iframeElements = Array.from(document.querySelectorAll('iframe'));
        const iframeSources = iframeElements
          .map((item) => item.src || item.getAttribute('src') || '')
          .filter(Boolean)
          .slice(0, 12);
        const controlNames = Array.from(document.querySelectorAll('button, a, [role="button"], [role="tab"]'))
          .filter((item) => !item.closest('#taptap-maker-preview-shell'))
          .map((item) => [item.getAttribute('aria-label'), item.getAttribute('title'), item.textContent].filter(Boolean).join(' ').trim())
          .filter(Boolean)
          .slice(0, 20);
        const iframe = document.querySelector('iframe[src*="games.tapapps.cn"], iframe[src*=".games.tapapps.cn"], iframe[src*="tapapps.cn"]');
        const shell = document.getElementById('taptap-maker-preview-shell');
        const shellViewport = shell ? shell.querySelector('.tmp-viewport') : null;
        const shellChildCount = shellViewport ? shellViewport.children.length : 0;
        const shellReady = Boolean(shell && shellViewport && shellChildCount > 0);
        return {{
          ready: shellReady && Boolean(window.__TAPTAP_MAKER_PREVIEW_READY__),
          href: location.href,
          host: location.hostname,
          pathname: location.pathname,
          documentReadyState: document.readyState,
          bodyChildCount: document.body ? document.body.children.length : 0,
          iframeCount: iframeElements.length,
          iframeSources,
          controlNames,
          gameIframeSrc: iframe && iframe.src ? iframe.src : null,
          gamePage: location.hostname.endsWith("games.tapapps.cn"),
          shellInstalled: Boolean(shell),
          shellHasViewport: Boolean(shellViewport),
          shellChildCount,
          isolatorInstalled: Boolean(window.__TAPTAP_MAKER_PREVIEW_ISOLATOR__)
        }};
      }} catch (error) {{
        return {{
          ready: false,
          href: location && location.href ? location.href : null,
          error: error && error.message ? error.message : String(error)
        }};
      }}
    }})()"#,
    script = maker_preview_init_script(),
  )
}

fn maker_preview_ready_probe_value(value: &str) -> MakerPreviewReadyProbeSnapshot {
  let raw = value.chars().take(2048).collect::<String>();
  let Ok(parsed) = serde_json::from_str::<serde_json::Value>(value) else {
    return MakerPreviewReadyProbeSnapshot {
      ready: value.contains("true"),
      raw,
      ..Default::default()
    };
  };
  let ready = parsed
    .get("ready")
    .and_then(|item| item.as_bool())
    .unwrap_or(false);
  let href = parsed
    .get("href")
    .and_then(|item| item.as_str())
    .map(str::to_string);
  let game_iframe_src = parsed
    .get("gameIframeSrc")
    .and_then(|item| item.as_str())
    .map(str::to_string);
  let game_page = parsed
    .get("gamePage")
    .and_then(|item| item.as_bool())
    .unwrap_or(false);
  let shell_installed = parsed
    .get("shellInstalled")
    .and_then(|item| item.as_bool())
    .unwrap_or(false);
  let shell_has_viewport = parsed
    .get("shellHasViewport")
    .and_then(|item| item.as_bool())
    .unwrap_or(false);
  let shell_child_count = parsed
    .get("shellChildCount")
    .and_then(|item| item.as_u64())
    .unwrap_or(0);
  MakerPreviewReadyProbeSnapshot {
    ready,
    href,
    game_iframe_src,
    game_page,
    shell_installed,
    shell_has_viewport,
    shell_child_count,
    raw,
  }
}

fn next_maker_preview_probe_id(state: &MakerPreviewState) -> Result<u64, String> {
  let mut probe_id = state.probe_id.lock().map_err(|error| error.to_string())?;
  *probe_id = probe_id.wrapping_add(1).max(1);
  Ok(*probe_id)
}

fn maker_preview_probe_is_current(state: &MakerPreviewState, probe_id: u64) -> bool {
  state
    .probe_id
    .lock()
    .map(|current| *current == probe_id)
    .unwrap_or(false)
}

fn start_maker_preview_ready_probe(app: tauri::AppHandle, webview: Webview, probe_id: u64) {
  thread::spawn(move || {
    let mut last_snapshot: Option<MakerPreviewReadyProbeSnapshot> = None;
    let mut last_eval_error: Option<String> = None;
    for _attempt in 0..80 {
      let (sender, receiver) = std::sync::mpsc::channel::<String>();
      let eval_result =
        webview.eval_with_callback(maker_preview_ready_probe_script(), move |value| {
          let _ = sender.send(value);
        });
      if eval_result.is_ok() {
        if let Ok(value) = receiver.recv_timeout(Duration::from_millis(250)) {
          let snapshot = maker_preview_ready_probe_value(&value);
          if snapshot.ready {
            if let Some(state) = app.try_state::<MakerPreviewState>() {
              if !maker_preview_probe_is_current(&state, probe_id) {
                append_desktop_event_log(&app, "maker preview stale ready probe ignored");
                return;
              }
              if let Ok(mut loading) = state.loading.lock() {
                *loading = false;
              }
            }
            append_desktop_event_log(
              &app,
              &format!(
                "maker preview ready: href={}, gameIframeSrc={}, gamePage={}, shellInstalled={}, shellHasViewport={}, shellChildCount={}",
                snapshot.href.as_deref().unwrap_or(""),
                snapshot.game_iframe_src.as_deref().unwrap_or(""),
                snapshot.game_page,
                snapshot.shell_installed,
                snapshot.shell_has_viewport,
                snapshot.shell_child_count,
              ),
            );
            let _ = app.emit(
              MAKER_PREVIEW_LOAD_EVENT,
              serde_json::json!({
                "event": "ready",
                "href": snapshot.href,
                "gameIframeSrc": snapshot.game_iframe_src,
                "gamePage": snapshot.game_page,
                "shellInstalled": snapshot.shell_installed,
                "shellHasViewport": snapshot.shell_has_viewport,
                "shellChildCount": snapshot.shell_child_count,
              }),
            );
            return;
          }
          last_snapshot = Some(snapshot);
        }
      } else if let Err(error) = eval_result {
        last_eval_error = Some(error.to_string());
      }
      thread::sleep(Duration::from_millis(100));
    }

    let timeout_snapshot = last_snapshot.clone();
    let timeout_eval_error = last_eval_error.clone();
    let timeout_detail = match (last_snapshot, last_eval_error) {
      (Some(snapshot), Some(eval_error)) => format!(
        "maker preview ready probe timed out: lastSnapshot={}, lastEvalError={}",
        snapshot.raw, eval_error,
      ),
      (Some(snapshot), None) => format!(
        "maker preview ready probe timed out: lastSnapshot={}",
        snapshot.raw,
      ),
      (None, Some(eval_error)) => format!(
        "maker preview ready probe timed out: lastEvalError={}",
        eval_error,
      ),
      (None, None) => "maker preview ready probe timed out: no snapshot".to_string(),
    };
    append_desktop_event_log(&app, &timeout_detail);
    if let Some(state) = app.try_state::<MakerPreviewState>() {
      if !maker_preview_probe_is_current(&state, probe_id) {
        append_desktop_event_log(&app, "maker preview stale ready timeout ignored");
        return;
      }
      if let Ok(mut loading) = state.loading.lock() {
        *loading = false;
      }
      if let Ok(mut stored_webview) = state.webview.lock() {
        *stored_webview = None;
      }
      if let Ok(mut project_id) = state.project_id.lock() {
        *project_id = None;
      }
    }
    let _ = webview.close();
    let _ = app.emit(
      MAKER_PREVIEW_LOAD_EVENT,
      serde_json::json!({
        "event": "ready-timeout",
        "href": timeout_snapshot.as_ref().and_then(|snapshot| snapshot.href.clone()),
        "gameIframeSrc": timeout_snapshot.as_ref().and_then(|snapshot| snapshot.game_iframe_src.clone()),
        "gamePage": timeout_snapshot.as_ref().map(|snapshot| snapshot.game_page),
        "probeSnapshot": timeout_snapshot.as_ref().map(|snapshot| snapshot.raw.clone()),
        "probeError": timeout_eval_error,
      }),
    );
  });
}

#[tauri::command]
async fn maker_preview_open(app: tauri::AppHandle, project_id: String) -> Result<(), String> {
  let url = maker_preview_url(&project_id)?;
  let state = app.state::<MakerPreviewState>();
  append_desktop_event_log(
    &app,
    &format!("maker preview open requested: {}", safe_url_for_log(&url)),
  );

  if let Some(webview) = state
    .webview
    .lock()
    .map_err(|error| error.to_string())?
    .as_ref()
    .cloned()
  {
    let current_project_id = state
      .project_id
      .lock()
      .map_err(|error| error.to_string())?
      .clone();
    if current_project_id.as_deref() == Some(project_id.as_str()) {
      append_desktop_event_log(&app, "maker preview reused with navigation");
      *state.loading.lock().map_err(|error| error.to_string())? = true;
      next_maker_preview_probe_id(&state)?;
      webview.hide().map_err(|error| error.to_string())?;
      webview.navigate(url).map_err(|error| error.to_string())?;
      return Ok(());
    }
    *state.loading.lock().map_err(|error| error.to_string())? = true;
    next_maker_preview_probe_id(&state)?;
    webview.hide().map_err(|error| error.to_string())?;
    webview.navigate(url).map_err(|error| error.to_string())?;
    *state.project_id.lock().map_err(|error| error.to_string())? = Some(project_id);
    return Ok(());
  }

  if let Some(webview) = app.get_webview(MAKER_PREVIEW_WEBVIEW_LABEL) {
    append_desktop_event_log(&app, "maker preview webview recovered");
    let current_project_id = state
      .project_id
      .lock()
      .map_err(|error| error.to_string())?
      .clone();
    if current_project_id.as_deref() == Some(project_id.as_str()) {
      append_desktop_event_log(&app, "maker preview webview recovered with navigation");
      *state.loading.lock().map_err(|error| error.to_string())? = true;
      next_maker_preview_probe_id(&state)?;
      webview.hide().map_err(|error| error.to_string())?;
      webview.navigate(url).map_err(|error| error.to_string())?;
      *state.webview.lock().map_err(|error| error.to_string())? = Some(webview);
      return Ok(());
    }
    *state.loading.lock().map_err(|error| error.to_string())? = true;
    next_maker_preview_probe_id(&state)?;
    webview.hide().map_err(|error| error.to_string())?;
    webview.navigate(url).map_err(|error| error.to_string())?;
    *state.webview.lock().map_err(|error| error.to_string())? = Some(webview);
    *state.project_id.lock().map_err(|error| error.to_string())? = Some(project_id);
    return Ok(());
  }

  let Some(main_window) = app.get_window("main") else {
    return Err("Unable to find main window".to_string());
  };
  *state.loading.lock().map_err(|error| error.to_string())? = true;
  next_maker_preview_probe_id(&state)?;
  let app_for_load = app.clone();
  append_desktop_event_log(&app, "maker preview child webview build starting");
  let webview_builder = WebviewBuilder::new(
    MAKER_PREVIEW_WEBVIEW_LABEL,
    tauri::WebviewUrl::App("desktop-loading.html".into()),
  )
  .on_navigation(|url| {
    eprintln!("[maker-preview-navigation] {url}");
    true
  })
  .initialization_script(maker_preview_init_script())
  .on_page_load(move |webview, payload| {
    let event = match payload.event() {
      PageLoadEvent::Started => "started",
      PageLoadEvent::Finished => "finished",
    };
    append_desktop_event_log(
      &app_for_load,
      &format!(
        "maker preview page load {event}: {}",
        safe_url_for_log(payload.url())
      ),
    );
    if matches!(payload.event(), PageLoadEvent::Started) {
      let _ = webview.hide();
      if let Some(state) = app_for_load.try_state::<MakerPreviewState>() {
        if let Ok(mut loading) = state.loading.lock() {
          *loading = true;
        }
      }
    }
    if matches!(payload.event(), PageLoadEvent::Finished)
      && maker_preview_should_probe_url(payload.url())
    {
      if let Some(state) = app_for_load.try_state::<MakerPreviewState>() {
        if let Ok(probe_id) = state.probe_id.lock().map(|item| *item) {
          start_maker_preview_ready_probe(app_for_load.clone(), webview.clone(), probe_id);
        }
      }
    }
    let _ = app_for_load.emit(
      MAKER_PREVIEW_LOAD_EVENT,
      serde_json::json!({
        "event": event,
        "url": safe_url_for_log(payload.url()),
      }),
    );
  });
  let webview = main_window
    .add_child(
      webview_builder,
      LogicalPosition::new(0.0, 0.0),
      Size::Logical(LogicalSize::new(1.0, 1.0)),
    )
    .map_err(|error| error.to_string())?;
  append_desktop_event_log(&app, "maker preview child webview built");
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
  append_desktop_event_log(
    &app,
    &format!(
      "maker login window open requested: {}",
      safe_url_for_log(&url)
    ),
  );

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
    append_desktop_event_log(
      &app_for_navigation,
      &format!("maker login navigation: {}", safe_url_for_log(url)),
    );
    true
  })
  .on_page_load(move |_window, payload| {
    let event = match payload.event() {
      PageLoadEvent::Started => "started",
      PageLoadEvent::Finished => "finished",
    };
    append_desktop_event_log(
      &app_for_load,
      &format!(
        "maker login page load {event}: {}",
        safe_url_for_log(payload.url())
      ),
    );
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
async fn maker_preview_confirm_logged_in(
  app: tauri::AppHandle,
  project_id: String,
) -> Result<(), String> {
  append_desktop_event_log(&app, "maker login confirmation requested");

  maker_preview_open(app.clone(), project_id).await?;
  maker_preview_reload(app)
}

#[tauri::command]
fn maker_preview_set_bounds(
  app: tauri::AppHandle,
  x: f64,
  y: f64,
  width: f64,
  height: f64,
  scale_factor: f64,
) -> Result<(), String> {
  if width <= 0.0 || height <= 0.0 || scale_factor <= 0.0 {
    return maker_preview_hide(app);
  }
  let webview = maker_preview_webview(&app)?;
  let x = (x * scale_factor).round() as i32;
  let y = (y * scale_factor).round() as i32;
  let width = (width * scale_factor).round().max(1.0) as u32;
  let height = (height * scale_factor).round().max(1.0) as u32;
  webview
    .set_bounds(tauri::Rect {
      position: tauri::Position::Physical(PhysicalPosition::new(x, y)),
      size: tauri::Size::Physical(PhysicalSize::new(width, height)),
    })
    .map_err(|error| error.to_string())?;
  if *app
    .state::<MakerPreviewState>()
    .loading
    .lock()
    .map_err(|error| error.to_string())?
  {
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
  maker_preview_webview(&app)?
    .show()
    .map_err(|error| error.to_string())
}

#[tauri::command]
fn maker_preview_set_theme(app: tauri::AppHandle, theme: String) -> Result<(), String> {
  let normalized = if theme == "dark" { "dark" } else { "light" };
  if let Ok(webview) = maker_preview_webview(&app) {
    let script = format!(
      "if (typeof window.__TAPTAP_MAKER_PREVIEW_SET_THEME__ === 'function') window.__TAPTAP_MAKER_PREVIEW_SET_THEME__({}); else {{ const shell = document.getElementById('taptap-maker-preview-shell'); if (shell) shell.dataset.theme = {}; }}",
      serde_json::to_string(normalized).map_err(|error| error.to_string())?,
      serde_json::to_string(normalized).map_err(|error| error.to_string())?,
    );
    webview.eval(&script).map_err(|error| error.to_string())?;
  }
  Ok(())
}

#[tauri::command]
fn maker_preview_reload_shell_style(app: tauri::AppHandle) -> Result<(), String> {
  let webview = maker_preview_webview(&app)?;
  let shell_style = serde_json::to_string(&maker_preview_shell_style(Some(&app)))
    .map_err(|error| error.to_string())?;
  let script = format!(
    r#"(() => {{
      const style = document.getElementById("taptap-maker-preview-style");
      if (!style) return false;
      style.textContent = {};
      return true;
    }})()"#,
    shell_style
  );
  webview.eval(&script).map_err(|error| error.to_string())?;
  append_desktop_event_log(&app, "maker preview shell style reloaded");
  Ok(())
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
  next_maker_preview_probe_id(&state)?;
  let webview = maker_preview_webview(&app)?;
  webview.hide().map_err(|error| error.to_string())?;
  webview
    .navigate(maker_preview_url(&project_id)?)
    .map_err(|error| error.to_string())
}

#[tauri::command]
fn maker_preview_close(app: tauri::AppHandle) -> Result<(), String> {
  let state = app.state::<MakerPreviewState>();
  next_maker_preview_probe_id(&state)?;
  let webview = state
    .webview
    .lock()
    .map_err(|error| error.to_string())?
    .take();
  if let Some(webview) = webview {
    webview.close().map_err(|error| error.to_string())?;
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
    }
    "close" => window.close().map_err(|error| error.to_string()),
    _ => Err(format!("Unsupported desktop window action: {action}")),
  }
}

#[tauri::command]
fn read_settings_preferences_file(
  app: tauri::AppHandle,
) -> Result<SettingsPreferencesFileResponse, String> {
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
  let file =
    serde_json::from_str::<SettingsPreferencesFile>(&raw).map_err(|error| error.to_string())?;
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
      let window_config = app.config().app.windows.first().ok_or_else(|| {
        tauri::Error::Io(std::io::Error::new(
          std::io::ErrorKind::Other,
          "Missing main window config",
        ))
      })?;
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
          append_log(
            &app_data_dir.join("desktop.log"),
            &format!("failed to start Fastify: {error}"),
          );
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
          append_log(
            &app_data_dir.join("desktop.log"),
            &format!("failed to read Fastify launch: {error}"),
          );
        }
        tauri::Error::Io(std::io::Error::new(std::io::ErrorKind::Other, error))
      })?;
      app.manage(server.clone());
      app.manage(MakerPreviewState::default());
      #[cfg(debug_assertions)]
      start_maker_preview_shell_style_dev_watcher(app.handle().clone());

      let dev_web_probes = [LocalPortProbe {
        host: "127.0.0.1",
        port: DEV_WEB_PORT_NUMBER,
      }];
      let desktop_log_path = app
        .path()
        .app_data_dir()
        .map(|dir| dir.join("desktop.log"))
        .ok();
      thread::spawn(move || {
        let ready = if cfg!(debug_assertions) {
          wait_for_dev_desktop_identity_until_ready(
            &dev_web_probes,
            SERVER_HOST,
            server_launch.port,
            &server_launch.instance_token,
            desktop_log_path
              .as_deref()
              .unwrap_or_else(|| Path::new("desktop.log")),
          )
        } else {
          wait_for_desktop_server_identity_until_ready(
            SERVER_HOST,
            server_launch.port,
            &server_launch.instance_token,
            desktop_log_path
              .as_deref()
              .unwrap_or_else(|| Path::new("desktop.log")),
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
      maker_preview_reload_shell_style,
      maker_preview_set_bounds,
      maker_preview_set_theme,
      maker_preview_show,
      open_devtools,
      open_external_url,
      read_settings_preferences_file,
      write_settings_preferences_file
    ])
    .build(tauri::generate_context!())
    .expect("error while building tauri application");

  app.run(move |app_handle, event| match event {
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
  });
}
