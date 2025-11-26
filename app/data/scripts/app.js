/* app.js
   Voraussetzung: deine native Bridge implementiert die folgenden Methoden:
   - openCameraPreview(elementId)
   - takePhoto()
   - startVideo()
   - stopVideo()
   - setZoom(value)           // value: 0..1 or device-specific
   - toggleFlash() or setTorch(true|false)
   - switchCamera()
   - requestPermission("camera"|"audio")
   - saveToGallery(base64|blob)   // optional if native saves itself
   - getCameraDevices()           // optional
   Und native sendet Events an window.__onNativeEvent(eventJson)
   Event-JSON-Format (Beispiele):
   { type: "photoSaved", uri: "content://...", thumbBase64: "data:image/jpeg;base64,..." }
   { type: "videoSaved", uri: "content://...", thumbBase64: "data:..."}
   { type: "recordingStarted" }
   { type: "error", message: "..." }
*/

(() => {
  // Detect bridge object (flexibel)
  const BRIDGE = window.median || window.bridge || window.native || window.AndroidCamera || window.NativeCamera || window.Native || null;
  if (!BRIDGE) {
    console.warn("Keine native Bridge gefunden. Funktionalität eingeschränkt.");
  }

  // DOM
  const nativePreview = document.getElementById('nativePreview');
  const shutter = document.getElementById('shutter');
  const switchBtn = document.getElementById('switchBtn');
  const flashBtn = document.getElementById('flashBtn');
  const lastThumb = document.getElementById('lastThumb');
  const modePhoto = document.getElementById('modePhoto');
  const modeVideo = document.getElementById('modeVideo');
  const zoomSlider = document.getElementById('zoomSlider');
  const recordIndicator = document.getElementById('recordIndicator');

  const galleryScreen = document.getElementById('galleryScreen');
  const galleryGrid = document.getElementById('galleryGrid');
  const galleryBack = document.getElementById('galleryBack');

  let currentMode = 'photo';
  let isRecording = false;
  let lastSavedItems = []; // { type, uri, thumbBase64, name, date }

  // helpers: call bridge safely (support sync and async naming)
  function callBridge(method, arg) {
    if (!BRIDGE) return;
    try {
      const fn = BRIDGE[method] || BRIDGE[method.toLowerCase()];
      if (!fn) {
        // try generic invoke method
        if (typeof BRIDGE.invoke === 'function') {
          return BRIDGE.invoke(method, arg);
        }
        console.warn("Bridge method nicht vorhanden:", method);
        return;
      }
      // If native expects strings, stringify
      if (arg === undefined) return fn();
      if (typeof arg === 'object') return fn(JSON.stringify(arg));
      return fn(arg);
    } catch (e) {
      console.error("Bridge call failed:", method, e);
    }
  }

  // Initialize camera preview nativly
  function openNativePreview() {
    // If bridge exposes openCameraPreview(elementId), pass DOM id and native will render there.
    if (BRIDGE && typeof BRIDGE.openCameraPreview === 'function') {
      callBridge('openCameraPreview', 'nativePreview');
    } else if (BRIDGE && typeof BRIDGE.openPreview === 'function') {
      callBridge('openPreview', 'nativePreview');
    } else {
      // fallback: if not available, ask bridge to stream frames to a data URL callback OR show instructions
      console.warn("Bridge bietet kein openCameraPreview. Keine native Vorschau möglich.");
    }
  }

  // Permissions (optional)
  function ensurePermissions() {
    if (!BRIDGE) return Promise.resolve();
    if (typeof BRIDGE.requestPermission === 'function') {
      // request camera and audio proactively
      return Promise.allSettled([
        callBridge('requestPermission', 'camera'),
        callBridge('requestPermission', 'audio')
      ]);
    }
    return Promise.resolve();
  }

  // Handle native events: window.__onNativeEvent will be invoked by native
  window.__onNativeEvent = function(ev) {
    // ev may be stringified JSON or object
    let eventObj = ev;
    try { if (typeof ev === 'string') eventObj = JSON.parse(ev); } catch(e){}
    if (!eventObj || !eventObj.type) return;

    switch (eventObj.type) {
      case 'photoSaved':
      case 'videoSaved':
        // add to gallery list
        const item = {
          type: eventObj.type === 'photoSaved' ? 'photo' : 'video',
          uri: eventObj.uri || null,
          thumbBase64: eventObj.thumbBase64 || null,
          name: eventObj.displayName || eventObj.name || ('media_' + Date.now()),
          date: new Date().toISOString()
        };
        lastSavedItems.unshift(item);
        updateThumb(item);
        addToGallery(item);
        break;

      case 'recordingStarted':
        isRecording = true;
        recordIndicator.classList.remove('hidden');
        shutter.classList.add('hidden');
        break;

      case 'recordingStopped':
        isRecording = false;
        recordIndicator.classList.add('hidden');
        shutter.classList.remove('hidden');
        break;

      case 'error':
        alert("Native Fehler: " + (eventObj.message || 'Unbekannt'));
        break;

      default:
        console.log("Native event:", eventObj);
    }
  };

  // UI updates
  function updateThumb(item) {
    if (item.thumbBase64) {
      lastThumb.src = item.thumbBase64;
    } else if (item.uri) {
      // try set URI directly; if not permitted, native should send base64
      lastThumb.src = item.uri;
    }
  }

  function addToGallery(item) {
    const img = document.createElement(item.type === 'video' ? 'video' : 'img');
    img.className = 'gallery-item';
    if (item.thumbBase64) img.src = item.thumbBase64;
    else img.src = item.uri || '';
    img.onclick = () => {
      // request native to open the media if possible
      if (BRIDGE && typeof BRIDGE.openMedia === 'function') {
        callBridge('openMedia', item.uri || item.name);
      } else {
        // fallback: open in new tab
        window.open(item.uri || item.thumbBase64 || '', '_blank');
      }
    };
    galleryGrid.prepend(img);
  }

  // Shutter action
  shutter.addEventListener('click', async () => {
    if (currentMode === 'photo') {
      // call native.takePhoto()
      callBridge('takePhoto');
      // optionally animate
      shutter.animate([{ transform: 'scale(1)' }, { transform: 'scale(0.95)' }, { transform: 'scale(1)' }], { duration: 180 });
    } else {
      // video mode: start/stop via record button behaviour (we use toggle here)
      if (!isRecording) {
        callBridge('startVideo');
      } else {
        callBridge('stopVideo');
      }
    }
  });

  // Switch camera
  switchBtn.addEventListener('click', () => {
    callBridge('switchCamera');
  });

  // Flash / torch toggle (some bridges provide toggleFlash / setTorch)
  flashBtn.addEventListener('click', () => {
    if (BRIDGE && typeof BRIDGE.toggleFlash === 'function') {
      callBridge('toggleFlash');
    } else {
      // try setTorch with true/false toggle by asking native to toggle
      callBridge('toggleTorch');
    }
  });

  // Mode switching
  modePhoto.addEventListener('click', () => {
    currentMode = 'photo';
    modePhoto.classList.add('active');
    modeVideo.classList.remove('active');
  });
  modeVideo.addEventListener('click', () => {
    currentMode = 'video';
    modeVideo.classList.add('active');
    modePhoto.classList.remove('active');
  });

  // Zoom slider
  zoomSlider.addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    callBridge('setZoom', String(v)); // setZoom expects numeric 0..1 string or number
  });

  // Pinch-to-zoom (mobile)
  (function pinchZoomSetup() {
    let lastDist = null;
    let active = false;
    nativePreview.addEventListener('touchstart', (ev) => { if (ev.touches.length === 2) { lastDist = distance(ev.touches[0], ev.touches[1]); active = true; } }, {passive:true});
    nativePreview.addEventListener('touchmove', (ev) => {
      if (!active || ev.touches.length !== 2) return;
      const d = distance(ev.touches[0], ev.touches[1]);
      if (!lastDist) lastDist = d;
      const diff = d - lastDist;
      // map diff to small zoom delta
      const delta = diff > 0 ? 0.02 : -0.02;
      let newV = parseFloat(zoomSlider.value) + delta;
      newV = Math.max(0, Math.min(1, newV));
      zoomSlider.value = newV;
      callBridge('setZoom', String(newV));
      lastDist = d;
    }, {passive:true});
    nativePreview.addEventListener('touchend', (ev) => { if (ev.touches.length < 2) { lastDist = null; active = false; } }, {passive:true});
    function distance(a,b){ const dx=a.clientX-b.clientX, dy=a.clientY-b.clientY; return Math.hypot(dx,dy); }
  })();

  // Tap to focus
  nativePreview.addEventListener('click', (ev) => {
    // relative coordinates 0..1
    const rect = nativePreview.getBoundingClientRect();
    const x = (ev.clientX - rect.left) / rect.width;
    const y = (ev.clientY - rect.top) / rect.height;
    callBridge('setFocus', JSON.stringify({x, y}));
    // small visual focus ring
    const ring = document.createElement('div');
    ring.style.position = 'absolute';
    ring.style.left = `${ev.clientX - rect.left - 28}px`;
    ring.style.top = `${ev.clientY - rect.top - 28}px`;
    ring.style.width = '56px';
    ring.style.height = '56px';
    ring.style.border = '2px solid rgba(255,255,255,0.8)';
    ring.style.borderRadius = '50%';
    ring.style.pointerEvents = 'none';
    nativePreview.appendChild(ring);
    setTimeout(()=> ring.remove(),700);
  });

  // Gallery open
  document.getElementById('lastThumb').addEventListener('click', () => {
    openGallery();
  });
  document.getElementById('galleryBtn')?.addEventListener('click', openGallery);
  galleryBack.addEventListener('click', closeGallery);

  function openGallery() {
    galleryScreen.classList.remove('hidden');
  }
  function closeGallery() {
    galleryScreen.classList.add('hidden');
  }

  // Add existing items to gallery on startup if bridge can list them
  function tryLoadExisting() {
    if (!BRIDGE) return;
    if (typeof BRIDGE.getCameraGallery === 'function') {
      // assume it returns JSON string via sync call or callback; try both patterns
      try {
        const raw = BRIDGE.getCameraGallery();
        let arr = raw;
        if (typeof raw === 'string') arr = JSON.parse(raw || '[]');
        if (Array.isArray(arr)) {
          arr.forEach(i => { lastSavedItems.push(i); addToGallery(i); });
        }
      } catch(e){ console.warn("getCameraGallery failed",e); }
    }
  }

  // kick off
  (async function init(){
    await ensurePermissions();
    openNativePreview();
    tryLoadExisting();
  })();

})();
