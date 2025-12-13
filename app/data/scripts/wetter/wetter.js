console.log("Auto weather loaded");

// --- Wettertext ---
const weatherText = code => ({
    0: 'Klarer Himmel', 1: 'Überwiegend klar', 2: 'Teilweise bewölkt', 3: 'Bewölkt',
    45: 'Nebel', 48: 'Reifnebel', 51: 'Leichter Nieselregen', 53: 'Mäßiger Nieselregen',
    55: 'Starker Nieselregen', 61: 'Leichter Regen', 63: 'Mäßiger Regen', 65: 'Starker Regen',
    71: 'Leichter Schneefall', 73: 'Mäßiger Schneefall', 75: 'Starker Schneefall', 77: 'Schneekörner',
    80: 'Leichte Regenschauer', 81: 'Mäßige Regenschauer', 82: 'Starke Regenschauer',
    85: 'Leichte Schneeschauer', 86: 'Starke Schneeschauer'
}[code] || 'Unbekannt');

// --- Icons ---
const iconForCode = c => {
    if (c === 0) return "☀️";
    if (c <= 2) return "🌤️";
    if (c === 3) return "☁️";
    if (c >= 45 && c <= 48) return "🌫️";
    if ((c >= 51 && c <= 67) || (c >= 80 && c <= 86)) return "🌧️";
    if (c >= 71 && c <= 77) return "❄️";
    return "☁️";
};

// --- Anzeige ---
function renderUnavailable() {
    document.getElementById('weather').style.display = 'block';
    document.getElementById('icon').textContent = "❌";
    document.getElementById('temp').textContent = "–";
    document.getElementById('text').textContent = "Nicht verfügbar";
}

// --- Wetter laden ---
async function loadWeather(lat, lon) {
    try {
        const r = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`
        );
        const j = await r.json();
        const cw = j.current_weather;

        if (!cw) return renderUnavailable();

        document.getElementById('weather').style.display = 'block';
        document.getElementById('icon').textContent = iconForCode(cw.weathercode);
        document.getElementById('temp').textContent = `${cw.temperature}°C`;
        document.getElementById('text').textContent = weatherText(cw.weathercode);

    } catch {
        renderUnavailable();
    }
}

// --- Auto-Start ---
window.addEventListener("load", () => {
    if (!navigator.geolocation) return renderUnavailable();

    navigator.geolocation.getCurrentPosition(
        p => loadWeather(p.coords.latitude, p.coords.longitude),
        () => renderUnavailable(),
        { timeout: 8000 }
    );
});
