// Phase 4D: current build view, persistent skill codex and combo notifications.
ui.buildButton = document.querySelector('#buildButton');
ui.codexButton = document.querySelector('#codexButton');
ui.pauseCodexButton = document.querySelector('#pauseCodexButton');
ui.buildPanel = document.querySelector('#buildPanel');
ui.closeBuildButton = document.querySelector('#closeBuildButton');
ui.currentBuildList = document.querySelector('#currentBuildList');
ui.comboList = document.querySelector('#comboList');
ui.codexList = document.querySelector('#codexList');
ui.codexCount = document.querySelector('#codexCount');
ui.pauseBuildList = document.querySelector('#pauseBuildList');
ui.buildStats = document.querySelector('#buildStats');
ui.comboToast = document.querySelector('#comboToast');

const STAGE4D_SEEN_KEY = 'chickenRunSeenSkills4d';
let stage4dPanelReturnState = 'menu';
let stage4dToastTimer = 0;

const STAGE4D_COMBOS = {
  'chicken-prodigy': {
    icon: '🐥✨', name: '鸡中龙凤',
    description: '觉醒与邪修合流：重点培养的小鸡同时获得觉醒保护与额外战斗力。',
  },
  'watch-partners': {
    icon: '🐕🛡️', name: '守望相助',
    description: '布鲁斯负责控场，刀盾负责兜底；召唤更勤快，并立即补充一次盾反。',
  },
  'tech-leap': {
    icon: '🔫🏺', name: '技术跃迁',
    description: '枪械世界线接入鼎火体系：立即获得鼎火，并缩短枪械攻击间隔。',
  },
  'return-trained': {
    icon: '⛰️🥋', name: '学成归来',
    description: '历练归来的小鸡直接觉醒，真正把见过的世面带回鸡群。',
  },
};

function stage4dReadSeen() {
  try {
    return JSON.parse(window.localStorage.getItem(STAGE4D_SEEN_KEY) || '{}');
  } catch {
    return {};
  }
}

function stage4dWriteSeen(records) {
  try {
    window.localStorage.setItem(STAGE4D_SEEN_KEY, JSON.stringify(records));
  } catch {
    // The codex still works for the current page without storage.
  }
}

function stage4dDescription(upgrade) {
  try {
    return typeof upgrade.description === 'function' ? upgrade.description() : upgrade.description || '';
  } catch {
    return '';
  }
}

function stage4dRarity(upgrade) {
  if (upgrade.rarity) return upgrade.rarity;
  if (upgrade.id?.includes('sword') || upgrade.id?.includes('spear') || upgrade.id?.includes('hammer')) return '武器';
  return '基础';
}

function stage4dRememberSeen(upgrade) {
  if (!upgrade?.id) return;
  const records = stage4dReadSeen();
  records[upgrade.id] = {
    id: upgrade.id,
    icon: upgrade.icon || '✦',
    name: upgrade.name || upgrade.id,
    rarity: stage4dRarity(upgrade),
    description: stage4dDescription(upgrade),
  };
  stage4dWriteSeen(records);
}

function stage4dRecordAcquired(upgrade) {
  if (!player || !upgrade?.id) return;
  player.stage4dAcquired ||= Object.create(null);
  player.stage4dAcquiredMeta ||= Object.create(null);
  player.stage4dAcquired[upgrade.id] = (player.stage4dAcquired[upgrade.id] || 0) + 1;
  player.stage4dAcquiredMeta[upgrade.id] = {
    id: upgrade.id,
    icon: upgrade.icon || '✦',
    name: upgrade.name || upgrade.id,
    rarity: stage4dRarity(upgrade),
    description: stage4dDescription(upgrade),
  };
  stage4dRememberSeen(upgrade);
}

function stage4dAnnounceCombo(comboId) {
  const combo = STAGE4D_COMBOS[comboId];
  if (!combo || !ui.comboToast) return;
  window.clearTimeout(stage4dToastTimer);
  ui.comboToast.innerHTML = `<span>${combo.icon}</span><strong>组合解锁：${combo.name}</strong><small>${combo.description}</small>`;
  ui.comboToast.classList.remove('hidden');
  requestAnimationFrame(() => ui.comboToast.classList.add('show'));
  playStage4dSound('combo');
  stage4dToastTimer = window.setTimeout(() => {
    ui.comboToast.classList.remove('show');
    window.setTimeout(() => ui.comboToast.classList.add('hidden'), 220);
  }, 3100);
}

