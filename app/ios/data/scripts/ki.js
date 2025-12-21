// scripts/ki.js

// -----------------------------
// 🟢 Leaflet Map
// -----------------------------
const map = L.map('map').setView([50.490, 10.070], 6.5)

  L.maplibreGL({
    style: 'https://tiles.openfreemap.org/styles/liberty',
  }).addTo(map)
const routeLayer = L.layerGroup().addTo(map);
const stationLayer = L.layerGroup().addTo(map);

// -----------------------------
// 🟢 Chat UI
// -----------------------------
const chatMessages = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

function addMessage(text, sender='bot'){
  const div = document.createElement('div');
  div.className = `msg ${sender}`;
  div.textContent = text;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// -----------------------------
// 🟢 Hilfsfunktionen
// -----------------------------
function haversine(a, b) {
  const R = 6371000;
  const toRad = x => x * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat), lat2 = toRad(b.lat);
  const sinDlat = Math.sin(dLat / 2), sinDlon = Math.sin(dLon / 2);
  const c = 2 * Math.atan2(
    Math.sqrt(sinDlat*sinDlat + Math.cos(lat1)*Math.cos(lat2)*sinDlon*sinDlon),
    Math.sqrt(1-(sinDlat*sinDlat + Math.cos(lat1)*Math.cos(lat2)*sinDlon*sinDlon))
  );
  return R * c;
}

class PQ {
  constructor() { this._items = []; }
  push(item, pr) { this._items.push({item,pr}); this._items.sort((a,b)=>a.pr-b.pr); }
  pop() { return this._items.shift()?.item; }
  empty() { return this._items.length === 0; }
}

function dijkstra(graph, startId, endId, trainVmax_kmh) {
  const dist = {}, prev = {}, pq = new PQ();
  Object.keys(graph.nodes).forEach(id=>dist[id]=Infinity);
  dist[startId]=0;
  pq.push(startId,0);

  while(!pq.empty()) {
    const u = pq.pop();
    if(u===endId) break;
    const edges = graph.edges[u]||[];
    for(const e of edges){
      const edgeV = e.maxspeed?Math.min(trainVmax_kmh,e.maxspeed):trainVmax_kmh;
      const timeSeconds = (e.len_m/1000)/edgeV*3600;
      const alt = dist[u]+timeSeconds;
      if(alt<dist[e.v]){
        dist[e.v]=alt;
        prev[e.v]={from:u,edge:e};
        pq.push(e.v,alt);
      }
    }
  }

  if(!prev[endId]) return null;
  const path = [];
  let cur=endId;
  while(cur!==startId){
    const p = prev[cur];
    path.push({to:cur,from:p.from,edge:p.edge});
    cur=p.from;
  }
  path.reverse();
  return {path,time_s:dist[endId]};
}

// -----------------------------
// 🟢 Stationsdaten
// -----------------------------
let stationData = [];

async function loadStations() {
  try {
    const res = await fetch('./data/DE_stations.json');
    if (!res.ok) throw new Error(`HTTP-Fehler! Status: ${res.status}`);
    const js = await res.json();
    if(js.elements) {
      stationData = js.elements
        .filter(el => el.type==="node" && el.tags && el.tags.name)
        .map(el => ({
          id: el.id,
          lat: el.lat,
          lon: el.lon,
          name: el.tags.name,
          ds100: el.tags["railway:ref"] || "",
          display: el.tags["railway:ref"] || el.tags.name,
          tags: el.tags
        }));
      addMessage(`✅ ${stationData.length} Betriebstellen in Deutschland geladen.`, 'bot');
      addMessage(`Gebe eine Route ein. z.B.(RK nach TS über TBM um 13:00 mit 160)`, 'bot')
    }
  } catch (error) {
    console.error("Fehler beim Laden der Stationsdaten:", error);
    addMessage("❌ Fehler: Die Stationsdaten konnten nicht geladen werden. Die Anwendung ist nicht funktionsfähig.", 'bot');
  }
}

function findStation(query){
  const q = query.toLowerCase();
  let station = stationData.find(s => s.ds100.toLowerCase() === q);
  if(station) return station;
  return stationData.find(s => s.name.toLowerCase().includes(q));
}

