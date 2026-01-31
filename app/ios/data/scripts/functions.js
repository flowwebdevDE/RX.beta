// --- Hilfsfunktionen ---
function haversine(a, b) {
  const R = 6371000;
  const toRad = x => x * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat), lat2 = toRad(b.lat);
  const sinDlat = Math.sin(dLat / 2), sinDlon = Math.sin(dLon / 2);
  const c = 2 * Math.atan2(
    Math.sqrt(sinDlat * sinDlat + Math.cos(lat1) * Math.cos(lat2) * sinDlon * sinDlon),
    Math.sqrt(1 - (sinDlat * sinDlat + Math.cos(lat1) * Math.cos(lat2) * sinDlon * sinDlon))
  );
  return R * c;
}

// --- Priority Queue für Dijkstra ---
class PQ {
  constructor() { this._items = []; }
  push(item, pr) { this._items.push({ item, pr }); this._items.sort((a, b) => a.pr - b.pr); }
  pop() { return this._items.shift()?.item; }
  empty() { return this._items.length === 0; }
}

// --- Dijkstra-Algorithmus ---
function dijkstra(graph, startId, endId, trainVmax_kmh) {
  const dist = {}, prev = {}, pq = new PQ();
  Object.keys(graph.nodes).forEach(id => dist[id] = Infinity);
  dist[startId] = 0;
  pq.push(startId, 0);

  while (!pq.empty()) {
    const u = pq.pop();
    if (u === endId) break;
    const edges = graph.edges[u] || [];
    for (const e of edges) {
      const edgeV = e.maxspeed ? Math.min(trainVmax_kmh, e.maxspeed) : trainVmax_kmh;
      const timeSeconds = (e.len_m / 1000) / edgeV * 3600;
      const alt = dist[u] + timeSeconds;
      if (alt < dist[e.v]) {
        dist[e.v] = alt;
        prev[e.v] = { from: u, edge: e };
        pq.push(e.v, alt);
      }
    }
  }

  if (!prev[endId]) return null;
  const path = [];
  let cur = endId;
  while (cur !== startId) {
    const p = prev[cur];
    path.push({ to: cur, from: p.from, edge: p.edge });
    cur = p.from;
  }
  path.reverse();
  return { path, time_s: dist[endId] };
}

// --- Leaflet Map ---
const map = L.map('map', { zoomControl: false }).setView([52.517, 13.388], 9.5);
L.control.zoom({ position: 'bottomright' }).addTo(map);

let mapGlLayer;
function updateMapTheme(isDark) {
    if (mapGlLayer) map.removeLayer(mapGlLayer);
    mapGlLayer = L.maplibreGL({
        style: isDark ? 'https://tiles.openfreemap.org/styles/dark' : 'https://tiles.openfreemap.org/styles/positron',
    }).addTo(map);
}

// Initial Theme Check & Listener
updateMapTheme(document.body.classList.contains('dark-mode'));
window.addEventListener('rx-settings-changed', (e) => {
    updateMapTheme(e.detail.darkMode);
});

const routeLayer = L.layerGroup().addTo(map);
const stationLayer = L.layerGroup().addTo(map);
const highlightLayer = L.layerGroup().addTo(map);

// --- UI Elemente ---
const fromInput = document.getElementById('from');
const toInput = document.getElementById('to');
const fromTrackInput = document.getElementById('from-track');
const toTrackInput = document.getElementById('to-track');
const viaInput = document.getElementById('via');
const vmaxInput = document.getElementById('vmax');
const calcBtn = document.getElementById('calc');
const clearBtn = document.getElementById('clear');
const summaryDiv = document.getElementById('summary');
const tableWrap = document.getElementById('table-wrap');
const fromList = document.getElementById('from-list');
const toList = document.getElementById('to-list');
const viaList = document.getElementById('via-list');

let selectedFrom = null, selectedTo = null, selectedVias = [];

// ------------------------------------------------------
// 🟩 Lokale JSON-basierte Bahnhofsdaten laden
// ------------------------------------------------------
let stationData = [];

