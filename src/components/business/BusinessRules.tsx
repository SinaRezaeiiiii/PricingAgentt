import { useEffect, useMemo, useState } from "react";
import {
  ComposedChart,
  CartesianGrid,
  Cell,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { dataStore } from "@/data/dataStore";
import { PartData } from "@/data/mockData";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type RuleSet = "market-conditions" | "lifecycle";
const DEFAULT_OUTLIER_MARGIN_DEVIATION_THRESHOLD = 15;

type OutlierRecommendation = "increase" | "decrease";
type TableSortDirection = "asc" | "desc";
type TableSortColumn =
  | "partNumber"
  | "partDescription"
  | "landedCost"
  | "margin"
  | "netQty"
  | "targetMargin"
  | "targetPrice"
  | "targetRevenue"
  | "currentRevenue"
  | "cluster";

interface HardcodedClusterPart extends PartData {
  ruleClusterId: number;
  ruleClusterName: string;
  ruleClusterKey: string;
  targetMargin: number;
  targetPrice: number;
  targetRevenue: number;
  currentRevenue: number;
  isDeactivated?: boolean;
}

interface OutlierReviewRow extends HardcodedClusterPart {
  targetMarginPercent: number;
  marginDeviation: number;
  currentPrice: number;
  recommendedPrice: number;
  priceDelta: number;
  priceDeltaPercent: number;
  recommendation: OutlierRecommendation;
}

interface ClusterRegressionStats {
  slope: number;
  intercept: number;
}

interface HardcodedClusterMeta {
  id: number;
  warranty: "Y" | "N";
  channel: "OTC" | "Workshop";
  classification: "High" | "Low";
  name: string;
}

interface LifecycleClusterMeta {
  id: number;
  lifecycleSegment: "1" | "2" | "3" | "4";
  accountAssignmentCode: "01" | "03" | "04";
  name: string;
  key: string;
}

const RULE_CLUSTER_META: HardcodedClusterMeta[] = [
  { id: 0, warranty: "Y", channel: "OTC", classification: "High", name: "Y - OTC - High" },
  { id: 1, warranty: "Y", channel: "OTC", classification: "Low", name: "Y - OTC - Low" },
  { id: 2, warranty: "Y", channel: "Workshop", classification: "High", name: "Y - Workshop - High" },
  { id: 3, warranty: "Y", channel: "Workshop", classification: "Low", name: "Y - Workshop - Low" },
  { id: 4, warranty: "N", channel: "OTC", classification: "High", name: "N - OTC - High" },
  { id: 5, warranty: "N", channel: "OTC", classification: "Low", name: "N - OTC - Low" },
  { id: 6, warranty: "N", channel: "Workshop", classification: "High", name: "N - Workshop - High" },
  { id: 7, warranty: "N", channel: "Workshop", classification: "Low", name: "N - Workshop - Low" },
];

const RULE_CLUSTER_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--profit))",
  "hsl(var(--warning))",
  "hsl(var(--info))",
];

const LIFECYCLE_SEGMENTS: Array<"1" | "2" | "3" | "4"> = ["1", "2", "3", "4"];
const ACCOUNT_CODES: Array<"01" | "03" | "04"> = ["01", "03", "04"];

const LIFECYCLE_CLUSTER_META: LifecycleClusterMeta[] = LIFECYCLE_SEGMENTS.flatMap((segment) =>
  ACCOUNT_CODES.map((accountCode) => {
    const id = (Number(segment) - 1) * ACCOUNT_CODES.length + ACCOUNT_CODES.indexOf(accountCode);
    return {
      id,
      lifecycleSegment: segment,
      accountAssignmentCode: accountCode,
      key: `${segment}-${accountCode}`,
      name: `Lifecycle ${segment} - ${accountCode}`,
    };
  })
);

const LIFECYCLE_CLUSTER_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--profit))",
  "hsl(var(--warning))",
  "hsl(var(--info))",
  "hsl(var(--muted-foreground))",
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
];

const normalizeChannel = (value: string): "OTC" | "Workshop" => {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized.includes("OTC") ? "OTC" : "Workshop";
};

const normalizeClassification = (value: string): "High" | "Low" => {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized.includes("HIGH") || normalized === "Y") {
    return "High";
  }
  return "Low";
};

const getClusterId = (part: PartData): number => {
  const warranty = part["Warranty > 35%"] ? "Y" : "N";
  const channel = normalizeChannel(part["OTC Workshop Channel"]);
  const classification = normalizeClassification(part["Competitive Classification"]);

  return RULE_CLUSTER_META.find(
    (cluster) =>
      cluster.warranty === warranty &&
      cluster.channel === channel &&
      cluster.classification === classification
  )?.id ?? 0;
};

const normalizeLifecycleSegment = (value: string): "1" | "2" | "3" | "4" | null => {
  const normalized = String(value || "").trim();
  const match = normalized.match(/[1-4]/);
  if (!match) {
    return null;
  }
  const segment = match[0] as "1" | "2" | "3" | "4";
  return LIFECYCLE_SEGMENTS.includes(segment) ? segment : null;
};

