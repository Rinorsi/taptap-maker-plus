import { useEffect, useMemo, useState } from "react";
import {
  flushSettingsPreferencesSave,
  SETTINGS_PREFERENCES_CHANGED_EVENT,
  subscribeSettingsPreferencesSaveFailed,
  subscribeSettingsPreferencesSaved,
  subscribeSettingsRemoteSync,
} from "./preferences";

export type SettingsPersistenceState = {
  status: "idle" | "local-applied" | "saving-local" | "saved-local" | "backend-fallback" | "failed";
  savedAt?: string;
  message?: string;
};

export function useSettingsPersistence() {
  const [state, setState] = useState<SettingsPersistenceState>({ status: "idle" });

  useEffect(() => {
    const unsubscribeSaved = subscribeSettingsPreferencesSaved(({ savedAt, target }) => {
      setState({
        status: target === "desktop-file" ? "saved-local" : "backend-fallback",
        savedAt,
      });
    });
    const unsubscribeFailed = subscribeSettingsPreferencesSaveFailed(({ message }) => {
      setState({
        status: "failed",
        savedAt: undefined,
        message: `已临时应用，但本地配置保存失败：${message}`,
      });
    });
    const unsubscribeRemote = subscribeSettingsRemoteSync(() => {
      setState((previous) => ({
        status: previous.status === "idle" ? "idle" : "saved-local",
        savedAt: previous.savedAt,
      }));
    });
    return () => {
      unsubscribeSaved();
      unsubscribeFailed();
      unsubscribeRemote();
    };
  }, []);

  useEffect(() => {
    const handlePreferenceChange = () => {
      setState((previous) => ({
        ...previous,
        status: "local-applied",
        message: "已临时应用，正在等待写入本地配置。",
      }));
      window.setTimeout(() => {
        setState((current) =>
          current.status === "local-applied"
            ? { ...current, status: "saving-local", message: "正在写入本地配置..." }
            : current,
        );
      }, 250);
    };
    window.addEventListener(SETTINGS_PREFERENCES_CHANGED_EVENT, handlePreferenceChange);
    return () => window.removeEventListener(SETTINGS_PREFERENCES_CHANGED_EVENT, handlePreferenceChange);
  }, []);

  const label = useMemo(() => formatSettingsPersistenceLabel(state), [state]);

  const saveNow = async () => {
    setState((previous) => ({ ...previous, status: "saving-local", message: "正在写入本地配置..." }));
    await flushSettingsPreferencesSave("manual");
  };

  return { state, label, saveNow, setState };
}

function formatSettingsPersistenceLabel(state: SettingsPersistenceState) {
  if (state.message) return state.message;
  if (state.status === "local-applied") return "已临时应用，正在等待写入本地配置。";
  if (state.status === "saving-local") return "正在写入本地配置...";
  if (state.status === "saved-local" && state.savedAt) return `已写入本地配置 ${formatLocalTime(state.savedAt)}`;
  if (state.status === "saved-local") return "已写入本地配置";
  if (state.status === "backend-fallback") return "已通过配置服务保存，本地配置文件写入状态待确认。";
  if (state.status === "failed") return "本地配置保存失败";
  return "修改后会先临时应用，再自动写入本地配置。";
}

function formatLocalTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
