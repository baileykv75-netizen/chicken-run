// Phase 4C: cauldron progression and first weapon overlimit branches.
ui.cauldronPill = document.querySelector('#cauldronPill');
ui.cauldronEnergy = document.querySelector('#cauldronEnergy');

const STAGE4C_CAULDRON_GOAL = 20;
let stage4cDelayedSlams = [];

const stage4cProgressionResetBase = resetGame;
resetGame = function resetStage4cProgression() {
  stage4cDelayedSlams = [];
  stage4cProgressionResetBase();
};

function stage4cChargeCauldron(amount) {
  if (!player || skillLevel('break-cauldron') <= 0 || player.overlimitChosen) return;
  player.cauldronEnergy = Math.min(STAGE4C_CAULDRON_GOAL, (player.cauldronEnergy || 0) + amount);
  if (player.cauldronEnergy >= STAGE4C_CAULDRON_GOAL && !player.cauldronReady) {
    player.cauldronReady = true;
    addParticles(player.x, player.y, '🔥', 8);
    addParticles(player.x, player.y, '鼎', 3);
    playTone(980, 0.2, 0.05, 'triangle');
  }
}

const stage4cProgressionDefeatFoxBase = defeatFox;
defeatFox = function defeatStage4cFox(fox) {
  if (fox.dead) return;
  const carriedRescue = Boolean(fox.carrying);
  const wasStunned = (fox.stunnedFor || 0) > 0;
  const x = fox.x;
  const y = fox.y;
  const type = fox.type;
  stage4cChargeCauldron((type === 'brute' ? 3 : 1) + (carriedRescue ? 2 : 0));
  stage4cProgressionDefeatFoxBase(fox);

  if (player?.overlimitRoute === 'sword-chase' && (player.chaseLightCooldown || 0) <= 0) {
    const target = nearestFoxToPoint(x, y, 230);
    if (target) {
      player.chaseLightCooldown = 0.12;
      const direction = normalized(target.x - x, target.y - y);
      damageFox(target, player.attackDamage * 0.58, direction, player.knockback * 0.6);
      dashTrails.push({ x1: x, y1: y, x2: target.x, y2: target.y, life: 0.16 });
    }
  }

  if (player?.overlimitRoute === 'hammer-control' && wasStunned) {
    for (const nearby of foxes) {
      if (nearby.dead || nearby.health <= 0) continue;
      const dx = nearby.x - x;
      const dy = nearby.y - y;
      if (dx * dx + dy * dy <= 110 ** 2) {
        nearby.stunnedFor = Math.max(nearby.stunnedFor || 0, 0.42);
      }
    }
  }
};

function stage4cApplyOverlimit(route) {
  player.overlimitRoute = route;
  player.overlimitChosen = true;
  player.cauldronReady = false;
  player.cauldronEnergy = STAGE4C_CAULDRON_GOAL;

  if (route === 'sword-ring') {
    player.attackRange *= 1.12;
    if (player.gunMode) player.revolverTargets = Math.min(7, (player.revolverTargets || 3) + 2);
  } else if (route === 'sword-chase') {
    player.attackInterval = Math.max(0.22, player.attackInterval * 0.88);
  } else if (route === 'spear-sun') {
    player.maxPierce += 3;
    player.damageOut *= 1.12;
    player.damageBack *= 1.12;
  } else if (route === 'spear-dragon') {
    player.dashEvery = Math.min(player.dashEvery || 4, 3);
    player.dashDistance *= 1.18;
    player.doubleDash = true;
  } else if (route === 'hammer-sky') {
    player.attackDamage *= 1.12;
    player.secondarySlam = true;
  } else if (route === 'hammer-control') {
    player.stunDuration += 0.42;
    player.knockback *= 1.12;
  }

  setSkillLevel(route, 1);
  addParticles(player.x, player.y, '⚡', 10);
  playTone(1080, 0.22, 0.055, 'sawtooth');
}

function stage4cOverlimitDefinitions() {
  if (!player?.cauldronReady || player.overlimitChosen) return [];
  if (player.weapon === 'sword') {
    return [
      {
        id: 'sword-ring', icon: '⭕', rarity: '超限', maxLevel: 1,
        name: '无死角',
        description: () => '长剑第三击的剑气变为 360° 环斩；左轮额外锁定目标',
        apply: () => stage4cApplyOverlimit('sword-ring'),
      },
      {
        id: 'sword-chase', icon: '✨', rarity: '超限', maxLevel: 1,
        name: '追光',
        description: () => '击败狐狸后，剑光自动追击附近下一只目标',
        apply: () => stage4cApplyOverlimit('sword-chase'),
      },
    ];
  }
  if (player.weapon === 'spear') {
    return [
      {
        id: 'spear-sun', icon: '☀️', rarity: '超限', maxLevel: 1,
        name: '贯日',
        description: () => '长枪往返伤害与穿透衰减大幅改善；步枪继承穿甲强化',
        apply: () => stage4cApplyOverlimit('spear-sun'),
      },
      {
        id: 'spear-dragon', icon: '🐉', rarity: '超限', maxLevel: 1,
        name: '游龙',
        description: () => '突进触发更频繁，并追加第二段穿阵位移',
        apply: () => stage4cApplyOverlimit('spear-dragon'),
      },
    ];
  }
  return [
    {
      id: 'hammer-sky', icon: '🌋', rarity: '超限', maxLevel: 1,
      name: '天崩',
      description: () => '每次砸地后产生一次延迟震波；霰弹枪获得额外爆发',
      apply: () => stage4cApplyOverlimit('hammer-sky'),
    },
    {
      id: 'hammer-control', icon: '🔔', rarity: '超限', maxLevel: 1,
      name: '镇场',
      description: () => '眩晕目标被击败时，把控制传播给附近狐狸',
      apply: () => stage4cApplyOverlimit('hammer-control'),
    },
  ];
}

