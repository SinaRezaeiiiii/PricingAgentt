# Excel Upload Guide - Pricing Workbench

## Übersicht
Die Pricing Workbench unterstützt jetzt den Upload von Excel-Dateien (.xlsx, .xls) mit Teiledaten.

## Excel-Datei Format

### Erforderliche Spalten
Ihre Excel-Datei sollte folgende Spalten enthalten (die Reihenfolge ist egal):

| Spaltenname | Typ | Beschreibung | Pflichtfeld |
|------------|-----|--------------|-------------|
| **Part Number** | Text | Teilenummer | ✅ Ja |
| **Part Description** | Text | Teilebeschreibung | ✅ Ja |
| **Net Price New** | Zahl | Nettopreis neu | ✅ Ja |
| **Landed Cost** | Zahl | Einstandspreis | ✅ Ja |
| **Vendor** | Text | Lieferant | ⚪ Nein |
| **Predecessor** | Text | Vorgängerteil | ⚪ Nein |
| **Franchise** | Text | Marke (MB, BMW, AUDI, etc.) | ✅ Ja |
| **Customer Pay Part Purchase Qty** | Zahl | Verkaufsmenge | ✅ Ja |
| **Part Returns Amount** | Zahl | Retouren Betrag | ⚪ Nein |
| **Net Part Purchase Quantity** | Zahl | Netto Einkaufsmenge | ⚪ Nein |
| **Customer Pay Purchases Amount** | Zahl | Kundenzahlung Betrag | ⚪ Nein |
| **Manufacturer Pay Purchases Amount** | Zahl | Herstellerzahlung Betrag | ⚪ Nein |
| **Gross Part Purchases Amount** | Zahl | Brutto Einkaufsbetrag | ⚪ Nein |
| **ACP/Online Price** | Zahl | Online-Preis | ⚪ Nein |
| **Core Price** | Zahl | Kernpreis | ⚪ Nein |
| **List Price** | Zahl | Listenpreis | ⚪ Nein |
| **Margin %** | Zahl | Marge in Prozent | ⚪ Nein |
| **Dealer Identifiers** | Text | Händler-IDs (kommagetrennt) | ⚪ Nein |

### Alternative Spaltennamen
Das System akzeptiert auch alternative Schreibweisen ohne Leerzeichen:
- `PartNumber` statt `Part Number`
- `PartDescription` statt `Part Description`
- `NetPriceNew` statt `Net Price New`
- `LandedCost` statt `Landed Cost`
- usw.

## Beispiel Excel-Struktur

```
| Part Number | Part Description      | Net Price New | Landed Cost | Franchise | Customer Pay Part Purchase Qty | Margin % |
|-------------|-----------------------|---------------|-------------|-----------|--------------------------------|----------|
| MB-274356   | Oil Filter Assembly   | 45.99         | 28.50       | MB        | 1250                           | 38.0     |
| BMW-892341  | Brake Pad Set Front   | 189.99        | 145.00      | BMW       | 890                            | 23.7     |
| AUDI-452198 | Air Filter Element    | 32.50         | 22.00       | AUDI      | 2100                           | 32.3     |
```

## Verwendung

1. **Excel-Datei vorbereiten**
   - Öffnen Sie Excel oder Google Sheets
   - Erstellen Sie eine Tabelle mit den oben genannten Spalten
   - Füllen Sie Ihre Daten ein
   - Speichern Sie als `.xlsx` oder `.xls`

2. **Datei hochladen**
   - Klicken Sie auf den Button "Excel hochladen" in der Pricing Workbench
   - Wählen Sie Ihre Excel-Datei aus
   - Die Daten werden automatisch geladen und angezeigt

3. **Zurück zu Beispieldaten**
   - Klicken Sie auf "Beispieldaten laden", um zu den ursprünglichen Demo-Daten zurückzukehren

## Tipps

- **Zahlenformat**: Verwenden Sie Dezimalpunkte (nicht Kommas) für Zahlen: `45.99` statt `45,99`
- **Leere Felder**: Nicht-Pflichtfelder können leer gelassen werden
- **Margin Berechnung**: Wenn Sie keine Marge angeben, wird diese automatisch berechnet
- **Dealer Identifiers**: Trennen Sie mehrere Händler-IDs mit Komma: `D001,D002,D003`

## Fehlerbehebung

**Problem**: "Fehler beim Lesen der Excel-Datei"
- Überprüfen Sie, ob alle Pflichtspalten vorhanden sind
- Stellen Sie sicher, dass die Datei im .xlsx oder .xls Format ist
- Prüfen Sie, ob Zahlenfelder tatsächlich Zahlen enthalten (keine Texte)

**Problem**: Daten werden nicht korrekt angezeigt
- Überprüfen Sie die Spaltennamen auf korrekte Schreibweise
- Stellen Sie sicher, dass die erste Zeile die Spaltenüberschriften enthält
