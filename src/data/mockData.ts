// Mock data for the AI-Driven After-Sales Pricing Engine
// Using exact column headers as specified

export interface PartData {
  // Master Data (Pricing)
  "Part Number": string;
  "Part Description": string;
  "Net Price New": number;
  "Landed Cost": number;
  "Vendor": string;
  "Predecessor": string | null;
  "Franchise": string;
  
  // Sales Metrics
  "Customer Pay Part Purchase Qty": number;
  "Part Returns Amount": number;
  "Net Part Purchase Quantity": number;
  "Customer Pay Purchases Amount": number;
  "Manufacturer Pay Purchases Amount": number;
  "Gross Part Purchases Amount": number;
  
  // Market Data
  "ACP/Online Price": number | null;
  "Core Price": number;
  "List Price": number;
  
  // Calculated
  "Margin %": number;
  
  // Transaction data
  "Dealer Identifiers": string[];
}

export interface MonthlyRevenue {
  month: string;
  "Customer Pay Purchases Amount": number;
  "Manufacturer Pay Purchases Amount": number;
}

// Generate realistic part numbers for Mercedes-Benz, BMW, and generic
const franchises = ["MB", "BMW", "AUDI", "VW", "PORSCHE"];
const vendors = ["Bosch", "Continental", "Denso", "Valeo", "ZF", "Mahle", "Hella", "Brembo", "NGK", "Delphi"];

const partDescriptions = [
  "Oil Filter Assembly",
  "Brake Pad Set Front",
  "Brake Pad Set Rear",
  "Spark Plug Set",
  "Air Filter Element",
  "Cabin Air Filter",
  "Wiper Blade Set",
  "Battery AGM 80Ah",
  "Alternator 180A",
  "Starter Motor",
  "Water Pump Assembly",
  "Thermostat Housing",
  "Fuel Pump Module",
  "Oxygen Sensor Bank 1",
  "Catalytic Converter",
  "Transmission Filter Kit",
  "CV Joint Boot Kit",
  "Wheel Bearing Hub",
  "Shock Absorber Front",
  "Shock Absorber Rear",
  "Control Arm Lower",
  "Control Arm Upper",
  "Tie Rod End",
  "Ball Joint Front",
  "Sway Bar Link",
  "Radiator Assembly",
  "A/C Compressor",
  "A/C Condenser",
  "Heater Core",
  "Blower Motor",
  "Window Regulator LF",
  "Window Regulator RF",
  "Door Lock Actuator",
  "Side Mirror Assembly",
  "Headlight Assembly HID",
  "Tail Light Assembly LED",
  "Fog Light Kit",
  "Turbocharger Assembly",
  "Intercooler",
  "EGR Valve",
  "Mass Air Flow Sensor",
  "Throttle Body",
  "Fuel Injector Set",
  "Ignition Coil Pack",
  "Timing Chain Kit",
  "Serpentine Belt",
  "Tensioner Pulley",
  "Motor Mount Set",
  "Transmission Mount",
];

const dealerNames = [
  "Metro Motors - NYC",
  "Pacific Auto Group - LA",
  "Midwest Motors - Chicago",
  "Sunbelt Auto - Dallas",
  "Atlantic Motors - Miami",
  "Northwest Auto - Seattle",
  "Rocky Mountain Motors - Denver",
  "Great Lakes Auto - Detroit",
  "Capital Motors - DC",
  "Bay Area Auto - SF",
  "Southern Motors - Atlanta",
  "Desert Auto Group - Phoenix",
];

function generatePartNumber(franchise: string, index: number): string {
  const prefix = franchise === "MB" ? "A" : franchise === "BMW" ? "11" : franchise.substring(0, 2);
  const num = String(index).padStart(6, "0");
  const suffix = Math.floor(Math.random() * 99).toString().padStart(2, "0");
  return `${prefix}${num}${suffix}`;
}

function generatePredecessor(partNumber: string, hasPredecessor: boolean): string | null {
  if (!hasPredecessor) return null;
  // Slightly modify the part number to create a predecessor
  const base = partNumber.substring(0, partNumber.length - 2);
  const oldSuffix = String(Math.floor(Math.random() * 50)).padStart(2, "0");
  return `${base}${oldSuffix}`;
}

