let stream;
let currentDeviceIndex = 0;
let devices = [];
let lastSavedItems = [];

const video = document.getElementById("camera");
const canvas = document.getElementById("canvas");
const captureBtn = document.getElementById("captureBtn");
const zoomSlider = document.getElementById("zoomSlider");
const switchBtn = document.getElementById("switchBtn");
const downloadLink = document.getElementById("downloadLink");
const galleryScreen = document.getElementById("galleryScreen");
const galleryGrid = document.getElementById("galleryGrid");
const galleryBack = document.getElementById("galleryBack");

// --- Camera Setup ---
async function startCamera() {
  devices = (await navigator.mediaDevices.enumerateDevices())
    .filter(d => d.kind === "videoinput");

  const deviceId = devices[currentDeviceIndex]?.deviceId;

  if (stream) stream.getTracks().forEach(t => t.stop());

  stream = await navigator.mediaDevices.getUserMedia({
    video: { deviceId: deviceId ? { exact: deviceId } : undefined, width:{ideal:4000}, height:{ideal:3000}, facingMode:"environment"},
    audio: false
  });

  video.srcObject = stream;

  // Zoom capabilities
  const track = stream.getVideoTracks()[0];
  const capabilities = track.getCapabilities();
  if (capabilities.zoom) {
    zoomSlider.min = capabilities.zoom.min;
    zoomSlider.max = capabilities.zoom.max;
    zoomSlider.step = capabilities.zoom.step || 0.1;
    zoomSlider.value = capabilities.zoom.min;
  }
}

// --- Zoom ---
zoomSlider.addEventListener("input", () => {
  const track = stream.getVideoTracks()[0];
  const capabilities = track.getCapabilities();
  const v = parseFloat(zoomSlider.value);
  if (capabilities.zoom) {
    track.applyConstraints({ advanced:[{zoom:v}] }).catch(()=>console.warn("Zoom nicht unterstützt"));
  } else {
    video.style.transform = `scale(${v})`;
  }
});

// --- Capture ---
captureBtn.addEventListener("click", () => {
  const w = video.videoWidth;
  const h = video.videoHeight;
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video,0,0,w,h);
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    downloadLink.href = url;
    downloadLink.click();
    addToGallery(url);
  },"image/jpeg",0.95);
});

// --- Camera switch ---
switchBtn.addEventListener("click", async () => {
  currentDeviceIndex = (currentDeviceIndex + 1) % devices.length;
  await startCamera();
});

// --- Tap-to-Focus ---
video.addEventListener("click", (e)=>{
  const rect = video.getBoundingClientRect();
  const x = (e.clientX - rect.left)/rect.width;
  const y = (e.clientY - rect.top)/rect.height;

  // Fokus-Ring Animation
  const ring = document.createElement("div");
  ring.className="focus-ring";
  ring.style.left=`${e.clientX-rect.left-28}px`;
  ring.style.top=`${e.clientY-rect.top-28}px`;
  video.parentElement.appendChild(ring);
  setTimeout(()=>ring.remove(),600);

  // Versuch Fokus via track (falls unterstützt)
  const track = stream.getVideoTracks()[0];
  const cap = track.getCapabilities();
  if(cap.focusMode && cap.focusPointX!==undefined){
    track.applyConstraints({advanced:[{focusMode:"manual", focusPointX:x, focusPointY:y}]}).catch(()=>console.warn("Fokus nicht unterstützt"));
  }
});

// --- Gallery ---
function addToGallery(url){
  lastSavedItems.unshift(url);
  const img = document.createElement("img");
  img.src = url;
  img.className="gallery-item";
  img.onclick=()=>window.open(url,'_blank');
  galleryGrid.prepend(img);
}

// --- Open/Close Gallery ---
document.getElementById("captureBtn").addEventListener("dblclick", ()=>galleryScreen.classList.toggle("hidden"));
galleryBack.addEventListener("click", ()=>galleryScreen.classList.add("hidden"));

// --- Init ---
startCamera();
