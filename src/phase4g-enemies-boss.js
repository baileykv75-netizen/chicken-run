// Phase 4G: elite foxes and Redtail King. Loaded after the 4F director.
// Isolated additions: ordinary fox combat and existing XP/cauldron stay authoritative.
const PHASE4G = Object.freeze({
  bossInterval: 180,
  elites: {
    stalker: { name: '潜行狐狸', hp: 2.0, speed: 1.10, xp: 2.5 },
    charger: { name: '冲锋狐狸', hp: 2.4, speed: 0.96, xp: 3 },
    caller:  { name: '号令狐狸', hp: 2.15, speed: 0.88, xp: 3.5 },
  },
});
let phase4g = null;
function phase4gReset() {
  phase4g = { nextBossAt: PHASE4G.bossInterval, bossNumber: 0,
    nextEliteAt: 42, boss: null, summons: 0, suppressElite: false, noticeFor: 0 };
}
phase4gReset();

function phase4gAlive(fox) { return fox && !fox.dead && fox.health > 0; }
function phase4gChickTarget(fox) {
  return nearestAvailableChick(fox) || player;
}
function phase4gMakeElite(fox, kind) {
  const data = PHASE4G.elites[kind];
  fox.phase4gKind = kind;
  fox.phase4gMode = 'pursue';
  fox.phase4gClock = 0;
  fox.phase4gCooldown = kind === 'stalker' ? 3.4 : kind === 'charger' ? 3 : 5;
  fox.phase4gTelegraph = null;
  fox.phase4gFacing = { x: 1, y: 0 };
  fox.speed *= data.speed;
  fox.health *= data.hp;
  fox.maxHealth = fox.health;
  fox.xp *= data.xp;
  fox.radius = kind === 'charger' ? 20 : 17;
  fox.phase4gBaseSpeed = fox.speed;
  return fox;
}

const phase4gSpawnBase = spawnFox;
spawnFox = function spawnPhase4gFox(forcedType = null) {
  const count = foxes.length;
  const result = phase4gSpawnBase(forcedType);
  if (!result || foxes.length <= count || !phase4g) return result;
  const fox = foxes[foxes.length - 1];
  if (phase4g.suppressElite || elapsed < phase4g.nextEliteAt || foxes.length >= currentFoxLimit()) return result;
  const bossActive = phase4gAlive(phase4g.boss);
  const phaseName = typeof phase4f !== 'undefined' && phase4f ? phase4f.phase : 'threat';
  const danger = typeof phase4fSafety === 'function' && phase4fSafety().inDanger;
  const chance = danger ? 0.012 : bossActive ? 0.025 :
    phaseName === 'hard' ? 0.20 : phaseName === 'threat' ? 0.10 : 0.035;
  if (Math.random() < chance) {
    const pool = ['stalker','charger','caller'];
    phase4gMakeElite(fox, pool[Math.floor(Math.random() * pool.length)]);
    phase4g.nextEliteAt = elapsed + (phaseName === 'hard' ? 8 : 12);
  }
  return result;
};

