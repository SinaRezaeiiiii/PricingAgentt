import { useState, useEffect } from "react";
import { DollarSign, TrendingUp, RotateCcw, Package } from "lucide-react";
import { MetricCard } from "./MetricCard";
import { AlertCard } from "./AlertCard";
import { RevenueChart } from "./RevenueChart";
import { dataStore } from "@/data/dataStore";

const formatCurrency = (value: number) => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${value.toFixed(2)}`;
};

interface ExecutiveDashboardProps {
  onNavigateToWorkbench: () => void;
}

const buildPercentChange = (currentValue: number, previousValue: number) => {
  if (!Number.isFinite(currentValue) || !Number.isFinite(previousValue) || previousValue <= 0) {
    return undefined;
  }

  const changePercent = ((currentValue - previousValue) / previousValue) * 100;
  return {
    value: `${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(1)}%`,
    positive: changePercent >= 0,
  };
};

interface FranchiseInsight {
  name: string;
  amount: number;
  share: number;
}

const getPercentile = (values: number[], percentile: number) => {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(percentile * sorted.length) - 1));
  return sorted[index] || 0;
};

export function ExecutiveDashboard({ onNavigateToWorkbench }: ExecutiveDashboardProps) {
  const [metrics, setMetrics] = useState({
    totalNetPurchaseAmount: 0,
    avgMargin: 0,
    totalReturnsAmount: 0,
    totalPartsCount: 0,
    highReturnsParts: 0,
    lowMarginHighVolume: 0,
    avgLandedCost: 0,
    avgNetPrice: 0,
    franchiseCount: 0,
    revenueChange: undefined as { value: string; positive: boolean } | undefined,
    topFranchises: [] as FranchiseInsight[],
    highReturnsThreshold: 0,
    lowMarginThreshold: 0,
    highVolumeThreshold: 0,
  });

  useEffect(() => {
    const updateMetrics = () => {
      const data = dataStore.getCombinedData();
      
      if (data.length === 0) {
        setMetrics({
          totalNetPurchaseAmount: 0,
          avgMargin: 0,
          totalReturnsAmount: 0,
          totalPartsCount: 0,
          highReturnsParts: 0,
          lowMarginHighVolume: 0,
          avgLandedCost: 0,
          avgNetPrice: 0,
          franchiseCount: 0,
          revenueChange: undefined,
          topFranchises: [],
          highReturnsThreshold: 0,
          lowMarginThreshold: 0,
          highVolumeThreshold: 0,
        });
        return;
      }

      const totalCustomerPayAmount = data.reduce((sum, p) => sum + (p["Customer Pay Purchases Amount"] || 0), 0);
      const totalManufacturerPayAmount = data.reduce(
        (sum, p) => sum + (p["Manufacturer Pay Purchases Amount"] || 0),
        0
      );
      const totalNetPurchaseAmount = totalCustomerPayAmount + totalManufacturerPayAmount;
      const margins = data.map((p) => Number(p["Margin %"]) || 0);
      const netQuantities = data.map((p) => Number(p["Net Part Purchase Quantity"]) || 0);
      const returnAmounts = data.map((p) => Math.abs(Number(p["Part Returns Amount"]) || 0));

      const avgMargin = margins.reduce((sum, value) => sum + value, 0) / data.length;
      const totalReturnsAmount = returnAmounts.reduce((sum, value) => sum + value, 0);
      const highReturnsThreshold = getPercentile(returnAmounts, 0.9);
      const lowMarginThreshold = getPercentile(margins, 0.2);
      const highVolumeThreshold = getPercentile(netQuantities, 0.8);

      const highReturnsParts = data.filter(
        (p) => Math.abs(p["Part Returns Amount"] || 0) >= highReturnsThreshold
      ).length;
      const lowMarginHighVolume = data.filter(
        (p) =>
          (p["Margin %"] || 0) <= lowMarginThreshold &&
          (p["Net Part Purchase Quantity"] || 0) >= highVolumeThreshold
      ).length;
      const avgLandedCost = data.reduce((sum, p) => sum + p["Landed Cost"], 0) / data.length;
      const avgNetPrice = data.reduce((sum, p) => sum + p["Net Price New"], 0) / data.length;

      const franchiseRevenueMap = data.reduce((acc, part) => {
        const franchise = String(part["Franchise"] || "Unknown").trim() || "Unknown";
        const partRevenue = (part["Customer Pay Purchases Amount"] || 0) + (part["Manufacturer Pay Purchases Amount"] || 0);
        acc.set(franchise, (acc.get(franchise) || 0) + partRevenue);
        return acc;
      }, new Map<string, number>());

      const topFranchises = Array.from(franchiseRevenueMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, amount]) => ({
          name,
          amount,
          share: totalNetPurchaseAmount > 0 ? (amount / totalNetPurchaseAmount) * 100 : 0,
        }));

      const monthlyRevenue = dataStore.getMonthlyRevenueByPaymentType(2);
      let revenueChange: { value: string; positive: boolean } | undefined;
      if (monthlyRevenue.length >= 2) {
        const previous = monthlyRevenue[monthlyRevenue.length - 2];
        const current = monthlyRevenue[monthlyRevenue.length - 1];
        const previousTotal =
          (previous["Customer Pay Purchases Amount"] || 0) +
          (previous["Manufacturer Pay Purchases Amount"] || 0);
        const currentTotal =
          (current["Customer Pay Purchases Amount"] || 0) +
          (current["Manufacturer Pay Purchases Amount"] || 0);
        revenueChange = buildPercentChange(currentTotal, previousTotal);
      }

      setMetrics({
        totalNetPurchaseAmount,
        avgMargin,
        totalReturnsAmount,
        totalPartsCount: data.length,
        highReturnsParts,
        lowMarginHighVolume,
        avgLandedCost,
        avgNetPrice,
        franchiseCount: franchiseRevenueMap.size,
        revenueChange,
        topFranchises,
        highReturnsThreshold,
        lowMarginThreshold,
        highVolumeThreshold,
      });
    };

    updateMetrics();
    const unsubscribe = dataStore.subscribe(updateMetrics);
    return unsubscribe;
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Executive Dashboard</h1>
        <p className="text-muted-foreground">
          Morning overview • {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Metric cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Net Purchase Amount"
          value={formatCurrency(metrics.totalNetPurchaseAmount)}
          change={metrics.revenueChange}
          icon={DollarSign}
          variant="profit"
          subtitle="Customer + Manufacturer Pay"
        />
        <MetricCard
          title="Average Margin"
          value={`${metrics.avgMargin.toFixed(1)}%`}
          icon={TrendingUp}
          subtitle="Landed Cost vs Net Price"
        />
        <MetricCard
          title="Total Returns Amount"
          value={formatCurrency(metrics.totalReturnsAmount)}
          icon={RotateCcw}
          variant="loss"
          subtitle="Value of returned parts"
        />
        <MetricCard
          title="Active Parts"
          value={metrics.totalPartsCount.toLocaleString()}
          icon={Package}
          subtitle="Parts in catalog"
        />
      </div>

      {/* Alerts section */}
      <div className="grid gap-4 lg:grid-cols-2">
        <AlertCard
          title="High Returns Detected"
          description={`Top 10% return exposure (>= ${formatCurrency(metrics.highReturnsThreshold)})`}
          count={metrics.highReturnsParts}
          variant="critical"
          onClick={onNavigateToWorkbench}
        />
        <AlertCard
          title="Margin Optimization Opportunity"
          description={`Margin <= ${metrics.lowMarginThreshold.toFixed(1)}% with qty >= ${Math.round(metrics.highVolumeThreshold).toLocaleString()}`}
          count={metrics.lowMarginHighVolume}
          variant="warning"
          onClick={onNavigateToWorkbench}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RevenueChart />
        </div>
        <div className="space-y-4">
          {/* Quick Stats */}
          <div className="rounded-xl border bg-card p-5 shadow-card">
            <h3 className="font-semibold mb-4">Quick Insights</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-3 border-b">
                <span className="text-sm text-muted-foreground">Avg. Landed Cost</span>
                <span className="font-mono font-medium">{formatCurrency(metrics.avgLandedCost)}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b">
                <span className="text-sm text-muted-foreground">Avg. Net Price</span>
                <span className="font-mono font-medium">{formatCurrency(metrics.avgNetPrice)}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b">
                <span className="text-sm text-muted-foreground">Price Spread</span>
                <span className="font-mono font-medium text-profit">
                  +{formatCurrency(metrics.avgNetPrice - metrics.avgLandedCost)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Franchises</span>
                <span className="font-mono font-medium">{metrics.franchiseCount}</span>
              </div>
            </div>
          </div>
          
          {/* Top performers mini table */}
          <div className="rounded-xl border bg-card p-5 shadow-card">
            <h3 className="font-semibold mb-4">Top Franchises by Revenue</h3>
            {metrics.topFranchises.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Umsatzdaten für Franchises verfügbar.</p>
            ) : (
              <div className="space-y-3">
                {metrics.topFranchises.map((franchise, i) => (
                  <div key={`${franchise.name}-${i}`} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium">{franchise.name}</span>
                        <span className="text-sm text-muted-foreground">{franchise.share.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${Math.min(franchise.share, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
