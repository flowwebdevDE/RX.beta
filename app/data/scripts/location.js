document.addEventListener('DOMContentLoaded', () => {
    const locationDisplay = document.getElementById('location-display');
    let betriebsstellen = [];

    if (!locationDisplay) {
        console.error('Element with ID "location-display" not found.');
        return;
    }

    // Lade die Betriebsstellen-Daten
    fetch('data/stations_details.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Netzwerk-Antwort war nicht ok.');
            }
            return response.json();
        })
        .then(data => {
            betriebsstellen = data;
            // Starte die Standortverfolgung, nachdem die Daten geladen wurden
            startGeolocation();
        })
        .catch(error => {
            console.error('Fehler beim Laden der Betriebsstellen:', error);
            locationDisplay.textContent = 'Fehler: Betriebsstellen konnten nicht geladen werden.';
        });

    function startGeolocation() {
        if ('geolocation' in navigator) {
            navigator.geolocation.watchPosition(showPosition, showError, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            });
        } else {
            locationDisplay.textContent = 'Standortbestimmung wird von diesem Browser nicht unterstützt.';
        }
    }

    function showPosition(position) {
        const userLat = position.coords.latitude;
        const userLon = position.coords.longitude;

        if (betriebsstellen.length === 0) {
            locationDisplay.textContent = 'Warte auf Betriebsstellen-Daten...';
            return;
        }

        const nearest = findNearestBetriebsstelle(userLat, userLon);
        locationDisplay.textContent = `Aktuelle Betriebsstelle: ${nearest.name} (${nearest.kuerzel})`;
    }

    function showError(error) {
        switch (error.code) {
            case error.PERMISSION_DENIED:
                locationDisplay.textContent = 'Standortzugriff verweigert.';
                break;
            case error.POSITION_UNAVAILABLE:
                locationDisplay.textContent = 'Standortinformationen sind nicht verfügbar.';
                break;
            case error.TIMEOUT:
                locationDisplay.textContent = 'Timeout bei der Standortabfrage.';
                break;
            default:
                locationDisplay.textContent = 'Unbekannter Fehler bei der Standortabfrage.';
                break;
        }
    }

    function findNearestBetriebsstelle(lat, lon) {
        let closest = null;
        let minDistance = Infinity;

        for (const stelle of betriebsstellen) {
            const distance = Math.sqrt(Math.pow(stelle.lat - lat, 2) + Math.pow(stelle.lon - lon, 2));
            if (distance < minDistance) {
                minDistance = distance;
                closest = stelle;
            }
        }
        return closest;
    }
});