// -----------------------------
// 🟢 Overpass & Graph
// -----------------------------
function bboxFromPoints(points, pad_km=15){
  let minLat=90,maxLat=-90,minLon=180,maxLon=-180;
  for(const p of points){
    if(p.lat<minLat) minLat=p.lat;
    if(p.lat>maxLat) maxLat=p.lat;
    if(p.lon<minLon) minLon=p.lon;
    if(p.lon>maxLon) maxLon=p.lon;
  }
  const padDeg = pad_km/111;
  return [minLat-padDeg,minLon-padDeg,maxLat+padDeg,maxLon+padDeg];
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter'
];

async function fetchRailNetwork(bbox){
  const [s,w,n,e] = bbox;
  const q = `[out:json][timeout:60];(way["railway"~"^(rail|railway)$"](${s},${w},${n},${e}); >;); out body;`;
  const maxRetries = 2;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        //addMessage(`Lade Netzwerkdaten... (Versuch ${attempt}/${maxRetries} von ${new URL(endpoint).hostname})`, 'bot');
        const res = await fetch(endpoint, { method: 'POST', body: q, headers: { 'Content-Type': 'text/plain' } });
        if (!res.ok) throw new Error(`HTTP-Status: ${res.status}`);
        const js = await res.json();
        // Wenn wir hier sind, war die Anfrage erfolgreich.
        if (!js.elements || js.elements.length === 0) return { nodes: {}, ways: {} };
        return buildNodesAndWaysFromElements(js.elements); // Aufbereiten und zurückgeben
      } catch (error) {
        console.warn(`Fehler bei Anfrage an ${new URL(endpoint).hostname} (Versuch ${attempt}):`, error.message);
        if (attempt === maxRetries) continue; // Versuche den nächsten Server, wenn der letzte Versuch fehlschlägt
        await new Promise(resolve => setTimeout(resolve, 1500)); // Warte 1.5s vor dem nächsten Versuch
      }
    }
  }

  // Wenn alle Endpunkte und Versuche fehlschlagen
  throw new Error("Konnte keine Netzwerkdaten von den Overpass-Servern abrufen.");
}

function buildNodesAndWaysFromElements(elements) {
  const nodes = {}, ways = {};
  for (const el of elements) {
    if (el.type === 'node') nodes[el.id] = { id: el.id, lat: el.lat, lon: el.lon };
    if (el.type === 'way') ways[el.id] = el;
  }
  return { nodes, ways };
}

function buildGraph(nodes,ways){
  const graph={nodes:{},edges:{}};
  for(const nid in nodes) graph.nodes[nid] = { ...nodes[nid] };

  function addEdge(u,v,len,wayid,maxspeed){
    if(!graph.edges[u]) graph.edges[u]=[];
    graph.edges[u].push({v,len_m:len,wayid,maxspeed});
  }

  for(const wid in ways){
    const w = ways[wid];
    const nds = w.nodes;
    let maxspeed = null;
    if(w.tags && w.tags.maxspeed){
      const parsed=parseInt(w.tags.maxspeed);
      if(!isNaN(parsed)) maxspeed=parsed;
    }
    for(let i=0;i<nds.length-1;i++){
      const a = nodes[nds[i]], b = nodes[nds[i+1]];
      if(!a||!b) continue;
      const len = haversine(a,b);
      addEdge(String(a.id),String(b.id),len,wid,maxspeed);
      addEdge(String(b.id),String(a.id),len,wid,maxspeed);
    }
  }
  return graph;
}

function findNearestNode(nodes,lat,lon){
  let best=null,bestd=Infinity;
  for(const id in nodes){
    const n=nodes[id];
    const d=haversine({lat:n.lat,lon:n.lon},{lat,lon});
    if(d<bestd){bestd=d;best=n;}
  }
  return best;
}

