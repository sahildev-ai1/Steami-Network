import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface EmbedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (value: string, label?: string) => void;
  title: string;
  placeholder: string;
  labelPlaceholder?: string;
  showLabelInput?: boolean;
  defaultValue?: string;
  defaultLabel?: string;
}

export function EmbedModal({
  isOpen,
  onClose,
  onSubmit,
  title,
  placeholder,
  labelPlaceholder = "Link Text (optional)",
  showLabelInput = false,
  defaultValue = "",
  defaultLabel = "",
}: EmbedModalProps) {
  const [value, setValue] = React.useState(defaultValue);
  const [labelText, setLabelText] = React.useState(defaultLabel);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
      setLabelText(defaultLabel);
      setError("");
    }
  }, [isOpen, defaultValue, defaultLabel]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) {
      setError("This field is required");
      return;
    }
    
    // Simple URL validation
    if (title.toLowerCase().includes("link") || title.toLowerCase().includes("embed") || title.toLowerCase().includes("video")) {
      try {
        // Allow relative links or let standard checks pass
        if (!value.startsWith("/") && !value.startsWith("http://") && !value.startsWith("https://") && !value.startsWith("mailto:") && !value.startsWith("tel:")) {
          setValue("https://" + value);
          onSubmit("https://" + value, showLabelInput ? labelText : undefined);
        } else {
          onSubmit(value, showLabelInput ? labelText : undefined);
        }
      } catch {
        onSubmit(value, showLabelInput ? labelText : undefined);
      }
    } else {
      onSubmit(value, showLabelInput ? labelText : undefined);
    }
    
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px] bg-[#030712]/95 border border-white/10 backdrop-blur-md text-white shadow-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-[18px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">
            {title}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {showLabelInput && (
            <div className="space-y-1">
              <label className="block text-[11px] text-muted-foreground uppercase tracking-wider">
                Display Text
              </label>
              <input
                type="text"
                value={labelText}
                onChange={(e) => setLabelText(e.target.value)}
                placeholder={labelPlaceholder}
                className="w-full rounded-md border border-white/10 bg-white/[0.02] px-3 py-2 text-[14px] text-white focus:outline-none focus:border-steami-cyan/50 focus:ring-1 focus:ring-steami-cyan/30 transition-all"
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-[11px] text-muted-foreground uppercase tracking-wider">
              URL / Address
            </label>
            <input
              type="text"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                if (error) setError("");
              }}
              placeholder={placeholder}
              autoFocus
              className={cn(
                "w-full rounded-md border border-white/10 bg-white/[0.02] px-3 py-2 text-[14px] text-white focus:outline-none focus:border-steami-cyan/50 focus:ring-1 focus:ring-steami-cyan/30 transition-all",
                error && "border-steami-red/50 focus:ring-steami-red/30"
              )}
            />
            {error && <p className="text-[11px] text-steami-red">{error}</p>}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-[12px] font-medium text-muted-foreground hover:text-white hover:bg-white/[0.05] rounded-md transition-all border border-transparent"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-[12px] font-medium bg-steami-cyan/20 text-steami-cyan border border-steami-cyan/40 hover:bg-steami-cyan/30 hover:border-steami-cyan/60 rounded-md transition-all shadow-[0_0_12px_rgba(0,217,255,0.1)]"
            >
              Insert
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
