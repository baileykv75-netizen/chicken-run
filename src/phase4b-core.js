// Phase 4B: mechanism skills, one reroll per level-up, and gentler early pacing.
ui.rerollButton = document.querySelector('#rerollButton');
ui.rerollCount = document.querySelector('#rerollCount');

// Ease the first two minutes while keeping the endless curve intact.
CONFIG.foxSpawnIntervalStart = 2.85;
CONFIG.foxSpawnIntervalMin = 0.62;
ENDLESS_CONFIG.waveInterval = 35;
ENDLESS_CONFIG.dangerInterval = 45;
ENDLESS_CONFIG.mobileFoxLimit = 20;
ENDLESS_CONFIG.desktopFoxLimit = 26;

let stage4bDogs = [];
let stage4bGunShots = [];
let stage4bLastChoices = [];
let stage4bRerollUsed = false;

const stage4bCreatePlayer = createPlayer;
createPlayer = function createStage4bPlayer() {
  const next = stage4bCreatePlayer();
  next.skillLevels = Object.create(null);
  next.knifeShieldCounter = 0;
  next.knifeShieldCharges = 0;
  next.brucieCooldown = 9;
  next.scoutCooldown = 18;
  next.gunMode = false;
  next.gunArchetype = null;
  next.cultivationExp = 0;
  return next;
};

const stage4bResetGame = resetGame;
resetGame = function resetStage4bGame() {
  stage4bDogs = [];
  stage4bGunShots = [];
  stage4bLastChoices = [];
  stage4bRerollUsed = false;
  stage4bResetGame();
};

chooseFoxType = function chooseGentlerFoxType() {
  const roll = Math.random();
  const bruteChance = dangerLevel < 4 ? 0 : clamp((dangerLevel - 3) * 0.025, 0, 0.2);
  const swiftChance = clamp(0.08 + (dangerLevel - 1) * 0.024, 0.08, 0.36);
  if (roll < bruteChance) return 'brute';
  if (roll < bruteChance + swiftChance) return 'swift';
  return 'normal';
};

triggerWave = function triggerGentlerWave() {
  waveRemaining += Math.min(11, 2 + dangerLevel * 2);
  waveSpawnTimer = 0;
  waveNoticeTimer = 2.1;
  ui.waveNotice.textContent = `⚠ 狐狸潮来袭 · 危险 ${dangerLevel}`;
  ui.waveNotice.classList.remove('hidden');
  playTone(250, 0.18, 0.055, 'sawtooth');
};

const stage4bUpdateDirectorBase = updateDirector;
updateDirector = function updateStage4bDirector(deltaTime) {
  stage4bUpdateDirectorBase(deltaTime);
  if (waveRemaining > 0) {
    waveSpawnTimer = Math.max(waveSpawnTimer, 0.2);
  }
};

function skillLevel(id) {
  return player?.skillLevels?.[id] || 0;
}

function setSkillLevel(id, value) {
  player.skillLevels[id] = value;
}

function aliveChicks(filter = () => true) {
  return chicks.filter((chick) => !chick.lost && !chick.carriedBy && filter(chick));
}

function pickAwakeningTarget() {
  return aliveChicks((chick) => !chick.awakened && !chick.scouting)[0] || null;
}

function awakenOneChick() {
  const target = pickAwakeningTarget();
  if (!target) return false;
  target.awakened = true;
  target.guardCooldown = random(0.1, 0.5);
  target.protectedFor = Math.max(target.protectedFor || 0, 1.5);
  addParticles(target.x, target.y, '✨', 8);
  playTone(880, 0.14, 0.05, 'triangle');
  return true;
}

function ensureCultivatedChick() {
  let target = chicks.find((chick) => !chick.lost && chick.cultivated);
  if (target) return target;
  target = aliveChicks((chick) => !chick.scouting)[0] || null;
  if (!target) return null;
  target.cultivated = true;
  target.cultivationPower = 1;
  target.guardCooldown = random(0.1, 0.5);
  addParticles(target.x, target.y, '🌀', 7);
  return target;
}

