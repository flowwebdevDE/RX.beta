(function() {
    const DESIGN_KEY = 'rx_design';
    const DARKMODE_KEY = 'rx_darkmode';
    const FEAT_WEATHER_KEY = 'rx_feat_weather';
    const FEAT_LOCATION_KEY = 'rx_feat_location';
    const ACCENT_KEY = 'rx_accent';
    const USERNAME_KEY = 'rx_username';

    function applySettings() {
        const design = localStorage.getItem(DESIGN_KEY) || 'standard';
        const darkMode = localStorage.getItem(DARKMODE_KEY) === 'true';
        const weatherEnabled = localStorage.getItem(FEAT_WEATHER_KEY) !== 'false'; // Standard: an
        const locationEnabled = localStorage.getItem(FEAT_LOCATION_KEY) !== 'false'; // Standard: an
        const accent = localStorage.getItem(ACCENT_KEY) || 'blue';

        const body = document.body;
        // Alte Design-Klassen entfernen
        body.classList.remove('design-standard', 'design-list', 'design-tiles', 'design-focus');
        // Neues Design setzen
        if (!body.classList.contains('no-layout-change')) {
            body.classList.add('design-' + design);
        }

        // Akzentfarbe setzen
        body.classList.remove('accent-blue', 'accent-red', 'accent-green', 'accent-orange', 'accent-purple', 'accent-pink');
        body.classList.add('accent-' + accent);

        // Dark mode
        if (darkMode) {
            body.classList.add('dark-mode');
        } else {
            body.classList.remove('dark-mode');
        }

        // Event feuern für UI-Updates (z.B. in index.html)
        window.dispatchEvent(new CustomEvent('rx-settings-changed', { 
            detail: { design, darkMode, weatherEnabled, locationEnabled, accent } 
        }));
    }

    // Expose functions globally
    window.setDesign = function(designName) {
        localStorage.setItem(DESIGN_KEY, designName);
        applySettings();
    };

    window.setDarkMode = function(enable) {
        localStorage.setItem(DARKMODE_KEY, enable);
        applySettings();
    };

    window.setFeature = function(feature, enable) {
        if (feature === 'weather') localStorage.setItem(FEAT_WEATHER_KEY, enable);
        if (feature === 'location') localStorage.setItem(FEAT_LOCATION_KEY, enable);
        applySettings();
    };

    window.setAccent = function(color) {
        localStorage.setItem(ACCENT_KEY, color);
        applySettings();
    };

    window.setUsername = function(name) {
        localStorage.setItem(USERNAME_KEY, name);
    };
    
    window.getSettings = function() {
        return {
            design: localStorage.getItem(DESIGN_KEY) || 'standard',
            darkMode: localStorage.getItem(DARKMODE_KEY) === 'true',
            weatherEnabled: localStorage.getItem(FEAT_WEATHER_KEY) !== 'false',
            locationEnabled: localStorage.getItem(FEAT_LOCATION_KEY) !== 'false',
            accent: localStorage.getItem(ACCENT_KEY) || 'blue',
            username: localStorage.getItem(USERNAME_KEY) || ''
        };
    };

    // Init immediately
    applySettings();
    document.addEventListener('DOMContentLoaded', applySettings);
})();