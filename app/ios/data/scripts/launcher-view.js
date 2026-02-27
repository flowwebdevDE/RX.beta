// Dynamischer Import statt statischem Import, damit Settings nicht crashen
// import { listApps, openSelected, getAppIcon } from './launcher.js';

/**
 * Launcher View Logic (iOS Style)
 * Features: Swipeable Pages, App Library, Edit Mode
 */

let currentPage = 0;
let isEditMode = false;
let allInstalledAppsCache = null;
let clockInterval = null;
let stationDataCache = null;
let weatherInterval = null;

// Drag & Drop Variablen
let isDragging = false;
let dragGhost = null;
let dragStartIndex = -1;
let dragStartContainer = null;
let dragItem = null;
let lastDropTarget = null; // Für visuelles Feedback beim Ziehen

// Helper für Lazy Loading des Plugins
async function getLauncher() {
    return await import('./launcher.js');
}

// Global verfügbar machen für Settings-Seite
window.renderLauncherToggle = function(containerId) {
    const container = document.getElementById(containerId);
    if (container) renderToggleInternal(container);
};

function isFeatureEnabled(type) {
    if (!window.getLauncherConfig) return true;
    const cfg = window.getLauncherConfig();
    if (type === 'timetable') return cfg.featTimetable;
    if (type === 'weather') return cfg.featWeather;
    if (type === 'chat') return cfg.featChat;
    if (type === 'finder') return cfg.featFinder;
    if (type === 'settings') return cfg.featSettings;
    if (type === 'changelog') return cfg.featChangelog;
    if (type === 'sightings') return cfg.featSightings;
    return true;
}

// Interne Icons Definition (SVG Strings)
const ICONS = {
    timetable: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>`,
    weather: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.36 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.64-4.96z"/></svg>`,
    chat: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>`,
    settings: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L5.09 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.58 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>`,
    finder: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`,
    apps: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z"/></svg>`,
    changelog: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>`,
    sightings: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>`
};