function phase4gSpawnMinions(count, center) {
  if (!phase4g) return;
  phase4g.suppressElite = true;
  try {
    for (let i = 0; i < count && foxes.length < currentFoxLimit(); i++) {
      if (!spawnFox(i % 3 === 0 ? 'swift' : 'normal')) break;
      const fox = foxes[foxes.length - 1];
      const angle = (i / Math.max(1, count)) * Math.PI * 2;
      const clear = phase4jFindObjective(center.x + Math.cos(angle) * 105,
        center.y + Math.sin(angle) * 105, fox.radius || 20);
      fox.x = clear.x; fox.y = clear.y;
    }
  } finally { phase4g.suppressElite = false; }
}
function phase4gSpawnBoss() {
  if (phase4gAlive(phase4g.boss)) return;
  if (foxes.length >= currentFoxLimit()) {
    phase4g.nextBossAt = elapsed + 5;
    return;
  }
  phase4g.suppressElite = true;
  const before = foxes.length;
  try { spawnFox('brute'); } finally { phase4g.suppressElite = false; }
  if (foxes.length <= before) return;
  const fox = foxes[foxes.length - 1];
  phase4g.bossNumber += 1;
  fox.phase4gKind = 'boss';
  fox.phase4gMode = 'approach';
  fox.phase4gClock = 0;
  fox.phase4gCooldown = 2.2;
  fox.phase4gFacing = { x: 1, y: 0 };
  fox.radius = 35;
  const clearBoss = phase4jFindObjective(fox.x, fox.y, fox.radius + 4);
  fox.x = clearBoss.x; fox.y = clearBoss.y;
  fox.speed = 92 + Math.min(24, phase4g.bossNumber * 4);
  fox.phase4gBaseSpeed = fox.speed;
  const hp = 720 + phase4g.bossNumber * 175 + dangerLevel * 22;
  fox.health = hp;
  fox.maxHealth = hp;
  fox.xp = 24;
  fox.phase4gBossReward = false;
  phase4g.boss = fox;
  phase4g.nextBossAt = elapsed + PHASE4G.bossInterval;
  waveRemaining = Math.min(waveRemaining, 5);
  spawnTimer = Math.max(spawnTimer, 2.2);
  phase4g.noticeFor = 3.2;
  ui.waveNotice.textContent = '赤尾狐王来了！注意攻击预警';
  ui.waveNotice.classList.remove('hidden');
  playTone(160, 0.26, 0.07, 'sawtooth');
}

