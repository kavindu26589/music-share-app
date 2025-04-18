const peer = new Peer();
let call;
let mixedStream;
let volumeMonitor;

const statusEl = document.getElementById("status");
const debugLog = document.getElementById("debug-log");

peer.on("open", id => {
  document.getElementById("my-id").textContent = id;
  logDebug(`🆔 PeerJS ID: ${id}`);
});

peer.on("call", incomingCall => {
  incomingCall.answer();
  incomingCall.on("stream", stream => {
    const audio = new Audio();
    audio.srcObject = stream;
    audio.autoplay = true;
    statusEl.textContent = "📡 Receiving stream from caller.";

    stream.getAudioTracks().forEach((track, i) => {
      logDebug(`📥 Received Track ${i + 1}: ${track.label}`);
    });
  });
});

async function startCall() {
  const peerId = document.getElementById("peer-id").value;
  statusEl.textContent = "🔄 Preparing stream...";
  logDebug("🎧 Attempting to capture system audio + mic...");

  try {
    let displayStream = null;
    try {
      displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true, // to allow tab selection
        audio: true
      });
    } catch (err) {
      logDebug("⚠️ System audio capture not supported or denied.");
    }

    const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const audioContext = new AudioContext();
    const destination = audioContext.createMediaStreamDestination();

    if (displayStream) {
      const sysSource = audioContext.createMediaStreamSource(displayStream);
      sysSource.connect(destination);
      monitorVolume(sysSource, audioContext);
      displayStream.getAudioTracks().forEach((t, i) =>
        logDebug(`🔊 System Audio Track ${i + 1}: ${t.label}`)
      );
    } else {
      logDebug("❌ No system audio, mic only.");
    }

    const micSource = audioContext.createMediaStreamSource(micStream);
    micSource.connect(destination);
    micStream.getAudioTracks().forEach((t, i) =>
      logDebug(`🎤 Mic Track ${i + 1}: ${t.label}`)
    );

    mixedStream = destination.stream;

    call = peer.call(peerId, mixedStream);
    call.on("stream", stream => {
      const audio = new Audio();
      audio.srcObject = stream;
      audio.autoplay = true;
      statusEl.textContent = "✅ Connected and streaming.";
    });

    statusEl.textContent = "📞 Calling...";
  } catch (err) {
    alert("❌ Error: " + err.message);
    logDebug("❌ Error during startCall: " + err.message);
    statusEl.textContent = "❌ Failed to start.";
  }
}

function stopCall() {
  if (call) {
    call.close();
    call = null;
    statusEl.textContent = "🔌 Call ended.";
    logDebug("🛑 Call manually stopped.");
  }

  if (mixedStream) {
    mixedStream.getTracks().forEach(track => track.stop());
  }

  if (volumeMonitor) {
    cancelAnimationFrame(volumeMonitor);
  }
}

function logDebug(msg) {
  debugLog.textContent += `\n${msg}`;
  debugLog.scrollTop = debugLog.scrollHeight;
}

function monitorVolume(source, audioContext) {
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 512;
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  source.connect(analyser);

  function updateVolume() {
    analyser.getByteFrequencyData(dataArray);
    const avg = dataArray.reduce((a, b) => a + b) / bufferLength;
    const emoji = avg > 10 ? "🎵 Music Detected" : "🔇 Silence";
    statusEl.textContent = `📶 Volume Level: ${Math.floor(avg)} | ${emoji}`;
    volumeMonitor = requestAnimationFrame(updateVolume);
  }

  updateVolume();
}
