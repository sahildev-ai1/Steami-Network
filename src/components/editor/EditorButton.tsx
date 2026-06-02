import * as React from "react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface EditorButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  tooltip?: string;
  icon: React.ReactNode;
}

export const EditorButton = React.forwardRef<HTMLButtonElement, EditorButtonProps>(
  ({ className, active, tooltip, icon, ...props }, ref) => {
    const buttonElement = (
      <button
        ref={ref}
        type="button"
        className={cn(
          "h-8 w-8 flex items-center justify-center rounded-md border border-white/5 bg-white/[0.02] text-muted-foreground hover:text-white hover:bg-white/[0.08] hover:border-white/15 transition-all focus:outline-none focus:ring-1 focus:ring-steami-cyan/50",
          active && "bg-steami-cyan/15 text-steami-cyan border-steami-cyan/35 shadow-[0_0_8px_rgba(0,217,255,0.15)] hover:bg-steami-cyan/20 hover:text-steami-cyan hover:border-steami-cyan/50",
          className
        )}
        {...props}
      >
        {icon}
      </button>
    );

    if (tooltip) {
      return (
        <TooltipProvider delayDuration={400}>
          <Tooltip>
            <TooltipTrigger asChild>
              {buttonElement}
            </TooltipTrigger>
            <TooltipContent className="bg-[#0b1426] border border-white/10 text-white text-[11px] font-mono">
              {tooltip}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return buttonElement;
  }
);

EditorButton.displayName = "EditorButton";