function phase4gDamagePlayer(amount, fox) {
  if (player.invulnerableFor > 0 || state !== 'playing') return;
  // A solid obstacle also blocks close-range boss and elite hits.
  if (!phase4jLineClear(fox.x, fox.y, player.x, player.y, 3)) return;
  const reduction = player.damageReductionFor > 0 ? 0.4 : 1;
  const damage = Math.max(2, amount * (1 - player.armor) * reduction);
  player.health -= damage;
  player.invulnerableFor = 0.72;
  cameraShake = Math.max(cameraShake, 6);
  const direction = normalized(player.x - fox.x, player.y - fox.y);
  phase4jMoveEntity(player, player.x + direction.x * 24,
    player.y + direction.y * 24, player.radius || 18);
  if (player.health <= 0) finishGame();
}
function phase4gGrabChick(fox) {
  if (fox.carrying || fox.phase4gKind === 'boss') return;
  const chick = phase4gChickTarget(fox);
  if (chick === player || chick.protectedFor > 0 || chick.carriedBy || chick.lost) return;
  if (!circlesOverlap(fox, chick, 3)) return;
  fox.carrying = chick;
  chick.carriedBy = fox;
  fox.target = null;
  addParticles(fox.x, fox.y, '!', 2);
}
function phase4gMove(fox, x, y, seconds, speedScale = 1) {
  const dir = phase4jSteer(fox, x, y);
  fox.phase4gFacing = dir;
  const distance = Math.hypot(x - fox.x, y - fox.y);
  const move = Math.min(distance, fox.speed * speedScale * seconds);
  phase4jMoveEntity(fox, fox.x + dir.x * move, fox.y + dir.y * move, fox.radius || 14);
}
function phase4gDashHit(fox, damage, knockChicks = false) {
  if ((player.x - fox.x) ** 2 + (player.y - fox.y) ** 2 < (fox.radius + player.radius + 7) ** 2) {
    phase4gDamagePlayer(damage, fox);
  }
  if (knockChicks) {
    for (const chick of chicks) {
      if (chick.lost || chick.carriedBy || chick.protectedFor > 0) continue;
      if ((chick.x - fox.x) ** 2 + (chick.y - fox.y) ** 2 > (fox.radius + chick.radius + 8) ** 2) continue;
      const direction = normalized(chick.x - fox.x, chick.y - fox.y);
      phase4jMoveEntity(chick, chick.x + direction.x * 55,
        chick.y + direction.y * 55, chick.radius || 10);
      chick.protectedFor = 0.45;
    }
  }
}
function phase4gUpdateElite(fox, dt) {
  fox.hitFlash = Math.max(0, fox.hitFlash - dt);
  const oldStun = fox.stunnedFor || 0;
  fox.stunnedFor = Math.max(0, oldStun - dt);
  if (fox.stunnedFor > 0) return;
  if (fox.carrying) {
    phase4jUpdateCarryingFox(fox, dt, 1.08);
    return;
  }
  fox.phase4gCooldown -= dt;
  fox.phase4gClock += dt;
  const target = phase4gChickTarget(fox);
  if (fox.phase4gKind === 'stalker') {
    if (fox.phase4gMode === 'pursue' && fox.phase4gCooldown <= 0) {
      fox.phase4gMode = 'sneak'; fox.phase4gClock = 0;
    }
    if (fox.phase4gMode === 'sneak') {
      phase4gMove(fox, target.x, target.y, dt, 1.25);
      if (fox.phase4gClock >= 2 || Math.hypot(target.x-fox.x,target.y-fox.y) < 75) {
        fox.phase4gMode = 'reveal'; fox.phase4gClock = 0;
      }
    } else if (fox.phase4gMode === 'reveal') {
      // Visible tell before the sudden approach.
      if (fox.phase4gClock >= 0.55) {
        fox.phase4gMode = 'pursue'; fox.phase4gClock = 0; fox.phase4gCooldown = 5;
        phase4gMove(fox, target.x, target.y, dt, 1.6);
      }
    } else phase4gMove(fox, target.x, target.y, dt);
  } else if (fox.phase4gKind === 'charger') {
    if (fox.phase4gMode === 'pursue' && fox.phase4gCooldown <= 0) {
      fox.phase4gMode = 'windup'; fox.phase4gClock = 0;
      fox.phase4gFacing = normalized(target.x - fox.x, target.y - fox.y);
      fox.phase4gChargeStart = { x: fox.x, y: fox.y };
    }
    if (fox.phase4gMode === 'windup' && fox.phase4gClock >= 0.9) {
      fox.phase4gMode = 'dash'; fox.phase4gClock = 0;
    }
    if (fox.phase4gMode === 'dash') {
      const step = fox.speed * 3.1 * dt;
      const targetX = fox.x + fox.phase4gFacing.x * step;
      const targetY = fox.y + fox.phase4gFacing.y * step;
      const moved = phase4jLineClear(fox.x, fox.y, targetX, targetY, fox.radius || 15)
        && phase4jMoveEntity(fox, targetX, targetY, fox.radius || 15);
      if (!moved) { fox.phase4gMode = 'recover'; fox.phase4gClock = 0; }
      else phase4gDashHit(fox, 13, true);
      if (fox.phase4gClock >= 0.44) {
        fox.phase4gMode = 'recover'; fox.phase4gClock = 0;
      }
    } else if (fox.phase4gMode === 'recover') {
      if (fox.phase4gClock >= 0.55) {
        fox.phase4gMode = 'pursue'; fox.phase4gCooldown = 4.2;
      }
    } else if (fox.phase4gMode === 'pursue') phase4gMove(fox, target.x, target.y, dt);
  } else if (fox.phase4gKind === 'caller') {
    if (fox.phase4gCooldown <= 0) {
      fox.phase4gCooldown = 9;
      for (const nearby of foxes) {
        if (nearby === fox || !phase4gAlive(nearby) || nearby.phase4gKind === 'boss') continue;
        if ((nearby.x-fox.x)**2 + (nearby.y-fox.y)**2 < 200**2) {
          nearby.phase4gHasteFor = Math.max(nearby.phase4gHasteFor || 0, 3.3);
        }
      }
      phase4gSpawnMinions(2, fox);
      addParticles(fox.x, fox.y, '♪', 4);
      playTone(520, 0.11, 0.035, 'triangle');
    }
    phase4gMove(fox, target.x, target.y, dt, 0.85);
  }
  if (fox.phase4gMode !== 'windup' && fox.phase4gMode !== 'recover') {
    phase4gGrabChick(fox);
    phase4gDashHit(fox, 12);
  }
}

