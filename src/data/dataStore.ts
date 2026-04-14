// Central data store for uploaded Excel data
import { PartData } from "./mockData";
import { kMeans, prepareClusteringData } from "@/lib/kmeans";

export interface ScenarioFilters {
  warrantyOver35: "all" | "yes" | "no";
  otcWorkshopChannel: "all" | "OTC" | "Workshop";
  competitiveClassification: "all" | "Y" | "N";
  lifecycleSegment: "all" | string;
}

export interface TransactionData {
  "Part Identifier": string;
  "Reporting Date": string;
  "Part Customer Identifier": string;
  "Customer Pay Part Purchase Qty": number;
  "Customer Pay Purchases Amount": number;
  "Company Dimension Key": string;
  "Gross Part Purchases Amount": number;
  "Part Returns Amount": number;
  "Net Part Purchase Amount": number;
  "Manufacturer Pay Purchases Amount": number;
  "Gross Part Purchase Billing Docs Qty": number;
  "Part Return Quantity": number;
  "Net Part Purchase Quantity": number;
  "Gross Part Purchase Coreless Qty": number;
  "Part Return Coreless Quantity": number;
  "Net Part Purchase Coreless Qty": number;
  "Manufact Pay Part Purch Coreless Qty": number;
  "Customer Pay Part Purch Coreless Qty": number;
  "Datawarehouse Create Timestamp": string;
  "DataWarehouse Update Timestamp": string;
}

export interface PartMasterData {
  "Part Number": string;
  "Topmost": string;
  "Topmost Part Indicator": string;
  "Transactions Current Volume": number;
  "Part Name": string;
  "Part Category Description": string;
  "Marketing Code": string;
  "Marketing Code Description": string;
  "Life Cycle Segment": string;
  "Lifecycle Segment"?: string;
  "Account Assignment Code": string;
  "Landed Cost": number;
  "Net Price New": number;
  "Warranty Percent": number;
  "Workshop Percent": number;
  "OTC Percent": number;
  "PPM Percent": number;
  "Model": string;
  "Chain Position": string;
  "Parent Part": string;
  "Median AM Competitor ACP Online Price": number | null;
  "Average OTC Price": number;
  "Average Workshop Price": number;
  "Competitive Flag": string;
  "Price Active": string;
  "S Part Category": string;
  "S Competitive Classification": string;
  "Material Type": string;
  "Transactions Current Revenue": number;
  "Transactions Current Margin": number;
  "Domestic": string;
  "Vendor": string;
  "Vendor Type": string;
  "OTC Workshop Channel": string;
  "Division": string;
  "Margin": number;
  "Q3 AM Competitor ACP Online Price": number | null;
  "Marketing Code Sub Division": string;
  "Creation Date": string;
  "Identifier": string;
}

export interface MonthlyRevenuePoint {
  month: string;
  "Customer Pay Purchases Amount": number;
  "Manufacturer Pay Purchases Amount": number;
}

export interface WeightedScoreWeights {
  otcWorkshopChannel: number;
  competitiveFlag: number;
  lifecycleSegment: number;
  accountAssignmentCode: number;
  warrantyOver35: number;
}

export interface WeightedScoreMappings {
  otcWorkshopChannel: {
    otc: number;
    other: number;
  };
  competitiveFlag: {
    y: number;
    n: number;
  };
  lifecycleSegment: {
    segment1: number;
    segment2: number;
    segment3: number;
    segment4: number;
    other: number;
  };
  accountAssignmentCode: {
    code01: number;
    code03: number;
    code04: number;
    other: number;
  };
  warrantyOver35: {
    yes: number;
    no: number;
  };
}

export interface WeightedScoringConfig {
  enabled: boolean;
  weights: WeightedScoreWeights;
  mappings?: WeightedScoreMappings;
}

export const DEFAULT_WEIGHTED_SCORE_WEIGHTS: WeightedScoreWeights = {
  otcWorkshopChannel: 1,
  competitiveFlag: 1,
  lifecycleSegment: 1,
  accountAssignmentCode: 1,
  warrantyOver35: 1,
};

