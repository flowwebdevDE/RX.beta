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
  const sightingsJSON = await env.SIGHTINGS_KV.get('all');
  const sightings = sightingsJSON ? JSON.parse(sightingsJSON) : [];

  sightings.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  return new Response(JSON.stringify(sightings), {
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