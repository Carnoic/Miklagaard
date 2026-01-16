// Configuration
const CONFIG = {
  // Google Sheets published CSV URL (set your own)
  // Format: https://docs.google.com/spreadsheets/d/e/SHEET_ID/pub?output=csv
  googleSheetUrl: null,

  // Local fallback
  localDataUrl: "data/rows.sample.json",

  // Route data
  routeUrl: "data/route.json"
};

// Viking boat SVG icon
const vikingSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 64 64">
  <path d="M14 28 C14 18, 22 10, 32 10 C42 10, 50 18, 50 28 L50 40 C50 50, 42 56, 32 56 C22 56, 14 50, 14 40 Z" fill="#111"/>
  <path d="M20 30 C20 24, 25 20, 32 20 C39 20, 44 24, 44 30 L44 40 C44 46, 39 50, 32 50 C25 50, 20 46, 20 40 Z" fill="#ddd"/>
  <path d="M12 24 C6 22, 4 16, 8 12 C12 8, 18 10, 20 16" fill="none" stroke="#111" stroke-width="4" stroke-linecap="round"/>
  <path d="M52 24 C58 22, 60 16, 56 12 C52 8, 46 10, 44 16" fill="none" stroke="#111" stroke-width="4" stroke-linecap="round"/>
</svg>
`;

// State
let map = null;
let routeData = null;
let rowingData = [];
let boatMarker = null;
let routeLines = { completed: null, remaining: null };
let dataSource = "local";

// Initialize app
document.addEventListener("DOMContentLoaded", init);

async function init() {
  initMap();
  await loadRoute();
  await loadRowingData();
  updateUI();
}

// Initialize Leaflet map
function initMap() {
  map = L.map("map", {
    zoomControl: true,
    scrollWheelZoom: true
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 18
  }).addTo(map);

  // Default view (Österled overview)
  map.setView([55, 25], 4);
}

// Load route data
async function loadRoute() {
  try {
    const response = await fetch(CONFIG.routeUrl);
    routeData = await response.json();
    drawRoute();
  } catch (error) {
    console.error("Failed to load route:", error);
    showError("Kunde inte ladda rutten");
  }
}

// Draw route on map
function drawRoute() {
  if (!routeData || !routeData.stops) return;

  const coords = routeData.stops.map(stop => [stop.lat, stop.lon]);

  // Add stop markers
  routeData.stops.forEach((stop, index) => {
    const isStart = index === 0;
    const isEnd = index === routeData.stops.length - 1;

    const marker = L.marker([stop.lat, stop.lon], {
      icon: L.divIcon({
        className: "stop-marker",
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      })
    }).addTo(map);

    marker.bindPopup(`
      <strong>${stop.name}</strong><br>
      ${stop.cum_km} km från start
      ${isStart ? "<br><em>(Start)</em>" : ""}
      ${isEnd ? "<br><em>(Mål)</em>" : ""}
      ${stop.info ? `<br><small>${stop.info}</small>` : ""}
    `);
  });

  // Fit map to route
  map.fitBounds(coords, { padding: [50, 50] });
}

// Update route lines based on progress (green = completed, red = remaining)
function updateRouteLines(totalKm) {
  if (!routeData || !routeData.stops) return;

  // Remove existing lines
  if (routeLines.completed) {
    map.removeLayer(routeLines.completed);
  }
  if (routeLines.remaining) {
    map.removeLayer(routeLines.remaining);
  }

  const stops = routeData.stops;
  const completedCoords = [];
  const remainingCoords = [];

  // Find current position
  const segment = getCurrentSegment(totalKm);
  let currentPos = null;

  if (segment) {
    currentPos = interpolatePosition(segment.from, segment.to, segment.progress);
  }

  // Build completed and remaining coordinate arrays
  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];

    if (totalKm >= stop.cum_km) {
      // This stop is completed
      completedCoords.push([stop.lat, stop.lon]);
    } else {
      // This stop is remaining
      if (remainingCoords.length === 0 && currentPos) {
        // Add current position as start of remaining
        remainingCoords.push([currentPos.lat, currentPos.lon]);
      }
      remainingCoords.push([stop.lat, stop.lon]);
    }
  }

  // Add current position to end of completed coords
  if (currentPos && completedCoords.length > 0) {
    completedCoords.push([currentPos.lat, currentPos.lon]);
  }

  // Draw completed line (green)
  if (completedCoords.length >= 2) {
    routeLines.completed = L.polyline(completedCoords, {
      color: "#2ecc71",
      weight: 5,
      opacity: 0.9
    }).addTo(map);
  }

  // Draw remaining line (red)
  if (remainingCoords.length >= 2) {
    routeLines.remaining = L.polyline(remainingCoords, {
      color: "#e94560",
      weight: 4,
      opacity: 0.7
    }).addTo(map);
  }
}

// Load rowing data from Google Sheets or local fallback
async function loadRowingData() {
  let baseData = [];

  // Try Google Sheets first
  if (CONFIG.googleSheetUrl) {
    try {
      const data = await fetchGoogleSheet(CONFIG.googleSheetUrl);
      if (data && data.length > 0) {
        baseData = data;
        dataSource = "Google Sheets";
      }
    } catch (error) {
      console.warn("Google Sheets failed, trying local fallback:", error);
    }
  }

  // Fallback to local JSON if no Google Sheets data
  if (baseData.length === 0) {
    try {
      const response = await fetch(CONFIG.localDataUrl);
      baseData = await response.json();
      dataSource = "lokal fil";
    } catch (error) {
      console.error("Failed to load rowing data:", error);
      showError("Kunde inte ladda rodddata");
    }
  }

  // Merge with localStorage entries
  const localEntries = getLocalStorageEntries();
  if (localEntries.length > 0) {
    rowingData = [...baseData, ...localEntries];
    dataSource += ` + ${localEntries.length} lokala`;
  } else {
    rowingData = baseData;
  }
}

// Get entries from localStorage
function getLocalStorageEntries() {
  try {
    const data = localStorage.getItem('miklagaard_local_rows');
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

// Parse Google Sheets CSV
async function fetchGoogleSheet(url) {
  const response = await fetch(url);
  const csvText = await response.text();

  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
  const dateIdx = headers.findIndex(h => h === "date" || h === "datum");
  const metersIdx = headers.findIndex(h => h === "meters" || h === "meter");
  const noteIdx = headers.findIndex(h => h === "note" || h === "not" || h === "anteckning");

  if (dateIdx === -1 || metersIdx === -1) {
    throw new Error("Invalid CSV format: missing date or meters column");
  }

  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length > Math.max(dateIdx, metersIdx)) {
      const entry = {
        date: values[dateIdx]?.trim(),
        meters: parseInt(values[metersIdx], 10) || 0
      };
      if (noteIdx !== -1 && values[noteIdx]?.trim()) {
        entry.note = values[noteIdx].trim();
      }
      if (entry.date && entry.meters > 0) {
        data.push(entry);
      }
    }
  }

  return data;
}

// Simple CSV line parser
function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

// Calculate total kilometers rowed
function getTotalKm() {
  const totalMeters = rowingData.reduce((sum, row) => sum + (row.meters || 0), 0);
  return totalMeters / 1000;
}

// Find current segment based on total km
function getCurrentSegment(totalKm) {
  if (!routeData || !routeData.stops) return null;

  const stops = routeData.stops;
  const lastStop = stops[stops.length - 1];

  // Clamp totalKm to route length
  const clampedKm = Math.min(totalKm, lastStop.cum_km);

  for (let i = 0; i < stops.length - 1; i++) {
    if (clampedKm >= stops[i].cum_km && clampedKm < stops[i + 1].cum_km) {
      return {
        from: stops[i],
        to: stops[i + 1],
        progress: (clampedKm - stops[i].cum_km) / (stops[i + 1].cum_km - stops[i].cum_km)
      };
    }
  }

  // At or past the end
  if (clampedKm >= lastStop.cum_km) {
    return {
      from: stops[stops.length - 2],
      to: lastStop,
      progress: 1
    };
  }

  return null;
}

// Interpolate position between two points
function interpolatePosition(from, to, progress) {
  return {
    lat: from.lat + (to.lat - from.lat) * progress,
    lon: from.lon + (to.lon - from.lon) * progress
  };
}

// Update boat marker position
function updateBoatPosition(totalKm) {
  const segment = getCurrentSegment(totalKm);
  if (!segment) return;

  const pos = interpolatePosition(segment.from, segment.to, segment.progress);

  const boatIcon = L.divIcon({
    className: "viking-marker",
    html: vikingSvg,
    iconSize: [44, 44],
    iconAnchor: [22, 22]
  });

  if (boatMarker) {
    boatMarker.setLatLng([pos.lat, pos.lon]);
  } else {
    boatMarker = L.marker([pos.lat, pos.lon], { icon: boatIcon }).addTo(map);
    boatMarker.bindPopup("Din position!");
  }
}

// Update all UI elements
function updateUI() {
  const totalKm = getTotalKm();
  const segment = getCurrentSegment(totalKm);
  const lastStop = routeData?.stops?.[routeData.stops.length - 1];
  const totalRoute = lastStop?.cum_km || 330;

  // Update stats
  document.getElementById("total-km").textContent = totalKm.toFixed(1);

  if (segment) {
    const kmToNextStop = segment.to.cum_km - totalKm;
    document.getElementById("km-to-next").textContent = Math.max(0, kmToNextStop).toFixed(1);
    document.getElementById("current-segment").textContent = `${segment.from.name} → ${segment.to.name}`;
  } else {
    document.getElementById("km-to-next").textContent = "0";
    document.getElementById("current-segment").textContent = "Framme!";
  }

  const kmRemaining = Math.max(0, totalRoute - totalKm);
  document.getElementById("km-remaining").textContent = kmRemaining.toFixed(1);

  // Update progress bar
  const progressPercent = Math.min(100, (totalKm / totalRoute) * 100);
  document.getElementById("progress-fill").style.width = `${progressPercent}%`;
  document.getElementById("progress-percent").textContent = `${progressPercent.toFixed(1)}%`;

  // Update sessions list
  updateSessionsList();

  // Update route lines (green/red)
  updateRouteLines(totalKm);

  // Update boat position
  updateBoatPosition(totalKm);

  // Update data source
  document.getElementById("data-source").textContent = `Datakälla: ${dataSource}`;
}

// Update sessions list (last 10)
function updateSessionsList() {
  const list = document.getElementById("sessions-list");

  // Sort by date descending and take last 10
  const sorted = [...rowingData]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 10);

  if (sorted.length === 0) {
    list.innerHTML = '<li class="session-item">Inga pass registrerade</li>';
    return;
  }

  list.innerHTML = sorted.map(session => {
    const km = (session.meters / 1000).toFixed(1);
    const dateFormatted = formatDate(session.date);
    return `
      <li class="session-item">
        <div class="session-info">
          <div class="session-date">${dateFormatted}</div>
          ${session.note ? `<div class="session-note">${escapeHtml(session.note)}</div>` : ""}
        </div>
        <div class="session-meters">${km} km</div>
      </li>
    `;
  }).join("");
}

// Format date nicely
function formatDate(dateStr) {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("sv-SE", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  } catch {
    return dateStr;
  }
}

// Escape HTML to prevent XSS
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Show error message
function showError(message) {
  const container = document.getElementById("error-container");
  if (container) {
    container.innerHTML = `<div class="error">${escapeHtml(message)}</div>`;
  }
}

// Allow manual data reload
function reloadData() {
  loadRowingData().then(updateUI);
}

// Expose reload function globally
window.reloadData = reloadData;
