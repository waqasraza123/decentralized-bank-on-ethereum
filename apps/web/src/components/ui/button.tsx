import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold ring-offset-background transition-[box-shadow,background-color,border-color,color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border border-primary/80 bg-primary text-primary-foreground shadow-[0_18px_40px_rgba(17,128,106,0.2)] hover:bg-primary/95 hover:shadow-[0_22px_48px_rgba(17,128,106,0.24)]",
        destructive:
          "border border-destructive/80 bg-destructive text-destructive-foreground shadow-[0_18px_36px_rgba(161,56,56,0.16)] hover:bg-destructive/92",
        outline:
          "border border-slate-200/90 bg-white/84 text-slate-900 shadow-[0_12px_28px_rgba(10,18,28,0.06)] hover:border-slate-300 hover:bg-white hover:text-slate-950",
        secondary:
          "border border-slate-200/70 bg-slate-100/90 text-secondary-foreground hover:bg-slate-100",
        ghost: "text-slate-700 hover:bg-white/70 hover:text-slate-950",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-9 px-3.5 text-xs",
        lg: "h-12 px-8 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
