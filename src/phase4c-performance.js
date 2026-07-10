// Phase 4C: particle/audio batching, effect caps, and viewport culling.
let stage4cBatchDamage = false;
let stage4cLowFxMode = false;
let stage4cFrameAverage = 1 / 60;

const stage4cPerformancePlayToneBase = playTone;
playTone = function playStage4cTone(frequency = 440, duration = 0.06, volume = 0.035, type = 'sine') {
  if (stage4cBatchDamage && frequency <= 260) return;
  stage4cPerformancePlayToneBase(frequency, duration, volume, type);
};

const stage4cPerformanceAddParticlesBase = addParticles;
addParticles = function addStage4cParticles(x, y, symbol, count = 4) {
  if (stage4cBatchDamage && symbol === '✦') return;
  const maxParticles = isTouchDevice() ? 150 : 220;
  const remaining = maxParticles - particles.length;
  if (remaining <= 0) return;
  const loadLimited = stage4cLowFxMode || foxes.length >= 18;
  const allowed = Math.min(count, remaining, loadLimited ? 3 : count);
  if (allowed > 0) stage4cPerformanceAddParticlesBase(x, y, symbol, allowed);
};

resolveHammerAttack = function resolveStage4cHammerAttack() {
  const direction = player.hammerDirection || player.facing;
  const centerX = player.x + direction.x * Math.min(44, player.attackRange * 0.38);
  const centerY = player.y + direction.y * Math.min(44, player.attackRange * 0.38);

  hammerSlams.push({
    x: centerX,
    y: centerY,
    radius: player.slamRadius,
    life: 0.34,
    maxLife: 0.34,
  });

  stage4cBatchDamage = true;
  let hitCount = 0;
  const radiusSquared = (player.slamRadius + 20) ** 2;
  for (const fox of foxes) {
    if (fox.dead || fox.health <= 0) continue;
    const dx = fox.x - centerX;
    const dy = fox.y - centerY;
    if (dx * dx + dy * dy <= radiusSquared) {
      damageFox(fox, player.attackDamage, normalized(dx, dy), player.knockback, player.stunDuration);
      hitCount += 1;
    }
  }
  stage4cBatchDamage = false;

  cameraShake = Math.max(cameraShake, Math.min(8, 4 + hitCount * 0.22));
  addParticles(centerX, centerY, '💥', hitCount > 8 ? 5 : 8);
  playTone(105, 0.12, 0.06, 'square');
};

const stage4cPerformanceUpdateEffectsBase = updateEffects;
updateEffects = function updateStage4cEffects(deltaTime) {
  stage4cPerformanceUpdateEffectsBase(deltaTime);
  const particleLimit = isTouchDevice() ? 150 : 220;
  if (particles.length > particleLimit) particles = particles.slice(-particleLimit);
  if (hammerSlams.length > 10) hammerSlams = hammerSlams.slice(-10);
  if (swordSlashes.length > 16) swordSlashes = swordSlashes.slice(-16);
  if (dashTrails.length > 16) dashTrails = dashTrails.slice(-16);
  if (stage4bGunShots.length > 24) stage4bGunShots = stage4bGunShots.slice(-24);
};

function stage4cVisiblePoint(x, y, margin = 100) {
  const halfWidth = width / (2 * camera.zoom) + margin;
  const halfHeight = height / (2 * camera.zoom) + margin;
  return x >= camera.x - halfWidth && x <= camera.x + halfWidth &&
    y >= camera.y - halfHeight && y <= camera.y + halfHeight;
}

function stage4cVisibleSegment(x1, y1, x2, y2, margin = 120) {
  return stage4cVisiblePoint(x1, y1, margin) ||
    stage4cVisiblePoint(x2, y2, margin) ||
    stage4cVisiblePoint((x1 + x2) / 2, (y1 + y2) / 2, margin);
}

drawWorld = function drawStage4cOptimizedWorld() {
  drawBackground();

  for (const effect of dashTrails) {
    if (stage4cVisibleSegment(effect.x1, effect.y1, effect.x2, effect.y2)) drawDashTrail(effect);
  }
  for (const chick of chicks) {
    if (stage4cVisiblePoint(chick.x, chick.y, 70)) drawChick(chick);
  }
  for (const fox of foxes) {
    if (stage4cVisiblePoint(fox.x, fox.y, 80)) drawFox(fox);
  }
  if (player) drawPlayer();
  for (const shot of spearShots) {
    if (stage4cVisiblePoint(shot.x, shot.y, 80)) drawSpearShot(shot);
  }
  for (const effect of swordSlashes) {
    if (stage4cVisiblePoint(effect.x, effect.y, effect.radius + 40)) drawSwordSlash(effect);
  }
  for (const effect of hammerSlams) {
    if (stage4cVisiblePoint(effect.x, effect.y, effect.radius + 40)) drawHammerSlam(effect);
  }
  for (const particle of particles) {
    if (stage4cVisiblePoint(particle.x, particle.y, 40)) {
      context.save();
      context.globalAlpha = clamp(particle.life / 0.55, 0, 1);
      context.font = `${particle.size}px sans-serif`;
      context.textAlign = 'center';
      context.fillText(particle.symbol, particle.x, particle.y);
      context.restore();
    }
  }
  for (const dog of stage4bDogs) {
    if (stage4cVisiblePoint(dog.x, dog.y, 60)) drawStage4bDog(dog);
  }
  for (const shot of stage4bGunShots) {
    if (stage4cVisibleSegment(shot.x1, shot.y1, shot.x2, shot.y2)) drawStage4bGunShot(shot);
  }
};

const stage4cPerformanceUpdateBase = update;
update = function updateStage4cPerformance(deltaTime) {
  stage4cFrameAverage = stage4cFrameAverage * 0.94 + deltaTime * 0.06;
  stage4cLowFxMode = stage4cFrameAverage > 0.026;
  stage4cPerformanceUpdateBase(deltaTime);
};