export const DEFAULT_WEIGHTED_SCORE_MAPPINGS: WeightedScoreMappings = {
  otcWorkshopChannel: {
    otc: 2,
    other: 1,
  },
  competitiveFlag: {
    y: 2,
    n: 1,
  },
  lifecycleSegment: {
    segment1: 4,
    segment2: 3,
    segment3: 2,
    segment4: 1,
    other: 1,
  },
  accountAssignmentCode: {
    code01: 2,
    code03: 1,
    code04: 3,
    other: 1,
  },
  warrantyOver35: {
    yes: 1,
    no: 5,
  },
};

/**
 * Central data store for managing part master data and transaction data.
 * 
 * Performance Characteristics:
 * - Optimized for datasets up to 550,000 parts
 * - Uses Map-based joins for O(n) time complexity
 * - Throttled state updates prevent excessive UI re-renders
 * - Memory-efficient data structures
 * - Auto-clustering disabled for datasets > 50k parts
 * 
 * Extracted Columns (from Part Master Data):
 * - Warranty > 35%: Parsed from "Warranty Percent" (boolean)
 * - OTC Workshop Channel: From "OTC Workshop Channel" (string)
 * - Competitive Classification: From "S Competitive Classification" (string, e.g., Y/N)
 * - Lifecycle Segment: From "Life Cycle Segment" (string/number)
 * - Legacy Cluster Name: Human-readable format (e.g., "OTC High Y")
 * 
 * Join Logic:
 * - Configurable join columns via setJoinColumns()
 * - Default: Transaction["Part Identifier"] = Master["Part Number"]
 * - Aggregates multiple transactions per part
 */
class DataStore {
  private transactionData: TransactionData[] = [];
  private partMasterData: PartMasterData[] = [];
  private combinedData: PartData[] = [];
  private listeners: (() => void)[] = [];
  private transactionJoinColumn: string = "Part Identifier";
  private masterJoinColumn: string = "Part Number";
  private notifyTimeout: NodeJS.Timeout | null = null;

  setJoinColumns(transactionCol: string, masterCol: string) {
    this.transactionJoinColumn = transactionCol;
    this.masterJoinColumn = masterCol;
    console.log(`🔗 Join columns set: Transaction[${transactionCol}] = Master[${masterCol}]`);
  }

  private normalizeHeaderName(header: string): string {
    return String(header || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  private parseReportingDate(value: unknown): Date | null {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      const excelEpoch = Date.UTC(1899, 11, 30);
      const millisPerDay = 24 * 60 * 60 * 1000;
      const asDate = new Date(excelEpoch + Math.trunc(value) * millisPerDay);
      return Number.isNaN(asDate.getTime()) ? null : asDate;
    }

    const raw = String(value || "").trim();
    if (!raw) {
      return null;
    }

    const directParse = new Date(raw);
    if (!Number.isNaN(directParse.getTime())) {
      return directParse;
    }

    const localizedMatch = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
    if (localizedMatch) {
      const day = Number(localizedMatch[1]);
      const month = Number(localizedMatch[2]);
      const yearRaw = Number(localizedMatch[3]);
      const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
      const localizedDate = new Date(year, month - 1, day);
      if (!Number.isNaN(localizedDate.getTime())) {
        return localizedDate;
      }
    }

    return null;
  }

  private getFieldValueByAliases(
    row: Record<string, any>,
    aliases: string[]
  ): string {
    for (const alias of aliases) {
      const directValue = row[alias];
      if (directValue !== undefined && directValue !== null && String(directValue).trim() !== "") {
        return String(directValue).trim();
      }
    }

    const normalizedAliases = new Set(aliases.map((alias) => this.normalizeHeaderName(alias)));
    for (const [key, value] of Object.entries(row)) {
      if (!normalizedAliases.has(this.normalizeHeaderName(key))) {
        continue;
      }
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        return String(value).trim();
      }
    }

    return "";
  }

  private applyScenarioFilters(data: PartData[], filters?: ScenarioFilters): PartData[] {
    if (!filters) {
      return data;
    }

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
  }

