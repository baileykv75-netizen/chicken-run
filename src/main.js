const canvas = document.querySelector('#game');
const context = canvas.getContext('2d');

const ui = {
  hud: document.querySelector('#hud'),
  chicksAlive: document.querySelector('#chicksAlive'),
  foxesDefeated: document.querySelector('#foxesDefeated'),
  level: document.querySelector('#level'),
  xpBar: document.querySelector('#xpBar'),
  timer: document.querySelector('#timer'),
  pauseButton: document.querySelector('#pauseButton'),
  startPanel: document.querySelector('#startPanel'),
  startButton: document.querySelector('#startButton'),
  bestText: document.querySelector('#bestText'),
  pausePanel: document.querySelector('#pausePanel'),
  resumeButton: document.querySelector('#resumeButton'),
  restartFromPauseButton: document.querySelector('#restartFromPauseButton'),
  upgradePanel: document.querySelector('#upgradePanel'),
  upgradeChoices: document.querySelector('#upgradeChoices'),
  resultPanel: document.querySelector('#resultPanel'),
  resultEmoji: document.querySelector('#resultEmoji'),
  resultTitle: document.querySelector('#resultTitle'),
  resultText: document.querySelector('#resultText'),
  resultBest: document.querySelector('#resultBest'),
  restartButton: document.querySelector('#restartButton'),
  joystick: document.querySelector('#joystick'),
  joystickKnob: document.querySelector('#joystickKnob'),
  soundButton: document.querySelector('#soundButton'),
};

const CONFIG = {
  gameDuration: 180,
  chickCount: 10,
  playerSpeed: 240,
  playerAttackInterval: 0.68,
  playerAttackRange: 86,
  playerAttackDamage: 42,
  playerKnockback: 18,
  foxSpawnIntervalStart: 2.8,
  foxSpawnIntervalMin: 0.95,
};

const FOX_TYPES = {
  normal: {
    color: '#ee7d38',
    healthMultiplier: 1,
    speedMultiplier: 1,
    radius: 18,
    xp: 1,
  },
  swift: {
    color: '#f08d45',
    healthMultiplier: 0.72,
    speedMultiplier: 1.42,
    radius: 15,
    xp: 1,
  },
  brute: {
    color: '#c85f32',
    healthMultiplier: 2.15,
    speedMultiplier: 0.72,
    radius: 23,
    xp: 3,
  },
};

const UPGRADE_DEFINITIONS = [
  {
    id: 'damage',
    icon: '⚔️',
    name: '锋利长剑',
    description: '挥剑伤害提高 30%',
    apply: () => {
      player.attackDamage *= 1.3;
    },
  },
  {
    id: 'rate',
    icon: '✨',
    name: '连斩',
    description: '攻击间隔缩短 16%',
    apply: () => {
      player.attackInterval = Math.max(0.26, player.attackInterval * 0.84);
    },
  },
  {
    id: 'range',
    icon: '🌙',
    name: '月牙剑气',
    description: '攻击范围扩大 18%',
    apply: () => {
      player.attackRange *= 1.18;
    },
  },
  {
    id: 'speed',
    icon: '👢',
    name: '轻快脚步',
    description: '移动速度提高 15%',
    apply: () => {
      player.speed *= 1.15;
    },
  },
  {
    id: 'rally',
    icon: '🔔',
    name: '牧鸡铃',
    description: '小鸡更快回到你身边',
    apply: () => {
      player.chickAura += 28;
      player.chickPull += 12;
    },
  },
  {
    id: 'health',
    icon: '❤️',
    name: '鸡舍护符',
    description: '生命上限 +25，并恢复 35 点',
    apply: () => {
      player.maxHealth += 25;
      player.health = Math.min(player.maxHealth, player.health + 35);
    },
  },
  {
    id: 'knockback',
    icon: '💥',
    name: '强力击退',
    description: '击退距离提高 35%',
    apply: () => {
      player.knockback *= 1.35;
    },
  },
  {
    id: 'armor',
    icon: '🛡️',
    name: '稻草护甲',
    description: '受到的伤害降低 15%',
    apply: () => {
      player.armor = Math.min(0.6, player.armor + 0.15);
    },
  },
];

let width = window.innerWidth;
let height = window.innerHeight;
let deviceScale = 1;
let state = 'menu';
let previousTime = performance.now();
let elapsed = 0;
let timeRemaining = CONFIG.gameDuration;
let spawnTimer = 0;
let attackTimer = 0;
let foxesDefeated = 0;
let cameraShake = 0;
let soundEnabled = readSoundPreference();

let player;
let chicks = [];
let foxes = [];
let swordSlashes = [];
let particles = [];
let decorations = [];

