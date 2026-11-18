// Stage 4F: dynamic difficulty director. Load after every previous phase patch.
// The director modifies future spawns only; existing enemies and skill growth are untouched.
const PHASE4F = Object.freeze({
  cycle: 120, sampleEvery: 5, adjustEvery: 15, warmup: 18,
  minMultiplier: 0.65, maxMultiplier: 2.6,
  phases: {
    easy: { label: '休整', target: 18, spawn: 0.72, wave: 0.7 },
    threat: { label: '有威胁', target: 47, spawn: 1, wave: 1 },
    hard: { label: '困难', target: 78, spawn: 1.35, wave: 1.5 },
  },
  buffs: {
    swift: { label: '疾行', speed: 1.15, hp: 1 },
    armored: { label: '厚皮', speed: 1, hp: 1.2 },
    surround: { label: '围猎', speed: 1, hp: 1 },
  },
});

let phase4f = null;
function phase4fReset() {
  phase4f = {
    pressure: 15, multiplier: 1, phase: 'easy',
    samples: [], sampleClock: 0, adjustClock: 0,
    spawned: 0, killed: 0, damage: 0, lost: 0, grabs: 0,
    priorCarried: new Set(), priorLost: new Set(),
    activeBuff: null, waveSerial: 0, waveSpawning: false,
    nextWaveAt: ENDLESS_CONFIG.waveInterval,
    lastHealth: 100, hudTick: -1, lastDecision: '初始缓冲',
  };
}
phase4fReset();

// Each 120-second cycle allocates exactly 30s easy, 60s threat and 30s hard.
// Rotate the segment order per cycle so the player cannot memorize the spikes.
function phase4fScheduledPhase(seconds) {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const cycle = Math.floor(safeSeconds / PHASE4F.cycle);
  const within = safeSeconds % PHASE4F.cycle;
  const orders = [
    [['easy', 30], ['threat', 60], ['hard', 30]],
    [['threat', 30], ['hard', 30], ['threat', 30], ['easy', 30]],
    [['hard', 30], ['threat', 30], ['easy', 30], ['threat', 30]],
  ];
  let remaining = within;
  for (const [name, duration] of orders[cycle % orders.length]) {
    if (remaining < duration) return name;
    remaining -= duration;
  }
  return 'threat';
}

function phase4fMeasure() {
  if (!player) return;
  let near = 0;
  let totalAge = 0;
  let living = 0;
  for (const fox of foxes) {
    if (fox.dead || fox.health <= 0) continue;
    living += 1;
    totalAge += Math.max(0, elapsed - (fox.phase4fBornAt ?? elapsed));
    if ((fox.x - player.x) ** 2 + (fox.y - player.y) ** 2 < 180 ** 2) near += 1;
  }
  const alive = chicks.filter(chick => !chick.lost).length;
  const windowSpawns = phase4f.spawned;
  const killEfficiency = windowSpawns > 0
    ? clamp(phase4f.killed / Math.max(1, windowSpawns), 0, 1)
    : (living === 0 ? 1 : 0.5);
  const clearPressure = clamp(
    100 * (0.48 * (1 - killEfficiency)
      + 0.32 * clamp(living / Math.max(1, currentFoxLimit()), 0, 1)
      + 0.2 * clamp((totalAge / Math.max(1, living)) / 8, 0, 1)), 0, 100);
  const chickPressure = clamp(
    phase4f.lost * 36 + phase4f.grabs * 17
    + Math.max(0, chicks.length - alive) * 7, 0, 100);
  const healthPressure = clamp(
    phase4f.damage / Math.max(1, player.maxHealth) * 250
    + (1 - player.health / Math.max(1, player.maxHealth)) * 42, 0, 100);
  const proximityPressure = clamp(near / 9 * 100, 0, 100);
  const measured = 0.35 * clearPressure + 0.30 * chickPressure
    + 0.25 * healthPressure + 0.10 * proximityPressure;
  phase4f.samples.push(measured);
  if (phase4f.samples.length > 3) phase4f.samples.shift();
  const mean = phase4f.samples.reduce((sum, item) => sum + item, 0) / phase4f.samples.length;
  phase4f.pressure = clamp(phase4f.pressure * 0.45 + mean * 0.55, 0, 100);
  phase4f.spawned = 0;
  phase4f.killed = 0;
  phase4f.damage = 0;
  phase4f.lost = 0;
  phase4f.grabs = 0;
}

