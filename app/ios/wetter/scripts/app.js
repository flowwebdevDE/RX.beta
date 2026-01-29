console.log("app.js geladen!");

// ================= Wettercode Icons & Text =================
const weatherText = code => {
    const map = {
        0: 'Klarer Himmel', 1: 'Überwiegend klar', 2: 'Teilweise bewölkt', 3: 'Bewölkt',
        45: 'Nebel', 48: 'Reifnebel', 51: 'Leichter Nieselregen', 53: 'Mäßiger Nieselregen',
        55: 'Starker Nieselregen', 61: 'Leichter Regen', 63: 'Mäßiger Regen', 65: 'Starker Regen',
        71: 'Leichter Schneefall', 73: 'Mäßiger Schneefall', 75: 'Starker Schneefall', 77: 'Schneekörner',
        80: 'Leichte Regenschauer', 81: 'Mäßige Regenschauer', 82: 'Starke Regenschauer',
        85: 'Leichte Schneeschauer', 86: 'Starke Schneeschauer'
    };
    return map[code] || `Unbekannt (${code})`;
};

function wrap(x) { return `<svg class="icon" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">${x}</svg>`; }

const sun = () => wrap(`<circle cx="32" cy="32" r="14" fill="#FFDD57"/>`);
const moon = () => wrap(`<path d="M38 16a14 14 0 1 0 0 28 14 14 0 0 1 0-28z" fill="#FFDD57"/>`);
const partly = () => wrap(`<circle cx="22" cy="22" r="10" fill="#FFDD57"/><path d="M18 44h28a10 10 0 0 0 0-20 16 16 0 0 0-30 6 10 10 0 0 0 2 14z" fill="#ddd"/>`);
const partlyMoon = () => wrap(`<path d="M28 12a10 10 0 1 0 0 20 10 10 0 0 1 0-20z" fill="#FFDD57"/><path d="M18 44h28a10 10 0 0 0 0-20 16 16 0 0 0-30 6 10 10 0 0 0 2 14z" fill="#ddd"/>`);
const cloud = () => wrap(`<path d="M20 44h28a10 10 0 0 0 0-20 16 16 0 0 0-30 6 10 10 0 0 0 2 14z" fill="#ddd"/>`);
const fog = () => wrap(`<rect x="10" y="26" width="44" height="6" rx="3" fill="#ccc"/>
                        <rect x="8" y="34" width="48" height="6" rx="3" fill="#cccccc96"/>
                        <rect x="12" y="42" width="40" height="6" rx="3" fill="#ccc"/>`);
const rain = () => wrap(`<path d="M18 30h28a10 10 0 0 0 0-20 16 16 0 0 0-30 6 10 10 0 0 0 2 14z" fill="#ddd"/>
                         <g stroke="#4af" stroke-width="3" stroke-linecap="round">
                         <line x1="24" y1="38" x2="24" y2="52"/>
                         <line x1="32" y1="38" x2="32" y2="54"/>
                         <line x1="40" y1="38" x2="40" y2="52"/>
                         </g>`);
const snow = () => wrap(`<g stroke="#88c" stroke-width="3" stroke-linecap="round">
                          <line x1="32" y1="18" x2="32" y2="46"/>
                          <line x1="18" y1="32" x2="46" y2="32"/>
                          <line x1="22" y1="22" x2="42" y2="42"/>
                          <line x1="22" y1="42" x2="42" y2="22"/>
                          </g>`);

