import { toast } from "sonner";

type CopyTextOptions = {
  successMessage?: string;
  errorMessage?: string;
};

export async function copyText(text: string, options: CopyTextOptions = {}) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(options.successMessage ?? "已复制");
    return true;
  } catch {
    toast.error(options.errorMessage ?? "复制失败");
    return false;
  }
}
