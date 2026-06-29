import { useEffect, useState } from "react";
import { readStoredPreference, type SettingsPreferences } from "./preferences";

export function useWindowMinimumSizePreference({
  prefs,
  setPref,
}: {
  prefs: SettingsPreferences;
  setPref: <K extends keyof SettingsPreferences>(key: K, value: SettingsPreferences[K]) => void;
}) {
  const [windowMinimumDraft, setWindowMinimumDraft] = useState(() => ({
    width: String(readStoredPreference("windowMinimumWidth")),
    height: String(readStoredPreference("windowMinimumHeight")),
  }));

  useEffect(() => {
    setWindowMinimumDraft({
      width: String(prefs.windowMinimumWidth),
      height: String(prefs.windowMinimumHeight),
    });
  }, [prefs.windowMinimumWidth, prefs.windowMinimumHeight]);

  const applyWindowMinimumSizePreset = (value: SettingsPreferences["windowMinimumSizePreset"]) => {
    setPref("windowMinimumSizePreset", value);
    if (value === "1366x768") {
      setPref("windowMinimumWidth", 1366);
      setPref("windowMinimumHeight", 768);
    } else if (value === "1440x900") {
      setPref("windowMinimumWidth", 1440);
      setPref("windowMinimumHeight", 900);
    } else if (value === "1600x900") {
      setPref("windowMinimumWidth", 1600);
      setPref("windowMinimumHeight", 900);
    }
  };

  const commitWindowMinimumSize = (axis: "width" | "height") => {
    const rawValue = axis === "width" ? windowMinimumDraft.width : windowMinimumDraft.height;
    const parsed = Number(rawValue);
    const minimum = axis === "width" ? 1366 : 768;
    const fallback = axis === "width" ? prefs.windowMinimumWidth : prefs.windowMinimumHeight;
    const nextValue = Number.isFinite(parsed) ? Math.max(minimum, Math.round(parsed)) : fallback;
    setWindowMinimumDraft((draft) => ({ ...draft, [axis]: String(nextValue) }));
    setPref("windowMinimumSizePreset", "custom");
    if (axis === "width") {
      setPref("windowMinimumWidth", nextValue);
    } else {
      setPref("windowMinimumHeight", nextValue);
    }
  };

  return {
    windowMinimumDraft,
    setWindowMinimumDraft,
    applyWindowMinimumSizePreset,
    commitWindowMinimumSize,
  };
}
