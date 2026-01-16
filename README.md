# Miklagaard - Roddresa Tracker

En frontend-only webbapp för att följa en virtuell roddresa längs Sveriges kust. Spåra dina roddpass och se din position på kartan.

## Funktioner

- Interaktiv Leaflet-karta med rutten utritad
- Vikinginspirerad markör som visar din position
- Total distans, kvar till nästa stopp och mål
- Lista över senaste 10 roddpass
- Stöd för Google Sheets som datakälla (uppdatera från mobilen!)
- Fallback till lokal JSON-fil

## Snabbstart

### Lokal utveckling

1. Klona repot
2. Starta en lokal webbserver, t.ex.:
   ```bash
   python -m http.server 8000
   # eller
   npx serve
   ```
3. Öppna `http://localhost:8000` i webbläsaren

### GitHub Pages

1. Pusha repot till GitHub
2. Gå till **Settings** → **Pages**
3. Under "Source", välj **Deploy from a branch**
4. Välj `main` branch och `/` (root)
5. Klicka **Save**
6. Din sida finns på `https://ditt-användarnamn.github.io/repo-namn/`

## Koppla Google Sheets

För att uppdatera roddpass enkelt från mobilen kan du använda ett Google Sheet som datakälla.

### 1. Skapa ett Google Sheet

Skapa ett nytt Google Sheet med följande kolumner i rad 1:

| date | meters | note |
|------|--------|------|
| 2025-01-15 | 10000 | Bra pass! |
| 2025-01-16 | 8500 | |

- **date**: Datum i formatet `YYYY-MM-DD`
- **meters**: Antal meter rodda (heltal)
- **note**: Valfri anteckning

### 2. Publicera som CSV

1. I Google Sheets: **Arkiv** → **Dela** → **Publicera på webben**
2. Välj **Hela dokumentet** (eller det specifika bladet)
3. Välj format: **Kommaseparerade värden (.csv)**
4. Klicka **Publicera**
5. Kopiera den genererade URL:en

URL:en ser ut ungefär så här:
```
https://docs.google.com/spreadsheets/d/e/2PACX-xxxxx/pub?output=csv
```

### 3. Konfigurera appen

Öppna `app.js` och uppdatera `CONFIG.googleSheetUrl`:

```javascript
const CONFIG = {
  googleSheetUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-xxxxx/pub?output=csv",
  // ...
};
```

### 4. Klar!

Appen försöker nu först ladda data från Google Sheets. Om det misslyckas används den lokala fallback-filen.

**Tips:** Det kan ta några minuter innan ändringar i Google Sheets syns i den publicerade CSV:en.

## Filstruktur

```
/
├── index.html          # Huvudsida
├── app.js              # All JavaScript-logik
├── styles.css          # Styling
├── data/
│   ├── route.json      # Ruttdefinition med stopp
│   └── rows.sample.json # Exempeldata (fallback)
└── README.md
```

## Anpassa rutten

Redigera `data/route.json` för att ändra rutten:

```json
{
  "stops": [
    { "name": "Startplats", "lat": 63.69, "lon": 20.28, "cum_km": 0 },
    { "name": "Stopp 1", "lat": 63.26, "lon": 18.69, "cum_km": 110 },
    { "name": "Mål", "lat": 61.72, "lon": 17.11, "cum_km": 330 }
  ]
}
```

- **name**: Namn på stoppet
- **lat/lon**: Koordinater (WGS84)
- **cum_km**: Kumulativ distans från start i kilometer

## Dataformat för roddpass

```json
[
  { "date": "2025-01-15", "meters": 10000, "note": "Bra tempo" },
  { "date": "2025-01-16", "meters": 8500 }
]
```

- **date**: Datum (YYYY-MM-DD)
- **meters**: Distans i meter
- **note**: Valfri anteckning

## Teknologi

- [Leaflet](https://leafletjs.com/) - Interaktiva kartor
- [OpenStreetMap](https://www.openstreetmap.org/) - Kartdata
- Vanilla JavaScript - Ingen byggprocess krävs

## Licens

MIT
