import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-2xl border border-input/90 bg-white/86 px-4 py-2 text-base shadow-[0_12px_30px_rgba(10,18,28,0.05)] ring-offset-background transition-[border-color,box-shadow,background-color] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:shadow-[0_0_0_4px_rgba(17,128,106,0.12),0_16px_34px_rgba(10,18,28,0.08)] disabled:cursor-not-allowed disabled:opacity-50 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground md:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
