# Genpact Pricing App

## ✅ Installation komplett!

Die .exe wurde erfolgreich erstellt: **genpact-pricing-app.exe** (ca. 40 MB)

---

## 🚀 So startest du die App:

### Methode 1: Mit dem Batch-Script (Empfohlen)
Doppelklick auf: **`start-genpact-app.bat`**

### Methode 2: Direkt die .exe starten
Doppelklick auf: **`genpact-pricing-app.exe`**

⚠️ **WICHTIG:** Die `dist/` Ordner muss im gleichen Verzeichnis wie die .exe sein!

---

## 📦 Was du kopieren musst:

Um die App auf einem anderen Rechner zu nutzen, kopiere diese Dateien/Ordner:

```
Genpact-Pricing-App/
├── genpact-pricing-app.exe    ← Die Anwendung
├── start-genpact-app.bat      ← Einfacher Starter
└── dist/                       ← App Dateien (ganzer Ordner!)
    ├── index.html
    ├── assets/
    └── ...
```

---

## 💡 Nutzung:

1. **Server starten:**
   - Doppelklick auf `genpact-pricing-app.exe`
   - Browser öffnet sich automatisch auf http://localhost:8080

2. **Daten hochladen:**
   - Klicke auf "Upload Data Files"
   - Lade zwei Dateien hoch:
     - **Part Daily Sales** (Transaction Data)
     - **Part Master Data**

3. **Analysen durchführen:**
   - Dashboard ansehen (Metriken, Charts)
   - Pricing Workbench nutzen
   - AI Clustering verwenden

---

## 🔧 Anforderungen:

- ✅ Windows 10/11
- ✅ Keine weiteren Installationen nötig!
- ✅ Node.js ist IN der .exe enthalten

---

## 📋 Excel/CSV Format:

### Part Daily Sales (Transaction Data):
- Part Identifier
- Customer Pay Part Purchase Qty
- Gross Part Purchases Amount
- Net Part Purchases Amount
- Customer Pay Part Return Qty
- Gross Part Returns Amount
- Net Part Returns Amount

### Part Master Data:
- Part Number
- Part Name
- Landed Cost
- Net Price New
- Vendor
- Division
- Franchise

---

## ❓ Probleme?

### Port 8080 belegt
Schließe andere Programme die Port 8080 nutzen

### Windows Defender Warnung
- Die .exe ist nicht signiert (normal)
- Klicke "Weitere Informationen" → "Trotzdem ausführen"

### Browser öffnet sich nicht automatisch
Öffne manuell: http://localhost:8080

### "dist nicht gefunden" Fehler
Stelle sicher dass der `dist/` Ordner neben der .exe ist

---

## 📝 Hinweise:

- 🔒 Alle Daten bleiben lokal auf deinem Rechner
- 🌐 Kein Internet erforderlich
- 💾 Keine Daten werden hochgeladen
- ⚡ Berechnungen erfolgen im Browser

---

## 🔄 Updates:

Bei einer neuen Version:
1. Lösche die alte .exe
2. Kopiere die neue .exe
3. Der `dist/` Ordner wird auch aktualisiert

---

**Viel Erfolg mit der Genpact Pricing App!** 🎉
