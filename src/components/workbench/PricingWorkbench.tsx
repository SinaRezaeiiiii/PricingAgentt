import { useState, useMemo } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, ExternalLink, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { partsData, PartData } from "@/data/mockData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PartDetailModal } from "./PartDetailModal";

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

export function PricingWorkbench({ searchQuery }: PricingWorkbenchProps) {
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [franchiseFilter, setFranchiseFilter] = useState<string>("all");
  const [marginFilter, setMarginFilter] = useState<string>("all");
  const [selectedPart, setSelectedPart] = useState<PartData | null>(null);
  const [editingCell, setEditingCell] = useState<{ partNumber: string; field: string } | null>(null);
  const [localData, setLocalData] = useState(partsData);

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

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      data = data.filter(
        (part) =>
          part["Part Number"].toLowerCase().includes(query) ||
          part["Part Description"].toLowerCase().includes(query)
      );
    }

    // Franchise filter
    if (franchiseFilter !== "all") {
      data = data.filter((part) => part.Franchise === franchiseFilter);
    }

    // Margin filter
    if (marginFilter !== "all") {
      switch (marginFilter) {
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

    // Sort
    if (sortField) {
      data.sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        
        if (aVal === null) return 1;
        if (bVal === null) return -1;
        
        if (typeof aVal === "number" && typeof bVal === "number") {
          return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
        }
        
        const aStr = String(aVal);
        const bStr = String(bVal);
        return sortDirection === "asc"
          ? aStr.localeCompare(bStr)
          : bStr.localeCompare(aStr);
      });
    }

    return data;
  }, [localData, searchQuery, franchiseFilter, marginFilter, sortField, sortDirection]);

  const getMarginColor = (margin: number) => {
    if (margin < 10) return "text-loss bg-loss-muted";
    if (margin < 20) return "text-warning bg-warning-muted";
    return "text-profit bg-profit-muted";
  };

  const isOpportunity = (part: PartData) => {
    return part["Margin %"] < 15 && part["Customer Pay Part Purchase Qty"] > 1000;
  };

  const handleLandedCostChange = (partNumber: string, newValue: string) => {
    const numValue = parseFloat(newValue);
    if (!isNaN(numValue)) {
      setLocalData(prev => prev.map(part => {
        if (part["Part Number"] === partNumber) {
          const newMargin = ((part["Net Price New"] - numValue) / part["Net Price New"]) * 100;
          return {
            ...part,
            "Landed Cost": numValue,
            "Margin %": Math.round(newMargin * 100) / 100,
          };
        }
        return part;
      }));
    }
    setEditingCell(null);
  };

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pricing Workbench</h1>
          <p className="text-muted-foreground">
            {filteredAndSortedData.length.toLocaleString()} parts • Click any row to view dealer details
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
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-table-header">
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                  <SortHeader field="Part Number">Part Number</SortHeader>
                </th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground min-w-[200px]">
                  <SortHeader field="Part Description">Description</SortHeader>
                </th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                  <SortHeader field="Franchise">Franchise</SortHeader>
                </th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">
                  <SortHeader field="Landed Cost">Landed Cost</SortHeader>
                </th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">
                  <SortHeader field="Net Price New">Net Price</SortHeader>
                </th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">
                  <SortHeader field="Margin %">Margin %</SortHeader>
                </th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">
                  <SortHeader field="Customer Pay Part Purchase Qty">Sales Qty</SortHeader>
                </th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">
                  <SortHeader field="ACP/Online Price">ACP/Online</SortHeader>
                </th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                  Predecessor
                </th>
                <th className="px-4 py-3 text-center font-semibold text-muted-foreground">
                  Flag
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedData.map((part, index) => (
                <tr
                  key={part["Part Number"]}
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
