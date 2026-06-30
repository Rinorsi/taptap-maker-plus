import { forwardRef, type ComponentPropsWithRef } from "react";
import { Button } from "../../../components/ui/Button";
import { cn } from "../../../lib/utils";

export type TooltipIconButtonProps = ComponentPropsWithRef<typeof Button> & {
  tooltip: string;
  side?: "top" | "bottom" | "left" | "right";
};

export const TooltipIconButton = forwardRef<HTMLButtonElement, TooltipIconButtonProps>(
  ({ children, tooltip, className, side: _side, ...rest }, ref) => (
    <Button
      variant="ghost"
      size="icon"
      {...rest}
      className={cn("aui-button-icon h-7 w-7 rounded-pill p-1 active:scale-95", className)}
      ref={ref}
      title={tooltip}
      aria-label={rest["aria-label"] ?? tooltip}
    >
      {children}
      <span className="sr-only">{tooltip}</span>
    </Button>
  )
);

TooltipIconButton.displayName = "TooltipIconButton";
