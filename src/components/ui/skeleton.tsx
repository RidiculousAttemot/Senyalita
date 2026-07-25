import { cn } from "@/lib/utils";

const shimmerClass =
  "relative overflow-hidden bg-fsl-sunken before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn(shimmerClass, "rounded-md", className)} />;
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          className={cn("h-3", i === lines - 1 ? "w-2/3" : "w-full")}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return <Skeleton className={cn("h-24 w-full rounded-xl", className)} />;
}