const uvIcon = () => wrap(`<circle cx="32" cy="32" r="14" fill="none" stroke="currentColor" stroke-width="4"/><path d="M32 4v8m0 40v8m26-26h-8M6 32h8m18.4-18.4l-5.6 5.6m-28.4 28.4l-5.6 5.6m0-28.4l5.6 5.6m28.4 28.4l-5.6-5.6" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>`);
const dropIcon = () => wrap(`<path d="M32 6c0 0-18 20-18 28a18 18 0 0 0 36 0c0-8-18-28-18-28z" fill="currentColor"/>`);
const eyeIcon = () => wrap(`<path d="M4 32s10-20 28-20 28 20 28 20-10 20-28 20S4 32 4 32z" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="32" cy="32" r="10" fill="currentColor"/>`);
const snowIconSmall = () => wrap(`<path d="M32 4v56M4 32h56M12 12l40 40M12 52L52 12" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>`);
const mountainIcon = () => wrap(`<path d="M32 8l-24 44h48L32 8z" fill="none" stroke="currentColor" stroke-width="4"/><path d="M32 8l8 16h-16l8-16z" fill="currentColor"/>`);
const gaugeIcon = () => wrap(`<circle cx="32" cy="32" r="24" fill="none" stroke="currentColor" stroke-width="4"/><path d="M32 32l14-14" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>`);

const iconForCode = (c, night) => {
    if (c === 0) return night ? moon() : sun();
    if (c <= 2) return night ? partlyMoon() : partly();
    if (c === 3) return cloud();
    if (c >= 45 && c <= 48) return fog();
    if ((c >= 51 && c <= 67) || (c >= 80 && c <= 86)) return rain();
    if (c >= 71 && c <= 77) return snow();
    return cloud();
};

// ================= Autocomplete =================
const sb = document.getElementById('searchBox');
const sug = document.getElementById('suggestionsList');
let last = "";