const normalizeAccountAssignmentCode = (value: string): "01" | "03" | "04" | null => {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }

  const numeric = Number(raw);
  if (!Number.isNaN(numeric)) {
    const fromNumeric = Math.trunc(numeric).toString().padStart(2, "0") as "01" | "03" | "04";
    if (ACCOUNT_CODES.includes(fromNumeric)) {
      return fromNumeric;
    }
  }

  const digits = raw.replace(/\D/g, "");
  const fromDigits = digits.slice(-2).padStart(2, "0") as "01" | "03" | "04";
  if (ACCOUNT_CODES.includes(fromDigits)) {
    return fromDigits;
  }
  return null;
};

const toSafeNumber = (value: unknown): number => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const toMarginDecimal = (marginPercentValue: unknown): number => {
  const margin = toSafeNumber(marginPercentValue);
  return margin > 1 ? margin / 100 : margin;
};

const calculateLinearRegression = (points: Array<{ x: number; y: number }>): ClusterRegressionStats => {
  if (points.length === 0) {
    return { slope: 0, intercept: 0 };
  }

  const n = points.length;
  const sumX = points.reduce((sum, p) => sum + p.x, 0);
  const sumY = points.reduce((sum, p) => sum + p.y, 0);
  const sumXY = points.reduce((sum, p) => sum + p.x * p.y, 0);
  const sumXX = points.reduce((sum, p) => sum + p.x * p.x, 0);

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) {
    return { slope: 0, intercept: sumY / n };
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
};

