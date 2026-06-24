import { FolderOpen } from "lucide-react";
import type { AssetSummary, ProjectSummary } from "../../api";
import { AssetManagerPanel } from "./AssetManagerPanel";

type Props = {
  project?: ProjectSummary;
  assets: AssetSummary[];
  onScanAssets: () => void;
  onDeleteAssets: (relativePaths: string[]) => Promise<void>;
  onMoveAssets: (relativePaths: string[], targetFolder: string) => Promise<void>;
  onCopyAssets?: (relativePaths: string[], targetFolder: string) => Promise<void>;
  onImportAssets: (files: File[], targetFolder: string) => Promise<void>;
  onSelectAsset: (asset: AssetSummary) => void;
};

export function AssetHub({ project, assets, onScanAssets, onDeleteAssets, onMoveAssets, onCopyAssets, onImportAssets, onSelectAsset }: Props) {
  return (
    <section className="mx-auto flex h-full min-h-0 w-full max-w-[1600px] flex-col gap-4 p-4 text-text md:p-6">
      <div className="flex shrink-0 items-center justify-between">
        <div>
          <h1 className="m-0 flex items-center gap-2 text-xl font-bold text-text">
            <FolderOpen className="h-5 w-5 text-text-muted" />
            基础资产库
          </h1>
          <p className="m-0 mt-1 text-xs text-text-muted">{project ? project.rootPath : "请先选择项目"}</p>
        </div>
      </div>

      <AssetManagerPanel
        assets={assets}
        disabled={!project}
        rootPath="assets"
        title="项目资产"
        defaultTargetFolder="assets"
        onScanAssets={onScanAssets}
        onDeleteAssets={onDeleteAssets}
        onMoveAssets={onMoveAssets}
        onCopyAssets={onCopyAssets}
        onImportAssets={onImportAssets}
        onSelectAsset={onSelectAsset}
      />
    </section>
  );
}
