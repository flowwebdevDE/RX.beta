// data/scripts/sightings.js
document.addEventListener('DOMContentLoaded', () => {
    const messagesContainer = document.getElementById('chat-messages');
    const input = document.getElementById('sighting-input');
    const sendBtn = document.getElementById('send-btn');
    const statusText = document.getElementById('status-text');
    const notifyBtn = document.getElementById('notify-btn');
    const scrollBottomBtn = document.getElementById('scroll-bottom-btn');
    
    // Login Elemente
    const loginOverlay = document.getElementById('login-overlay');
    const accessCodeInput = document.getElementById('access-code');
    const loginBtn = document.getElementById('login-btn');
    const loginError = document.getElementById('login-error');

    // Deine Cloudflare Worker URL (funktioniert jetzt direkt ohne Unterpfad)
    const API_URL = 'https://sichtungen.red-dawn-bec6.workers.dev/';
    const ACCESS_CODE = 'preview'; // Der Code für den Zugang

    // --- 1. User ID & Login Logic ---
    let userId = localStorage.getItem('rx_user_id');
    if (!userId) {
        userId = 'user_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('rx_user_id', userId);
    }

    function checkAccess() {
        if (localStorage.getItem('rx_access_granted') === 'true') {
            loginOverlay.classList.add('hidden');
            startApp();
        }
    }

    loginBtn.addEventListener('click', () => {
        if (accessCodeInput.value.trim() === ACCESS_CODE) {
            localStorage.setItem('rx_access_granted', 'true');
            loginOverlay.classList.add('hidden');
            startApp();
        } else {
            loginError.style.display = 'block';
            vibrate();
        }
    });

    // --- 2. Notifications ---
    function setupNotifications() {
        if (Notification.permission === 'granted') {
            notifyBtn.classList.add('active');
        }
        
        notifyBtn.addEventListener('click', () => {
            Notification.requestPermission().then(perm => {
                if (perm === 'granted') {
                    notifyBtn.classList.add('active');
                    alert('Benachrichtigungen aktiviert!');
                }
            });
        });
    }

    // --- 3. App Logic ---
    let knownIds = new Set();
    let isFirstLoad = true;

    // Funktion zum Abrufen und Anzeigen von Sichtungen
    async function fetchSightings() {
        try {
            // userId mitsenden für Online-Status
            const response = await fetch(`${API_URL}?userId=${userId}`);
            if (!response.ok) {
                throw new Error('Netzwerk-Antwort war nicht ok.');
            }
            
            const data = await response.json();
            let sightings = [];
            
            // Neue Struktur verarbeiten ({ messages: [], onlineCount: 1 })
            if (data.messages) {
                sightings = data.messages;
                statusText.textContent = `Online • ${data.onlineCount} Nutzer`;
            } else {
                sightings = data; // Fallback falls Server noch alt ist
                statusText.textContent = 'Online';
            }

            // Platzhalter entfernen oder anzeigen
            if (sightings.length > 0) {
                const placeholder = messagesContainer.querySelector('p.meta');
                if (placeholder && placeholder.textContent.includes('Noch keine')) {
                    messagesContainer.innerHTML = '';
                }
            } else if (knownIds.size === 0) {
                messagesContainer.innerHTML = '<p class="meta" style="text-align: center;">Noch keine Sichtungen vorhanden. Sei der Erste!</p>';
                return;
            }

            let addedNew = false;
            sightings.forEach(sighting => {
                if (!knownIds.has(sighting.id)) {
                    addSightingToDOM(sighting);
                    knownIds.add(sighting.id);
                    addedNew = true;

                    // Notification logic: Nur wenn nicht erster Load und nicht eigene Nachricht
                    if (!isFirstLoad && sighting.userId !== userId && Notification.permission === 'granted') {
                        new Notification("Neue Zugsichtung", { body: sighting.text, icon: 'data/images/logos/logo.png' });
                    }
                }
            });

            if (addedNew || isFirstLoad) {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
            
            isFirstLoad = false;
        } catch (error) {
            console.error('Fehler beim Abrufen der Sichtungen:', error);
            statusText.textContent = 'Verbindungsproblem...';
        }
    }

    // Funktion zum Hinzufügen einer einzelnen Sichtung zum DOM
    function addSightingToDOM(sighting) {
        const sightingDiv = document.createElement('div');
        
        // Unterscheidung: Eigene vs. Fremde Nachricht
        const isOwn = sighting.userId === userId;
        sightingDiv.className = `sighting ${isOwn ? 'own' : 'other'}`;

        const contentP = document.createElement('p');
        contentP.className = 'content';
        contentP.textContent = sighting.text;

        const metaP = document.createElement('p');
        metaP.className = 'meta';
        // Formatiere das Datum leserlich
        const date = new Date(sighting.timestamp);
        metaP.textContent = date.toLocaleString('de-DE', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit'
        });

        sightingDiv.appendChild(contentP);
        sightingDiv.appendChild(metaP);
        messagesContainer.appendChild(sightingDiv);
    }

    // Funktion zum Senden einer neuen Sichtung
    async function postSighting() {
        const text = input.value.trim();
        if (text === '') {
            return;
        }

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text: text, userId: userId }),
            });

            if (!response.ok) {
                throw new Error('Sichtung konnte nicht gesendet werden.');
            }

            const newSighting = await response.json();
            
            if (!knownIds.has(newSighting.id)) {
                addSightingToDOM(newSighting);
                knownIds.add(newSighting.id);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
            input.value = ''; // Leere das Eingabefeld
        } catch (error) {
            console.error('Fehler beim Senden der Sichtung:', error);
            alert('Fehler: Deine Sichtung konnte nicht gesendet werden.');
        }
    }

    // Event Listeners
    sendBtn.addEventListener('click', postSighting);
    input.addEventListener('keypress', (e) => e.key === 'Enter' && postSighting());

    // Scroll-to-Bottom Button Logik
    messagesContainer.addEventListener('scroll', () => {
        const isNearBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 100;
        if (isNearBottom) {
            scrollBottomBtn.classList.add('hidden');
        } else {
            scrollBottomBtn.classList.remove('hidden');
        }
    });

    scrollBottomBtn.addEventListener('click', () => {
        messagesContainer.scrollTo({ top: messagesContainer.scrollHeight, behavior: 'smooth' });
    });

    function startApp() {
        setupNotifications();
        fetchSightings();
        setInterval(fetchSightings, 2000); // Alle 2 Sekunden prüfen (Echtzeit-Feeling)
    }

    checkAccess(); // Startpunkt
});