  private getLifecycleScore(value: unknown, mappings: WeightedScoreMappings): number {
    const normalized = String(value || "").trim();
    if (normalized.includes("1")) return mappings.lifecycleSegment.segment1;
    if (normalized.includes("2")) return mappings.lifecycleSegment.segment2;
    if (normalized.includes("3")) return mappings.lifecycleSegment.segment3;
    if (normalized.includes("4")) return mappings.lifecycleSegment.segment4;
    return mappings.lifecycleSegment.other;
  }

  private getAccountAssignmentScore(value: unknown, mappings: WeightedScoreMappings): number {
    const raw = String(value || "").trim();
    if (!raw) {
      return mappings.accountAssignmentCode.other;
    }

    const digits = raw.replace(/\D/g, "");
    const code = digits.slice(-2).padStart(2, "0");
    if (code === "01") return mappings.accountAssignmentCode.code01;
    if (code === "03") return mappings.accountAssignmentCode.code03;
    if (code === "04") return mappings.accountAssignmentCode.code04;
    return mappings.accountAssignmentCode.other;
  }

  private calculateWeightedScore(
    part: PartData,
    weights: WeightedScoreWeights,
    mappings: WeightedScoreMappings
  ): number {
    let total = 0;

    if (weights.otcWorkshopChannel > 0) {
      const channel = String(part["OTC Workshop Channel"] || "").trim().toUpperCase();
      const score = channel.includes("OTC")
        ? mappings.otcWorkshopChannel.otc
        : mappings.otcWorkshopChannel.other;
      total += weights.otcWorkshopChannel * score;
    }

    if (weights.competitiveFlag > 0) {
      const competitive = String(part["Competitive Classification"] || "").trim().toUpperCase();
      const score = competitive === "Y"
        ? mappings.competitiveFlag.y
        : mappings.competitiveFlag.n;
      total += weights.competitiveFlag * score;
    }

    if (weights.lifecycleSegment > 0) {
      const score = this.getLifecycleScore(part["Lifecycle Segment"], mappings);
      total += weights.lifecycleSegment * score;
    }

    if (weights.accountAssignmentCode > 0) {
      const score = this.getAccountAssignmentScore(part["Account Assignment Code"], mappings);
      total += weights.accountAssignmentCode * score;
    }

    if (weights.warrantyOver35 > 0) {
      const score = part["Warranty > 35%"]
        ? mappings.warrantyOver35.yes
        : mappings.warrantyOver35.no;
      total += weights.warrantyOver35 * score;
    }

    return total;
  }

  setTransactionData(data: TransactionData[]) {
    if (data.length > 100000) {
      console.warn("⚠️ Large dataset detected. Processing", data.length, "transactions...");
    }
    this.transactionData = data;
    this.combineData();
    this.notifyListenersThrottled();
  }

  setPartMasterData(data: PartMasterData[]) {
    if (data.length > 100000) {
      console.warn("⚠️ Large dataset detected. Processing", data.length, "parts...");
    }
    this.partMasterData = data;
    this.combineData();
    this.notifyListenersThrottled();
  }

