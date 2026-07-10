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

performRifleAttack = function performStage4eVolleyRifleAttack() {
  const rifleRange = Math.max(390, player.attackRange * 1.35);
  const target = nearestLivingFox(rifleRange);
  if (!target) return false;

  const baseDirection = normalized(target.x - player.x, target.y - player.y);
  const count = clamp(Math.floor(player.spearCount || 1), 1, 6);
  const volleyDirections = stage4eSpearVolleyDirections(baseDirection, count);
  const rifleDamage = Math.max(25, (player.damageOut + player.damageBack) * 0.84);
  let hitAny = false;

  for (const volley of volleyDirections) {
    const endX = player.x + volley.direction.x * rifleRange;
    const endY = player.y + volley.direction.y * rifleRange;
    const candidates = foxes
      .filter((fox) => (
        !fox.dead &&
        fox.health > 0 &&
        pointSegmentDistance(fox.x, fox.y, player.x, player.y, endX, endY) <= fox.radius + 7
      ))
      .sort((a, b) => distanceSquared(player, a) - distanceSquared(player, b))
      .slice(0, Math.max(3, player.maxPierce));

    candidates.forEach((fox, index) => {
      damageFox(
        fox,
        rifleDamage * volley.multiplier * Math.pow(0.91, index),
        volley.direction,
        8,
      );
      hitAny = true;
    });

    stage4bGunShots.push({
      x1: player.x,
      y1: player.y,
      x2: endX,
      y2: endY,
      life: 0.12,
      kind: 'rifle',
    });
  }

  player.spearThrows += 1;
  if (player.dashEvery > 0 && player.spearThrows % player.dashEvery === 0) {
    performSpearDash(baseDirection);
  }
  player.facing = baseDirection;
  playTone(560 + count * 16, 0.065, 0.043, 'square');
  return hitAny;
};