function initLauncher() {
    console.log('Launcher Init started');
    
    // Auto-Inject Settings Toggle if placeholder exists
    const settingsPlaceholder = document.getElementById('launcher-settings-placeholder');
    if (settingsPlaceholder) {
        renderToggleInternal(settingsPlaceholder);
    }

    // Launcher Grid Logic - Nur ausführen, wenn wir auf dem Dashboard sind
    if (!document.querySelector('.dashboard-grid')) {
        return;
    }

    // Styles injizieren (NUR auf dem Dashboard, damit Settings.html nicht kaputt geht!)
    if (!document.getElementById('launcher-styles')) {
        const style = document.createElement('style');
        style.id = 'launcher-styles';
        style.textContent = `
            /* --- LAUNCHER MODE GLOBAL --- */
            body.launcher-mode {
                background: linear-gradient(135deg, #1c1c1e 0%, #2c3e50 100%) !important;
                background-attachment: fixed;
                background-size: cover !important;
                overflow: hidden; /* Kein Scrollen des Body */
            }
            /* Verstecke Standard-UI Elemente im Launcher Modus */
            body.launcher-mode .header,
            body.launcher-mode .dashboard-grid,
            body.launcher-mode #splash-screen {
                display: none !important;
            }
            
            /* Wrapper & Pages */
            .launcher-wrapper {
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                width: 100%;
                height: 100%;
                overflow: hidden;
                z-index: 100;
                user-select: none;
                display: flex;
                flex-direction: column;
                touch-action: pan-y; /* Erlaubt vertikales Scrollen der Seite, blockt horizontal für Swipe */
            }
            .launcher-wrapper.hidden { display: none; }
            
            .launcher-pages-container {
                display: flex;
                transition: transform 0.3s cubic-bezier(0.25, 1, 0.5, 1);
                width: 100%;
                flex: 1; /* Füllt den verfügbaren Platz */
            }
            
            .launcher-page {
                min-width: 100vw;
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                grid-template-rows: repeat(5, auto);
                gap: 15px 10px;
                padding: 0 10px;
                box-sizing: border-box;
                align-content: start;
            }
            
            /* Clock Widget */
            .launcher-clock-widget {
                text-align: center;
                padding: 30px 0 10px 0;
                color: white;
                text-shadow: 0 2px 10px rgba(0,0,0,0.3);
            }
            .clock-time { font-size: 64px; font-weight: 200; line-height: 1; }
            .clock-date { font-size: 18px; font-weight: 400; opacity: 0.9; margin-top: 5px; }

            /* Widgets Area */
            .launcher-widgets-area {
                padding: 0 15px 15px 15px;
                display: flex;
                gap: 10px;
                overflow-x: auto;
                scrollbar-width: none; /* Firefox */
            }
            .launcher-widgets-area::-webkit-scrollbar { display: none; }

            .widget-card {
                background: rgba(255, 255, 255, 0.15);
                backdrop-filter: blur(15px);
                -webkit-backdrop-filter: blur(15px);
                border-radius: 20px;
                padding: 15px;
                color: white;
                min-width: 140px;
                flex: 1;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                border: 1px solid rgba(255,255,255,0.1);
            }
            .widget-title { font-size: 12px; opacity: 0.8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px; }
            .widget-content { font-size: 18px; font-weight: 600; }
            .widget-sub { font-size: 12px; opacity: 0.9; margin-top: 2px; }
            
            .station-list-item {
                display: flex; justify-content: space-between; align-items: center;
                padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.1);
            }
            .station-list-item:last-child { border-bottom: none; }
            .station-dist { font-size: 11px; opacity: 0.8; background: rgba(0,0,0,0.2); padding: 2px 6px; border-radius: 8px; }

            /* Edit Mode Done Button */
            .edit-mode-done {
                position: absolute; top: 40px; right: 20px;
                background: rgba(255,255,255,0.9); color: #000;
                padding: 8px 16px; border-radius: 20px;
                font-weight: bold; font-size: 14px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                z-index: 200; cursor: pointer;
                display: none;
            }

            /* Dock */
            .launcher-dock {
                margin: 15px;
                padding: 15px 10px;
                background: rgba(255, 255, 255, 0.15);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border-radius: 24px;
                display: flex;
                justify-content: space-around;
                align-items: center;
                box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                border: 1px solid rgba(255,255,255,0.1);
            }
            
            /* Pagination Dots - Positioned above dock */
            .launcher-pagination {
                display: flex; justify-content: center; gap: 8px; margin-bottom: 10px;
            }
            .dot { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,0.3); transition: 0.3s; }
            .dot.active { background: white; transform: scale(1.2); }

            /* App Item */
            .launcher-item {
                display: flex;
                flex-direction: column;
                align-items: center;
                text-align: center;
                cursor: pointer;
                position: relative;
                transition: transform 0.1s;
            }
            .launcher-item:active { transform: scale(0.95); }
            .launcher-item.selected-swap { opacity: 0.5; transform: scale(0.9); }
            
            .launcher-icon {
                width: 60px;
                height: 60px;
                border-radius: 28%; /* Squircle Shape */
                background: white;
                margin-bottom: 5px;
                object-fit: cover;
                box-shadow: 0 4px 10px rgba(0,0,0,0.2);
                display: flex; align-items: center; justify-content: center;
            }
            /* Internal Icon Styling */
            .launcher-icon svg, .launcher-icon img {
                width: 32px; height: 32px; color: #444;
            }
            .launcher-label {
                font-size: 12px;
                line-height: 1.1;
                max-width: 100%;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                color: white;
                text-shadow: 0 1px 3px rgba(0,0,0,0.5);
                width: 70px;
            }
            .launcher-hide-labels .launcher-label { display: none; }
            
            /* App Launch Animation */
            @keyframes app-launch {
                0% { transform: scale(1); opacity: 1; }
                100% { transform: scale(2.5); opacity: 0; }
            }
            .launcher-item.launching .launcher-icon { animation: app-launch 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; z-index: 100; position: relative; }

            /* Edit Mode (Jiggle & Delete) */
            @keyframes jiggle {
                0% { transform: rotate(-1.5deg); }
                50% { transform: rotate(1.5deg); }
                100% { transform: rotate(-1.5deg); }
            }
            .launcher-item.jiggle .launcher-icon {
                animation: jiggle 0.3s infinite;
            }
            .delete-badge {
                position: absolute;
                top: -5px;
                left: 5px;
                width: 20px;
                height: 20px;
                background: rgba(255, 59, 48, 0.9);
                color: white;
                border-radius: 50%;
                font-size: 14px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                z-index: 10;
            }

            /* App Library / Drawer Overlay */
            .app-drawer-overlay {
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: var(--background-color, #fff); /* Fullscreen solid bg */
                z-index: 9999;
                display: flex; flex-direction: column;
                transform: translateY(100%);
                transition: transform 0.3s ease-in-out;
            }
            .app-drawer-overlay.open { transform: translateY(0); }
            
            .drawer-header {
                padding: 15px 20px;
                display: flex; align-items: center; gap: 10px;
                background: var(--background-color, #fff);
                border-bottom: 1px solid rgba(128,128,128,0.1);
            }
            .drawer-search {
                flex: 1;
                padding: 10px 15px;
                border-radius: 10px;
                border: none;
                background: rgba(128,128,128,0.1);
                font-size: 16px;
                color: inherit;
                outline: none;
            }
            .drawer-close {
                font-weight: bold;
                color: var(--accent-color, #007aff);
                cursor: pointer;
                padding: 5px;
            }
            .drawer-list {
                flex: 1;
                overflow-y: auto;
                padding: 20px;
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
                gap: 20px 10px;
                align-content: start;
            }
            
            /* --- NEW SETTINGS MODAL STYLES --- */
            .launcher-settings-overlay {
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.5); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
                z-index: 10000;
                display: flex; align-items: center; justify-content: center;
                animation: ls-fade 0.3s ease-out;
            }
            .launcher-settings-modal {
                background: var(--bg-color, #f2f2f7);
                width: 90%; max-width: 420px;
                max-height: 85vh;
                display: flex; flex-direction: column;
                border-radius: 28px;
                box-shadow: 0 20px 50px rgba(0,0,0,0.3);
                color: var(--text-color, #000);
                overflow: hidden;
                animation: ls-slideup 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
            }
            @media (prefers-color-scheme: dark) {
                .launcher-settings-modal { background: #1c1c1e; color: #fff; }
            }
            
            .ls-header {
                padding: 20px;
                display: flex; justify-content: space-between; align-items: center;
                border-bottom: 1px solid rgba(128,128,128,0.1);
                background: rgba(128,128,128,0.05);
            }
            .ls-title { font-size: 20px; font-weight: 700; }
            .ls-close-btn {
                background: rgba(128,128,128,0.15); border-radius: 50%; width: 32px; height: 32px;
                display: flex; align-items: center; justify-content: center; cursor: pointer;
                font-size: 18px; font-weight: bold; color: var(--text-color, #000);
            }
            
            .ls-content {
                flex: 1; overflow-y: auto; padding: 20px;
            }
            
            .ls-section { margin-bottom: 25px; }
            .ls-section-header {
                font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;
                color: #888; margin-bottom: 10px; margin-left: 10px; font-weight: 600;
            }
            
            .ls-card {
                background: var(--card-background, #fff);
                border-radius: 16px;
                overflow: hidden;
                box-shadow: 0 2px 8px rgba(0,0,0,0.05);
            }
            @media (prefers-color-scheme: dark) {
                .ls-card { background: #2c2c2e; }
            }
            
            .ls-row {
                display: flex; align-items: center; justify-content: space-between;
                padding: 16px;
                border-bottom: 1px solid rgba(128,128,128,0.1);
                min-height: 50px;
            }
            .ls-row:last-child { border-bottom: none; }
            
            .ls-label { font-size: 16px; font-weight: 500; flex: 1; }
            .ls-sublabel { font-size: 12px; color: #888; margin-top: 2px; }
            
            .ls-control { display: flex; align-items: center; gap: 10px; }
            
            /* Sliders */
            .ls-slider-container { width: 100%; padding: 10px 0; }
            .ls-slider-header { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; font-weight: 500; }
            .ls-range {
                -webkit-appearance: none; width: 100%; height: 6px;
                background: rgba(128,128,128,0.2); border-radius: 3px; outline: none;
            }
            .ls-range::-webkit-slider-thumb {
                -webkit-appearance: none; width: 22px; height: 22px;
                border-radius: 50%; background: var(--accent-color, #007aff);
                box-shadow: 0 2px 5px rgba(0,0,0,0.2); cursor: pointer;
                transition: transform 0.1s;
            }
            .ls-range::-webkit-slider-thumb:active { transform: scale(1.1); }
            
            /* Segmented Control for Theme */
            .ls-segmented {
                display: flex; background: rgba(128,128,128,0.1);
                padding: 4px; border-radius: 10px; margin: 0 16px 16px 16px;
            }
            .ls-seg-opt {
                flex: 1; text-align: center; padding: 8px; font-size: 13px; font-weight: 600;
                border-radius: 8px; cursor: pointer; color: #888; transition: 0.2s;
            }
            .ls-seg-opt.active {
                background: var(--bg-color, #fff); color: var(--text-color, #000);
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            @media (prefers-color-scheme: dark) {
                .ls-seg-opt.active { background: #636366; color: #fff; }
            }

            /* Action Buttons */
            .ls-action { color: var(--accent-color, #007aff); cursor: pointer; font-weight: 500; }
            .ls-action.danger { color: #ff3b30; }
            
            /* --- THEMES CSS --- */
            /* Light Theme */
            .launcher-theme-light .launcher-dock, .launcher-theme-light .widget-card {
                background: rgba(255,255,255,0.85); color: #000;
            }
            .launcher-theme-light .launcher-label, .launcher-theme-light .clock-time, .launcher-theme-light .clock-date {
                color: #222; text-shadow: none;
            }
            .launcher-theme-light .launcher-icon { box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
            
            /* Dark Theme */
            .launcher-theme-dark .launcher-dock, .launcher-theme-dark .widget-card {
                background: rgba(30,30,30,0.9); color: #fff; border: 1px solid rgba(255,255,255,0.05);
            }
            
            /* OLED Theme */
            .launcher-theme-oled .launcher-dock, .launcher-theme-oled .widget-card {
                background: #000000; color: #fff; border: 1px solid #333;
            }
            .launcher-theme-oled .launcher-label { text-shadow: none; }
            
            @keyframes ls-fade { from { opacity: 0; } to { opacity: 1; } }
            @keyframes ls-scale { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        `;
        document.head.appendChild(style);
    }

    let container = document.getElementById('launcher-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'launcher-container';
        container.className = 'launcher-wrapper hidden';
        const main = document.querySelector('main') || document.body;
        // Direkt an den Body hängen, damit es über allem liegt
        document.body.appendChild(container);
    }

    updateLauncherState();

    window.addEventListener('rx-settings-changed', (e) => {
        updateLauncherState();
    });
    
    window.addEventListener('rx-launcher-config-changed', (e) => {
        updateLauncherState();
    });

    // Global Click Listener to exit Edit Mode
    document.addEventListener('click', (e) => {
        if (isEditMode && !e.target.closest('.launcher-item')) {
            isEditMode = false;
            renderLauncherUI();
        }
    });
}

