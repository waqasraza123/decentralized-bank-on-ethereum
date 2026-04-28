import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

type LoadingPanelProps = {
  title: string;
  description?: string;
  compact?: boolean;
  className?: string;
};

export function InlineLoader({
  label,
  className
}: {
  label: string;
  className?: string;
}) {
  return (
    <span
      aria-busy="true"
      aria-live="polite"
      className={cn("inline-flex items-center gap-2 text-sm text-muted-foreground", className)}
      role="status"
    >
      <Loader2 className="h-4 w-4 animate-spin text-primary" />
      <span>{label}</span>
    </span>
  );
}

export function LoadingPanel({
  title,
  description,
  compact = false,
  className
}: LoadingPanelProps) {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className={cn(
        "stb-panel-shell grid gap-4 text-left",
        compact ? "p-4" : "p-6",
        className
      )}
      role="status"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-primary shadow-[0_0_0_8px_rgba(17,128,106,0.06)]">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          {description ? (
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      <div className="grid gap-2" aria-hidden="true">
        <Skeleton className="h-3 w-11/12 bg-slate-200/70" />
        <Skeleton className="h-3 w-8/12 bg-slate-200/70" />
        {!compact ? <Skeleton className="h-3 w-10/12 bg-slate-200/70" /> : null}
      </div>
    </div>
  );
}