function stage4dUnlockCombo(comboId, applyEffect) {
  if (!player) return;
  player.stage4dCombos ||= Object.create(null);
  if (player.stage4dCombos[comboId]) return;
  player.stage4dCombos[comboId] = true;
  applyEffect?.();
  stage4dAnnounceCombo(comboId);
}

function stage4dDetectCombos() {
  if (!player?.skillLevels) return;
  if (skillLevel('chick-awaken') > 0 && skillLevel('rogue-cultivation') > 0) {
    stage4dUnlockCombo('chicken-prodigy', () => {
      const target = chicks.find((chick) => !chick.lost && chick.cultivated) || ensureCultivatedChick();
      if (target) {
        target.awakened = true;
        target.protectedFor = Math.max(target.protectedFor || 0, 2.5);
        target.cultivationPower = Math.max(1.35, (target.cultivationPower || 1) * 1.2);
      }
    });
  }
  if (skillLevel('brucie') > 0 && skillLevel('knife-shield') > 0) {
    stage4dUnlockCombo('watch-partners', () => {
      player.stage4dWatchPartners = true;
      player.brucieCooldown = Math.min(player.brucieCooldown, 4);
      player.knifeShieldCharges = Math.max(1, player.knifeShieldCharges || 0);
    });
  }
  if (skillLevel('break-cauldron') > 0 && skillLevel('end-cold-weapons') > 0) {
    stage4dUnlockCombo('tech-leap', () => {
      player.stage4dTechLeap = true;
      player.attackInterval = Math.max(0.2, player.attackInterval * 0.93);
      stage4cChargeCauldron(5);
    });
  }
  if (skillLevel('chicken-hill') > 0 && skillLevel('chick-awaken') > 0) {
    stage4dUnlockCombo('return-trained', () => {
      player.stage4dReturnTrained = true;
      player.scoutCooldown = Math.min(player.scoutCooldown, 6);
    });
  }
}

function stage4dSkillCard(record, count = 1) {
  const level = count > 1 ? `<b>×${count}</b>` : '';
  return `<article class="build-skill-card"><span class="build-skill-icon">${record.icon || '✦'}</span><div><strong>${record.name || record.id}${level}</strong><small>${record.rarity || '技能'} · ${record.description || '本局已获得'}</small></div></article>`;
}

function stage4dCurrentRecords() {
  if (!player) return [];
  const records = [];
  const counts = player.stage4dAcquired || {};
  const metadata = player.stage4dAcquiredMeta || {};
  for (const [id, count] of Object.entries(counts)) {
    records.push({ ...metadata[id], id, count });
  }
  return records.sort((a, b) => (a.rarity || '').localeCompare(b.rarity || '') || a.name.localeCompare(b.name));
}

function stage4dWeaponSummary() {
  if (!player) return '尚未开始本局';
  const weaponName = player.gunMode
    ? player.gunArchetype === 'revolver' ? '左轮' : player.gunArchetype === 'rifle' ? '步枪' : '霰弹枪'
    : WEAPONS[player.weapon].name;
  const routeNames = {
    'sword-ring': '无死角', 'sword-chase': '追光',
    'spear-sun': '贯日', 'spear-dragon': '游龙',
    'hammer-sky': '天崩', 'hammer-control': '镇场',
  };
  const route = player.overlimitRoute ? ` · 超限：${routeNames[player.overlimitRoute] || player.overlimitRoute}` : '';
  return `${WEAPONS[player.weapon].icon} ${weaponName}${route} · Lv.${player.level}`;
}

function stage4dRenderPauseSummary() {
  if (!ui.pauseBuildList) return;
  const records = stage4dCurrentRecords().slice(0, 5);
  ui.pauseBuildList.innerHTML = player
    ? `<strong class="pause-weapon-line">${stage4dWeaponSummary()}</strong>${records.length ? records.map((item) => stage4dSkillCard(item, item.count)).join('') : '<p class="empty-build">本局尚未获得技能。</p>'}`
    : '<p class="empty-build">本局尚未开始。</p>';
}

