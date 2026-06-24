import { appendFrontendDiagnostics, type FrontendDiagnosticEntry } from "../api";

export type DeveloperLogLevel = "info" | "warn" | "error";

export type DeveloperLogEntry = FrontendDiagnosticEntry & {
  id: string;
  timestamp: string;
  level: DeveloperLogLevel;
  source: "console" | "window" | "promise" | "fetch" | "devtools";
  message: string;
  detail?: string;
};

const DEVELOPER_MODE_STORAGE_KEY = "taptap.developerMode";
const DEVELOPER_LOG_EVENT = "taptap:developer-log";
const DEVELOPER_MODE_EVENT = "taptap:developer-mode-change";
const MAX_LOG_ENTRIES = 200;

let installed = false;
let entries: DeveloperLogEntry[] = [];
let pendingRemoteEntries: DeveloperLogEntry[] = [];
let flushTimer: number | undefined;

export function isDeveloperModeEnabled() {
  return localStorage.getItem(DEVELOPER_MODE_STORAGE_KEY) === "true";
}

export function setDeveloperModeEnabled(enabled: boolean) {
  localStorage.setItem(DEVELOPER_MODE_STORAGE_KEY, enabled ? "true" : "false");
  window.dispatchEvent(
    new CustomEvent(DEVELOPER_MODE_EVENT, { detail: { enabled } }),
  );
}

export function subscribeDeveloperMode(listener: (enabled: boolean) => void) {
  const handler = () => listener(isDeveloperModeEnabled());
  window.addEventListener(DEVELOPER_MODE_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(DEVELOPER_MODE_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

export function getDeveloperLogEntries() {
  return entries;
}

export function clearDeveloperLogEntries() {
  entries = [];
  window.dispatchEvent(new CustomEvent(DEVELOPER_LOG_EVENT));
}

export function subscribeDeveloperLogs(listener: () => void) {
  window.addEventListener(DEVELOPER_LOG_EVENT, listener);
  return () => window.removeEventListener(DEVELOPER_LOG_EVENT, listener);
}

export function addDeveloperLogEntry(
  level: DeveloperLogLevel,
  source: DeveloperLogEntry["source"],
  message: string,
  detail?: string,
) {
  const entry: DeveloperLogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    level,
    source,
    message,
    detail,
  };
  entries = [entry, ...entries].slice(0, MAX_LOG_ENTRIES);
  enqueueRemoteLogEntry(entry);
  window.dispatchEvent(new CustomEvent(DEVELOPER_LOG_EVENT));
}

export function formatDeveloperLogsForDisplay() {
  if (entries.length === 0) return "";
  return entries
    .map((entry) => {
      const header = `[${entry.timestamp}] ${entry.level.toUpperCase()} ${entry.source}: ${entry.message}`;
      return entry.detail ? `${header}\n${entry.detail}` : header;
    })
    .join("\n\n");
}

export async function openDesktopDevtools() {
  if (!isDeveloperModeEnabled()) {
    addDeveloperLogEntry(
      "warn",
      "devtools",
      "开发者模式未开启，已拦截 DevTools 快捷键。",
    );
    return;
  }

  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("open_devtools");
    addDeveloperLogEntry("info", "devtools", "已请求打开 DevTools。");
  } catch (error) {
    addDeveloperLogEntry(
      "error",
      "devtools",
      "打开 DevTools 失败。",
      formatUnknownValue(error),
    );
  }
}

export function installDeveloperDiagnostics() {
  if (installed) return;
  installed = true;

  const originalError = console.error.bind(console);
  const originalWarn = console.warn.bind(console);
  const originalFetch = window.fetch.bind(window);

  console.error = (...args: unknown[]) => {
    const message = formatConsoleArgs(args);
    if (!shouldIgnoreDeveloperLog(message)) {
      addDeveloperLogEntry("error", "console", message);
    }
    originalError(...args);
  };

  console.warn = (...args: unknown[]) => {
    const message = formatConsoleArgs(args);
    if (!shouldIgnoreDeveloperLog(message)) {
      addDeveloperLogEntry("warn", "console", message);
    }
    originalWarn(...args);
  };

  window.fetch = async (...args) => {
    const request = args[0];
    const url =
      typeof request === "string"
        ? request
        : request instanceof URL
          ? request.toString()
          : request.url;
    try {
      return await originalFetch(...args);
    } catch (error) {
      if (!url.includes("/api/developer/frontend-diagnostics")) {
        addDeveloperLogEntry(
          "error",
          "fetch",
          `请求失败：${url}`,
          formatUnknownValue(error),
        );
      }
      throw error;
    }
  };

  window.addEventListener("error", (event) => {
    addDeveloperLogEntry(
      "error",
      "window",
      event.message,
      [event.filename, event.lineno, event.colno].filter(Boolean).join(":"),
    );
  });

  window.addEventListener("unhandledrejection", (event) => {
    addDeveloperLogEntry(
      "error",
      "promise",
      "未处理的 Promise 异常。",
      formatUnknownValue(event.reason),
    );
  });

  window.addEventListener(
    "keydown",
    (event) => {
      const key = event.key.toLowerCase();
      const wantsDevtools =
        event.key === "F12" ||
        ((event.ctrlKey || event.metaKey) && event.shiftKey && key === "i");
      if (!wantsDevtools) return;

      event.preventDefault();
      event.stopPropagation();
      void openDesktopDevtools();
    },
    true,
  );
}

function formatConsoleArgs(args: unknown[]) {
  return args.map(formatUnknownValue).join(" ");
}

function formatUnknownValue(value: unknown) {
  if (value instanceof Error) {
    return value.stack || value.message;
  }
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function shouldIgnoreDeveloperLog(message: string) {
  return (
    message.includes("Lit is in dev mode") ||
    message.includes("Download the React DevTools")
  );
}

function enqueueRemoteLogEntry(entry: DeveloperLogEntry) {
  pendingRemoteEntries.push(entry);
  if (pendingRemoteEntries.length > 50) {
    pendingRemoteEntries = pendingRemoteEntries.slice(-50);
  }
  if (flushTimer !== undefined) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = undefined;
    void flushRemoteLogEntries();
  }, 250);
}

async function flushRemoteLogEntries() {
  if (pendingRemoteEntries.length === 0) return;
  const batch = pendingRemoteEntries.splice(0, 20);
  try {
    await appendFrontendDiagnostics(batch);
  } catch {
    pendingRemoteEntries = [...batch, ...pendingRemoteEntries].slice(0, 50);
  }
}
