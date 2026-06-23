import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteAssets,
  getAssetTree,
  importAsset,
  listAssets,
  listModelPackages,
  moveAssets,
  rebuildAssetProvenance,
  renameAsset,
  scanAssetReferences,
  scanAssets,
  type ListAssetsOptions
} from "../api";

export const assetQueryKeys = {
  all: ["assets"] as const,
  project: (projectId: string) => [...assetQueryKeys.all, "project", projectId] as const,
  list: (projectId: string, options?: ListAssetsOptions) => [...assetQueryKeys.project(projectId), "list", options ?? {}] as const,
  tree: (projectId: string, rootPath = "assets") => [...assetQueryKeys.project(projectId), "tree", rootPath] as const,
  references: (projectId: string, relativePaths: string[]) => [...assetQueryKeys.project(projectId), "references", relativePaths] as const,
  modelPackages: (projectId: string) => [...assetQueryKeys.project(projectId), "model-packages"] as const
};

export function useAssetsQuery(projectId?: string, options?: ListAssetsOptions) {
  return useQuery({
    queryKey: projectId ? assetQueryKeys.list(projectId, options) : [...assetQueryKeys.all, "list", "disabled"],
    queryFn: () => listAssets(projectId!, options),
    enabled: Boolean(projectId)
  });
}

export function useAssetTreeQuery(projectId?: string, rootPath = "assets") {
  return useQuery({
    queryKey: projectId ? assetQueryKeys.tree(projectId, rootPath) : [...assetQueryKeys.all, "tree", "disabled", rootPath],
    queryFn: () => getAssetTree(projectId!, rootPath),
    enabled: Boolean(projectId)
  });
}

export function useAssetReferencesQuery(projectId: string | undefined, relativePaths: string[]) {
  return useQuery({
    queryKey: projectId ? assetQueryKeys.references(projectId, relativePaths) : [...assetQueryKeys.all, "references", "disabled", relativePaths],
    queryFn: () => scanAssetReferences(projectId!, relativePaths),
    enabled: Boolean(projectId && relativePaths.length)
  });
}

export function useModelPackagesQuery(projectId?: string) {
  return useQuery({
    queryKey: projectId ? assetQueryKeys.modelPackages(projectId) : [...assetQueryKeys.all, "model-packages", "disabled"],
    queryFn: () => listModelPackages(projectId!),
    enabled: Boolean(projectId)
  });
}

export function useScanAssetsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: scanAssets,
    onSuccess: (_data, projectId) => {
      void queryClient.invalidateQueries({ queryKey: assetQueryKeys.project(projectId) });
    }
  });
}

export function useRebuildAssetProvenanceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: rebuildAssetProvenance,
    onSuccess: (_data, projectId) => {
      void queryClient.invalidateQueries({ queryKey: assetQueryKeys.project(projectId) });
    }
  });
}

export function useDeleteAssetsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, relativePaths }: { projectId: string; relativePaths: string[] }) => deleteAssets(projectId, relativePaths),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: assetQueryKeys.project(variables.projectId) });
    }
  });
}

export function useMoveAssetsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, relativePaths, targetFolder }: { projectId: string; relativePaths: string[]; targetFolder: string }) => moveAssets(projectId, relativePaths, targetFolder),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: assetQueryKeys.project(variables.projectId) });
    }
  });
}

export function useRenameAssetMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, relativePath, newName }: { projectId: string; relativePath: string; newName: string }) => renameAsset(projectId, relativePath, newName),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: assetQueryKeys.project(variables.projectId) });
    }
  });
}

export function useImportAssetMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, fileName, targetFolder, dataUrl }: { projectId: string; fileName: string; targetFolder: string; dataUrl: string }) => importAsset(projectId, fileName, targetFolder, dataUrl),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: assetQueryKeys.project(variables.projectId) });
    }
  });
}
