// Phase 4I: discover eggs, let a living chick carry one, and escort it home.
// No automatic level-based hatching, professions or novice immunity.
const PHASE4I = Object.freeze({
  startingChicks: 1,
  maxChicks: 10,
  firstEggAt: 75,
  nextEggMin: 90,
  nextEggSpread: 30,
  groundLifetime: 50,
  pickupRadius: 34,
  deliveryRadius: 105,
});
let phase4i = null;
function phase4iResetState() {
  phase4i = { egg: null, nextEggAt: PHASE4I.firstEggAt,
    deliveries: 0, lostEggs: 0, expiredEggs: 0,
    notice: '', noticeFor: 0 };
}
phase4iResetState();

function phase4iLivingCount() {
  return chicks.reduce((count, chick) => count + (chick.lost ? 0 : 1), 0);
}
function phase4iCoop() {
  // Same physical location as the existing coop in phase4e-scene.js.
  return { x: world.width * 0.18, y: world.height * 0.22 };
}
function phase4iEligibleCarrier(chick) {
  // Awakened and scouting chicks cannot be targeted by the original capture AI.
  // Keep the egg risk real by letting only a vulnerable follower carry it.
  return !chick.lost && !chick.carriedBy && !chick.awakened && !chick.scouting;
}
function phase4iMessage(message) {
  phase4i.notice = message;
  phase4i.noticeFor = 3.4;
  if (typeof phase4hNotify === 'function') phase4hNotify(message, 3.4);
}
function phase4iScheduleNext() {
  phase4i.nextEggAt = elapsed + PHASE4I.nextEggMin
    + Math.random() * PHASE4I.nextEggSpread;
}
function phase4iSpawnEgg() {
  if (phase4i.egg || phase4iLivingCount() >= PHASE4I.maxChicks) return false;
  if (phase4iLivingCount() <= 0 || !chicks.some(phase4iEligibleCarrier)) return false;
  const coop = phase4iCoop();
  const angle = Math.random() * Math.PI * 2;
  const distance = 245 + Math.random() * 85;
  let x = clamp(player.x + Math.cos(angle) * distance, 48, world.width - 48);
  let y = clamp(player.y + Math.sin(angle) * distance, 48, world.height - 48);
  // A new egg cannot appear inside the coop's immediate delivery region.
  if (Math.hypot(x - coop.x, y - coop.y) < PHASE4I.deliveryRadius + 90) {
    x = clamp(coop.x + Math.cos(angle) * 235, 48, world.width - 48);
    y = clamp(coop.y + Math.sin(angle) * 235, 48, world.height - 48);
  }
  phase4i.egg = { x, y, status: 'ground', carrier: null, lifetime: PHASE4I.groundLifetime };
  phase4iMessage('发现一枚鸡蛋！带小鸡靠近拾取，再护送回鸡棚');
  return true;
}
function phase4iHatch(carrier) {
  if (!carrier || carrier.lost || carrier.carriedBy || phase4iLivingCount() >= PHASE4I.maxChicks) return false;
  const chick = phase4hCreateChick();
  chick.protectedFor = 0;
  chick.phase4iHatched = true;
  const coop = phase4iCoop();
  chick.x = clamp(coop.x + 18, 14, world.width - 14);
  chick.y = clamp(coop.y + 20, 14, world.height - 14);
  chicks.push(chick);
  phase4i.deliveries += 1;
  phase4i.egg = null;
  phase4iScheduleNext();
  addParticles(coop.x, coop.y, '✿', 7);
  playTone(760, 0.13, 0.04, 'sine');
  phase4iMessage('鸡蛋送达！成功孵化一只小鸡 · ' + phase4iLivingCount() + '/' + PHASE4I.maxChicks);
  return true;
}
function phase4iLoseEgg(reason) {
  if (!phase4i.egg) return;
  const lost = reason === 'lost';
  phase4i.egg = null;
  if (lost) phase4i.lostEggs += 1;
  else phase4i.expiredEggs += 1;
  phase4iScheduleNext();
  phase4iMessage(lost ? '运蛋小鸡被狐狸带走，小鸡与鸡蛋双双损失！' : '野外的鸡蛋没有及时拾取，已经消失');
}
function phase4iUpdateEgg(dt) {
  if (!player || state !== 'playing') return;
  const egg = phase4i.egg;
  if (!egg) {
    // Avoid spawning another objective during an active event or boss fight.
    const busyWithEvent = typeof phase4hActive === 'function' && phase4hActive();
    const busyWithBoss = typeof phase4gAlive === 'function'
      && typeof phase4g !== 'undefined' && phase4gAlive(phase4g?.boss);
    if (busyWithEvent || busyWithBoss) {
      phase4i.nextEggAt += dt;
      return;
    }
    if (phase4iLivingCount() >= PHASE4I.maxChicks) {
      // Do not queue eggs while already full.
      phase4i.nextEggAt = Math.max(phase4i.nextEggAt, elapsed + dt);
      return;
    }
    if (elapsed >= phase4i.nextEggAt && !phase4iSpawnEgg())
      phase4i.nextEggAt = elapsed + 12;
    return;
  }
  if (egg.status === 'ground') {
    egg.lifetime -= dt;
    if (egg.lifetime <= 0) { phase4iLoseEgg('expired'); return; }
    let carrier = null;
    let best = PHASE4I.pickupRadius ** 2;
    for (const chick of chicks) {
      if (!phase4iEligibleCarrier(chick)) continue;
      const d2 = (chick.x - egg.x) ** 2 + (chick.y - egg.y) ** 2;
      if (d2 <= best) { best = d2; carrier = chick; }
    }
    if (carrier) {
      egg.status = 'carried';
      egg.carrier = carrier;
      phase4iMessage('小鸡已经驮起鸡蛋，返回左上方鸡棚孵化！');
    }
    return;
  }
  const carrier = egg.carrier;
  if (!carrier || carrier.lost) {
    // Lost only when the fox actually exits with its victim.
    // Killing the fox in time releases both chick and egg.
    phase4iLoseEgg('lost');
    return;
  }
  if (carrier.awakened || carrier.scouting) {
    // An invulnerable/scouting chicken cannot be used as a risk-free egg mule.
    egg.status = 'ground';
    egg.x = carrier.x;
    egg.y = carrier.y;
    egg.carrier = null;
    egg.lifetime = PHASE4I.groundLifetime;
    phase4iMessage('鸡蛋已放下，让普通小鸡重新驮起');
    return;
  }
  egg.x = carrier.x;
  egg.y = carrier.y;
  if (carrier.carriedBy) return;
  const coop = phase4iCoop();
  if (Math.hypot(carrier.x - coop.x, carrier.y - coop.y) <= PHASE4I.deliveryRadius)
    phase4iHatch(carrier);
}
const phase4iResetBase = resetGame;
resetGame = function resetPhase4iGame() {
  phase4iResetState();
  phase4iResetBase();
  // Preserve original chick physics and existing skills, but open with one.
  chicks = chicks.slice(0, PHASE4I.startingChicks);
  const first = chicks[0];
  if (first) {
    first.x = clamp(player.x + 36, 14, world.width - 14);
    first.y = clamp(player.y + 28, 14, world.height - 14);
    first.protectedFor = 0;
  }
  updateHud();
};
const phase4iUpdateBase = update;
update = function updatePhase4iEggEscort(dt) {
  phase4iUpdateBase(dt);
  phase4iUpdateEgg(dt);
};