function currentSkillDefinitions() {
  return [
    {
      id: 'chick-awaken',
      icon: '🥋',
      rarity: '机制',
      maxLevel: 3,
      name: '鸡不可貌相',
      description: () => {
        const level = skillLevel('chick-awaken');
        if (level === 0) return '觉醒一只小鸡：不可被抓，并会模仿当前武器作战';
        if (level === 1) return '再觉醒一只小鸡，觉醒鸡伤害提高 25%';
        return '再觉醒一只小鸡，全部觉醒鸡攻击速度提高 30%';
      },
      apply: () => {
        const level = skillLevel('chick-awaken') + 1;
        setSkillLevel('chick-awaken', level);
        awakenOneChick();
      },
    },
    {
      id: 'brucie',
      icon: '🐕',
      rarity: '召唤',
      maxLevel: 3,
      name: '布鲁斯，干活了',
      description: () => {
        const level = skillLevel('brucie');
        if (level === 0) return '每 14 秒召来牧场犬，优先扑倒正在抓鸡的狐狸';
        if (level === 1) return '布鲁斯冷却缩短，撕咬伤害和定身时间提高';
        return '每次同时召来两只布鲁斯，分别控制不同目标';
      },
      apply: () => {
        const level = skillLevel('brucie') + 1;
        setSkillLevel('brucie', level);
        player.brucieCooldown = Math.min(player.brucieCooldown, 1.5);
      },
    },
    {
      id: 'knife-shield',
      icon: '⚔️🛡️',
      rarity: '攻防',
      maxLevel: 3,
      name: '我的刀盾',
      description: () => {
        const level = skillLevel('knife-shield');
        if (level === 0) return '每完成 3 次武器攻击积攒一次盾反，自动挡住下一次碰撞';
        if (level === 1) return '盾反伤害提高，并根据当前武器触发不同反击';
        return '每 2 次攻击即可积攒盾反，最多储存 2 次';
      },
      apply: () => {
        const level = skillLevel('knife-shield') + 1;
        setSkillLevel('knife-shield', level);
        player.knifeShieldCharges = Math.max(player.knifeShieldCharges, 1);
      },
    },
    {
      id: 'rogue-cultivation',
      icon: '🌀🐥',
      rarity: '养成',
      maxLevel: 3,
      name: '养鸡邪修',
      description: () => {
        const level = skillLevel('rogue-cultivation');
        if (level === 0) return '分出 30% 经验喂养一只小鸡；它会越来越强，但仍可能被抓走';
        if (level === 1) return '经验分流提高到 40%，邪修鸡攻击范围与伤害提高';
        return '经验分流提高到 50%，邪修鸡获得小范围冲击攻击';
      },
      apply: () => {
        const level = skillLevel('rogue-cultivation') + 1;
        setSkillLevel('rogue-cultivation', level);
        ensureCultivatedChick();
      },
    },
    {
      id: 'chicken-hill',
      icon: '⛰️🐥',
      rarity: '历练',
      maxLevel: 3,
      name: '翻过鸡鸣坡',
      description: () => {
        const level = skillLevel('chicken-hill');
        if (level === 0) return '定期派一只小鸡外出历练，安全归来后带回经验和治疗';
        if (level === 1) return '历练更频繁，带回的经验和治疗提高';
        return '历练归来的小鸡会直接觉醒，成为战斗鸡';
      },
      apply: () => {
        const level = skillLevel('chicken-hill') + 1;
        setSkillLevel('chicken-hill', level);
        player.scoutCooldown = Math.min(player.scoutCooldown, 3);
      },
    },
    {
      id: 'end-cold-weapons',
      icon: '🔫',
      rarity: '世界线',
      maxLevel: 1,
      minPlayerLevel: 5,
      name: '结束冷兵器时代',
      description: () => {
        if (player.weapon === 'sword') return '长剑转化为左轮：继承扇形与连斩，改为中距离多目标射击';
        if (player.weapon === 'spear') return '长枪转化为步枪：继承穿透与第四击位移，改为直线射击';
        return '大锤转化为霰弹枪：继承击退与眩晕，改为近距离扇形爆发';
      },
      apply: () => activateGunWorldline(),
    },
  ];
}

