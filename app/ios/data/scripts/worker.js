// server/worker.js

export default {
  async fetch(request, env, ctx) {
    // 1. Immer CORS Header senden (verhindert Browser-Blockaden)
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // 2. Prüfen, ob Datenbank verbunden ist
    if (!env.SIGHTINGS_KV) {
      return new Response(JSON.stringify({ error: 'Setup-Fehler: KV Namespace nicht verbunden.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    try {
      if (request.method === 'GET') {
        return getSightings(request, env);
      }
      if (request.method === 'POST') {
        return postSighting(request, env);
      }
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Fallback für alles andere
    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },
};

// --- API-Funktionen ---
// Diese Funktionen sind jetzt so angepasst, dass sie die corsHeaders nutzen

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

async function getSightings(request, env) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');

  // 1. Nachrichten laden
  const sightingsJSON = await env.SIGHTINGS_KV.get('all');
  const sightings = sightingsJSON ? JSON.parse(sightingsJSON) : [];

  sightings.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  // 2. Online-Status Logik
  let onlineCount = 1;
  if (userId) {
    const now = Date.now();
    let activeUsers = {};
    try {
      const activeJSON = await env.SIGHTINGS_KV.get('active_users');
      if (activeJSON) activeUsers = JSON.parse(activeJSON);
    } catch (e) {}

    let needsWrite = false;
    
    // Nutzer aktualisieren (nur alle 10s schreiben, um KV-Limits zu schonen)
    if (!activeUsers[userId] || (now - activeUsers[userId] > 10000)) {
      activeUsers[userId] = now;
      needsWrite = true;
    }

    // Inaktive Nutzer entfernen (> 30s keine Aktivität)
    const threshold = now - 30000;
    for (const id in activeUsers) {
      if (activeUsers[id] < threshold) {
        delete activeUsers[id];
        needsWrite = true;
      }
    }
    onlineCount = Object.keys(activeUsers).length;

    if (needsWrite) await env.SIGHTINGS_KV.put('active_users', JSON.stringify(activeUsers));
  }

  // Rückgabe jetzt als Objekt mit Nachrichten UND Anzahl
  return new Response(JSON.stringify({ messages: sightings, onlineCount }), {
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

async function postSighting(request, env) {
  const { text, userId } = await request.json();

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return new Response(JSON.stringify({ error: 'Text fehlt.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const sightingsJSON = await env.SIGHTINGS_KV.get('all');
  let sightings = sightingsJSON ? JSON.parse(sightingsJSON) : [];

  const newSighting = { 
    id: Date.now(), 
    text: text.trim(), 
    userId: userId || 'anon', // Speichere die User-ID
    timestamp: new Date().toISOString() 
  };
  sightings.push(newSighting);

  // Begrenzung auf 50 Nachrichten (Beta)
  if (sightings.length > 50) sightings = sightings.slice(-50);

  await env.SIGHTINGS_KV.put('all', JSON.stringify(sightings));

  return new Response(JSON.stringify(newSighting), {
    status: 201,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}