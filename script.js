const peer = new Peer();
let call;
let mixedStream = null;
let incomingCallRef = null;
let volumeMonitor;

const statusEl = document.getElementById("status");
const debugLog = document.getElementById("debug-log");
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
    logDebug("📥 Incoming audio stream detected");
    stream.getAudioTracks().forEach((track, i) => {
      logDebug(`📥 Track ${i + 1}: ${track.label}, enabled=${track.enabled}`);
    });

    const audio = document.createElement("audio");
    audio.srcObject = stream;
    audio.autoplay = false;
    audio.controls = true;
    audio.playsInline = true;
    audio.style.display = "none";
    document.body.appendChild(audio);

    // Show mobile tap-to-play button
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
    playbackBtnContainer.innerHTML = ""; // Clear old
    playbackBtnContainer.appendChild(playBtn);
    playbackBtnContainer.style.display = "block";

    statusEl.textContent = "📡 Receiving stream from " + callerId;
  });

  incomingCall.on("close", () => {
    document.getElementById("incoming-call-box").style.display = "none";
    document.getElementById("caller-id").textContent = "...";
    statusEl.textContent = "📴 Call ended.";
    playbackBtnContainer.innerHTML = "";
    playbackBtnContainer.style.display = "none";
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
    const audio = document.createElement("audio");
    audio.srcObject = stream;
    audio.autoplay = true;
    audio.playsInline = true;
    audio.style.display = "none";
    document.body.appendChild(audio);
    audio.play();
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

  playbackBtnContainer.innerHTML = "";
  playbackBtnContainer.style.display = "none";
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
