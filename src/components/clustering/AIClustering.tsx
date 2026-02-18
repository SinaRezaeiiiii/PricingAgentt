import { useState, useEffect } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ZAxis,
  Cell,
} from "recharts";
import { ClusterData } from "@/data/mockData";
import { dataStore } from "@/data/dataStore";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const clusterConfig = {
  "traffic-builder": {
    label: "Traffic Builders",
    description: "High Volume / Low Margin",
    color: "hsl(var(--chart-1))",
    bgColor: "bg-info-muted",
    textColor: "text-info",
  },
  premium: {
    label: "Premium Parts",
    description: "High Value / High Margin",
    color: "hsl(var(--profit))",
    bgColor: "bg-profit-muted",
    textColor: "text-profit",
  },
  problem: {
    label: "Problem Parts",
    description: "Low Volume / High Returns",
    color: "hsl(var(--loss))",
    bgColor: "bg-loss-muted",
    textColor: "text-loss",
  },
  standard: {
    label: "Standard Parts",
    description: "Average Performance",
    color: "hsl(var(--muted-foreground))",
    bgColor: "bg-muted",
    textColor: "text-muted-foreground",
  },
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as ClusterData;
    const config = clusterConfig[data.cluster];

    return (
      <div className="rounded-lg border bg-card p-4 shadow-elevated min-w-[250px]">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono font-semibold">{data["Part Number"]}</span>
          <Badge className={cn(config.bgColor, config.textColor, "text-xs")}>
            {config.label}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mb-3">{data["Part Description"]}</p>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Sales Velocity:</span>
            <span className="font-mono font-medium">
              {data["Customer Pay Part Purchase Qty"].toLocaleString()} units
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Landed Cost:</span>
            <span className="font-mono font-medium">{formatCurrency(data["Landed Cost"])}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Margin:</span>
            <span className={cn("font-mono font-medium", config.textColor)}>
              {data["Margin %"].toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Returns:</span>
            <span className="font-mono font-medium text-loss">
              {formatCurrency(data["Part Returns Amount"])}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export function AIClustering() {
  const [selectedCluster, setSelectedCluster] = useState<ClusterData["cluster"] | "all">("all");
  const [clusterData, setClusterData] = useState<ClusterData[]>([]);

  // Subscribe to data store and generate cluster data
  useEffect(() => {
    const updateData = () => {
      const data = dataStore.getCombinedData();
      // Generate cluster data from uploaded data
      const clustered = data.map((part) => {
        let cluster: ClusterData["cluster"] = "standard";
        
        // Clustering logic
        const highVolume = part["Customer Pay Part Purchase Qty"] > 1000;
        const lowMargin = part["Margin %"] < 15;
        const highMargin = part["Margin %"] > 30;
        const highReturns = part["Part Returns Amount"] > 5000;

        if (highVolume && lowMargin) {
          cluster = "traffic-builder";
        } else if (highMargin && part["Customer Pay Part Purchase Qty"] > 500) {
          cluster = "premium";
        } else if (highReturns || (part["Margin %"] < 10 && part["Customer Pay Part Purchase Qty"] < 100)) {
          cluster = "problem";
        }

        return {
          ...part,
          cluster,
        };
      });
      setClusterData(clustered);
    };

    updateData();
    const unsubscribe = dataStore.subscribe(updateData);
    return unsubscribe;
  }, []);

  const filteredData = selectedCluster === "all"
    ? clusterData
    : clusterData.filter((d) => d.cluster === selectedCluster);

  const clusterCounts = {
    "traffic-builder": clusterData.filter((d) => d.cluster === "traffic-builder").length,
    premium: clusterData.filter((d) => d.cluster === "premium").length,
    problem: clusterData.filter((d) => d.cluster === "problem").length,
    standard: clusterData.filter((d) => d.cluster === "standard").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">AI Clustering & Segmentation</h1>
        <p className="text-muted-foreground">
          Parts automatically grouped by velocity and value metrics
        </p>
      </div>

      {/* Cluster legend/filter */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => setSelectedCluster("all")}
          className={cn(
            "flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
            selectedCluster === "all"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card hover:bg-muted"
          )}
        >
          All Parts
          <Badge variant="secondary" className="ml-1">
            {clusterData.length}
          </Badge>
        </button>
        {(Object.keys(clusterConfig) as ClusterData["cluster"][]).map((cluster) => {
          const config = clusterConfig[cluster];
          return (
            <button
              key={cluster}
              onClick={() => setSelectedCluster(cluster)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                selectedCluster === cluster
                  ? "border-current"
                  : "border-border bg-card hover:bg-muted",
                selectedCluster === cluster && config.textColor,
                selectedCluster === cluster && config.bgColor
              )}
            >
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: config.color }}
              />
              {config.label}
              <Badge variant="secondary" className="ml-1">
                {clusterCounts[cluster]}
              </Badge>
            </button>
          );
        })}
      </div>

      {/* Chart */}
      <div className="rounded-xl border bg-card p-6 shadow-card">
        <div className="mb-4">
          <h3 className="font-semibold">Part Segmentation Matrix</h3>
          <p className="text-sm text-muted-foreground">
            X-Axis: Sales Velocity (Units Sold) • Y-Axis: Landed Cost ($)
          </p>
        </div>
        <div className="h-[500px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 60 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                opacity={0.5}
              />
              <XAxis
                type="number"
                dataKey="Landed Cost"
                name="Landed Cost"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                tickFormatter={(value) => `$${value.toFixed(0)}`}
                label={{
                  value: "Landed Cost ($)",
                  position: "bottom",
                  offset: 0,
                  fill: "hsl(var(--muted-foreground))",
                  fontSize: 12,
                }}
              />
              <YAxis
                type="number"
                dataKey="Margin %"
                name="Margin %"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                tickFormatter={(value) => `${value.toFixed(1)}%`}
                label={{
                  value: "Margin %",
                  angle: -90,
                  position: "insideLeft",
                  fill: "hsl(var(--muted-foreground))",
                  fontSize: 12,
                }}
              />
              <ZAxis
                type="number"
                dataKey="Margin %"
                range={[50, 400]}
                name="Margin %"
              />
              <Tooltip content={<CustomTooltip />} />
              <Scatter data={filteredData}>
                {filteredData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={clusterConfig[entry.cluster].color}
                    fillOpacity={0.7}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cluster insights */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {(Object.keys(clusterConfig) as ClusterData["cluster"][]).map((cluster) => {
          const config = clusterConfig[cluster];
          const parts = clusterData.filter((d) => d.cluster === cluster);
          const avgMargin = parts.length > 0
            ? parts.reduce((sum, p) => sum + p["Margin %"], 0) / parts.length
            : 0;
          const totalRevenue = parts.reduce(
            (sum, p) => sum + p["Customer Pay Part Purchase Qty"] * p["Landed Cost"],
            0
          );

          return (
            <div
              key={cluster}
              className={cn(
                "rounded-xl border p-5 transition-shadow hover:shadow-card-hover",
                config.bgColor
              )}
            >
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: config.color }}
                />
                <h4 className={cn("font-semibold", config.textColor)}>{config.label}</h4>
              </div>
              <p className="text-sm text-muted-foreground mb-4">{config.description}</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Parts:</span>
                  <span className="font-mono font-medium">{parts.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg Margin:</span>
                  <span className={cn("font-mono font-medium", config.textColor)}>
                    {avgMargin.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Value:</span>
                  <span className="font-mono font-medium">{formatCurrency(totalRevenue)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