  private combineData() {
    // Performance optimization for large datasets
    const startTime = performance.now();
    
    if (this.partMasterData.length === 0) {
      this.combinedData = [];
      return;
    }
    
    // Group transaction data by the selected join column
    const transactionMap = new Map<string, TransactionData[]>();
    this.transactionData.forEach(transaction => {
      const partId = String((transaction as any)[this.transactionJoinColumn] || '').trim();
      
      if (partId) {
        if (!transactionMap.has(partId)) {
          transactionMap.set(partId, []);
        }
        transactionMap.get(partId)!.push(transaction);
      }
    });
    
    let skippedEmptyPartNumberCount = 0;
    let partsWithoutTransactionsCount = 0;

    // Combine master data with transaction data
    // JOIN: master[masterJoinColumn] = transaction[transactionJoinColumn]
    this.combinedData = this.partMasterData
      .map(master => {
        const partNumber = String((master as any)[this.masterJoinColumn] || '').trim();
        
        // Skip parts without a valid Part Number
        if (!partNumber) {
          skippedEmptyPartNumberCount += 1;
          return null;
        }
        
        // JOIN: Find transactions for this Part Number
        const transactions = transactionMap.get(partNumber) || [];
        
        if (transactions.length === 0) {
          partsWithoutTransactionsCount += 1;
        }
        
        // Aggregate transaction data
        const totalCustomerPayQty = transactions.reduce((sum, t) => 
          sum + (Number(t["Customer Pay Part Purchase Qty"]) || 0), 0);
        const totalCustomerPayAmount = transactions.reduce((sum, t) => 
          sum + (Number(t["Customer Pay Purchases Amount"]) || 0), 0);
        const totalManufacturerPayAmount = transactions.reduce((sum, t) => 
          sum + (Number(t["Manufacturer Pay Purchases Amount"]) || 0), 0);
        const totalGrossAmount = transactions.reduce((sum, t) => 
          sum + (Number(t["Gross Part Purchases Amount"]) || 0), 0);
        const totalReturnsAmount = transactions.reduce((sum, t) => 
          sum + (Number(t["Part Returns Amount"]) || 0), 0);
        const totalNetQty = transactions.reduce((sum, t) => 
          sum + (Number(t["Net Part Purchase Quantity"]) || 0), 0);
        const totalNetAmount = transactions.reduce((sum, t) => 
          sum + (Number(t["Net Part Purchase Amount"]) || 0), 0);

        // Extract values from master data
        const netPrice = Number(master["Net Price New"]) || 0;
        const landedCost = Number(master["Landed Cost"]) || 0;
        
        // Use existing Margin from master data if available, otherwise calculate
        let marginPercent = Number(master["Margin"]) || 0;
        
        // If Margin is stored as decimal (0-1), convert to percentage (0-100)
        if (marginPercent > 0 && marginPercent < 1) {
          marginPercent = marginPercent * 100;
        }
        
        // If Margin field is empty or 0, calculate from Net Price and Landed Cost
        if (marginPercent === 0 && netPrice > 0) {
          marginPercent = ((netPrice - landedCost) / netPrice) * 100;
        }
        
        // Get unique customer identifiers
        const dealerIdentifiers = [...new Set(
          transactions
            .map(t => String(t["Part Customer Identifier"] || '').trim())
            .filter(id => id)
        )];

        // Extract franchise from Division or Part Number
        const franchise = this.extractFranchise(
          partNumber, 
          String(master["Division"] || '')
        );

        // Extract additional classification fields
        const warrantyPercent = Number(master["Warranty Percent"]) || 0;
        const warrantyAbove35 = warrantyPercent > 0.35 || warrantyPercent > 35; // Handle both decimal (0.35) and percentage (35) formats
        const otcWorkshopChannel = String(master["OTC Workshop Channel"] || '').trim();
        const competitiveClassification = String(master["S Competitive Classification"] || '').trim();
        const masterRow = master as Record<string, any>;
        const lifecycleSegment = this.getFieldValueByAliases(masterRow, [
          "Life Cycle Segment",
          "Lifecycle Segment",
          "LifeCycle Segment",
        ]);
        const accountAssignmentCode = this.getFieldValueByAliases(masterRow, [
          "Account Assignment Code",
          "Account Assignment code",
          "Account Assignment",
          "Account Assignment Cd",
          "Account AssignmentCD",
        ]);
        
        // Calculate Legacy_Cluster: Channel_LifeCycleSegment_CompetitiveFlag
        const otcPercent = Number(master["OTC Percent"]) || 0;
        const channel = otcPercent > 0.40 ? "OTC" : "WS";
        const competitiveFlag = String(master["Competitive Flag"] || '').trim();
        const legacyCluster = `${channel}_${lifecycleSegment}_${competitiveFlag}`;
        
        // Create Legacy Cluster Name in human-readable format (e.g., "OTC High Y")
        const legacyClusterName = `${channel} ${lifecycleSegment} ${competitiveFlag}`.trim();

        return {
          "Part Number": partNumber, // Use the joined part number
          "Part Description": String(master["Part Name"] || ''),
          "Net Price New": netPrice,
          "Landed Cost": landedCost,
          "Vendor": String(master["Vendor"] || 'Unknown'),
          "Predecessor": master["Parent Part"] || null,
          "Franchise": franchise,
          "Division": String(master["Division"] || ''),
          "S Part Category": String(master["S Part Category"] || ''),
          "Legacy_Cluster": legacyCluster,
          "Legacy Cluster Name": legacyClusterName,
          "AI_Cluster_ID": 0, // Default, will be updated by calculateAIClusters
          "Warranty > 35%": warrantyAbove35,
          "OTC Workshop Channel": otcWorkshopChannel,
          "Competitive Classification": competitiveClassification,
          "Lifecycle Segment": lifecycleSegment,
          "Account Assignment Code": accountAssignmentCode,
          "Customer Pay Part Purchase Qty": totalCustomerPayQty,
          "Part Returns Amount": totalReturnsAmount,
          "Net Part Purchase Quantity": totalNetQty,
          "Customer Pay Purchases Amount": totalCustomerPayAmount,
          "Manufacturer Pay Purchases Amount": totalManufacturerPayAmount,
          "Gross Part Purchases Amount": totalGrossAmount,
          "ACP/Online Price": master["Median AM Competitor ACP Online Price"] 
            ? Number(master["Median AM Competitor ACP Online Price"]) 
            : null,
          "Core Price": 0,
          "List Price": netPrice,
          "Margin %": marginPercent,
          "Calculated Score": 0,
          "Dealer Identifiers": dealerIdentifiers,
        };
      })
      .filter((part): part is NonNullable<typeof part> => part !== null);
    
    const endTime = performance.now();
    const duration = (endTime - startTime).toFixed(2);

    console.log(
      `✅ Combined ${this.combinedData.length} parts in ${duration}ms (tx=${this.transactionData.length}, master=${this.partMasterData.length})`
    );
    if (skippedEmptyPartNumberCount > 0 || partsWithoutTransactionsCount > 0) {
      console.warn(
        `⚠️ Data quality summary: skipped empty part numbers=${skippedEmptyPartNumberCount}, parts without transactions=${partsWithoutTransactionsCount}`
      );
    }
    
    if (this.combinedData.length > 100000) {
      console.warn(`⚠️ Large dataset: ${this.combinedData.length} parts in memory. Consider using pagination or virtualization in UI.`);
    }
    
    if (this.combinedData.length > 0) {
      // Calculate AI clusters with default k=5 (only for datasets < 50k for performance)
      if (this.combinedData.length < 50000) {
        this.calculateAIClusters(5);
      } else {
        console.log("⏭️ Skipping auto-clustering for large dataset. Call calculateAIClusters() manually when needed.");
      }
    }
  }

