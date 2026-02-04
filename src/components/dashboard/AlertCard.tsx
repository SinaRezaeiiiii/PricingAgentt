import { AlertTriangle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface AlertCardProps {
  title: string;
  description: string;
  count: number;
  variant?: "warning" | "critical";
  onClick?: () => void;
}

export function AlertCard({
  title,
  description,
  count,
  variant = "warning",
  onClick,
}: AlertCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group flex w-full items-center justify-between rounded-xl border p-4 text-left transition-all hover:shadow-card-hover",
        variant === "warning" && "border-warning/30 bg-warning-muted",
        variant === "critical" && "border-loss/30 bg-loss-muted animate-pulse-subtle"
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg",
            variant === "warning" && "bg-warning/20 text-warning",
            variant === "critical" && "bg-loss/20 text-loss"
          )}
        >
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className={cn(
              "font-semibold",
              variant === "warning" && "text-warning",
              variant === "critical" && "text-loss"
            )}>
              {title}
            </p>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-bold",
                variant === "warning" && "bg-warning text-warning-foreground",
                variant === "critical" && "bg-loss text-loss-foreground"
              )}
            >
              {count}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
    </button>
  );
}