function availableMechanismSkills() {
  return currentSkillDefinitions().filter((skill) => {
    const level = skillLevel(skill.id);
    const playerLevelReady = !skill.minPlayerLevel || player.level >= skill.minPlayerLevel;
    return level < skill.maxLevel && playerLevelReady;
  });
}

function randomFrom(items, excludedIds = new Set()) {
  const available = items.filter((item) => !excludedIds.has(item.id));
  const source = available.length ? available : items;
  return source.length ? source[Math.floor(Math.random() * source.length)] : null;
}

function buildUpgradeChoices(excludedIds = new Set()) {
  const mechanismPool = availableMechanismSkills();
  const weaponPool = weaponUpgrades();
  const supportPool = commonUpgrades();
  const chosen = [];
  const used = new Set(excludedIds);

  const mechanism = randomFrom(mechanismPool, used);
  if (mechanism) {
    chosen.push(mechanism);
    used.add(mechanism.id);
  }

  const weaponChoice = randomFrom(weaponPool, used);
  if (weaponChoice) {
    chosen.push(weaponChoice);
    used.add(weaponChoice.id);
  }

  const supportChoice = randomFrom(supportPool, used);
  if (supportChoice) {
    chosen.push(supportChoice);
    used.add(supportChoice.id);
  }

  const fallback = [...mechanismPool, ...weaponPool, ...supportPool];
  while (chosen.length < 3) {
    const next = randomFrom(fallback, used);
    if (!next) break;
    chosen.push(next);
    used.add(next.id);
  }

  return chosen.sort(() => Math.random() - 0.5);
}

function renderUpgradeChoices(choices) {
  ui.upgradeChoices.replaceChildren();
  stage4bLastChoices = choices.map((choice) => choice.id);

  for (const upgrade of choices) {
    const button = document.createElement('button');
    button.type = 'button';
    const rarity = upgrade.rarity || (upgrade.id.includes('-') ? '武器' : '基础');
    button.className = `upgrade-choice rarity-${rarity}`;
    button.innerHTML = `
      <span class="upgrade-rarity">${rarity}</span>
      <span class="upgrade-icon">${upgrade.icon}</span>
      <span class="upgrade-name">${upgrade.name}</span>
      <span class="upgrade-description">${typeof upgrade.description === 'function' ? upgrade.description() : upgrade.description}</span>
    `;
    button.addEventListener('click', () => {
      upgrade.apply();
      ui.upgradePanel.classList.add('hidden');
      state = 'playing';
      previousTime = performance.now();
      playTone(760, 0.12, 0.045);
      updateHud();
    }, { once: true });
    ui.upgradeChoices.append(button);
  }
}

showUpgradeChoices = function showStage4bUpgradeChoices() {
  if (state !== 'playing') return;
  state = 'upgrading';
  cameraShake = 0;
  resetJoystick();
  stage4bRerollUsed = false;
  ui.rerollButton.disabled = false;
  ui.rerollCount.textContent = '1/1';
  renderUpgradeChoices(buildUpgradeChoices());
  ui.upgradePanel.classList.remove('hidden');
  playTone(940, 0.12, 0.045);
};

function rerollUpgradeChoices() {
  if (state !== 'upgrading' || stage4bRerollUsed) return;
  stage4bRerollUsed = true;
  ui.rerollButton.disabled = true;
  ui.rerollCount.textContent = '0/1';
  renderUpgradeChoices(buildUpgradeChoices(new Set(stage4bLastChoices)));
  playTone(610, 0.08, 0.035, 'triangle');
}

ui.rerollButton.addEventListener('click', rerollUpgradeChoices);
