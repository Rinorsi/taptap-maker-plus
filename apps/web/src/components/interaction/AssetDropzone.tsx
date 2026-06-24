import { type ReactNode, useMemo } from "react";
import { type Accept, useDropzone } from "react-dropzone";

type AssetDropzoneRenderProps = {
  getRootProps: ReturnType<typeof useDropzone>["getRootProps"];
  getInputProps: ReturnType<typeof useDropzone>["getInputProps"];
  isDragActive: boolean;
  open: () => void;
};

type AssetDropzoneProps = {
  accept?: string;
  disabled?: boolean;
  multiple?: boolean;
  onDropFiles: (files: File[]) => void;
  children: (props: AssetDropzoneRenderProps) => ReactNode;
};

function toDropzoneAccept(accept?: string): Accept | undefined {
  if (!accept) return undefined;
  const entries = accept
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.includes("/"))
    .map((item) => [item, []] as const);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

export function AssetDropzone({ accept, disabled, multiple = true, onDropFiles, children }: AssetDropzoneProps) {
  const dropzoneAccept = useMemo(() => toDropzoneAccept(accept), [accept]);
  const dropzone = useDropzone({
    accept: dropzoneAccept,
    disabled,
    multiple,
    noClick: true,
    noDrag: true,
    noKeyboard: true,
    onDropAccepted: (acceptedFiles) => {
      if (acceptedFiles.length > 0) onDropFiles(acceptedFiles);
    }
  });

  return <>{children(dropzone)}</>;
}