const keys = new Set();
const joystick = {
  active: false,
  pointerId: null,
  centerX: 0,
  centerY: 0,
  x: 0,
  y: 0,
  radius: 38,
};

let audioContext = null;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const random = (min, max) => min + Math.random() * (max - min);
const distanceSquared = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

function normalized(x, y) {
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

function circlesOverlap(a, b, extra = 0) {
  const radius = a.radius + b.radius + extra;
  return distanceSquared(a, b) <= radius * radius;
}

function readSoundPreference() {
  try {
    return window.localStorage.getItem('chickenRunSound') !== 'off';
  } catch {
    return true;
  }
}

function storeSoundPreference() {
  try {
    window.localStorage.setItem('chickenRunSound', soundEnabled ? 'on' : 'off');
  } catch {
    // Local storage is optional.
  }
}

function readBestRecord() {
  try {
    const raw = window.localStorage.getItem('chickenRunBest');
    if (!raw) return null;
    const record = JSON.parse(raw);
    if (!Number.isFinite(record.score)) return null;
    return record;
  } catch {
    return null;
  }
}

function storeBestRecord(record) {
  try {
    window.localStorage.setItem('chickenRunBest', JSON.stringify(record));
  } catch {
    // Local storage is optional.
  }
}

function playTone(frequency = 440, duration = 0.06, volume = 0.035, type = 'sine') {
  if (!soundEnabled) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.value = volume;
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
    oscillator.stop(audioContext.currentTime + duration);
  } catch {
    // Audio should never block gameplay.
  }
}

function updateSoundButton() {
  ui.soundButton.textContent = soundEnabled ? '🔊' : '🔇';
}

function updateBestText() {
  const best = readBestRecord();
  ui.bestText.textContent = best
    ? `最佳纪录：${best.chicks} 只小鸡 · ${best.foxes} 只狐狸`
    : '最佳纪录：尚未守夜';
}

function resizeCanvas() {
  width = window.innerWidth;
  height = window.innerHeight;
  deviceScale = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * deviceScale);
  canvas.height = Math.round(height * deviceScale);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
}

function createDecorations() {
  decorations = Array.from({ length: 78 }, () => ({
    x: random(20, Math.max(21, width - 20)),
    y: random(78, Math.max(79, height - 18)),
    size: random(2, 5),
    variant: Math.random(),
  }));
}

function createPlayer() {
  return {
    x: width / 2,
    y: height / 2,
    radius: 21,
    speed: CONFIG.playerSpeed,
    health: 100,
    maxHealth: 100,
    armor: 0,
    invulnerableFor: 0,
    facing: { x: 1, y: 0 },
    attackInterval: CONFIG.playerAttackInterval,
    attackRange: CONFIG.playerAttackRange,
    attackDamage: CONFIG.playerAttackDamage,
    knockback: CONFIG.playerKnockback,
    chickAura: 118,
    chickPull: 46,
    level: 1,
    experience: 0,
    experienceNeeded: 4,
  };
}

function resetGame() {
  elapsed = 0;
  timeRemaining = CONFIG.gameDuration;
  spawnTimer = 0.7;
  attackTimer = 0.25;
  foxesDefeated = 0;
  cameraShake = 0;
  player = createPlayer();

  chicks = [];
  foxes = [];
  swordSlashes = [];
  particles = [];
  createDecorations();

  for (let index = 0; index < CONFIG.chickCount; index += 1) {
    const angle = (index / CONFIG.chickCount) * Math.PI * 2;
    const radius = random(72, 145);
    chicks.push({
      id: index,
      x: width / 2 + Math.cos(angle) * radius,
      y: height / 2 + Math.sin(angle) * radius,
      radius: 13,
      phase: random(0, Math.PI * 2),
      wanderAngle: random(0, Math.PI * 2),
      carriedBy: null,
      lost: false,
    });
  }

  updateHud();
}

function startGame() {
  resetGame();
  state = 'playing';
  ui.startPanel.classList.add('hidden');
  ui.pausePanel.classList.add('hidden');
  ui.upgradePanel.classList.add('hidden');
  ui.resultPanel.classList.add('hidden');
  ui.hud.classList.remove('hidden');
  if (window.matchMedia('(pointer: coarse)').matches) {
    ui.joystick.classList.remove('hidden');
  }
  previousTime = performance.now();
  playTone(660, 0.1, 0.04);
}

function pauseGame() {
  if (state !== 'playing') return;
  state = 'paused';
  ui.pausePanel.classList.remove('hidden');
  ui.joystick.classList.add('hidden');
}