function updateLauncherState() {
    try {
        if (!window.getSettings || !window.getLauncherConfig) {
            console.warn('Settings not ready yet');
            return;
        }

        const settings = window.getSettings();
        const container = document.getElementById('launcher-container');
        
        if (!settings.launcherEnabled) {
            container.classList.add('hidden');
            container.innerHTML = '';
            stopClock();
            if(weatherInterval) clearInterval(weatherInterval);
            return;
        }

        container.classList.remove('hidden');
        
        // Apply Theme Class
        const lConfig = window.getLauncherConfig();
        container.className = 'launcher-wrapper'; // Reset
        
        // Apply CSS Variables for Grid & Size
        container.style.setProperty('--rx-grid-cols', lConfig.gridCols);
        container.style.setProperty('--rx-grid-rows', lConfig.gridRows);
        container.style.setProperty('--rx-icon-size', lConfig.iconSize + 'px');
        
        if (lConfig.theme) container.classList.add(`launcher-theme-${lConfig.theme}`);
        
        // Apply Wallpaper
        if (lConfig.wallpaper) {
            document.body.style.backgroundImage = `url('${lConfig.wallpaper}')`;
        } else {
            document.body.style.backgroundImage = ''; // Fallback to CSS gradient
        }
        renderLauncherUI();
        loadStationData(); // Daten für Widget laden
    } catch (e) {
        console.error("Launcher Crash Protection:", e);
        // Notfall-Modus: Falls was schiefgeht, Launcher-Modus deaktivieren damit man wieder was sieht
        document.body.classList.remove('launcher-mode');
        alert("Launcher Fehler: " + e.message);
    }
}

