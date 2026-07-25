import { Hand } from "lucide-react";
import { cn } from "@/lib/utils";

export function SenyalitaMark({ className, iconClassName }: { className?: string; iconClassName?: string }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-xl bg-gradient-to-br from-senyalita-primary to-senyalita-secondary shadow-sm shadow-senyalita-primary/30",
        className,
      )}
    >
      <Hand className={cn("text-white", iconClassName)} strokeWidth={2.25} />
    </div>
  );
}