async function computeRouteWithGraph(points,trainVmax){
  // 1. Großen Graphen für die gesamte Route bauen
  const bbox = bboxFromPoints(points, 25); // Größerer Puffer für die Gesamtroute
  addMessage('Lade Gleisdaten für die gewünschte Route...', 'bot');
  const { nodes, ways } = await fetchRailNetwork(bbox);
  if (Object.keys(nodes).length === 0) {
    throw new Error('Keine Schienendaten im ausgewählten Bereich gefunden.');
  }
  //addMessage('Netzwerkdaten geladen, baue Routen-Graph...', 'bot');
  const graph = buildGraph(nodes, ways);
  //addMessage('Graph erstellt, berechne die Abschnitte...', 'bot');

  // 2. Pfade für einzelne Segmente auf dem großen Graphen berechnen
  let segmentResults=[], totalTimeSec=0, totalLen=0, fullPolyline=[];
  for(let i=0;i<points.length-1;i++){
    const a=points[i], b=points[i+1];

    const na = findNearestNode(nodes, a.lat, a.lon);
    const nb = findNearestNode(nodes, b.lat, b.lon);
    if(!na||!nb) throw new Error('Keine Schienendaten im Ausschnitt gefunden.');

    const res = dijkstra(graph,String(na.id),String(nb.id),trainVmax);
    if(!res) throw new Error(`Kein Pfad zwischen ${a.display} und ${b.display} gefunden.`);

    const segCoords = [];
    for(const step of res.path){
      const to = step.to;
      segCoords.push([nodes[to].lat, nodes[to].lon]);
    }
    // Sicherstellen, dass der Startpunkt des Segments am Anfang steht
    segCoords.unshift([nodes[na.id].lat, nodes[na.id].lon]);

    let segLen=0;
    for(let k=0;k<segCoords.length-1;k++)
      segLen+=haversine({lat:segCoords[k][0],lon:segCoords[k][1]},{lat:segCoords[k+1][0],lon:segCoords[k+1][1]});

    totalTimeSec+=res.time_s;
    totalLen+=segLen;
    fullPolyline.push(...segCoords);
    // Entferne den letzten Punkt, wenn es nicht das letzte Segment ist, um Duplikate zu vermeiden
    if (i < points.length - 2) {
      fullPolyline.pop();
    }
    segmentResults.push({from:a.display,to:b.display,time_s:res.time_s,len_m:segLen});
  }

  return {segments:segmentResults,totalTime_s:totalTimeSec,totalLen_m:totalLen,polyline:fullPolyline};
}

// -----------------------------
// 🟢 Parsing Chat & Zwischenpunkte
// -----------------------------

