import { useEffect, useState } from "react";
import type { MakerProjectsRootSettings, ProjectSummary } from "../../api";
import { getMakerProjectsRootSettings, saveMakerProjectsRootSettings } from "../../api";

export function useMakerProjectsRootSettings({
  onProjectsRootChanged,
}: {
  onProjectsRootChanged?: (projects: ProjectSummary[], selectedProjectId?: string) => void;
}) {
  const [makerRootSettings, setMakerRootSettings] = useState<MakerProjectsRootSettings>();
  const [makerRootDraft, setMakerRootDraft] = useState("");
  const [makerRootNotice, setMakerRootNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    getMakerProjectsRootSettings()
      .then((response) => {
        if (cancelled) return;
        setMakerRootSettings(response.settings);
        setMakerRootDraft(response.settings.rootPath);
      })
      .catch(() => {
        if (!cancelled) setMakerRootNotice("无法读取 Maker 项目根目录设置");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const saveMakerRoot = async () => {
    const nextRoot = makerRootDraft.trim();
    if (!nextRoot) return;
    setMakerRootNotice("正在保存并重新扫描项目...");
    try {
      const response = await saveMakerProjectsRootSettings(nextRoot);
      setMakerRootSettings(response.settings);
      setMakerRootDraft(response.settings.rootPath);
      if (response.projects) onProjectsRootChanged?.(response.projects, response.selectedProjectId);
      setMakerRootNotice(`已更新 Maker 项目根目录：${response.settings.rootPath}`);
    } catch (error) {
      setMakerRootNotice(error instanceof Error ? error.message : String(error));
    }
  };

  return {
    makerRootSettings,
    makerRootDraft,
    makerRootNotice,
    setMakerRootDraft,
    saveMakerRoot,
  };
}
