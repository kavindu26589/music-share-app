const peer = new Peer();
let call;
let mixedStream;

const statusEl = document.getElementById("status");

peer.on("open", id => {
  document.getElementById("my-id").textContent = id;
});

peer.on("call", incomingCall => {
  incomingCall.answer(); // no stream sent back
  incomingCall.on("stream", stream => {
    const audio = new Audio();
    audio.srcObject = stream;
    audio.play();
    statusEl.textContent = "📡 Receiving stream from caller.";
  });
});

async function startCall() {
  const peerId = document.getElementById("peer-id").value;
  statusEl.textContent = "🔄 Preparing stream...";

  try {
    const tracks = [];

    // Try to capture system audio
    let displayStream;
    try {
      displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: false,
        audio: true
      });
    } catch (err) {
      console.warn("System audio not supported, skipping...", err);
    }

    // Always try to get mic audio
    const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const audioContext = new AudioContext();
    const destination = audioContext.createMediaStreamDestination();

    if (displayStream) {
      const sysSource = audioContext.createMediaStreamSource(displayStream);
      sysSource.connect(destination);
    }

    const micSource = audioContext.createMediaStreamSource(micStream);
    micSource.connect(destination);

    // Final mixed stream
    mixedStream = destination.stream;

    call = peer.call(peerId, mixedStream);
    call.on("stream", stream => {
      const remoteAudio = new Audio();
      remoteAudio.srcObject = stream;
      remoteAudio.play();
      statusEl.textContent = "✅ Connected and streaming.";
    });

    statusEl.textContent = "📞 Calling peer...";
  } catch (err) {
    alert("Failed to capture audio: " + err.message);
    console.error(err);
    statusEl.textContent = "❌ Error: " + err.message;
  }
}

function stopCall() {
  if (call) {
    call.close();
    call = null;
    statusEl.textContent = "🔌 Call stopped.";
  }
  if (mixedStream) {
    mixedStream.getTracks().forEach(track => track.stop());
  }
}
