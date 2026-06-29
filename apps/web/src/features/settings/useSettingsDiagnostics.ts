import { useEffect, useState } from "react";
import {
  clearFrontendDiagnostics,
  createDiagnosticBundle,
  diagnosticBundleDownloadUrl,
  getDesktopResourceReadiness,
  listFrontendDiagnostics,
  type FrontendDiagnosticEntry,
} from "../../api";
import {
  clearDeveloperLogEntries,
  formatDeveloperLogsForDisplay,
  getDeveloperLogEntries,
  subscribeDeveloperLogs,
} from "../../lib/developerMode";
import type { SettingsPreferences } from "./preferences";
import type { DiagnosticExportState } from "./sections/AdvancedDeveloperSettingsSection";

export function useSettingsDiagnostics({
  projectId,
  logRetention,
}: {
  projectId?: string;
  logRetention: SettingsPreferences["logRetention"];
}) {
  const [developerLogVersion, setDeveloperLogVersion] = useState(0);
  const [serverLogEntries, setServerLogEntries] = useState<FrontendDiagnosticEntry[]>([]);
  const [diagnosticExportState, setDiagnosticExportState] = useState<DiagnosticExportState>({ status: "idle", message: "" });

  useEffect(() => {
    const unsubscribeLogs = subscribeDeveloperLogs(() => setDeveloperLogVersion((version) => version + 1));
    return () => unsubscribeLogs();
  }, []);

  const refreshServerLogs = async () => {
    try {
      const response = await listFrontendDiagnostics();
      setServerLogEntries(response.entries);
    } catch {
      setServerLogEntries([]);
    }
  };

  useEffect(() => {
    if (!shouldApplyServerLogRetention(logRetention)) return;

    let cancelled = false;
    const applyRetention = async () => {
      await clearFrontendDiagnostics(logRetention).catch(() => undefined);
      if (!cancelled) await refreshServerLogs();
    };

    void applyRetention();
    return () => {
      cancelled = true;
    };
  }, [logRetention]);

  useEffect(() => {
    let cancelled = false;
    const refreshLogs = async () => {
      try {
        const response = await listFrontendDiagnostics();
        if (cancelled) return;
        setServerLogEntries(response.entries);
      } catch {
        if (!cancelled) setServerLogEntries([]);
      }
    };
    void refreshLogs();
    const timer = window.setInterval(refreshLogs, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const clearLogs = async () => {
    clearDeveloperLogEntries();
    setServerLogEntries([]);
    await clearFrontendDiagnostics("all").catch(() => undefined);
    await refreshServerLogs();
  };

  const exportLogs = async () => {
    setDiagnosticExportState({ status: "working", message: "正在生成诊断包..." });
    try {
      const result = await createDiagnosticBundle(projectId);
      const anchor = document.createElement("a");
      anchor.href = diagnosticBundleDownloadUrl(result.downloadUrl);
      anchor.download = result.fileName;
      anchor.click();
      setDiagnosticExportState({
        status: "done",
        message: result.resourceReadiness.ok
          ? `已生成诊断包：${result.fileName}`
          : `已生成诊断包；安装资源自检发现缺失项：${result.resourceReadiness.resources.filter((item) => item.required && !item.exists).length} 项`,
        zipPath: result.zipPath,
      });
    } catch (error) {
      setDiagnosticExportState({
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const checkDesktopResources = async () => {
    setDiagnosticExportState({ status: "working", message: "正在检查安装资源..." });
    try {
      const { readiness } = await getDesktopResourceReadiness();
      const missingRequired = readiness.resources.filter((item) => item.required && !item.exists);
      setDiagnosticExportState({
        status: readiness.ok ? "done" : "error",
        message: readiness.ok
          ? "安装资源自检通过。"
          : `安装资源自检未通过，缺失 ${missingRequired.length} 个必需项：${missingRequired.map((item) => item.label).join("、")}`,
      });
    } catch (error) {
      setDiagnosticExportState({
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  void formatDiagnosticEntries(serverLogEntries);
  void formatDeveloperLogsForDisplay();
  void developerLogVersion;

  return {
    diagnosticExportState,
    developerLogCount: Math.max(getDeveloperLogEntries().length, serverLogEntries.length),
    clearLogs,
    exportLogs,
    checkDesktopResources,
  };
}

function shouldApplyServerLogRetention(value: SettingsPreferences["logRetention"]): value is Exclude<SettingsPreferences["logRetention"], "manual"> {
  return value !== "manual";
}

function formatDiagnosticEntries(entries: FrontendDiagnosticEntry[]) {
  if (!entries.length) return "";
  return entries.map((entry) => `[${new Date(entry.timestamp).toISOString()}] [${entry.level.toUpperCase()}] ${entry.message}`).join("\n");
}
