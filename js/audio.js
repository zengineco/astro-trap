// ===== audio.js — Web Audio sound effects =====
const Audio = (() => {
  let ctx = null;
  let enabled = true;

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }

  function tone(freq, duration, type = 'sine', vol = 0.15, startDelay = 0) {
    if (!enabled) return;
    try {
      const ac = getCtx();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ac.currentTime + startDelay);
      gain.gain.setValueAtTime(0, ac.currentTime + startDelay);
      gain.gain.linearRampToValueAtTime(vol, ac.currentTime + startDelay + 0.01);
      gain.gain.linearRampToValueAtTime(0, ac.currentTime + startDelay + duration);
      osc.start(ac.currentTime + startDelay);
      osc.stop(ac.currentTime + startDelay + duration + 0.01);
    } catch(e) {}
  }

  function noise(duration, vol = 0.1) {
    if (!enabled) return;
    try {
      const ac = getCtx();
      const bufSize = ac.sampleRate * duration;
      const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1);
      const src = ac.createBufferSource();
      src.buffer = buf;
      const gain = ac.createGain();
      src.connect(gain);
      gain.connect(ac.destination);
      gain.gain.setValueAtTime(vol, ac.currentTime);
      gain.gain.linearRampToValueAtTime(0, ac.currentTime + duration);
      src.start();
    } catch(e) {}
  }

  return {
    setEnabled(v) { enabled = v; },
    isEnabled() { return enabled; },

    wallStart() {
      tone(440, 0.08, 'sawtooth', 0.08);
    },

    wallBuilding() {
      // Called periodically while wall grows — subtle hum handled by loop
    },

    bounce() {
      const freqs = [220, 330, 440, 550];
      const f = freqs[Math.floor(Math.random() * freqs.length)];
      tone(f, 0.06, 'triangle', 0.12);
    },

    wallFail() {
      tone(180, 0.12, 'sawtooth', 0.2);
      tone(120, 0.18, 'sawtooth', 0.15, 0.1);
      noise(0.15, 0.2);
    },

    sectorCaptured() {
      tone(523, 0.1, 'sine', 0.15);
      tone(659, 0.1, 'sine', 0.12, 0.08);
      tone(784, 0.15, 'sine', 0.12, 0.16);
      tone(1047, 0.2, 'sine', 0.1, 0.25);
    },

    levelComplete() {
      [523, 659, 784, 1047, 1319].forEach((f, i) => {
        tone(f, 0.15, 'sine', 0.12, i * 0.09);
      });
    },

    gameOver() {
      tone(330, 0.2, 'sawtooth', 0.15);
      tone(220, 0.3, 'sawtooth', 0.12, 0.18);
      tone(110, 0.5, 'sawtooth', 0.1, 0.4);
    }
  };
})();
