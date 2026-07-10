// Spear growth patch: turn late-game spear upgrades into visible multi-projectile scaling.
const stage4eSpearCreatePlayerBase = createPlayer;
createPlayer = function createStage4eSpearPlayer() {
  const next = stage4eSpearCreatePlayerBase();
  next.spearCount = 1;
  next.spearSpread = 0.135;
  next.spearSideDamage = 0.76;
  return next;
};

function stage4eRotateDirection(direction, angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return {
    x: direction.x * cosine - direction.y * sine,
    y: direction.x * sine + direction.y * cosine,
  };
}

function stage4eSpearVolleyDirections(direction, count) {
  if (count <= 1) return [{ direction, multiplier: 1 }];
  const result = [];
  const middle = (count - 1) / 2;
  const spread = player.spearSpread || 0.135;
  for (let index = 0; index < count; index += 1) {
    const offset = (index - middle) * spread;
    const isCenter = Math.abs(index - middle) < 0.01;
    result.push({
      direction: stage4eRotateDirection(direction, offset),
      multiplier: isCenter ? 1 : player.spearSideDamage || 0.76,
    });
  }
  return result;
}

performSpearAttack = function performStage4eSpearVolley() {
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
  const count = clamp(Math.floor(player.spearCount || 1), 1, 6);
  for (const volley of stage4eSpearVolleyDirections(direction, count)) {
    spearShots.push({
      originX: player.x,
      originY: player.y,
      direction: volley.direction,
      distance: player.attackRange,
      progress: 0,
      returning: false,
      speed: player.projectileSpeed,
      previousX: player.x,
      previousY: player.y,
      x: player.x,
      y: player.y,
      damageMultiplier: volley.multiplier,
      hitOut: new Set(),
      hitBack: new Set(),
      pierceOut: 0,
      pierceBack: 0,
    });
  }

  addParticles(player.x + direction.x * 24, player.y + direction.y * 24, '✦', Math.min(5, count + 1));
  playTone(610 + count * 18, 0.065, 0.034, 'triangle');
  return true;
};

updateSpearShots = function updateStage4eSpearShots(deltaTime) {
  for (const shot of spearShots) {
    shot.previousX = shot.x;
    shot.previousY = shot.y;
    const outwardDuration = shot.distance / shot.speed;
    const returnDuration = shot.distance / (shot.speed * 1.16);

    if (!shot.returning) {
      shot.progress += deltaTime / outwardDuration;
      if (shot.progress >= 1) {
        shot.progress = 1;
        shot.returning = true;
      }
    } else {
      shot.progress -= deltaTime / returnDuration;
    }

    shot.x = shot.originX + shot.direction.x * shot.distance * shot.progress;
    shot.y = shot.originY + shot.direction.y * shot.distance * shot.progress;

    const hitSet = shot.returning ? shot.hitBack : shot.hitOut;
    const pierceKey = shot.returning ? 'pierceBack' : 'pierceOut';
    const isSunRoute = player.overlimitRoute === 'spear-sun';
    const falloffBase = isSunRoute ? 0.985 : 0.95;
    const pierceLimit = isSunRoute ? player.maxPierce + 5 : player.maxPierce;

    for (const fox of foxes) {
      if (
        fox.dead ||
        fox.health <= 0 ||
        hitSet.has(fox) ||
        shot[pierceKey] >= pierceLimit
      ) continue;

      if (
        pointSegmentDistance(
          fox.x,
          fox.y,
          shot.previousX,
          shot.previousY,
          shot.x,
          shot.y,
        ) <= fox.radius + 9
      ) {
        hitSet.add(fox);
        const falloff = Math.pow(falloffBase, shot[pierceKey]);
        shot[pierceKey] += 1;
        const baseDamage = shot.returning ? player.damageBack : player.damageOut;
        const routeMultiplier = isSunRoute ? 1.24 : 1;
        const volleyMultiplier = shot.damageMultiplier || 1;
        damageFox(
          fox,
          baseDamage * falloff * routeMultiplier * volleyMultiplier,
          shot.direction,
          player.knockback,
        );
      }
    }
  }

  const hadShot = spearShots.length > 0;
  spearShots = spearShots.filter((shot) => !(shot.returning && shot.progress <= 0));
  if (hadShot && spearShots.length === 0 && player && player.weapon === 'spear') {
    player.spearBusy = false;
  }
};

const stage4eSpearWeaponUpgradesBase = weaponUpgrades;
weaponUpgrades = function stage4eSpearWeaponUpgrades() {
  if (!player || player.weapon !== 'spear' || player.gunMode) {
    return stage4eSpearWeaponUpgradesBase();
  }

  const upgrades = [];
  if ((player.spearCount || 1) < 5) {
    upgrades.push({
      id: 'spear-volley',
      icon: '🔱',
      rarity: '武器',
      name: '枪出如林',
      description: () => `每轮额外投出 1 支长枪（当前 ${player.spearCount || 1} 支，最多 5 支）`,
      apply: () => {
        player.spearCount = Math.min(5, (player.spearCount || 1) + 1);
        player.spearSpread = Math.max(0.105, (player.spearSpread || 0.135) * 0.96);
        player.weaponUpgradeCount = (player.weaponUpgradeCount || 0) + 1;
      },
    });
  }

  upgrades.push(
    {
      id: 'spear-edge',
      icon: '💥',
      rarity: '武器',
      name: '破阵枪锋',
      description: '投出与召回伤害提高 18%，并额外穿透 1 只狐狸',
      apply: () => {
        player.damageOut *= 1.18;
        player.damageBack *= 1.18;
        player.maxPierce += 1;
        player.weaponUpgradeCount = (player.weaponUpgradeCount || 0) + 1;
      },
    },
    {
      id: 'spear-return-force',
      icon: '↩️',
      rarity: '武器',
      name: '回马增势',
      description: '召回伤害提高 24%，飞行速度提高 15%，攻击间隔缩短 6%',
      apply: () => {
        player.damageBack *= 1.24;
        player.projectileSpeed *= 1.15;
        player.attackInterval = Math.max(0.36, player.attackInterval * 0.94);
        player.weaponUpgradeCount = (player.weaponUpgradeCount || 0) + 1;
      },
    },
    {
      id: 'spear-dash-growth',
      icon: '🐉',
      rarity: '武器',
      name: '七进七出',
      description: '每 3 次投枪触发突进；突进距离与伤害提高 15%',
      apply: () => {
        player.dashEvery = 3;
        player.dashDistance *= 1.15;
        player.dashDamage *= 1.15;
        player.weaponUpgradeCount = (player.weaponUpgradeCount || 0) + 1;
      },
    },
  );

  return upgrades;
};

const stage4eSpearOverlimitBase = stage4cApplyOverlimit;
stage4cApplyOverlimit = function stage4eSpearOverlimit(route) {
  stage4eSpearOverlimitBase(route);
  if (route === 'spear-sun') {
    player.spearCount = Math.min(6, (player.spearCount || 1) + 1);
    player.spearSideDamage = Math.min(0.9, (player.spearSideDamage || 0.76) + 0.08);
  } else if (route === 'spear-dragon') {
    player.attackInterval = Math.max(0.32, player.attackInterval * 0.9);
    player.spearSpread = Math.max(0.095, (player.spearSpread || 0.135) * 0.9);
  }
};