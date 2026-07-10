const stage4bNearestAvailableChick = nearestAvailableChick;
nearestAvailableChick = function nearestStage4bChick(fox) {
  let best = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const chick of chicks) {
    if (
      chick.lost ||
      chick.carriedBy ||
      chick.scouting ||
      chick.awakened ||
      (chick.protectedFor || 0) > 0
    ) continue;
    const candidateDistance = distanceSquared(fox, chick);
    if (candidateDistance < bestDistance) {
      bestDistance = candidateDistance;
      best = chick;
    }
  }
  return best;
};

const stage4bGainExperience = gainExperience;
gainExperience = function gainStage4bExperience(amount) {
  const level = skillLevel('rogue-cultivation');
  if (level <= 0) {
    stage4bGainExperience(amount);
    return;
  }

  const target = ensureCultivatedChick();
  const share = level === 1 ? 0.3 : level === 2 ? 0.4 : 0.5;
  const diverted = amount * share;
  if (target && !target.lost) {
    player.cultivationExp += diverted;
    target.cultivationPower = 1 + Math.sqrt(player.cultivationExp) * 0.42;
  }
  stage4bGainExperience(amount * (1 - share));
};

function nearestFoxToPoint(x, y, range = Number.POSITIVE_INFINITY, excluded = new Set()) {
  let best = null;
  let bestDistance = range * range;
  for (const fox of foxes) {
    if (fox.dead || fox.health <= 0 || excluded.has(fox)) continue;
    const candidateDistance = (fox.x - x) ** 2 + (fox.y - y) ** 2;
    if (candidateDistance < bestDistance) {
      bestDistance = candidateDistance;
      best = fox;
    }
  }
  return best;
}

function updateCombatChicks(deltaTime) {
  const awakenLevel = skillLevel('chick-awaken');
  const rogueLevel = skillLevel('rogue-cultivation');

  for (const chick of chicks) {
    if (chick.lost || chick.carriedBy || chick.scouting) continue;
    if (!chick.awakened && !chick.cultivated) continue;

    chick.guardCooldown = Math.max(0, (chick.guardCooldown || 0) - deltaTime);
    if (chick.guardCooldown > 0) continue;

    const isAwakened = Boolean(chick.awakened);
    const isCultivated = Boolean(chick.cultivated);
    let range = 92;
    let cooldown = 1.15;
    let damage = 12;
    let stun = 0;
    let knockback = 9;

    if (isAwakened) {
      if (player.weapon === 'sword') {
        range = 95;
        cooldown = 0.95;
        damage = 14;
      } else if (player.weapon === 'spear') {
        range = 150;
        cooldown = 1.15;
        damage = 17;
      } else {
        range = 88;
        cooldown = 1.4;
        damage = 23;
        stun = 0.25;
        knockback = 22;
      }
      damage *= 1 + Math.max(0, awakenLevel - 1) * 0.25;
      if (awakenLevel >= 3) cooldown *= 0.7;
    }

    if (isCultivated && rogueLevel > 0) {
      range = Math.max(range, 92 + rogueLevel * 18);
      cooldown = Math.min(cooldown, 1.05 - rogueLevel * 0.1);
      damage = Math.max(damage, 10 + (chick.cultivationPower || 1) * 6.5);
      if (rogueLevel >= 3) stun = Math.max(stun, 0.18);
    }

    const target = nearestFoxToPoint(chick.x, chick.y, range);
    if (!target) continue;
    const direction = normalized(target.x - chick.x, target.y - chick.y);
    damageFox(target, damage, direction, knockback, stun);
    if (isCultivated && rogueLevel >= 3) {
      for (const nearby of foxes) {
        if (nearby === target || nearby.dead || nearby.health <= 0) continue;
        if ((nearby.x - target.x) ** 2 + (nearby.y - target.y) ** 2 <= 48 ** 2) {
          damageFox(nearby, damage * 0.42, normalized(nearby.x - target.x, nearby.y - target.y), 8, 0.08);
        }
      }
    }
    addParticles(target.x, target.y, isCultivated ? '🌀' : '✦', 2);
    chick.guardCooldown = cooldown;
  }
}

