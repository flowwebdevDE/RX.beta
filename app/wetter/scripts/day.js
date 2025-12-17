async function renderDailyOverview(lat, lon, sunriseStr, sunsetStr) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation,weathercode,windspeed_10m&timezone=auto`;
    const data = await fetchWithCache(url, 'hourlyWeatherCache');

    const grid = document.getElementById('hourlyForecastGrid');
    grid.innerHTML = '';

    // --- aktuelle Uhrzeit in Zeitzone bestimmen ---
    const timezone = data.timezone;
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: timezone }));

    // Stunden der API als Date-Objekte
    const times = data.hourly.time.map(t => new Date(t));

    // Startindex finden
    let startIndex = times.findIndex(t =>
        t.getFullYear() === now.getFullYear() &&
        t.getMonth() === now.getMonth() &&
        t.getDate() === now.getDate() &&
        t.getHours() === now.getHours()
    );

    if (startIndex === -1) {
        startIndex = times.findIndex(t => t > now);
    }

    if (startIndex === -1) startIndex = 0;

    // Sonnenzeiten der Hauptdaten als Date
    const sunrise = new Date(sunriseStr);
    const sunset = new Date(sunsetStr);

    // 24 Stunden anzeigen
    const endIndex = Math.min(startIndex + 24, times.length);

    for (let i = startIndex; i < endIndex; i++) {

        const hour = times[i];
        const hourStr = data.hourly.time[i].split("T")[1];

        // ---- NACHT LOGIK ----
        const night = (hour < sunrise || hour > sunset);

        const temp = data.hourly.temperature_2m[i];
        const rain = data.hourly.precipitation[i];
        const wind = data.hourly.windspeed_10m[i];
        const code = data.hourly.weathercode[i];

        const hourDiv = document.createElement('div');
        hourDiv.className = 'hour';

        hourDiv.innerHTML = `
            <div><strong>${hourStr}</strong></div>
            <div>${iconForCode(code, night)}</div>
            <div>${weatherText(code)}</div>
            <div>${temp}°C</div>
            <div>Wind: ${wind} km/h</div>
            <div>${rain} mm</div>
        `;

        grid.appendChild(hourDiv);
    }
}
