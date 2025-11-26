let stream;
let track;
let imageCapture;
let mediaRecorder;
let chunks = [];

let facingMode = "environment";
let mode = "photo";

const video = document.getElementById("cameraPreview");
const canvas = document.getElementById("canvas");
const photoThumb = document.getElementById("lastThumb");
const videoResult = document.getElementById("videoResult");

// UI elements
const shutter = document.getElementById("captureBtn");
const recordBtn = document.getElementById("recordBtn");
const stopBtn = document.getElementById("stopBtn");

const modePhoto = document.getElementById("mode-photo");
const modeVideo = document.getElementById("mode-video");

// --------------------------------
// Kamera starten
// --------------------------------
async function startCamera() {
  if (stream) stream.getTracks().forEach(t => t.stop());

  stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode },
    audio: true
  });

  track = stream.getVideoTracks()[0];
  video.srcObject = stream;

  if ("ImageCapture" in window) {
    imageCapture = new ImageCapture(track);
  }
}

startCamera();

// --------------------------------
// Kamera wechseln
// --------------------------------
document.getElementById("switchBtn").onclick = () => {
  facingMode = (facingMode === "user") ? "environment" : "user";
  startCamera();
};

// --------------------------------
// Flash (Torch on/off)
// --------------------------------
document.getElementById("flashBtn").onclick = async () => {
  const cap = track.getCapabilities?.();
  if (cap?.torch) {
    const s = track.getSettings();
    track.applyConstraints({ advanced: [{ torch: !s.torch }] });
  } else {
    alert("Blitz/Taschenlampe wird nicht unterstützt.");
  }
};

// --------------------------------
// FOTO
// --------------------------------
shutter.onclick = async () => {
  if (mode !== "photo") return;

  if (imageCapture) {
    let blob = await imageCapture.takePhoto();
    photoThumb.src = URL.createObjectURL(blob);
    return;
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0);

  canvas.toBlob(blob => {
    photoThumb.src = URL.createObjectURL(blob);
  }, "image/jpeg", 0.95);
};

// --------------------------------
// VIDEO START
// --------------------------------
recordBtn.onclick = () => {
  if (mode !== "video") return;

  chunks = [];
  mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.ondataavailable = e => chunks.push(e.data);
  mediaRecorder.onstop = () => {
    let blob = new Blob(chunks, { type: "video/webm" });
    photoThumb.src = URL.createObjectURL(blob);
  };

  mediaRecorder.start();
  recordBtn.classList.add("hidden");
  stopBtn.classList.remove("hidden");
};

// --------------------------------
// VIDEO STOP
// --------------------------------
stopBtn.onclick = () => {
  mediaRecorder.stop();
  stopBtn.classList.add("hidden");
  recordBtn.classList.remove("hidden");
};

// --------------------------------
// Mode Switching
// --------------------------------
modePhoto.onclick = () => {
  mode = "photo";
  modePhoto.classList.add("active");
  modeVideo.classList.remove("active");

  shutter.classList.remove("hidden");
  recordBtn.classList.add("hidden");
  stopBtn.classList.add("hidden");
};

modeVideo.onclick = () => {
  mode = "video";
  modeVideo.classList.add("active");
  modePhoto.classList.remove("active");

  shutter.classList.add("hidden");
  recordBtn.classList.remove("hidden");
  stopBtn.classList.add("hidden");
};