function phase4fSafety() {
  const healthRatio = player.health / Math.max(1, player.maxHealth);
  const liveChicks = chicks.filter(chick => !chick.lost).length;
  // A newly grown group is not automatically critical just for being small.
  // Only classify flock attrition after enough chicks have joined.
  const criticalFlock = chicks.length >= 6 && liveChicks <= Math.ceil(chicks.length * 0.3);
  const inDanger = healthRatio < 0.25 || liveChicks === 0 || criticalFlock;
  return { inDanger, healthRatio, liveChicks };
}

function phase4fAdjust() {
  const { inDanger } = phase4fSafety();
  if (inDanger) {
    // Never change active enemies. Stop increasing *future* spawn pressure.
    phase4f.multiplier = Math.max(PHASE4F.minMultiplier, phase4f.multiplier * 0.8);
    phase4f.lastDecision = '危险保护：减压';
    return;
  }
  const target = PHASE4F.phases[phase4f.phase].target;
  const difference = target - phase4f.pressure;
  if (Math.abs(difference) < 9) {
    phase4f.lastDecision = '压力合适';
    return;
  }
  // Clamp to +/-20% per adjustment and an overall bound.
  const change = clamp(1 + difference * 0.012, 0.8, 1.2);
  phase4f.multiplier = clamp(
    phase4f.multiplier * change, PHASE4F.minMultiplier, PHASE4F.maxMultiplier);
  phase4f.lastDecision = difference > 0 ? '增加后续怪潮' : '降低后续怪潮';
}

function phase4fCaptureChicks() {
  const carrying = new Set();
  const lost = new Set();
  for (const chick of chicks) {
    if (chick.carriedBy) {
      carrying.add(chick.id);
      if (!phase4f.priorCarried.has(chick.id)) phase4f.grabs += 1;
    }
    if (chick.lost) {
      lost.add(chick.id);
      if (!phase4f.priorLost.has(chick.id)) phase4f.lost += 1;
    }
  }
  phase4f.priorCarried = carrying;
  phase4f.priorLost = lost;
}

function phase4fWaveBuff() {
  if (phase4f.phase === 'easy' || phase4fSafety().inDanger) return null;
  const options = phase4f.phase === 'hard'
    ? ['swift', 'armored', 'surround'] : ['swift', 'surround'];
  return options[phase4f.waveSerial % options.length];
}

// Keep the original spawn implementation and its platform-specific entity cap.
const phase4fSpawnBase = spawnFox;
spawnFox = function spawnPhase4fFox(forcedType = null) {
  const before = foxes.length;
  const spawned = phase4fSpawnBase(forcedType);
  if (!spawned || foxes.length <= before) return spawned;
  const fox = foxes[foxes.length - 1];
  fox.phase4fBornAt = elapsed;
  phase4f.spawned += 1;
  if (phase4f.waveSpawning && phase4f.activeBuff) {
    const buff = PHASE4F.buffs[phase4f.activeBuff];
    fox.speed *= buff.speed;
    fox.health *= buff.hp;
    fox.maxHealth *= buff.hp;
    fox.phase4fBuff = phase4f.activeBuff;
  }
  return spawned;
};

// Record real kills through the last progression decorator (do not award XP twice).
const phase4fDefeatBase = defeatFox;
defeatFox = function defeatPhase4fFox(fox) {
  const wasAlive = !fox.dead && fox.health <= 0;
  phase4fDefeatBase(fox);
  if (wasAlive && fox.dead) phase4f.killed += 1;
};