function stage4dRenderBuildPanel() {
  if (ui.buildStats) ui.buildStats.textContent = stage4dWeaponSummary();
  const current = stage4dCurrentRecords();
  ui.currentBuildList.innerHTML = current.length
    ? current.map((item) => stage4dSkillCard(item, item.count)).join('')
    : '<p class="empty-build">本局尚未获得技能；升级后会在这里形成你的构筑。</p>';

  const activeCombos = player?.stage4dCombos || {};
  const comboIds = Object.keys(activeCombos).filter((id) => activeCombos[id]);
  ui.comboList.innerHTML = comboIds.length
    ? comboIds.map((id) => stage4dSkillCard({ ...STAGE4D_COMBOS[id], rarity: '组合' })).join('')
    : '<p class="empty-build">组合尚未触发。机制技能之间存在隐藏联动。</p>';

  const seen = Object.values(stage4dReadSeen());
  ui.codexCount.textContent = String(seen.length);
  ui.codexList.innerHTML = seen.length
    ? seen.sort((a, b) => a.rarity.localeCompare(b.rarity) || a.name.localeCompare(b.name)).map((record) => stage4dSkillCard(record)).join('')
    : '<p class="empty-build">升级界面见过的技能会自动记录在这里。</p>';
}

function stage4dOpenBuildPanel(source = 'menu') {
  stage4dPanelReturnState = source;
  if (source === 'playing') {
    pauseGame();
    ui.pausePanel.classList.add('hidden');
  } else if (source === 'paused') {
    ui.pausePanel.classList.add('hidden');
  } else {
    ui.startPanel.classList.add('hidden');
  }
  stage4dRenderBuildPanel();
  ui.buildPanel.classList.remove('hidden');
  playStage4dSound('panel');
}

function stage4dCloseBuildPanel() {
  ui.buildPanel.classList.add('hidden');
  if (stage4dPanelReturnState === 'playing') {
    state = 'playing';
    previousTime = performance.now();
  } else if (stage4dPanelReturnState === 'paused') {
    state = 'paused';
    stage4dRenderPauseSummary();
    ui.pausePanel.classList.remove('hidden');
  } else {
    state = 'menu';
    ui.startPanel.classList.remove('hidden');
  }
  playStage4dSound('panel');
}

const stage4dResetBase = resetGame;
resetGame = function resetStage4dBuildState() {
  stage4dResetBase();
  player.stage4dAcquired = Object.create(null);
  player.stage4dAcquiredMeta = Object.create(null);
  player.stage4dCombos = Object.create(null);
};

const stage4dRenderUpgradeBase = renderUpgradeChoices;
renderUpgradeChoices = function renderStage4dUpgradeChoices(choices) {
  const wrapped = choices.map((upgrade) => {
    stage4dRememberSeen(upgrade);
    const originalApply = upgrade.apply;
    return {
      ...upgrade,
      apply: () => {
        originalApply();
        stage4dRecordAcquired(upgrade);
        stage4dDetectCombos();
        stage4dRenderPauseSummary();
        playStage4dSound('upgrade');
      },
    };
  });
  stage4dRenderUpgradeBase(wrapped);
};

const stage4dPauseBase = pauseGame;
pauseGame = function pauseStage4dGame() {
  stage4dPauseBase();
  if (state === 'paused') stage4dRenderPauseSummary();
};

const stage4dBrucieBase = updateBrucie;
updateBrucie = function updateStage4dBrucie(deltaTime) {
  stage4dBrucieBase(deltaTime);
  if (player?.stage4dWatchPartners) player.brucieCooldown = Math.min(player.brucieCooldown, 8);
};

const stage4dExpeditionBase = updateExpeditions;
updateExpeditions = function updateStage4dExpeditions(deltaTime) {
  const scoutingBefore = new Set(chicks.filter((chick) => chick.scouting));
  stage4dExpeditionBase(deltaTime);
  if (!player?.stage4dReturnTrained) return;
  for (const chick of scoutingBefore) {
    if (!chick.scouting && !chick.lost) {
      chick.awakened = true;
      chick.guardCooldown = Math.min(chick.guardCooldown || 0.3, 0.3);
      chick.protectedFor = Math.max(chick.protectedFor || 0, 1.8);
      addParticles(chick.x, chick.y, '🥋', 4);
    }
  }
  player.scoutCooldown = Math.min(player.scoutCooldown, 20);
};

ui.buildButton.addEventListener('click', () => stage4dOpenBuildPanel(state === 'playing' ? 'playing' : 'paused'));
ui.codexButton.addEventListener('click', () => stage4dOpenBuildPanel('menu'));
ui.pauseCodexButton.addEventListener('click', () => stage4dOpenBuildPanel('paused'));
ui.closeBuildButton.addEventListener('click', stage4dCloseBuildPanel);
ui.pauseButton.addEventListener('click', () => window.setTimeout(stage4dRenderPauseSummary, 0));
window.addEventListener('keydown', (event) => {
  if ((event.key === 'Escape' || event.key === ' ') && state === 'paused') {
    window.setTimeout(stage4dRenderPauseSummary, 0);
  }
});

stage4dRenderBuildPanel();
