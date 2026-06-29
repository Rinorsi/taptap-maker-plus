import { useState } from "react";
import { Image as ImageIcon } from "lucide-react";
import { apiResourceUrl, type ProjectSummary } from "../../api";
import { cn } from "../../lib/utils";

type Props = {
  project?: Pick<ProjectSummary, "name" | "iconUrl">;
  className?: string;
  fallbackClassName?: string;
};

export function ProjectIcon({ project, className, fallbackClassName }: Props) {
  const [failedUrl, setFailedUrl] = useState<string>();
  const iconUrl = project?.iconUrl && project.iconUrl !== failedUrl ? apiResourceUrl(project.iconUrl) : undefined;

  if (iconUrl) {
    return (
      <img
        src={iconUrl}
        alt={project?.name ? `${project.name} 图标` : "项目图标"}
        className={cn("shrink-0 rounded-xl object-cover", className)}
        draggable={false}
        onError={() => setFailedUrl(project?.iconUrl)}
      />
    );
  }

  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-xl bg-surface-app text-text-muted", className, fallbackClassName)}>
      <ImageIcon className="h-1/2 w-1/2" />
    </span>
  );
}
