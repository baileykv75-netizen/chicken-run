commonUpgrades = function endlessCommonUpgrades() {
  const rallyName =
    player.rallyLevel === 0
      ? '牧鸡铃·集合信号'
      : player.rallyLevel === 1
        ? '牧鸡铃·紧急召回'
        : '牧鸡铃·安全集合';
  const rallyDescription =
    player.rallyLevel === 0
      ? '鸡群跟随更紧凑，追赶能力提高'
      : player.rallyLevel === 1
        ? '每 12 秒自动响铃，鸡群快速回到身边'
        : '响铃时小鸡加速，并短暂无法被抓走';

  return [
    {
      id: 'damage',
      icon: '💢',
      name: '武器淬火',
      description: '当前武器伤害提高 18%',
      apply: () => {
        player.attackDamage *= 1.18;
        player.damageOut *= 1.18;
        player.damageBack *= 1.18;
        player.dashDamage *= 1.12;
      },
    },
    {
      id: 'rate',
      icon: '✨',
      name: '熟练手法',
      description: '攻击间隔缩短 10%',
      apply: () => {
        player.attackInterval = Math.max(0.32, player.attackInterval * 0.9);
      },
    },
    {
      id: 'speed',
      icon: '👢',
      name: '轻快脚步',
      description: '守卫者移动速度提高 7%',
      apply: () => {
        player.speed *= 1.07;
      },
    },
    {
      id: 'rally',
      icon: '🔔',
      name: rallyName,
      description: rallyDescription,
      apply: () => {
        player.rallyLevel = Math.min(3, player.rallyLevel + 1);
        player.chickAura = Math.max(82, player.chickAura - 12);
        player.chickPull += 18;
        if (player.rallyLevel >= 2) player.rallyCooldown = Math.min(player.rallyCooldown, 2.5);
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
      id: 'armor',
      icon: '🛡️',
      name: '稻草护甲',
      description: '受到的伤害降低 15%',
      apply: () => {
        player.armor = Math.min(0.6, player.armor + 0.15);
      },
    },
  ];
};

performSpearDash = function performBalancedSpearDash(direction) {
  const startX = player.x;
  const startY = player.y;
  const endX = clamp(startX + direction.x * player.dashDistance, 18, world.width - 18);
  const endY = clamp(startY + direction.y * player.dashDistance, 18, world.height - 18);

  for (const fox of foxes) {
    if (fox.dead || fox.health <= 0) continue;
    if (pointSegmentDistance(fox.x, fox.y, startX, startY, endX, endY) <= fox.radius + 12) {
      damageFox(fox, player.dashDamage, direction, player.knockback * 1.2, 0.1);
    }
  }

  player.x = endX;
  player.y = endY;
  player.damageReductionFor = Math.max(
    player.damageReductionFor,
    player.dashReductionDuration || 0.32,
  );
  dashTrails.push({ x1: startX, y1: startY, x2: endX, y2: endY, life: 0.24 });
  cameraShake = Math.max(cameraShake, 3);
  playTone(740, 0.07, 0.04, 'sawtooth');
};

performSpearAttack = function performBalancedSpearAttack() {
  if (player.spearBusy || spearShots.length > 0) return false;
  const target = nearestLivingFox(player.attackRange);
  if (!target) return false;

  const direction = getAttackDirection(target);
  player.facing = direction;
  player.spearThrows += 1;

  if (player.dashEvery > 0 && player.spearThrows % player.dashEvery === 0) {
    const dashDirection = Math.hypot(player.moving.x, player.moving.y) > 0.08
      ? normalized(player.moving.x, player.moving.y)
      : direction;
    performSpearDash(dashDirection);
  }

  player.spearBusy = true;
  spearShots.push({
    originX: player.x,
    originY: player.y,
    direction,
    distance: player.attackRange,
    progress: 0,
    returning: false,
    speed: player.projectileSpeed,
    previousX: player.x,
    previousY: player.y,
    x: player.x,
    y: player.y,
    hitOut: new Set(),
    hitBack: new Set(),
    pierceOut: 0,
    pierceBack: 0,
  });
  playTone(610, 0.06, 0.03, 'triangle');
  return true;
};

updateSpearShots = function updateBalancedSpearShots(deltaTime) {
  for (const shot of spearShots) {
    shot.previousX = shot.x;
    shot.previousY = shot.y;
    const duration = shot.distance / shot.speed;

    if (!shot.returning) {
      shot.progress += deltaTime / duration;
      if (shot.progress >= 1) {
        shot.progress = 1;
        shot.returning = true;
      }
    } else {
      shot.progress -= deltaTime / duration;
    }

    shot.x = shot.originX + shot.direction.x * shot.distance * shot.progress;
    shot.y = shot.originY + shot.direction.y * shot.distance * shot.progress;

    const hitSet = shot.returning ? shot.hitBack : shot.hitOut;
    const pierceKey = shot.returning ? 'pierceBack' : 'pierceOut';

    for (const fox of foxes) {
      if (
        fox.dead ||
        fox.health <= 0 ||
        hitSet.has(fox) ||
        shot[pierceKey] >= player.maxPierce
      ) {
        continue;
      }

      if (
        pointSegmentDistance(
          fox.x,
          fox.y,
          shot.previousX,
          shot.previousY,
          shot.x,
          shot.y,
        ) <= fox.radius + 8
      ) {
        hitSet.add(fox);
        const falloff = Math.pow(0.88, shot[pierceKey]);
        shot[pierceKey] += 1;
        const baseDamage = shot.returning ? player.damageBack : player.damageOut;
        damageFox(fox, baseDamage * falloff, shot.direction, player.knockback);
      }
    }
  }

  const hadShot = spearShots.length > 0;
  spearShots = spearShots.filter((shot) => !(shot.returning && shot.progress <= 0));
  if (hadShot && spearShots.length === 0 && player && player.weapon === 'spear') {
    player.spearBusy = false;
  }
};

beginHammerWindup = function beginBalancedHammerWindup() {
  if (player.hammerWindup > 0) return false;
  const target = nearestLivingFox(player.attackRange + 12);
  if (!target) return false;
  player.hammerDirection = getAttackDirection(target);
  player.facing = player.hammerDirection;
  player.hammerWindup = player.hammerWindupBase;
  playTone(150, 0.08, 0.025, 'square');
  return true;
};

resolveHammerAttack = function resolveBalancedHammerAttack() {
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

  for (const fox of foxes) {
    if (fox.dead || fox.health <= 0) continue;
    const dx = fox.x - centerX;
    const dy = fox.y - centerY;
    if (Math.hypot(dx, dy) <= player.slamRadius + fox.radius) {
      damageFox(fox, player.attackDamage, normalized(dx, dy), player.knockback, player.stunDuration);
    }
  }

  cameraShake = Math.max(cameraShake, 9);
  addParticles(centerX, centerY, '💥', 8);
  playTone(105, 0.12, 0.06, 'square');
};

performWeaponAttack = function performBalancedWeaponAttack() {
  if (player.weapon === 'sword') return performSwordAttack();
  if (player.weapon === 'spear') return performSpearAttack();
  return beginHammerWindup();
};

activateRallyPulse = function activateRallyPulse() {
  player.rallyCooldown = 12;
  player.rallyPulseFor = 1.8;
  addParticles(player.x, player.y, '🔔', 5);

  for (const chick of chicks) {
    if (chick.lost || chick.carriedBy) continue;
    if (player.rallyLevel >= 3) {
      chick.protectedFor = Math.max(chick.protectedFor, 1.25);
    }
  }
  playTone(790, 0.12, 0.045, 'sine');
};

updateRally = function updateRally(deltaTime) {
  if (player.rallyLevel < 2) return;
  player.rallyCooldown -= deltaTime;
  if (player.rallyCooldown <= 0) activateRallyPulse();
};
