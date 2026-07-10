// Phase 4A patch: endless survival, speed hierarchy, escort logic and weapon rebalance.
ui.dangerLevel = document.querySelector('#dangerLevel');
ui.waveNotice = document.querySelector('#waveNotice');

CONFIG.gameDuration = 300;
CONFIG.foxSpawnIntervalStart = 2.25;
CONFIG.foxSpawnIntervalMin = 0.48;

WEAPONS.sword.attackInterval = 0.68;
WEAPONS.sword.damage = 37;
WEAPONS.sword.range = 78;
WEAPONS.sword.knockback = 22;

WEAPONS.spear.attackInterval = 1.15;
WEAPONS.spear.damage = 0;
WEAPONS.spear.damageOut = 17;
WEAPONS.spear.damageBack = 18;
WEAPONS.spear.range = 300;
WEAPONS.spear.knockback = 10;
WEAPONS.spear.projectileSpeed = 400;
WEAPONS.spear.maxPierce = 4;
WEAPONS.spear.dashEvery = 4;
WEAPONS.spear.dashDistance = 112;
WEAPONS.spear.dashDamage = 18;

WEAPONS.hammer.attackInterval = 1.45;
WEAPONS.hammer.damage = 78;
WEAPONS.hammer.range = 108;
WEAPONS.hammer.knockback = 58;
WEAPONS.hammer.slamRadius = 96;
WEAPONS.hammer.stunDuration = 0.78;
WEAPONS.hammer.windup = 0.28;

FOX_TYPES.normal.speed = 155;
FOX_TYPES.normal.healthMultiplier = 1;
FOX_TYPES.swift.speed = 190;
FOX_TYPES.swift.healthMultiplier = 0.72;
FOX_TYPES.brute.speed = 115;
FOX_TYPES.brute.healthMultiplier = 2.15;

let dangerLevel = 1;
let nextWaveAt = 25;
let waveRemaining = 0;
let waveSpawnTimer = 0;
let waveNoticeTimer = 0;

const ENDLESS_CONFIG = {
  playerSpeed: 205,
  chickSpeed: 155,
  waveInterval: 25,
  dangerInterval: 30,
  mobileFoxLimit: 24,
  desktopFoxLimit: 30,
};