function resumeGame() {
  if (state !== 'paused') return;
  state = 'playing';
  ui.pausePanel.classList.add('hidden');
  if (window.matchMedia('(pointer: coarse)').matches) {
    ui.joystick.classList.remove('hidden');
  }
  previousTime = performance.now();
}

function finishGame(victory) {
  if (state === 'result') return;
  state = 'result';
  ui.hud.classList.add('hidden');
  ui.joystick.classList.add('hidden');
  ui.upgradePanel.classList.add('hidden');
  ui.resultPanel.classList.remove('hidden');

  const alive = chicks.filter((chick) => !chick.lost).length;
  const score = alive * 1000 + foxesDefeated * 25 + Math.floor(elapsed);
  const previousBest = readBestRecord();
  const isNewBest = !previousBest || score > previousBest.score;

  if (isNewBest) {
    storeBestRecord({
      score,
      chicks: alive,
      foxes: foxesDefeated,
      victory,
    });
  }

  ui.resultEmoji.textContent = victory ? '🌅' : '🦊';
  ui.resultTitle.textContent = victory ? '天亮了！' : '鸡舍失守';
  ui.resultText.textContent = `你守住了 ${alive} 只小鸡，并击退了 ${foxesDefeated} 只狐狸，升到 Lv.${player.level}。`;
  ui.resultBest.textContent = isNewBest ? '✨ 新的最佳纪录！' : '再试一次，争取守住更多小鸡。';
  updateBestText();
  playTone(victory ? 880 : 170, 0.3, 0.06, victory ? 'sine' : 'sawtooth');
}

function updateHud() {
  if (!player) return;
  const alive = chicks.filter((chick) => !chick.lost).length;
  ui.chicksAlive.textContent = String(alive);
  ui.foxesDefeated.textContent = String(foxesDefeated);
  ui.level.textContent = String(player.level);
  ui.xpBar.style.width = `${clamp(player.experience / player.experienceNeeded, 0, 1) * 100}%`;
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = Math.floor(timeRemaining % 60);
  ui.timer.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function chooseFoxType() {
  const roll = Math.random();
  if (elapsed > 105 && roll < 0.16) return 'brute';
  if (elapsed > 45 && roll < 0.38) return 'swift';
  return 'normal';
}

function spawnFox() {
  const side = Math.floor(random(0, 4));
  let x;
  let y;

  if (side === 0) {
    x = -32;
    y = random(80, height - 18);
  } else if (side === 1) {
    x = width + 32;
    y = random(80, height - 18);
  } else if (side === 2) {
    x = random(18, width - 18);
    y = 58;
  } else {
    x = random(18, width - 18);
    y = height + 32;
  }

  const type = chooseFoxType();
  const definition = FOX_TYPES[type];
  const baseHealth = 58 + elapsed * 0.08;

  foxes.push({
    x,
    y,
    radius: definition.radius,
    speed: (78 + Math.min(48, elapsed * 0.18)) * definition.speedMultiplier,
    health: baseHealth * definition.healthMultiplier,
    maxHealth: baseHealth * definition.healthMultiplier,
    type,
    xp: definition.xp,
    target: null,
    carrying: null,
    hitFlash: 0,
  });
}

function nearestAvailableChick(fox) {
  let best = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const chick of chicks) {
    if (chick.lost || chick.carriedBy) continue;
    const distance = distanceSquared(fox, chick);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = chick;
    }
  }

  return best;
}

function nearestEdgeVector(x, y) {
  const candidates = [
    { distance: x, vector: { x: -1, y: 0 } },
    { distance: width - x, vector: { x: 1, y: 0 } },
    { distance: y - 60, vector: { x: 0, y: -1 } },
    { distance: height - y, vector: { x: 0, y: 1 } },
  ];
  candidates.sort((a, b) => a.distance - b.distance);
  return candidates[0].vector;
}

function addParticles(x, y, symbol, count = 4) {
  for (let index = 0; index < count; index += 1) {
    particles.push({
      x,
      y,
      vx: random(-85, 85),
      vy: random(-120, -35),
      life: random(0.35, 0.72),
      symbol,
      size: random(13, 22),
    });
  }
}

function gainExperience(amount) {
  player.experience += amount;
  let leveledUp = false;

  while (player.experience >= player.experienceNeeded) {
    player.experience -= player.experienceNeeded;
    player.level += 1;
    player.experienceNeeded = Math.ceil(player.experienceNeeded * 1.42 + 1);
    leveledUp = true;
  }

  updateHud();
  if (leveledUp) showUpgradeChoices();
}

