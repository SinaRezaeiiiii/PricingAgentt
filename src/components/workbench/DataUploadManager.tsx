import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import * as XLSX from "xlsx";
import { dataStore, TransactionData, PartMasterData } from "@/data/dataStore";

export function DataUploadManager() {
  const [transactionFile, setTransactionFile] = useState<File | null>(null);
  const [masterFile, setMasterFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactionColumns, setTransactionColumns] = useState<string[]>([]);
  const [masterColumns, setMasterColumns] = useState<string[]>([]);
  const [transactionJoinColumn, setTransactionJoinColumn] = useState<string>("");
  const [masterJoinColumn, setMasterJoinColumn] = useState<string>("");
  const [transactionData, setTransactionData] = useState<any[]>([]);
  const [masterData, setMasterData] = useState<any[]>([]);
  const transactionInputRef = useRef<HTMLInputElement>(null);
  const masterInputRef = useRef<HTMLInputElement>(null);

  const handleTransactionUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      console.log("📁 Transaction file selected:", file.name);
      setTransactionFile(file);
      try {
        const data = await readFile<TransactionData>(file);
        console.log("✅ Transaction data loaded:", data.length, "rows");
        setTransactionData(data);
        if (data.length > 0) {
          const columns = Object.keys(data[0]);
          console.log("📋 Transaction columns:", columns);
          setTransactionColumns(columns);
          // Auto-select "Part Identifier" if it exists
          if (columns.includes("Part Identifier")) {
            setTransactionJoinColumn("Part Identifier");
            console.log("✓ Auto-selected join column: Part Identifier");
          } else {
            setTransactionJoinColumn(columns[0]);
            console.log("✓ Auto-selected join column:", columns[0]);
          }
        } else {
          console.warn("⚠️ No data rows found in transaction file");
        }
      } catch (error) {
        console.error("❌ Error reading transaction file:", error);
        alert("Error reading file. Please check the file format.");
        setTransactionFile(null);
        setTransactionColumns([]);
        setTransactionData([]);
      }
    }
  };

  const handleMasterUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      console.log("📁 Master file selected:", file.name);
      setMasterFile(file);
      try {
        const data = await readFile<PartMasterData>(file);
        console.log("✅ Master data loaded:", data.length, "rows");
        setMasterData(data);
        if (data.length > 0) {
          const columns = Object.keys(data[0]);
          console.log("📋 Master columns:", columns);
          setMasterColumns(columns);
          // Auto-select "Part Number" or "Part Identifier" if it exists
          if (columns.includes("Part Number")) {
            setMasterJoinColumn("Part Number");
            console.log("✓ Auto-selected join column: Part Number");
          } else if (columns.includes("Part Identifier")) {
            setMasterJoinColumn("Part Identifier");
            console.log("✓ Auto-selected join column: Part Identifier");
          } else {
            setMasterJoinColumn(columns[0]);
            console.log("✓ Auto-selected join column:", columns[0]);
          }
        } else {
          console.warn("⚠️ No data rows found in master file");
        }
      } catch (error) {
        console.error("❌ Error reading master file:", error);
        alert("Error reading file. Please check the file format.");
        setMasterFile(null);
        setMasterColumns([]);
        setMasterData([]);
      }
    }
  };

  const processFiles = async () => {
    if (!transactionFile || !masterFile) {
      alert("Please upload both files.");
      return;
    }

    if (!transactionJoinColumn || !masterJoinColumn) {
      alert("Please select join columns for both files.");
      return;
    }

    setIsProcessing(true);

    try {
      console.log("Processing with join columns:");
      console.log("Transaction:", transactionJoinColumn);
      console.log("Master:", masterJoinColumn);
      
      // Set join columns in dataStore
      dataStore.setJoinColumns(transactionJoinColumn, masterJoinColumn);
      
      // Set data in dataStore (will trigger combineData with new join columns)
      dataStore.setTransactionData(transactionData as TransactionData[]);
      dataStore.setPartMasterData(masterData as PartMasterData[]);

      alert(`Successfully processed!\n${masterData.length} parts loaded.`);
    } catch (error) {
      console.error("Error processing files:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      alert(`Error processing files:\n${errorMessage}\n\nPlease check:\n- File format (Excel or CSV)\n- Column names\n- File content`);
    } finally {
      setIsProcessing(false);
    }
  };

  const readFile = <T,>(file: File): Promise<T[]> => {
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    if (fileExtension === 'csv') {
      // CSV Parser
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const text = e.target?.result as string;
            const lines = text.split('\n');
            const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
            
            const data = lines.slice(1)
              .filter(line => line.trim())
              .map(line => {
                const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
                const row: any = {};
                headers.forEach((header, index) => {
                  row[header] = values[index] || '';
                });
                return row;
              });
            
            resolve(data as T[]);
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = reject;
        reader.readAsText(file);
      });
    } else {
      // Excel Parser
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = e.target?.result;
            console.log("📖 Reading Excel file...");
            const workbook = XLSX.read(data, { type: "array" });
            console.log("📄 Workbook sheets:", workbook.SheetNames);
            
            const sheetName = workbook.SheetNames[0];
            console.log("📋 Reading sheet:", sheetName);
            
            const worksheet = workbook.Sheets[sheetName];
            
            // Check if sheet has data
            const range = worksheet['!ref'];
            console.log("📐 Sheet range:", range);
            
            if (!range) {
              console.warn("⚠️ Sheet has no range (!ref is undefined). Checking for table...");
              
              // Try to find tables in the worksheet
              if (worksheet['!tables']) {
                console.log("📊 Found tables in sheet");
              }
              
              // Try alternative parsing
              const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
                raw: false,
                defval: '',
                blankrows: false
              }) as T[];
              
              console.log("✅ Parsed rows (alternative method):", jsonData.length);
              
              if (jsonData.length > 0) {
                console.log("🔍 First row sample:", jsonData[0]);
              } else {
                console.error("❌ No data found in sheet. Sheet might be empty or have special formatting.");
                console.log("💡 Try: Open Excel file, select all data, copy to new sheet, save as new file");
              }
              
              resolve(jsonData);
              return;
            }
            
            const decodedRange = XLSX.utils.decode_range(range);
            console.log("📐 Rows:", decodedRange.e.r + 1, "Cols:", decodedRange.e.c + 1);
            
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
              raw: false,
              defval: '',
              blankrows: false
            }) as T[];
            console.log("✅ Parsed rows:", jsonData.length);
            
            if (jsonData.length > 0) {
              console.log("🔍 First row sample:", jsonData[0]);
            }
            
            resolve(jsonData);
          } catch (error) {
            console.error("❌ Excel parsing error:", error);
            reject(error);
          }
        };
        reader.onerror = (error) => {
          console.error("❌ File read error:", error);
          reject(error);
        };
        reader.readAsArrayBuffer(file);
      });
    }
  };

  const clearFiles = () => {
    setTransactionFile(null);
    setMasterFile(null);
    setTransactionColumns([]);
    setMasterColumns([]);
    setTransactionJoinColumn("");
    setMasterJoinColumn("");
    setTransactionData([]);
    setMasterData([]);
    dataStore.clear();
    if (transactionInputRef.current) transactionInputRef.current.value = "";
    if (masterInputRef.current) masterInputRef.current.value = "";
  };

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">Upload Data</h3>
        <p className="text-sm text-muted-foreground">
          Upload both files (Excel or CSV) to update the data.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Transaction Data Upload */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Part Daily Sales
            <span className="text-muted-foreground ml-1">(Table 1)</span>
          </label>
          <input
            ref={transactionInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleTransactionUpload}
            className="hidden"
          />
          <div className="flex gap-2">
            <Button
              onClick={() => transactionInputRef.current?.click()}
              variant="outline"
              className="flex-1 gap-2"
              disabled={isProcessing}
            >
              <Upload className="h-4 w-4" />
              {transactionFile ? "Change File" : "Select File"}
            </Button>
            {transactionFile && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setTransactionFile(null);
                  setTransactionColumns([]);
                  setTransactionJoinColumn("");
                  setTransactionData([]);
                  if (transactionInputRef.current) transactionInputRef.current.value = "";
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          {transactionFile && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-profit" />
                <span className="truncate">{transactionFile.name}</span>
              </div>
              {transactionColumns.length > 0 && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Join Column:
                  </label>
                  <Select
                    value={transactionJoinColumn}
                    onValueChange={setTransactionJoinColumn}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select join column" />
                    </SelectTrigger>
                    <SelectContent>
                      {transactionColumns.map((col) => (
                        <SelectItem key={col} value={col}>
                          {col}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Master Data Upload */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Part Master Data
            <span className="text-muted-foreground ml-1">(Table 2)</span>
          </label>
          <input
            ref={masterInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleMasterUpload}
            className="hidden"
          />
          <div className="flex gap-2">
            <Button
              onClick={() => masterInputRef.current?.click()}
              variant="outline"
              className="flex-1 gap-2"
              disabled={isProcessing}
            >
              <Upload className="h-4 w-4" />
              {masterFile ? "Change File" : "Select File"}
            </Button>
            {masterFile && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setMasterFile(null);
                  setMasterColumns([]);
                  setMasterJoinColumn("");
                  setMasterData([]);
                  if (masterInputRef.current) masterInputRef.current.value = "";
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          {masterFile && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-profit" />
                <span className="truncate">{masterFile.name}</span>
              </div>
              {masterColumns.length > 0 && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Join Column:
                  </label>
                  <Select
                    value={masterJoinColumn}
                    onValueChange={setMasterJoinColumn}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select join column" />
                    </SelectTrigger>
                    <SelectContent>
                      {masterColumns.map((col) => (
                        <SelectItem key={col} value={col}>
                          {col}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button
          onClick={processFiles}
          disabled={!transactionFile || !masterFile || !transactionJoinColumn || !masterJoinColumn || isProcessing}
          className="gap-2"
        >
          <FileSpreadsheet className="h-4 w-4" />
          {isProcessing ? "Processing..." : "Process Data"}
        </Button>
        {(transactionFile || masterFile) && (
          <Button onClick={clearFiles} variant="outline" disabled={isProcessing}>
            Reset
          </Button>
        )}
      </div>

      <div className="pt-2 border-t">
        <p className="text-xs text-muted-foreground">
          <strong>How it works:</strong> Upload both files, select the join column from each file, then click "Process Data".
          <br />
          The data will be joined based on matching values in the selected columns.
        </p>
      </div>
    </Card>
  );
}
