import { useEffect, useState } from "react";
import { isDeveloperModeEnabled, subscribeDeveloperMode } from "../../lib/developerMode";

export function useDeveloperModeState() {
  const [developerMode, setDeveloperMode] = useState(isDeveloperModeEnabled());

  useEffect(() => {
    const unsubscribeMode = subscribeDeveloperMode(setDeveloperMode);
    return () => unsubscribeMode();
  }, []);

  return developerMode;
}