  private extractFranchise(partNumber: string, division: string): string {
    // Handle undefined or null values
    const safePartNumber = partNumber || '';
    const safeDivision = division || 'UNKNOWN';
    
    // Try to extract from part number prefix
    const prefix = safePartNumber.split('-')[0] || safePartNumber.substring(0, 3);
    
    // Common franchise mappings
    if (prefix.includes('MB') || safeDivision.includes('Mercedes')) return 'MB';
    if (prefix.includes('BMW') || safeDivision.includes('BMW')) return 'BMW';
    if (prefix.includes('AUDI') || safeDivision.includes('Audi')) return 'AUDI';
    if (prefix.includes('VW') || safeDivision.includes('Volkswagen')) return 'VW';
    if (prefix.includes('PORSCHE') || safeDivision.includes('Porsche')) return 'PORSCHE';
    
    return safeDivision.substring(0, 10); // Use first part of division as fallback
  }

  /**
   * Calculate AI-driven clusters using K-Means algorithm
   * Features: Landed Cost, Margin %, Net Qty
   * @param k Number of clusters (default: 5)
   * @param useQualityFilter Apply quality filter before clustering (default: false)
   */
  calculateAIClusters(
    k: number = 5,
    useQualityFilter: boolean = false,
    scenarioFilters?: ScenarioFilters,
    weightedScoring?: WeightedScoringConfig
  ) {
    if (this.combinedData.length === 0) {
      console.warn("⚠️ No data available for clustering");
      return;
    }

    console.log(
      `🤖 === CALCULATING AI CLUSTERS (k=${k}, quality filter: ${useQualityFilter}, weighted scoring: ${Boolean(weightedScoring?.enabled)}) ===`
    );
    
    // Apply scenario filters first (raw data -> scenario subset)
    let dataForClustering = this.applyScenarioFilters(this.combinedData, scenarioFilters);
    if (scenarioFilters) {
      console.log(
        `🎛️ Scenario filters applied: ${this.combinedData.length} → ${dataForClustering.length} parts`
      );
    }

    // Apply quality filter if requested
    if (useQualityFilter) {
      const beforeCount = dataForClustering.length;
      dataForClustering = dataForClustering.filter((part) => {
        const netPrice = part["Net Price New"] || 0;
        const margin = part["Margin %"] || 0;
        const landedCost = part["Landed Cost"] || 0;
        
        // Quality criteria:
        // - Landed Cost > 0 (parts without cost are unrealistic)
        // - Net Price >= $0.10
        // - Margin >= 0%
        return landedCost > 0 && netPrice >= 0.10 && margin >= 0;
      });
      console.log(`🔍 Quality filter: ${beforeCount} → ${dataForClustering.length} parts (removed ${beforeCount - dataForClustering.length})`);
    }
    
    if (dataForClustering.length === 0) {
      console.warn("⚠️ No data left after filtering");
      return;
    }
    
    const activeScoringConfig: WeightedScoringConfig = {
      enabled: Boolean(weightedScoring?.enabled),
      weights: weightedScoring?.weights ?? DEFAULT_WEIGHTED_SCORE_WEIGHTS,
      mappings: weightedScoring?.mappings ?? DEFAULT_WEIGHTED_SCORE_MAPPINGS,
    };

    // Prepare data for K-Means
    const points = activeScoringConfig.enabled
      ? dataForClustering.map((part, index) => ({
          features: [this.calculateWeightedScore(part, activeScoringConfig.weights, activeScoringConfig.mappings ?? DEFAULT_WEIGHTED_SCORE_MAPPINGS)],
          originalIndex: index,
        }))
      : prepareClusteringData(dataForClustering);

    if (points.length === 0) {
      console.warn("⚠️ No valid points available for clustering");
      this.combinedData.forEach((part) => {
        part["AI_Cluster_ID"] = -1;
        part["Calculated Score"] = 0;
      });
      this.notifyListenersThrottled();
      return;
    }
    
    // Debug: Show sample features for inspection
    console.log(`🔬 Sample features (first 5 points):`);
    points.slice(0, 5).forEach((p, i) => {
      console.log(`  Point ${i}: [${p.features.map(f => f.toFixed(2)).join(", ")}]`);
    });
    
    // Debug: Show feature ranges
    if (points.length > 0) {
      const numFeatures = points[0].features.length;
      for (let f = 0; f < numFeatures; f++) {
        const values = points
          .map(p => p.features[f])
          .filter((value) => Number.isFinite(value));
        if (values.length === 0) {
          console.log(`  Feature ${f}: no finite values`);
          continue;
        }
        const min = Math.min(...values);
        const max = Math.max(...values);
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        console.log(`  Feature ${f}: min=${min.toFixed(2)}, max=${max.toFixed(2)}, mean=${mean.toFixed(2)}`);
      }
    }
    
    // Run K-Means clustering
    const result = kMeans(points, k);
    
    // Create a map of filtered indices to cluster IDs
    const clusterMap = new Map<string, number>();
    const scoreMap = new Map<string, number>();
    result.clusters.forEach((clusterId, pointIndex) => {
      const originalIndex = points[pointIndex]?.originalIndex;
      const part = originalIndex === undefined ? null : dataForClustering[originalIndex];
      if (part) {
        clusterMap.set(part["Part Number"], clusterId);
        const weightedScore = activeScoringConfig.enabled ? points[pointIndex].features[0] : 0;
        scoreMap.set(part["Part Number"], weightedScore);
      }
    });
    
    // Update ALL combined data with cluster IDs
    // Parts not in the filtered set get cluster ID -1
    this.combinedData.forEach((part) => {
      const clusterId = clusterMap.get(part["Part Number"]);
      part["AI_Cluster_ID"] = clusterId !== undefined ? clusterId : -1;
      part["Calculated Score"] = scoreMap.get(part["Part Number"]) ?? 0;
    });
    
    console.log(`✅ AI Clustering complete: ${result.iterations} iterations`);
    console.log(`📊 Cluster distribution:`, 
      result.clusters.reduce((acc, id) => {
        acc[id] = (acc[id] || 0) + 1;
        return acc;
      }, {} as Record<number, number>)
    );
    
    // Debug: Show centroids
    console.log(`🎯 Final centroids (k=${k}):`);
    result.centroids.forEach((c, i) => {
      console.log(`  Cluster ${i}: [${c.map(v => v.toFixed(4)).join(", ")}]`);
    });
    
    const excluded = this.combinedData.filter(p => p["AI_Cluster_ID"] === -1).length;
    if (excluded > 0) {
      console.log(`⚠️ ${excluded} parts excluded from clustering (cluster ID = -1)`);
    }
    
    // Notify listeners that data has changed
    this.notifyListenersThrottled();
  }

