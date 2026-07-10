function activateGunWorldline() {
  if (player.gunMode) return;
  setSkillLevel('end-cold-weapons', 1);
  player.gunMode = true;
  player.gunArchetype = player.weapon === 'sword' ? 'revolver' : player.weapon === 'spear' ? 'rifle' : 'shotgun';
  const originalBase = WEAPONS[player.weapon].attackInterval;
  const speedFactor = player.attackInterval / originalBase;
  const newBase = player.gunArchetype === 'revolver' ? 0.64 : player.gunArchetype === 'rifle' ? 0.86 : 1.18;
  player.attackInterval = Math.max(0.25, newBase * speedFactor);
  player.spearBusy = false;
  player.hammerWindup = 0;
  spearShots = [];
  addParticles(player.x, player.y, '⚙️', 10);
  addParticles(player.x, player.y, '🔫', 4);
  playTone(210, 0.18, 0.06, 'square');
  updateHud();
}

function performRevolverAttack() {
  const revolverRange = Math.max(230, player.attackRange * 3.2);
  const targets = foxes
    .filter((fox) => !fox.dead && fox.health > 0 && distanceSquared(player, fox) <= revolverRange ** 2)
    .sort((a, b) => distanceSquared(player, a) - distanceSquared(player, b))
    .slice(0, player.doubleSlashChance ? 4 : 3);
  if (!targets.length) return false;
  const baseDamage = Math.max(24, player.attackDamage * 0.78);
  for (const target of targets) {
    const direction = normalized(target.x - player.x, target.y - player.y);
    damageFox(target, baseDamage, direction, 9);
    stage4bGunShots.push({ x1: player.x, y1: player.y, x2: target.x, y2: target.y, life: 0.1, kind: 'revolver' });
  }
  player.facing = normalized(targets[0].x - player.x, targets[0].y - player.y);
  playTone(760, 0.045, 0.035, 'square');
  return true;
}

function performRifleAttack() {
  const rifleRange = Math.max(390, player.attackRange * 1.35);
  const target = nearestLivingFox(rifleRange);
  if (!target) return false;
  const direction = normalized(target.x - player.x, target.y - player.y);
  const endX = player.x + direction.x * rifleRange;
  const endY = player.y + direction.y * rifleRange;
  const candidates = foxes
    .filter((fox) => !fox.dead && fox.health > 0 && pointSegmentDistance(fox.x, fox.y, player.x, player.y, endX, endY) <= fox.radius + 7)
    .sort((a, b) => distanceSquared(player, a) - distanceSquared(player, b))
    .slice(0, Math.max(3, player.maxPierce));
  const rifleDamage = Math.max(25, (player.damageOut + player.damageBack) * 0.84);
  candidates.forEach((fox, index) => damageFox(fox, rifleDamage * Math.pow(0.9, index), direction, 8));
  player.spearThrows += 1;
  if (player.dashEvery > 0 && player.spearThrows % player.dashEvery === 0) performSpearDash(direction);
  player.facing = direction;
  stage4bGunShots.push({ x1: player.x, y1: player.y, x2: endX, y2: endY, life: 0.12, kind: 'rifle' });
  playTone(560, 0.06, 0.04, 'square');
  return true;
}

function performShotgunAttack() {
  const shotgunRange = Math.max(145, player.slamRadius * 1.55);
  const target = nearestLivingFox(shotgunRange);
  if (!target) return false;
  const direction = normalized(target.x - player.x, target.y - player.y);
  const facingAngle = Math.atan2(direction.y, direction.x);
  let hitAny = false;
  for (const fox of foxes) {
    if (fox.dead || fox.health <= 0) continue;
    const dx = fox.x - player.x;
    const dy = fox.y - player.y;
    const distance = Math.hypot(dx, dy);
    if (distance > shotgunRange + fox.radius) continue;
    let difference = Math.atan2(dy, dx) - facingAngle;
    difference = Math.atan2(Math.sin(difference), Math.cos(difference));
    if (Math.abs(difference) > 0.72) continue;
    const falloff = clamp(1 - distance / (shotgunRange * 1.45), 0.55, 1);
    damageFox(fox, player.attackDamage * 0.92 * falloff, normalized(dx, dy), player.knockback * 1.15, player.stunDuration * 0.55);
    hitAny = true;
  }
  player.facing = direction;
  stage4bGunShots.push({ x1: player.x, y1: player.y, x2: player.x + direction.x * shotgunRange, y2: player.y + direction.y * shotgunRange, life: 0.16, kind: 'shotgun' });
  cameraShake = Math.max(cameraShake, 6);
  playTone(125, 0.1, 0.06, 'square');
  return hitAny;
}