formatEndlessTime = function formatEndlessTime(secondsValue) {
  const total = Math.max(0, Math.floor(secondsValue));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

readBestRecord = function readEndlessBestRecord() {
  try {
    const raw = window.localStorage.getItem('chickenRunEndlessBest');
    if (!raw) return null;
    const record = JSON.parse(raw);
    return Number.isFinite(record.elapsed) ? record : null;
  } catch {
    return null;
  }
};

storeBestRecord = function storeEndlessBestRecord(record) {
  try {
    window.localStorage.setItem('chickenRunEndlessBest', JSON.stringify(record));
  } catch {
    // Local storage is optional.
  }
};

updateBestText = function updateEndlessBestText() {
  const best = readBestRecord();
  ui.bestText.textContent = best
    ? `最长坚持：${formatEndlessTime(best.elapsed)} · ${best.chicks} 只小鸡`
    : '最长坚持：尚无纪录';
};

createPlayer = function createEndlessPlayer() {
  const definition = WEAPONS[selectedWeapon];
  return {
    x: world.width / 2,
    y: world.height / 2,
    radius: 16,
    speed: ENDLESS_CONFIG.playerSpeed,
    health: 100,
    maxHealth: 100,
    armor: 0,
    invulnerableFor: 0,
    damageReductionFor: 0,
    facing: { x: 1, y: 0 },
    moving: { x: 0, y: 0 },
    weapon: selectedWeapon,
    attackInterval: definition.attackInterval,
    attackRange: definition.range,
    attackDamage: definition.damage || 0,
    damageOut: definition.damageOut || 0,
    damageBack: definition.damageBack || 0,
    knockback: definition.knockback,
    projectileSpeed: definition.projectileSpeed || 0,
    maxPierce: definition.maxPierce || 0,
    dashEvery: definition.dashEvery || 0,
    dashDistance: definition.dashDistance || 0,
    dashDamage: definition.dashDamage || 0,
    spearThrows: 0,
    spearBusy: false,
    slamRadius: definition.slamRadius || 0,
    stunDuration: definition.stunDuration || 0,
    hammerWindupBase: definition.windup || 0,
    hammerWindup: 0,
    hammerDirection: null,
    chickAura: 118,
    chickPull: 68,
    rallyLevel: 0,
    rallyCooldown: 12,
    rallyPulseFor: 0,
    level: 1,
    experience: 0,
    experienceNeeded: 4,
  };
};

resetGame = function resetEndlessGame() {
  elapsed = 0;
  timeRemaining = 0;
  spawnTimer = 0.8;
  attackTimer = 0.2;
  foxesDefeated = 0;
  cameraShake = 0;
  dangerLevel = 1;
  nextWaveAt = ENDLESS_CONFIG.waveInterval;
  waveRemaining = 0;
  waveSpawnTimer = 0;
  waveNoticeTimer = 0;
  player = createPlayer();

  chicks = [];
  foxes = [];
  particles = [];
  swordSlashes = [];
  spearShots = [];
  hammerSlams = [];
  dashTrails = [];
  createDecorations();
  resetJoystick();
  ui.waveNotice.classList.add('hidden');

  for (let index = 0; index < CONFIG.chickCount; index += 1) {
    const angle = (index / CONFIG.chickCount) * Math.PI * 2;
    const radius = random(72, 145);
    chicks.push({
      id: index,
      x: player.x + Math.cos(angle) * radius,
      y: player.y + Math.sin(angle) * radius,
      radius: 10,
      phase: random(0, Math.PI * 2),
      wanderAngle: random(0, Math.PI * 2),
      carriedBy: null,
      lost: false,
      protectedFor: 0,
    });
  }

  camera.x = player.x;
  camera.y = player.y;
  updateCamera(0, true);
  updateHud();
};

finishGame = function finishEndlessGame() {
  if (state === 'result') return;
  state = 'result';
  cameraShake = 0;
  resetJoystick();
  ui.hud.classList.add('hidden');
  ui.upgradePanel.classList.add('hidden');
  ui.waveNotice.classList.add('hidden');
  ui.resultPanel.classList.remove('hidden');

  const alive = chicks.filter((chick) => !chick.lost).length;
  const previousBest = readBestRecord();
  const isNewBest = !previousBest || elapsed > previousBest.elapsed;

  if (isNewBest) {
    storeBestRecord({
      elapsed,
      chicks: alive,
      foxes: foxesDefeated,
      weapon: player.weapon,
      danger: dangerLevel,
    });
  }

  ui.resultEmoji.textContent = alive > 0 ? '🛡️' : '🦊';
  ui.resultTitle.textContent = '本次坚持结束';
  ui.resultText.textContent =
    `你使用${WEAPONS[player.weapon].name}坚持了 ${formatEndlessTime(elapsed)}，` +
    `守住 ${alive} 只小鸡，击退 ${foxesDefeated} 只狐狸，危险等级 ${dangerLevel}。`;
  ui.resultBest.textContent = isNewBest
    ? '✨ 新的最长生存纪录！'
    : '继续调整构筑，争取坚持更久。';
  updateBestText();
  playTone(170, 0.3, 0.06, 'sawtooth');
};

updateHud = function updateEndlessHud() {
  if (!player) return;
  const alive = chicks.filter((chick) => !chick.lost).length;
  ui.chicksAlive.textContent = String(alive);
  ui.foxesDefeated.textContent = String(foxesDefeated);
  ui.level.textContent = String(player.level);
  ui.dangerLevel.textContent = String(dangerLevel);
  ui.weaponIcon.textContent = WEAPONS[player.weapon].icon;
  ui.weaponName.textContent = WEAPONS[player.weapon].name;
  ui.xpBar.style.width = `${clamp(player.experience / player.experienceNeeded, 0, 1) * 100}%`;
  ui.timer.textContent = formatEndlessTime(elapsed);
};

currentFoxLimit = function currentEndlessFoxLimit() {
  return isTouchDevice() ? ENDLESS_CONFIG.mobileFoxLimit : ENDLESS_CONFIG.desktopFoxLimit;
};

chooseFoxType = function chooseEndlessFoxType() {
  const roll = Math.random();
  const bruteChance = clamp((dangerLevel - 3) * 0.035, 0, 0.24);
  const swiftChance = clamp(0.12 + (dangerLevel - 1) * 0.028, 0.12, 0.42);
  if (roll < bruteChance) return 'brute';
  if (roll < bruteChance + swiftChance) return 'swift';
  return 'normal';
};

spawnFox = function spawnEndlessFox(forcedType = null) {
  if (foxes.length >= currentFoxLimit()) return false;
  const position = spawnPointNearCamera();
  const type = forcedType || chooseFoxType();
  const definition = FOX_TYPES[type];
  const baseHealth = 70 + Math.max(0, dangerLevel - 1) * 4;

  foxes.push({
    x: position.x,
    y: position.y,
    radius: definition.radius,
    speed: definition.speed,
    health: baseHealth * definition.healthMultiplier,
    maxHealth: baseHealth * definition.healthMultiplier,
    type,
    xp: definition.xp,
    target: null,
    carrying: null,
    hitFlash: 0,
    stunnedFor: 0,
    dead: false,
  });
  return true;
};

triggerWave = function triggerEndlessWave() {
  waveRemaining += Math.min(14, 4 + dangerLevel * 2);
  waveSpawnTimer = 0;
  waveNoticeTimer = 2.1;
  ui.waveNotice.textContent = `⚠ 狐狸潮来袭 · 危险 ${dangerLevel}`;
  ui.waveNotice.classList.remove('hidden');
  playTone(250, 0.18, 0.055, 'sawtooth');
};

updateDirector = function updateEndlessDirector(deltaTime) {
  dangerLevel = 1 + Math.floor(elapsed / ENDLESS_CONFIG.dangerInterval);

  if (elapsed >= nextWaveAt) {
    triggerWave();
    nextWaveAt += ENDLESS_CONFIG.waveInterval;
  }

  if (waveNoticeTimer > 0) {
    waveNoticeTimer -= deltaTime;
    if (waveNoticeTimer <= 0) ui.waveNotice.classList.add('hidden');
  }

  if (waveRemaining > 0) {
    waveSpawnTimer -= deltaTime;
    if (waveSpawnTimer <= 0 && foxes.length < currentFoxLimit()) {
      const forcedType =
        dangerLevel >= 5 && waveRemaining % 5 === 0
          ? 'brute'
          : dangerLevel >= 2 && waveRemaining % 3 === 0
            ? 'swift'
            : null;
      if (spawnFox(forcedType)) waveRemaining -= 1;
      waveSpawnTimer = Math.max(0.13, 0.28 - dangerLevel * 0.008);
    }
  }

  spawnTimer -= deltaTime;
  if (spawnTimer <= 0 && foxes.length < currentFoxLimit()) {
    spawnFox();
    spawnTimer = Math.max(
      CONFIG.foxSpawnIntervalMin,
      CONFIG.foxSpawnIntervalStart - elapsed * 0.012,
    );
  }
};

nearestAvailableChick = function nearestUnprotectedChick(fox) {
  let best = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const chick of chicks) {
    if (chick.lost || chick.carriedBy || chick.protectedFor > 0) continue;
    const distance = distanceSquared(fox, chick);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = chick;
    }
  }
  return best;
};
