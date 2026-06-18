import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cn } from "../../lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
  variant?: "default" | "outline" | "ghost" | "secondary"
  size?: "default" | "sm" | "lg" | "icon"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    
    // Using explicit string concatenation or mappings for Tailwind
    const baseStyles = "inline-flex items-center justify-center whitespace-nowrap rounded-control font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand disabled:pointer-events-none disabled:opacity-50"
    
    const variants = {
      default: "bg-brand text-[#04202a] font-bold shadow hover:bg-brand-strong",
      outline: "border border-border bg-surface-raised shadow-sm hover:bg-surface-muted hover:text-brand-strong",
      ghost: "hover:bg-surface-muted hover:text-brand-strong",
      secondary: "bg-surface-muted text-text-muted hover:bg-surface-muted/80 hover:text-text",
    }
    
    const sizes = {
      default: "h-9 px-4 py-2",
      sm: "h-8 rounded-control px-3 text-xs",
      lg: "h-10 rounded-control px-8",
      icon: "h-9 w-9",
    }

    return (
      <Comp
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
