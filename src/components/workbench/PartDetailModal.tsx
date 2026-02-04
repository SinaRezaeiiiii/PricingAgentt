import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PartData } from "@/data/mockData";
import { Building2, TrendingUp, Package, DollarSign, RotateCcw } from "lucide-react";

const formatCurrency = (value: number | null) => {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
};

interface PartDetailModalProps {
  part: PartData | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PartDetailModal({ part, isOpen, onClose }: PartDetailModalProps) {
  if (!part) return null;

  const getMarginColorClass = (margin: number) => {
    if (margin < 10) return "text-loss";
    if (margin < 20) return "text-warning";
    return "text-profit";
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="font-mono text-lg">{part["Part Number"]}</span>
            <Badge variant="secondary">{part.Franchise}</Badge>
          </DialogTitle>
          <p className="text-muted-foreground">{part["Part Description"]}</p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Pricing section */}
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Pricing Information
            </h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground mb-1">Landed Cost</p>
                <p className="font-mono font-semibold">{formatCurrency(part["Landed Cost"])}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground mb-1">Net Price New</p>
                <p className="font-mono font-semibold">{formatCurrency(part["Net Price New"])}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground mb-1">Margin %</p>
                <p className={`font-mono font-semibold ${getMarginColorClass(part["Margin %"])}`}>
                  {part["Margin %"].toFixed(1)}%
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground mb-1">List Price</p>
                <p className="font-mono font-semibold">{formatCurrency(part["List Price"])}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground mb-1">ACP/Online Price</p>
                <p className="font-mono font-semibold">{formatCurrency(part["ACP/Online Price"])}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground mb-1">Core Price</p>
                <p className="font-mono font-semibold">{formatCurrency(part["Core Price"])}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Sales metrics */}
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Sales Metrics
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground mb-1">Customer Pay Qty</p>
                <p className="font-mono font-semibold">
                  {part["Customer Pay Part Purchase Qty"].toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground mb-1">Net Purchase Qty</p>
                <p className="font-mono font-semibold">
                  {part["Net Part Purchase Quantity"].toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground mb-1">Customer Pay Amount</p>
                <p className="font-mono font-semibold text-profit">
                  {formatCurrency(part["Customer Pay Purchases Amount"])}
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground mb-1">Manufacturer Pay Amount</p>
                <p className="font-mono font-semibold">
                  {formatCurrency(part["Manufacturer Pay Purchases Amount"])}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Returns */}
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
              <RotateCcw className="h-4 w-4" />
              Returns
            </h4>
            <div className="rounded-lg bg-loss-muted p-3">
              <p className="text-xs text-muted-foreground mb-1">Part Returns Amount</p>
              <p className="font-mono font-semibold text-loss">
                {formatCurrency(part["Part Returns Amount"])}
              </p>
            </div>
          </div>

          <Separator />

          {/* Dealer list */}
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Dealers Purchasing This Part
            </h4>
            <div className="space-y-2">
              {part["Dealer Identifiers"].map((dealer, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-lg border bg-card p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <span className="font-medium">{dealer}</span>
                  </div>
                  <Badge variant="outline">Active</Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Master data */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div>
              <span className="font-medium">Vendor:</span> {part.Vendor}
            </div>
            {part.Predecessor && (
              <div>
                <span className="font-medium">Predecessor:</span>{" "}
                <span className="font-mono">{part.Predecessor}</span>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
