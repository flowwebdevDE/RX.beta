// data/scripts/sightings.js
document.addEventListener('DOMContentLoaded', () => {
    const messagesContainer = document.getElementById('chat-messages');
    const input = document.getElementById('sighting-input');
    const sendBtn = document.getElementById('send-btn');
    const statusText = document.getElementById('status-text');
    const notifyBtn = document.getElementById('notify-btn');
    const scrollBottomBtn = document.getElementById('scroll-bottom-btn');
    
    // Views
    const groupsView = document.getElementById('groups-view');
    const chatView = document.getElementById('chat-view');
    const groupsList = document.getElementById('groups-list');
    const createGroupBtn = document.getElementById('create-group-btn');
    const backToGroupsBtn = document.getElementById('back-to-groups');
    const chatTitle = document.getElementById('chat-title');
    const groupSearchInput = document.getElementById('group-search-input');
    const chatSearchToggle = document.getElementById('chat-search-toggle');
    const chatSearchBar = document.getElementById('chat-search-bar');
    const chatSearchInput = document.getElementById('chat-search-input');
    const refreshBtn = document.getElementById('refresh-btn');

    // Reply Preview Elemente
    
    const replyPreview = document.getElementById('reply-preview');
    const replyPreviewText = document.getElementById('reply-preview-text');
    const cancelReplyBtn = document.getElementById('cancel-reply-btn');

    // Login Elemente
    const replyPreviewSender = document.getElementById('reply-preview-sender');
    const replyPreviewTimestamp = document.getElementById('reply-preview-timestamp');
    const loginOverlay = document.getElementById('login-overlay');
    const accessCodeInput = document.getElementById('access-code');
    const loginBtn = document.getElementById('login-btn');
    const loginError = document.getElementById('login-error');

    // Custom Popup Elemente
    const customPopupOverlay = document.getElementById('custom-popup-overlay');
    const popupMessage = document.getElementById('popup-message');
    const popupCloseBtn = document.getElementById('popup-close-btn');

    // Confirm Overlay Elemente
    const confirmOverlay = document.getElementById('confirm-overlay');
    const confirmMessage = document.getElementById('confirm-message');
    const confirmYesBtn = document.getElementById('confirm-yes-btn');
    const confirmNoBtn = document.getElementById('confirm-no-btn');

    // Message Options Elemente
    const msgOptionsOverlay = document.getElementById('message-options-overlay');
    const optMsgSender = document.getElementById('opt-msg-sender');
    const optMsgTime = document.getElementById('opt-msg-time');
    const optMsgText = document.getElementById('opt-msg-text');
    const optBtnReply = document.getElementById('opt-btn-reply');
    const optBtnCopy = document.getElementById('opt-btn-copy');
    const optBtnForward = document.getElementById('opt-btn-forward');
    const optBtnEdit = document.getElementById('opt-btn-edit');
    const optBtnDelete = document.getElementById('opt-btn-delete');
    const optBtnCancel = document.getElementById('opt-btn-cancel');

    // Create Group Modal Elemente
    const createGroupOverlay = document.getElementById('create-group-overlay');
    const newGroupNameInput = document.getElementById('new-group-name');
    const confirmGroupBtn = document.getElementById('confirm-group-btn');
    const cancelGroupBtn = document.getElementById('cancel-group-btn');

    // Forward Overlay
    const forwardOverlay = document.getElementById('forward-overlay');
    const forwardGroupsList = document.getElementById('forward-groups-list');
    const forwardCancelBtn = document.getElementById('forward-cancel-btn');

    // Forward Confirm Overlay
    const forwardConfirmOverlay = document.getElementById('forward-confirm-overlay');
    const forwardTargetName = document.getElementById('forward-target-name');
    const forwardPreviewContent = document.getElementById('forward-preview-content');
    const forwardCommentInput = document.getElementById('forward-comment-input');
    const forwardConfirmSend = document.getElementById('forward-confirm-send');
    const forwardConfirmCancel = document.getElementById('forward-confirm-cancel');

    // Deine Cloudflare Worker URL (funktioniert jetzt direkt ohne Unterpfad)
    const API_URL = 'https://sichtungen.red-dawn-bec6.workers.dev/';
    const ACCESS_CODE = 'premium'; // Der Code für den Zugang

    // --- 1. User ID & Login Logic ---
    let userId = localStorage.getItem('rx_user_id');
    if (!userId) {
        userId = 'user_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('rx_user_id', userId);
    }

    // Local Storage State für Features
    let pinnedGroups = JSON.parse(localStorage.getItem('rx_pinned_groups') || '[]');
    let readStatus = JSON.parse(localStorage.getItem('rx_read_status') || '{}');

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

    // --- Custom Popup Logic ---
    function showPopup(msg) {
        if (window.showNotification) {
            window.showNotification('Info', msg);
        } else {
            popupMessage.textContent = msg;
            customPopupOverlay.classList.remove('hidden');
        }
    }

    popupCloseBtn.addEventListener('click', () => {
        customPopupOverlay.classList.add('hidden');
    });

    // --- Confirm Logic ---
    let onConfirmYes = null;
    function showConfirm(msg, onYes) {
        confirmMessage.textContent = msg;
        onConfirmYes = onYes;
        confirmOverlay.classList.remove('hidden');
    }
    confirmYesBtn.addEventListener('click', () => {
        if (onConfirmYes) onConfirmYes();
        confirmOverlay.classList.add('hidden');
        onConfirmYes = null;
    });
    confirmNoBtn.addEventListener('click', () => {
        confirmOverlay.classList.add('hidden');
        onConfirmYes = null;
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
                    showPopup('Benachrichtigungen aktiviert!');
                }
            });
        });
    }

    // --- 3. App Logic ---
    let knownIds = new Set();
    let isFirstLoad = true;
    let lastRenderedDate = null;
    let currentGroupId = null;
    let pollInterval = null;
    let currentReply = null;
    let editingMessageId = null; // ID der Nachricht, die gerade bearbeitet wird
    let cachedGroups = []; // Speichert alle Gruppen für schnellen Zugriff

    // --- Gruppen Logik ---

    async function fetchGroups() {
        try {
            const response = await fetch(API_URL + 'groups');
            if (!response.ok) throw new Error('Fehler beim Laden der Gruppen');
            const groups = await response.json();
            cachedGroups = groups; // Cache aktualisieren
            renderGroups(groups);
        } catch (error) {
            console.error(error);
            groupsList.innerHTML = '<p style="padding:20px; text-align:center; color:gray;">Konnte Gruppen nicht laden.</p>';
        }
    }

    function renderGroups(groups) {
        const searchTerm = groupSearchInput.value.toLowerCase();
        
        // 1. Filtern
        let filtered = groups.filter(g => g.name.toLowerCase().includes(searchTerm));

        // 2. Sortieren: Angepinnte zuerst, dann nach Zeit
        filtered.sort((a, b) => {
            const isPinnedA = pinnedGroups.includes(a.id);
            const isPinnedB = pinnedGroups.includes(b.id);
            if (isPinnedA && !isPinnedB) return -1;
            if (!isPinnedA && isPinnedB) return 1;
            
            const timeA = a.lastMessageTime || a.createdAt;
            const timeB = b.lastMessageTime || b.createdAt;
            return new Date(timeB) - new Date(timeA);
        });

        groupsList.innerHTML = '';
        if (filtered.length === 0) {
            groupsList.innerHTML = '<p style="padding:20px; text-align:center; color:gray;">Keine Gruppen gefunden.</p>';
            return;
        }
        filtered.forEach(group => {
            // Zeit formatieren
            let timeDisplay = '';
            if (group.lastMessageTime) {
                const date = new Date(group.lastMessageTime);
                const now = new Date();
                if (date.toDateString() === now.toDateString()) {
                    timeDisplay = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                } else {
                    timeDisplay = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
                }
            }

            // Ungelesen Status prüfen
            const lastMsgTime = group.lastMessageTime ? new Date(group.lastMessageTime).getTime() : 0;
            const lastRead = readStatus[group.id] || 0;
            const isUnread = lastMsgTime > lastRead;
            const isPinned = pinnedGroups.includes(group.id);

            const div = document.createElement('div');
            div.className = 'group-item';
            div.innerHTML = `
                <div class="group-icon">
                    ${group.name.substring(0,2).toUpperCase()}
                </div>
                <div class="group-info">
                    <div class="group-header">
                        <span class="group-name">${group.name}</span>
                        <span class="group-time">${timeDisplay}</span>
                    </div>
                    <div class="group-preview">${group.lastMessage || 'Keine Nachrichten'}</div>
                </div>
                ${isPinned ? '<div class="pinned-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M16 12V4H8v8l-2 2v2h6v6h4v-6h6v-2l-2-2z"/></svg></div>' : ''}
                ${isUnread ? '<div class="unread-dot"></div>' : ''}
            `;
            
            // Klick öffnet Chat
            div.addEventListener('click', () => openChat(group));
            
            // Long Press für Anpinnen (Rechtsklick/Langes Drücken)
            div.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                vibrate();
                const action = isPinned ? 'lösen' : 'anpinnen';
                showConfirm(`Möchtest du die Gruppe "${group.name}" ${action}?`, () => {
                    if (isPinned) {
                        pinnedGroups = pinnedGroups.filter(id => id !== group.id);
                    } else {
                        pinnedGroups.push(group.id);
                    }
                    localStorage.setItem('rx_pinned_groups', JSON.stringify(pinnedGroups));
                    fetchGroups(); // Neu rendern
                });
            });

            groupsList.appendChild(div);
        });
    }

    // Gruppen Suche Event
    groupSearchInput.addEventListener('input', () => {
        // Wir rufen fetchGroups nicht neu auf, sondern nutzen die gecachten Daten, 
        // aber da wir hier keine globale Variable für alle Gruppen haben, laden wir neu.
        // Besser: fetchGroups speichert in Variable. Für Beta reicht reload.
        fetchGroups(); 
    });

    // --- Create Group Logic (Custom Popup) ---
    createGroupBtn.addEventListener('click', () => {
        newGroupNameInput.value = '';
        createGroupOverlay.classList.remove('hidden');
        newGroupNameInput.focus();
    });

    cancelGroupBtn.addEventListener('click', () => {
        createGroupOverlay.classList.add('hidden');
    });

    confirmGroupBtn.addEventListener('click', async () => {
        const name = newGroupNameInput.value.trim();
        if (!name) return;
        
        createGroupOverlay.classList.add('hidden');
        
        try {
            const response = await fetch(API_URL + 'groups', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            if (response.ok) {
                fetchGroups(); // Liste neu laden
            } else {
                showPopup("Fehler beim Erstellen.");
            }
        } catch (e) {
            showPopup("Verbindungsfehler.");
        }
    });

    // --- Navigation ---

    function openChat(group) {
        currentGroupId = group.id;
        chatTitle.textContent = group.name;

        // Als gelesen markieren
        readStatus[group.id] = Date.now();
        localStorage.setItem('rx_read_status', JSON.stringify(readStatus));
        
        // UI Switch
        groupsView.classList.add('hidden');
        chatView.classList.remove('hidden');

        // Reset Chat State
        messagesContainer.innerHTML = '';
        knownIds.clear();
        isFirstLoad = true;
        lastRenderedDate = null;
        cancelReply(); // Reset reply state
        statusText.textContent = 'Verbinde...';

        // Start Polling
        fetchSightings();
        pollInterval = setInterval(fetchSightings, 2000);
    }

    backToGroupsBtn.addEventListener('click', () => {
        // Stop Polling
        if (pollInterval) clearInterval(pollInterval);
        currentGroupId = null;

        // UI Switch
        chatView.classList.add('hidden');
        groupsView.classList.remove('hidden');
        cancelReply();
        
        // Refresh Groups
        fetchGroups();
    });

    // --- Chat Suche ---
    chatSearchToggle.addEventListener('click', () => {
        chatSearchBar.classList.toggle('hidden');
        if (!chatSearchBar.classList.contains('hidden')) {
            chatSearchInput.focus();
        }
    });

    chatSearchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const msgs = messagesContainer.querySelectorAll('.sighting');
        msgs.forEach(msg => {
            const text = msg.querySelector('.content').textContent.toLowerCase();
            // Einfaches Ein-/Ausblenden
            msg.style.display = text.includes(term) ? 'block' : 'none';
        });
    });

    // --- Refresh Button ---
    refreshBtn.addEventListener('click', async () => {
        const icon = refreshBtn.querySelector('svg');
        icon.classList.add('spinning');
        statusText.textContent = 'Aktualisiere...';
        await fetchSightings();
        icon.classList.remove('spinning');
    });

    // --- Reply Logic ---
    function setReply(sighting) {
        currentReply = sighting;
        
        // UI Reset falls wir im Edit Mode waren
        if (editingMessageId) cancelEdit();

        replyPreview.style.borderLeftColor = 'var(--accent-color)';
        document.querySelector('.reply-label').textContent = 'Antwort an';

        replyPreviewSender.textContent = sighting.userId === userId ? 'Du' : 'Nutzer';
        replyPreviewTimestamp.textContent = new Date(sighting.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        replyPreviewText.textContent = sighting.text; // Use the new element
        replyPreview.classList.remove('hidden');
        input.focus();
        vibrate();
    }

    function cancelReply() {
        currentReply = null;
        replyPreview.classList.add('hidden');
        replyPreviewSender.textContent = '';
        replyPreviewTimestamp.textContent = '';
        replyPreviewText.textContent = '';
    }

    // --- Edit Logic ---
    function startEdit(sighting) {
        editingMessageId = sighting.id;
        
        // UI Reset falls wir im Reply Mode waren
        if (currentReply) cancelReply();

        input.value = sighting.text;
        replyPreview.classList.remove('hidden');
        replyPreview.style.borderLeftColor = '#ffcc00'; // Gelb für Edit
        document.querySelector('.reply-label').textContent = 'Bearbeite Nachricht';
        replyPreviewText.textContent = sighting.text;
        input.focus();
    }

    function cancelEdit() {
        editingMessageId = null;
        input.value = '';
        cancelReply(); // Nutzt dieselbe UI zum Schließen
    }

    cancelReplyBtn.addEventListener('click', cancelReply);

    // --- Message Options Logic (Context Menu) ---
    let currentOptionsSighting = null;

    function showMessageOptions(sighting) {
        currentOptionsSighting = sighting;
        
        // Info setzen
        optMsgSender.textContent = sighting.userId === userId ? 'Du' : 'Nutzer';
        optMsgTime.textContent = new Date(sighting.timestamp).toLocaleString('de-DE');
        optMsgText.textContent = sighting.text;

        // Buttons basierend auf Besitz anzeigen
        if (sighting.userId === userId) {
            optBtnEdit.classList.remove('hidden');
            optBtnDelete.classList.remove('hidden');
        } else {
            optBtnEdit.classList.add('hidden');
            optBtnDelete.classList.add('hidden');
        }

        msgOptionsOverlay.classList.remove('hidden');
        if (typeof vibrate === 'function') vibrate();
    }

    function closeMessageOptions() {
        msgOptionsOverlay.classList.add('hidden');
        currentOptionsSighting = null;
    }

    optBtnReply.addEventListener('click', () => {
        if (currentOptionsSighting) setReply(currentOptionsSighting);
        closeMessageOptions();
    });

    optBtnCopy.addEventListener('click', () => {
        if (currentOptionsSighting) {
            navigator.clipboard.writeText(currentOptionsSighting.text).then(() => {
                showPopup('Text kopiert!');
            }).catch(() => {
                showPopup('Kopieren fehlgeschlagen.');
            });
        }
        closeMessageOptions();
    });

    optBtnEdit.addEventListener('click', () => {
        if (currentOptionsSighting) startEdit(currentOptionsSighting);
        closeMessageOptions();
    });

    optBtnDelete.addEventListener('click', () => {
        const sightingToDelete = currentOptionsSighting;
        closeMessageOptions();
        showConfirm('Nachricht wirklich löschen?', async () => {
            try {
                const res = await fetch(API_URL, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ groupId: currentGroupId, id: sightingToDelete.id, userId: userId })
                });
                if (res.ok) {
                    // Nachricht aus DOM entfernen
                    knownIds.delete(sightingToDelete.id);
                    fetchSightings(); // Refresh
                } else {
                    showPopup('Löschen fehlgeschlagen.');
                }
            } catch (e) {
                showPopup('Verbindungsfehler.');
            }
        });
    });

    // --- Forward Logic ---
    optBtnForward.addEventListener('click', async () => {
        const sightingToForward = currentOptionsSighting;
        closeMessageOptions();
        
        // Gruppen laden für Auswahl
        forwardGroupsList.innerHTML = '<p style="padding:20px; text-align:center;">Lade Gruppen...</p>';
        forwardOverlay.classList.remove('hidden');
        
        try {
            const res = await fetch(API_URL + 'groups');
            const groups = await res.json();
            forwardGroupsList.innerHTML = '';
            
            groups.forEach(g => {
                if (g.id === currentGroupId) return; // Nicht in gleiche Gruppe
                const div = document.createElement('div');
                div.className = 'group-item';
                div.innerHTML = `<div class="group-icon">${g.name.substring(0,2).toUpperCase()}</div><div class="group-name">${g.name}</div>`;
                div.onclick = () => {
                    prepareForward(sightingToForward, g);
                    forwardOverlay.classList.add('hidden');
                };
                forwardGroupsList.appendChild(div);
            });
        } catch (e) {
            forwardGroupsList.innerHTML = '<p style="padding:20px; text-align:center;">Fehler beim Laden.</p>';
        }
    });
    forwardCancelBtn.onclick = () => forwardOverlay.classList.add('hidden');

    optBtnCancel.addEventListener('click', closeMessageOptions);
    
    msgOptionsOverlay.addEventListener('click', (e) => {
        if (e.target === msgOptionsOverlay) closeMessageOptions();
    });

    // --- Chat Logik ---

    // Funktion zum Abrufen und Anzeigen von Sichtungen
    async function fetchSightings() {
        if (!currentGroupId) return;

        try {
            // userId mitsenden für Online-Status
            const response = await fetch(`${API_URL}?userId=${userId}&groupId=${currentGroupId}`);
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

            // Prüfen, ob wir unten sind, BEVOR wir neue Nachrichten hinzufügen
            const isNearBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 100;

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

            if (addedNew) {
                if (isFirstLoad || isNearBottom) {
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                } else {
                    // Nutzer ist hochgescrollt -> Button anzeigen und markieren
                    scrollBottomBtn.classList.remove('hidden');
                    scrollBottomBtn.classList.add('has-new-messages');
                }
            }
            
            isFirstLoad = false;
        } catch (error) {
            console.error('Fehler beim Abrufen der Sichtungen:', error);
            statusText.textContent = 'Verbindungsproblem...';
        }
    }

    // Helper: Text verlinken und HTML escapen
    function linkify(text) {
        if (!text) return '';
        const escaped = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
        
        return escaped.replace(/((https?:\/\/|www\.)[^\s]+)/g, (url) => {
            let href = url;
            if (!href.startsWith('http')) {
                href = 'http://' + href;
            }
            return `<a href="${href}" target="_blank" rel="noopener noreferrer" style="text-decoration: underline; color: inherit;">${url}</a>`;
        });
    }

    // Funktion zum Hinzufügen einer einzelnen Sichtung zum DOM
    function addSightingToDOM(sighting) {
        const date = new Date(sighting.timestamp);
        const dateKey = date.toDateString(); // Eindeutiger String für den Tag (ohne Zeit)

        // Prüfen, ob wir eine Datumstrennlinie brauchen
        if (lastRenderedDate !== dateKey) {
            const separator = document.createElement('div');
            separator.className = 'date-separator';
            
            const now = new Date();
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);

            if (dateKey === now.toDateString()) {
                separator.textContent = 'Heute';
            } else if (dateKey === yesterday.toDateString()) {
                separator.textContent = 'Gestern';
            } else {
                separator.textContent = date.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
            }
            
            messagesContainer.appendChild(separator);
            lastRenderedDate = dateKey;
        }

        const sightingDiv = document.createElement('div');
        
        // Unterscheidung: Eigene vs. Fremde Nachricht
        const isOwn = sighting.userId === userId;
        sightingDiv.className = `sighting ${isOwn ? 'own' : 'other'}`;

        // Weitergeleitet-Hinweis anzeigen
        if (sighting.forwardedFrom) {
            const fwdDiv = document.createElement('div');
            fwdDiv.className = 'forwarded-quote';
            fwdDiv.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 14 20 9 15 4"></polyline><path d="M4 20v-7a4 4 0 0 1 4-4h12"></path></svg> Weitergeleitet von ${sighting.forwardedFrom.groupName}`;
            
            // Klick führt zur Ursprungsgruppe
            fwdDiv.addEventListener('click', (e) => {
                e.stopPropagation(); // Verhindert Öffnen des Kontextmenüs
                const originGroup = cachedGroups.find(g => g.id === sighting.forwardedFrom.groupId);
                if (originGroup) {
                    if (originGroup.id === currentGroupId) {
                        showPopup("Du bist bereits in dieser Gruppe.");
                    } else {
                        openChat(originGroup);
                    }
                } else {
                    showPopup("Ursprungsgruppe nicht gefunden.");
                }
            });
            sightingDiv.appendChild(fwdDiv);
        }

        // Zitat anzeigen falls vorhanden
        if (sighting.replyTo) {
            const quoteDiv = document.createElement('div');
            quoteDiv.className = 'reply-quote';

            const quoteHeader = document.createElement('div');
            quoteHeader.className = 'quote-header';

            const quoteSender = document.createElement('span');
            quoteSender.className = 'quote-sender';
            quoteSender.textContent = sighting.replyTo.userId === userId ? 'Du' : 'Nutzer';

            const quoteTime = document.createElement('span');
            quoteTime.className = 'quote-time';
            quoteTime.textContent = new Date(sighting.replyTo.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

            quoteHeader.appendChild(quoteSender);
            quoteHeader.appendChild(quoteTime);
            quoteDiv.appendChild(quoteHeader);

            const quoteText = document.createElement('span'); // Use span for text content
            quoteText.className = 'quote-text';
            quoteText.textContent = sighting.replyTo.text;
            quoteDiv.appendChild(quoteText);
            sightingDiv.appendChild(quoteDiv);
        }

        const contentP = document.createElement('p');
        contentP.className = 'content';
        contentP.innerHTML = linkify(sighting.text);

        const metaP = document.createElement('p');
        metaP.className = 'meta';
        // Formatiere das Datum leserlich
        metaP.textContent = date.toLocaleString('de-DE', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit'
        });

        sightingDiv.appendChild(contentP);
        sightingDiv.appendChild(metaP);

        // Long Press für Optionen Menü (Mobile Optimierung)
        let pressTimer;
        let startX, startY;

        sightingDiv.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            pressTimer = setTimeout(() => {
                showMessageOptions(sighting);
            }, 500); // 500ms gedrückt halten
        }, { passive: true });

        sightingDiv.addEventListener('touchend', () => clearTimeout(pressTimer));
        sightingDiv.addEventListener('touchmove', (e) => {
            const moveX = e.touches[0].clientX;
            const moveY = e.touches[0].clientY;
            // Toleranz für kleine Bewegungen (Wackeln)
            if (Math.abs(moveX - startX) > 10 || Math.abs(moveY - startY) > 10) {
                clearTimeout(pressTimer);
            }
        }, { passive: true });

        sightingDiv.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showMessageOptions(sighting);
        });

        messagesContainer.appendChild(sightingDiv);
    }

    // --- Forward Flow ---
    let pendingForward = null;

    function prepareForward(sighting, targetGroup) {
        pendingForward = { sighting, targetGroup };
        
        forwardTargetName.textContent = `An: ${targetGroup.name}`;
        forwardPreviewContent.textContent = sighting.text;
        forwardCommentInput.value = ''; // Reset
        
        forwardConfirmOverlay.classList.remove('hidden');
        forwardCommentInput.focus();
    }

    forwardConfirmSend.addEventListener('click', async () => {
        if (!pendingForward) return;
        
        const { sighting, targetGroup } = pendingForward;
        const comment = forwardCommentInput.value.trim();
        const finalText = comment || sighting.text; // Wenn kein Kommentar, nimm Originaltext als Haupttext

        forwardConfirmOverlay.classList.add('hidden');

        try {
            await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    text: finalText, 
                    userId: userId, 
                    groupId: targetGroup.id,
                    forwardedFrom: {
                        groupId: currentGroupId,
                        groupName: chatTitle.textContent,
                        originalText: sighting.text,
                        originalSender: sighting.userId
                    }
                }),
            });
            showPopup(`An "${targetGroup.name}" weitergeleitet.`);
        } catch (e) {
            showPopup('Weiterleiten fehlgeschlagen.');
        }
        pendingForward = null;
    });

    forwardConfirmCancel.addEventListener('click', () => {
        forwardConfirmOverlay.classList.add('hidden');
        pendingForward = null;
    });

    // Funktion zum Senden einer neuen Sichtung
    async function postSighting() {
        const text = input.value.trim();
        if (text === '' || !currentGroupId) {
            return;
        }

        // EDIT MODE
        if (editingMessageId) {
            try {
                const res = await fetch(API_URL, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ groupId: currentGroupId, id: editingMessageId, userId: userId, text: text })
                });
                if (res.ok) {
                    cancelEdit();
                    fetchSightings();
                }
            } catch (e) { showPopup('Bearbeiten fehlgeschlagen.'); }
            return;
        }

        // NORMAL SEND
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    text: text, 
                    userId: userId, 
                    groupId: currentGroupId,
                    replyTo: currentReply ? { id: currentReply.id, text: currentReply.text, userId: currentReply.userId, timestamp: currentReply.timestamp } : null
                }),
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
            cancelReply(); // Antwort-Modus beenden
        } catch (error) {
            console.error('Fehler beim Senden der Sichtung:', error);
            showPopup('Fehler: Deine Sichtung konnte nicht gesendet werden.');
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
            scrollBottomBtn.classList.remove('has-new-messages');
        } else {
            scrollBottomBtn.classList.remove('hidden');
        }
    });

    scrollBottomBtn.addEventListener('click', () => {
        messagesContainer.scrollTo({ top: messagesContainer.scrollHeight, behavior: 'smooth' });
    });

    function startApp() {
        setupNotifications();
        fetchGroups(); // Startet jetzt mit der Gruppenliste
    }

    checkAccess(); // Startpunkt
});