async function loadStations() {
  const res = await fetch('data/stations.json');
  const js = await res.json();
  if (js.elements) {
    stationData = js.elements
      .filter(el => el.type === 'node' && el.tags && el.tags.name)
      .map(el => ({
        id: el.id,
        lat: el.lat,
        lon: el.lon,
        name: el.tags.name,
        network: el.tags.network || '',
        operator: el.tags.operator || '',
        ref: el.tags['railway:ref'] || '',
        uic: el.tags.uic_ref || '',
        category: el.tags['railway:station_category'] || '',
        wheelchair: el.tags.wheelchair || '',
        wikidata: el.tags.wikidata || '',
        rawTags: el.tags
      }));
  }
  console.log(`✅ ${stationData.length} Stationen geladen`);
}

loadStations();

// ------------------------------------------------------
// 🔍 Lokale Autocomplete-Suche
// ------------------------------------------------------
async function nominatimSearch(q) {
  if (!q || q.length < 2) return [];
  const lower = q.toLowerCase();

  const results = stationData.filter(s =>
    s.name.toLowerCase().includes(lower) ||
    s.ref.toLowerCase().includes(lower) ||
    s.uic.toLowerCase().includes(lower)
  );

  return results.map(s => ({
    display: `${s.name}${s.ref ? " [" + s.ref + "]" : ""}`,
    lat: s.lat,
    lon: s.lon,
    props: s
  }));
}

// ------------------------------------------------------
// 🔧 Autocomplete UI Logik
// ------------------------------------------------------
function attachAutocomplete(inputEl, listEl, onSelect) {
  let timer = null;
  inputEl.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const q = inputEl.value.trim();
      if (!q) { listEl.style.display = 'none'; return; }
      const items = await nominatimSearch(q);
      listEl.innerHTML = '';
      if (items.length === 0) { listEl.style.display = 'none'; return; }
      for (const it of items) {
        const div = document.createElement('div');
        div.className = 'autocomplete-item';
        div.textContent = it.display;
        div.addEventListener('click', () => {
          onSelect(it);
          listEl.style.display = 'none';
        });
        listEl.appendChild(div);
      }
      listEl.style.display = 'block';
    }, 200);
  });
  document.addEventListener('click', e => {
    if (!inputEl.contains(e.target) && !listEl.contains(e.target))
      listEl.style.display = 'none';
  });
}

// --- Autocomplete für From, To, Via ---
attachAutocomplete(fromInput, fromList, (it) => {
  selectedFrom = it;
  fromInput.value = it.display;
  addStationMarker(it, 'start', true);
});

attachAutocomplete(toInput, toList, (it) => {
  selectedTo = it;
  toInput.value = it.display;
  addStationMarker(it, 'end', true);
});

const addViaBtn = document.getElementById('add-via');
const viaTagsDiv = document.getElementById('via-tags');

attachAutocomplete(viaInput, viaList, (it) => {
  viaInput.value = it.display;
  viaInput.dataset.selectedLat = it.lat;
  viaInput.dataset.selectedLon = it.lon;
  viaInput.dataset.selectedDisplay = it.display;
});

// 🟢 Button zum Hinzufügen mehrerer Zwischenstopps
addViaBtn.addEventListener('click', () => {
  const display = viaInput.dataset.selectedDisplay;
  const lat = parseFloat(viaInput.dataset.selectedLat);
  const lon = parseFloat(viaInput.dataset.selectedLon);

  if (!display || isNaN(lat) || isNaN(lon)) {
    alert('Bitte zuerst einen Bahnhof auswählen.');
    return;
  }

  const viaObj = { display, lat, lon };
  selectedVias.push(viaObj);
  addStationMarker(viaObj, 'via', true);
  viaInput.value = '';
  delete viaInput.dataset.selectedLat;
  delete viaInput.dataset.selectedLon;
  delete viaInput.dataset.selectedDisplay;

  // UI aktualisieren
  renderViaTags();
});