function defeatFox(fox) {
  if (fox.carrying) {
    fox.carrying.carriedBy = null;
    fox.carrying = null;
  }
  fox.health = 0;
  foxesDefeated += 1;
  cameraShake = Math.max(cameraShake, fox.type === 'brute' ? 7 : 4);
  addParticles(fox.x, fox.y, fox.type === 'brute' ? '💥' : '✦', fox.type === 'brute' ? 8 : 5);
  playTone(fox.type === 'brute' ? 150 : 230, 0.08, 0.04, 'square');
  gainExperience(fox.xp);
}

function shuffledUpgrades() {
  return [...UPGRADE_DEFINITIONS].sort(() => Math.random() - 0.5).slice(0, 3);
}

function showUpgradeChoices() {
  if (state !== 'playing') return;
  state = 'upgrading';
  ui.upgradeChoices.replaceChildren();

  for (const upgrade of shuffledUpgrades()) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'upgrade-choice';
    button.innerHTML = `
      <span class="upgrade-icon">${upgrade.icon}</span>
      <span class="upgrade-name">${upgrade.name}</span>
      <span class="upgrade-description">${upgrade.description}</span>
    `;
    button.addEventListener('click', () => {
      upgrade.apply();
      ui.upgradePanel.classList.add('hidden');
      state = 'playing';
      if (window.matchMedia('(pointer: coarse)').matches) {
        ui.joystick.classList.remove('hidden');
      }
      previousTime = performance.now();
      playTone(760, 0.12, 0.045);
      updateHud();
    });
    ui.upgradeChoices.append(button);
  }

  ui.upgradePanel.classList.remove('hidden');
  ui.joystick.classList.add('hidden');
  playTone(940, 0.12, 0.045);
}

function performSwordAttack() {
  let target = null;
  let targetDistance = player.attackRange ** 2;

  for (const fox of foxes) {
    if (fox.health <= 0) continue;
    const distance = distanceSquared(player, fox);
    if (distance < targetDistance) {
      targetDistance = distance;
      target = fox;
    }
  }

  if (!target) return;

  const direction = normalized(target.x - player.x, target.y - player.y);
  player.facing = direction;
  swordSlashes.push({
    x: player.x,
    y: player.y,
    angle: Math.atan2(direction.y, direction.x),
    radius: player.attackRange,
    life: 0.18,
  });
  playTone(520, 0.035, 0.025, 'triangle');

  for (const fox of foxes) {
    if (fox.health <= 0) continue;
    const dx = fox.x - player.x;
    const dy = fox.y - player.y;
    const distance = Math.hypot(dx, dy);
    let angleDifference = Math.atan2(dy, dx) - Math.atan2(direction.y, direction.x);
    angleDifference = Math.atan2(Math.sin(angleDifference), Math.cos(angleDifference));

    if (distance <= player.attackRange + fox.radius && Math.abs(angleDifference) < 1.12) {
      fox.health -= player.attackDamage;
      fox.hitFlash = 0.12;
      const knockback = normalized(dx, dy);
      fox.x += knockback.x * player.knockback;
      fox.y += knockback.y * player.knockback;
      addParticles(fox.x, fox.y, '✦', 2);
      if (fox.health <= 0) defeatFox(fox);
    }
  }
}

function getMovementInput() {
  let x = joystick.x;
  let y = joystick.y;

  if (keys.has('a') || keys.has('arrowleft')) x -= 1;
  if (keys.has('d') || keys.has('arrowright')) x += 1;
  if (keys.has('w') || keys.has('arrowup')) y -= 1;
  if (keys.has('s') || keys.has('arrowdown')) y += 1;

  const length = Math.hypot(x, y);
  if (length > 1) {
    x /= length;
    y /= length;
  }

  if (Math.hypot(x, y) > 0.08) {
    player.facing = normalized(x, y);
  }

  return { x, y };
}

function updateChicks(deltaTime) {
  for (const chick of chicks) {
    if (chick.lost) continue;
    chick.phase += deltaTime * 5;

    if (chick.carriedBy) {
      chick.x = chick.carriedBy.x;
      chick.y = chick.carriedBy.y + 17;
      continue;
    }

    chick.wanderAngle += deltaTime * random(0.68, 1.14);
    let velocityX = Math.cos(chick.wanderAngle) * 13;
    let velocityY = Math.sin(chick.wanderAngle * 0.92) * 13;

    const playerDistance = Math.hypot(player.x - chick.x, player.y - chick.y);
    if (playerDistance > player.chickAura) {
      const direction = normalized(player.x - chick.x, player.y - chick.y);
      velocityX += direction.x * player.chickPull;
      velocityY += direction.y * player.chickPull;
    } else if (playerDistance < 45) {
      const direction = normalized(chick.x - player.x, chick.y - player.y);
      velocityX += direction.x * 20;
      velocityY += direction.y * 20;
    }

    let threat = null;
    let threatDistance = 115 ** 2;
    for (const fox of foxes) {
      if (fox.health <= 0) continue;
      const distance = distanceSquared(chick, fox);
      if (distance < threatDistance) {
        threatDistance = distance;
        threat = fox;
      }
    }

    if (threat) {
      const direction = normalized(chick.x - threat.x, chick.y - threat.y);
      velocityX += direction.x * 88;
      velocityY += direction.y * 88;
    }

    chick.x = clamp(chick.x + velocityX * deltaTime, 16, width - 16);
    chick.y = clamp(chick.y + velocityY * deltaTime, 74, height - 16);
  }
}

