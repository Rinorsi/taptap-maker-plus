import { Download } from "lucide-react";
import { AppUpdatePanel, type AppUpdateUiState } from "../../updates/appUpdateUi";
import { SectionHeader } from "../settingsUi";

export function SoftwareUpdateSettingsSection({ updateState }: { updateState: AppUpdateUiState }) {
  return (
    <div id="settings-software-update" className="scroll-mt-12 flex flex-col gap-4">
      <SectionHeader title="软件更新" icon={<Download />} description="检查远端更新清单，查看版本列表，并下载安装器覆盖安装。" />
      <AppUpdatePanel state={updateState} />
    </div>
  );
}
