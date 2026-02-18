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
        });
        return;
      }

      const totalNetPurchaseAmount = data.reduce((sum, p) => sum + p["Customer Pay Purchases Amount"], 0);
      const avgMargin = data.reduce((sum, p) => sum + p["Margin %"], 0) / data.length;
      const totalReturnsAmount = data.reduce((sum, p) => sum + p["Part Returns Amount"], 0);
      const highReturnsParts = data.filter(p => p["Part Returns Amount"] > 5000).length;
      const lowMarginHighVolume = data.filter(p => p["Margin %"] < 15 && p["Customer Pay Part Purchase Qty"] > 1000).length;
      const avgLandedCost = data.reduce((sum, p) => sum + p["Landed Cost"], 0) / data.length;
      const avgNetPrice = data.reduce((sum, p) => sum + p["Net Price New"], 0) / data.length;

      setMetrics({
        totalNetPurchaseAmount,
        avgMargin,
        totalReturnsAmount,
        totalPartsCount: data.length,
        highReturnsParts,
        lowMarginHighVolume,
        avgLandedCost,
        avgNetPrice,
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
          change={{ value: "+8.2%", positive: true }}
          icon={DollarSign}
          variant="profit"
          subtitle="Revenue from all part sales"
        />
        <MetricCard
          title="Average Margin"
          value={`${metrics.avgMargin.toFixed(1)}%`}
          change={{ value: "+2.3%", positive: true }}
          icon={TrendingUp}
          subtitle="Landed Cost vs Net Price"
        />
        <MetricCard
          title="Total Returns Amount"
          value={formatCurrency(metrics.totalReturnsAmount)}
          change={{ value: "+5.1%", positive: false }}
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
          description="Parts with return value exceeding $5,000"
          count={metrics.highReturnsParts}
          variant="critical"
          onClick={onNavigateToWorkbench}
        />
        <AlertCard
          title="Margin Optimization Opportunity"
          description="High volume parts with margin below 15%"
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
                <span className="font-mono font-medium">5</span>
              </div>
            </div>
          </div>
          
          {/* Top performers mini table */}
          <div className="rounded-xl border bg-card p-5 shadow-card">
            <h3 className="font-semibold mb-4">Top Franchises by Revenue</h3>
            <div className="space-y-3">
              {[
                { name: "Mercedes-Benz", amount: 2450000, share: 35 },
                { name: "BMW", amount: 1890000, share: 27 },
                { name: "Audi", amount: 1260000, share: 18 },
                { name: "Porsche", amount: 840000, share: 12 },
                { name: "VW", amount: 560000, share: 8 },
              ].map((franchise, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">{franchise.name}</span>
                      <span className="text-sm text-muted-foreground">{franchise.share}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${franchise.share}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