function getRandomDealers(): string[] {
  const count = Math.floor(Math.random() * 5) + 1;
  const shuffled = [...dealerNames].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// Generate 100 sample parts for the demo
export const partsData: PartData[] = Array.from({ length: 100 }, (_, i) => {
  const franchise = franchises[Math.floor(Math.random() * franchises.length)];
  const landedCost = Math.round((Math.random() * 800 + 20) * 100) / 100;
  const marginMultiplier = 1 + (Math.random() * 0.6 + 0.05); // 5% to 65% margin
  const netPriceNew = Math.round(landedCost * marginMultiplier * 100) / 100;
  const margin = ((netPriceNew - landedCost) / netPriceNew) * 100;
  
  const customerQty = Math.floor(Math.random() * 5000) + 10;
  const manufacturerQty = Math.floor(Math.random() * 1000);
  const returnsQty = Math.floor(customerQty * (Math.random() * 0.15));
  
  const hasAcpPrice = Math.random() > 0.3;
  const acpPrice = hasAcpPrice 
    ? Math.round(netPriceNew * (0.85 + Math.random() * 0.3) * 100) / 100 
    : null;
  
  return {
    "Part Number": generatePartNumber(franchise, i + 1000),
    "Part Description": partDescriptions[i % partDescriptions.length],
    "Net Price New": netPriceNew,
    "Landed Cost": landedCost,
    "Vendor": vendors[Math.floor(Math.random() * vendors.length)],
    "Predecessor": generatePredecessor(generatePartNumber(franchise, i + 1000), Math.random() > 0.6),
    "Franchise": franchise,
    "Customer Pay Part Purchase Qty": customerQty,
    "Part Returns Amount": Math.round(returnsQty * netPriceNew * 100) / 100,
    "Net Part Purchase Quantity": customerQty - returnsQty,
    "Customer Pay Purchases Amount": Math.round(customerQty * netPriceNew * 100) / 100,
    "Manufacturer Pay Purchases Amount": Math.round(manufacturerQty * netPriceNew * 100) / 100,
    "Gross Part Purchases Amount": Math.round((customerQty + manufacturerQty) * netPriceNew * 100) / 100,
    "ACP/Online Price": acpPrice,
    "Core Price": Math.round(landedCost * 0.3 * 100) / 100,
    "List Price": Math.round(netPriceNew * 1.2 * 100) / 100,
    "Margin %": Math.round(margin * 100) / 100,
    "Dealer Identifiers": getRandomDealers(),
  };
});

// Monthly revenue data for charts
export const monthlyRevenueData: MonthlyRevenue[] = [
  { month: "Feb '25", "Customer Pay Purchases Amount": 4520000, "Manufacturer Pay Purchases Amount": 1280000 },
  { month: "Mar '25", "Customer Pay Purchases Amount": 4780000, "Manufacturer Pay Purchases Amount": 1350000 },
  { month: "Apr '25", "Customer Pay Purchases Amount": 5120000, "Manufacturer Pay Purchases Amount": 1420000 },
  { month: "May '25", "Customer Pay Purchases Amount": 4890000, "Manufacturer Pay Purchases Amount": 1380000 },
  { month: "Jun '25", "Customer Pay Purchases Amount": 5340000, "Manufacturer Pay Purchases Amount": 1520000 },
  { month: "Jul '25", "Customer Pay Purchases Amount": 5680000, "Manufacturer Pay Purchases Amount": 1640000 },
  { month: "Aug '25", "Customer Pay Purchases Amount": 5420000, "Manufacturer Pay Purchases Amount": 1580000 },
  { month: "Sep '25", "Customer Pay Purchases Amount": 5890000, "Manufacturer Pay Purchases Amount": 1720000 },
  { month: "Oct '25", "Customer Pay Purchases Amount": 6120000, "Manufacturer Pay Purchases Amount": 1850000 },
  { month: "Nov '25", "Customer Pay Purchases Amount": 5780000, "Manufacturer Pay Purchases Amount": 1680000 },
  { month: "Dec '25", "Customer Pay Purchases Amount": 6450000, "Manufacturer Pay Purchases Amount": 1920000 },
  { month: "Jan '26", "Customer Pay Purchases Amount": 5950000, "Manufacturer Pay Purchases Amount": 1780000 },
];

// Aggregated metrics
export const dashboardMetrics = {
  totalNetPurchaseAmount: partsData.reduce((sum, p) => sum + p["Gross Part Purchases Amount"], 0),
  avgMargin: partsData.reduce((sum, p) => sum + p["Margin %"], 0) / partsData.length,
  totalReturnsAmount: partsData.reduce((sum, p) => sum + p["Part Returns Amount"], 0),
  totalPartsCount: 550000,
  avgLandedCost: partsData.reduce((sum, p) => sum + p["Landed Cost"], 0) / partsData.length,
  avgNetPrice: partsData.reduce((sum, p) => sum + p["Net Price New"], 0) / partsData.length,
  highReturnsParts: partsData.filter(p => p["Part Returns Amount"] > 5000).length,
  lowMarginHighVolume: partsData.filter(p => p["Margin %"] < 15 && p["Customer Pay Part Purchase Qty"] > 1000).length,
};

// Cluster data for scatter plot
export interface ClusterData {
  "Part Number": string;
  "Part Description": string;
  "Customer Pay Part Purchase Qty": number;
  "Landed Cost": number;
  "Margin %": number;
  "Part Returns Amount": number;
  cluster: "traffic-builder" | "premium" | "problem" | "standard";
}

export const clusterData: ClusterData[] = partsData.map(part => {
  let cluster: ClusterData["cluster"];
  
  if (part["Customer Pay Part Purchase Qty"] > 2000 && part["Margin %"] < 20) {
    cluster = "traffic-builder";
  } else if (part["Part Returns Amount"] > 3000 && part["Customer Pay Part Purchase Qty"] < 500) {
    cluster = "problem";
  } else if (part["Margin %"] > 35 && part["Landed Cost"] > 200) {
    cluster = "premium";
  } else {
    cluster = "standard";
  }
  
  return {
    "Part Number": part["Part Number"],
    "Part Description": part["Part Description"],
    "Customer Pay Part Purchase Qty": part["Customer Pay Part Purchase Qty"],
    "Landed Cost": part["Landed Cost"],
    "Margin %": part["Margin %"],
    "Part Returns Amount": part["Part Returns Amount"],
    cluster,
  };
});