function performGunAttack() {
  if (player.gunArchetype === 'revolver') return performRevolverAttack();
  if (player.gunArchetype === 'rifle') return performRifleAttack();
  return performShotgunAttack();
}

const stage4bPerformWeaponAttack = performWeaponAttack;
performWeaponAttack = function performStage4bWeaponAttack() {
  const attacked = player.gunMode ? performGunAttack() : stage4bPerformWeaponAttack();
  if (attacked && skillLevel('knife-shield') > 0) {
    player.knifeShieldCounter += 1;
    const needed = skillLevel('knife-shield') >= 3 ? 2 : 3;
    const maxCharges = skillLevel('knife-shield') >= 3 ? 2 : 1;
    if (player.knifeShieldCounter >= needed) {
      player.knifeShieldCounter = 0;
      player.knifeShieldCharges = Math.min(maxCharges, player.knifeShieldCharges + 1);
      addParticles(player.x, player.y, '🛡️', 3);
    }
  }
  return attacked;
};

function triggerKnifeShield() {
  const level = skillLevel('knife-shield');
  if (level <= 0 || player.knifeShieldCharges <= 0) return false;
  const touching = foxes.some((fox) => !fox.dead && fox.health > 0 && circlesOverlap(fox, player, 2));
  if (!touching) return false;
  player.knifeShieldCharges -= 1;
  player.invulnerableFor = Math.max(player.invulnerableFor, 0.82);
  const radius = player.weapon === 'spear' ? 125 : player.weapon === 'hammer' ? 105 : 92;
  const damage = (player.weapon === 'hammer' ? 34 : player.weapon === 'spear' ? 25 : 28) * (1 + (level - 1) * 0.3);
  for (const fox of foxes) {
    if (fox.dead || fox.health <= 0) continue;
    const dx = fox.x - player.x;
    const dy = fox.y - player.y;
    if (Math.hypot(dx, dy) <= radius + fox.radius) {
      damageFox(fox, damage, normalized(dx, dy), player.weapon === 'hammer' ? 48 : 30, player.weapon === 'hammer' ? 0.35 : 0.12);
    }
  }
  addParticles(player.x, player.y, '🛡️', 7);
  playTone(920, 0.1, 0.05, 'triangle');
  return true;
}

const stage4bUpdateFoxes = updateFoxes;
updateFoxes = function updateStage4bFoxes(deltaTime) {
  for (const fox of foxes) {
    if (fox.target && (fox.target.awakened || fox.target.scouting)) fox.target = null;
  }
  triggerKnifeShield();
  stage4bUpdateFoxes(deltaTime);
};

const stage4bUpdateChicks = updateChicks;
updateChicks = function updateStage4bChicks(deltaTime) {
  stage4bUpdateChicks(deltaTime);
  for (const chick of chicks) {
    if (chick.scouting) {
      chick.x = player.x;
      chick.y = player.y;
    }
  }
};

function updateStage4bSystems(deltaTime) {
  updateBrucie(deltaTime);
  updateExpeditions(deltaTime);
  updateCombatChicks(deltaTime);
  for (const shot of stage4bGunShots) shot.life -= deltaTime;
  stage4bGunShots = stage4bGunShots.filter((shot) => shot.life > 0);
}

const stage4bUpdate = update;
update = function updateStage4b(deltaTime) {
  stage4bUpdate(deltaTime);
  if (state === 'playing') updateStage4bSystems(deltaTime);
};

