let stream;
let currentDeviceIndex = 0;
let devices = [];

const video = document.getElementById("camera");
const canvas = document.getElementById("canvas");
const captureBtn = document.getElementById("captureBtn");
const zoomSlider = document.getElementById("zoomSlider");
const switchBtn = document.getElementById("switchBtn");
const downloadLink = document.getElementById("downloadLink");

// Start camera
async function startCamera() {
  devices = await navigator.mediaDevices.enumerateDevices();
  devices = devices.filter(d => d.kind === 'videoinput');

  const deviceId = devices[currentDeviceIndex]?.deviceId;

  if (stream) stream.getTracks().forEach(t => t.stop());

  stream = await navigator.mediaDevices.getUserMedia({
    video: {
      deviceId: deviceId ? { exact: deviceId } : undefined,
      width: { ideal: 4000 },
      height: { ideal: 3000 },
      facingMode: "environment",
      zoom: true
    },
    audio: false
  });

  video.srcObject = stream;

  // Native zoom support?
  const track = stream.getVideoTracks()[0];
  const capabilities = track.getCapabilities();

  if (capabilities.zoom) {
    zoomSlider.min = capabilities.zoom.min;
    zoomSlider.max = capabilities.zoom.max;
    zoomSlider.step = capabilities.zoom.step || 0.1;
    zoomSlider.value = capabilities.zoom.min;
  }
}

zoomSlider.addEventListener("input", () => {
  const track = stream.getVideoTracks()[0];
  const capabilities = track.getCapabilities();

  if (capabilities.zoom) {
    track.applyConstraints({ advanced: [{ zoom: zoomSlider.value }] });
  } else {
    // Digital zoom fallback
    video.style.transform = `scale(${zoomSlider.value})`;
  }
});

captureBtn.addEventListener("click", () => {
  const w = video.videoWidth;
  const h = video.videoHeight;

  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, w, h);

  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);

    downloadLink.href = url;
    downloadLink.click();
  }, "image/jpeg", 0.95);
});

switchBtn.addEventListener("click", async () => {
  currentDeviceIndex = (currentDeviceIndex + 1) % devices.length;
  await startCamera();
});

startCamera();