function renderViaTags() {
  viaTagsDiv.innerHTML = '';
  selectedVias.forEach((v, i) => {
    const tag = document.createElement('span');
    tag.className = 'via-tag';
    tag.draggable = true; // Drag aktivieren
    tag.innerHTML = `<span>${v.display}</span> <span class="remove-via" style="margin-left:5px; cursor:pointer;">✕</span>`;
    
    // Löschen Event
    tag.querySelector('.remove-via').addEventListener('click', (e) => {
      e.stopPropagation();
      selectedVias.splice(i, 1);
      renderViaTags();
      updateMapMarkers();
    });

    // Drag Events
    tag.addEventListener('dragstart', (e) => {
        tag.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', i);
    });

    tag.addEventListener('dragend', () => {
        tag.classList.remove('dragging');
    });

    tag.addEventListener('dragover', (e) => {
        e.preventDefault(); // Drop erlauben
        e.dataTransfer.dropEffect = 'move';
    });

    tag.addEventListener('drop', (e) => {
        e.preventDefault();
        const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
        if (fromIndex !== i) {
            const item = selectedVias.splice(fromIndex, 1)[0];
            selectedVias.splice(i, 0, item);
            renderViaTags();
            updateMapMarkers(); // Karte aktualisieren (Reihenfolge visualisieren falls nötig)
        }
    });

    viaTagsDiv.appendChild(tag);
  });
}


// ------------------------------------------------------
// 🗺️ Stationen & Karte
// ------------------------------------------------------
function addStationMarker(it, role, shouldPan = false) {
  let cssClass = 'map-pin';
  if (role === 'start') cssClass += ' start';
  else if (role === 'end') cssClass += ' end';
  else cssClass += ' via';

  // Größe basierend auf Rolle (Start/End größer)
  const size = (role === 'start' || role === 'end') ? 22 : 16;

  const markerIcon = L.divIcon({
    className: '', // Standard Leaflet Klasse entfernen
    html: `<div class="${cssClass}" style="width:${size}px; height:${size}px;"></div>`,
    iconSize: [size, size],
    iconAnchor: [size/2, size/2], // Zentriert auf der Koordinate
    popupAnchor: [0, -size/2 - 5]
  });

  L.marker([it.lat, it.lon], { icon: markerIcon, title: it.display })
    .addTo(stationLayer)
    .bindPopup(`<b>${role.toUpperCase()}</b><br>${it.display}`);
  
  if (shouldPan) map.panTo([it.lat, it.lon]);
}

// Hilfsfunktion um alle Marker neu zu setzen (z.B. nach Löschen/Sortieren)
function updateMapMarkers() {
    stationLayer.clearLayers();
    if (selectedFrom) addStationMarker(selectedFrom, 'start');
    if (selectedTo) addStationMarker(selectedTo, 'end');
    selectedVias.forEach(v => addStationMarker(v, 'via'));
}



clearBtn.addEventListener('click', () => {
  selectedFrom = null;
  selectedTo = null;
  selectedVias = [];
  fromInput.value = '';
  toInput.value = '';
  fromTrackInput.value = '';
  toTrackInput.value = '';
  viaInput.value = '';
  vmaxInput.value = 120;
  stationLayer.clearLayers();
  routeLayer.clearLayers();
  summaryDiv.textContent = 'Keine Route berechnet.';
  tableWrap.innerHTML = '';
});

// ------------------------------------------------------
// 🧮 Routenberechnung (mit Overpass)
// ------------------------------------------------------
function bboxFromPoints(points, pad_km = 15) {
  let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lon < minLon) minLon = p.lon;
    if (p.lon > maxLon) maxLon = p.lon;
  }
  const padDeg = pad_km / 111;
  return [minLat - padDeg, minLon - padDeg, maxLat + padDeg, maxLon + padDeg];
}

const OVERPASS_ENDPOINTS_FUNC = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter'
];