sb.addEventListener('input', async () => {
    const q = sb.value.trim(); 
    if (q.length < 2) { sug.innerHTML = ''; return; } 
    if (q === last) return; last = q;
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=de`;
    try {
        const r = await fetch(url); const j = await r.json(); sug.innerHTML = ''; if (!j.results) return;
        j.results.forEach(loc => {
            const d = document.createElement('div'); d.style.padding = '8px'; d.style.cursor = 'pointer';
            d.textContent = `${loc.name}, ${loc.country}`;
            d.onclick = () => { 
                sug.innerHTML = ''; 
                sb.value = d.textContent; 
                loadWeather(loc.latitude, loc.longitude, loc.name); 
                Specials.loadDashboard(loc.latitude, loc.longitude, loc.name);
            };
            sug.appendChild(d);
        });
    } catch (e) { console.error(e); }
});

// ================= Standort Button =================
document.getElementById('geoBtn').onclick = () => {
    navigator.geolocation.getCurrentPosition(p => {
        loadWeather(p.coords.latitude, p.coords.longitude, "Mein Standort");
        Specials.loadDashboard(p.coords.latitude, p.coords.longitude, "Mein Standort");
    }, () => alert("Standort nicht erlaubt"));
};

// ================= Wetter laden =================
async function loadWeather(lat, lon, label) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,sunrise,sunset&timezone=auto`;
    const r = await fetch(url); 
    const j = await r.json(); 
    render(j, lat, lon, label);
}

function render(data, lat, lon, label) {
    document.getElementById('weather').style.display = 'block';
    document.getElementById('placeName').textContent = label || `${lat.toFixed(3)},${lon.toFixed(3)}`;
    const cw = data.current_weather;
    document.getElementById('icon').innerHTML = iconForCode(cw.weathercode);
    document.getElementById('temp').innerHTML = `${cw.temperature}°C`;
    document.getElementById('currentSummary').innerHTML = `<strong>Wind: ${cw.windspeed} km/h<br>${weatherText(cw.weathercode)}</strong>`;

    const sunrise = data.daily.sunrise[0].split("T")[1];
    const sunset = data.daily.sunset[0].split("T")[1];

    // Details als Grid-Items für das neue Layout
    document.getElementById('details').innerHTML = `
        <div>
            <div style="font-size:12px; opacity:0.7; margin-bottom:4px;">Aufgang</div>
            ${sunrise}
        </div>
        <div>
            <div style="font-size:12px; opacity:0.7; margin-bottom:4px;">Untergang</div>
            ${sunset}
        </div>
    `;

    const grid = document.getElementById('forecastGrid'); 
    grid.innerHTML = '';
    grid.removeAttribute('style'); // WICHTIG: Inline-Styles entfernen, damit CSS greift

    for (let i = 0; i < data.daily.time.length; i++) {
        const day = document.createElement('div'); 
        day.className = 'day';
        const code = data.daily.weathercode[i];
        const dayName = new Date(data.daily.time[i]).toLocaleDateString('de-DE', { weekday: 'short' });
        day.innerHTML = `
            <div style="font-weight:600">${dayName}</div>
            <div class="icon">${iconForCode(code)}</div>
            <div>${weatherText(code)}</div>
            <div>${data.daily.temperature_2m_max[i]}°C / ${data.daily.temperature_2m_min[i]}°C</div>
            <div>${data.daily.precipitation_sum[i]} mm</div>`;
        grid.appendChild(day);
    }
    
    renderDailyOverview(lat, lon); // Tagesübersicht
}

// ================= Specials Dashboard =================
const Specials = {
    safeFetchJson: async function(url) {
        const res = await fetch(url);
        if (!res.ok) throw new Error("HTTP " + res.status);
        return await res.json();
    },
    getSpecialData: async function(lat, lon) {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=uv_index,pressure_msl,dewpoint_2m,visibility,snowfall,snow_height&timezone=auto`;
        return this.safeFetchJson(url);
    },
    getValue: function(arr) { return arr && arr.length ? arr[0] : "–"; },
    render: function(data, label) {
        const h = data.hourly || {};
        const html = `
            <ul style="list-style:none; padding:0; display:flex; flex-wrap:wrap; gap:10px;">
                <li style="display:none;">${uvIcon()} UV-Index <strong>${this.getValue(h.uv_index)}</strong></li>
                <li style="display:none;">${dropIcon()} Taupunkt <strong>${this.getValue(h.dewpoint_2m)}°C</strong></li>
                <li>${eyeIcon()} Sichtweite <strong>${this.getValue(h.visibility)} m</strong></li>
                <li style="display:none;">${snowIconSmall()} Schneefall <strong>${this.getValue(h.snowfall)} cm</strong></li>
                <li style="display:none;">${mountainIcon()} Schneehöhe <strong>${this.getValue(h.snow_height)} cm</strong></li>
                <li style="display:none;">${gaugeIcon()} Luftdruck <strong>${this.getValue(h.pressure_msl)} hPa</strong></li>
            </ul>
        `;
        const container = document.getElementById("specialParamsDashboard");
        if (container) container.innerHTML = html;
    },
    loadDashboard: async function(lat, lon, label) {
        const fallback = { latitude: 48.78, longitude: 9.18, label: "Stuttgart" };
        if (lat == null || lon == null) {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    async pos => await this._loadData(pos.coords.latitude, pos.coords.longitude, "Mein Standort"),
                    async () => await this._loadData(fallback.latitude, fallback.longitude, fallback.label)
                );
            } else {
                await this._loadData(fallback.latitude, fallback.longitude, fallback.label);
            }
        } else {
            await this._loadData(lat, lon, label);
        }
    },
    _loadData: async function(lat, lon, label) {
        try {
            const data = await this.getSpecialData(lat, lon);
            this.render(data, label);
        } catch (e) {
            console.error("Fehler beim Laden der Spezialdaten", e);
            const fallback = { latitude: 48.78, longitude: 9.18, label: "Stuttgart" };
            const data = await this.getSpecialData(fallback.latitude, fallback.longitude);
            this.render(data, fallback.label);
        }
    }
};

// ================= Auto-Start =================
window.addEventListener("load", () => {
    Specials.loadDashboard();
    navigator.geolocation.getCurrentPosition(
        p => loadWeather(p.coords.latitude, p.coords.longitude, "Mein Standort"),
        () => loadWeather(48.7758, 9.1829, "Stuttgart")
    );
});