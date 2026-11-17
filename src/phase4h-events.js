// Phase 4H: optional map events. Load after Phase 4G.
// Events use game-time only; no native timers and no added combat progression rules.
const PHASE4H_TYPES = Object.freeze([
  { id: 'lost', name: '迷路的小鸡', icon: '🐥', duration: 35 },
  { id: 'supply', name: '牧场补给车', icon: '🛒', duration: 40 },
  { id: 'thief', name: '狐狸盗宝贼', icon: '🎒', duration: 35 },
  { id: 'shelter', name: '临时避难所', icon: '🏡', duration: 38 },
  { id: 'chest', name: '神秘宝箱', icon: '🎁', duration: 35 },
]);
let phase4h = null;
function phase4hReset() {
  phase4h = {
    nextAt: 45, event: null, serial: 0, bag: [], nextChickId: 10,
    notice: '', noticeFor: 0, lastHud: '', state: 'idle', stats: { success: 0, expired: 0 },
  };
}
phase4hReset();

function phase4hBossActive() {
  return typeof phase4gAlive === 'function' && phase4gAlive(phase4g?.boss);
}
function phase4hActive() {
  return Boolean(phase4h?.event && phase4h.event.status === 'active');
}
function phase4hNextType() {
  if (!phase4h.bag.length) {
    phase4h.bag = [...PHASE4H_TYPES];
    // Shuffle without replacement: each set of five contains all event types.
    for (let i = phase4h.bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [phase4h.bag[i], phase4h.bag[j]] = [phase4h.bag[j], phase4h.bag[i]];
    }
  }
  const critical = typeof phase4fSafety === 'function' && phase4fSafety().inDanger;
  const hard = typeof phase4f !== 'undefined' && phase4f?.phase === 'hard';
  let index = -1;
  // The first 4I event is a guaranteed rescue, so the initial chick can
  // grow a flock before the wider random event rotation begins.
  if (phase4h.serial === 0) index = phase4h.bag.findIndex(item => item.id === 'lost');
  else if (critical) index = phase4h.bag.findIndex(item => item.id === 'supply');
  else if (phase4hAliveChicks() < 3) index = phase4h.bag.findIndex(item => item.id === 'lost');
  else if (hard) {
    const safer = phase4h.bag.map((item,i) =>
      ['supply','shelter','lost'].includes(item.id) ? i : -1).filter(i => i>=0);
    if (safer.length) index = safer[Math.floor(Math.random()*safer.length)];
  }
  if (index < 0) index = phase4h.bag.length - 1;
  return phase4h.bag.splice(index,1)[0];
}
function phase4hLocation() {
  // Clamp to the world while remaining reachable from the player in ~2 seconds.
  const angle = Math.random() * Math.PI * 2;
  const distance = 260 + Math.random() * 100;
  return {
    x: clamp(player.x + Math.cos(angle) * distance, 55, world.width - 55),
    y: clamp(player.y + Math.sin(angle) * distance, 55, world.height - 55),
  };
}
function phase4hNotify(message, seconds = 2.7) {
  phase4h.notice = message;
  phase4h.noticeFor = seconds;
  if (phase4hMessage) {
    phase4hMessage.textContent = message;
    phase4hMessage.classList.remove('hidden');
  }
}
function phase4hSpawn() {
  if (!player || phase4hBossActive() || phase4hActive()) return;
  const type = phase4hNextType();
  phase4h.serial += 1;
  const pos = phase4hLocation();
  const event = { ...type, ...pos, remaining: type.duration, status: 'active',
    option: null, progress: 0, goal: 0, guards: [], target: null, touched: false };
  phase4h.event = event;
  phase4h.state = 'active';
  if (type.id === 'supply') {
    event.goal = 2;
    // Do not spawn beyond platform fox limit; the area also counts live enemies.
    event.goal = Math.min(event.goal, Math.max(0, currentFoxLimit() - foxes.length));
    for (let i = 0; i < event.goal; i++) {
      const old = foxes.length;
      phase4g.suppressElite = true;
      let made;
      try { made = spawnFox(i ? 'swift' : 'normal'); }
      finally { phase4g.suppressElite = false; }
      if (!made || foxes.length === old) break;
      const fox = foxes[foxes.length - 1];
      const clear = phase4jFindObjective(event.x + Math.cos(i * Math.PI) * 65,
        event.y + Math.sin(i * Math.PI) * 65, fox.radius || 18);
      fox.x = clear.x; fox.y = clear.y;
      fox.phase4hGuard = true;
      event.guards.push(fox);
    }
  } else if (type.id === 'thief') {
    if (foxes.length >= currentFoxLimit()) {
      phase4h.event = null;
      phase4h.serial -= 1;
      phase4h.bag.push(type);
      phase4h.nextAt = elapsed + 8; // Retry the same type without sacrificing enemies.
      return;
    }
    const old = foxes.length;
    phase4g.suppressElite = true;
    let made;
    try { made = spawnFox('swift'); }
    finally { phase4g.suppressElite = false; }
    if (!made || foxes.length === old) {
      phase4h.event = null;
      phase4h.serial -= 1;
      phase4h.nextAt = elapsed + 8;
      return;
    }
    const fox = foxes[foxes.length - 1];
    fox.x = event.x; fox.y = event.y;
    fox.health *= 1.45; fox.maxHealth = fox.health;
    fox.xp *= 1.4;
    fox.phase4hThief = true;
    fox.phase4hThiefEscape = 0;
    // Thief is not an elite; existing skill damage / kill accounting still works.
    event.target = fox;
  }
  phase4hNotify(type.icon + ' ' + type.name + '出现了！前往地图标记', 3.2);
}
function phase4hDistance(event) {
  return Math.hypot(player.x - event.x, player.y - event.y);
}
function phase4hAliveChicks() {
  return chicks.filter(chick => !chick.lost).length;
}
function phase4hCreateChick() {
  const a = Math.random() * Math.PI * 2;
  return {
    id: phase4h.nextChickId++, x: player.x + Math.cos(a) * 28,
    y: player.y + Math.sin(a) * 28, radius: 10, phase: Math.random() * Math.PI * 2,
    wanderAngle: a, carriedBy: null, lost: false, protectedFor: 0,
  };
}
function phase4hReward(event, choice = '') {
  if (!event || event.status !== 'active') return;
  let detail = '';
  if (event.id === 'lost') {
    if (phase4hAliveChicks() < CONFIG.chickCount) {
      chicks.push(phase4hCreateChick());
      detail = '一只小鸡加入队伍';
    } else {
      gainExperience(4 + Math.floor(dangerLevel / 2));
      detail = '鸡群已满，获得额外经验';
    }
  } else if (event.id === 'supply') {
    const missing = player.maxHealth - player.health;
    if (missing >= 18) {
      const healed = Math.min(missing, 32);
      player.health += healed;
      detail = '恢复 ' + Math.round(healed) + ' 点生命';
    } else {
      gainExperience(7 + dangerLevel);
      detail = '获得补给经验';
    }
  } else if (event.id === 'thief') {
    gainExperience(9 + dangerLevel);
    detail = '追回宝物，获得大量经验';
  } else if (event.id === 'shelter') {
    gainExperience(5 + Math.floor(dangerLevel / 2));
    detail = '安全驻守成功，获得经验';
  } else if (event.id === 'chest') {
    if (choice === 'risk') {
      gainExperience(12 + dangerLevel);
      detail = '挑战成功，获得丰厚经验';
    } else {
      player.health = Math.min(player.maxHealth, player.health + 18);
      gainExperience(3 + Math.floor(dangerLevel / 2));
      detail = '获得少量经验与补给';
    }
  }
  // mark before calling gainExperience above would be safer against upgrade pause;
  // no event callbacks depend on running during the synchronous level-up selection.
  event.status = 'completed';
  phase4h.event = null;
  phase4h.stats.success += 1;
  phase4h.nextAt = elapsed + 60 + Math.random() * 20;
  phase4hNotify('完成：' + event.name + ' · ' + detail, 3);
}
function phase4hExpire(reason = '') {
  if (!phase4hActive()) return;
  const event = phase4h.event;
  event.status = 'expired';
  if (event.id === 'thief' && event.target && !event.target.dead) {
    // Expired thief vanishes without granting a kill, XP or cauldron energy.
    event.target.dead = true;
    event.target.health = 0;
  }
  phase4h.event = null;
  phase4h.stats.expired += 1;
  phase4h.nextAt = elapsed + 60 + Math.random() * 20;
  phase4hNotify(event.name + '已结束' + (reason ? ' · ' + reason : ''), 2.5);
}
function phase4hUpdate(dt) {
  if (!player || state !== 'playing') return;
  const bossActive = phase4hBossActive();
  if (phase4h.noticeFor > 0) {
    phase4h.noticeFor -= dt;
    if (phase4h.noticeFor <= 0) phase4hMessage.classList.add('hidden');
  }
  if (bossActive) {
    // Freeze both current event expiration and future event scheduler.
    phase4h.nextAt += dt;
    return;
  }
  if (!phase4hActive()) {
    if (elapsed >= phase4h.nextAt) phase4hSpawn();
    return;
  }
  const e = phase4h.event;
  e.remaining -= dt;
  if (e.remaining <= 0) {
    phase4hExpire('超时');
    return;
  }
  const near = phase4hDistance(e);
  if (e.id === 'lost' && near <= 43) {
    phase4hReward(e);
  } else if (e.id === 'supply' && near <= 68) {
    // Protect supply against all foxes, not only the two spawned guards.
    let enemies = 0;
    for (const fox of foxes) {
      if (fox.dead || fox.health <= 0) continue;
      if ((fox.x-e.x)**2 + (fox.y-e.y)**2 <= 125**2) enemies++;
    }
    // Guards must actually be defeated; leading them away is not enough.
    if (enemies === 0 && e.guards.every(fox => fox.dead || fox.health <= 0)) phase4hReward(e);
  } else if (e.id === 'shelter') {
    // Temporary safe zone, but only while the chicks actually occupy it.
    let sheltered = 0;
    for (const chick of chicks) {
      if (chick.lost || chick.carriedBy) continue;
      if ((chick.x-e.x)**2 + (chick.y-e.y)**2 > 105**2) continue;
      chick.protectedFor = Math.max(chick.protectedFor || 0, 0.42);
      sheltered++;
    }
    if (near <= 105 && sheltered > 0) {
      e.progress += dt;
      if (e.progress >= 6) phase4hReward(e);
    } else {
      e.progress = Math.max(0, e.progress - dt * 0.4);
    }
  } else if (e.id === 'chest' && near <= 55 && e.option === null) {
    phase4hChoices.classList.remove('hidden');
  } else if (e.id === 'chest' && e.option === 'risk') {
    // Survive 10 seconds near the chest; this is a positional challenge, not invulnerability.
    if (near <= 135) e.progress += dt;
    else e.progress = Math.max(0, e.progress - dt * 0.5);
    if (e.progress >= 10) phase4hReward(e, 'risk');
  }
  if (!phase4hActive() || phase4h.event?.id !== 'chest' || phase4h.event.option !== null || near > 75) {
    phase4hChoices.classList.add('hidden');
  }
}
// An optional event is allowed to finish before the next scheduled boss.
// Postponement avoids forcing a boss on top of an unfinished escort objective.
const phase4hBossSpawnBase = phase4gSpawnBoss;
phase4gSpawnBoss = function spawnPhase4hDeferredBoss() {
  if (phase4hActive()) {
    phase4g.nextBossAt = elapsed + Math.min(12, Math.max(3, phase4h.event.remaining + 2));
    return;
  }
  return phase4hBossSpawnBase();
};
const phase4hDefeatBase = defeatFox;
defeatFox = function defeatPhase4hFox(fox) {
  const event = phase4h?.event;
  const thiefKilled = event?.id === 'thief' && event.target === fox && !fox.dead;
  phase4hDefeatBase(fox);
  if (thiefKilled && fox.dead && event?.status === 'active') phase4hReward(event);
};
// Thief does not seek or attack chickens; it tries to escape the level.
const phase4hFoxesBase = updateFoxes;
updateFoxes = function updatePhase4hFoxes(dt) {
  const thief = phase4h?.event?.id === 'thief' ? phase4h.event.target : null;
  let previousStun = 0;
  if (thief && !thief.dead) {
    previousStun = thief.stunnedFor || 0;
    thief.stunnedFor = Math.max(previousStun, dt + 0.07);
  }
  phase4hFoxesBase(dt);
  if (thief && !thief.dead && phase4h?.event?.target === thief) {
    thief.stunnedFor = Math.max(0, previousStun - dt);
    if (thief.stunnedFor <= 0) {
      const edge = nearestWorldEdgeVector(thief.x, thief.y);
      const speed = 115 * dt;
      const route = phase4jSteer(thief, thief.x + edge.x * 170, thief.y + edge.y * 170);
      phase4jMoveEntity(thief, thief.x + route.x * speed, thief.y + route.y * speed, thief.radius || 12);
    }
    if (thief.x <= 9 || thief.x >= world.width - 9 || thief.y <= 9 || thief.y >= world.height - 9) {
      phase4hExpire('狐狸带着宝物逃跑了');
    }
  }
  foxes = foxes.filter(fox => !fox.dead && fox.health > 0);
};
const phase4hUpdateBase = update;
update = function updatePhase4hGame(dt) {
  phase4hUpdateBase(dt);
  if (state === 'playing') phase4hUpdate(dt);
};
const phase4hResetBase = resetGame;
resetGame = function resetPhase4hGame() {
  phase4hReset();
  phase4hChoices.classList.add('hidden');
  phase4hMessage.classList.add('hidden');
  phase4hResetBase();
};
// HUD / touch interaction: the chest is the only event with two explicit choices.
const phase4hHud = document.createElement('div');
phase4hHud.className = 'phase4h-hud hidden';
phase4hHud.setAttribute('aria-live', 'polite');
document.querySelector('#app')?.append(phase4hHud);
const phase4hMessage = document.createElement('div');
phase4hMessage.className = 'phase4h-message hidden';
phase4hMessage.setAttribute('aria-live', 'polite');
document.querySelector('#app')?.append(phase4hMessage);
const phase4hChoices = document.createElement('div');
phase4hChoices.className = 'phase4h-choices hidden';
phase4hChoices.innerHTML = '<span>神秘宝箱</span><button type="button" data-choice="safe">领取补给</button><button type="button" data-choice="risk">挑战10秒</button>';
document.querySelector('#app')?.append(phase4hChoices);
phase4hChoices.addEventListener('click', ev => {
  const button = ev.target.closest('[data-choice]');
  const e = phase4h?.event;
  if (!button || state !== 'playing' || e?.id !== 'chest' || e.option !== null || phase4hDistance(e) > 75) return;
  e.option = button.dataset.choice;
  phase4hChoices.classList.add('hidden');
  if (e.option === 'safe') phase4hReward(e, 'safe');
  else {
    // A risk selection produces a real, bounded challenge, not free idle XP.
    phase4hSpawnChestGuards(e);
    phase4hNotify('宝箱挑战：迎击狐狸并在附近坚持10秒', 2.5);
  }
});
function phase4hSpawnChestGuards(event) {
  if (!event || event.id !== 'chest') return;
  const spare = Math.max(0, currentFoxLimit() - foxes.length);
  const count = Math.min(2, spare);
  phase4g.suppressElite = true;
  try {
    for (let i = 0; i < count; i++) {
      const before = foxes.length;
      if (!spawnFox(i === 0 ? 'swift' : 'brute') || foxes.length <= before) break;
      const fox = foxes[foxes.length - 1];
      const a = i * Math.PI + Math.PI / 4;
      const clear = phase4jFindObjective(event.x + Math.cos(a) * 100,
        event.y + Math.sin(a) * 100, fox.radius || 18);
      fox.x = clear.x; fox.y = clear.y;
    }
  } finally { phase4g.suppressElite = false; }
}
const phase4hHudBase = updateHud;
updateHud = function updatePhase4hHud(force = false) {
  phase4hHudBase(force);
  if (!player || !phase4h) return;
  const e = phase4h.event;
  const active = phase4hActive() && state === 'playing';
  phase4hHud.classList.toggle('hidden', !active);
  phase4hChoices.classList.toggle('hidden', !(active && e.id === 'chest' && e.option === null && phase4hDistance(e) <= 55));
  if (!active) return;
  const direction = Math.atan2(e.y - player.y, e.x - player.x);
  const compass = ['→','↘','↓','↙','←','↖','↑','↗'];
  const arrow = compass[(Math.round(direction / (Math.PI/4)) + 8) % 8];
  const distance = Math.round(phase4hDistance(e));
  const extra = e.id === 'shelter' ? ' · 驻守 ' + Math.floor(e.progress) + '/6秒' :
    e.id === 'chest' && e.option === 'risk' ? ' · 挑战 ' + Math.floor(e.progress) + '/10秒' : '';
  const next = e.icon + ' ' + e.name + ' ' + arrow + ' ' + distance + '步 · ' + Math.ceil(e.remaining) + '秒' + extra;
  if (next !== phase4h.lastHud) {
    phase4hHud.textContent = next;
    phase4h.lastHud = next;
  }
};
// Draw map markers in world coordinates; existing HUD indicates offscreen direction.
const phase4hDrawWorldBase = drawWorld;
drawWorld = function drawPhase4hWorld() {
  phase4hDrawWorldBase();
  const e = phase4h?.event;
  if (!e || e.status !== 'active') return;
  const pulse = 1 + Math.sin(elapsed * 4) * 0.06;
  context.save();
  context.translate(e.x,e.y);
  context.scale(pulse,pulse);
  context.fillStyle = 'rgba(238,225,180,.19)';
  context.strokeStyle = '#a7a17b';
  context.lineWidth = 3;
  context.beginPath(); context.arc(0,0,e.id === 'shelter' ? 105 : 40,0,Math.PI*2); context.fill();context.stroke();
  context.fillStyle = 'rgba(250,245,231,.96)';
  context.beginPath(); context.arc(0,-25,27,0,Math.PI*2); context.fill();
  context.font = '29px sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle';
  context.fillText(e.icon,0,-25);
  context.font = 'bold 13px sans-serif'; context.fillStyle = '#746451';
  context.fillText(e.name,0,-66);
  context.restore();
};