function updateFoxes(deltaTime) {
  for (const fox of foxes) {
    if (fox.health <= 0) continue;
    fox.hitFlash = Math.max(0, fox.hitFlash - deltaTime);

    let targetX;
    let targetY;

    if (fox.carrying) {
      const edge = nearestEdgeVector(fox.x, fox.y);
      targetX = fox.x + edge.x * 120;
      targetY = fox.y + edge.y * 120;

      if (fox.x < -18 || fox.x > width + 18 || fox.y < 48 || fox.y > height + 18) {
        fox.carrying.lost = true;
        fox.carrying.carriedBy = null;
        fox.carrying = null;
        fox.health = 0;
        addParticles(clamp(fox.x, 0, width), clamp(fox.y, 70, height), '💨', 4);
        playTone(130, 0.12, 0.045, 'sawtooth');
        continue;
      }
    } else {
      if (!fox.target || fox.target.lost || fox.target.carriedBy) {
        fox.target = nearestAvailableChick(fox);
      }
      const target = fox.target || player;
      targetX = target.x;
      targetY = target.y;
    }

    const direction = normalized(targetX - fox.x, targetY - fox.y);
    fox.x += direction.x * fox.speed * deltaTime;
    fox.y += direction.y * fox.speed * deltaTime;

    if (!fox.carrying && fox.target && circlesOverlap(fox, fox.target, 2)) {
      fox.carrying = fox.target;
      fox.target.carriedBy = fox;
      fox.target = null;
      addParticles(fox.x, fox.y, '!', 2);
      playTone(170, 0.1, 0.04, 'sawtooth');
    }

    if (circlesOverlap(fox, player) && player.invulnerableFor <= 0) {
      const damage = Math.max(3, (fox.type === 'brute' ? 18 : 12) * (1 - player.armor));
      player.health -= damage;
      player.invulnerableFor = 0.72;
      cameraShake = fox.type === 'brute' ? 11 : 8;
      const knockback = normalized(player.x - fox.x, player.y - fox.y);
      player.x += knockback.x * (fox.type === 'brute' ? 40 : 28);
      player.y += knockback.y * (fox.type === 'brute' ? 40 : 28);
      playTone(120, 0.1, 0.055, 'sawtooth');

      if (player.health <= 0) {
        finishGame(false);
        return;
      }
    }
  }

  foxes = foxes.filter((fox) => fox.health > 0 || fox.hitFlash > 0);
}

function updateEffects(deltaTime) {
  swordSlashes.forEach((slash) => {
    slash.life -= deltaTime;
  });
  swordSlashes = swordSlashes.filter((slash) => slash.life > 0);

  particles.forEach((particle) => {
    particle.life -= deltaTime;
    particle.x += particle.vx * deltaTime;
    particle.y += particle.vy * deltaTime;
    particle.vy += 180 * deltaTime;
  });
  particles = particles.filter((particle) => particle.life > 0);
}

function update(deltaTime) {
  elapsed += deltaTime;
  timeRemaining = Math.max(0, CONFIG.gameDuration - elapsed);
  player.invulnerableFor = Math.max(0, player.invulnerableFor - deltaTime);

  const movement = getMovementInput();
  player.x = clamp(player.x + movement.x * player.speed * deltaTime, 22, width - 22);
  player.y = clamp(player.y + movement.y * player.speed * deltaTime, 76, height - 22);

  attackTimer -= deltaTime;
  if (attackTimer <= 0) {
    performSwordAttack();
    attackTimer = player.attackInterval;
  }

  spawnTimer -= deltaTime;
  const livingFoxes = foxes.filter((fox) => fox.health > 0).length;
  const foxLimit = Math.min(17, 3 + Math.floor(elapsed / 22));
  if (spawnTimer <= 0 && livingFoxes < foxLimit) {
    spawnFox();
    spawnTimer = Math.max(
      CONFIG.foxSpawnIntervalMin,
      CONFIG.foxSpawnIntervalStart - elapsed * 0.0085,
    );
  }

  updateChicks(deltaTime);
  updateFoxes(deltaTime);
  updateEffects(deltaTime);
  cameraShake = Math.max(0, cameraShake - deltaTime * 28);
  updateHud();

  const alive = chicks.filter((chick) => !chick.lost).length;
  if (alive <= 0) finishGame(false);
  if (timeRemaining <= 0) finishGame(true);
}