function renderLauncherUI() {
    const settings = window.getSettings();
    const lConfig = window.getLauncherConfig();
    const apps = settings.launcherApps || [];
    const dockApps = lConfig.dockApps || [];
    const container = document.getElementById('launcher-container');
    container.innerHTML = '';
    
    if (!lConfig.showLabels) container.classList.add('launcher-hide-labels');

    // Edit Mode "Done" Button
    if (isEditMode) {
        const doneBtn = document.createElement('div');
        doneBtn.className = 'edit-mode-done';
        doneBtn.textContent = 'Fertig';
        doneBtn.style.display = 'block';
        doneBtn.onclick = () => { isEditMode = false; renderLauncherUI(); };
        container.appendChild(doneBtn);
    }

    // 1. Clock Widget (Top)
    const clockWidget = document.createElement('div');
    clockWidget.className = 'launcher-clock-widget';
    clockWidget.innerHTML = `
        <div class="clock-time" id="launcher-time">--:--</div>
        <div class="clock-date" id="launcher-date">...</div>
    `;
    container.appendChild(clockWidget);
    startClock();
    
    // Long Press on Clock/Empty area to open Settings
    clockWidget.addEventListener('contextmenu', (e) => {
        if (navigator.vibrate) navigator.vibrate(50);
        e.preventDefault(); openLauncherSettings();
    });
    
    // 1.5 Widgets Area
    const widgetsArea = document.createElement('div');
    widgetsArea.className = 'launcher-widgets-area';
    
    // Wetter Widget
    const weatherWidget = document.createElement('div');
    weatherWidget.className = 'widget-card';
    weatherWidget.id = 'launcher-weather-widget';
    weatherWidget.innerHTML = `<div class="widget-title">Wetter</div><div class="widget-content">Lade...</div>`;
    weatherWidget.onclick = () => window.location.href = 'wetter/index.html';
    
    // Station Widget
    const stationWidget = document.createElement('div');
    stationWidget.className = 'widget-card';
    stationWidget.id = 'launcher-station-widget';
    stationWidget.innerHTML = `<div class="widget-title">Betriebsstellen</div><div class="widget-content" style="font-size:14px;">Suche Standort...</div>`;
    stationWidget.onclick = () => window.location.href = 'finder.html';

    widgetsArea.appendChild(weatherWidget);
    widgetsArea.appendChild(stationWidget);
    container.appendChild(widgetsArea);
    
    // Wetter-Interval starten (alle 30 Min aktualisieren)
    if (weatherInterval) clearInterval(weatherInterval);
    weatherInterval = setInterval(updateWeatherWidget, 1800000);
    
    updateWeatherWidget(); // Initial load

    // 2. Pages Container (Middle)
    const pagesContainer = document.createElement('div');
    pagesContainer.className = 'launcher-pages-container';
    
    // Long Press on Background (Pages Container)
    pagesContainer.addEventListener('contextmenu', (e) => {
        if(e.target === pagesContainer || e.target.classList.contains('launcher-page')) {
            if (navigator.vibrate) navigator.vibrate(50);
            e.preventDefault(); openLauncherSettings();
        }
    });
    
    // Seiten berechnen
    const appsPerPage = lConfig.gridCols * lConfig.gridRows;
    const pageCount = Math.ceil(apps.length / appsPerPage) || 1;
    
    for (let i = 0; i < pageCount; i++) {
        const page = document.createElement('div');
        page.className = 'launcher-page';
        
        const pageApps = apps.slice(i * appsPerPage, (i + 1) * appsPerPage);
        
        pageApps.forEach(app => {
            const item = createLauncherItem(app, false, apps.indexOf(app), 'grid');
            page.appendChild(item);
        });

        pagesContainer.appendChild(page);
    }

    container.appendChild(pagesContainer);

    // 3. Pagination Dots
    if (pageCount > 1) {
        const dotsContainer = document.createElement('div');
        dotsContainer.className = 'launcher-pagination';
        for (let i = 0; i < pageCount; i++) {
            const dot = document.createElement('div');
            dot.className = `dot ${i === currentPage ? 'active' : ''}`;
            dotsContainer.appendChild(dot);
        }
        container.appendChild(dotsContainer);
    }

    // 4. Dock (Bottom)
    const dock = document.createElement('div');
    dock.className = 'launcher-dock';
    
    dockApps.forEach((app, index) => {
        // Map internal types to SVG if needed
        if (app.isInternal && app.type && ICONS[app.type]) {
            app.svg = ICONS[app.type];
        }
        
        const item = createLauncherItem(app, false, index, 'dock');
        // Special styling for dock items (no labels usually)
        const label = item.querySelector('.launcher-label');
        if (label) label.style.display = 'none';
        
        if (app.isDrawerBtn) {
            const icon = item.querySelector('.launcher-icon');
            if(icon) icon.style.background = 'rgba(255,255,255,0.2)';
            if(icon) icon.style.color = 'white';
        }
        
        dock.appendChild(item);
    });

    container.appendChild(dock);

    // Swipe Logic initialisieren
    setupSwipe(pagesContainer, pageCount);
    
    // Position setzen
    pagesContainer.style.transform = `translateX(-${currentPage * 100}%)`;
}

function createLauncherItem(app, isDrawer = false, index = -1, containerType = 'grid') {
    const el = document.createElement('div');
    el.className = `launcher-item ${isEditMode && !isDrawer ? 'jiggle' : ''}`;
    el.dataset.index = index;
    el.dataset.container = containerType;
    
    // Icon Container
    const iconContainer = document.createElement('div');
    iconContainer.className = 'launcher-icon';
    
    // Feature Check
    if (app.isInternal && app.type && !isFeatureEnabled(app.type)) return document.createDocumentFragment(); // Empty if disabled

    if (app.isInternal) {
        // Internes Feature Icon
        iconContainer.innerHTML = app.svg || ICONS.timetable;
    } else {
        // Android App Icon
        const img = document.createElement('img');
        img.style.width = '100%'; img.style.height = '100%'; img.style.borderRadius = 'inherit'; img.style.objectFit = 'cover';
        img.src = 'data/images/logos/logo.png'; // Fallback
        iconContainer.appendChild(img);
        
        getLauncher().then(mod => {
            if (mod.getAppIcon) {
                mod.getAppIcon(app.packageName).then(b64 => {
                    if (b64) img.src = 'data:image/png;base64,' + b64;
                });
            }
        }).catch(e => console.warn('Icon error', e));
    }

    const label = document.createElement('span');
    label.className = 'launcher-label';
    label.textContent = app.label || app.name || 'App';

    el.appendChild(iconContainer);
    el.appendChild(label);

    if (isDrawer) {
        // Drawer Mode
        el.addEventListener('click', () => {
            getLauncher().then(mod => {
                mod.openSelected(app);
                closeAppDrawer();
            });
        });
        el.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            addToHomeScreen(app);
        });
    } else {
        // Home Mode (Grid or Dock)
        if (isEditMode) {
            const delBadge = document.createElement('div');
            delBadge.className = 'delete-badge';
            delBadge.textContent = '-';
            delBadge.onclick = (e) => {
                e.stopPropagation();
                if (containerType === 'dock') {
                    removeFromDock(index);
                } else {
                    removeFromHomeScreen(app.packageName);
                }
            };
            el.appendChild(delBadge);
        }

        el.addEventListener('click', () => {
            if (isDragging) return; // Klicks während Drag verhindern
            if (!isEditMode) {
                if (navigator.vibrate) navigator.vibrate(15); // Feedback beim App-Start
                // Launch Animation
                el.classList.add('launching');
                
                // Kurze Verzögerung für Animation
                setTimeout(() => {
                if (app.isInternal) {
                    if (app.action) {
                        if (typeof app.action === 'string') window.location.href = app.action;
                        else app.action();
                    } else if (app.isDrawerBtn) {
                        openAppDrawer();
                            el.classList.remove('launching'); // Reset sofort für Drawer
                    }
                } else {
                    getLauncher().then(mod => mod.openSelected(app));
                }
                    // Reset Klasse nach Animation (falls man zurückkehrt)
                    setTimeout(() => el.classList.remove('launching'), 500);
                }, 150);
            }
        });

        // Long Press -> Edit Mode
        let pressTimer;
        el.addEventListener('touchstart', () => {
            // Drag Start Logic
            if (isEditMode) {
                isDragging = false;
                dragItem = el;
                dragStartIndex = index;
                dragStartContainer = containerType;
            }

            pressTimer = setTimeout(() => {
                isEditMode = true;
                if (navigator.vibrate) navigator.vibrate(50);
                
                // Drag sofort initialisieren, damit man nicht neu tippen muss
                isDragging = false;
                dragItem = el;
                dragStartIndex = index;
                dragStartContainer = containerType;
                
                renderLauncherUI();
            }, 600);
        }, {passive: false});

        el.addEventListener('touchmove', (e) => {
            clearTimeout(pressTimer);
            
            if (!isEditMode || !dragItem) return;
            
            // Verhindert Scrollen während Drag
            e.preventDefault(); 
            
            const touch = e.touches[0];
            
            if (!dragGhost) {
                // Ghost erstellen beim ersten Move
                isDragging = true;
                dragGhost = dragItem.cloneNode(true);
                dragGhost.style.position = 'fixed';
                dragGhost.style.zIndex = '1000';
                dragGhost.style.pointerEvents = 'none';
                dragGhost.style.opacity = '0.8';
                dragGhost.style.transform = 'scale(1.1)';
                dragGhost.classList.remove('jiggle');
                
                // Original ausblenden
                dragItem.style.opacity = '0';
                document.body.appendChild(dragGhost);
            }
            
            // Ghost bewegen
            dragGhost.style.left = (touch.clientX - 30) + 'px'; // Zentriert (ca.)
            dragGhost.style.top = (touch.clientY - 30) + 'px';
            
            // Visuelles Feedback: Ziel hervorheben
            const target = getDropTarget(touch.clientX, touch.clientY);
            if (lastDropTarget && lastDropTarget !== target) {
                lastDropTarget.style.transform = ''; // Reset
            }
            if (target && target !== dragItem) {
                target.style.transform = 'scale(1.15)'; // Highlight
                lastDropTarget = target;
            }
        }, {passive: false});

        el.addEventListener('touchend', (e) => {
            clearTimeout(pressTimer);
            
            if (isDragging && dragGhost) {
                // Drop Logic
                dragGhost.remove();
                dragGhost = null;
                dragItem.style.opacity = '1';
                
                // Reset Highlight
                if (lastDropTarget) {
                    lastDropTarget.style.transform = '';
                    lastDropTarget = null;
                }
                
                const touch = e.changedTouches[0];
                const targetItem = getDropTarget(touch.clientX, touch.clientY);
                
                if (targetItem && targetItem.dataset.index !== undefined) {
                    const targetIndex = parseInt(targetItem.dataset.index);
                    const targetContainer = targetItem.dataset.container;
                    
                    // Verschieben ausführen (Insert statt Swap)
                    moveApps(dragStartIndex, targetIndex, dragStartContainer, targetContainer);
                }
                
                isDragging = false;
                dragItem = null;
            }
        });
    }

    return el;
}