function phase4gUpdateBoss(fox, dt) {
  fox.hitFlash = Math.max(0, fox.hitFlash - dt);
  fox.stunnedFor = Math.max(0, (fox.stunnedFor || 0) - dt * 1.6);
  fox.phase4gClock += dt;
  fox.phase4gCooldown -= dt;
  const enraged = fox.health <= fox.maxHealth * 0.5;
  if (fox.stunnedFor > 0) return;
  if (fox.phase4gMode === 'approach') {
    phase4gMove(fox, player.x, player.y, dt, 0.75);
    if (fox.phase4gCooldown <= 0) {
      const dist = Math.hypot(player.x - fox.x, player.y - fox.y);
      fox.phase4gMode = dist < 125 ? 'swipeTell' : 'chargeTell';
      fox.phase4gFacing = normalized(player.x - fox.x, player.y - fox.y);
      fox.phase4gClock = 0;
    }
  } else if (fox.phase4gMode === 'swipeTell') {
    if (fox.phase4gClock >= (enraged ? 0.72 : 1.0)) {
      if (Math.hypot(player.x - fox.x, player.y - fox.y) < 116) {
        phase4gDamagePlayer(enraged ? 24 : 19, fox);
      }
      addParticles(fox.x, fox.y, '✦', 5);
      fox.phase4gMode = 'recover'; fox.phase4gClock = 0;
    }
  } else if (fox.phase4gMode === 'chargeTell') {
    if (fox.phase4gClock >= (enraged ? 0.78 : 1.1)) {
      fox.phase4gMode = 'charge'; fox.phase4gClock = 0;
    }
  } else if (fox.phase4gMode === 'charge') {
    const step = fox.speed * (enraged ? 4.0 : 3.3) * dt;
    const targetX = fox.x + fox.phase4gFacing.x * step;
    const targetY = fox.y + fox.phase4gFacing.y * step;
    const moved = phase4jLineClear(fox.x, fox.y, targetX, targetY, fox.radius || 35)
      && phase4jMoveEntity(fox, targetX, targetY, fox.radius || 35);
    if (!moved) { fox.phase4gMode = 'recover'; fox.phase4gClock = 0; }
    else phase4gDashHit(fox, enraged ? 22 : 17, true);
    if (fox.phase4gClock >= 0.65) {
      fox.phase4gMode = 'recover'; fox.phase4gClock = 0;
    }
  } else if (fox.phase4gMode === 'recover') {
    if (fox.phase4gClock >= (enraged ? 0.65 : 1.0)) {
      fox.phase4gMode = 'approach'; fox.phase4gClock = 0;
      fox.phase4gCooldown = enraged ? 1.55 : 2.4;
      if (++phase4g.summons % 2 === 0 && !phase4fSafety().inDanger) {
        phase4gSpawnMinions(enraged ? 3 : 2, fox);
      }
    }
  }
}

// Leave the complete original fox logic in place for common foxes.
// Temporarily freeze only special enemy motion inside that routine, then apply their state machines.
const phase4gUpdateFoxesBase = updateFoxes;
updateFoxes = function updatePhase4gFoxes(dt) {
  const special = [];
  for (const fox of foxes) {
    if (!phase4gAlive(fox)) continue;
    if (fox.phase4gKind) {
      special.push([fox, fox.stunnedFor || 0]);
      fox.stunnedFor = Math.max(fox.stunnedFor || 0, dt + 0.01);
    } else if ((fox.phase4gHasteFor || 0) > 0) {
      fox.phase4gHasteFor = Math.max(0, fox.phase4gHasteFor - dt);
      fox.speed *= 1.22;
      fox.phase4gTemporarySpeed = true;
    }
  }
  try { phase4gUpdateFoxesBase(dt); }
  finally {
    for (const fox of foxes) {
      if (fox.phase4gTemporarySpeed) {
        fox.speed /= 1.22;
        fox.phase4gTemporarySpeed = false;
      }
    }
  }
  for (const [fox, realStun] of special) {
    if (!phase4gAlive(fox)) continue;
    fox.stunnedFor = realStun;
    if (fox.phase4gKind === 'boss') phase4gUpdateBoss(fox, dt);
    else phase4gUpdateElite(fox, dt);
  }
  foxes = foxes.filter(phase4gAlive);
};

