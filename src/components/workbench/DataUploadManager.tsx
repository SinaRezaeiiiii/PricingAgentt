import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import * as XLSX from "xlsx";
import { dataStore, TransactionData, PartMasterData } from "@/data/dataStore";

export function DataUploadManager() {
  const [transactionFile, setTransactionFile] = useState<File | null>(null);
  const [masterFile, setMasterFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const transactionInputRef = useRef<HTMLInputElement>(null);
  const masterInputRef = useRef<HTMLInputElement>(null);

  const handleTransactionUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setTransactionFile(file);
    }
  };

  const handleMasterUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setMasterFile(file);
    }
  };

  const processFiles = async () => {
    if (!transactionFile || !masterFile) {
      alert("Bitte laden Sie beide Dateien hoch.");
      return;
    }

    setIsProcessing(true);

    try {
      // Process transaction file
      console.log("Processing transaction file:", transactionFile.name);
      const transactionData = await readFile<TransactionData>(transactionFile);
      console.log("Transaction data loaded:", transactionData.length, "rows");
      dataStore.setTransactionData(transactionData);

      // Process master file
      console.log("Processing master file:", masterFile.name);
      const masterData = await readFile<PartMasterData>(masterFile);
      console.log("Master data loaded:", masterData.length, "rows");
      dataStore.setPartMasterData(masterData);

      alert(`Erfolgreich verarbeitet!\n${masterData.length} Teile geladen.`);
    } catch (error) {
      console.error("Error processing files:", error);
      const errorMessage = error instanceof Error ? error.message : "Unbekannter Fehler";
      alert(`Fehler beim Verarbeiten der Dateien:\n${errorMessage}\n\nBitte überprüfen Sie:\n- Dateiformat (Excel oder CSV)\n- Spaltennamen\n- Dateiinhalt`);
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
            const workbook = XLSX.read(data, { type: "binary" });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet) as T[];
            resolve(jsonData);
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = reject;
        reader.readAsBinaryString(file);
      });
    }
  };

  const clearFiles = () => {
    setTransactionFile(null);
    setMasterFile(null);
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
                  if (transactionInputRef.current) transactionInputRef.current.value = "";
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          {transactionFile && (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-profit" />
              <span className="truncate">{transactionFile.name}</span>
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
                  if (masterInputRef.current) masterInputRef.current.value = "";
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          {masterFile && (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-profit" />
              <span className="truncate">{masterFile.name}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button
          onClick={processFiles}
          disabled={!transactionFile || !masterFile || isProcessing}
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
          <strong>Table 1 (Part Daily Sales):</strong> Part Identifier, Reporting Date, Customer Pay Part Purchase Qty, etc.
          <br />
          <strong>Table 2 (Part Master Data):</strong> Part Number, Part Name, Landed Cost, Net Price New, Vendor, etc.
        </p>
      </div>
    </Card>
  );
}
