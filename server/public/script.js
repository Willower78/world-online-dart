// WebRTC and Socket.io connection
let socket;
let localStream;
let peerConnection;
let calibrationPoints = [];
let isCalibrating = false;
let detectionActive = false;
let dartCount = 0;
let fps = 0;
let fpsInterval;

// DOM Elements
const videoElement = document.getElementById('videoElement');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('startBtn');
const calibrateBtn = document.getElementById('calibrateBtn');
const detectBtn = document.getElementById('detectBtn');
const stopBtn = document.getElementById('stopBtn');
const statusDiv = document.getElementById('status');
const calibrationOverlay = document.getElementById('calibrationOverlay');

// Status elements
const detectionStatus = document.getElementById('detectionStatus');
const dartCountElement = document.getElementById('dartCount');
const calibrationStatusElement = document.getElementById('calibrationStatus');
const fpsCounter = document.getElementById('fpsCounter');

// Initialize Socket.io connection
function initializeSocket() {
  const token = localStorage.getItem('token');
  socket = io({
    auth: { token }
  });

  socket.on('connect', () => {
    updateStatus('Connected to server', 'success');
  });

  socket.on('disconnect', () => {
    updateStatus('Disconnected from server', 'error');
  });

  socket.on('dart-detected', (data) => {
    handleDartDetection(data);
  });

  socket.on('detection-error', (error) => {
    updateStatus(`Detection error: ${error.message}`, 'error');
  });

  socket.on('detection-fps', (value) => {
    fpsCounter.textContent = String(value || 0);
  });
}

// Start camera
startBtn.addEventListener('click', async () => {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'environment'
      },
      audio: false
    });

    videoElement.srcObject = localStream;

    videoElement.onloadedmetadata = () => {
      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;
    };

    startBtn.disabled = true;
    calibrateBtn.disabled = false;
    stopBtn.disabled = false;

    updateStatus('Camera started successfully', 'success');
    detectionStatus.textContent = 'Ready';

    if (!socket) initializeSocket();
  } catch (error) {
    console.error('Error accessing camera:', error);
    updateStatus('Failed to access camera. Please check permissions.', 'error');
  }
});

// Calibrate dartboard
calibrateBtn.addEventListener('click', () => {
  if (!isCalibrating) {
    isCalibrating = true;
    calibrationPoints = [];
    calibrationOverlay.style.display = 'flex';
    updateStatus('Click the 4 board corners (TL, TR, BR, BL)', 'info');
    canvas.addEventListener('click', handleCalibrationClick);
  }
});

// Handle calibration clicks
function handleCalibrationClick(event) {
  if (calibrationPoints.length >= 4) return;

  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) * (canvas.width / rect.width);
  const y = (event.clientY - rect.top) * (canvas.height / rect.height);

  calibrationPoints.push({ x, y });

  ctx.fillStyle = '#00ff00';
  ctx.beginPath();
  ctx.arc(x, y, 10, 0, 2 * Math.PI);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = '20px Arial';
  ctx.fillText(calibrationPoints.length, x - 5, y + 5);

  if (calibrationPoints.length === 4) {
    completeCalibration();
  }
}

// Complete calibration
async function completeCalibration() {
  isCalibrating = false;
  calibrationOverlay.style.display = 'none';
  canvas.removeEventListener('click', handleCalibrationClick);

  drawCalibrationRectangle();

  const calibrationData = {
    topLeft: calibrationPoints[0],
    topRight: calibrationPoints[1],
    bottomRight: calibrationPoints[2],
    bottomLeft: calibrationPoints[3]
  };

  if (socket && socket.connected) {
    socket.emit('camera-calibration', calibrationData);
  }

  updateStatus('Calibration complete! Ready to detect darts.', 'success');
  calibrationStatusElement.textContent = 'Complete';
  detectBtn.disabled = false;
}

// Draw calibration rectangle
function drawCalibrationRectangle() {
  if (calibrationPoints.length < 4) return;
  ctx.strokeStyle = '#00ff00';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(calibrationPoints[0].x, calibrationPoints[0].y);
  for (let i = 1; i < calibrationPoints.length; i++) {
    ctx.lineTo(calibrationPoints[i].x, calibrationPoints[i].y);
  }
  ctx.closePath();
  ctx.stroke();
}

// Start detection
detectBtn.addEventListener('click', () => {
  if (!localStream) return;

  detectionActive = true;
  detectBtn.disabled = true;
  calibrateBtn.disabled = true;
  startFpsCounter();

  detectionStatus.textContent = 'Running';
  updateStatus('Detection started', 'success');

  startFrameLoop();
});

// Stop everything
stopBtn.addEventListener('click', () => {
  detectionActive = false;
  stopFpsCounter();
  detectionStatus.textContent = 'Stopped';
  updateStatus('Detection stopped', 'warning');

  detectBtn.disabled = false;
  calibrateBtn.disabled = false;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
});

// Frame capture loop
async function startFrameLoop() {
  const offscreen = document.createElement('canvas');
  offscreen.width = canvas.width;
  offscreen.height = canvas.height;
  const octx = offscreen.getContext('2d');

  const sendFrame = () => {
    if (!detectionActive) return;

    try {
      octx.drawImage(videoElement, 0, 0, offscreen.width, offscreen.height);
      offscreen.toBlob((blob) => {
        if (!blob) return;
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result;
          if (socket && socket.connected) {
            socket.emit('video-frame', {
              image: base64,
              calibration: calibrationPoints.length === 4 ? {
                topLeft: calibrationPoints[0],
                topRight: calibrationPoints[1],
                bottomRight: calibrationPoints[2],
                bottomLeft: calibrationPoints[3]
              } : null
            });
          }
        };
        reader.readAsDataURL(blob);
      }, 'image/jpeg', 0.7);
    } catch (e) {
      console.error('Frame send error', e);
    }

    if (detectionActive) {
      setTimeout(sendFrame, 100);
    }
  };

  sendFrame();
}

// Handle detection event
function handleDartDetection(data) {
  dartCount += 1;
  dartCountElement.textContent = String(dartCount);

  if (data?.point) {
    drawDetectionPoint(data.point.x, data.point.y, data.score || '');
  }

  updateStatus(`Dart detected: ${data?.score || 'Unknown'}`, 'success');
}

// Draw detection visualization
function drawDetectionPoint(x, y, label) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (calibrationPoints.length === 4) drawCalibrationRectangle();

  ctx.fillStyle = '#ff3b30';
  ctx.beginPath();
  ctx.arc(x, y, 10, 0, 2 * Math.PI);
  ctx.fill();

  if (label) {
    ctx.fillStyle = '#ffffff';
    ctx.font = '18px Arial';
    ctx.fillText(label, x + 12, y + 6);
  }
}

// FPS helpers
function startFpsCounter() {
  let frames = 0;

  fpsInterval = setInterval(() => {
    fps = frames;
    fpsCounter.textContent = String(fps);
    frames = 0;
  }, 1000);

  const loop = () => {
    if (!detectionActive) return;
    frames += 1;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

function stopFpsCounter() {
  clearInterval(fpsInterval);
  fpsCounter.textContent = '0';
}

// UI helper
function updateStatus(message, type = 'info') {
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
}

// Resize canvas with video
window.addEventListener('resize', () => {
  if (videoElement.videoWidth) {
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
  }
});

// Initialize
updateStatus('Ready to start camera setup', 'info');
