import { useState } from "react";
import { resetDesktopInitialState } from "../../api";

export function useResetInitialStateAction({ onResetInitialState }: { onResetInitialState?: () => void }) {
  const [resetInitialStateText, setResetInitialStateText] = useState("");
  const [resetInitialStateNotice, setResetInitialStateNotice] = useState("");

  const resetInitialState = async () => {
    if (resetInitialStateText !== "重置软件") return;
    setResetInitialStateNotice("正在重置桌面端本地状态...");
    try {
      await resetDesktopInitialState("重置软件");
      setResetInitialStateText("");
      setResetInitialStateNotice("已重置为未绑定状态；Maker 项目目录、npm-cache 和 AI client 配置未删除。");
      onResetInitialState?.();
    } catch (error) {
      setResetInitialStateNotice(error instanceof Error ? error.message : String(error));
    }
  };

  return {
    resetInitialStateText,
    resetInitialStateNotice,
    setResetInitialStateText,
    resetInitialState,
  };
}