async function fetchRailNetwork(bbox) {
  const [s, w, n, e] = bbox;
  const q = `[out:json][timeout:60];
    (way["railway"~"^(rail|railway)$"](${s},${w},${n},${e}); >;);
    out body;`;
  const maxRetries = 2;

  for (const endpoint of OVERPASS_ENDPOINTS_FUNC) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch(endpoint, { method: 'POST', body: q, headers: { 'Content-Type': 'text/plain' } });
        if (!res.ok) throw new Error(`HTTP-Status: ${res.status}`);
        const js = await res.json();
        const nodes = {}, ways = {};
        if (js.elements) {
          for (const el of js.elements) {
            if (el.type === 'node') nodes[el.id] = { id: el.id, lat: el.lat, lon: el.lon };
            if (el.type === 'way') ways[el.id] = el;
          }
        }
        return { nodes, ways }; // Erfolgreich
      } catch (error) {
        console.warn(`Fehler bei Anfrage an ${endpoint} (Versuch ${attempt}):`, error.message);
        if (attempt < maxRetries) await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }
  }
  throw new Error("Konnte keine Netzwerkdaten von den Overpass-Servern abrufen.");
}

function buildGraph(nodes, ways) {
  const graph = { nodes: {}, edges: {} };
  for (const nid in nodes) graph.nodes[nid] = nodes[nid];

  function addEdge(u, v, len, wayid, maxspeed) {
    if (!graph.edges[u]) graph.edges[u] = [];
    graph.edges[u].push({ v, len_m: len, wayid, maxspeed });
  }

  for (const wid in ways) {
    const w = ways[wid];
    const nds = w.nodes;
    let maxspeed = null;
    if (w.tags && w.tags.maxspeed) {
      const parsed = parseInt(w.tags.maxspeed);
      if (!isNaN(parsed)) maxspeed = parsed;
    }
    for (let i = 0; i < nds.length - 1; i++) {
      const a = nodes[nds[i]], b = nodes[nds[i + 1]];
      if (!a || !b) continue;
      const len = haversine({ lat: a.lat, lon: a.lon }, { lat: b.lat, lon: b.lon });
      addEdge(String(a.id), String(b.id), len, wid, maxspeed);
      addEdge(String(b.id), String(a.id), len, wid, maxspeed);
    }
  }
  return graph;
}

function findNearestNode(nodes, lat, lon) {
  let best = null, bestd = Infinity;
  for (const id in nodes) {
    const n = nodes[id];
    const d = haversine({ lat: n.lat, lon: n.lon }, { lat, lon });
    if (d < bestd) { bestd = d; best = n; }
  }
  return best;
}

async function computeRoute(points, trainVmax_kmh) {
  // 1. Großen Graphen für die gesamte Route bauen
  const bbox = bboxFromPoints(points, 25); // Größerer Puffer für die Gesamtroute
  const net = await fetchRailNetwork(bbox);
  if (Object.keys(net.nodes).length === 0) {
    throw new Error('Keine Schienendaten im ausgewählten Bereich gefunden.');
  }
  const graph = buildGraph(net.nodes, net.ways);

  // 2. Pfade für einzelne Segmente auf dem großen Graphen berechnen
  const segmentResults = [];
  let totalTimeSec = 0, totalLen = 0;
  const fullPolyline = [];
  
  // Hilfsvariable für durchlaufende Kilometerierung im Profil (optional, hier pro Segment reset)

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    const na = findNearestNode(net.nodes, a.lat, a.lon);
    const nb = findNearestNode(net.nodes, b.lat, b.lon);
    if (!na || !nb) throw new Error('Keine Schienendaten im Ausschnitt gefunden.');

    const res = dijkstra(graph, String(na.id), String(nb.id), trainVmax_kmh);
    if (!res) throw new Error(`Kein Pfad zwischen ${a.display} und ${b.display} gefunden.`);

    const segCoords = [];
    let segMaxSpeed = 0;
    const speedProfile = [];
    let currentDistKm = 0;
    let segTimeSec = 0;
    let lastKnownTrackMax = trainVmax_kmh;

    for (const step of res.path) {
      const to = step.to;
      segCoords.push([net.nodes[to].lat, net.nodes[to].lon]);

      // Geschwindigkeitsprofil berechnen
      const edgeLenKm = step.edge.len_m / 1000;
      
      let trackMax = step.edge.maxspeed;
      if (trackMax) lastKnownTrackMax = trackMax;
      else trackMax = lastKnownTrackMax;

      const edgeSpeed = Math.min(trainVmax_kmh, trackMax);
      if (edgeSpeed > segMaxSpeed) segMaxSpeed = edgeSpeed;
      segTimeSec += (edgeLenKm / edgeSpeed) * 3600;

      if (speedProfile.length > 0 && speedProfile[speedProfile.length - 1].speed === edgeSpeed) {
        speedProfile[speedProfile.length - 1].end += edgeLenKm;
      } else {
        speedProfile.push({ start: currentDistKm, end: currentDistKm + edgeLenKm, speed: edgeSpeed });
      }
      currentDistKm += edgeLenKm;
    }
    segCoords.unshift([net.nodes[na.id].lat, net.nodes[na.id].lon]);

    let segLen = 0;
    for (let k = 0; k < segCoords.length - 1; k++)
      segLen += haversine({ lat: segCoords[k][0], lon: segCoords[k][1] }, { lat: segCoords[k + 1][0], lon: segCoords[k + 1][1] });

    totalTimeSec += segTimeSec;
    totalLen += segLen;
    fullPolyline.push(...segCoords);
    // Entferne den ersten Punkt aus dem nächsten Segment, um Duplikate zu vermeiden
    if (i < points.length - 2) {
      fullPolyline.pop();
    }
    segmentResults.push({ 
        from: a.display, 
        to: b.display, 
        time_s: segTimeSec, 
        len_m: segLen, 
        coords: segCoords,
        maxSpeed: segMaxSpeed,
        speedProfile: speedProfile
    });
  }

  return { segments: segmentResults, totalTime_s: totalTimeSec, totalLen_m: totalLen, polyline: fullPolyline };
}

