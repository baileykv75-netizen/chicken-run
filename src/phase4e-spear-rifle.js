// Preserve spear volley growth after entering the rifle worldline.
const stage4eRifleWeaponUpgradesBase = weaponUpgrades;
weaponUpgrades = function stage4eRifleGrowthUpgrades() {
  const upgrades = stage4eRifleWeaponUpgradesBase();
  if (!player?.gunMode || player.gunArchetype !== 'rifle' || (player.spearCount || 1) >= 5) {
    return upgrades;
  }

  upgrades.push({
    id: 'rifle-volley',
    icon: '🎯',
    rarity: '武器',
    name: '齐射机匣',
    description: () => `步枪额外增加 1 条弹道（当前 ${player.spearCount || 1} 条，最多 5 条）`,
    apply: () => {
      player.spearCount = Math.min(5, (player.spearCount || 1) + 1);
      player.spearSpread = Math.max(0.095, (player.spearSpread || 0.135) * 0.95);
      player.weaponUpgradeCount = (player.weaponUpgradeCount || 0) + 1;
    },
  });
  return upgrades;
};

function stage4eInsertNearestRifleHit(hits, fox, distance, limit) {
  let insertAt = hits.length;
  while (insertAt > 0 && hits[insertAt - 1].distance > distance) insertAt -= 1;
  hits.splice(insertAt, 0, { fox, distance });
  if (hits.length > limit) hits.pop();
}

performRifleAttack = function performStage4eVolleyRifleAttack() {
  const rifleRange = Math.max(390, player.attackRange * 1.35);
  const target = nearestLivingFox(rifleRange);
  if (!target) return false;

  const baseDirection = normalized(target.x - player.x, target.y - player.y);
  const count = clamp(Math.floor(player.spearCount || 1), 1, 6);
  const volleyDirections = stage4eSpearVolleyDirections(baseDirection, count);
  const rifleDamage = Math.max(25, (player.damageOut + player.damageBack) * 0.84);
  const maxHits = Math.max(3, player.maxPierce);
  const previousBatchState = stage4cBatchDamage;
  let hitAny = false;

  stage4cBatchDamage = true;
  try {
    for (const volley of volleyDirections) {
      const endX = player.x + volley.direction.x * rifleRange;
      const endY = player.y + volley.direction.y * rifleRange;
      const padding = 26;
      const minX = Math.min(player.x, endX) - padding;
      const maxX = Math.max(player.x, endX) + padding;
      const minY = Math.min(player.y, endY) - padding;
      const maxY = Math.max(player.y, endY) + padding;
      const hits = [];

      for (const fox of foxes) {
        if (fox.dead || fox.health <= 0) continue;
        if (fox.x < minX || fox.x > maxX || fox.y < minY || fox.y > maxY) continue;
        const hitRadius = fox.radius + 7;
        if (
          stage4ePointSegmentDistanceSquared(
            fox.x,
            fox.y,
            player.x,
            player.y,
            endX,
            endY,
          ) > hitRadius * hitRadius
        ) continue;
        stage4eInsertNearestRifleHit(hits, fox, distanceSquared(player, fox), maxHits);
      }

      for (let index = 0; index < hits.length; index += 1) {
        damageFox(
          hits[index].fox,
          rifleDamage * volley.multiplier * Math.pow(0.91, index),
          volley.direction,
          8,
        );
        hitAny = true;
      }

      stage4bGunShots.push({
        x1: player.x,
        y1: player.y,
        x2: endX,
        y2: endY,
        life: 0.12,
        kind: 'rifle',
      });
    }
  } finally {
    stage4cBatchDamage = previousBatchState;
  }

  player.spearThrows += 1;
  if (player.dashEvery > 0 && player.spearThrows % player.dashEvery === 0) {
    performSpearDash(baseDirection);
  }
  player.facing = baseDirection;
  playTone(560 + count * 16, 0.065, 0.043, 'square');
  return hitAny;
};