// Replace only the fixed-time director; preserve its HUD alert, timing and caps.
updateDirector = function updatePhase4fDirector(deltaTime) {
  if (!phase4f || !player) return;
  const nextPhase = phase4fScheduledPhase(elapsed);
  if (phase4f.phase !== nextPhase) phase4f.phase = nextPhase;
  dangerLevel = 1 + Math.floor(elapsed / ENDLESS_CONFIG.dangerInterval);

  if (elapsed >= phase4f.nextWaveAt) {
    const { inDanger } = phase4fSafety();
    const difficulty = PHASE4F.phases[phase4f.phase];
    const buff = phase4fWaveBuff();
    const baseline = Math.min(14, 4 + dangerLevel * 2);
    const countMultiplier = difficulty.wave * phase4f.multiplier * (inDanger ? 0.65 : 1);
    const burst = Math.max(2, Math.min(22, Math.round(baseline * countMultiplier)));
    // Limit queued enemies to avoid growing a wave backlog when screen is full.
    waveRemaining = Math.min(24, waveRemaining + burst);
    phase4f.activeBuff = buff;
    phase4f.waveSerial += 1;
    waveSpawnTimer = 0;
    waveNoticeTimer = 2.1;
    ui.waveNotice.textContent = '⚠ 狐狸潮 · ' + difficulty.label
      + (buff ? ' · ' + PHASE4F.buffs[buff].label : '');
    ui.waveNotice.classList.remove('hidden');
    playTone(250, 0.18, 0.055, 'sawtooth');
    phase4f.nextWaveAt += ENDLESS_CONFIG.waveInterval;
    nextWaveAt = phase4f.nextWaveAt; // maintain existing state for other patches
  }

  if (waveNoticeTimer > 0) {
    waveNoticeTimer -= deltaTime;
    if (waveNoticeTimer <= 0) ui.waveNotice.classList.add('hidden');
  }

  const { inDanger } = phase4fSafety();
  if (waveRemaining > 0) {
    waveSpawnTimer -= deltaTime;
    if (waveSpawnTimer <= 0 && foxes.length < currentFoxLimit()) {
      let forcedType = dangerLevel >= 5 && waveRemaining % 5 === 0
        ? 'brute' : dangerLevel >= 2 && waveRemaining % 3 === 0 ? 'swift' : null;
      if (phase4f.activeBuff === 'swift' && waveRemaining % 2 === 0) forcedType = 'swift';
      if (phase4f.activeBuff === 'armored' && waveRemaining % 3 === 0) forcedType = 'brute';
      phase4f.waveSpawning = true;
      let success;
      try { success = spawnFox(forcedType); }
      finally { phase4f.waveSpawning = false; }
      if (success) waveRemaining -= 1;
      // "surround" uses tighter successive waves from the already randomized edges.
      const buffPace = phase4f.activeBuff === 'surround' ? 0.8 : 1;
      waveSpawnTimer = Math.max(0.12,
        (0.28 - dangerLevel * 0.008) * buffPace / Math.sqrt(phase4f.multiplier));
    }
  }

  spawnTimer -= deltaTime;
  if (spawnTimer <= 0 && foxes.length < currentFoxLimit()) {
    spawnFox();
    const baseInterval = Math.max(CONFIG.foxSpawnIntervalMin,
      CONFIG.foxSpawnIntervalStart - elapsed * 0.012);
    const phaseScale = PHASE4F.phases[phase4f.phase].spawn;
    const effective = phaseScale * phase4f.multiplier * (inDanger ? 0.65 : 1);
    spawnTimer = Math.max(0.16, baseInterval / effective);
  }
};

// After the existing update pipeline, measure damage and changes in chick status.
const phase4fUpdateBase = update;
update = function updatePhase4fGame(deltaTime) {
  const priorHealth = player?.health ?? 0;
  phase4fUpdateBase(deltaTime);
  if (!player || !phase4f) return;
  phase4f.damage += Math.max(0, priorHealth - player.health);
  phase4fCaptureChicks();
  if (state !== 'playing') return;
  phase4f.sampleClock += deltaTime;
  phase4f.adjustClock += deltaTime;
  if (phase4f.sampleClock >= PHASE4F.sampleEvery) {
    phase4f.sampleClock %= PHASE4F.sampleEvery;
    phase4fMeasure();
  }
  if (phase4f.adjustClock >= PHASE4F.adjustEvery) {
    phase4f.adjustClock %= PHASE4F.adjustEvery;
    if (elapsed >= PHASE4F.warmup) phase4fAdjust();
  }
};

const phase4fResetBase = resetGame;
resetGame = function resetPhase4fGame() {
  phase4fReset();
  phase4fResetBase();
  phase4f.lastHealth = player?.health ?? 100;
};

// Attach compact feedback without altering existing hud or progression decorators.
const phase4fPill = document.createElement('div');
phase4fPill.className = 'pill phase4f-pill';
phase4fPill.setAttribute('aria-label', '动态难度状态');
phase4fPill.title = '危险系数根据玩家受伤、鸡群安全、清场效率与附近狐狸计算';
document.querySelector('#hud .hud-left')?.appendChild(phase4fPill);
const phase4fHudBase = updateHud;
updateHud = function updatePhase4fHud(force = false) {
  phase4fHudBase(force);
  if (!player || !phase4f) return;
  const displaySecond = Math.floor(elapsed);
  if (displaySecond === phase4f.hudTick) return;
  phase4f.hudTick = displaySecond;
  phase4fPill.textContent = '压力 ' + Math.round(phase4f.pressure)
    + ' · ' + PHASE4F.phases[phase4f.phase].label;
  phase4fPill.title = '动态难度：' + phase4f.lastDecision
    + ' · 调节倍率 ' + phase4f.multiplier.toFixed(2) + '×';
};
