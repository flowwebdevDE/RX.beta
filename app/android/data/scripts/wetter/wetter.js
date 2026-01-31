console.log("Weather widget loaded");

// --- Mapping Wettercodes zu Text ---
const weatherText = code => ({
  0: 'Klarer Himmel',
  1: 'Überwiegend klar',
  2: 'Teilweise bewölkt',
  3: 'Bewölkt',
  45: 'Nebel',
  48: 'Reifnebel',
  51: 'Leichter Nieselregen',
  53: 'Mäßiger Nieselregen',
  55: 'Starker Nieselregen',
  61: 'Leichter Regen',
  63: 'Mäßiger Regen',
  65: 'Starker Regen',
  71: 'Leichter Schneefall',
  73: 'Mäßiger Schneefall',
  75: 'Starker Schneefall',
  77: 'Schneekörner',
  80: 'Leichte Regenschauer',
  81: 'Mäßige Regenschauer',
  82: 'Starke Regenschauer',
  85: 'Leichte Schneeschauer',
  86: 'Starke Schneeschauer'
}[code] || 'Unbekannt');

// --- Mapping Wettercodes zu Weather Icons ---
const iconForCode = c => {
  if (c === 0) return "wi-day-sunny";
  if (c === 1) return "wi-day-sunny-overcast";
  if (c === 2) return "wi-day-cloudy";
  if (c === 3) return "wi-cloudy";
  if (c === 45 || c === 48) return "wi-fog";
  if (c >= 51 && c <= 55) return "wi-sprinkle";
  if (c >= 61 && c <= 65) return "wi-rain";
  if (c >= 66 && c <= 67) return "wi-rain-mix";
  if (c >= 71 && c <= 75) return "wi-snow";
  if (c === 77) return "wi-snowflake-cold";
  if (c >= 80 && c <= 82) return "wi-showers";
  if (c >= 85 && c <= 86) return "wi-snow-wind";
  return "wi-na";
};

// --- Fallback, falls Wetter nicht verfügbar ---
function renderUnavailable(msg) {
  const icon = document.getElementById('weather-icon');
  const temp = document.getElementById('weather-temp');
  const text = document.getElementById('weather-text');
  if(icon) icon.className = "wi wi-na";
  if(temp) temp.textContent = "–";
  if(text) text.textContent = msg || "Kein Standortzugriff";
}

// --- Wetter laden für bestimmte Koordinaten ---
async function loadWeather(lat, lon) {
  console.log(`Wetter-Widget: Lade Wetterdaten für ${lat}, ${lon}`);
  try {
    // 1. Wetterdaten laden (Kritisch)
    const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`);
    if (!weatherRes.ok) throw new Error("Wetter-API Fehler");
    const weatherData = await weatherRes.json();
    const cw = weatherData.current_weather;

    if (!cw) {
        renderUnavailable("Keine Daten");
        return;
    }

    // 2. Ortsnamen laden (Optional - darf fehlschlagen)
    let locationName = "Mein Standort";
    try {
        const latFixed = Number(lat).toFixed(4);
        const lonFixed = Number(lon).toFixed(4);
        
        // Liste der Geocoding-Dienste (Priorität: Open-Meteo -> BigDataCloud -> Nominatim)
        const providers = [
            {
                name: 'Open-Meteo',
                url: `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${latFixed}&longitude=${lonFixed}&count=1&language=de`,
                parse: async (r) => (await r.json()).results?.[0]?.name
            },
            {
                name: 'BigDataCloud',
                url: `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latFixed}&longitude=${lonFixed}&localityLanguage=de`,
                parse: async (r) => {
                    const d = await r.json();
                    return d.city || d.locality || d.principalSubdivision;
                }
            },
            {
                name: 'Nominatim',
                url: `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latFixed}&lon=${lonFixed}&zoom=10&accept-language=de`,
                parse: async (r) => {
                    const d = await r.json();
                    return d.address?.city || d.address?.town || d.address?.village || d.display_name?.split(',')[0];
                }
            }
        ];

        for (const provider of providers) {
            try {
                const res = await fetch(provider.url).catch(() => null);
                if (res && res.ok) {
                    const name = await provider.parse(res);
                    if (name) {
                        locationName = name;
                        console.log(`Wetter-Widget: Ortsname geladen via ${provider.name}: ${name}`);
                        break; // Erfolg -> Abbruch der Schleife
                    }
                }
            } catch (e) {
                console.warn(`Wetter-Widget: ${provider.name} fehlgeschlagen`, e);
            }
        }
    } catch (e) {
        console.warn("Wetter-Widget: Fehler im Geocoding-Block", e);
    }

    document.getElementById('weather-icon').className = `wi ${iconForCode(cw.weathercode)}`;
    document.getElementById('weather-temp').textContent = `${Math.round(cw.temperature)}°`;
    document.getElementById('weather-text').textContent = weatherText(cw.weathercode);
    document.getElementById('weather-location').textContent = locationName;

  } catch (err) {
    console.error(err);
    renderUnavailable("Verbindungsfehler");
  }
}

// --- Position abrufen und Wetter updaten ---
function updateWeather() {
  console.log("Wetter-Widget: Update gestartet");
  // Prüfen ob Standort in Einstellungen erlaubt ist
  if (window.getSettings) {
      const settings = window.getSettings();
      console.log("Wetter-Widget: Einstellungen geladen", settings);
      if (!settings.locationEnabled) {
          console.log("Wetter-Widget: Standortzugriff in Einstellungen deaktiviert");
          return renderUnavailable("Standort deaktiviert");
      }
  }

  if (!navigator.geolocation) {
      console.log("Wetter-Widget: Geolocation API nicht verfügbar");
      return renderUnavailable("Standort n.v.");
  }

  console.log("Wetter-Widget: Frage Standort ab...");
  navigator.geolocation.getCurrentPosition(
    pos => { console.log("Wetter-Widget: Standort erhalten", pos.coords); loadWeather(pos.coords.latitude, pos.coords.longitude); },
    err => { console.error("Wetter-Widget: Standort-Fehler", err); renderUnavailable("Standort verweigert"); }
  );
}

// --- Auto-Start und wiederholtes Laden alle 20 Sekunden ---
window.addEventListener("load", () => {
  updateWeather(); // einmalig beim Laden
  setInterval(updateWeather, 20000); // alle 20 Sekunden
});