import * as React from "react";
import { Image, Upload, X, Link } from "lucide-react";
import { cn } from "@/lib/utils";

interface MediaUploaderProps {
  onImageSelect: (base64: string, filename: string) => void;
  onUrlInsert: (url: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function MediaUploader({ onImageSelect, onUrlInsert, isOpen, onClose }: MediaUploaderProps) {
  const [dragActive, setDragActive] = React.useState(false);
  const [urlValue, setUrlValue] = React.useState("");
  const [error, setError] = React.useState("");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file");
      return;
    }

    try {
      const url = URL.createObjectURL(file);
      onImageSelect(url, file.name);
      onClose();
    } catch {
      setError("Failed to read image file");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setError("");

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    setError("");
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlValue.trim()) {
      setError("URL is required");
      return;
    }
    onUrlInsert(urlValue);
    setUrlValue("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in-0 duration-200">
      <div className="relative w-full max-w-md rounded-xl border border-white/10 bg-[#030712]/95 p-6 text-white shadow-2xl backdrop-blur-md">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-muted-foreground hover:bg-white/10 hover:text-white transition-all"
        >
          <X className="h-4 w-4" />
        </button>

        <h3 className="font-serif text-[18px] font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">
          Insert Image
        </h3>

        <div className="space-y-4">
          {/* Dropzone */}
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={onButtonClick}
            className={cn(
              "group relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-white/10 bg-white/[0.01] px-6 py-8 text-center cursor-pointer transition-all hover:bg-white/[0.03] hover:border-steami-cyan/40",
              dragActive && "border-steami-cyan bg-steami-cyan/5 scale-[0.99]",
              error && "border-steami-red/50 bg-steami-red/5"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleChange}
              className="hidden"
            />
            
            <div className={cn(
              "mb-3 rounded-full bg-white/[0.04] p-3 text-muted-foreground transition-all group-hover:scale-110 group-hover:bg-steami-cyan/10 group-hover:text-steami-cyan",
              dragActive && "bg-steami-cyan/20 text-steami-cyan"
            )}>
              <Upload className="h-6 w-6" />
            </div>

            <p className="text-[13px] font-medium text-foreground">
              Drag & drop image, or <span className="text-steami-cyan underline group-hover:text-steami-cyan/80">browse</span>
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Supports PNG, JPG, JPEG, WEBP, GIF
            </p>
          </div>

          <div className="relative flex items-center justify-center my-2">
            <span className="absolute inset-x-0 h-[1px] bg-white/10"></span>
            <span className="relative bg-[#030712] px-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Or
            </span>
          </div>

          {/* Image URL Form */}
          <form onSubmit={handleUrlSubmit} className="space-y-3">
            <div className="space-y-1">
              <label className="block text-[11px] text-muted-foreground uppercase tracking-wider">
                Image URL
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-2.5 text-muted-foreground">
                    <Link className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    value={urlValue}
                    onChange={(e) => {
                      setUrlValue(e.target.value);
                      if (error) setError("");
                    }}
                    placeholder="https://example.com/image.jpg"
                    className="w-full rounded-md border border-white/10 bg-white/[0.02] pl-9 pr-3 py-2 text-[13px] text-white focus:outline-none focus:border-steami-cyan/50 focus:ring-1 focus:ring-steami-cyan/30 transition-all"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 text-[12px] font-medium bg-steami-cyan/20 text-steami-cyan border border-steami-cyan/40 hover:bg-steami-cyan/30 hover:border-steami-cyan/60 rounded-md transition-all shadow-[0_0_12px_rgba(0,217,255,0.1)]"
                >
                  Insert
                </button>
              </div>
            </div>
          </form>

          {error && (
            <p className="text-[11px] text-steami-red text-center">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
