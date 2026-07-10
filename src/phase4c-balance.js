// Phase 4C: restore spear flow, strengthen sword identity, and track weapon growth.
WEAPONS.sword.attackInterval = 0.58;
WEAPONS.sword.damage = 43;
WEAPONS.sword.range = 84;
WEAPONS.sword.knockback = 24;

WEAPONS.spear.attackInterval = 0.9;
WEAPONS.spear.damageOut = 29;
WEAPONS.spear.damageBack = 30;
WEAPONS.spear.projectileSpeed = 600;
WEAPONS.spear.maxPierce = 6;
WEAPONS.spear.dashDistance = 125;
WEAPONS.spear.dashDamage = 26;

const stage4cBalanceCreatePlayerBase = createPlayer;
createPlayer = function createStage4cBalancedPlayer() {
  const next = stage4cBalanceCreatePlayerBase();
  next.swordRhythm = 0;
  next.weaponUpgradeCount = 0;
  next.cauldronEnergy = 0;
  next.cauldronReady = false;
  next.overlimitRoute = null;
  next.overlimitChosen = false;
  next.chaseLightCooldown = 0;
  return next;
};

function stage4cSwordWave() {
  const isRing = player.overlimitRoute === 'sword-ring';
  const range = isRing ? Math.max(165, player.attackRange * 1.65) : Math.max(175, player.attackRange * 1.9);
  const direction = player.facing;
  let hits = 0;

  for (const fox of foxes) {
    if (fox.dead || fox.health <= 0) continue;
    const dx = fox.x - player.x;
    const dy = fox.y - player.y;
    const distance = Math.hypot(dx, dy);
    if (distance > range + fox.radius) continue;

    if (!isRing) {
      const projection = dx * direction.x + dy * direction.y;
      if (projection < 0) continue;
      const lateral = Math.abs(dx * direction.y - dy * direction.x);
      if (lateral > 24 + fox.radius) continue;
    }

    damageFox(
      fox,
      player.attackDamage * (isRing ? 0.72 : 0.68),
      normalized(dx, dy),
      player.knockback * 0.82,
      0.06,
    );
    hits += 1;
    if (!isRing && hits >= 7) break;
  }

  if (isRing) {
    hammerSlams.push({
      x: player.x,
      y: player.y,
      radius: range,
      life: 0.22,
      maxLife: 0.22,
    });
  } else {
    dashTrails.push({
      x1: player.x,
      y1: player.y,
      x2: player.x + direction.x * range,
      y2: player.y + direction.y * range,
      life: 0.18,
    });
  }
  addParticles(player.x + direction.x * 42, player.y + direction.y * 42, '✦', 3);
  playTone(720, 0.055, 0.03, 'triangle');
}

const stage4cBalanceSwordAttackBase = performSwordAttack;
performSwordAttack = function performStage4cSwordAttack(extra = false) {
  const attacked = stage4cBalanceSwordAttackBase(extra);
  if (!attacked || extra || player.gunMode) return attacked;

  player.swordRhythm = (player.swordRhythm || 0) + 1;
  if (player.swordRhythm % 3 === 0) stage4cSwordWave();
  return true;
};

updateSpearShots = function updateStage4cSpearShots(deltaTime) {
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
    const falloffBase = isSunRoute ? 0.975 : 0.94;
    const pierceLimit = isSunRoute ? player.maxPierce + 4 : player.maxPierce;

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
        const routeMultiplier = isSunRoute ? 1.22 : 1;
        damageFox(fox, baseDamage * falloff * routeMultiplier, shot.direction, player.knockback);
      }
    }
  }

  const hadShot = spearShots.length > 0;
  spearShots = spearShots.filter((shot) => !(shot.returning && shot.progress <= 0));
  if (hadShot && spearShots.length === 0 && player && player.weapon === 'spear') {
    player.spearBusy = false;
  }
};

const stage4cBalanceWeaponUpgradesBase = weaponUpgrades;
weaponUpgrades = function stage4cTrackedWeaponUpgrades() {
  return stage4cBalanceWeaponUpgradesBase().map((upgrade) => {
    const originalApply = upgrade.apply;
    return {
      ...upgrade,
      apply: () => {
        originalApply();
        player.weaponUpgradeCount = (player.weaponUpgradeCount || 0) + 1;
      },
    };
  });
};