// Record the kill after all existing progression/cauldron hooks complete.
const phase4gDefeatBase = defeatFox;
defeatFox = function defeatPhase4gFox(fox) {
  const kind = fox.phase4gKind;
  const shouldReward = kind === 'boss' && !fox.dead;
  phase4gDefeatBase(fox);
  if (shouldReward && fox.dead) {
    phase4g.boss = null;
    phase4g.summons = 0;
    // Experience is already awarded by defeatFox(fox) via fox.xp; only a modest heal.
    player.health = Math.min(player.maxHealth, player.health + 25);
    addParticles(fox.x, fox.y, '★', 12);
    phase4g.noticeFor = 2.8;
    ui.waveNotice.textContent = '赤尾狐王退却！守卫者恢复25点生命';
    ui.waveNotice.classList.remove('hidden');
  }
};

const phase4gDirectorBase = updateDirector;
updateDirector = function updatePhase4gDirector(dt) {
  phase4gDirectorBase(dt);
  if (!phase4g || state !== 'playing') return;
  if (elapsed >= phase4g.nextBossAt) phase4gSpawnBoss();
  if (phase4gAlive(phase4g.boss)) {
    // Boss mechanics stay fixed; reduce incidental normal-wave overload.
    waveRemaining = Math.min(5, waveRemaining);
    spawnTimer = Math.max(spawnTimer, phase4fSafety().inDanger ? 2.4 : 1.15);
  }
  if (phase4g.noticeFor > 0) {
    phase4g.noticeFor -= dt;
    if (phase4g.noticeFor <= 0) ui.waveNotice.classList.add('hidden');
    else {
      waveNoticeTimer = Math.max(waveNoticeTimer, phase4g.noticeFor);
    }
  }
};
const phase4gResetBase = resetGame;
resetGame = function resetPhase4gGame() {
  phase4gReset();
  phase4gResetBase();
};

