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
function renderUnavailable() {
  document.getElementById('icon').className = "wi wi-na";
  document.getElementById('temp').textContent = "–";
  document.getElementById('text').textContent = "Kein Standortzugriff";
}

// --- Wetter laden für bestimmte Koordinaten ---
async function loadWeather(lat, lon) {
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`);
    const data = await res.json();
    const cw = data.current_weather;
    if (!cw) return renderUnavailable();

    document.getElementById('icon').className = `wi ${iconForCode(cw.weathercode)}`;
    document.getElementById('temp').textContent = `${Math.round(cw.temperature)}°C`;
    document.getElementById('text').textContent = weatherText(cw.weathercode);

  } catch (err) {
    console.error(err);
    renderUnavailable();
  }
}

// --- Position abrufen und Wetter updaten ---
function updateWeather() {
  if (!navigator.geolocation) return renderUnavailable();

  navigator.geolocation.getCurrentPosition(
    pos => loadWeather(pos.coords.latitude, pos.coords.longitude),
    () => renderUnavailable()
  );
}

// --- Auto-Start und wiederholtes Laden alle 20 Sekunden ---
window.addEventListener("load", () => {
  updateWeather(); // einmalig beim Laden
  setInterval(updateWeather, 20000); // alle 20 Sekunden
});