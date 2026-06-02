import * as React from "react";
import { cn } from "@/lib/utils";

interface ToolbarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function ToolbarGroup({ children, className, ...props }: ToolbarGroupProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 px-1.5 border-r border-white/10 last:border-r-0",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
