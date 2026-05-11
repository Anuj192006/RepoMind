import * as React from "react"
import { cn } from "../../lib/utils"

const Button = React.forwardRef(({ className, variant = "primary", size = "md", ...props }, ref) => {
  const variants = {
    primary: "bg-white text-black hover:bg-zinc-200 shadow-sm",
    secondary: "bg-zinc-900 text-white border border-zinc-800 hover:bg-zinc-800",
    ghost: "text-zinc-400 hover:text-white hover:bg-zinc-900",
    outline: "border border-zinc-800 text-zinc-300 hover:bg-zinc-900 hover:text-white",
  }
  
  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  }

  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-full font-medium transition-all duration-200 active:scale-95 disabled:opacity-50",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  )
})
Button.displayName = "Button"

export { Button }