const calculatePartTargets = (part: PartData, slope: number, intercept: number) => {
  const cost = toSafeNumber(part["Landed Cost"]);
  const actualMargin = toMarginDecimal(part["Margin %"]);
  const netQty = toSafeNumber(part["Net Part Purchase Quantity"]);

  if (cost <= 0) {
    return {
      targetMargin: 0,
      targetPrice: 0,
      targetRevenue: 0,
      currentRevenue: 0,
    };
  }

  const targetMargin = Math.max(0, slope * Math.log(cost) + intercept);
  const targetDenominator = 1 - targetMargin;
  const currentDenominator = 1 - actualMargin;

  const targetPrice = targetDenominator === 0 ? 0 : cost * (1 / targetDenominator);
  const targetRevenue = targetPrice * netQty;
  const currentRevenue = currentDenominator === 0 ? 0 : (cost * (1 / currentDenominator)) * netQty;

  return {
    targetMargin,
    targetPrice: Number.isFinite(targetPrice) ? targetPrice : 0,
    targetRevenue: Number.isFinite(targetRevenue) ? targetRevenue : 0,
    currentRevenue: Number.isFinite(currentRevenue) ? currentRevenue : 0,
  };
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const buildRegressionLineData = (
  slope: number,
  intercept: number,
  minCost: number,
  maxCost: number,
  steps = 24
) => {
  const low = Math.max(minCost, 0.01);
  const high = Math.max(maxCost, low + 0.01);
  return Array.from({ length: steps + 1 }, (_, index) => {
    const ratio = index / steps;
    const cost = low + (high - low) * ratio;
    const margin = Math.max(0, slope * Math.log(cost) + intercept);
    return {
      "Landed Cost": cost,
      "Margin %": margin * 100,
    };
  });
};

export function BusinessRules() {
  const [ruleSet, setRuleSet] = useState<RuleSet>("market-conditions");
  const [parts, setParts] = useState<PartData[]>([]);
  const [selectedClusterKey, setSelectedClusterKey] = useState<string | null>(null);
  const [deactivatedPartNumbers, setDeactivatedPartNumbers] = useState<string[]>([]);
  const [showOutlierReview, setShowOutlierReview] = useState(false);
  const [outlierDeviationThreshold, setOutlierDeviationThreshold] = useState<number>(
    DEFAULT_OUTLIER_MARGIN_DEVIATION_THRESHOLD
  );
  const [tableSort, setTableSort] = useState<{ column: TableSortColumn; direction: TableSortDirection } | null>(
    null
  );

  const deactivatedPartNumberSet = useMemo(() => {
    return new Set(deactivatedPartNumbers);
  }, [deactivatedPartNumbers]);

  useEffect(() => {
    const updateData = () => {
      const nextParts = dataStore.getCombinedData();
      setParts(nextParts);
      const availablePartNumbers = new Set(nextParts.map((part) => String(part["Part Number"] || "").trim()));
      setDeactivatedPartNumbers((previous) => previous.filter((partNumber) => availablePartNumbers.has(partNumber)));
    };

    updateData();
    const unsubscribe = dataStore.subscribe(updateData);
    return unsubscribe;
  }, []);

  useEffect(() => {
    setSelectedClusterKey(null);
  }, [ruleSet]);

  const marketConditionClusters = useMemo(() => {
    const grouped = parts.reduce((acc, part) => {
      const clusterId = getClusterId(part);
      if (!acc[clusterId]) {
        acc[clusterId] = [];
      }
      acc[clusterId].push(part);
      return acc;
    }, {} as Record<number, PartData[]>);

    const points: HardcodedClusterPart[] = [];
    const deactivatedPoints: HardcodedClusterPart[] = [];

    const summary = RULE_CLUSTER_META.map((cluster) => {
      const clusterParts = grouped[cluster.id] || [];
      const activeClusterParts = clusterParts.filter(
        (part) => !deactivatedPartNumberSet.has(String(part["Part Number"] || "").trim())
      );
      const inactiveClusterParts = clusterParts.filter((part) =>
        deactivatedPartNumberSet.has(String(part["Part Number"] || "").trim())
      );

      const regressionPoints = activeClusterParts
        .filter((part) => toSafeNumber(part["Landed Cost"]) > 0)
        .map((part) => ({
          x: Math.log(toSafeNumber(part["Landed Cost"])),
          y: toMarginDecimal(part["Margin %"]),
        }));

      const { slope, intercept } = calculateLinearRegression(regressionPoints);
      let projectedRevenue = 0;
      let currentRevenue = 0;

      activeClusterParts.forEach((part) => {
        const targets = calculatePartTargets(part, slope, intercept);
        projectedRevenue += targets.targetRevenue;
        currentRevenue += targets.currentRevenue;
        points.push({
          ...part,
          ruleClusterId: cluster.id,
          ruleClusterName: cluster.name,
          ruleClusterKey: String(cluster.id),
          ...targets,
        });
      });

      inactiveClusterParts.forEach((part) => {
        const targets = calculatePartTargets(part, slope, intercept);
        deactivatedPoints.push({
          ...part,
          ruleClusterId: cluster.id,
          ruleClusterName: cluster.name,
          ruleClusterKey: String(cluster.id),
          ...targets,
          isDeactivated: true,
        });
      });

      return {
        ...cluster,
        count: activeClusterParts.length,
        slope,
        intercept,
        projectedRevenue,
        currentRevenue,
      };
    });

    return { summary, points, deactivatedPoints };
  }, [parts, deactivatedPartNumberSet]);

  const lifecycleClusters = useMemo(() => {
    const grouped = parts.reduce((acc, part) => {
      const segment = normalizeLifecycleSegment(part["Lifecycle Segment"]);
      const accountCode = normalizeAccountAssignmentCode(part["Account Assignment Code"]);

      if (!segment || !accountCode) {
        return acc;
      }

      const key = `${segment}-${accountCode}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(part);
      return acc;
    }, {} as Record<string, PartData[]>);

    const points: HardcodedClusterPart[] = [];
    const deactivatedPoints: HardcodedClusterPart[] = [];

    const summary = LIFECYCLE_CLUSTER_META.map((cluster) => {
      const clusterParts = grouped[cluster.key] || [];
      const activeClusterParts = clusterParts.filter(
        (part) => !deactivatedPartNumberSet.has(String(part["Part Number"] || "").trim())
      );
      const inactiveClusterParts = clusterParts.filter((part) =>
        deactivatedPartNumberSet.has(String(part["Part Number"] || "").trim())
      );

      const regressionPoints = activeClusterParts
        .filter((part) => toSafeNumber(part["Landed Cost"]) > 0)
        .map((part) => ({
          x: Math.log(toSafeNumber(part["Landed Cost"])),
          y: toMarginDecimal(part["Margin %"]),
        }));

      const { slope, intercept } = calculateLinearRegression(regressionPoints);
      let projectedRevenue = 0;
      let currentRevenue = 0;

      activeClusterParts.forEach((part) => {
        const targets = calculatePartTargets(part, slope, intercept);
        projectedRevenue += targets.targetRevenue;
        currentRevenue += targets.currentRevenue;
        points.push({
          ...part,
          ruleClusterId: cluster.id,
          ruleClusterName: cluster.name,
          ruleClusterKey: cluster.key,
          ...targets,
        });
      });

      inactiveClusterParts.forEach((part) => {
        const targets = calculatePartTargets(part, slope, intercept);
        deactivatedPoints.push({
          ...part,
          ruleClusterId: cluster.id,
          ruleClusterName: cluster.name,
          ruleClusterKey: cluster.key,
          ...targets,
          isDeactivated: true,
        });
      });

      return {
        ...cluster,
        count: activeClusterParts.length,
        slope,
        intercept,
        projectedRevenue,
        currentRevenue,
      };
    });

    return { summary, points, deactivatedPoints };
  }, [parts, deactivatedPartNumberSet]);

  const activePoints = useMemo(() => {
    const source = ruleSet === "market-conditions" ? marketConditionClusters.points : lifecycleClusters.points;
    if (!selectedClusterKey) {
      return source;
    }
    return source.filter((point) => point.ruleClusterKey === selectedClusterKey);
  }, [ruleSet, marketConditionClusters.points, lifecycleClusters.points, selectedClusterKey]);

  const deactivatedPoints = useMemo(() => {
    const source =
      ruleSet === "market-conditions" ? marketConditionClusters.deactivatedPoints : lifecycleClusters.deactivatedPoints;
    if (!selectedClusterKey) {
      return source;
    }
    return source.filter((point) => point.ruleClusterKey === selectedClusterKey);
  }, [ruleSet, marketConditionClusters.deactivatedPoints, lifecycleClusters.deactivatedPoints, selectedClusterKey]);

  const selectedClusterName = useMemo(() => {
    if (!selectedClusterKey) {
      return null;
    }

    if (ruleSet === "market-conditions") {
      const selected = marketConditionClusters.summary.find((cluster) => String(cluster.id) === selectedClusterKey);
      return selected?.name || null;
    }

    const selected = lifecycleClusters.summary.find((cluster) => cluster.key === selectedClusterKey);
    return selected?.name || null;
  }, [ruleSet, selectedClusterKey, marketConditionClusters.summary, lifecycleClusters.summary]);

  const activeSummary = useMemo(() => {
    return ruleSet === "market-conditions" ? marketConditionClusters.summary : lifecycleClusters.summary;
  }, [ruleSet, marketConditionClusters.summary, lifecycleClusters.summary]);

  const sortedActivePoints = useMemo(() => {
    if (!tableSort) {
      return activePoints;
    }

    const getSortValue = (point: HardcodedClusterPart, column: TableSortColumn): number | string => {
      switch (column) {
        case "partNumber":
          return String(point["Part Number"] || "");
        case "partDescription":
          return String(point["Part Description"] || "");
        case "landedCost":
          return toSafeNumber(point["Landed Cost"]);
        case "margin":
          return toSafeNumber(point["Margin %"]);
        case "netQty":
          return toSafeNumber(point["Net Part Purchase Quantity"]);
        case "targetMargin":
          return toSafeNumber(point.targetMargin);
        case "targetPrice":
          return toSafeNumber(point.targetPrice);
        case "targetRevenue":
          return toSafeNumber(point.targetRevenue);
        case "currentRevenue":
          return toSafeNumber(point.currentRevenue);
        case "cluster":
          return String(point.ruleClusterName || "");
      }
    };

    const sorted = [...activePoints].sort((a, b) => {
      const aValue = getSortValue(a, tableSort.column);
      const bValue = getSortValue(b, tableSort.column);

      if (typeof aValue === "number" && typeof bValue === "number") {
        const diff = aValue - bValue;
        return tableSort.direction === "asc" ? diff : -diff;
      }

      const compare = String(aValue).localeCompare(String(bValue), undefined, { sensitivity: "base" });
      return tableSort.direction === "asc" ? compare : -compare;
    });

    return sorted;
  }, [activePoints, tableSort]);

  const currentRulePoints = useMemo(() => {
    return ruleSet === "market-conditions" ? marketConditionClusters.points : lifecycleClusters.points;
  }, [ruleSet, marketConditionClusters.points, lifecycleClusters.points]);

  const revenueImpact = useMemo(() => {
    const totalCurrentRevenue = currentRulePoints.reduce((sum, point) => sum + point.currentRevenue, 0);
    const totalTargetRevenue = currentRulePoints.reduce((sum, point) => sum + point.targetRevenue, 0);
    const revenueDelta = totalTargetRevenue - totalCurrentRevenue;
    const revenueDeltaPercent = totalCurrentRevenue === 0 ? 0 : revenueDelta / totalCurrentRevenue;

    return {
      totalCurrentRevenue,
      totalTargetRevenue,
      revenueDelta,
      revenueDeltaPercent,
    };
  }, [currentRulePoints]);

  const outlierReviewRows = useMemo(() => {
    const rows: OutlierReviewRow[] = activePoints
      .map((point) => {
        const targetMarginPercent = toSafeNumber(point.targetMargin) * 100;
        const actualMarginPercent = toSafeNumber(point["Margin %"]);
        const marginDeviation = actualMarginPercent - targetMarginPercent;

        const cost = toSafeNumber(point["Landed Cost"]);
        const actualMargin = toMarginDecimal(point["Margin %"]);
        const currentDenominator = 1 - actualMargin;
        const currentPrice = currentDenominator === 0 ? 0 : cost * (1 / currentDenominator);

        const recommendedPrice = toSafeNumber(point.targetPrice);
        const priceDelta = recommendedPrice - currentPrice;
        const priceDeltaPercent = currentPrice === 0 ? 0 : priceDelta / currentPrice;

        return {
          ...point,
          targetMarginPercent,
          marginDeviation,
          currentPrice: Number.isFinite(currentPrice) ? currentPrice : 0,
          recommendedPrice,
          priceDelta: Number.isFinite(priceDelta) ? priceDelta : 0,
          priceDeltaPercent: Number.isFinite(priceDeltaPercent) ? priceDeltaPercent : 0,
          recommendation: marginDeviation < 0 ? "increase" : "decrease",
        };
      })
      .filter((row) => Math.abs(row.marginDeviation) >= outlierDeviationThreshold)
      .sort((a, b) => Math.abs(b.marginDeviation) - Math.abs(a.marginDeviation));

    return rows;
  }, [activePoints, outlierDeviationThreshold]);

  const activePointsByCluster = useMemo(() => {
    const grouped = activePoints.reduce((acc, point) => {
      if (!acc[point.ruleClusterId]) {
        acc[point.ruleClusterId] = [];
      }
      acc[point.ruleClusterId].push(point);
      return acc;
    }, {} as Record<number, HardcodedClusterPart[]>);
    return grouped;
  }, [activePoints]);

  const deactivatedPointsByCluster = useMemo(() => {
    const grouped = deactivatedPoints.reduce((acc, point) => {
      if (!acc[point.ruleClusterId]) {
        acc[point.ruleClusterId] = [];
      }
      acc[point.ruleClusterId].push(point);
      return acc;
    }, {} as Record<number, HardcodedClusterPart[]>);
    return grouped;
  }, [deactivatedPoints]);

  const regressionLineSeries = useMemo(() => {
    return activeSummary
      .filter((cluster) => {
        const clusterKey = ruleSet === "market-conditions" ? String(cluster.id) : cluster.key;
        if (selectedClusterKey && clusterKey !== selectedClusterKey) {
          return false;
        }
        return cluster.count > 0;
      })
      .map((cluster) => {
        const clusterPoints = activePointsByCluster[cluster.id] || [];
        const costs = clusterPoints
          .map((point) => toSafeNumber(point["Landed Cost"]))
          .filter((cost) => cost > 0);

        const minCost = costs.length > 0 ? Math.min(...costs) : 0.01;
        const maxCost = costs.length > 0 ? Math.max(...costs) : 1;

        return {
          clusterId: cluster.id,
          clusterName: cluster.name,
          points: buildRegressionLineData(cluster.slope, cluster.intercept, minCost, maxCost),
        };
      });
  }, [activeSummary, activePointsByCluster, selectedClusterKey, ruleSet]);

  const tooltipContent = ({ active, payload }: any) => {
    if (!active || !payload?.length) {
      return null;
    }

    const point = payload[0].payload as HardcodedClusterPart & { [key: string]: unknown };
    if (!point["Part Number"]) {
      return (
        <div className="rounded-lg border bg-card p-3 shadow-elevated min-w-[180px]">
          <p className="text-xs text-muted-foreground">Regression Curve</p>
          <div className="text-xs space-y-1 text-muted-foreground mt-1">
            <p>Cost: ${(toSafeNumber(point["Landed Cost"]) || 0).toFixed(2)}</p>
            <p>Target Margin: {(toSafeNumber(point["Margin %"]) || 0).toFixed(2)}%</p>
          </div>
        </div>
      );
    }

    return (
      <div className="rounded-lg border bg-card p-3 shadow-elevated min-w-[220px]">
        <div className="flex items-center gap-2 mb-2">
          <span className="font-mono font-semibold text-sm">{point["Part Number"]}</span>
          <Badge variant="outline" className="text-xs">
            Cluster {point.ruleClusterId}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mb-1">{point.ruleClusterName}</p>
        <div className="text-xs space-y-1 text-muted-foreground">
          {point.isDeactivated && <p className="text-muted-foreground">Status: Deactivated (click to reactivate)</p>}
          <p>Cost: ${(point["Landed Cost"] || 0).toFixed(2)}</p>
          <p>Margin: {(point["Margin %"] || 0).toFixed(1)}%</p>
          <p>Qty: {Math.round(point["Net Part Purchase Quantity"] || 0)} units</p>
        </div>
      </div>
    );
  };

  const toggleTableSort = (column: TableSortColumn) => {
    setTableSort((previousSort) => {
      if (!previousSort || previousSort.column !== column) {
        return { column, direction: "asc" };
      }
      return { column, direction: previousSort.direction === "asc" ? "desc" : "asc" };
    });
  };

  const getSortIndicator = (column: TableSortColumn) => {
    if (!tableSort || tableSort.column !== column) {
      return "↕";
    }
    return tableSort.direction === "asc" ? "↑" : "↓";
  };

  const togglePointActivation = (partNumber: string | undefined) => {
    const key = String(partNumber || "").trim();
    if (!key) {
      return;
    }

    setDeactivatedPartNumbers((previous) => {
      if (previous.includes(key)) {
        return previous.filter((part) => part !== key);
      }
      return [...previous, key];
    });
  };

  const resetDeactivatedPoints = () => {
    setDeactivatedPartNumbers([]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Business Rules</h1>
        <p className="text-muted-foreground">Hardcoded stakeholder-based clustering logic</p>
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Rule Set</Label>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{parts.length} parts</Badge>
            <Button
              size="sm"
              variant={showOutlierReview ? "default" : "outline"}
              onClick={() => setShowOutlierReview((prev) => !prev)}
            >
              Outlier Review
              <Badge variant="secondary" className="ml-2">
                {outlierReviewRows.length}
              </Badge>
            </Button>
          </div>
        </div>
        <Select value={ruleSet} onValueChange={(value: RuleSet) => setRuleSet(value)}>
          <SelectTrigger className="w-[260px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="market-conditions">Market Conditions</SelectItem>
            <SelectItem value="lifecycle">Lifecycle</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {showOutlierReview && (
        <div className="rounded-xl border bg-card p-6 shadow-card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">Outlier Review</h3>
              <p className="text-sm text-muted-foreground">
                Parts with margin deviation ≥ ±{outlierDeviationThreshold}% vs. rule-based target margin.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="rule-outlier-threshold" className="text-xs text-muted-foreground">
                Threshold %
              </Label>
              <Input
                id="rule-outlier-threshold"
                type="number"
                min={0}
                step={1}
                className="h-8 w-20"
                value={outlierDeviationThreshold}
                onChange={(event) => {
                  const parsed = Number(event.target.value);
                  setOutlierDeviationThreshold(Number.isFinite(parsed) ? Math.max(0, parsed) : 0);
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setOutlierDeviationThreshold(DEFAULT_OUTLIER_MARGIN_DEVIATION_THRESHOLD)}
              >
                Reset
              </Button>
              <Badge variant="outline">{outlierReviewRows.length} outliers</Badge>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Part Number</TableHead>
                <TableHead>Part Description</TableHead>
                <TableHead>Cluster</TableHead>
                <TableHead className="text-right">Actual Margin</TableHead>
                <TableHead className="text-right">Target Margin</TableHead>
                <TableHead className="text-right">Deviation</TableHead>
                <TableHead className="text-right">Current Price</TableHead>
                <TableHead className="text-right">Recommended Price</TableHead>
                <TableHead className="text-right">Price Delta</TableHead>
                <TableHead>Recommendation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {outlierReviewRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground">
                    No outliers found for the current rule set/cluster selection.
                  </TableCell>
                </TableRow>
              ) : (
                outlierReviewRows.slice(0, 200).map((part, index) => (
                  <TableRow key={`rule-outlier-${part["Part Number"]}-${index}`}>
                    <TableCell className="font-mono">{part["Part Number"]}</TableCell>
                    <TableCell className="max-w-[320px] truncate">{part["Part Description"]}</TableCell>
                    <TableCell>{part.ruleClusterName}</TableCell>
                    <TableCell className="text-right font-mono">{toSafeNumber(part["Margin %"]).toFixed(2)}%</TableCell>
                    <TableCell className="text-right font-mono">{part.targetMarginPercent.toFixed(2)}%</TableCell>
                    <TableCell className={`text-right font-mono ${part.marginDeviation >= 0 ? "text-warning" : "text-loss"}`}>
                      {part.marginDeviation >= 0 ? "+" : ""}{part.marginDeviation.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right font-mono">${part.currentPrice.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono">${part.recommendedPrice.toFixed(2)}</TableCell>
                    <TableCell className={`text-right font-mono ${part.priceDelta >= 0 ? "text-profit" : "text-loss"}`}>
                      {part.priceDelta >= 0 ? "+" : ""}${part.priceDelta.toFixed(2)} ({part.priceDeltaPercent >= 0 ? "+" : ""}{(part.priceDeltaPercent * 100).toFixed(2)}%)
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={part.recommendation === "increase" ? "text-profit" : "text-warning"}>
                        {part.recommendation === "increase" ? "Increase Price" : "Reduce Price"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {outlierReviewRows.length > 200 && (
            <p className="text-xs text-muted-foreground mt-3">Showing first 200 outliers for performance.</p>
          )}
        </div>
      )}

      <div className="rounded-xl border bg-card p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="font-semibold">Revenue Impact</h3>
          <Badge variant="outline">
            {ruleSet === "market-conditions" ? "Market Conditions" : "Lifecycle"}
          </Badge>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg border bg-card/40 p-3">
            <p className="text-xs text-muted-foreground">Total Current Revenue</p>
            <p className="text-lg font-semibold mt-1">{formatCurrency(revenueImpact.totalCurrentRevenue)}</p>
          </div>
          <div className="rounded-lg border bg-card/40 p-3">
            <p className="text-xs text-muted-foreground">Total Target Revenue</p>
            <p className="text-lg font-semibold mt-1">{formatCurrency(revenueImpact.totalTargetRevenue)}</p>
          </div>
          <div className="rounded-lg border bg-card/40 p-3">
            <p className="text-xs text-muted-foreground">Revenue Delta</p>
            <p className={`text-lg font-semibold mt-1 ${revenueImpact.revenueDelta >= 0 ? "text-profit" : "text-loss"}`}>
              {formatCurrency(revenueImpact.revenueDelta)}
            </p>
            <p className={`text-xs mt-1 ${revenueImpact.revenueDelta >= 0 ? "text-profit" : "text-loss"}`}>
              {(revenueImpact.revenueDeltaPercent * 100).toFixed(2)}%
            </p>
          </div>
        </div>
      </div>

      {ruleSet === "market-conditions" ? (
        <div className="flex flex-wrap gap-2">
          {marketConditionClusters.summary.map((cluster) => {
            const key = String(cluster.id);
            const active = selectedClusterKey === key;
            return (
              <button
                key={cluster.id}
                onClick={() => setSelectedClusterKey(active ? null : key)}
                className={`rounded-lg border px-3 py-2 text-xs min-w-[190px] text-left transition-colors ${
                  active ? "border-primary bg-primary/10" : "bg-card hover:bg-muted"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: RULE_CLUSTER_COLORS[cluster.id] }}
                    />
                    <span className="font-semibold">Cluster {cluster.id}</span>
                  </div>
                  <Badge variant="outline">{cluster.count}</Badge>
                </div>
                <p className="text-muted-foreground mt-1">{cluster.name}</p>
                <p className="text-muted-foreground mt-1">
                  m={cluster.slope.toFixed(4)} • c={cluster.intercept.toFixed(4)}
                </p>
                <p className="text-muted-foreground mt-1">
                  Projected Revenue: {formatCurrency(cluster.projectedRevenue)}
                </p>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {lifecycleClusters.summary.map((cluster) => {
            const active = selectedClusterKey === cluster.key;
            return (
              <button
                key={cluster.key}
                onClick={() => setSelectedClusterKey(active ? null : cluster.key)}
                className={`rounded-lg border px-3 py-2 text-xs min-w-[190px] text-left transition-colors ${
                  active ? "border-primary bg-primary/10" : "bg-card hover:bg-muted"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: LIFECYCLE_CLUSTER_COLORS[cluster.id] }}
                    />
                    <span className="font-semibold">Cluster {cluster.id}</span>
                  </div>
                  <Badge variant="outline">{cluster.count}</Badge>
                </div>
                <p className="text-muted-foreground mt-1">
                  Lifecycle {cluster.lifecycleSegment} • AAC {cluster.accountAssignmentCode}
                </p>
                <p className="text-muted-foreground mt-1">
                  m={cluster.slope.toFixed(4)} • c={cluster.intercept.toFixed(4)}
                </p>
                <p className="text-muted-foreground mt-1">
                  Projected Revenue: {formatCurrency(cluster.projectedRevenue)}
                </p>
              </button>
            );
          })}
        </div>
      )}

      <div className="rounded-xl border bg-card p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">Rule-Based Segmentation Matrix</h3>
            <p className="text-sm text-muted-foreground">
              X-Axis: Landed Cost ($) • Y-Axis: Margin (%) • {ruleSet === "market-conditions" ? "8 market-condition clusters" : "12 lifecycle/account-code clusters"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Click points to deactivate/reactivate outliers. Deactivated points are gray and excluded from all calculations.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {deactivatedPartNumbers.length > 0 && (
              <button
                type="button"
                onClick={resetDeactivatedPoints}
                className="text-xs rounded-md border px-2.5 py-1.5 hover:bg-muted transition-colors"
              >
                Reset Deactivated ({deactivatedPartNumbers.length})
              </button>
            )}
            {selectedClusterName && <Badge variant="secondary">{selectedClusterName}</Badge>}
          </div>
        </div>
        <div className="h-[500px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart margin={{ top: 20, right: 20, bottom: 20, left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis
                type="number"
                dataKey="Landed Cost"
                name="Landed Cost"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                tickFormatter={(value) => `$${Number(value).toFixed(0)}`}
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
                tickFormatter={(value) => `${Number(value).toFixed(1)}%`}
                label={{
                  value: "Margin (%)",
                  angle: -90,
                  position: "insideLeft",
                  fill: "hsl(var(--muted-foreground))",
                  fontSize: 12,
                }}
              />
              <ZAxis type="number" dataKey="Landed Cost" range={[50, 400]} name="Landed Cost" />
              <Tooltip content={tooltipContent} />

              {regressionLineSeries.map((series) => (
                <Line
                  key={`line-${ruleSet}-${series.clusterId}`}
                  type="monotone"
                  data={series.points}
                  dataKey="Margin %"
                  dot={false}
                  stroke={
                    ruleSet === "market-conditions"
                      ? RULE_CLUSTER_COLORS[series.clusterId]
                      : LIFECYCLE_CLUSTER_COLORS[series.clusterId]
                  }
                  strokeOpacity={selectedClusterKey ? 0.9 : 0.35}
                  strokeWidth={selectedClusterKey ? 2 : 1.2}
                  isAnimationActive={false}
                />
              ))}

              {Object.entries(activePointsByCluster).map(([clusterId, clusterPoints]) => {
                const numericClusterId = Number(clusterId);
                return (
                  <Scatter key={`scatter-${ruleSet}-${clusterId}`} data={clusterPoints}>
                    {clusterPoints.map((point, index) => (
                      <Cell
                        key={`${point["Part Number"]}-${clusterId}-${index}`}
                        onClick={() => togglePointActivation(String(point["Part Number"] || ""))}
                        fill={
                          ruleSet === "market-conditions"
                            ? RULE_CLUSTER_COLORS[numericClusterId]
                            : LIFECYCLE_CLUSTER_COLORS[numericClusterId]
                        }
                        fillOpacity={0.72}
                        className="cursor-pointer"
                      />
                    ))}
                  </Scatter>
                );
              })}

              {Object.entries(deactivatedPointsByCluster).map(([clusterId, clusterPoints]) => (
                <Scatter key={`scatter-deactivated-${ruleSet}-${clusterId}`} data={clusterPoints}>
                  {clusterPoints.map((point, index) => (
                    <Cell
                      key={`deactivated-${point["Part Number"]}-${clusterId}-${index}`}
                      onClick={() => togglePointActivation(String(point["Part Number"] || ""))}
                      fill="hsl(var(--muted-foreground))"
                      fillOpacity={0.45}
                      stroke="hsl(var(--muted-foreground))"
                      strokeOpacity={0.8}
                      className="cursor-pointer"
                    />
                  ))}
                </Scatter>
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Light lines show the per-cluster regression curve used for target margin: m × ln(cost) + c.
        </p>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="font-semibold">Cluster Data</h3>
          <Badge variant="outline">{activePoints.length} parts</Badge>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <button className="inline-flex items-center gap-1" onClick={() => toggleTableSort("partNumber")}>
                  Part Number <span className="text-muted-foreground">{getSortIndicator("partNumber")}</span>
                </button>
              </TableHead>
              <TableHead>
                <button className="inline-flex items-center gap-1" onClick={() => toggleTableSort("partDescription")}>
                  Part Description <span className="text-muted-foreground">{getSortIndicator("partDescription")}</span>
                </button>
              </TableHead>
              <TableHead className="text-right">
                <button className="inline-flex items-center gap-1" onClick={() => toggleTableSort("landedCost")}>
                  Landed Cost <span className="text-muted-foreground">{getSortIndicator("landedCost")}</span>
                </button>
              </TableHead>
              <TableHead className="text-right">
                <button className="inline-flex items-center gap-1" onClick={() => toggleTableSort("margin")}>
                  Margin % <span className="text-muted-foreground">{getSortIndicator("margin")}</span>
                </button>
              </TableHead>
              <TableHead className="text-right">
                <button className="inline-flex items-center gap-1" onClick={() => toggleTableSort("netQty")}>
                  Net Qty <span className="text-muted-foreground">{getSortIndicator("netQty")}</span>
                </button>
              </TableHead>
              <TableHead className="text-right">
                <button className="inline-flex items-center gap-1" onClick={() => toggleTableSort("targetMargin")}>
                  Target Margin <span className="text-muted-foreground">{getSortIndicator("targetMargin")}</span>
                </button>
              </TableHead>
              <TableHead className="text-right">
                <button className="inline-flex items-center gap-1" onClick={() => toggleTableSort("targetPrice")}>
                  Target Price <span className="text-muted-foreground">{getSortIndicator("targetPrice")}</span>
                </button>
              </TableHead>
              <TableHead className="text-right">
                <button className="inline-flex items-center gap-1" onClick={() => toggleTableSort("targetRevenue")}>
                  Target Revenue <span className="text-muted-foreground">{getSortIndicator("targetRevenue")}</span>
                </button>
              </TableHead>
              <TableHead className="text-right">
                <button className="inline-flex items-center gap-1" onClick={() => toggleTableSort("currentRevenue")}>
                  Current Revenue <span className="text-muted-foreground">{getSortIndicator("currentRevenue")}</span>
                </button>
              </TableHead>
              <TableHead>
                <button className="inline-flex items-center gap-1" onClick={() => toggleTableSort("cluster")}>
                  Cluster <span className="text-muted-foreground">{getSortIndicator("cluster")}</span>
                </button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activePoints.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground">
                  Keine Daten für den aktuell ausgewählten Cluster.
                </TableCell>
              </TableRow>
            ) : (
              sortedActivePoints.slice(0, 200).map((part, index) => (
                <TableRow key={`${part["Part Number"]}-${index}`}>
                  <TableCell className="font-mono">{part["Part Number"]}</TableCell>
                  <TableCell className="max-w-[320px] truncate">{part["Part Description"]}</TableCell>
                  <TableCell className="text-right font-mono">${(part["Landed Cost"] || 0).toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono">{(part["Margin %"] || 0).toFixed(1)}%</TableCell>
                  <TableCell className="text-right font-mono">{Math.round(part["Net Part Purchase Quantity"] || 0)}</TableCell>
                  <TableCell className="text-right font-mono">{(part.targetMargin * 100).toFixed(2)}%</TableCell>
                  <TableCell className="text-right font-mono">${part.targetPrice.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono">${part.targetRevenue.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono">${part.currentRevenue.toFixed(2)}</TableCell>
                  <TableCell>{part.ruleClusterName}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {sortedActivePoints.length > 200 && (
          <p className="text-xs text-muted-foreground mt-3">
            Showing first 200 parts for performance.
          </p>
        )}
      </div>
    </div>
  );
}