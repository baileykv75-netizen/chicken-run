updateChicks = function updateFollowerOnlyChicks(deltaTime) {
  const rallySpeedMultiplier = player.rallyPulseFor > 0 ? 1.45 : 1;

  for (const chick of chicks) {
    if (chick.lost) continue;
    chick.phase += deltaTime * 5;
    chick.protectedFor = Math.max(0, (chick.protectedFor || 0) - deltaTime);

    if (chick.carriedBy) {
      chick.x = chick.carriedBy.x;
      chick.y = chick.carriedBy.y + 14;
      continue;
    }

    chick.wanderAngle += deltaTime * random(0.45, 0.8);
    let velocityX = Math.cos(chick.wanderAngle) * 12;
    let velocityY = Math.sin(chick.wanderAngle * 0.92) * 12;

    const dx = player.x - chick.x;
    const dy = player.y - chick.y;
    const playerDistance = Math.hypot(dx, dy);
    const followDirection = normalized(dx, dy);

    if (playerDistance > player.chickAura) {
      const excess = clamp((playerDistance - player.chickAura) / 120, 0, 1);
      const followStrength = player.chickPull + excess * 95;
      velocityX += followDirection.x * followStrength;
      velocityY += followDirection.y * followStrength;
    } else if (playerDistance < 34) {
      const separate = normalized(chick.x - player.x, chick.y - player.y);
      velocityX += separate.x * 28;
      velocityY += separate.y * 28;
    }

    const maxSpeed = ENDLESS_CONFIG.chickSpeed * rallySpeedMultiplier;
    const speed = Math.hypot(velocityX, velocityY);
    if (speed > maxSpeed) {
      velocityX = (velocityX / speed) * maxSpeed;
      velocityY = (velocityY / speed) * maxSpeed;
    }

    chick.x = clamp(chick.x + velocityX * deltaTime, 14, world.width - 14);
    chick.y = clamp(chick.y + velocityY * deltaTime, 14, world.height - 14);
  }
};

updateFoxes = function updateBalancedFoxes(deltaTime) {
  for (const fox of foxes) {
    if (fox.dead || fox.health <= 0) continue;
    fox.hitFlash = Math.max(0, fox.hitFlash - deltaTime);
    fox.stunnedFor = Math.max(0, fox.stunnedFor - deltaTime);
    if (fox.stunnedFor > 0) continue;

    let targetX;
    let targetY;

    if (fox.carrying) {
      const edge = nearestWorldEdgeVector(fox.x, fox.y);
      targetX = fox.x + edge.x * 160;
      targetY = fox.y + edge.y * 160;

      if (fox.x < 8 || fox.x > world.width - 8 || fox.y < 8 || fox.y > world.height - 8) {
        fox.carrying.lost = true;
        fox.carrying.carriedBy = null;
        fox.carrying = null;
        fox.dead = true;
        fox.health = 0;
        addParticles(clamp(fox.x, 0, world.width), clamp(fox.y, 0, world.height), '💨', 4);
        playTone(130, 0.12, 0.045, 'sawtooth');
        continue;
      }
    } else {
      if (
        !fox.target ||
        fox.target.lost ||
        fox.target.carriedBy ||
        (fox.target.protectedFor || 0) > 0
      ) {
        fox.target = nearestAvailableChick(fox);
      }
      const target = fox.target || player;
      targetX = target.x;
      targetY = target.y;
    }

    const direction = normalized(targetX - fox.x, targetY - fox.y);
    const carryingMultiplier = fox.carrying ? 1.08 : 1;
    fox.x += direction.x * fox.speed * carryingMultiplier * deltaTime;
    fox.y += direction.y * fox.speed * carryingMultiplier * deltaTime;

    if (
      !fox.carrying &&
      fox.target &&
      (fox.target.protectedFor || 0) <= 0 &&
      circlesOverlap(fox, fox.target, 2)
    ) {
      fox.carrying = fox.target;
      fox.target.carriedBy = fox;
      fox.target = null;
      addParticles(fox.x, fox.y, '!', 2);
      playTone(170, 0.1, 0.04, 'sawtooth');
    }

    if (circlesOverlap(fox, player) && player.invulnerableFor <= 0) {
      const baseDamage = fox.type === 'brute' ? 18 : 12;
      const dashReduction = player.damageReductionFor > 0 ? 0.4 : 1;
      const damage = Math.max(2, baseDamage * (1 - player.armor) * dashReduction);
      player.health -= damage;
      player.invulnerableFor = 0.72;
      cameraShake = fox.type === 'brute' ? 10 : 7;
      const knockback = normalized(player.x - fox.x, player.y - fox.y);
      player.x += knockback.x * (fox.type === 'brute' ? 36 : 25);
      player.y += knockback.y * (fox.type === 'brute' ? 36 : 25);
      playTone(120, 0.1, 0.055, 'sawtooth');
      if (player.health <= 0) {
        finishGame();
        return;
      }
    }
  }
  foxes = foxes.filter((fox) => !fox.dead && fox.health > 0);
};

update = function updateEndlessGame(deltaTime) {
  elapsed += deltaTime;
  timeRemaining = elapsed;
  player.invulnerableFor = Math.max(0, player.invulnerableFor - deltaTime);
  player.damageReductionFor = Math.max(0, (player.damageReductionFor || 0) - deltaTime);
  player.rallyPulseFor = Math.max(0, (player.rallyPulseFor || 0) - deltaTime);

  const movement = getMovementInput();
  const hammerMoveMultiplier = player.hammerWindup > 0 ? 0.55 : 1;
  player.x = clamp(
    player.x + movement.x * player.speed * hammerMoveMultiplier * deltaTime,
    18,
    world.width - 18,
  );
  player.y = clamp(
    player.y + movement.y * player.speed * hammerMoveMultiplier * deltaTime,
    18,
    world.height - 18,
  );

  if (player.hammerWindup > 0) {
    player.hammerWindup -= deltaTime;
    if (player.hammerWindup <= 0) resolveHammerAttack();
  }

  attackTimer -= deltaTime;
  if (attackTimer <= 0 && player.hammerWindup <= 0) {
    const attacked = performWeaponAttack();
    attackTimer = attacked
      ? player.attackInterval
      : Math.min(0.12, player.attackInterval * 0.25);
  }

  updateDirector(deltaTime);
  updateRally(deltaTime);
  updateChicks(deltaTime);
  updateFoxes(deltaTime);
  updateSpearShots(deltaTime);
  updateEffects(deltaTime);
  updateCamera(deltaTime);
  cameraShake = Math.max(0, cameraShake - deltaTime * 30);
  updateHud();

  const alive = chicks.filter((chick) => !chick.lost).length;
  if (alive <= 0) finishGame();
};

updateBestText();