const stage4bUpdateHud = updateHud;
updateHud = function updateStage4bHud() {
  stage4bUpdateHud();
  if (!player?.gunMode) return;
  if (player.gunArchetype === 'revolver') {
    ui.weaponIcon.textContent = '🔫';
    ui.weaponName.textContent = '左轮';
  } else if (player.gunArchetype === 'rifle') {
    ui.weaponIcon.textContent = '🎯';
    ui.weaponName.textContent = '步枪';
  } else {
    ui.weaponIcon.textContent = '💥';
    ui.weaponName.textContent = '霰弹枪';
  }
};

const stage4bDrawChick = drawChick;
drawChick = function drawStage4bChick(chick) {
  if (chick.scouting) return;
  stage4bDrawChick(chick);
  if (!chick.awakened && !chick.cultivated) return;
  context.save();
  context.translate(chick.x, chick.y - 11);
  if (chick.awakened) {
    context.strokeStyle = '#d94f4f';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(-8, 0);
    context.lineTo(8, 0);
    context.stroke();
  }
  if (chick.cultivated) {
    context.strokeStyle = 'rgba(126,82,190,.75)';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(0, 10, 15 + Math.sin(elapsed * 4) * 2, 0, Math.PI * 2);
    context.stroke();
  }
  context.restore();
};

function drawStage4bDog(dog) {
  context.save();
  context.translate(dog.x, dog.y + Math.sin(dog.phase) * 2);
  context.font = '27px sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('🐕', 0, 0);
  context.restore();
}

function drawStage4bGunShot(shot) {
  context.save();
  context.globalAlpha = clamp(shot.life / 0.16, 0, 1);
  context.strokeStyle = shot.kind === 'shotgun' ? '#ffd36a' : '#fff3b0';
  context.lineWidth = shot.kind === 'rifle' ? 4 : shot.kind === 'shotgun' ? 9 : 3;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(shot.x1, shot.y1);
  context.lineTo(shot.x2, shot.y2);
  context.stroke();
  context.restore();
}

const stage4bDrawWorld = drawWorld;
drawWorld = function drawStage4bWorld() {
  stage4bDrawWorld();
  stage4bDogs.forEach(drawStage4bDog);
  stage4bGunShots.forEach(drawStage4bGunShot);
};

const stage4bDrawPlayer = drawPlayer;
drawPlayer = function drawStage4bPlayer() {
  if (!player?.gunMode) {
    stage4bDrawPlayer();
    return;
  }

  context.save();
  context.translate(player.x, player.y);
  if (player.invulnerableFor > 0 && Math.floor(elapsed * 14) % 2 === 0) context.globalAlpha = 0.45;
  context.fillStyle = 'rgba(54,43,30,.2)';
  context.beginPath();
  context.ellipse(0, 15, 16, 6, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#f4eee1';
  context.beginPath();
  context.arc(0, 0, 16, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#8b6046';
  context.beginPath();
  context.arc(0, -4, 10, Math.PI, 0);
  context.fill();
  context.strokeStyle = '#6d8ebd';
  context.lineWidth = 4;
  context.beginPath();
  context.arc(0, 2, 12, 0.2, Math.PI - 0.2);
  context.stroke();
  context.rotate(Math.atan2(player.facing.y, player.facing.x));
  context.strokeStyle = '#4e5964';
  context.lineWidth = player.gunArchetype === 'shotgun' ? 6 : 4;
  context.beginPath();
  context.moveTo(8, 0);
  context.lineTo(player.gunArchetype === 'revolver' ? 25 : 34, 0);
  context.stroke();
  context.fillStyle = '#8c653e';
  context.fillRect(12, 2, 7, 9);
  context.restore();

  const healthRatio = clamp(player.health / player.maxHealth, 0, 1);
  roundedRectangle(player.x - 22, player.y + 24, 44, 6, 4, 'rgba(61,41,31,.22)');
  roundedRectangle(player.x - 22, player.y + 24, 44 * healthRatio, 6, 4, healthRatio > 0.35 ? '#e86464' : '#ffb23e');
};

updateBestText();
