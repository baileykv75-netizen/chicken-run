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

    // Choose a nearby tangent when the follow direction is blocked.
    const chickStep = Math.hypot(velocityX, velocityY);
    if (playerDistance > player.chickAura && chickStep > 0.1
        && !phase4jClear(chick.x + velocityX / chickStep * 55,
          chick.y + velocityY / chickStep * 55, chick.radius || 10)) {
      const route = phase4jSteer(chick, player.x, player.y);
      velocityX = route.x * chickStep;
      velocityY = route.y * chickStep;
    }
    phase4jMoveEntity(chick, chick.x + velocityX * deltaTime, chick.y + velocityY * deltaTime, chick.radius || 10);
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
      phase4jUpdateCarryingFox(fox, deltaTime);
      continue;
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

    const direction = phase4jSteer(fox, targetX, targetY);
    const carryingMultiplier = fox.carrying ? 1.08 : 1;
    const speed = fox.speed * carryingMultiplier * deltaTime;
    phase4jMoveEntity(fox, fox.x + direction.x * speed, fox.y + direction.y * speed, fox.radius || 14);

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
      const knockDistance = fox.type === 'brute' ? 36 : 25;
      phase4jMoveEntity(player, player.x + knockback.x * knockDistance,
        player.y + knockback.y * knockDistance, player.radius || 18);
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
  phase4jMoveEntity(player,
    player.x + movement.x * player.speed * hammerMoveMultiplier * deltaTime,
    player.y + movement.y * player.speed * hammerMoveMultiplier * deltaTime,
    player.radius || 18);

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
