document.addEventListener('DOMContentLoaded', () => {
    const locationDisplay = document.getElementById('location-display');

    if (!locationDisplay) {
        console.error('Element with ID "location-display" not found.');
        return;
    }

    function updateDateTime() {
        const now = new Date();
        // Formatiere das Datum für die deutsche Anzeige (TT.MM.JJJJ)
        const date = now.toLocaleDateString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        // Formatiere die Zeit für die deutsche Anzeige (HH:MM)
        const time = now.toLocaleTimeString('de-DE', {
            hour: '2-digit',
            minute: '2-digit'
        });

        locationDisplay.textContent = `${date} • ${time}`;
    }

    // Rufe die Funktion sofort auf, um die Zeit anzuzeigen
    updateDateTime();
    // Aktualisiere die Zeit jede Sekunde
    setInterval(updateDateTime, 1000);
});