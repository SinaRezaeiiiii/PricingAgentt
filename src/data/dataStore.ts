// Central data store for uploaded Excel data
import { PartData } from "./mockData";

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

class DataStore {
  private transactionData: TransactionData[] = [];
  private partMasterData: PartMasterData[] = [];
  private combinedData: PartData[] = [];
  private listeners: (() => void)[] = [];

  setTransactionData(data: TransactionData[]) {
    console.log("=== TRANSACTION DATA ===");
    console.log("Rows:", data.length);
    if (data.length > 0) {
      console.log("Sample row:", data[0]);
      console.log("Column names:", Object.keys(data[0]));
    }
    this.transactionData = data;
    this.combineData();
    this.notifyListeners();
  }

  setPartMasterData(data: PartMasterData[]) {
    console.log("=== MASTER DATA ===");
    console.log("Rows:", data.length);
    if (data.length > 0) {
      console.log("Sample row:", data[0]);
      console.log("Column names:", Object.keys(data[0]));
    }
    this.partMasterData = data;
    this.combineData();
    this.notifyListeners();
  }

  private combineData() {
    console.log("🔗 === COMBINING DATA ===");
    console.log("Transaction data rows:", this.transactionData.length);
    console.log("Master data rows:", this.partMasterData.length);
    
    if (this.partMasterData.length === 0) {
      this.combinedData = [];
      return;
    }
    
    // Group transaction data by "Part Identifier"
    const transactionMap = new Map<string, TransactionData[]>();
    this.transactionData.forEach(transaction => {
      const partId = String(transaction["Part Identifier"] || '').trim();
      
      if (partId) {
        if (!transactionMap.has(partId)) {
          transactionMap.set(partId, []);
        }
        transactionMap.get(partId)!.push(transaction);
      }
    });
    
    console.log("📦 Unique parts in transactions:", transactionMap.size);
    console.log("📋 Transaction map keys (first 5):", Array.from(transactionMap.keys()).slice(0, 5));

    // Combine master data with transaction data
    // JOIN: master["Part Number"] = transaction["Part Identifier"]
    this.combinedData = this.partMasterData
      .map(master => {
        const partNumber = String(master["Part Number"] || '').trim();
        
        // Skip parts without a valid Part Number
        if (!partNumber) {
          console.warn("⚠️ Skipping part with empty Part Number");
          return null;
        }
        
        // JOIN: Find transactions for this Part Number
        const transactions = transactionMap.get(partNumber) || [];
        
        if (transactions.length === 0) {
          console.warn(`⚠️ No transactions found for Part: ${partNumber}`);
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
        
        // Calculate margin percentage
        const marginPercent = netPrice > 0 
          ? ((netPrice - landedCost) / netPrice) * 100
          : 0;

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

        return {
          "Part Number": partNumber,
          "Part Description": String(master["Part Name"] || ''),
          "Net Price New": netPrice,
          "Landed Cost": landedCost,
          "Vendor": String(master["Vendor"] || 'Unknown'),
          "Predecessor": master["Parent Part"] || null,
          "Franchise": franchise,
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
          "Dealer Identifiers": dealerIdentifiers,
        };
      })
      .filter((part): part is NonNullable<typeof part> => part !== null);
    
    console.log("✅ Combined data rows:", this.combinedData.length);
    if (this.combinedData.length > 0) {
      console.log("📊 Sample combined row:", this.combinedData[0]);
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

  getCombinedData(): PartData[] {
    return this.combinedData;
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

  private notifyListeners() {
    this.listeners.forEach(listener => listener());
  }

  clear() {
    this.transactionData = [];
    this.partMasterData = [];
    this.combinedData = [];
    this.notifyListeners();
  }
}

export const dataStore = new DataStore();
