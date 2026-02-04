import { useState, useMemo } from "react";
import { FlaskConical, TrendingUp, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { partsData } from "@/data/mockData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const formatCurrency = (value: number) => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${value.toFixed(2)}`;
};

export function SimulationPanel() {
  const [priceChange, setPriceChange] = useState(5);
  const [targetFranchise, setTargetFranchise] = useState("MB");
  const [onlyMissingAcp, setOnlyMissingAcp] = useState(true);
  const [marginThreshold, setMarginThreshold] = useState(15);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationComplete, setSimulationComplete] = useState(false);

  const simulationResults = useMemo(() => {
    let affectedParts = partsData.filter((part) => {
      if (targetFranchise !== "all" && part.Franchise !== targetFranchise) return false;
      if (onlyMissingAcp && part["ACP/Online Price"] !== null) return false;
      if (part["Margin %"] >= marginThreshold) return false;
      return true;
    });

    const currentRevenue = affectedParts.reduce(
      (sum, part) => sum + part["Gross Part Purchases Amount"],
      0
    );

    const priceMultiplier = 1 + priceChange / 100;
    const projectedRevenue = affectedParts.reduce((sum, part) => {
      const newPrice = part["Net Price New"] * priceMultiplier;
      const totalQty = part["Customer Pay Part Purchase Qty"] + 
        Math.floor(part["Manufacturer Pay Purchases Amount"] / part["Net Price New"]);
      // Assume slight volume decrease with price increase
      const volumeImpact = Math.max(0.9, 1 - (priceChange / 100) * 0.3);
      return sum + newPrice * totalQty * volumeImpact;
    }, 0);

    const avgCurrentMargin =
      affectedParts.length > 0
        ? affectedParts.reduce((sum, part) => sum + part["Margin %"], 0) / affectedParts.length
        : 0;

    const avgNewMargin = affectedParts.length > 0
      ? affectedParts.reduce((sum, part) => {
          const newPrice = part["Net Price New"] * priceMultiplier;
          const newMargin = ((newPrice - part["Landed Cost"]) / newPrice) * 100;
          return sum + newMargin;
        }, 0) / affectedParts.length
      : 0;

    return {
      affectedParts: affectedParts.length,
      currentRevenue,
      projectedRevenue,
      revenueImpact: projectedRevenue - currentRevenue,
      avgCurrentMargin,
      avgNewMargin,
      marginImprovement: avgNewMargin - avgCurrentMargin,
    };
  }, [priceChange, targetFranchise, onlyMissingAcp, marginThreshold]);

  const handleSimulate = () => {
    setIsSimulating(true);
    setSimulationComplete(false);
    
    setTimeout(() => {
      setIsSimulating(false);
      setSimulationComplete(true);
    }, 1500);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Simulation & Impact Analysis</h1>
        <p className="text-muted-foreground">
          Model price changes and preview their financial impact
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Simulation inputs */}
        <div className="lg:col-span-1 space-y-6">
          <div className="rounded-xl border bg-card p-6 shadow-card">
            <div className="flex items-center gap-2 mb-6">
              <FlaskConical className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Simulation Parameters</h3>
            </div>

            <div className="space-y-6">
              {/* Price change slider */}
              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label>Price Change</Label>
                  <span className={cn(
                    "font-mono text-sm font-semibold",
                    priceChange > 0 ? "text-profit" : priceChange < 0 ? "text-loss" : ""
                  )}>
                    {priceChange > 0 ? "+" : ""}{priceChange}%
                  </span>
                </div>
                <Slider
                  value={[priceChange]}
                  onValueChange={([value]) => setPriceChange(value)}
                  min={-20}
                  max={20}
                  step={1}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Adjust Net Price New by this percentage
                </p>
              </div>

              <Separator />

              {/* Target franchise */}
              <div className="space-y-2">
                <Label>Target Franchise</Label>
                <Select value={targetFranchise} onValueChange={setTargetFranchise}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Franchises</SelectItem>
                    <SelectItem value="MB">Mercedes-Benz</SelectItem>
                    <SelectItem value="BMW">BMW</SelectItem>
                    <SelectItem value="AUDI">Audi</SelectItem>
                    <SelectItem value="VW">Volkswagen</SelectItem>
                    <SelectItem value="PORSCHE">Porsche</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Missing ACP filter */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Only Missing ACP/Online Price</Label>
                  <p className="text-xs text-muted-foreground">
                    Target parts without competitor benchmark
                  </p>
                </div>
                <Switch
                  checked={onlyMissingAcp}
                  onCheckedChange={setOnlyMissingAcp}
                />
              </div>

              <Separator />

              {/* Margin threshold */}
              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label>Margin Threshold</Label>
                  <span className="font-mono text-sm font-semibold">&lt; {marginThreshold}%</span>
                </div>
                <Slider
                  value={[marginThreshold]}
                  onValueChange={([value]) => setMarginThreshold(value)}
                  min={5}
                  max={40}
                  step={1}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Only affect parts with margin below this threshold
                </p>
              </div>

              <Button
                onClick={handleSimulate}
                className="w-full"
                disabled={isSimulating}
              >
                {isSimulating ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    Simulating...
                  </>
                ) : (
                  <>
                    <FlaskConical className="mr-2 h-4 w-4" />
                    Run Simulation
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Simulation summary */}
          <div className="rounded-xl border bg-muted/30 p-4">
            <h4 className="text-sm font-medium mb-2">Scenario Summary</h4>
            <p className="text-sm text-muted-foreground">
              {priceChange > 0 ? "Increase" : priceChange < 0 ? "Decrease" : "Maintain"}{" "}
              <span className="font-semibold">Net Price New</span> by{" "}
              <span className="font-mono font-semibold">{Math.abs(priceChange)}%</span> for{" "}
              <span className="font-semibold">{targetFranchise === "all" ? "all franchises" : targetFranchise}</span>
              {onlyMissingAcp && " where ACP/Online Price is missing"}
              {marginThreshold < 40 && ` and margin is below ${marginThreshold}%`}.
            </p>
          </div>
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-6">
          {/* Impact cards */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className={cn(
              "rounded-xl border p-6 transition-all",
              simulationComplete 
                ? simulationResults.revenueImpact > 0 
                  ? "border-profit/30 bg-profit-muted" 
                  : "border-loss/30 bg-loss-muted"
                : "bg-card"
            )}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-muted-foreground">
                  Estimated Revenue Impact
                </span>
                {simulationComplete && (
                  <CheckCircle2 className={cn(
                    "h-5 w-5",
                    simulationResults.revenueImpact > 0 ? "text-profit" : "text-loss"
                  )} />
                )}
              </div>
              <p className={cn(
                "text-3xl font-bold font-mono",
                simulationComplete && simulationResults.revenueImpact > 0 ? "text-profit" : "",
                simulationComplete && simulationResults.revenueImpact < 0 ? "text-loss" : ""
              )}>
                {simulationComplete
                  ? `${simulationResults.revenueImpact >= 0 ? "+" : ""}${formatCurrency(simulationResults.revenueImpact)}`
                  : "—"
                }
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Impact on Gross Part Purchases Amount
              </p>
            </div>

            <div className={cn(
              "rounded-xl border p-6 transition-all",
              simulationComplete ? "bg-card" : "bg-card"
            )}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-muted-foreground">
                  Margin Improvement
                </span>
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className={cn(
                "text-3xl font-bold font-mono",
                simulationComplete && simulationResults.marginImprovement > 0 ? "text-profit" : ""
              )}>
                {simulationComplete
                  ? `+${simulationResults.marginImprovement.toFixed(1)}%`
                  : "—"
                }
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Average margin change across affected parts
              </p>
            </div>
          </div>

          {/* Detailed breakdown */}
          <div className="rounded-xl border bg-card p-6 shadow-card">
            <h3 className="font-semibold mb-6">Detailed Breakdown</h3>
            
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-muted-foreground">Before Simulation</h4>
                <div className="space-y-3">
                  <div className="flex justify-between p-3 rounded-lg bg-muted/50">
                    <span className="text-sm">Total Revenue</span>
                    <span className="font-mono font-medium">
                      {formatCurrency(simulationResults.currentRevenue)}
                    </span>
                  </div>
                  <div className="flex justify-between p-3 rounded-lg bg-muted/50">
                    <span className="text-sm">Average Margin</span>
                    <span className="font-mono font-medium">
                      {simulationResults.avgCurrentMargin.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between p-3 rounded-lg bg-muted/50">
                    <span className="text-sm">Affected Parts</span>
                    <span className="font-mono font-medium">
                      {simulationResults.affectedParts.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-medium text-muted-foreground">After Simulation</h4>
                <div className="space-y-3">
                  <div className={cn(
                    "flex justify-between p-3 rounded-lg",
                    simulationComplete ? "bg-profit-muted" : "bg-muted/50"
                  )}>
                    <span className="text-sm">Projected Revenue</span>
                    <span className={cn(
                      "font-mono font-medium",
                      simulationComplete && "text-profit"
                    )}>
                      {simulationComplete
                        ? formatCurrency(simulationResults.projectedRevenue)
                        : "—"
                      }
                    </span>
                  </div>
                  <div className={cn(
                    "flex justify-between p-3 rounded-lg",
                    simulationComplete ? "bg-profit-muted" : "bg-muted/50"
                  )}>
                    <span className="text-sm">Projected Margin</span>
                    <span className={cn(
                      "font-mono font-medium",
                      simulationComplete && "text-profit"
                    )}>
                      {simulationComplete
                        ? `${simulationResults.avgNewMargin.toFixed(1)}%`
                        : "—"
                      }
                    </span>
                  </div>
                  <div className="flex justify-between p-3 rounded-lg bg-muted/50">
                    <span className="text-sm">Volume Impact Estimate</span>
                    <span className="font-mono font-medium text-warning">
                      {simulationComplete ? "-3% to -5%" : "—"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {simulationComplete && (
              <div className="mt-6 p-4 rounded-lg border border-info/30 bg-info-muted flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-info flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-info">AI Recommendation</p>
                  <p className="text-muted-foreground mt-1">
                    Based on competitor pricing gaps and current margin structure, this adjustment
                    shows a positive impact. Consider A/B testing with a subset of dealers before
                    full rollout. Monitor Part Returns Amount closely in the first 30 days.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          {simulationComplete && (
            <div className="flex items-center justify-end gap-3">
              <Button variant="outline">
                Export Analysis
              </Button>
              <Button>
                Apply to Selected Parts
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