// Globale Variable, um den Kontext der letzten Route zu speichern
let lastRouteContext = {
  from: null,
  to: null,
  via: [],
  time: null,
  vmax: 120
};
async function handleUserMessage(text){
  addMessage(text,'user');

  // Regex: von START nach ZIEL über P1 über P2 ... um HH:MM
  const regex = /(\S+)\s+nach\s+(\S+)((?:\s+über\s+\S+)*)\s*(?:um\s+(\d{1,2}:\d{2}))?\s*(?:mit\s+(\d+))?/i;
  const m = text.match(regex);
  if(!m){
    // Wenn kein vollständiger Befehl, prüfe auf Kontext-Modifikatoren
    const mitMatch = text.match(/mit\s+(\d+)/i);
    const ueberMatch = text.match(/über\s+(\S+)/i);
    const umMatch = text.match(/um\s+(\d{1,2}:\d{2})/i);

    if (mitMatch || ueberMatch || umMatch) {
      if (!lastRouteContext.from || !lastRouteContext.to) {
        addMessage("Ich habe noch keinen Routenkontext. Bitte gib zuerst eine vollständige Route ein (z.B. 'A nach B').", 'bot');
        return;
      }
      if (mitMatch) lastRouteContext.vmax = parseInt(mitMatch[1], 10);
      if (umMatch) lastRouteContext.time = umMatch[1];
      if (ueberMatch) {
        const newVia = parseLocation(ueberMatch[1]);
        if (newVia) {
          lastRouteContext.via.push(newVia);
        } else {
          addMessage(`Zwischenpunkt '${ueberMatch[1]}' nicht gefunden.`, 'bot');
          return;
        }
      }
    } else {
      addMessage("Ich habe das nicht verstanden. Bitte im Format 'A nach B über C mit 160' schreiben oder den Kontext anpassen ('mit 200', 'über X').", 'bot');
      return;
    }
  } else {
    // Vollständiger Befehl wurde erkannt, Kontext neu aufbauen
    const [_, fromQ, toQ, viaStr, timeStr, vmaxStr] = m;
    const viaMatches = [...viaStr.matchAll(/\s+über\s+(\S+)/g)];
    const viaPointsRaw = viaMatches.map(v => v[1]);

    const fromStation = parseLocation(fromQ);
    const toStation = parseLocation(toQ);
    const viaPoints = viaPointsRaw.map(parseLocation);

    if (!fromStation || !toStation || viaPoints.some(v => v === null)) {
      addMessage("Ein Punkt konnte nicht gefunden werden. Prüfe DS100, Name oder Koordinaten.", 'bot');
      return;
    }

    // Kontext aktualisieren
    lastRouteContext = {
      from: fromStation,
      to: toStation,
      via: viaPoints,
      time: timeStr || null,
      vmax: vmaxStr ? parseInt(vmaxStr, 10) : 120
    };
  }

  const { from, to, via, time, vmax } = lastRouteContext;
  const allPoints = [from, ...via, to];

  let routeMsg = `Berechne Route von ${from.display} nach ${to.display}`;
  if (via.length > 0) {
    routeMsg += ` über ${via.map(p => p.display).join(', ')}`;
  }
  routeMsg += ` mit max. ${vmax} km/h.`;
  addMessage(routeMsg, 'bot');

  try{
    routeLayer.clearLayers();
    stationLayer.clearLayers();

    // Marker setzen
    allPoints.forEach(p=>{
      L.marker([p.lat,p.lon],{title:p.display}).addTo(stationLayer).bindPopup(p.display);
    });

    const res = await computeRouteWithGraph(allPoints,vmax);

    // Polyline auf der Hauptkarte
    const poly = L.polyline(res.polyline,{weight:3,color:'#020095ff'}).addTo(routeLayer);
    map.fitBounds(poly.getBounds(),{padding:[40,40]});

    // Mini-Map für mobile Ansicht
    if (typeof showMiniMap === "function") {
      showMiniMap(res.polyline);
    }

    const total_h = Math.floor(res.totalTime_s/3600);
    const total_min = Math.round((res.totalTime_s%3600)/60);
    let msg = `Route: ${(res.totalLen_m/1000).toFixed(1)} km — Fahrzeit: ${total_h}h ${total_min}min (bei ${vmax} km/h)`;
    if(time){
      const [hh,mm] = time.split(':').map(Number);
      const dep=new Date(); dep.setHours(hh,mm,0,0);
      const arr=new Date(dep.getTime()+res.totalTime_s*1000);
      msg += ` — Ankunft: ${arr.getHours()}:${arr.getMinutes().toString().padStart(2,'0')}`;
    }

    if(via.length>0){
      msg += `\nZwischenpunkte: ${via.map(v=>v.display).join(', ')}`;
    }

    addMessage(msg,'bot');

  } catch(err){
    console.error(err);
    addMessage(`Fehler: ${err.message || 'Bei der Berechnung ist ein unbekannter Fehler aufgetreten.'}`,'bot');
  }
}

function parseLocation(q){
  const coordMatch = q.match(/^(\d+(\.\d+)?),(\d+(\.\d+)?)$/);
  if(coordMatch){
    return { lat: parseFloat(coordMatch[1]), lon: parseFloat(coordMatch[3]), display: q };
  }
  const station = findStation(q);
  if(station) return station;
  return null;
}

// -----------------------------
// 🟢 Event Listener
// -----------------------------
sendBtn.addEventListener('click',()=>{
  const val = userInput.value.trim();
  if(val) handleUserMessage(val);
  userInput.value='';
});
userInput.addEventListener('keypress',e=>{
  if(e.key==='Enter') sendBtn.click();
});

// -----------------------------
// 🟢 Start
// -----------------------------
loadStations();

// Hinweis: kein await außerhalb async-Funktionen mehr nötig
// Mini-Map wird nur innerhalb von handleUserMessage() erzeugt
