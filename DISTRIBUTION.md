# Genpact Pricing App - Distribution Anleitung

## 📦 Was wurde erstellt:

### 1. **genpact-pricing-app.exe** (Standalone Executable)
   - Komplette Windows-Anwendung
   - Keine Installation erforderlich
   - Enthält Node.js + Server + App

### 2. **dist/** Ordner
   - Die gebaute React App
   - Muss im gleichen Ordner wie die .exe sein

---

## 🚀 So verwendest du die App:

### Option A: Mit der .exe Datei (Empfohlen)

1. **Kopiere diese Dateien auf deinen Zielrechner:**
   ```
   genpact-pricing-app.exe
   dist/ (kompletter Ordner)
   ```

2. **Doppelklick auf `genpact-pricing-app.exe`**
   - Der Server startet automatisch
   - Browser öffnet sich auf http://localhost:8080

3. **Excel/CSV Dateien hochladen:**
   - Part Daily Sales (Transaction Data)
   - Part Master Data

---

### Option B: Mit Node.js (wenn bereits installiert)

1. Installiere Dependencies:
   ```bash
   npm install
   ```

2. Starte die App:
   ```bash
   npm run build    # Erst bauen
   node server.js   # Dann starten
   ```

   ODER direkt:
   ```bash
   start-app.bat
   ```

---

## 📋 Systemanforderungen:

### Für .exe Version:
- ✅ Windows 10/11
- ✅ Keine weiteren Abhängigkeiten!

### Für Node.js Version:
- Node.js v18 oder höher
- NPM

---

## 🔧 Dateien hochladen:

Die App benötigt zwei Dateien:

### 1. Part Daily Sales (Transaction Data)
**Format:** Excel (.xlsx, .xls) oder CSV (.csv)

**Erforderliche Spalten:**
- Part Identifier
- Customer Pay Part Purchase Qty
- Gross Part Purchases Amount
- Net Part Purchases Amount
- Customer Pay Part Return Qty
- Gross Part Returns Amount
- Net Part Returns Amount

### 2. Part Master Data
**Format:** Excel (.xlsx, .xls) oder CSV (.csv)

**Erforderliche Spalten:**
- Part Number
- Part Name
- Landed Cost
- Net Price New
- Vendor
- Division
- Franchise

---

## 🐛 Fehlerbehebung:

### "Port 8080 ist bereits belegt"
- Ein anderes Programm nutzt Port 8080
- Schließe andere lokale Server
- Oder ändere PORT in server.js

### "Cannot read dist/index.html"
- Stelle sicher, dass der `dist/` Ordner existiert
- Führe `npm run build` aus

### Excel Upload funktioniert nicht
- Prüfe Spaltennamen (müssen exakt übereinstimmen)
- Öffne Browser Console (F12) für Details

### Windows Defender Warnung
- Die .exe ist nicht signiert
- Klicke "Weitere Informationen" → "Trotzdem ausführen"

---

## 📁 Verzeichnisstruktur für Distribution:

```
Genpact-Pricing-App/
├── genpact-pricing-app.exe  ← Hauptprogramm
└── dist/                      ← App Dateien
    ├── index.html
    ├── assets/
    │   ├── index-[hash].js
    │   └── index-[hash].css
    └── ...
```

---

## 🔄 Updates:

Um die App zu aktualisieren:

1. Hole den neuesten Code
2. Baue neu:
   ```bash
   npm run build
   npx pkg server.js --targets node18-win-x64 --output genpact-pricing-app.exe
   ```
3. Ersetze die alte .exe

---

## 📞 Support:

Bei Problemen:
1. Prüfe Browser Console (F12)
2. Prüfe Terminal Output
3. Kontaktiere das Development Team

---

## ⚡ Wichtige Hinweise:

- ⚠️ Die App läuft **lokal** auf deinem Rechner
- 💾 Daten werden **nicht** auf einen Server hochgeladen
- 🔒 Alle Berechnungen erfolgen im Browser
- 🌐 Internet ist **nicht** erforderlich nach dem Start
