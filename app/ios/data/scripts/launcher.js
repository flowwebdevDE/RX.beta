// import { registerPlugin } from '@capacitor/core';
// Wir nutzen das globale Capacitor-Objekt, da der Import ohne Bundler im WebView fehlschlägt
const AppLauncher = (window.Capacitor && window.Capacitor.Plugins) ? window.Capacitor.Plugins.AppLauncher : null;

export async function listApps() {
  if (!AppLauncher) {
    const available = (window.Capacitor && window.Capacitor.Plugins) ? Object.keys(window.Capacitor.Plugins) : [];
    console.error('Verfügbare Plugins:', available);
    throw new Error("AppLauncher Plugin nicht gefunden. Bitte in MainActivity.java registrieren! Verfügbar: " + available.join(', '));
  }
  const { apps } = await AppLauncher.listLaunchableApps({ includeIcons: false });
  // Apps alphabetisch sortieren
  apps.sort((a, b) => (a.label || '').localeCompare(b.label || '', 'de'));
  return apps;
}

export async function openSelected(app) {
  if (!AppLauncher) return;
  // am besten packageName + activityName
  await AppLauncher.openApp({
    packageName: app.packageName,
    activityName: app.activityName,
  });
}

export async function getAppIcon(packageName) {
  if (!AppLauncher) return null;
  try {
    const res = await AppLauncher.getAppIcon({ packageName });
    return res.iconPngBase64;
  } catch (e) {
    console.warn('Icon load failed', e);
    return null;
  }
}

export async function openSettings() {
  if (!AppLauncher) {
    alert("System-Einstellungen können in dieser Umgebung nicht geöffnet werden.");
    return;
  }
  await AppLauncher.openSettings();
}
