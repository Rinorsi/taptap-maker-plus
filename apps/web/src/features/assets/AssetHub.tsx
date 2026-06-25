import { FolderOpen } from "lucide-react";
import type { AssetDirectoryNode, AssetMutationResponse, AssetSummary, ProjectSummary } from "../../api";
import { AssetManagerPanel } from "./AssetManagerPanel";

type Props = {
  project?: ProjectSummary;
  assets: AssetSummary[];
  assetTree?: AssetDirectoryNode;
  onScanAssets: () => void;
  onDeleteAssets: (relativePaths: string[]) => Promise<void>;
  onMoveAssets: (relativePaths: string[], targetFolder: string) => Promise<void>;
  onCopyAssets?: (relativePaths: string[], targetFolder: string) => Promise<void>;
  onRenameAsset: (relativePath: string, newName: string) => Promise<void>;
  onRenameDirectory: (directoryPath: string, newName: string) => Promise<void>;
  onMoveDirectory: (directoryPath: string, targetFolder: string) => Promise<void>;
  onCopyDirectory: (directoryPath: string, targetFolder: string) => Promise<void>;
  onDeleteDirectory: (directoryPath: string) => Promise<void>;
  onOpenLocalPath: (relativePath: string, mode: "file" | "directory") => Promise<void>;
  onImportAssets: (files: File[], targetFolder: string) => Promise<void>;
  onCreateFolder: (parentFolder: string) => Promise<void>;
  onConfirmReferenceMutation: (relativePaths: string[], actionLabel: string, allowUpdateReferences: boolean) => Promise<"update" | "skip" | "cancel">;
  onAssetMutationResult: (prefix: string, result: AssetMutationResponse) => void;
  onScanReferences: (relativePaths: string[]) => Promise<void>;
  onNotice: (notice: string) => void;
  onSelectAsset: (asset: AssetSummary) => void;
};

export function AssetHub({
  project,
  assets,
  assetTree,
  onScanAssets,
  onDeleteAssets,
  onMoveAssets,
  onCopyAssets,
  onRenameAsset,
  onRenameDirectory,
  onMoveDirectory,
  onCopyDirectory,
  onDeleteDirectory,
  onOpenLocalPath,
  onImportAssets,
  onCreateFolder,
  onScanReferences,
  onSelectAsset
}: Props) {
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
        directoryTree={assetTree}
        disabled={!project}
        rootPath="assets"
        title="基础资产库"
        onScanAssets={onScanAssets}
        onDeleteAssets={onDeleteAssets}
        onMoveAssets={onMoveAssets}
        onCopyAssets={onCopyAssets}
        onRenameAsset={onRenameAsset}
        onRenameDirectory={onRenameDirectory}
        onMoveDirectory={onMoveDirectory}
        onCopyDirectory={onCopyDirectory}
        onDeleteDirectory={onDeleteDirectory}
        onOpenLocalPath={onOpenLocalPath}
        onImportAssets={onImportAssets}
        onCreateFolder={onCreateFolder}
        onScanReferences={onScanReferences}
        onSelectAsset={onSelectAsset}
      />
    </section>
  );
}
