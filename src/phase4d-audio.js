// Phase 4D: stronger, clearer synthesized sound with a shared compressor.
let stage4dMasterGain = null;
let stage4dCompressor = null;

function stage4dEnsureAudioGraph() {
  audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
  if (!stage4dMasterGain) {
    stage4dCompressor = audioContext.createDynamicsCompressor();
    stage4dCompressor.threshold.value = -20;
    stage4dCompressor.knee.value = 14;
    stage4dCompressor.ratio.value = 7;
    stage4dCompressor.attack.value = 0.004;
    stage4dCompressor.release.value = 0.16;

    stage4dMasterGain = audioContext.createGain();
    stage4dMasterGain.gain.value = 0.92;
    stage4dCompressor.connect(stage4dMasterGain);
    stage4dMasterGain.connect(audioContext.destination);
  }
  return audioContext;
}

playTone = function playStage4dTone(frequency = 440, duration = 0.06, volume = 0.035, type = 'sine') {
  if (!soundEnabled) return;
  try {
    const ctx = stage4dEnsureAudioGraph();
    const now = ctx.currentTime;
    const boostedVolume = clamp(volume * 1.9, 0.018, 0.13);
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(45, frequency), now);
    if (type === 'sawtooth' || type === 'square') {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(42, frequency * 0.86), now + duration);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(boostedVolume, now + Math.min(0.009, duration * 0.22));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.035, duration));
    oscillator.connect(gain);
    gain.connect(stage4dCompressor);
    oscillator.start(now);
    oscillator.stop(now + Math.max(0.04, duration) + 0.015);

    if (frequency < 240 && volume >= 0.045) {
      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(Math.max(42, frequency * 0.52), now);
      subGain.gain.setValueAtTime(0.0001, now);
      subGain.gain.exponentialRampToValueAtTime(boostedVolume * 0.62, now + 0.006);
      subGain.gain.exponentialRampToValueAtTime(0.0001, now + duration * 1.15);
      sub.connect(subGain);
      subGain.connect(stage4dCompressor);
      sub.start(now);
      sub.stop(now + duration * 1.15 + 0.02);
    }
  } catch {
    // Audio must never interrupt gameplay.
  }
};

function playStage4dSound(name) {
  if (!soundEnabled) return;
  const sequences = {
    panel: [[620, 0, 0.055, 0.035, 'triangle']],
    upgrade: [[660, 0, 0.075, 0.045, 'triangle'], [920, 65, 0.09, 0.04, 'sine']],
    combo: [[520, 0, 0.1, 0.05, 'triangle'], [700, 80, 0.11, 0.05, 'triangle'], [980, 165, 0.16, 0.055, 'sine']],
    wave: [[150, 0, 0.18, 0.07, 'sawtooth'], [225, 90, 0.16, 0.055, 'square']],
    level: [[760, 0, 0.09, 0.045, 'triangle'], [1020, 72, 0.14, 0.05, 'sine']],
  };
  for (const [frequency, delay, duration, volume, type] of sequences[name] || []) {
    window.setTimeout(() => playTone(frequency, duration, volume, type), delay);
  }
}

const stage4dTriggerWaveAudioBase = triggerWave;
triggerWave = function triggerStage4dWave() {
  stage4dTriggerWaveAudioBase();
  playStage4dSound('wave');
};

const stage4dShowUpgradeAudioBase = showUpgradeChoices;
showUpgradeChoices = function showStage4dUpgradeChoices() {
  stage4dShowUpgradeAudioBase();
  if (state === 'upgrading') playStage4dSound('level');
};
