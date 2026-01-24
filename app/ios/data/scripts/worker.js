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
      const url = new URL(request.url);
      
      // Routing für Gruppen
      if (url.pathname === '/groups') {
        if (request.method === 'GET') return getGroups(request, env);
        if (request.method === 'POST') return createGroup(request, env);
      }

      if (request.method === 'GET') {
        return getSightings(request, env);
      }
      if (request.method === 'POST') {
        return postSighting(request, env);
      }
      if (request.method === 'PUT') {
        return editSighting(request, env);
      }
      if (request.method === 'DELETE') {
        return deleteSighting(request, env);
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
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// --- Gruppen Funktionen ---

async function getGroups(request, env) {
  const groupsJSON = await env.SIGHTINGS_KV.get('groups');
  const groups = groupsJSON ? JSON.parse(groupsJSON) : [];
  // Neueste Gruppen zuerst (oder alphabetisch, hier nach Erstellung)
  groups.sort((a, b) => {
    const timeA = a.lastMessageTime || a.createdAt;
    const timeB = b.lastMessageTime || b.createdAt;
    return new Date(timeB) - new Date(timeA);
  });
  return new Response(JSON.stringify(groups), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}

async function createGroup(request, env) {
  const { name } = await request.json();
  if (!name || !name.trim()) return new Response(JSON.stringify({ error: 'Name fehlt' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

  const groupsJSON = await env.SIGHTINGS_KV.get('groups');
  const groups = groupsJSON ? JSON.parse(groupsJSON) : [];

  const newGroup = { id: Date.now().toString(), name: name.trim(), createdAt: new Date().toISOString() };
  groups.push(newGroup);

  await env.SIGHTINGS_KV.put('groups', JSON.stringify(groups));
  return new Response(JSON.stringify(newGroup), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}


// --- Sichtungs Funktionen ---

async function getSightings(request, env) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');
  const groupId = url.searchParams.get('groupId');

  // 1. Nachrichten laden (pro Gruppe)
  const storageKey = groupId ? `sightings_${groupId}` : 'all'; // Fallback für alte Version
  const sightingsJSON = await env.SIGHTINGS_KV.get(storageKey);
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
  const { text, userId, groupId, replyTo, forwardedFrom } = await request.json();

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return new Response(JSON.stringify({ error: 'Text fehlt.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const storageKey = groupId ? `sightings_${groupId}` : 'all';
  const sightingsJSON = await env.SIGHTINGS_KV.get(storageKey);
  let sightings = sightingsJSON ? JSON.parse(sightingsJSON) : [];

  const newSighting = { 
    id: Date.now(), 
    text: text.trim(), 
    userId: userId || 'anon', // Speichere die User-ID
    replyTo: replyTo || null,
    forwardedFrom: forwardedFrom || null,
    timestamp: new Date().toISOString() 
  };
  sightings.push(newSighting);

  // Begrenzung auf 50 Nachrichten (Beta)
  if (sightings.length > 50) sightings = sightings.slice(-50);

  await env.SIGHTINGS_KV.put(storageKey, JSON.stringify(sightings));

  // Update Gruppen-Metadaten (Vorschau & Zeitstempel)
  if (groupId) {
    try {
      const groupsJSON = await env.SIGHTINGS_KV.get('groups');
      if (groupsJSON) {
        const groups = JSON.parse(groupsJSON);
        const idx = groups.findIndex(g => g.id === groupId);
        if (idx !== -1) {
          groups[idx].lastMessage = text.substring(0, 50);
          groups[idx].lastMessageTime = newSighting.timestamp;
          await env.SIGHTINGS_KV.put('groups', JSON.stringify(groups));
        }
      }
    } catch (e) { /* Ignore update errors */ }
  }

  return new Response(JSON.stringify(newSighting), {
    status: 201,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

async function editSighting(request, env) {
  const { groupId, id, userId, text } = await request.json();

  if (!groupId || !id || !userId || !text) {
     return new Response(JSON.stringify({ error: 'Daten fehlen.' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  const storageKey = `sightings_${groupId}`;
  const sightingsJSON = await env.SIGHTINGS_KV.get(storageKey);
  let sightings = sightingsJSON ? JSON.parse(sightingsJSON) : [];

  const index = sightings.findIndex(s => String(s.id) === String(id));
  if (index === -1) return new Response(JSON.stringify({ error: 'Nachricht nicht gefunden' }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

  if (sightings[index].userId !== userId) {
      return new Response(JSON.stringify({ error: 'Nicht autorisiert' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  sightings[index].text = text.trim();
  await env.SIGHTINGS_KV.put(storageKey, JSON.stringify(sightings));

  return new Response(JSON.stringify(sightings[index]), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}

async function deleteSighting(request, env) {
  const { groupId, id, userId } = await request.json();

  if (!groupId || !id || !userId) {
     return new Response(JSON.stringify({ error: 'Daten fehlen.' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  const storageKey = `sightings_${groupId}`;
  const sightingsJSON = await env.SIGHTINGS_KV.get(storageKey);
  let sightings = sightingsJSON ? JSON.parse(sightingsJSON) : [];

  const sighting = sightings.find(s => String(s.id) === String(id));
  if (!sighting) return new Response(JSON.stringify({ status: 'deleted' }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });

  if (sighting.userId !== userId) {
      return new Response(JSON.stringify({ error: 'Nicht autorisiert' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  sightings = sightings.filter(s => String(s.id) !== String(id));
  await env.SIGHTINGS_KV.put(storageKey, JSON.stringify(sightings));

  // Update Gruppen-Metadaten (Vorschau aktualisieren)
  try {
      const groupsJSON = await env.SIGHTINGS_KV.get('groups');
      if (groupsJSON) {
        const groups = JSON.parse(groupsJSON);
        const idx = groups.findIndex(g => g.id === groupId);
        if (idx !== -1) {
           if (sightings.length > 0) {
               const last = sightings[sightings.length - 1];
               groups[idx].lastMessage = last.text.substring(0, 50);
               groups[idx].lastMessageTime = last.timestamp;
           } else {
               groups[idx].lastMessage = '';
           }
           await env.SIGHTINGS_KV.put('groups', JSON.stringify(groups));
        }
      }
  } catch(e) {}

  return new Response(JSON.stringify({ status: 'deleted' }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}