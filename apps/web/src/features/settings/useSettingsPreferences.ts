import { useEffect, useState } from "react";
import {
  defaultSettingsPreferences,
  readStoredPreference,
  settingsPreferenceKeys,
  SETTINGS_PREFERENCES_CHANGED_EVENT,
  subscribeSettingsRemoteSync,
  writeLocalPreference,
  type SettingsPreferences,
} from "./preferences";

export function useSettingsPreferences() {
  const [prefs, setPrefs] = useState<SettingsPreferences>(() => readAllSettingsPreferences());

  useEffect(() => {
    const handlePreferenceChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ key: string; value: unknown }>;
      const preferenceKey = Object.entries(settingsPreferenceKeys).find(([, storageKey]) => storageKey === customEvent.detail.key)?.[0] as
        | keyof SettingsPreferences
        | undefined;
      if (!preferenceKey) return;
      setPrefs((previous) => ({ ...previous, [preferenceKey]: customEvent.detail.value }));
    };
    const unsubscribeRemote = subscribeSettingsRemoteSync(() => setPrefs(readAllSettingsPreferences()));
    window.addEventListener(SETTINGS_PREFERENCES_CHANGED_EVENT, handlePreferenceChange);
    return () => {
      unsubscribeRemote();
      window.removeEventListener(SETTINGS_PREFERENCES_CHANGED_EVENT, handlePreferenceChange);
    };
  }, []);

  const setPref = <K extends keyof SettingsPreferences>(key: K, value: SettingsPreferences[K]) => {
    writeLocalPreference(settingsPreferenceKeys[key], value);
  };

  return [prefs, setPref] as const;
}

function readAllSettingsPreferences() {
  const preferences = {} as SettingsPreferences;
  for (const key of Object.keys(defaultSettingsPreferences) as Array<keyof SettingsPreferences>) {
    Object.assign(preferences, { [key]: readStoredPreference(key) });
  }
  return preferences;
}