function spawnBrucieDogs() {
  const level = skillLevel('brucie');
  if (level <= 0) return;
  const count = level >= 3 ? 2 : 1;
  const used = new Set();
  for (let index = 0; index < count; index += 1) {
    const target = foxes
      .filter((fox) => !fox.dead && fox.health > 0 && !used.has(fox))
      .sort((a, b) => Number(Boolean(b.carrying)) - Number(Boolean(a.carrying)) || distanceSquared(player, a) - distanceSquared(player, b))[0];
    if (target) used.add(target);
    stage4bDogs.push({
      x: player.x + random(-18, 18),
      y: player.y + random(-18, 18),
      target,
      life: level >= 2 ? 5 : 4,
      biteCooldown: 0,
      phase: random(0, Math.PI * 2),
    });
  }
  addParticles(player.x, player.y, '🐾', 5);
}

function updateBrucie(deltaTime) {
  const level = skillLevel('brucie');
  if (level <= 0) return;
  player.brucieCooldown -= deltaTime;
  if (player.brucieCooldown <= 0) {
    spawnBrucieDogs();
    player.brucieCooldown = level === 1 ? 14 : level === 2 ? 10.5 : 9;
  }

  for (const dog of stage4bDogs) {
    dog.life -= deltaTime;
    dog.phase += deltaTime * 10;
    dog.biteCooldown -= deltaTime;
    if (!dog.target || dog.target.dead || dog.target.health <= 0) {
      dog.target = foxes
        .filter((fox) => !fox.dead && fox.health > 0)
        .sort((a, b) => Number(Boolean(b.carrying)) - Number(Boolean(a.carrying)) || (a.x - dog.x) ** 2 + (a.y - dog.y) ** 2 - ((b.x - dog.x) ** 2 + (b.y - dog.y) ** 2))[0] || null;
    }
    if (!dog.target) continue;
    const dx = dog.target.x - dog.x;
    const dy = dog.target.y - dog.y;
    const distance = Math.hypot(dx, dy);
    const direction = normalized(dx, dy);
    if (distance > 22) {
      dog.x += direction.x * 285 * deltaTime;
      dog.y += direction.y * 285 * deltaTime;
    } else if (dog.biteCooldown <= 0) {
      const damage = level === 1 ? 12 : level === 2 ? 18 : 17;
      const stun = level === 1 ? 0.65 : 0.9;
      damageFox(dog.target, damage, direction, 5, stun);
      addParticles(dog.target.x, dog.target.y, '🐾', 2);
      dog.biteCooldown = 0.48;
    }
  }
  stage4bDogs = stage4bDogs.filter((dog) => dog.life > 0);
}

function startExpedition() {
  const level = skillLevel('chicken-hill');
  if (level <= 0) return;
  const target = aliveChicks((chick) => !chick.scouting && !chick.awakened)[0];
  if (!target) return;
  target.scouting = true;
  target.scoutingFor = level === 1 ? 10 : 8;
  target.scoutOriginX = target.x;
  target.scoutOriginY = target.y;
  addParticles(target.x, target.y, '⛰️', 4);
}

function updateExpeditions(deltaTime) {
  const level = skillLevel('chicken-hill');
  if (level <= 0) return;
  player.scoutCooldown -= deltaTime;
  if (player.scoutCooldown <= 0) {
    startExpedition();
    player.scoutCooldown = level === 1 ? 34 : level === 2 ? 27 : 23;
  }

  for (const chick of chicks) {
    if (!chick.scouting) continue;
    chick.scoutingFor -= deltaTime;
    chick.x = player.x;
    chick.y = player.y;
    if (chick.scoutingFor > 0) continue;
    chick.scouting = false;
    chick.x = player.x + random(-55, 55);
    chick.y = player.y + random(-55, 55);
    player.health = Math.min(player.maxHealth, player.health + 6 + level * 5);
    stage4bGainExperience(1.5 + level * 1.5);
    if (level >= 3 && !chick.awakened) {
      chick.awakened = true;
      chick.guardCooldown = 0.3;
    }
    addParticles(chick.x, chick.y, '🎒', 6);
    playTone(830, 0.13, 0.04, 'sine');
  }
}