// Distinct, muted-color silhouettes, and readable telegraphs without pixel-art clash.
const phase4gDrawFoxBase = drawFox;
drawFox = function drawPhase4gFox(fox) {
  if (!fox.phase4gKind) { phase4gDrawFoxBase(fox); return; }
  if (!phase4gAlive(fox)) return;
  const boss = fox.phase4gKind === 'boss';
  const kind = fox.phase4gKind;
  const radius = boss ? 37 : 22;
  const face = fox.phase4gFacing || { x: 1, y: 0 };
  context.save();
  if (kind === 'stalker' && fox.phase4gMode === 'sneak') context.globalAlpha = 0.42;
  if (kind === 'charger' && fox.phase4gMode === 'windup') {
    context.strokeStyle = 'rgba(190,103,82,.72)';
    context.lineWidth = 5; context.setLineDash([12, 10]);
    context.beginPath(); context.moveTo(fox.x, fox.y);
    context.lineTo(fox.x + face.x * 240, fox.y + face.y * 240); context.stroke();
    context.setLineDash([]);
  }
  if (boss && (fox.phase4gMode === 'chargeTell' || fox.phase4gMode === 'swipeTell')) {
    context.fillStyle = 'rgba(190,102,78,.15)';
    context.strokeStyle = 'rgba(162,83,63,.65)';
    context.lineWidth = 3;
    context.beginPath();
    if (fox.phase4gMode === 'swipeTell') {
      context.arc(fox.x, fox.y, 116, 0, Math.PI * 2);
    } else {
      const angle = Math.atan2(face.y, face.x);
      context.moveTo(fox.x,fox.y); context.arc(fox.x,fox.y,240,angle-.16,angle+.16);
      context.closePath();
    }
    context.fill(); context.stroke();
  }
  context.translate(fox.x, fox.y);
  context.rotate(Math.atan2(face.y, face.x));
  const coat = boss ? '#b77359' : kind === 'stalker' ? '#a29368' :
    kind === 'charger' ? '#c18d65' : '#b78c6e';
  const ear = boss ? '#865547' : '#92694e';
  context.fillStyle = 'rgba(72,69,56,.16)';
  context.beginPath(); context.ellipse(0,radius*.48,radius*1.1,radius*.37,0,0,Math.PI*2); context.fill();
  context.fillStyle = coat;
  context.beginPath(); context.ellipse(-radius*.1,0,radius*1.0,radius*.7,0,0,Math.PI*2);context.fill();
  context.fillStyle = ear;
  for (const side of [-1,1]) {
    context.beginPath();context.moveTo(radius*.12,side*radius*.36);
    context.lineTo(radius*.2,side*radius*.85);context.lineTo(radius*.62,side*radius*.42);context.fill();
  }
  context.fillStyle = '#ead8b8';
  context.beginPath();context.ellipse(radius*.49,radius*.08,radius*.46,radius*.39,0,0,Math.PI*2);context.fill();
  context.fillStyle = '#473d34';
  context.beginPath();context.arc(radius*.66,-radius*.09,Math.max(2,radius*.065),0,Math.PI*2);context.fill();
  context.beginPath();context.arc(radius*.78,radius*.13,Math.max(2,radius*.065),0,Math.PI*2);context.fill();
  if (kind === 'caller') {
    context.strokeStyle = '#697e74';context.lineWidth = 5;
    context.beginPath();context.moveTo(-radius*.38,-radius*.4);context.lineTo(-radius*.35,radius*.42);context.stroke();
  }
  if (kind === 'charger') {
    context.strokeStyle = '#796c60';context.lineWidth = 6;
    context.beginPath();context.arc(-radius*.25,0,radius*.58,-1.25,1.25);context.stroke();
  }
  if (boss) {
    context.fillStyle = '#b6a16f';
    context.beginPath();context.moveTo(-radius*.32,-radius*.38);context.lineTo(-radius*.22,-radius*.95);
    context.lineTo(radius*.1,-radius*.62);context.lineTo(radius*.42,-radius*.92);
    context.lineTo(radius*.52,-radius*.34);context.closePath();context.fill();
  }
  context.restore();
  if (fox.health < fox.maxHealth) {
    const bar = boss ? 76 : 38;
    roundedRectangle(fox.x-bar/2,fox.y-radius-13,bar,5,3,'rgba(52,53,47,.30)');
    roundedRectangle(fox.x-bar/2,fox.y-radius-13,bar*clamp(fox.health/fox.maxHealth,0,1),5,3,boss?'#bf7867':'#b69a67');
  }
};
const phase4gBossHud = document.createElement('div');
phase4gBossHud.className = 'phase4g-boss-hud hidden';
phase4gBossHud.innerHTML = '<strong>赤尾狐王</strong><div class="phase4g-boss-track"><div class="phase4g-boss-fill"></div></div><small>留意地面预警 · 攻击间隙反击</small>';
document.querySelector('#app')?.append(phase4gBossHud);
const phase4gHudBase = updateHud;
updateHud = function updatePhase4gHud(force = false) {
  phase4gHudBase(force);
  const boss = phase4g?.boss;
  const visible = phase4gAlive(boss) && state === 'playing';
  phase4gBossHud.classList.toggle('hidden', !visible);
  if (visible) phase4gBossHud.querySelector('.phase4g-boss-fill').style.width =
    (100 * clamp(boss.health / boss.maxHealth,0,1)).toFixed(1) + '%';
};
