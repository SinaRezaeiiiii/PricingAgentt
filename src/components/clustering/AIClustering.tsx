import { useState, useEffect, useMemo, useRef } from "react";
import {
  ComposedChart,
  Scatter,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ZAxis,
  Cell,
} from "recharts";
import { ClusterData } from "@/data/mockData";
import {
  dataStore,
  type ScenarioFilters,
  type WeightedScoreMappings,
  type WeightedScoringConfig,
  DEFAULT_WEIGHTED_SCORE_MAPPINGS,
  DEFAULT_WEIGHTED_SCORE_WEIGHTS,
} from "@/data/dataStore";
import { sampleDataForChart, getDataRenderComplexity } from "@/lib/performance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const UNDERPRICED_THRESHOLD = 10; // Margin below ideal by this amount → Underpriced
const OVERPRICED_THRESHOLD = 15; // Margin above ideal by this amount → Review
const DEFAULT_OUTLIER_MARGIN_DEVIATION_THRESHOLD = 15;

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

// Pricing status types based on target margin comparison
type PricingStatus = "underpriced" | "optimized" | "review";

type OutlierRecommendation = "increase" | "decrease";

interface OutlierReviewRow extends ClusterData {
  clusterKey: string;
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

const pricingStatusConfig = {
  underpriced: { emoji: "🔴", label: "Underpriced", color: "text-loss" },
  optimized: { emoji: "🟢", label: "Optimized", color: "text-profit" },
  review: { emoji: "🟡", label: "Review", color: "text-warning" },
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

const toSafeNumber = (value: unknown): number => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const toMarginDecimal = (marginPercentValue: unknown): number => {
  const margin = toSafeNumber(marginPercentValue);
  return margin > 1 ? margin / 100 : margin;
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

const calculatePartTargets = (part: ClusterData, slope: number, intercept: number) => {
  const cost = toSafeNumber(part["Landed Cost"]);
  const actualMargin = toMarginDecimal(part["Margin %"]);
  const netQty = toSafeNumber(part["Net Part Purchase Quantity"]);

  if (cost <= 0) {
    return {
      targetMarginPercent: 0,
      targetPrice: 0,
      targetRevenue: 0,
      currentRevenue: 0,
      actualMarginPercent: actualMargin * 100,
    };
  }

  const targetMargin = Math.max(0, slope * Math.log(cost) + intercept);
  const targetDenominator = 1 - targetMargin;
  const currentDenominator = 1 - actualMargin;

  const targetPrice = targetDenominator === 0 ? 0 : cost * (1 / targetDenominator);
  const targetRevenue = targetPrice * netQty;
  const currentRevenue = currentDenominator === 0 ? 0 : (cost * (1 / currentDenominator)) * netQty;

  return {
    targetMarginPercent: targetMargin * 100,
    targetPrice: Number.isFinite(targetPrice) ? targetPrice : 0,
    targetRevenue: Number.isFinite(targetRevenue) ? targetRevenue : 0,
    currentRevenue: Number.isFinite(currentRevenue) ? currentRevenue : 0,
    actualMarginPercent: actualMargin * 100,
  };
};

// Generate dynamic colors for AI clusters
const generateAIClusterColors = (k: number): string[] => {
  const colors = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
    "hsl(var(--profit))",
    "hsl(var(--loss))",
    "hsl(var(--warning))",
    "hsl(var(--info))",
    "hsl(var(--muted-foreground))",
  ];
  return Array.from({ length: k }, (_, i) => colors[i % colors.length]);
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const DEFAULT_SCENARIO_FILTERS: ScenarioFilters = {
  warrantyOver35: "all",
  otcWorkshopChannel: "all",
  competitiveClassification: "all",
  lifecycleSegment: "all",
};

const WEIGHTED_SCORING_FIELDS: Array<{
  key: keyof WeightedScoreMappings;
  label: string;
}> = [
  {
    key: "otcWorkshopChannel",
    label: "OTC/Workshop Channel",
  },
  {
    key: "competitiveFlag",
    label: "Competitive Flag",
  },
  {
    key: "lifecycleSegment",
    label: "Lifecycle Segment",
  },
  {
    key: "accountAssignmentCode",
    label: "Account Assignment Code",
  },
  {
    key: "warrantyOver35",
    label: "Warranty % > 35%",
  },
];

interface ScoreBreakdownItem {
  key: keyof WeightedScoreMappings;
  label: string;
  valueLabel: string;
  mappingScore: number;
  weight: number;
  weightedContribution: number;
}

const getLifecycleScoreBreakdown = (value: unknown, mappings: WeightedScoreMappings) => {
  const normalized = String(value || "").trim();
  if (normalized.includes("1")) {
    return { valueLabel: normalized || "Segment 1", score: mappings.lifecycleSegment.segment1 };
  }
  if (normalized.includes("2")) {
    return { valueLabel: normalized || "Segment 2", score: mappings.lifecycleSegment.segment2 };
  }
  if (normalized.includes("3")) {
    return { valueLabel: normalized || "Segment 3", score: mappings.lifecycleSegment.segment3 };
  }
  if (normalized.includes("4")) {
    return { valueLabel: normalized || "Segment 4", score: mappings.lifecycleSegment.segment4 };
  }
  return {
    valueLabel: normalized || "Other",
    score: mappings.lifecycleSegment.other,
  };
};

const getAccountAssignmentScoreBreakdown = (value: unknown, mappings: WeightedScoreMappings) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return { valueLabel: "Other", score: mappings.accountAssignmentCode.other };
  }

  const digits = raw.replace(/\D/g, "");
  const code = digits.slice(-2).padStart(2, "0");
  if (code === "01") {
    return { valueLabel: "01", score: mappings.accountAssignmentCode.code01 };
  }
  if (code === "03") {
    return { valueLabel: "03", score: mappings.accountAssignmentCode.code03 };
  }
  if (code === "04") {
    return { valueLabel: "04", score: mappings.accountAssignmentCode.code04 };
  }
  return { valueLabel: raw || "Other", score: mappings.accountAssignmentCode.other };
};

const buildWeightedScoreBreakdown = (
  part: ClusterData,
  mappings: WeightedScoreMappings,
  weights = DEFAULT_WEIGHTED_SCORE_WEIGHTS
) => {
  const channel = String(part["OTC Workshop Channel"] || "").trim().toUpperCase();
  const channelIsOtc = channel.includes("OTC");
  const channelScore = channelIsOtc ? mappings.otcWorkshopChannel.otc : mappings.otcWorkshopChannel.other;

  const competitive = String(part["Competitive Classification"] || "").trim().toUpperCase();
  const competitiveIsY = competitive === "Y";
  const competitiveScore = competitiveIsY ? mappings.competitiveFlag.y : mappings.competitiveFlag.n;

  const lifecycle = getLifecycleScoreBreakdown(part["Lifecycle Segment"], mappings);
  const assignment = getAccountAssignmentScoreBreakdown(part["Account Assignment Code"], mappings);

  const warrantyYes = Boolean(part["Warranty > 35%"]);
  const warrantyScore = warrantyYes ? mappings.warrantyOver35.yes : mappings.warrantyOver35.no;

  const items: ScoreBreakdownItem[] = [
    {
      key: "otcWorkshopChannel",
      label: "OTC/Workshop Channel",
      valueLabel: channelIsOtc ? "OTC" : (channel || "Other"),
      mappingScore: channelScore,
      weight: weights.otcWorkshopChannel,
      weightedContribution: weights.otcWorkshopChannel * channelScore,
    },
    {
      key: "competitiveFlag",
      label: "Competitive Flag",
      valueLabel: competitiveIsY ? "Y" : "N",
      mappingScore: competitiveScore,
      weight: weights.competitiveFlag,
      weightedContribution: weights.competitiveFlag * competitiveScore,
    },
    {
      key: "lifecycleSegment",
      label: "Lifecycle Segment",
      valueLabel: lifecycle.valueLabel,
      mappingScore: lifecycle.score,
      weight: weights.lifecycleSegment,
      weightedContribution: weights.lifecycleSegment * lifecycle.score,
    },
    {
      key: "accountAssignmentCode",
      label: "Account Assignment Code",
      valueLabel: assignment.valueLabel,
      mappingScore: assignment.score,
      weight: weights.accountAssignmentCode,
      weightedContribution: weights.accountAssignmentCode * assignment.score,
    },
    {
      key: "warrantyOver35",
      label: "Warranty % > 35%",
      valueLabel: warrantyYes ? "Yes" : "No",
      mappingScore: warrantyScore,
      weight: weights.warrantyOver35,
      weightedContribution: weights.warrantyOver35 * warrantyScore,
    },
  ];

  const total = items.reduce((sum, item) => sum + item.weightedContribution, 0);
  return { items, total };
};

const applyScenarioFilters = (data: ClusterData[], filters: ScenarioFilters): ClusterData[] => {
  return data.filter((part) => {
    if (filters.warrantyOver35 === "yes" && !part["Warranty > 35%"]) {
      return false;
    }
    if (filters.warrantyOver35 === "no" && part["Warranty > 35%"]) {
      return false;
    }

    if (filters.otcWorkshopChannel !== "all") {
      const channel = String(part["OTC Workshop Channel"] || "").trim().toUpperCase();
      if (filters.otcWorkshopChannel === "OTC" && !channel.includes("OTC")) {
        return false;
      }
      if (
        filters.otcWorkshopChannel === "Workshop" &&
        !(channel.includes("WORKSHOP") || channel === "WS")
      ) {
        return false;
      }
    }

    if (filters.competitiveClassification !== "all") {
      const classification = String(part["Competitive Classification"] || "").trim().toUpperCase();
      if (classification !== filters.competitiveClassification) {
        return false;
      }
    }

    if (filters.lifecycleSegment !== "all") {
      const segment = String(part["Lifecycle Segment"] || "").trim().toLowerCase();
      if (segment !== filters.lifecycleSegment.trim().toLowerCase()) {
        return false;
      }
    }

    return true;
  });
};

export function AIClustering() {
  const [selectedCluster, setSelectedCluster] = useState<ClusterData["cluster"] | number | "all">("all");
  const [clusterData, setClusterData] = useState<ClusterData[]>([]);
  const [excludedParts, setExcludedParts] = useState<Set<string>>(new Set());
  const [selectedPart, setSelectedPart] = useState<ClusterData | null>(null);
  const [clusterMode, setClusterMode] = useState<"legacy" | "ai">("ai");
  const [numClusters, setNumClusters] = useState<number>(5);
  const [useQualityFilter, setUseQualityFilter] = useState<boolean>(false);
  const [scenarioFilters, setScenarioFilters] = useState<ScenarioFilters>(DEFAULT_SCENARIO_FILTERS);
  const [weightedScoringEnabled, setWeightedScoringEnabled] = useState<boolean>(false);
  const [showOutlierReview, setShowOutlierReview] = useState<boolean>(false);
  const [outlierDeviationThreshold, setOutlierDeviationThreshold] = useState<number>(
    DEFAULT_OUTLIER_MARGIN_DEVIATION_THRESHOLD
  );
  const [weightedScoreMappings, setWeightedScoreMappings] = useState<WeightedScoreMappings>(
    DEFAULT_WEIGHTED_SCORE_MAPPINGS
  );
  const lastClusteringRequestRef = useRef<string>("");

  const updateScoreMapping = (
    group: keyof WeightedScoreMappings,
    option: string,
    rawValue: string
  ) => {
    const parsed = Number(rawValue);
    const nextValue = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;

    setWeightedScoreMappings((prev) => ({
      ...prev,
      [group]: {
        ...(prev[group] as Record<string, number>),
        [option]: nextValue,
      },
    }));
  };

  // Tooltip component with access to cluster mode
  const SimpleTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as ClusterData & { [key: string]: unknown };

      if (!data["Part Number"]) {
        return (
          <div className="rounded-lg border bg-card p-3 shadow-elevated min-w-[180px]">
            <p className="text-xs text-muted-foreground">Regression Curve</p>
            <div className="text-xs space-y-1 text-muted-foreground mt-1">
              <p>Cost: ${(toSafeNumber(data["Landed Cost"]) || 0).toFixed(2)}</p>
              <p>Target Margin: {(toSafeNumber(data["Margin %"]) || 0).toFixed(2)}%</p>
            </div>
          </div>
        );
      }
      
      if (clusterMode === "ai") {
        const clusterId = data["AI_Cluster_ID"];
        const colors = generateAIClusterColors(numClusters);
        return (
          <div className="rounded-lg border bg-card p-3 shadow-elevated min-w-[220px]">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono font-semibold text-sm">{data["Part Number"]}</span>
              <Badge variant="outline" className="text-xs">
                Cluster {clusterId}
              </Badge>
            </div>
            <div className="text-xs space-y-1 text-muted-foreground">
              <p>Cost: ${(data["Landed Cost"] || 0).toFixed(2)}</p>
              <p>Margin: {(data["Margin %"] || 0).toFixed(1)}%</p>
              <p>Qty: {Math.round(data["Net Part Purchase Quantity"] || 0)} units</p>
              {weightedScoringEnabled && (
                <p>Score: {(data["Calculated Score"] || 0).toFixed(1)}</p>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2 italic">Click for full details</p>
          </div>
        );
      } else {
        const config = clusterConfig[data.cluster];
        return (
          <div className="rounded-lg border bg-card p-3 shadow-elevated">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono font-semibold text-sm">{data["Part Number"]}</span>
              <Badge className={cn(config.bgColor, config.textColor, "text-xs")}>
                {config.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">Click for details</p>
          </div>
        );
      }
    }
    return null;
  };

  // Toggle exclude/include for a part
  const handleToggleExclude = (partNumber: string) => {
    setExcludedParts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(partNumber)) {
        newSet.delete(partNumber);
      } else {
        newSet.add(partNumber);
      }
      return newSet;
    });
    setSelectedPart(null); // Close dialog after action
  };

  // Handle click on scatter point
  const handlePointClick = (data: any) => {
    setSelectedPart(data);
  };

  // Subscribe to data store and generate cluster data
  useEffect(() => {
    const updateData = () => {
      const data = dataStore.getCombinedData();
      // Generate cluster data from uploaded data
      const clustered = data.map((part) => {
        let cluster: ClusterData["cluster"] = "standard";
        
        // Legacy clustering logic
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

  // Recalculate AI clusters when k or quality filter changes
  useEffect(() => {
    if (clusterMode === "ai" && dataStore.hasData()) {
      const requestKey = JSON.stringify({
        numClusters,
        useQualityFilter,
        scenarioFilters,
        weightedScoringEnabled,
        weightedScoreMappings,
      });

      if (lastClusteringRequestRef.current === requestKey) {
        return;
      }
      lastClusteringRequestRef.current = requestKey;

      const scoringConfig: WeightedScoringConfig = {
        enabled: weightedScoringEnabled,
        weights: DEFAULT_WEIGHTED_SCORE_WEIGHTS,
        mappings: weightedScoreMappings,
      };

      dataStore.calculateAIClusters(numClusters, useQualityFilter, scenarioFilters, scoringConfig);
    }
  }, [
    numClusters,
    clusterMode,
    useQualityFilter,
    scenarioFilters,
    weightedScoringEnabled,
    weightedScoreMappings,
  ]);

  useEffect(() => {
    setSelectedCluster("all");
  }, [scenarioFilters]);

  const lifecycleSegments = useMemo(() => {
    const unique = new Set(
      clusterData
        .map((part) => String(part["Lifecycle Segment"] || "").trim())
        .filter((segment) => segment.length > 0)
    );
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [clusterData]);

  const scenarioFilteredData = useMemo(() => {
    return applyScenarioFilters(clusterData, scenarioFilters);
  }, [clusterData, scenarioFilters]);

  // Filter by cluster and exclude parts that are marked as excluded
  const filteredData = (() => {
    let data = scenarioFilteredData;
    
    // Filter out parts with Cluster ID -1 (excluded by quality filter) when using AI mode with quality filter
    if (clusterMode === "ai" && useQualityFilter) {
      data = data.filter((d) => d["AI_Cluster_ID"] !== -1);
    }
    
    if (selectedCluster !== "all") {
      if (clusterMode === "ai") {
        data = data.filter((d) => d["AI_Cluster_ID"] === selectedCluster);
      } else {
        data = data.filter((d) => d.cluster === selectedCluster);
      }
    }
    return data.filter((d) => !excludedParts.has(d["Part Number"]));
  })();

  // Filter out excluded parts from calculations
  let activeData = scenarioFilteredData.filter((d) => !excludedParts.has(d["Part Number"]));
  
  // Also filter out parts with Cluster ID -1 when using quality filter in AI mode
  if (clusterMode === "ai" && useQualityFilter) {
    activeData = activeData.filter((d) => d["AI_Cluster_ID"] !== -1);
  }

  // Calculate cluster counts and statistics based on mode
  const clusterCounts = clusterMode === "ai"
    ? Array.from({ length: numClusters }, (_, i) => {
        const partsInCluster = activeData.filter((d) => d["AI_Cluster_ID"] === i);
        const count = partsInCluster.length;
        
        if (count === 0) {
          return { 
            id: i, 
            count, 
            avgCost: 0, 
            avgMargin: 0, 
            avgQty: 0, 
            description: "Empty",
            pricingStatus: "optimized" as PricingStatus,
            targetMargin: 0,
            targetRevenue: 0,
            currentRevenue: 0,
            revenueDelta: 0,
          };
        }
        
        const avgCost = partsInCluster.reduce((sum, p) => sum + (p["Landed Cost"] || 0), 0) / count;
        const avgMargin = partsInCluster.reduce((sum, p) => sum + (p["Margin %"] || 0), 0) / count;
        const avgQty = partsInCluster.reduce((sum, p) => sum + (p["Net Part Purchase Quantity"] || 0), 0) / count;
        
        const regressionPoints = partsInCluster
          .filter((part) => toSafeNumber(part["Landed Cost"]) > 0)
          .map((part) => ({
            x: Math.log(toSafeNumber(part["Landed Cost"])),
            y: toMarginDecimal(part["Margin %"]),
          }));

        const { slope, intercept } = calculateLinearRegression(regressionPoints);
        const partTargets = partsInCluster.map((part) => calculatePartTargets(part, slope, intercept));

        const targetMargin =
          partTargets.reduce((sum, metrics) => sum + metrics.targetMarginPercent, 0) / count;
        const targetRevenue = partTargets.reduce((sum, metrics) => sum + metrics.targetRevenue, 0);
        const currentRevenue = partTargets.reduce((sum, metrics) => sum + metrics.currentRevenue, 0);
        const revenueDelta = targetRevenue - currentRevenue;
        
        let pricingStatus: PricingStatus;
        if (avgMargin < targetMargin - UNDERPRICED_THRESHOLD) {
          pricingStatus = "underpriced"; // Margin too low → need to increase prices
        } else if (avgMargin > targetMargin + OVERPRICED_THRESHOLD) {
          pricingStatus = "review"; // Margin too high → risk losing to competition
        } else {
          pricingStatus = "optimized"; // Margin is in the ideal range
        }
        
        // Generate description based on averages
        let description = "";
        if (avgCost > 100) description += "High Cost";
        else if (avgCost > 20) description += "Med Cost";
        else description += "Low Cost";
        
        description += " • ";
        
        if (avgMargin > 30) description += "High Margin";
        else if (avgMargin > 15) description += "Med Margin";
        else description += "Low Margin";
        
        description += " • ";
        
        if (avgQty > 100) description += "High Vol";
        else if (avgQty > 10) description += "Med Vol";
        else description += "Low Vol";
        
        return { 
          id: i, 
          count, 
          avgCost, 
          avgMargin, 
          avgQty, 
          description,
          pricingStatus,
          targetMargin,
          targetRevenue,
          currentRevenue,
          revenueDelta,
        };
      })
    : [
        { id: "traffic-builder", count: activeData.filter((d) => d.cluster === "traffic-builder").length },
        { id: "premium", count: activeData.filter((d) => d.cluster === "premium").length },
        { id: "problem", count: activeData.filter((d) => d.cluster === "problem").length },
        { id: "standard", count: activeData.filter((d) => d.cluster === "standard").length },
      ];

  const aiColors = generateAIClusterColors(numClusters);

  const aiClusterIds = useMemo(() => {
    return Array.from({ length: numClusters }, (_, i) => i);
  }, [numClusters]);

  const aiLabelByClusterId = useMemo(() => {
    const labels = new Map<number, string>();
    if (clusterMode === "ai") {
      clusterCounts.forEach((cluster) => {
        const clusterId = Number(cluster.id);
        if (!Number.isNaN(clusterId) && cluster.pricingStatus) {
          labels.set(clusterId, pricingStatusConfig[cluster.pricingStatus].label);
        }
      });
    }
    return labels;
  }, [clusterCounts, clusterMode]);

  const scoreVisibilityRows = useMemo(() => {
    if (clusterMode !== "ai" || !weightedScoringEnabled) {
      return [] as Array<{
        clusterId: number;
        count: number;
        min: number;
        max: number;
        avg: number;
        median: number;
        rangeLabel: string;
        sampleValues: number[];
      }>;
    }

    return aiClusterIds.map((clusterId) => {
      const scores = activeData
        .filter((part) => part["AI_Cluster_ID"] === clusterId)
        .map((part) => toSafeNumber(part["Calculated Score"]))
        .filter((score) => Number.isFinite(score))
        .sort((a, b) => a - b);

      if (scores.length === 0) {
        return {
          clusterId,
          count: 0,
          min: 0,
          max: 0,
          avg: 0,
          median: 0,
          rangeLabel: "—",
          sampleValues: [],
        };
      }

      const min = scores[0];
      const max = scores[scores.length - 1];
      const avg = scores.reduce((sum, value) => sum + value, 0) / scores.length;
      const mid = Math.floor(scores.length / 2);
      const median =
        scores.length % 2 === 0
          ? (scores[mid - 1] + scores[mid]) / 2
          : scores[mid];
      const sampleValues = Array.from(
        new Set(scores.map((value) => Number(value.toFixed(1))))
      ).slice(0, 8);

      return {
        clusterId,
        count: scores.length,
        min,
        max,
        avg,
        median,
        rangeLabel: `${min.toFixed(1)} – ${max.toFixed(1)}`,
        sampleValues,
      };
    });
  }, [activeData, aiClusterIds, clusterMode, weightedScoringEnabled]);

  const selectedPartScoreBreakdown = useMemo(() => {
    if (!selectedPart || clusterMode !== "ai" || !weightedScoringEnabled) {
      return null;
    }
    return buildWeightedScoreBreakdown(selectedPart, weightedScoreMappings);
  }, [selectedPart, clusterMode, weightedScoringEnabled, weightedScoreMappings]);

  // Sample data for chart rendering if dataset is large
  const sampledChartData = useMemo(() => {
    const complexity = getDataRenderComplexity(filteredData.length);
    if (complexity === "high") {
      return sampleDataForChart(filteredData, `chart-${selectedCluster}-${clusterMode}`);
    }
    return filteredData;
  }, [filteredData, selectedCluster, clusterMode]);

  const regressionLineSeries = useMemo(() => {
    if (clusterMode !== "ai") {
      return [] as Array<{ clusterId: number; points: Array<{ "Landed Cost": number; "Margin %": number }> }>;
    }

    const selectedAiCluster = Number(selectedCluster);
    const groups =
      selectedCluster === "all" || Number.isNaN(selectedAiCluster)
        ? [{ clusterId: -1, points: filteredData }]
        : [{ clusterId: selectedAiCluster, points: filteredData.filter((point) => point["AI_Cluster_ID"] === selectedAiCluster) }];

    return groups
      .map((group) => {
        const clusterPoints = group.points;
        if (clusterPoints.length === 0) {
          return null;
        }

        const costs = clusterPoints
          .map((point) => toSafeNumber(point["Landed Cost"]))
          .filter((cost) => cost > 0);

        if (costs.length === 0) {
          return null;
        }

        const regressionPoints = clusterPoints
          .filter((point) => toSafeNumber(point["Landed Cost"]) > 0)
          .map((point) => ({
            x: Math.log(toSafeNumber(point["Landed Cost"])),
            y: toMarginDecimal(point["Margin %"]),
          }));

        const { slope, intercept } = calculateLinearRegression(regressionPoints);
        const minCost = Math.min(...costs);
        const maxCost = Math.max(...costs);

        return {
          clusterId: group.clusterId,
          points: buildRegressionLineData(slope, intercept, minCost, maxCost),
        };
      })
      .filter(
        (
          series
        ): series is { clusterId: number; points: Array<{ "Landed Cost": number; "Margin %": number }> } =>
          Boolean(series)
      );
  }, [clusterMode, filteredData, selectedCluster]);

  const outlierReviewRows = useMemo(() => {
    const grouped = filteredData.reduce((acc, part) => {
      const key = clusterMode === "ai" ? String(part["AI_Cluster_ID"]) : part.cluster;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(part);
      return acc;
    }, {} as Record<string, ClusterData[]>);

    const rows: OutlierReviewRow[] = [];

    Object.entries(grouped).forEach(([clusterKey, parts]) => {
      const regressionPoints = parts
        .filter((part) => toSafeNumber(part["Landed Cost"]) > 0)
        .map((part) => ({
          x: Math.log(toSafeNumber(part["Landed Cost"])),
          y: toMarginDecimal(part["Margin %"]),
        }));

      const { slope, intercept } = calculateLinearRegression(regressionPoints);

      parts.forEach((part) => {
        const targets = calculatePartTargets(part, slope, intercept);
        const actualMarginPercent = toSafeNumber(part["Margin %"]);
        const marginDeviation = actualMarginPercent - targets.targetMarginPercent;

        if (Math.abs(marginDeviation) < outlierDeviationThreshold) {
          return;
        }

        const cost = toSafeNumber(part["Landed Cost"]);
        const actualMargin = toMarginDecimal(part["Margin %"]);
        const currentDenominator = 1 - actualMargin;
        const currentPrice = currentDenominator === 0 ? 0 : cost * (1 / currentDenominator);
        const recommendedPrice = targets.targetPrice;
        const priceDelta = recommendedPrice - currentPrice;
        const priceDeltaPercent = currentPrice === 0 ? 0 : priceDelta / currentPrice;

        rows.push({
          ...part,
          clusterKey,
          targetMarginPercent: targets.targetMarginPercent,
          marginDeviation,
          currentPrice: Number.isFinite(currentPrice) ? currentPrice : 0,
          recommendedPrice,
          priceDelta: Number.isFinite(priceDelta) ? priceDelta : 0,
          priceDeltaPercent: Number.isFinite(priceDeltaPercent) ? priceDeltaPercent : 0,
          recommendation: marginDeviation < 0 ? "increase" : "decrease",
        });
      });
    });

    return rows.sort((a, b) => Math.abs(b.marginDeviation) - Math.abs(a.marginDeviation));
  }, [filteredData, clusterMode, outlierDeviationThreshold]);

  const legacyVsAiRows = useMemo(() => {
    const rowMap = new Map<string, { legacyName: string; counts: Record<number, number>; total: number }>();

    activeData.forEach((part) => {
      const clusterId = Number(part["AI_Cluster_ID"]);
      if (!Number.isInteger(clusterId) || clusterId < 0 || clusterId >= numClusters) {
        return;
      }

      const legacyName = String(part["Legacy Cluster Name"] || "Unclassified").trim() || "Unclassified";
      if (!rowMap.has(legacyName)) {
        const initialCounts: Record<number, number> = {};
        aiClusterIds.forEach((id) => {
          initialCounts[id] = 0;
        });
        rowMap.set(legacyName, {
          legacyName,
          counts: initialCounts,
          total: 0,
        });
      }

      const row = rowMap.get(legacyName)!;
      row.counts[clusterId] += 1;
      row.total += 1;
    });

    return Array.from(rowMap.values()).sort((a, b) => b.total - a.total);
  }, [activeData, aiClusterIds, numClusters]);

  const maxMatrixCellCount = useMemo(() => {
    let max = 0;
    legacyVsAiRows.forEach((row) => {
      aiClusterIds.forEach((clusterId) => {
        max = Math.max(max, row.counts[clusterId] || 0);
      });
    });
    return Math.max(max, 1);
  }, [legacyVsAiRows, aiClusterIds]);

  const getClusterColor = (data: ClusterData): string => {
    if (clusterMode === "ai") {
      return aiColors[data["AI_Cluster_ID"] % aiColors.length];
    }
    return clusterConfig[data.cluster].color;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">AI Clustering & Segmentation</h1>
        <p className="text-muted-foreground">
          Parts automatically grouped by velocity and value metrics
          {excludedParts.size > 0 && (
            <span className="ml-2 text-destructive">
              ({excludedParts.size} excluded)
            </span>
          )}
        </p>
      </div>
      {/* Clustering Controls */}
      <div className="rounded-lg border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Label htmlFor="cluster-mode" className="text-sm font-medium">
              {clusterMode === "ai" ? "AI-Driven" : "Legacy"}
            </Label>
            <Switch
              id="cluster-mode"
              checked={clusterMode === "ai"}
              onCheckedChange={(checked) => {
                setClusterMode(checked ? "ai" : "legacy");
                setSelectedCluster("all");
              }}
            />
            <span className="text-xs text-muted-foreground">
              {clusterMode === "ai" 
                ? (weightedScoringEnabled
                    ? "K-Means on weighted business score"
                    : "K-Means with log-transformed Cost & Qty")
                : "Rule-based clustering"}
            </span>
          </div>
        </div>

        {clusterMode === "ai" && (
          <div className="space-y-4">
            <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Scenario Filters</Label>
                <Badge variant="outline" className="text-xs">
                  {scenarioFilteredData.length} parts
                </Badge>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Warranty &gt; 35%</Label>
                  <Select
                    value={scenarioFilters.warrantyOver35}
                    onValueChange={(value: ScenarioFilters["warrantyOver35"]) =>
                      setScenarioFilters((prev) => ({ ...prev, warrantyOver35: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">OTC Workshop Channel</Label>
                  <Select
                    value={scenarioFilters.otcWorkshopChannel}
                    onValueChange={(value: ScenarioFilters["otcWorkshopChannel"]) =>
                      setScenarioFilters((prev) => ({ ...prev, otcWorkshopChannel: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="OTC">OTC</SelectItem>
                      <SelectItem value="Workshop">Workshop</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Competitive Classification</Label>
                  <Select
                    value={scenarioFilters.competitiveClassification}
                    onValueChange={(value: ScenarioFilters["competitiveClassification"]) =>
                      setScenarioFilters((prev) => ({ ...prev, competitiveClassification: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="Y">Y</SelectItem>
                      <SelectItem value="N">N</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Lifecycle Segment</Label>
                  <Select
                    value={scenarioFilters.lifecycleSegment}
                    onValueChange={(value) =>
                      setScenarioFilters((prev) => ({ ...prev, lifecycleSegment: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {lifecycleSegments.map((segment) => (
                        <SelectItem key={segment} value={segment}>
                          {segment}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="num-clusters" className="text-sm font-medium">
                  Number of Clusters (k)
                </Label>
                <Badge variant="secondary">{numClusters}</Badge>
              </div>
              <Slider
                id="num-clusters"
                min={2}
                max={10}
                step={1}
                value={[numClusters]}
                onValueChange={(value) => setNumClusters(value[0])}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Adjust the number of clusters to find optimal groupings
              </p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex items-center gap-3">
                <Label htmlFor="quality-filter" className="text-sm font-medium">
                  Use Quality Filter
                </Label>
                <Switch
                  id="quality-filter"
                  checked={useQualityFilter}
                  onCheckedChange={setUseQualityFilter}
                />
              </div>
              <span className="text-xs text-muted-foreground">
                {useQualityFilter ? "Clustering on filtered data only" : "Clustering on all data"}
              </span>
            </div>
            {useQualityFilter && (
              <div className="rounded-lg bg-info/10 border border-info/20 p-3 space-y-1">
                <p className="text-xs font-semibold text-info">Quality Filter Criteria:</p>
                <p className="text-xs text-muted-foreground">
                  • Landed Cost &gt; 0 (parts w/o cost excluded)<br />
                  • Net Price ≥ $0.10<br />
                  • Margin ≥ 0%
                </p>
                <p className="text-xs text-info/80 mt-2">
                  Parts not meeting these criteria will have Cluster ID = -1
                </p>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex items-center gap-3">
                <Label htmlFor="weighted-scoring" className="text-sm font-medium">
                  Enable Weighted Scoring Mode
                </Label>
                <Switch
                  id="weighted-scoring"
                  checked={weightedScoringEnabled}
                  onCheckedChange={setWeightedScoringEnabled}
                />
              </div>
              <span className="text-xs text-muted-foreground">
                {weightedScoringEnabled ? "Clustering by fixed business score" : "Clustering by cost/margin/qty"}
              </span>
            </div>

            {weightedScoringEnabled && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground">Score Mapping Variablen</p>

                <div className="rounded-md border bg-background/70 p-3 text-xs text-muted-foreground space-y-1.5">
                  <p className="font-semibold text-foreground">How this affects clustering</p>
                  <p>
                    <strong>Score Mapping Variablen</strong> define the points per attribute value (for example Warranty: Y = 1, N = 5).
                  </p>
                  <p>
                    Clustering uses the business score from the values configured below.
                  </p>
                  <p>
                    Formula: Calculated Score = Σ(Attribute Score).
                  </p>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Attribute</TableHead>
                      <TableHead>Score Mapping Variablen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {WEIGHTED_SCORING_FIELDS.map((field) => {
                      const mappingGroup = weightedScoreMappings[field.key];

                      return (
                        <TableRow key={field.key}>
                          <TableCell className="font-medium">{field.label}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-2">
                              {Object.entries(mappingGroup).map(([optionKey, optionValue]) => (
                                <div key={`${field.key}-${optionKey}`} className="flex items-center gap-1.5">
                                  <span className="text-xs text-muted-foreground min-w-[54px]">{optionKey}</span>
                                  <Input
                                    type="number"
                                    min={0}
                                    step={1}
                                    className="h-8 w-20"
                                    value={optionValue}
                                    onChange={(event) =>
                                      updateScoreMapping(field.key, optionKey, event.target.value)
                                    }
                                  />
                                </div>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
            
            {/* Target Margin Logic Explanation */}
            <div className="rounded-lg bg-purple-500/10 border border-purple-500/20 p-3 space-y-1">
              <p className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                🎯 Target Margin & Revenue Logic
              </p>
              <p className="text-xs text-muted-foreground">
                Each cluster gets a linear regression on ln(Cost) to calculate dynamic targets:
              </p>
              <div className="text-xs text-muted-foreground space-y-0.5 mt-2">
                <p>🔴 <strong>Underpriced:</strong> Margin below target margin → increase prices</p>
                <p>🟢 <strong>Optimized:</strong> Margin matches target margin → competitive</p>
                <p>🟡 <strong>Review:</strong> Margin above target margin → risk of competition</p>
              </div>
              <p className="text-xs text-purple-600/70 dark:text-purple-400/70 mt-2">
                Formula: target margin = m × ln(cost) + c, then target revenue = target price × net qty
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Cluster legend/filter */}
      <div className="flex flex-wrap gap-3">
        <Button
          variant={showOutlierReview ? "default" : "outline"}
          onClick={() => setShowOutlierReview((prev) => !prev)}
        >
          Outlier Review
          <Badge variant="secondary" className="ml-2">
            {outlierReviewRows.length}
          </Badge>
        </Button>
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
            {activeData.length}
          </Badge>
        </button>
        {clusterMode === "ai" ? (
          // AI Cluster buttons
          clusterCounts.map((cluster) => {
            const statusConfig = pricingStatusConfig[cluster.pricingStatus || "optimized"];
            return (
              <button
                key={cluster.id}
                onClick={() => setSelectedCluster(cluster.id)}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-lg border px-4 py-2 text-sm transition-colors",
                  selectedCluster === cluster.id
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:bg-muted"
                )}
                title={`Avg: $${cluster.avgCost?.toFixed(0)} • ${cluster.avgMargin?.toFixed(1)}% • ${Math.round(cluster.avgQty || 0)} units`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: aiColors[cluster.id as number] }}
                  />
                  <span className="font-medium">Cluster {cluster.id}</span>
                  <Badge variant="secondary" className="ml-1">
                    {cluster.count}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">{cluster.description}</span>
                {cluster.pricingStatus && (
                  <div className="flex items-center gap-1 mt-1">
                    <span>{statusConfig.emoji}</span>
                    <span className={cn("text-xs font-semibold", statusConfig.color)}>
                      {statusConfig.label}
                    </span>
                  </div>
                )}
              </button>
            );
          })
        ) : (
          // Legacy cluster buttons
          (Object.keys(clusterConfig) as ClusterData["cluster"][]).map((cluster) => {
            const config = clusterConfig[cluster];
            const count = clusterCounts.find(c => c.id === cluster)?.count || 0;
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
                  {count}
                </Badge>
              </button>
            );
          })
        )}
        {excludedParts.size > 0 && (
          <button
            onClick={() => setExcludedParts(new Set())}
            className="flex items-center gap-2 rounded-lg border border-destructive bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20"
          >
            Include All ({excludedParts.size})
          </button>
        )}
      </div>

      {showOutlierReview && (
        <div className="rounded-xl border bg-card p-6 shadow-card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">Outlier Review</h3>
              <p className="text-sm text-muted-foreground">
                Parts with margin deviation ≥ ±{outlierDeviationThreshold}% from target margin.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="ai-outlier-threshold" className="text-xs text-muted-foreground">
                Threshold %
              </Label>
              <Input
                id="ai-outlier-threshold"
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
                    No outliers found for the current selection.
                  </TableCell>
                </TableRow>
              ) : (
                outlierReviewRows.slice(0, 200).map((part, index) => (
                  <TableRow key={`outlier-${part["Part Number"]}-${index}`}>
                    <TableCell className="font-mono">{part["Part Number"]}</TableCell>
                    <TableCell className="max-w-[320px] truncate">{part["Part Description"]}</TableCell>
                    <TableCell>
                      {clusterMode === "ai"
                        ? `Cluster ${part.clusterKey}`
                        : clusterConfig[part.cluster].label}
                    </TableCell>
                    <TableCell className="text-right font-mono">{toSafeNumber(part["Margin %"]).toFixed(2)}%</TableCell>
                    <TableCell className="text-right font-mono">{part.targetMarginPercent.toFixed(2)}%</TableCell>
                    <TableCell className={cn(
                      "text-right font-mono",
                      part.marginDeviation >= 0 ? "text-warning" : "text-loss"
                    )}>
                      {part.marginDeviation >= 0 ? "+" : ""}{part.marginDeviation.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right font-mono">${part.currentPrice.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono">${part.recommendedPrice.toFixed(2)}</TableCell>
                    <TableCell className={cn(
                      "text-right font-mono",
                      part.priceDelta >= 0 ? "text-profit" : "text-loss"
                    )}>
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
            <p className="text-xs text-muted-foreground mt-3">
              Showing first 200 outliers for performance.
            </p>
          )}
        </div>
      )}

      {/* Chart */}
      <div className="rounded-xl border bg-card p-6 shadow-card">
        <div className="mb-4">
          <h3 className="font-semibold">Part Segmentation Matrix</h3>
          <p className="text-sm text-muted-foreground">
            X-Axis: Landed Cost ($) • Y-Axis: Margin (%)
          </p>
        </div>
        <div className="h-[500px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart margin={{ top: 20, right: 20, bottom: 20, left: 60 }}>
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
                  value: "Margin (%)",
                  angle: -90,
                  position: "insideLeft",
                  fill: "hsl(var(--muted-foreground))",
                  fontSize: 12,
                }}
              />
              <ZAxis
                type="number"
                dataKey="Landed Cost"
                range={[50, 400]}
                name="Landed Cost"
              />
              <Tooltip content={<SimpleTooltip />} />

              {clusterMode === "ai" &&
                regressionLineSeries.map((series) => (
                  <Line
                    key={`line-ai-${series.clusterId}`}
                    type="monotone"
                    data={series.points}
                    dataKey="Margin %"
                    dot={false}
                    stroke={series.clusterId === -1 ? "hsl(var(--primary))" : aiColors[series.clusterId % aiColors.length]}
                    strokeOpacity={0.85}
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                ))}

              <Scatter data={sampledChartData} onClick={handlePointClick}>
                {sampledChartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={getClusterColor(entry)}
                    fillOpacity={0.7}
                    style={{ cursor: "pointer" }}
                  />
                ))}
              </Scatter>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        {clusterMode === "ai" && (
          <p className="text-xs text-muted-foreground mt-3">
            Light lines show the per-cluster regression curve used for target margin: m × ln(cost) + c.
          </p>
        )}
        
        {/* Cluster Legend */}
        <div className="mt-4">
          {clusterMode === "ai" ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground">AI Cluster Statistics:</p>
                {useQualityFilter && (
                  <Badge variant="outline" className="text-xs">
                    Quality Filter: {scenarioFilteredData.filter(d => d["AI_Cluster_ID"] === -1).length} excluded
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                {clusterCounts.map((cluster) => {
                  const statusConfig = pricingStatusConfig[cluster.pricingStatus || "optimized"];
                  return (
                    <div 
                      key={cluster.id} 
                      className="flex items-start gap-2 p-3 rounded-lg border bg-card/50"
                    >
                      <span 
                        className="h-3 w-3 rounded-full mt-0.5 flex-shrink-0" 
                        style={{ backgroundColor: aiColors[cluster.id as number] }} 
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold">Cluster {cluster.id}</p>
                          {cluster.pricingStatus && (
                            <Badge 
                              variant="outline" 
                              className={cn("text-xs", statusConfig.color)}
                            >
                              {statusConfig.emoji} {statusConfig.label}
                            </Badge>
                          )}
                        </div>
                        <p className="text-muted-foreground mt-1">
                          Ø Cost: ${cluster.avgCost?.toFixed(2) || '0.00'}<br />
                          Ø Margin: {cluster.avgMargin?.toFixed(1) || '0.0'}%<br />
                          Ø Qty: {Math.round(cluster.avgQty || 0)} units<br />
                          <span className="text-xs opacity-75">{cluster.description}</span>
                        </p>
                        {cluster.targetMargin !== undefined && (
                          <p className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                            <span className="opacity-75">Target Margin:</span>{" "}
                            <span className="font-semibold">{cluster.targetMargin.toFixed(1)}%</span>
                            <br />
                            <span className="opacity-75">Target Revenue:</span>{" "}
                            <span className="font-semibold">{formatCurrency(cluster.targetRevenue || 0)}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                <strong>Clustering Input:</strong>{" "}
                {weightedScoringEnabled
                  ? "Calculated Weighted Score"
                  : "log(Landed Cost + 1) • Margin % • log(Net Qty + 1)"}
                <br />
                <span className="text-xs opacity-75">
                  {weightedScoringEnabled
                    ? "Score is computed from fixed attribute score mappings"
                    : "Log transformation handles wide value ranges for better clustering"}
                </span>
              </p>
              {weightedScoringEnabled && (
                <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">
                    Clustering Score Visibility (Range & Values by Cluster)
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cluster</TableHead>
                        <TableHead className="text-right">Parts</TableHead>
                        <TableHead className="text-right">Score Range</TableHead>
                        <TableHead className="text-right">Ø / Median</TableHead>
                        <TableHead>Observed Scores</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scoreVisibilityRows.map((row) => (
                        <TableRow key={`score-range-${row.clusterId}`}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: aiColors[row.clusterId] }}
                              />
                              <span className="font-medium">Cluster {row.clusterId}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono">{row.count}</TableCell>
                          <TableCell className="text-right font-mono">{row.rangeLabel}</TableCell>
                          <TableCell className="text-right font-mono">
                            {row.count > 0 ? `${row.avg.toFixed(1)} / ${row.median.toFixed(1)}` : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {row.sampleValues.length > 0 ? row.sampleValues.join(", ") : "No score values"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <p className="text-xs text-muted-foreground mt-2">
                    Analysts can verify which score ranges are captured per cluster and inspect individual score drivers in part details.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="flex items-start gap-2">
                <span className="h-3 w-3 rounded-full mt-0.5" style={{ backgroundColor: clusterConfig["traffic-builder"].color }} />
                <div>
                  <p className="font-semibold text-info">Traffic Builders</p>
                  <p className="text-muted-foreground">Qty ≥1000, Margin &lt;15%</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="h-3 w-3 rounded-full mt-0.5" style={{ backgroundColor: clusterConfig.premium.color }} />
                <div>
                  <p className="font-semibold text-profit">Premium Parts</p>
                  <p className="text-muted-foreground">Margin ≥30%, Qty &gt;500</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="h-3 w-3 rounded-full mt-0.5" style={{ backgroundColor: clusterConfig.problem.color }} />
                <div>
                  <p className="font-semibold text-loss">Problem Parts</p>
                  <p className="text-muted-foreground">High returns or low performance</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="h-3 w-3 rounded-full mt-0.5" style={{ backgroundColor: clusterConfig.standard.color }} />
                <div>
                  <p className="font-semibold">Standard Parts</p>
                  <p className="text-muted-foreground">Average performance</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Legacy vs AI Comparison */}
      <div className="rounded-xl border bg-card p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">Legacy vs. AI Comparison</h3>
            <p className="text-sm text-muted-foreground">
              Cross-tab matrix: Legacy Cluster Name (rows) × AI Cluster ID (columns)
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            {legacyVsAiRows.length} legacy clusters
          </Badge>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[220px]">Legacy Cluster Name</TableHead>
              {aiClusterIds.map((clusterId) => (
                <TableHead key={clusterId} className="text-center min-w-[120px]">
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex items-center gap-1">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: aiColors[clusterId] }}
                      />
                      <span>Cluster {clusterId}</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {aiLabelByClusterId.get(clusterId) || "No Label"}
                    </span>
                  </div>
                </TableHead>
              ))}
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {legacyVsAiRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={numClusters + 2} className="text-center text-muted-foreground">
                  No data available for comparison in the current scenario.
                </TableCell>
              </TableRow>
            ) : (
              legacyVsAiRows.map((row) => (
                <TableRow key={row.legacyName}>
                  <TableCell className="font-medium">{row.legacyName}</TableCell>
                  {aiClusterIds.map((clusterId) => {
                    const count = row.counts[clusterId] || 0;
                    const intensity = count === 0 ? 0 : 0.08 + (count / maxMatrixCellCount) * 0.28;

                    return (
                      <TableCell
                        key={`${row.legacyName}-${clusterId}`}
                        className="text-center font-mono"
                        style={{
                          backgroundColor: count > 0 ? `hsl(var(--primary) / ${intensity})` : "transparent",
                        }}
                      >
                        {count}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right font-mono font-semibold">{row.total}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Part Details Dialog */}
      <Dialog open={selectedPart !== null} onOpenChange={(open) => !open && setSelectedPart(null)}>
        <DialogContent className="max-w-md">
          {selectedPart && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span className="font-mono">{selectedPart["Part Number"]}</span>
                  {clusterMode === "ai" ? (
                    <Badge variant="outline" className="text-xs">
                      Cluster {selectedPart["AI_Cluster_ID"]}
                    </Badge>
                  ) : (
                    <Badge className={cn(
                      clusterConfig[selectedPart.cluster].bgColor,
                      clusterConfig[selectedPart.cluster].textColor,
                      "text-xs"
                    )}>
                      {clusterConfig[selectedPart.cluster].label}
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription>
                  {selectedPart["Part Description"]}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-3 mt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Sales Velocity:</span>
                  <span className="font-mono font-medium">
                    {selectedPart["Customer Pay Part Purchase Qty"].toLocaleString()} units
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Net Quantity:</span>
                  <span className="font-mono font-medium">
                    {(selectedPart["Net Part Purchase Quantity"] || 0).toLocaleString()} units
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Landed Cost:</span>
                  <span className="font-mono font-medium">
                    {formatCurrency(selectedPart["Landed Cost"])}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Margin:</span>
                  <span className={cn(
                    "font-mono font-medium",
                    clusterMode === "ai" 
                      ? (selectedPart["Margin %"] > 30 ? "text-profit" : selectedPart["Margin %"] < 10 ? "text-loss" : "")
                      : clusterConfig[selectedPart.cluster].textColor
                  )}>
                    {selectedPart["Margin %"].toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Returns:</span>
                  <span className="font-mono font-medium text-loss">
                    {formatCurrency(selectedPart["Part Returns Amount"])}
                  </span>
                </div>
                {clusterMode === "ai" && (
                  <div className="flex justify-between text-sm pt-2 border-t">
                    <span className="text-muted-foreground">AI Cluster ID:</span>
                    <span className="font-mono font-medium">
                      {selectedPart["AI_Cluster_ID"]}
                    </span>
                  </div>
                )}
                {clusterMode === "ai" && weightedScoringEnabled && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Calculated Score:</span>
                    <span className="font-mono font-medium">
                      {(selectedPart["Calculated Score"] || 0).toFixed(1)}
                    </span>
                  </div>
                )}
                {clusterMode === "ai" && weightedScoringEnabled && selectedPartScoreBreakdown && (
                  <div className="pt-2 border-t space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Score Driver Breakdown:</span>
                      <span className="font-mono font-semibold">
                        Σ {(selectedPartScoreBreakdown.total || 0).toFixed(1)}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {selectedPartScoreBreakdown.items.map((item) => (
                        <div key={item.key} className="rounded-md border bg-muted/20 px-2 py-1.5 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{item.label}</span>
                            <span className="font-mono">{item.weightedContribution.toFixed(1)}</span>
                          </div>
                          <p className="text-muted-foreground mt-0.5">
                            Value: {item.valueLabel} • Mapping: {item.mappingScore} • Weight: {item.weight}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-6">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setSelectedPart(null)}
                >
                  Close
                </Button>
                <Button
                  variant={excludedParts.has(selectedPart["Part Number"]) ? "default" : "destructive"}
                  className="flex-1"
                  onClick={() => handleToggleExclude(selectedPart["Part Number"])}
                >
                  {excludedParts.has(selectedPart["Part Number"]) ? "Include" : "Exclude"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Cluster insights */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {(Object.keys(clusterConfig) as ClusterData["cluster"][]).map((cluster) => {
          const config = clusterConfig[cluster];
          const parts = activeData.filter((d) => d.cluster === cluster);
          
          // Calculate average margin (handle null/undefined values)
          const avgMargin = parts.length > 0
            ? parts.reduce((sum, p) => sum + (Number(p["Margin %"]) || 0), 0) / parts.length
            : 0;
          
          // Calculate total revenue (sum of Customer Pay Purchases Amount)
          const totalRevenue = parts.reduce(
            (sum, p) => sum + (Number(p["Customer Pay Purchases Amount"]) || 0),
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
