const canvas = document.querySelector('#game');
const context = canvas.getContext('2d');

const ui = {
  hud: document.querySelector('#hud'),
  chicksAlive: document.querySelector('#chicksAlive'),
  foxesDefeated: document.querySelector('#foxesDefeated'),
  timer: document.querySelector('#timer'),
  pauseButton: document.querySelector('#pauseButton'),
  startPanel: document.querySelector('#startPanel'),
  startButton: document.querySelector('#startButton'),
  pausePanel: document.querySelector('#pausePanel'),
  resumeButton: document.querySelector('#resumeButton'),
  restartFromPauseButton: document.querySelector('#restartFromPauseButton'),
  resultPanel: document.querySelector('#resultPanel'),
  resultEmoji: document.querySelector('#resultEmoji'),
  resultTitle: document.querySelector('#resultTitle'),
  resultText: document.querySelector('#resultText'),
  restartButton: document.querySelector('#restartButton'),
  joystick: document.querySelector('#joystick'),
  joystickKnob: document.querySelector('#joystickKnob'),
};

const CONFIG = {
  gameDuration: 180,
  chickCount: 10,
  playerSpeed: 240,
  playerAttackInterval: 0.68,
  playerAttackRange: 86,
  playerAttackDamage: 42,
  foxSpawnIntervalStart: 2.8,
  foxSpawnIntervalMin: 1.05,
};

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
  decorations = Array.from({ length: 70 }, () => ({
    x: random(20, width - 20),
    y: random(78, height - 18),
    size: random(2, 5),
    variant: Math.random(),
  }));
}

function resetGame() {
  elapsed = 0;
  timeRemaining = CONFIG.gameDuration;
  spawnTimer = 0.7;
  attackTimer = 0.25;
  foxesDefeated = 0;
  cameraShake = 0;

  player = {
    x: width / 2,
    y: height / 2,
    radius: 21,
    speed: CONFIG.playerSpeed,
    health: 100,
    maxHealth: 100,
    invulnerableFor: 0,
    facing: { x: 1, y: 0 },
  };

  chicks = [];
  foxes = [];
  swordSlashes = [];
  particles = [];
  createDecorations();

  for (let index = 0; index < CONFIG.chickCount; index += 1) {
    const angle = (index / CONFIG.chickCount) * Math.PI * 2;
    const radius = random(72, 145);
    chicks.push({
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
  ui.resultPanel.classList.add('hidden');
  ui.hud.classList.remove('hidden');
  if (window.matchMedia('(pointer: coarse)').matches) {
    ui.joystick.classList.remove('hidden');
  }
  previousTime = performance.now();
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
  state = 'result';
  ui.hud.classList.add('hidden');
  ui.joystick.classList.add('hidden');
  ui.resultPanel.classList.remove('hidden');

  const alive = chicks.filter((chick) => !chick.lost).length;
  ui.resultEmoji.textContent = victory ? '🌅' : '🦊';
  ui.resultTitle.textContent = victory ? '天亮了！' : '鸡舍失守';
  ui.resultText.textContent = `你守住了 ${alive} 只小鸡，并击退了 ${foxesDefeated} 只狐狸。`;
}

function updateHud() {
  const alive = chicks.filter((chick) => !chick.lost).length;
  ui.chicksAlive.textContent = String(alive);
  ui.foxesDefeated.textContent = String(foxesDefeated);
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = Math.floor(timeRemaining % 60);
  ui.timer.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
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

  const health = 58 + elapsed * 0.08;
  foxes.push({
    x,
    y,
    radius: 18,
    speed: 78 + Math.min(48, elapsed * 0.18),
    health,
    maxHealth: health,
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

function defeatFox(fox) {
  if (fox.carrying) {
    fox.carrying.carriedBy = null;
    fox.carrying = null;
  }
  fox.health = 0;
  foxesDefeated += 1;
  cameraShake = Math.max(cameraShake, 4);
  addParticles(fox.x, fox.y, '✦', 5);
}

function performSwordAttack() {
  let target = null;
  let targetDistance = CONFIG.playerAttackRange ** 2;

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
    radius: CONFIG.playerAttackRange,
    life: 0.18,
  });

  for (const fox of foxes) {
    if (fox.health <= 0) continue;
    const dx = fox.x - player.x;
    const dy = fox.y - player.y;
    const distance = Math.hypot(dx, dy);
    let angleDifference = Math.atan2(dy, dx) - Math.atan2(direction.y, direction.x);
    angleDifference = Math.atan2(Math.sin(angleDifference), Math.cos(angleDifference));

    if (distance <= CONFIG.playerAttackRange + fox.radius && Math.abs(angleDifference) < 1.12) {
      fox.health -= CONFIG.playerAttackDamage;
      fox.hitFlash = 0.12;
      const knockback = normalized(dx, dy);
      fox.x += knockback.x * 18;
      fox.y += knockback.y * 18;
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
    if (playerDistance > 118) {
      const direction = normalized(player.x - chick.x, player.y - chick.y);
      velocityX += direction.x * 46;
      velocityY += direction.y * 46;
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
    }

    if (circlesOverlap(fox, player) && player.invulnerableFor <= 0) {
      player.health -= 12;
      player.invulnerableFor = 0.72;
      cameraShake = 8;
      const knockback = normalized(player.x - fox.x, player.y - fox.y);
      player.x += knockback.x * 28;
      player.y += knockback.y * 28;
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
    attackTimer = CONFIG.playerAttackInterval;
  }

  spawnTimer -= deltaTime;
  const livingFoxes = foxes.filter((fox) => fox.health > 0).length;
  const foxLimit = Math.min(14, 3 + Math.floor(elapsed / 24));
  if (spawnTimer <= 0 && livingFoxes < foxLimit) {
    spawnFox();
    spawnTimer = Math.max(
      CONFIG.foxSpawnIntervalMin,
      CONFIG.foxSpawnIntervalStart - elapsed * 0.008,
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
  context.beginPath();
  context.roundRect(x, y, rectangleWidth, rectangleHeight, radius);
  context.fillStyle = fillStyle;
  context.fill();
}

function drawBackground() {
  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#9dde80');
  gradient.addColorStop(1, '#6dc36a');
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

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

  context.fillStyle = '#ee7d38';
  context.beginPath();
  context.ellipse(0, 0, 20, 14, 0, 0, Math.PI * 2);
  context.fill();

  context.beginPath();
  context.moveTo(7, -9);
  context.lineTo(14, -20);
  context.lineTo(18, -7);
  context.moveTo(7, 9);
  context.lineTo(14, 20);
  context.lineTo(18, 7);
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

  context.strokeStyle = '#ee7d38';
  context.lineWidth = 8;
  context.beginPath();
  context.arc(-18, 1, 15, -1.2, 1.2);
  context.stroke();
  context.restore();

  if (fox.health < fox.maxHealth && fox.health > 0) {
    roundedRectangle(fox.x - 19, fox.y - 28, 38, 5, 3, 'rgba(61, 41, 31, 0.25)');
    roundedRectangle(
      fox.x - 19,
      fox.y - 28,
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

window.addEventListener('resize', resizeCanvas);
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

resizeCanvas();
createDecorations();
requestAnimationFrame(gameLoop);