// ------------------------------------------------------
// 🚂 Berechnung starten
// ------------------------------------------------------
calcBtn.addEventListener('click', async () => {
  // NEU: Prüfen, ob eine Internetverbindung besteht.
  if (!navigator.onLine) {
    summaryDiv.textContent = 'Keine Internetverbindung.';
    tableWrap.innerHTML = '<p class="hint">Die Routenberechnung erfordert eine aktive Internetverbindung, um auf die Overpass-API zuzugreifen.</p>';
    return;
  }

  try {
    if (!selectedFrom || !selectedTo) {
      alert('Bitte Start- und Zielbahnhof wählen.');
      return;
    }

    const viaPoints = selectedVias;
    const points = [selectedFrom, ...viaPoints, selectedTo];
    const vmax = Number(vmaxInput.value) || 120;
    const fromTrack = fromTrackInput.value.trim();
    const toTrack = toTrackInput.value.trim();

    summaryDiv.innerHTML = '<div class="skeleton" style="width: 60%; height: 24px;"></div>';
    routeLayer.clearLayers();
    stationLayer.clearLayers();
    highlightLayer.clearLayers();

    tableWrap.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 15px;">
            <div class="skeleton" style="width: 100%; height: 40px; border-radius: 12px;"></div>
            <div class="skeleton" style="width: 100%; height: 40px; border-radius: 12px;"></div>
            <div class="skeleton" style="width: 100%; height: 40px; border-radius: 12px;"></div>
        </div>
    `;

    addStationMarker(selectedFrom, 'start');
    addStationMarker(selectedTo, 'end');
    for (const vp of viaPoints) addStationMarker(vp, 'via');

    const res = await computeRoute(points, vmax);

    const poly = L.polyline(res.polyline.map(p => [p[0], p[1]]), { weight: 5 }).addTo(routeLayer);
    map.fitBounds(poly.getBounds(), { padding: [40, 40] });

    const total_h = Math.floor(res.totalTime_s / 3600);
    const total_min = Math.round((res.totalTime_s % 3600) / 60);
    
    // Neue Zusammenfassungs-Box
    summaryDiv.innerHTML = `
        <div class="summary-box">
            <div class="summary-item">
                <span class="summary-label">Distanz</span>
                <span class="summary-value">${(res.totalLen_m / 1000).toFixed(1)} <small>km</small></span>
            </div>
            <div class="summary-divider"></div>
            <div class="summary-item">
                <span class="summary-label">Dauer</span>
                <span class="summary-value">${total_h} <small>h</small> ${total_min} <small>min</small></span>
            </div>
        </div>
    `;

    // Neue Timeline-Liste
    let html = '<div class="timeline-view">';
    res.segments.forEach((s, i) => {
      const h = Math.floor(s.time_s / 3600);
      const m = Math.round((s.time_s % 3600) / 60);
      const timeText = h > 0 ? `${h} h ${m} min` : `${m} min`;
      
      // Berechnungen für Details
      const distKm = s.len_m / 1000;
      const hours = s.time_s / 3600;
      const avgSpeed = hours > 0 ? Math.round(distKm / hours) : 0;

      // Profil HTML generieren
      const profileRows = s.speedProfile.map(p => {
        let color = '#e74c3c'; // Rot (< 100)
        if (p.speed >= 160) color = '#2ecc71'; // Grün
        else if (p.speed >= 100) color = '#f39c12'; // Orange
        
        return `<div class="profile-row">
            <span>${p.start.toFixed(1)} - ${p.end.toFixed(1)} km</span>
            <span style="color: ${color}; font-weight: bold;">${p.speed} km/h</span>
         </div>`;
      }).join('');

      // Gleis-Anzeige Logik
      let startPlatformHtml = '';
      if (i === 0 && fromTrack) {
          startPlatformHtml = `<span class="station-platform">Gl. ${fromTrack}</span>`;
      }
      let endPlatformHtml = '';
      if (i === res.segments.length - 1 && toTrack) {
          endPlatformHtml = `<span class="station-platform">Gl. ${toTrack}</span>`;
      }

      html += `
        <div class="station-row">
            <div class="station-dot start"></div>
            <div class="station-name">${s.from}${startPlatformHtml}</div>
        </div>
        
        <div class="connection-row segment-item" data-index="${i}">
            <div class="connection-line"></div>
            <div class="connection-card">
                <div class="stats-grid">
                    <div class="stat">
                        <span class="label">Distanz</span>
                        <span class="val">${distKm.toFixed(1)} km</span>
                    </div>
                    <div class="stat">
                        <span class="label">Dauer</span>
                        <span class="val">${timeText}</span>
                    </div>
                    <div class="stat">
                        <span class="label">Ø Speed</span>
                        <span class="val">${avgSpeed} km/h</span>
                    </div>
                    <div class="stat">
                        <span class="label">Max Speed</span>
                        <span class="val">${s.maxSpeed} km/h</span>
                    </div>
                </div>
                <details class="profile-details">
                    <summary>Geschwindigkeiten</summary>
                    <div class="profile-list">
                        ${profileRows}
                    </div>
                </details>
            </div>
        </div>

        ${i === res.segments.length - 1 ? `
        <div class="station-row">
            <div class="station-dot end"></div>
            <div class="station-name">${s.to}${endPlatformHtml}</div>
        </div>` : ''}
      `;
    });
    html += '</div>';
    tableWrap.innerHTML = html;

    // Click-Listener für Segmente hinzufügen
    tableWrap.querySelectorAll('.segment-item').forEach((item) => {
        item.addEventListener('click', () => {
            const index = item.getAttribute('data-index');
            const seg = res.segments[index];
            if (seg && seg.coords) {
                highlightLayer.clearLayers();
                const poly = L.polyline(seg.coords.map(p => [p[0], p[1]]), { color: '#ff9500', weight: 6, opacity: 1 }).addTo(highlightLayer);
                map.fitBounds(poly.getBounds(), { padding: [50, 50] });
            }
        });
    });

  } catch (err) {
    console.error(err);
    summaryDiv.textContent = 'Fehler bei der Routenberechnung.';
    tableWrap.innerHTML = '<p class="hint">Die Overpass-API konnte nicht erreicht werden. Bitte versuche es später erneut.</p>';
  }
});

// --- Startansicht BW ---
const bwBounds = [[47.45, 7.8], [49.8, 10.6]];
L.rectangle(bwBounds, { color: '0', weight: 1, fill: false }).addTo(map);
map.fitBounds(bwBounds);