function roundedRectangle(x, y, rectangleWidth, rectangleHeight, radius, fillStyle) {
  if (rectangleWidth <= 0 || rectangleHeight <= 0) return;
  context.beginPath();
  context.roundRect(x, y, rectangleWidth, rectangleHeight, radius);
  context.fillStyle = fillStyle;
  context.fill();
}

function drawCoop() {
  const x = Math.max(58, width * 0.095);
  const y = Math.max(116, height * 0.18);
  context.save();
  context.translate(x, y);
  context.fillStyle = 'rgba(66, 46, 30, 0.17)';
  context.beginPath();
  context.ellipse(0, 36, 58, 16, 0, 0, Math.PI * 2);
  context.fill();
  roundedRectangle(-43, -8, 86, 55, 8, '#e8c06c');
  context.fillStyle = '#bc6544';
  context.beginPath();
  context.moveTo(-54, -5);
  context.lineTo(0, -43);
  context.lineTo(54, -5);
  context.closePath();
  context.fill();
  roundedRectangle(-15, 17, 30, 30, 8, '#6e4635');
  context.fillStyle = '#fff4c5';
  context.font = '18px sans-serif';
  context.textAlign = 'center';
  context.fillText('🐔', 0, 11);
  context.restore();
}

function drawPond() {
  const x = width * 0.84;
  const y = height * 0.24;
  context.save();
  context.fillStyle = 'rgba(68, 104, 74, 0.2)';
  context.beginPath();
  context.ellipse(x, y + 8, 72, 38, -0.12, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#77cbe1';
  context.beginPath();
  context.ellipse(x, y, 68, 34, -0.12, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = 'rgba(255,255,255,0.55)';
  context.lineWidth = 3;
  context.beginPath();
  context.arc(x - 12, y - 4, 21, 3.35, 5.5);
  context.stroke();
  context.fillStyle = '#86b95d';
  context.beginPath();
  context.ellipse(x + 25, y - 4, 13, 7, -0.2, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawHayBales() {
  const positions = [
    [width * 0.13, height * 0.72],
    [width * 0.89, height * 0.71],
    [width * 0.75, height * 0.84],
  ];

  for (const [x, y] of positions) {
    context.save();
    context.translate(x, y);
    roundedRectangle(-24, -14, 48, 28, 8, '#e9bd4d');
    context.strokeStyle = '#c78a36';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(-9, -14);
    context.lineTo(-9, 14);
    context.moveTo(9, -14);
    context.lineTo(9, 14);
    context.stroke();
    context.restore();
  }
}

function drawBackground() {
  const progress = clamp(elapsed / CONFIG.gameDuration, 0, 1);
  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, progress > 0.78 ? '#a8e58d' : '#91d577');
  gradient.addColorStop(1, progress > 0.78 ? '#7acc70' : '#66bc64');
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  context.globalAlpha = 0.18;
  context.strokeStyle = '#ead19a';
  context.lineWidth = Math.max(55, width * 0.045);
  context.beginPath();
  context.moveTo(width * 0.08, height * 0.56);
  context.bezierCurveTo(width * 0.32, height * 0.44, width * 0.65, height * 0.68, width * 0.94, height * 0.5);
  context.stroke();
  context.globalAlpha = 1;

  drawCoop();
  drawPond();
  drawHayBales();

  context.globalAlpha = 0.34;
  for (const decoration of decorations) {
    context.fillStyle = decoration.variant > 0.5 ? '#fff2ad' : '#f6b6c7';
    context.beginPath();
    context.arc(decoration.x, decoration.y, decoration.size, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;

  context.strokeStyle = 'rgba(94, 77, 45, 0.16)';
  context.lineWidth = 14;
  context.setLineDash([22, 18]);
  context.strokeRect(12, 64, width - 24, height - 76);
  context.setLineDash([]);

  context.fillStyle = 'rgba(255, 237, 164, 0.28)';
  context.beginPath();
  context.ellipse(
    width / 2,
    height / 2,
    Math.min(195, width * 0.24),
    Math.min(135, height * 0.22),
    0,
    0,
    Math.PI * 2,
  );
  context.fill();

  const nightAlpha = 0.12 * (1 - progress);
  if (nightAlpha > 0.01) {
    context.fillStyle = `rgba(42, 66, 94, ${nightAlpha})`;
    context.fillRect(0, 0, width, height);
  }
}

function drawChick(chick) {
  if (chick.lost) return;
  context.save();
  context.translate(chick.x, chick.y + Math.sin(chick.phase) * 1.7);
  if (chick.carriedBy) context.rotate(Math.sin(elapsed * 10) * 0.16);

  context.fillStyle = '#ffd758';
  context.beginPath();
  context.arc(0, 1, 12, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#fff0a1';
  context.beginPath();
  context.arc(-3, -3, 6, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#4f3a2f';
  context.beginPath();
  context.arc(-3, -3, 1.6, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#ef9144';
  context.beginPath();
  context.moveTo(8, -1);
  context.lineTo(15, 2);
  context.lineTo(8, 5);
  context.fill();

  context.strokeStyle = '#a76b3d';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(-4, 12);
  context.lineTo(-5, 16);
  context.moveTo(4, 12);
  context.lineTo(5, 16);
  context.stroke();

  if (chick.carriedBy) {
    context.fillStyle = '#d84242';
    context.font = 'bold 18px sans-serif';
    context.textAlign = 'center';
    context.fillText('!', 0, -19);
  }
  context.restore();
}

function drawFox(fox) {
  context.save();
  context.translate(fox.x, fox.y);
  const target = fox.carrying ? nearestEdgeVector(fox.x, fox.y) : fox.target || player;
  const angle = fox.carrying
    ? Math.atan2(target.y, target.x)
    : Math.atan2(target.y - fox.y, target.x - fox.x);
  context.rotate(angle);
  context.globalAlpha = fox.hitFlash > 0 ? 0.5 : 1;

  const definition = FOX_TYPES[fox.type];
  context.fillStyle = definition.color;
  context.beginPath();
  context.ellipse(0, 0, fox.radius + 2, fox.radius * 0.76, 0, 0, Math.PI * 2);
  context.fill();

  context.beginPath();
  context.moveTo(7, -fox.radius * 0.5);
  context.lineTo(14, -fox.radius - 2);
  context.lineTo(18, -fox.radius * 0.42);
  context.moveTo(7, fox.radius * 0.5);
  context.lineTo(14, fox.radius + 2);
  context.lineTo(18, fox.radius * 0.42);
  context.fill();

  context.fillStyle = '#fff0d4';
  context.beginPath();
  context.moveTo(12, -9);
  context.lineTo(25, 0);
  context.lineTo(12, 9);
  context.closePath();
  context.fill();

  context.fillStyle = '#3c302a';
  context.beginPath();
  context.arc(22, 0, 2.2, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = definition.color;
  context.lineWidth = fox.type === 'brute' ? 10 : 8;
  context.beginPath();
  context.arc(-fox.radius, 1, fox.radius * 0.82, -1.2, 1.2);
  context.stroke();

  if (fox.type === 'swift') {
    context.strokeStyle = '#7357aa';
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(1, -11);
    context.lineTo(-5, -18);
    context.stroke();
  } else if (fox.type === 'brute') {
    context.fillStyle = '#7c3f2b';
    context.beginPath();
    context.arc(-1, 0, 6, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();

  if (fox.health < fox.maxHealth && fox.health > 0) {
    roundedRectangle(fox.x - 19, fox.y - fox.radius - 13, 38, 5, 3, 'rgba(61, 41, 31, 0.25)');
    roundedRectangle(
      fox.x - 19,
      fox.y - fox.radius - 13,
      38 * clamp(fox.health / fox.maxHealth, 0, 1),
      5,
      3,
      '#e65d5d',
    );
  }
}

function drawPlayer() {
  context.save();
  context.translate(player.x, player.y);
  if (player.invulnerableFor > 0 && Math.floor(elapsed * 14) % 2 === 0) {
    context.globalAlpha = 0.45;
  }

  context.fillStyle = 'rgba(54, 43, 30, 0.2)';
  context.beginPath();
  context.ellipse(0, 18, 19, 7, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#f4eee1';
  context.beginPath();
  context.arc(0, 0, 20, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#8b6046';
  context.beginPath();
  context.arc(0, -5, 13, Math.PI, 0);
  context.fill();

  context.strokeStyle = '#6d8ebd';
  context.lineWidth = 5;
  context.beginPath();
  context.arc(0, 2, 15, 0.2, Math.PI - 0.2);
  context.stroke();

  context.rotate(Math.atan2(player.facing.y, player.facing.x));
  context.strokeStyle = '#eef4ff';
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(13, 0);
  context.lineTo(32, 0);
  context.stroke();

  context.strokeStyle = '#8c653e';
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(9, 0);
  context.lineTo(16, 0);
  context.stroke();
  context.restore();

  const healthRatio = clamp(player.health / player.maxHealth, 0, 1);
  roundedRectangle(player.x - 25, player.y + 29, 50, 7, 4, 'rgba(61, 41, 31, 0.22)');
  roundedRectangle(
    player.x - 25,
    player.y + 29,
    50 * healthRatio,
    7,
    4,
    healthRatio > 0.35 ? '#e86464' : '#ffb23e',
  );
}

function drawSwordSlash(slash) {
  context.save();
  context.translate(slash.x, slash.y);
  context.rotate(slash.angle);
  context.globalAlpha = clamp(slash.life / 0.18, 0, 1);
  context.strokeStyle = '#ffffff';
  context.lineWidth = 10;
  context.beginPath();
  context.arc(0, 0, slash.radius, -1.05, 1.05);
  context.stroke();
  context.restore();
}

function drawParticles() {
  for (const particle of particles) {
    context.save();
    context.globalAlpha = clamp(particle.life / 0.55, 0, 1);
    context.font = `${particle.size}px sans-serif`;
    context.textAlign = 'center';
    context.fillText(particle.symbol, particle.x, particle.y);
    context.restore();
  }
}

function draw() {
  context.save();
  if (cameraShake > 0) {
    context.translate(random(-cameraShake, cameraShake), random(-cameraShake, cameraShake));
  }

  drawBackground();
  chicks.forEach(drawChick);
  foxes.forEach(drawFox);
  if (player) drawPlayer();
  swordSlashes.forEach(drawSwordSlash);
  drawParticles();
  context.restore();
}

function gameLoop(currentTime) {
  const deltaTime = Math.min(0.033, (currentTime - previousTime) / 1000 || 0);
  previousTime = currentTime;

  if (state === 'playing') update(deltaTime);
  draw();
  requestAnimationFrame(gameLoop);
}

function handleKeyDown(event) {
  const key = event.key.toLowerCase();
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'escape', ' '].includes(key)) {
    event.preventDefault();
  }
  keys.add(key);

  if ((key === 'escape' || key === ' ') && state === 'playing') pauseGame();
  else if ((key === 'escape' || key === ' ') && state === 'paused') resumeGame();
}

function handleKeyUp(event) {
  keys.delete(event.key.toLowerCase());
}

function beginJoystick(event) {
  const rectangle = ui.joystick.getBoundingClientRect();
  joystick.active = true;
  joystick.pointerId = event.pointerId;
  joystick.centerX = rectangle.left + rectangle.width / 2;
  joystick.centerY = rectangle.top + rectangle.height / 2;
  ui.joystick.setPointerCapture?.(event.pointerId);
  moveJoystick(event);
}

function moveJoystick(event) {
  if (!joystick.active || event.pointerId !== joystick.pointerId) return;

  let dx = event.clientX - joystick.centerX;
  let dy = event.clientY - joystick.centerY;
  const length = Math.hypot(dx, dy) || 1;
  if (length > joystick.radius) {
    dx = (dx / length) * joystick.radius;
    dy = (dy / length) * joystick.radius;
  }

  joystick.x = dx / joystick.radius;
  joystick.y = dy / joystick.radius;
  ui.joystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
}

function endJoystick(event) {
  if (event.pointerId !== joystick.pointerId) return;
  joystick.active = false;
  joystick.pointerId = null;
  joystick.x = 0;
  joystick.y = 0;
  ui.joystickKnob.style.transform = 'translate(-50%, -50%)';
}

window.addEventListener('resize', () => {
  resizeCanvas();
  createDecorations();
});
window.addEventListener('keydown', handleKeyDown, { passive: false });
window.addEventListener('keyup', handleKeyUp);
ui.joystick.addEventListener('pointerdown', beginJoystick);
ui.joystick.addEventListener('pointermove', moveJoystick);
ui.joystick.addEventListener('pointerup', endJoystick);
ui.joystick.addEventListener('pointercancel', endJoystick);
ui.startButton.addEventListener('click', startGame);
ui.pauseButton.addEventListener('click', pauseGame);
ui.resumeButton.addEventListener('click', resumeGame);
ui.restartFromPauseButton.addEventListener('click', startGame);
ui.restartButton.addEventListener('click', startGame);
ui.soundButton.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  storeSoundPreference();
  updateSoundButton();
  playTone(640, 0.08, 0.04);
});

resizeCanvas();
createDecorations();
updateBestText();
updateSoundButton();
requestAnimationFrame(gameLoop);