// Verbesserte Zielerkennung (auch bei Ungenauigkeit)
function getDropTarget(x, y) {
    // 1. Direkter Treffer
    let el = document.elementFromPoint(x, y);
    if (!el) return null;

    // 2. Ist es ein Item?
    let item = el.closest('.launcher-item');
    if (item) return item;

    // 3. Wenn Container getroffen (Dock oder Seite), finde das nächste Item darin
    let container = el.closest('.launcher-dock, .launcher-page');
    if (container) {
        return findClosestItemInContainer(container, x, y);
    }

    return null;
}

function findClosestItemInContainer(container, x, y) {
    const items = Array.from(container.querySelectorAll('.launcher-item'));
    let closest = null;
    let minDist = Infinity;

    items.forEach(item => {
        const rect = item.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dist = Math.hypot(x - cx, y - cy);
        if (dist < minDist) {
            minDist = dist;
            closest = item;
        }
    });
    // Toleranzbereich (z.B. 150px Radius), damit man nicht quer über den Screen springt
    if (minDist < 150) return closest;
    return null;
}

function moveApps(fromIndex, toIndex, fromContainer, toContainer) {
    const settings = window.getSettings();
    const lConfig = window.getLauncherConfig();
    
    let fromList = fromContainer === 'dock' ? lConfig.dockApps : settings.launcherApps;
    let toList = toContainer === 'dock' ? lConfig.dockApps : settings.launcherApps;
    
    if (!fromList[fromIndex]) return;

    // Element entfernen
    const [item] = fromList.splice(fromIndex, 1);
    
    // Ziel-Index anpassen, wenn wir im gleichen Container nach hinten verschieben
    // (da sich durch das Entfernen die Indizes verschieben)
    if (fromContainer === toContainer && fromIndex < toIndex) {
        toIndex--;
    }
    
    // An neuer Position einfügen
    toList.splice(toIndex, 0, item);
    
    saveList(fromContainer, fromList);
    if (fromContainer !== toContainer) {
        saveList(toContainer, toList);
    }
}

function saveList(container, list) {
    if (container === 'dock') {
        const lConfig = window.getLauncherConfig();
        lConfig.dockApps = list;
        window.setLauncherConfig(lConfig);
    } else {
        window.setLauncherApps(list);
    }
}

function removeFromDock(index) {
    const lConfig = window.getLauncherConfig();
    lConfig.dockApps.splice(index, 1);
    window.setLauncherConfig(lConfig);
}