function phase4iCompass(x,y) {
  const angle = Math.atan2(y - player.y, x - player.x);
  const symbols = ['→','↘','↓','↙','←','↖','↑','↗'];
  return symbols[(Math.round(angle / (Math.PI / 4)) + 8) % 8];
}
const phase4iPill = document.createElement('div');
phase4iPill.className = 'pill phase4i-pill';
phase4iPill.setAttribute('aria-label', '小鸡驮蛋任务');
document.querySelector('#hud .hud-left')?.appendChild(phase4iPill);
const phase4iHudBase = updateHud;
updateHud = function updatePhase4iHud(force = false) {
  phase4iHudBase(force);
  if (!player || !phase4i) return;
  const count = phase4iLivingCount();
  const egg = phase4i.egg;
  let objective = '';
  if (egg?.status === 'ground')
    objective = ' · 找蛋 ' + phase4iCompass(egg.x, egg.y)
      + ' ' + Math.round(Math.hypot(egg.x - player.x, egg.y - player.y)) + '步';
  else if (egg?.status === 'carried') {
    const coop = phase4iCoop();
    objective = ' · 送蛋回鸡棚 ' + phase4iCompass(coop.x, coop.y)
      + ' ' + Math.round(Math.hypot(coop.x - player.x, coop.y - player.y)) + '步';
  } else if (count < PHASE4I.maxChicks)
    objective = ' · 下枚蛋约 ' + Math.max(0, Math.ceil(phase4i.nextEggAt - elapsed)) + '秒';
  phase4iPill.textContent = '鸡群 ' + count + '/' + PHASE4I.maxChicks + objective;
  phase4iPill.title = '普通小鸡自动驮蛋，需护送到地图左上方鸡棚；若运蛋小鸡被抓走，鸡蛋也会损失';
};
// Draw an unobtrusive egg on the ground or on the chick's back.
// Delivery area is tied to the same painted coop as Phase 4E.
const phase4iDrawBase = drawWorld;
drawWorld = function drawPhase4iEggWorld() {
  phase4iDrawBase();
  const egg = phase4i?.egg;
  const coop = phase4iCoop();
  const drawMarker = egg && egg.status === 'carried';
  context.save();
  if (drawMarker) {
    context.strokeStyle = 'rgba(143,151,107,.62)';
    context.fillStyle = 'rgba(195,202,149,.14)';
    context.lineWidth = 3;
    context.beginPath();
    context.arc(coop.x, coop.y, PHASE4I.deliveryRadius, 0, Math.PI*2);
    context.fill();context.stroke();
    context.fillStyle = '#675e4d';
    context.font = 'bold 15px sans-serif';
    context.textAlign = 'center';
    context.fillText('交蛋孵化',coop.x,coop.y - 98);
  }
  if (egg) {
    const x = egg.status === 'carried' ? egg.carrier?.x ?? egg.x : egg.x;
    const y = egg.status === 'carried' ? (egg.carrier?.y ?? egg.y) - 17 : egg.y;
    if (egg.status === 'ground') {
      context.strokeStyle = 'rgba(165,153,106,.62)';
      context.fillStyle = 'rgba(248,233,177,.13)';
      context.lineWidth = 2;
      context.beginPath();context.arc(x,y,33+Math.sin(elapsed*4)*2,0,Math.PI*2);
      context.fill();context.stroke();
    }
    context.translate(x,y);
    context.rotate(-.1);
    context.fillStyle = '#fbf0d5';
    context.strokeStyle = '#bcae8d';
    context.lineWidth = 1.8;
    context.beginPath();context.ellipse(0,0,12,15,0,0,Math.PI*2);
    context.fill();context.stroke();
    context.fillStyle = '#b6a58c';
    context.beginPath();context.ellipse(-4,-5,2.5,3,0,0,Math.PI*2);context.fill();
  }
  context.restore();
};
