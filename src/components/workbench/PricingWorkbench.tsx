import { useState, useMemo, useEffect, useDeferredValue, useCallback, memo } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, ExternalLink, AlertCircle, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { PartData } from "@/data/mockData";
import { dataStore } from "@/data/dataStore";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PartDetailModal } from "./PartDetailModal";
import { DataUploadManager } from "./DataUploadManager";

const formatCurrency = (value: number | null) => {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
};

type SortField = keyof PartData | null;
type SortDirection = "asc" | "desc";

interface PricingWorkbenchProps {
  searchQuery: string;
}

const INITIAL_VISIBLE_ROWS = 250;
const ROW_BATCH_SIZE = 250;
const DEFER_THRESHOLD = 1000; // Defer expensive ops if dataset > 1000 rows

export function PricingWorkbench({ searchQuery }: PricingWorkbenchProps) {
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [franchiseFilter, setFranchiseFilter] = useState<string>("all");
  const [marginFilter, setMarginFilter] = useState<string>("all");
  const [clusteringFilter, setClusteringFilter] = useState<boolean>(false);
  const [selectedPart, setSelectedPart] = useState<PartData | null>(null);
  const [editingCell, setEditingCell] = useState<{ partNumber: string; field: string } | null>(null);
  const [localData, setLocalData] = useState<PartData[]>([]);
  const [visibleRows, setVisibleRows] = useState<number>(INITIAL_VISIBLE_ROWS);
  
  // Defer expensive filter/sort ops when dataset is large
  const deferredFilters = useDeferredValue({ franchiseFilter, marginFilter, clusteringFilter, sortField, sortDirection });

  // Subscribe to data store changes
  useEffect(() => {
    const updateData = () => {
      const data = dataStore.getCombinedData();
      setLocalData(data);
    };

    updateData(); // Initial load
    const unsubscribe = dataStore.subscribe(updateData);
    return unsubscribe;
  }, []);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const filteredAndSortedData = useMemo(() => {
    let data = [...localData];
    const isLargeDataset = localData.length > DEFER_THRESHOLD;

    // Search filter (always immediate for responsiveness)
    if (deferredSearchQuery) {
      const query = deferredSearchQuery.toLowerCase();
      data = data.filter(
        (part) =>
          part["Part Number"].toLowerCase().includes(query) ||
          part["Part Description"].toLowerCase().includes(query)
      );
    }

    // Use deferred filters for large datasets
    const { franchiseFilter: fFilter, marginFilter: mFilter, clusteringFilter: cFilter, sortField: sField, sortDirection: sDir } = 
      isLargeDataset ? deferredFilters : { franchiseFilter, marginFilter, clusteringFilter, sortField, sortDirection };

    // Franchise filter
    if (fFilter !== "all") {
      data = data.filter((part) => part.Franchise === fFilter);
    }

    // Margin filter
    if (mFilter !== "all") {
      switch (mFilter) {
        case "low":
          data = data.filter((part) => part["Margin %"] < 10);
          break;
        case "medium":
          data = data.filter((part) => part["Margin %"] >= 10 && part["Margin %"] < 20);
          break;
        case "good":
          data = data.filter((part) => part["Margin %"] >= 20 && part["Margin %"] < 30);
          break;
        case "excellent":
          data = data.filter((part) => part["Margin %"] >= 30);
          break;
      }
    }

    // Data for Clustering filter - exclude poor quality data
    if (cFilter) {
      data = data.filter((part) => {
        const landedCost = part["Landed Cost"] || 0;
        const netPrice = part["Net Price New"] || 0;
        const margin = part["Margin %"] || 0;
        return landedCost > 0 && netPrice >= 0.10 && margin >= 0;
      });
    }

    // Sort
    if (sField) {
      data.sort((a, b) => {
        const aVal = a[sField];
        const bVal = b[sField];
        
        if (aVal === null) return 1;
        if (bVal === null) return -1;
        
        if (typeof aVal === "number" && typeof bVal === "number") {
          return sDir === "asc" ? aVal - bVal : bVal - aVal;
        }
        
        const aStr = String(aVal);
        const bStr = String(bVal);
        return sDir === "asc"
          ? aStr.localeCompare(bStr)
          : bStr.localeCompare(aStr);
      });
    }

    return data;
  }, [localData, deferredSearchQuery, deferredFilters, franchiseFilter, marginFilter, clusteringFilter, sortField, sortDirection]);

  useEffect(() => {
    setVisibleRows(INITIAL_VISIBLE_ROWS);
  }, [deferredSearchQuery, franchiseFilter, marginFilter, clusteringFilter, sortField, sortDirection, localData.length]);

  const visibleData = useMemo(() => {
    return filteredAndSortedData.slice(0, visibleRows);
  }, [filteredAndSortedData, visibleRows]);

  const getMarginColor = (margin: number) => {
    if (margin < 10) return "text-loss bg-loss-muted";
    if (margin < 20) return "text-warning bg-warning-muted";
    return "text-profit bg-profit-muted";
  };

  const isOpportunity = (part: PartData) => {
    return part["Margin %"] < 15 && part["Customer Pay Part Purchase Qty"] > 1000;
  };

  const handleLandedCostChange = useCallback((partNumber: string, newValue: string) => {
    const numValue = parseFloat(newValue);
    if (!isNaN(numValue)) {
      setLocalData(prev => {
        const idx = prev.findIndex(p => p["Part Number"] === partNumber);
        if (idx === -1) return prev;
        
        const updated = [...prev];
        const part = updated[idx];
        const newMargin = ((part["Net Price New"] - numValue) / part["Net Price New"]) * 100;
        updated[idx] = {
          ...part,
          "Landed Cost": numValue,
          "Margin %": Math.round(newMargin * 100) / 100,
        };
        return updated;
      });
    }
    setEditingCell(null);
  }, []);

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 hover:text-foreground transition-colors"
    >
      {children}
      {sortField === field ? (
        sortDirection === "asc" ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-50" />
      )}
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Data Upload Section */}
      <DataUploadManager />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pricing Workbench</h1>
          <p className="text-muted-foreground">
            {filteredAndSortedData.length.toLocaleString()} parts
            {clusteringFilter && localData.length > 0 && (
              <span className="ml-2 text-info">
                (Clustering filter: {localData.length - filteredAndSortedData.length} excluded)
              </span>
            )}
            {" • Click any row to view dealer details"}
            {filteredAndSortedData.length > visibleData.length && (
              <span className="ml-2 text-muted-foreground">
                (showing first {visibleData.length.toLocaleString()})
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Franchise:</span>
          <Select value={franchiseFilter} onValueChange={setFranchiseFilter}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="MB">MB</SelectItem>
              <SelectItem value="BMW">BMW</SelectItem>
              <SelectItem value="AUDI">Audi</SelectItem>
              <SelectItem value="VW">VW</SelectItem>
              <SelectItem value="PORSCHE">Porsche</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Margin:</span>
          <Select value={marginFilter} onValueChange={setMarginFilter}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Margins</SelectItem>
              <SelectItem value="low">Low (&lt;10%)</SelectItem>
              <SelectItem value="medium">Medium (10-20%)</SelectItem>
              <SelectItem value="good">Good (20-30%)</SelectItem>
              <SelectItem value="excellent">Excellent (&gt;30%)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          variant={clusteringFilter ? "default" : "outline"}
          size="sm"
          onClick={() => setClusteringFilter(!clusteringFilter)}
          className="gap-2"
          title="Exclude: Landed Cost ≤ 0 • Net Price < $0.10 • Margin < 0%"
        >
          <Filter className="h-4 w-4" />
          Data for Clustering
          {clusteringFilter && (
            <Badge variant="secondary" className="ml-1">
              ON
            </Badge>
          )}
        </Button>

        <div className="ml-auto flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5">
            <span className="h-2 w-2 rounded-full bg-loss" />
            &lt;10%
          </Badge>
          <Badge variant="outline" className="gap-1.5">
            <span className="h-2 w-2 rounded-full bg-warning" />
            10-20%
          </Badge>
          <Badge variant="outline" className="gap-1.5">
            <span className="h-2 w-2 rounded-full bg-profit" />
            &gt;30%
          </Badge>
        </div>
      </div>

      {/* Data table */}
      <div className="rounded-xl border bg-card shadow-card overflow-hidden">
        <div className="overflow-auto scrollbar-thin max-h-[600px]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b bg-table-header">
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground bg-table-header">
                  <SortHeader field="Part Number">Part Number</SortHeader>
                </th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground min-w-[200px] bg-table-header">
                  <SortHeader field="Part Description">Description</SortHeader>
                </th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground bg-table-header">
                  <SortHeader field="Franchise">Franchise</SortHeader>
                </th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground bg-table-header">
                  <SortHeader field="Legacy_Cluster">Legacy Cluster</SortHeader>
                </th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground bg-table-header">
                  <SortHeader field="Legacy Cluster Name">Cluster Name</SortHeader>
                </th>
                <th className="px-4 py-3 text-center font-semibold text-muted-foreground bg-table-header">
                  <SortHeader field="Warranty > 35%">Warranty 35%+</SortHeader>
                </th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground bg-table-header">
                  <SortHeader field="OTC Workshop Channel">Channel</SortHeader>
                </th>
                <th className="px-4 py-3 text-center font-semibold text-muted-foreground bg-table-header">
                  <SortHeader field="Competitive Classification">Comp.</SortHeader>
                </th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground bg-table-header">
                  <SortHeader field="Lifecycle Segment">Lifecycle</SortHeader>
                </th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground bg-table-header">
                  <SortHeader field="Account Assignment Code">Account Assignment</SortHeader>
                </th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground bg-table-header">
                  <SortHeader field="Vendor">Vendor</SortHeader>
                </th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground bg-table-header">
                  <SortHeader field="Landed Cost">Landed Cost</SortHeader>
                </th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground bg-table-header">
                  <SortHeader field="Net Price New">Net Price</SortHeader>
                </th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground bg-table-header">
                  <SortHeader field="Margin %">Margin %</SortHeader>
                </th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground bg-table-header">
                  <SortHeader field="Customer Pay Part Purchase Qty">Customer Pay Qty</SortHeader>
                </th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground bg-table-header">
                  <SortHeader field="Net Part Purchase Quantity">Net Qty</SortHeader>
                </th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground bg-table-header">
                  <SortHeader field="Customer Pay Purchases Amount">Customer Pay Amount</SortHeader>
                </th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground bg-table-header">
                  <SortHeader field="Part Returns Amount">Returns Amount</SortHeader>
                </th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground bg-table-header">
                  <SortHeader field="ACP/Online Price">ACP/Online</SortHeader>
                </th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground bg-table-header">
                  Predecessor
                </th>
                <th className="px-4 py-3 text-center font-semibold text-muted-foreground bg-table-header">
                  Flag
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleData.map((part, index) => (
                <tr
                  key={part["Part Number"] || `part-${index}`}
                  onClick={() => setSelectedPart(part)}
                  className={cn(
                    "border-b cursor-pointer transition-colors hover:bg-table-hover",
                    index % 2 === 0 ? "bg-card" : "bg-muted/30"
                  )}
                >
                  <td className="px-4 py-3 font-mono text-sm font-medium">
                    {part["Part Number"]}
                  </td>
                  <td className="px-4 py-3 max-w-[200px] truncate" title={part["Part Description"]}>
                    {part["Part Description"]}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary" className="font-mono">
                      {part.Franchise}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="font-mono text-xs">
                      {part["Legacy_Cluster"]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {part["Legacy Cluster Name"] || "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {part["Warranty > 35%"] ? (
                      <Badge variant="default" className="bg-profit/20 text-profit border-profit/30">✓</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {part["OTC Workshop Channel"] || "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant="secondary" className="text-xs">
                      {part["Competitive Classification"] || "—"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {part["Lifecycle Segment"] || "—"}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono">
                    {part["Account Assignment Code"] || "—"}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {part.Vendor}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editingCell?.partNumber === part["Part Number"] && editingCell?.field === "Landed Cost" ? (
                      <Input
                        type="number"
                        defaultValue={part["Landed Cost"]}
                        className="w-24 h-7 text-right font-mono"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        onBlur={(e) => handleLandedCostChange(part["Part Number"], e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleLandedCostChange(part["Part Number"], (e.target as HTMLInputElement).value);
                          }
                          if (e.key === "Escape") {
                            setEditingCell(null);
                          }
                        }}
                      />
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingCell({ partNumber: part["Part Number"], field: "Landed Cost" });
                        }}
                        className="font-mono hover:bg-muted px-2 py-0.5 rounded transition-colors"
                      >
                        {formatCurrency(part["Landed Cost"])}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatCurrency(part["Net Price New"])}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold font-mono",
                        getMarginColor(part["Margin %"])
                      )}
                    >
                      {part["Margin %"].toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {part["Customer Pay Part Purchase Qty"].toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {part["Net Part Purchase Quantity"].toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatCurrency(part["Customer Pay Purchases Amount"])}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    <span className="text-loss">
                      {formatCurrency(part["Part Returns Amount"])}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {part["ACP/Online Price"] ? (
                      <span className={cn(
                        part["ACP/Online Price"] < part["Net Price New"] ? "text-profit" : "text-loss"
                      )}>
                        {formatCurrency(part["ACP/Online Price"])}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {part.Predecessor ? (
                      <div className="flex items-center gap-1 text-info">
                        <span className="font-mono text-xs">{part.Predecessor}</span>
                        <ExternalLink className="h-3 w-3" />
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isOpportunity(part) && (
                      <div className="flex justify-center" title="High volume, low margin opportunity">
                        <AlertCircle className="h-4 w-4 text-warning" />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {visibleData.length < filteredAndSortedData.length && (
          <div className="border-t bg-card px-4 py-3 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Showing {visibleData.length.toLocaleString()} of {filteredAndSortedData.length.toLocaleString()} rows
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setVisibleRows((prev) => prev + ROW_BATCH_SIZE)}
            >
              Load {Math.min(ROW_BATCH_SIZE, filteredAndSortedData.length - visibleData.length)} more
            </Button>
          </div>
        )}
      </div>

      {/* Part detail modal */}
      <PartDetailModal
        part={selectedPart}
        isOpen={!!selectedPart}
        onClose={() => setSelectedPart(null)}
      />
    </div>
  );
}