function openLauncherSettings() {
    const overlay = document.createElement('div');
    overlay.className = 'launcher-settings-overlay';
    
    const lConfig = window.getLauncherConfig();
    const modal = document.createElement('div');
    modal.className = 'launcher-settings-modal';
    
    modal.innerHTML = `
        <div class="ls-header">
            <div class="ls-title">Launcher</div>
            <div class="ls-close-btn" id="ls-close">✕</div>
        </div>
        <div class="ls-content">
            
            <div class="ls-section">
                <div class="ls-section-header">Design</div>
                <div class="ls-card">
                    <div style="padding-top: 16px;">
                        <div class="ls-segmented">
                            <div class="ls-seg-opt" data-theme="glass">Glass</div>
                            <div class="ls-seg-opt" data-theme="light">Hell</div>
                            <div class="ls-seg-opt" data-theme="dark">Dunkel</div>
                            <div class="ls-seg-opt" data-theme="oled">OLED</div>
                        </div>
                    </div>
                    <div class="ls-row" id="ls-set-wallpaper">
                        <div class="ls-label">Hintergrundbild</div>
                        <div class="ls-control ls-action">Wählen</div>
                    </div>
                    <div class="ls-row" id="ls-reset-wallpaper" style="display: ${lConfig.wallpaper ? 'flex' : 'none'}">
                        <div class="ls-label">Hintergrund entfernen</div>
                        <div class="ls-control ls-action danger">Löschen</div>
                    </div>
                </div>
            </div>

            <div class="ls-section">
                <div class="ls-section-header">Raster & Größe</div>
                <div class="ls-card" style="padding: 16px;">
                    <div class="ls-slider-container">
                        <div class="ls-slider-header"><span>Spalten</span><span id="val-cols">${lConfig.gridCols}</span></div>
                        <input type="range" class="ls-range" min="3" max="6" value="${lConfig.gridCols}" id="inp-cols">
                    </div>
                    <div class="ls-slider-container">
                        <div class="ls-slider-header"><span>Zeilen</span><span id="val-rows">${lConfig.gridRows}</span></div>
                        <input type="range" class="ls-range" min="4" max="8" value="${lConfig.gridRows}" id="inp-rows">
                    </div>
                    <div class="ls-slider-container">
                        <div class="ls-slider-header"><span>Icon Größe</span><span id="val-size">${lConfig.iconSize}px</span></div>
                        <input type="range" class="ls-range" min="40" max="80" value="${lConfig.iconSize}" id="inp-size">
                    </div>
                </div>
            </div>

            <div class="ls-section">
                <div class="ls-section-header">Optionen</div>
                <div class="ls-card">
                    <div class="ls-row">
                        <div class="ls-label">App-Namen anzeigen</div>
                        <div class="ls-control">
                            <label class="switch"><input type="checkbox" id="inp-labels" ${lConfig.showLabels ? 'checked' : ''}><span class="slider"></span></label>
                        </div>
                    </div>
                </div>
            </div>

            <div class="ls-section">
                <div class="ls-section-header">RailExplorer Apps</div>
                <div class="ls-card">
                    <div class="ls-row">
                        <div>
                            <div class="ls-label">Fahrplan</div>
                            <div class="ls-sublabel">Verbindungen suchen</div>
                        </div>
                        <div class="ls-control"><label class="switch"><input type="checkbox" id="feat-timetable" ${lConfig.featTimetable ? 'checked' : ''}><span class="slider"></span></label></div>
                    </div>
                    <div class="ls-row">
                        <div>
                            <div class="ls-label">Wetter</div>
                            <div class="ls-sublabel">Lokale Vorhersage</div>
                        </div>
                        <div class="ls-control"><label class="switch"><input type="checkbox" id="feat-weather" ${lConfig.featWeather ? 'checked' : ''}><span class="slider"></span></label></div>
                    </div>
                    <div class="ls-row">
                        <div>
                            <div class="ls-label">Chat</div>
                            <div class="ls-sublabel">Community & KI</div>
                        </div>
                        <div class="ls-control"><label class="switch"><input type="checkbox" id="feat-chat" ${lConfig.featChat ? 'checked' : ''}><span class="slider"></span></label></div>
                    </div>
                    <div class="ls-row">
                        <div>
                            <div class="ls-label">Betriebsstellen</div>
                            <div class="ls-sublabel">DS100 Suche</div>
                        </div>
                        <div class="ls-control"><label class="switch"><input type="checkbox" id="feat-finder" ${lConfig.featFinder ? 'checked' : ''}><span class="slider"></span></label></div>
                    </div>
                    <div class="ls-row">
                        <div>
                            <div class="ls-label">Sichtungen</div>
                            <div class="ls-sublabel">Live-Meldungen</div>
                        </div>
                        <div class="ls-control"><label class="switch"><input type="checkbox" id="feat-sightings" ${lConfig.featSightings ? 'checked' : ''}><span class="slider"></span></label></div>
                    </div>
                    <div class="ls-row">
                        <div>
                            <div class="ls-label">Changelog</div>
                            <div class="ls-sublabel">Infos & Updates</div>
                        </div>
                        <div class="ls-control"><label class="switch"><input type="checkbox" id="feat-changelog" ${lConfig.featChangelog ? 'checked' : ''}><span class="slider"></span></label></div>
                    </div>
                </div>
            </div>

            <div class="ls-section">
                <div class="ls-section-header">Erweitert</div>
                <div class="ls-card">
                    <div class="ls-row" id="ls-open-sys-settings">
                        <div class="ls-label">Android Einstellungen</div>
                        <div class="ls-control ls-action">Öffnen</div>
                    </div>
                    <div class="ls-row" id="ls-reset-dock">
                        <div class="ls-label">Dock zurücksetzen</div>
                        <div class="ls-control ls-action danger">Reset</div>
                    </div>
                </div>
            </div>
        </div>
        <input type="file" id="wallpaper-input" accept="image/*" style="display:none;">
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Events
    const close = () => {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 200);
    };

    document.getElementById('ls-close').onclick = close;
    overlay.onclick = (e) => { if(e.target === overlay) close(); };
    
    // Theme Selection
    const currentTheme = lConfig.theme || 'glass';
    modal.querySelectorAll('.ls-seg-opt').forEach(opt => {
        if(opt.dataset.theme === currentTheme) opt.classList.add('active');
        opt.onclick = () => {
            const lConfig = window.getLauncherConfig();
            lConfig.theme = opt.dataset.theme;
            window.setLauncherConfig(lConfig);
            close();
        };
    });

    // Grid & Display Settings Handlers
    const updateConfig = (key, val) => {
        try {
            const cfg = window.getLauncherConfig();
            cfg[key] = val;
            window.setLauncherConfig(cfg);
        } catch(e) {
            console.error(e);
            alert("Fehler beim Speichern der Einstellung. Ist theme-manager.js aktuell?");
        }
    };

    document.getElementById('inp-cols').oninput = (e) => {
        document.getElementById('val-cols').textContent = e.target.value;
        updateConfig('gridCols', parseInt(e.target.value));
    };
    document.getElementById('inp-rows').oninput = (e) => {
        document.getElementById('val-rows').textContent = e.target.value;
        updateConfig('gridRows', parseInt(e.target.value));
    };
    document.getElementById('inp-size').oninput = (e) => {
        document.getElementById('val-size').textContent = e.target.value + 'px';
        updateConfig('iconSize', parseInt(e.target.value));
    };
    document.getElementById('inp-labels').onchange = (e) => {
        updateConfig('showLabels', e.target.checked);
    };

    // Feature Toggles
    const bindToggle = (id, key) => {
        document.getElementById(id).onchange = (e) => updateConfig(key, e.target.checked);
    };
    bindToggle('feat-timetable', 'featTimetable');
    bindToggle('feat-weather', 'featWeather');
    bindToggle('feat-chat', 'featChat');
    bindToggle('feat-finder', 'featFinder');
    bindToggle('feat-sightings', 'featSightings');
    bindToggle('feat-changelog', 'featChangelog');

    // System Settings
    document.getElementById('ls-open-sys-settings').onclick = () => {
        getLauncher().then(mod => mod.openSettings());
    };

    document.getElementById('ls-set-wallpaper').onclick = () => {
        document.getElementById('wallpaper-input').click();
    };

    document.getElementById('wallpaper-input').onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (evt) => {
                const lConfig = window.getLauncherConfig();
                lConfig.wallpaper = evt.target.result;
                window.setLauncherConfig(lConfig);
                close();
            };
            reader.readAsDataURL(file);
        }
    };
    
    document.getElementById('ls-reset-wallpaper').onclick = () => {
        const lConfig = window.getLauncherConfig();
        lConfig.wallpaper = null;
        window.setLauncherConfig(lConfig);
        close();
    };
    
    document.getElementById('ls-reset-dock').onclick = () => {
        if(confirm('Dock wirklich zurücksetzen?')) {
            const lConfig = window.getLauncherConfig();
            lConfig.dockApps = null; 
            window.setLauncherConfig(lConfig);
            close();
        }
    };
}

function setupSwipe(element, pageCount) {
    let startX = 0;
    let startY = 0;
    
    element.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    }, {passive: true});

    element.addEventListener('touchend', (e) => {
        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;
        const diffX = startX - endX;
        const diffY = startY - endY;
        
        // Horizontal Swipe (Seitenwechsel)
        if (Math.abs(diffX) > 50 && Math.abs(diffX) > Math.abs(diffY)) {
            if (diffX > 0 && currentPage < pageCount - 1) {
                currentPage++;
            } else if (diffX < 0 && currentPage > 0) {
                currentPage--;
            }
            renderLauncherUI(); // Re-render to update dots and transform
        }
        // Vertikal Swipe nach oben (App Drawer öffnen)
        else if (diffY > 80 && Math.abs(diffY) > Math.abs(diffX)) {
            openAppDrawer();
        }
        // Vertikal Swipe nach unten (Globale Suche)
        else if (diffY < -80 && Math.abs(diffY) > Math.abs(diffX)) {
            openGlobalSearch();
        }
    }, {passive: true});
}

function startClock() {
    stopClock();
    const update = () => {
        const now = new Date();
        const timeEl = document.getElementById('launcher-time');
        const dateEl = document.getElementById('launcher-date');
        if (timeEl) timeEl.textContent = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        if (dateEl) dateEl.textContent = now.toLocaleDateString([], {weekday: 'long', day: 'numeric', month: 'long'});
    };
    update();
    clockInterval = setInterval(update, 1000);
}

function stopClock() {
    if (clockInterval) clearInterval(clockInterval);
}

// --- Widget Logic ---

function updateWeatherWidget() {
    const el = document.getElementById('launcher-weather-widget');
    if(!el) return;
    
    // Simple Mockup or fetch if location available
    // Hier nutzen wir eine einfache OpenMeteo Abfrage, falls Koordinaten da sind
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (pos) => {
            try {
                const { latitude, longitude } = pos.coords;
                const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
                const data = await res.json();
                const temp = Math.round(data.current_weather.temperature);
                const code = data.current_weather.weathercode;
                
                // Mapping Code to Text (vereinfacht)
                let text = "Klar";
                if(code > 2) text = "Bewölkt";
                if(code > 50) text = "Regen";
                if(code > 70) text = "Schnee";
                
                el.innerHTML = `<div class="widget-title">Wetter</div>
                                <div class="widget-content">${temp}°C</div>
                                <div class="widget-sub">${text}</div>`;
            } catch(e) {
                el.querySelector('.widget-content').textContent = "--°";
            }
        }, () => {
            el.querySelector('.widget-content').textContent = "Kein GPS";
        });
    }
}

async function loadStationData() {
    if(stationDataCache) {
        updateStationWidget();
        return;
    }
    try {
        const res = await fetch('data/stations.json'); // Pfad muss stimmen
        const js = await res.json();
        if(js.elements) {
            stationDataCache = js.elements.filter(el => el.type === 'node' && el.tags && el.tags.name);
            updateStationWidget();
        }
    } catch(e) { console.warn("Station widget data load failed", e); }
}

function updateStationWidget() {
    const el = document.getElementById('launcher-station-widget');
    if(!el || !stationDataCache) return;

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((pos) => {
            const { latitude, longitude } = pos.coords;
            
            // Sort by distance
            const sorted = stationDataCache.map(s => {
                const d = Math.sqrt(Math.pow(s.lat - latitude, 2) + Math.pow(s.lon - longitude, 2));
                return { ...s, dist: d };
            }).sort((a,b) => a.dist - b.dist).slice(0, 2);

            let html = `<div class="widget-title">In der Nähe</div>`;
            sorted.forEach(s => {
                // Grobe km Schätzung (1 Grad ~ 111km)
                const km = (s.dist * 111).toFixed(1);
                html += `<div class="station-list-item">
                            <span style="font-weight:500; font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:90px;">${s.tags.name}</span>
                            <span class="station-dist">${km} km</span>
                         </div>`;
            });
            el.innerHTML = html;
        });
    }
}

// --- App Drawer Logic ---

function openGlobalSearch() {
    openAppDrawer();
    // Fokus auf Suchfeld setzen (mit kurzer Verzögerung für die Animation)
    setTimeout(() => {
        const searchInput = document.querySelector('#app-drawer .drawer-search');
        if (searchInput) searchInput.focus();
    }, 300);
}

async function openAppDrawer() {
    // Check if exists
    let overlay = document.getElementById('app-drawer');
    if (!overlay) {
        overlay = createAppDrawerDOM();
    }
    
    // Sofort anzeigen, damit der User Feedback bekommt
    requestAnimationFrame(() => overlay.classList.add('open'));
    
    // Load apps if not cached
    if (!allInstalledAppsCache) {
        const listContainer = overlay.querySelector('.drawer-list');
        listContainer.innerHTML = ''; // Reset

        const loader = document.createElement('div');
        loader.textContent = 'Lade Apps...';
        loader.style.textAlign = 'center';
        loader.style.padding = '20px';
        listContainer.appendChild(loader);
        
        try {
            const mod = await getLauncher();
            allInstalledAppsCache = await mod.listApps();
            renderDrawerList(allInstalledAppsCache);
        } catch (e) {
            console.error(e);
            const errorMsg = `[${new Date().toLocaleTimeString()}] ${e.message || e}\nStack: ${e.stack || ''}\nJSON: ${JSON.stringify(e)}`;
            sessionStorage.setItem('rx_launcher_error', errorMsg);
            loader.innerHTML = 'Fehler beim Laden der Apps.<br><br><small>Details siehe Einstellungen -> Debug-Infos</small>';
        }
    } else {
        renderDrawerList(allInstalledAppsCache);
    }
}

function closeAppDrawer() {
    const overlay = document.getElementById('app-drawer');
    if (overlay) overlay.classList.remove('open');
}

function createAppDrawerDOM() {
    const overlay = document.createElement('div');
    overlay.id = 'app-drawer';
    overlay.className = 'app-drawer-overlay';
    overlay.innerHTML = `
        <div class="drawer-header">
            <input type="text" class="drawer-search" placeholder="Suchen...">
            <div class="drawer-close">Fertig</div>
        </div>
        <div class="drawer-list"></div>
    `;
    document.body.appendChild(overlay);

    // Events
    overlay.querySelector('.drawer-close').onclick = closeAppDrawer;
    
    // Swipe Down to Close
    let touchStartY = 0;
    overlay.addEventListener('touchstart', e => touchStartY = e.touches[0].clientY, {passive: true});
    overlay.addEventListener('touchmove', e => {
        const y = e.touches[0].clientY;
        const diff = y - touchStartY;
        const list = overlay.querySelector('.drawer-list');
        // Nur schließen wenn wir ganz oben sind und nach unten ziehen
        if (list.scrollTop === 0 && diff > 80) {
            if(e.cancelable) e.preventDefault();
            closeAppDrawer();
        }
    }, {passive: false});
    
    const searchInput = overlay.querySelector('.drawer-search');
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allInstalledAppsCache.filter(app => (app.label || '').toLowerCase().includes(term));
        renderDrawerList(filtered);
    });

    return overlay;
}

function renderDrawerList(apps) {
    const container = document.querySelector('#app-drawer .drawer-list');
    container.innerHTML = '';
    const lConfig = window.getLauncherConfig();
    
    // Add Internal Apps to Drawer
    const internalFeatures = [
        { label: 'Fahrplan', isInternal: true, type: 'timetable', action: 'main.html', packageName: 'internal.timetable', enabled: lConfig.featTimetable },
        { label: 'Betriebsstellen', isInternal: true, type: 'finder', action: 'finder.html', packageName: 'internal.finder', enabled: lConfig.featFinder },
        { label: 'Chat', isInternal: true, type: 'chat', action: 'chat.html', packageName: 'internal.chat', enabled: lConfig.featChat },
        { label: 'Sichtungen', isInternal: true, type: 'sightings', action: 'sightings.html', packageName: 'internal.sightings', enabled: lConfig.featSightings },
        { label: 'Changelog', isInternal: true, type: 'changelog', action: 'changelog.html', packageName: 'internal.changelog', enabled: lConfig.featChangelog },
        { label: 'Einstellungen', isInternal: true, type: 'settings', action: 'settings.html', packageName: 'internal.settings', enabled: lConfig.featSettings }
    ];

    internalFeatures.forEach(app => {
        if (app.enabled) {
            // Map SVG
            if(ICONS[app.type]) app.svg = ICONS[app.type];
            const item = createLauncherItem(app, true);
            container.appendChild(item);
        }
    });

    apps.forEach(app => {
        const item = createLauncherItem(app, true);
        container.appendChild(item);
    });
}

// --- Data Management ---

function addToHomeScreen(app) {
    const settings = window.getSettings();
    const currentApps = settings.launcherApps || [];
    
    // Check duplicate
    if (currentApps.find(a => a.packageName === app.packageName)) {
        if (window.showNotification) {
            window.showNotification('Hinweis', 'App ist bereits auf dem Home Screen');
        } else {
            alert('App ist bereits auf dem Home Screen');
        }
        return;
    }
    
    currentApps.push(app);
    window.setLauncherApps(currentApps);
    
    // Feedback
    if (navigator.vibrate) navigator.vibrate(50);
    closeAppDrawer();
}

function removeFromHomeScreen(packageName) {
    const settings = window.getSettings();
    const currentApps = settings.launcherApps || [];
    const newApps = currentApps.filter(a => a.packageName !== packageName);
    
    window.setLauncherApps(newApps);
    // UI update happens via event listener automatically
}

function renderToggleInternal(container) {
    const settings = window.getSettings();
    container.innerHTML = '';
    
    const row = document.createElement('div');
    row.className = 'toggle-row'; // Standard-Klasse aus settings.html nutzen
    
    row.innerHTML = `
        <span>Android Launcher</span>
        <label class="switch">
            <input type="checkbox" id="launcher-check" ${settings.launcherEnabled ? 'checked' : ''}>
            <span class="slider"></span>
        </label>
    `;
    
    row.querySelector('input').addEventListener('change', (e) => {
        window.setFeature('launcher', e.target.checked);
    });
    
    container.appendChild(row);

    // Debug Button für Fehleranalyse
    const debugBtn = document.createElement('div');
    debugBtn.className = 'theme-btn';
    debugBtn.style.marginTop = '10px';
    debugBtn.style.fontSize = '13px';
    debugBtn.style.padding = '10px';
    debugBtn.textContent = 'Launcher Debug-Infos anzeigen';
    debugBtn.onclick = () => {
        const err = sessionStorage.getItem('rx_launcher_error');
        const msg = err ? "Letzter Fehler:\n\n" + err : "Kein Fehler protokolliert.\n\nBitte versuche zuerst, die App-Bibliothek auf der Startseite zu öffnen, um den Fehler zu reproduzieren.";
        if (window.showAppPopup) {
            window.showAppPopup('Launcher Debug', msg);
        } else {
            alert(msg);
        }
    };
    container.appendChild(debugBtn);
}

// Initialisierung ganz am Ende, damit alle Variablen (ICONS, clockInterval etc.) bereit sind
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLauncher);
} else {
    initLauncher();
}