// weather_extensions.js
// --- Zusätzliche Funktionen für erweiterte Wetteranzeige ---

// Prüft Fetch und speichert Cache
async function fetchWithCache(url, cacheKey) {
    try {
        const r = await fetch(url);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        const stamp = new Date().toLocaleString();
        localStorage.setItem(cacheKey, JSON.stringify({ data: j, stamp }));
        document.getElementById('offlineNotice').style.display = 'none';
        return j;
    } catch (e) {
        console.warn('Fetch fehlgeschlagen:', e);
        const cache = localStorage.getItem(cacheKey);
        if (cache) {
            const { data, stamp } = JSON.parse(cache);
            showOffline(stamp);
            return data;
        } else {
            alert('Offline und keine gespeicherten Daten verfügbar.');
            throw e;
        }
    }
}

// --- Render Charts ---
async function renderCharts(lat, lon) {
    const hourlyUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation,sunrise,sunset&timezone=auto`;
    const hourlyData = await fetchWithCache(hourlyUrl, 'hourlyWeatherCache');

    const container = document.getElementById('hourlyChartContainer');
    if (!container) return;
    container.innerHTML = `<canvas id="hourlyChart"></canvas>`;
    const ctx = document.getElementById('hourlyChart').getContext('2d');

    const labels = hourlyData.hourly.time.map(t => t.split('T')[1]);
    const tempData = hourlyData.hourly.temperature_2m;
    const rainData = hourlyData.hourly.precipitation;

    // Sonnenaufgang/-untergang als Markerpunkte
    const sunrisePoints = hourlyData.hourly.sunrise.map(s => s ? 1 : null);
    const sunsetPoints = hourlyData.hourly.sunset.map(s => s ? 1 : null);

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Temperatur (°C)',
                    data: tempData,
                    borderColor: 'orange',
                    backgroundColor: 'rgba(255,165,0,0.2)',
                    yAxisID: 'y',
                    tension: 0.3
                },
                {
                    label: 'Niederschlag (mm)',
                    data: rainData,
                    borderColor: 'blue',
                    backgroundColor: 'rgba(0,0,255,0.2)',
                    yAxisID: 'y1',
                    type: 'bar'
                },
                {
                    label: 'Sonnenaufgang',
                    data: sunrisePoints,
                    borderColor: 'yellow',
                    backgroundColor: 'rgba(255,255,0,0.1)',
                    yAxisID: 'y',
                    pointRadius: 5,
                    showLine: false
                },
                {
                    label: 'Sonnenuntergang',
                    data: sunsetPoints,
                    borderColor: 'red',
                    backgroundColor: 'rgba(255,0,0,0.1)',
                    yAxisID: 'y',
                    pointRadius: 5,
                    showLine: false
                }
            ]
        },
        options: {
            responsive: true,
            interaction: { mode: 'index', intersect: false },
            stacked: false,
            plugins: { legend: { position: 'top' } },
            scales: {
                y: { type: 'linear', position: 'left', title: { display: true, text: '°C' } },
                y1: { type: 'linear', position: 'right', title: { display: true, text: 'mm' }, grid: { drawOnChartArea: false } }
            }
        }
    });
}

// --- Offline Anzeige ---
function showOffline(timestamp) {
    const box = document.getElementById('offlineNotice');
    if (box) {
        box.style.display = 'block';
        box.textContent = `Offline-Modus – Datenstand: ${timestamp}`;
    }
}