const stage4cProgressionSkillDefinitionsBase = currentSkillDefinitions;
currentSkillDefinitions = function currentStage4cSkills() {
  const definitions = stage4cProgressionSkillDefinitionsBase();
  definitions.push({
    id: 'break-cauldron',
    icon: '🏺',
    rarity: '机制',
    maxLevel: 1,
    minPlayerLevel: 4,
    name: '助我破鼎',
    description: () => '击败狐狸与救回小鸡积攒鼎火；满鼎后解锁当前武器的超限二选一',
    apply: () => {
      setSkillLevel('break-cauldron', 1);
      player.cauldronEnergy = 0;
      player.cauldronReady = false;
      addParticles(player.x, player.y, '🏺', 6);
    },
  });
  return definitions.concat(stage4cOverlimitDefinitions());
};

const stage4cProgressionBuildChoicesBase = buildUpgradeChoices;
buildUpgradeChoices = function buildStage4cUpgradeChoices(excludedIds = new Set()) {
  if (player?.cauldronReady && !player.overlimitChosen) {
    const routes = stage4cOverlimitDefinitions();
    const used = new Set([...excludedIds, ...routes.map((route) => route.id)]);
    const extra = randomFrom([...weaponUpgrades(), ...commonUpgrades()], used);
    const choices = extra ? [...routes, extra] : routes;
    return choices.sort(() => Math.random() - 0.5);
  }
  return stage4cProgressionBuildChoicesBase(excludedIds);
};

const stage4cProgressionSpearDashBase = performSpearDash;
performSpearDash = function performStage4cSpearDash(direction) {
  stage4cProgressionSpearDashBase(direction);
  if (!player.doubleDash) return;

  const startX = player.x;
  const startY = player.y;
  const secondDistance = player.dashDistance * 0.58;
  const endX = clamp(startX + direction.x * secondDistance, 18, world.width - 18);
  const endY = clamp(startY + direction.y * secondDistance, 18, world.height - 18);
  for (const fox of foxes) {
    if (fox.dead || fox.health <= 0) continue;
    if (pointSegmentDistance(fox.x, fox.y, startX, startY, endX, endY) <= fox.radius + 12) {
      damageFox(fox, player.dashDamage * 0.72, direction, player.knockback, 0.12);
    }
  }
  player.x = endX;
  player.y = endY;
  dashTrails.push({ x1: startX, y1: startY, x2: endX, y2: endY, life: 0.22 });
};

const stage4cProgressionHammerResolveBase = resolveHammerAttack;
resolveHammerAttack = function resolveStage4cOverlimitHammer() {
  const direction = player.hammerDirection || player.facing;
  const centerX = player.x + direction.x * Math.min(44, player.attackRange * 0.38);
  const centerY = player.y + direction.y * Math.min(44, player.attackRange * 0.38);
  stage4cProgressionHammerResolveBase();
  if (player.secondarySlam) {
    stage4cDelayedSlams.push({
      x: centerX,
      y: centerY,
      radius: player.slamRadius * 1.18,
      delay: 0.42,
      damage: player.attackDamage * 0.48,
    });
  }
};

function stage4cUpdateDelayedSlams(deltaTime) {
  for (const slam of stage4cDelayedSlams) {
    slam.delay -= deltaTime;
    if (slam.delay > 0 || slam.done) continue;
    slam.done = true;
    hammerSlams.push({ x: slam.x, y: slam.y, radius: slam.radius, life: 0.3, maxLife: 0.3 });
    stage4cBatchDamage = true;
    for (const fox of foxes) {
      if (fox.dead || fox.health <= 0) continue;
      const dx = fox.x - slam.x;
      const dy = fox.y - slam.y;
      if (dx * dx + dy * dy <= (slam.radius + fox.radius) ** 2) {
        damageFox(fox, slam.damage, normalized(dx, dy), player.knockback * 0.65, 0.16);
      }
    }
    stage4cBatchDamage = false;
    addParticles(slam.x, slam.y, '💥', 5);
  }
  stage4cDelayedSlams = stage4cDelayedSlams.filter((slam) => !slam.done);
}

const stage4cProgressionUpdateBase = update;
update = function updateStage4cProgression(deltaTime) {
  stage4cProgressionUpdateBase(deltaTime);
  if (!player) return;
  player.chaseLightCooldown = Math.max(0, (player.chaseLightCooldown || 0) - deltaTime);
  if (state === 'playing') stage4cUpdateDelayedSlams(deltaTime);
};

const stage4cProgressionUpdateHudBase = updateHud;
updateHud = function updateStage4cProgressionHud() {
  stage4cProgressionUpdateHudBase();
  if (!player || !ui.cauldronPill || !ui.cauldronEnergy) return;
  const unlocked = skillLevel('break-cauldron') > 0;
  ui.cauldronPill.classList.toggle('hidden', !unlocked);
  if (!unlocked) return;
  ui.cauldronEnergy.textContent = player.overlimitChosen
    ? '超限'
    : player.cauldronReady
      ? '已满'
      : `${Math.floor(player.cauldronEnergy || 0)}/${STAGE4C_CAULDRON_GOAL}`;
};
