const peer = new Peer();
let call;
let mixedStream = null;
let incomingCallRef = null;
let volumeMonitor;

const statusEl = document.getElementById("status");
const debugLog = document.getElementById("debug-log");
const volumeMeter = document.getElementById("volume-meter");
const playbackBtnContainer = document.getElementById("mobile-playback-button");

peer.on("open", id => {
  document.getElementById("my-id").textContent = id;
  logDebug(`🆔 PeerJS ID: ${id}`);
});

peer.on("call", incomingCall => {
  const callerId = incomingCall.peer;
  incomingCallRef = incomingCall;

  document.getElementById("incoming-call-box").style.display = "block";
  document.getElementById("caller-id").textContent = callerId;
  statusEl.textContent = "📲 Incoming call from " + callerId;

  incomingCall.on("stream", stream => {
    const audio = document.createElement("audio");
    audio.srcObject = stream;
    audio.autoplay = false;
    audio.controls = true;
    audio.playsInline = true;
    audio.style.display = "none";
    document.body.appendChild(audio);

    const playBtn = document.createElement("button");
    playBtn.innerText = "▶️ Tap to Hear Music";
    playBtn.onclick = () => {
      audio.play().then(() => {
        playBtn.remove();
        logDebug("✅ Audio playback started");
      }).catch(err => {
        logDebug("❌ Audio play error: " + err.message);
      });
    };
    playbackBtnContainer.innerHTML = "";
    playbackBtnContainer.appendChild(playBtn);
    playbackBtnContainer.style.display = "block";

    statusEl.textContent = "📡 Receiving stream from caller";
  });

  incomingCall.on("close", () => {
    document.getElementById("incoming-call-box").style.display = "none";
    document.getElementById("caller-id").textContent = "...";
    playbackBtnContainer.innerHTML = "";
    playbackBtnContainer.style.display = "none";
    statusEl.textContent = "📴 Call ended.";
  });
});

async function prepareAudioStream() {
  logDebug("🎙 Preparing audio stream...");

  try {
    const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const audioContext = new AudioContext();
    const destination = audioContext.createMediaStreamDestination();

    const sysSource = audioContext.createMediaStreamSource(displayStream);
    const micSource = audioContext.createMediaStreamSource(micStream);

    // Optional: High-pass filter to suppress low noise
    const noiseFilter = audioContext.createBiquadFilter();
    noiseFilter.type = "highpass";
    noiseFilter.frequency.value = 120;

    sysSource.connect(noiseFilter);
    micSource.connect(noiseFilter);
    noiseFilter.connect(destination);

    monitorVolume(noiseFilter, audioContext);
    mixedStream = destination.stream;

    statusEl.textContent = "🎙 Stream ready";
    logDebug("✅ Stream ready (no EQ, noise filter only).");
  } catch (err) {
    logDebug("❌ Error: " + err.message);
    alert("Error capturing audio.");
  }
}

function startCall() {
  const peerId = document.getElementById("peer-id").value;
  if (!mixedStream) {
    alert("Please start the stream first.");
    return;
  }

  call = peer.call(peerId, mixedStream);
  statusEl.textContent = "📞 Calling...";
  logDebug("📞 Calling " + peerId);

  call.on("stream", stream => {
    const audio = new Audio();
    audio.srcObject = stream;
    audio.autoplay = true;
    audio.playsInline = true;
    audio.style.display = "none";
    document.body.appendChild(audio);
    audio.play();
    statusEl.textContent = "✅ Streaming started.";
  });
}

function stopCall() {
  if (call) {
    call.close();
    call = null;
    statusEl.textContent = "🔌 Call ended.";
  }

  if (mixedStream) {
    mixedStream.getTracks().forEach(track => track.stop());
  }

  if (volumeMonitor) {
    cancelAnimationFrame(volumeMonitor);
  }

  playbackBtnContainer.innerHTML = "";
  playbackBtnContainer.style.display = "none";
}

function answerCall() {
  if (incomingCallRef) {
    incomingCallRef.answer(); // ✅ Answer without stream
    document.getElementById("incoming-call-box").style.display = "none";
    document.getElementById("caller-id").textContent = "...";
    logDebug("✅ Call answered.");
    statusEl.textContent = "✅ Call answered. Waiting for audio...";
  }
}

function rejectCall() {
  if (incomingCallRef) {
    incomingCallRef.close();
    incomingCallRef = null;
    document.getElementById("incoming-call-box").style.display = "none";
    document.getElementById("caller-id").textContent = "...";
    statusEl.textContent = "❌ Call rejected.";
    logDebug("❌ Call rejected.");
  }
}

function logDebug(msg) {
  debugLog.textContent += `\n${msg}`;
  debugLog.scrollTop = debugLog.scrollHeight;
}

function monitorVolume(source, context) {
  const analyser = context.createAnalyser();
  analyser.fftSize = 256;
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  source.connect(analyser);

  function updateVolume() {
    analyser.getByteFrequencyData(dataArray);
    const avg = dataArray.reduce((a, b) => a + b) / bufferLength;
    volumeMeter.value = avg;
    volumeMonitor = requestAnimationFrame(updateVolume);
  }

  updateVolume();
}