  getCombinedData(): PartData[] {
    return this.combinedData;
  }

  getMonthlyRevenueByPaymentType(monthCount: number = 12): MonthlyRevenuePoint[] {
    const safeMonthCount = Math.max(1, Math.trunc(monthCount));
    const monthlyMap = new Map<
      string,
      { date: Date; customerPayAmount: number; manufacturerPayAmount: number }
    >();

    this.transactionData.forEach((transaction) => {
      const reportingDate = this.parseReportingDate(transaction["Reporting Date"]);
      if (!reportingDate) {
        return;
      }

      const monthDate = new Date(reportingDate.getFullYear(), reportingDate.getMonth(), 1);
      const key = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
      const existing = monthlyMap.get(key) ?? {
        date: monthDate,
        customerPayAmount: 0,
        manufacturerPayAmount: 0,
      };

      existing.customerPayAmount += Number(transaction["Customer Pay Purchases Amount"]) || 0;
      existing.manufacturerPayAmount += Number(transaction["Manufacturer Pay Purchases Amount"]) || 0;
      monthlyMap.set(key, existing);
    });

    const monthlySeries = Array.from(monthlyMap.values())
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(-safeMonthCount)
      .map((entry) => ({
        month: entry.date.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        "Customer Pay Purchases Amount": entry.customerPayAmount,
        "Manufacturer Pay Purchases Amount": entry.manufacturerPayAmount,
      }));

    if (monthlySeries.length > 0) {
      return monthlySeries;
    }

    if (this.combinedData.length === 0) {
      return [];
    }

    const fallbackCustomer = this.combinedData.reduce(
      (sum, part) => sum + (Number(part["Customer Pay Purchases Amount"]) || 0),
      0
    );
    const fallbackManufacturer = this.combinedData.reduce(
      (sum, part) => sum + (Number(part["Manufacturer Pay Purchases Amount"]) || 0),
      0
    );

    return [
      {
        month: new Date().toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        "Customer Pay Purchases Amount": fallbackCustomer,
        "Manufacturer Pay Purchases Amount": fallbackManufacturer,
      },
    ];
  }

  hasData(): boolean {
    return this.combinedData.length > 0;
  }

  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Throttled notification for large datasets to prevent excessive re-renders
   * Batches multiple state updates within 100ms window
   */
  private notifyListenersThrottled() {
    if (this.notifyTimeout) {
      clearTimeout(this.notifyTimeout);
    }
    
    this.notifyTimeout = setTimeout(() => {
      this.notifyListeners();
      this.notifyTimeout = null;
    }, 100);
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener());
  }

  clear() {
    this.transactionData = [];
    this.partMasterData = [];
    this.combinedData = [];
    if (this.notifyTimeout) {
      clearTimeout(this.notifyTimeout);
      this.notifyTimeout = null;
    }
    this.notifyListeners();
  }
}

export const dataStore = new DataStore();
