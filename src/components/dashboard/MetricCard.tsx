import { cn } from "@/lib/utils";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string;
  change?: {
    value: string;
    positive: boolean;
  };
  icon: LucideIcon;
  variant?: "default" | "profit" | "loss" | "warning";
  subtitle?: string;
}

export function MetricCard({
  title,
  value,
  change,
  icon: Icon,
  variant = "default",
  subtitle,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-card p-5 shadow-card transition-shadow hover:shadow-card-hover",
        variant === "profit" && "border-profit/20",
        variant === "loss" && "border-loss/20",
        variant === "warning" && "border-warning/20"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold tracking-tight font-mono">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg",
            variant === "default" && "bg-primary/10 text-primary",
            variant === "profit" && "bg-profit-muted text-profit",
            variant === "loss" && "bg-loss-muted text-loss",
            variant === "warning" && "bg-warning-muted text-warning"
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
      
      {change && (
        <div className="mt-3 flex items-center gap-1.5">
          {change.positive ? (
            <TrendingUp className="h-4 w-4 text-profit" />
          ) : (
            <TrendingDown className="h-4 w-4 text-loss" />
          )}
          <span
            className={cn(
              "text-sm font-medium",
              change.positive ? "text-profit" : "text-loss"
            )}
          >
            {change.value}
          </span>
          <span className="text-sm text-muted-foreground">vs last month</span>
        </div>
      )}

      {/* Decorative gradient */}
      <div
        className={cn(
          "absolute -bottom-10 -right-10 h-32 w-32 rounded-full opacity-[0.03]",
          variant === "default" && "bg-primary",
          variant === "profit" && "bg-profit",
          variant === "loss" && "bg-loss",
          variant === "warning" && "bg-warning"
        )}
      />
    </div>
  );
}
