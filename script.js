const peer = new Peer();
let call;
let mixedStream = null;
let incomingCallRef = null;
let volumeMonitor;

const statusEl = document.getElementById("status");
const debugLog = document.getElementById("debug-log");

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
    const audio = new Audio();
    audio.srcObject = stream;
    audio.autoplay = true;
    stream.getAudioTracks().forEach((track, i) => {
      logDebug(`📥 Received Track ${i + 1}: ${track.label}`);
    });
    statusEl.textContent = "📡 Receiving stream from " + callerId;
  });

  incomingCall.on("close", () => {
    document.getElementById("incoming-call-box").style.display = "none";
    document.getElementById("caller-id").textContent = "...";
    statusEl.textContent = "📴 Call ended.";
  });
});

async function prepareAudioStream() {
  logDebug("🎙 Preparing audio stream...");

  try {
    const displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true
    });

    const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const audioContext = new AudioContext();
    const destination = audioContext.createMediaStreamDestination();

    const sysSource = audioContext.createMediaStreamSource(displayStream);
    const micSource = audioContext.createMediaStreamSource(micStream);

    sysSource.connect(destination);
    micSource.connect(destination);

    monitorVolume(sysSource, audioContext);

    displayStream.getAudioTracks().forEach((track, i) =>
      logDebug(`🔊 System Audio Track ${i + 1}: ${track.label}`)
    );
    micStream.getAudioTracks().forEach((track, i) =>
      logDebug(`🎤 Mic Track ${i + 1}: ${track.label}`)
    );

    mixedStream = destination.stream;
    statusEl.textContent = "🎙 Stream ready.";
    logDebug("✅ Stream is ready. Now start your call.");
  } catch (err) {
    logDebug("❌ Error capturing stream: " + err.message);
    alert("Error capturing system audio. Please share a tab and enable audio.");
  }
}

function startCall() {
  const peerId = document.getElementById("peer-id").value;

  if (!mixedStream) {
    alert("⚠️ Please start the stream first.");
    return;
  }

  call = peer.call(peerId, mixedStream);
  statusEl.textContent = "📞 Calling...";
  logDebug("📞 Calling peer: " + peerId);

  call.on("stream", stream => {
    const audio = new Audio();
    audio.srcObject = stream;
    audio.autoplay = true;
    statusEl.textContent = "✅ Connected and streaming.";
  });
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

function answerCall() {
  if (incomingCallRef) {
    incomingCallRef.answer();
    statusEl.textContent = "✅ Call answered.";
    document.getElementById("incoming-call-box").style.display = "none";
    document.getElementById("caller-id").textContent = "...";
    logDebug("✅ Call answered by receiver.");
  }
}

function rejectCall() {
  if (incomingCallRef) {
    incomingCallRef.close();
    incomingCallRef = null;
    document.getElementById("incoming-call-box").style.display = "none";
    document.getElementById("caller-id").textContent = "...";
    statusEl.textContent = "❌ Call rejected.";
    logDebug("❌ Call rejected by receiver.");
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
