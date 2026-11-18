// Phase 5A/B: a single objective, player-carried eggs, safe coop and map.
// Builds on the existing combat/director, without changing weapon growth.
const PHASE5_GOAL = 10;
const phase5 = { eggs: [], carried: null, runs: 0, waveTimer: 0, waveLeft: 0, gold: 0 };
const phase5Map = document.createElement('canvas');
phase5Map.id = 'phase5Map';
phase5Map.width = 222;
phase5Map.height = 162;
phase5Map.setAttribute('aria-label', '牧场小地图：鸡棚、玩家和鸡蛋位置');
phase5Map.style.cssText = 'position:fixed;right:14px;top:72px;width:222px;height:162px;z-index:8;border:2px solid #746d50;border-radius:12px;background:#dce8ce;box-shadow:0 3px 14px #0004;pointer-events:none';
document.querySelector('#app').appendChild(phase5Map);
const phase5CoopButton = document.createElement('button');
phase5CoopButton.type = 'button';
phase5CoopButton.id = 'phase5CoopButton';
phase5CoopButton.textContent = '鸡棚：带上 / 留守小鸡';
phase5CoopButton.style.cssText = 'position:fixed;bottom:92px;left:50%;transform:translateX(-50%);z-index:12;border:2px solid #ac905c;border-radius:12px;padding:10px 18px;background:#fbefcf;color:#493e2b;font-weight:bold;display:none';
document.querySelector('#app').appendChild(phase5CoopButton);
const phase5Status = document.createElement('div');
phase5Status.id = 'phase5Status';
phase5Status.style.cssText = 'position:fixed;right:14px;top:243px;z-index:8;padding:7px 9px;border-radius:9px;background:#f7edd9e8;color:#483c2d;font:700 13px sans-serif;pointer-events:none';
document.querySelector('#app').appendChild(phase5Status);

function phase5Coop() { return phase4iCoop(); }
function phase5SafeCount() { return chicks.filter(c => c.atCoop && !c.lost).length; }
function phase5NearCoop() {
  const coop = phase5Coop();
  return Math.hypot(player.x-coop.x, player.y-coop.y) <= PHASE4I.deliveryRadius;
}
function phase5SpawnEgg() {
  if (phase5.eggs.length >= 3 || phase5SafeCount() >= PHASE5_GOAL) return false;
  const coop = phase5Coop();
  for (let attempt = 0; attempt < 90; attempt++) {
    const x = 140 + Math.random()*(world.width-280);
    const y = 140 + Math.random()*(world.height-280);
    if (Math.hypot(x-coop.x,y-coop.y) < 520) continue;
    if (phase5.eggs.some(e=>Math.hypot(x-e.x,y-e.y)<420)) continue;
    if (typeof phase4jClear === 'function' && !phase4jClear(x,y,42)) continue;
    const egg = {id:phase5.runs+phase5.eggs.length+Math.random(),x,y};
    phase5.eggs.push(egg);
    return true;
  }
  return false;
}
function phase5RefillEggs() {
  let attempts=0;
  while (phase5.eggs.length < 3 && attempts++ < 4 && phase5SafeCount() < PHASE5_GOAL)
    if (!phase5SpawnEgg()) break;
}
function phase5TriggerAmbush() {
  phase5.runs++;
  // Bounded extra waves: difficulty tracks completed homecomings, not elapsed time.
  phase5.waveLeft = Math.min(18, 7 + Math.floor(phase5.runs*1.7));
  phase5.waveTimer = 0;
  waveRemaining = Math.min(24, waveRemaining + phase5.waveLeft);
  waveSpawnTimer = 0;
  waveNoticeTimer = 3.2;
  ui.waveNotice.textContent = '⚠ 鸡蛋到手！狐狸潮来袭 · 赶快归巢！';
  ui.waveNotice.classList.remove('hidden');
  addParticles(player.x,player.y,'!',6);
  playTone(230,.18,.055,'sawtooth');
}
function phase5Deliver() {
  if (!phase5NearCoop()) return;
  let delivered = 0;
  if (phase5.carried) {
    phase5.carried = null;
    // Already-safe hatchling: never count the same chick twice.
    const chick = phase4hCreateChick();
    chick.atCoop = true;
    chick.health = 100; chick.maxHealth = 100;
    chick.x = phase5Coop().x+22;
    chick.y = phase5Coop().y+20;
    chick.protectedFor = 0;
    chicks.push(chick);
    delivered++;
    phase4i.deliveries++;
  }
  for (const chick of chicks) {
    if (chick.lost || chick.atCoop || chick.carriedBy) continue;
    chick.atCoop = true;
    chick.x = phase5Coop().x + 18 + Math.random()*22;
    chick.y = phase5Coop().y + 12 + Math.random()*23;
    delivered++;
  }
  if (delivered) {
    addParticles(phase5Coop().x,phase5Coop().y,'✿',8);
    phase4iMessage('安全归巢 +' + delivered + ' · 鸡棚 ' + phase5SafeCount()+'/'+PHASE5_GOAL);
    phase5RefillEggs();
  }
  if (phase5SafeCount() >= PHASE5_GOAL) phase5Victory();
}
function phase5Victory() {
  if (state!=='playing') return;
  state='result';
  phase5CoopButton.style.display='none';
  ui.hud.classList.add('hidden');
  ui.upgradePanel.classList.add('hidden');
  ui.resultPanel.classList.remove('hidden');
  ui.resultEmoji.textContent='🏠';
  ui.resultTitle.textContent='十只小鸡，平安归巢！';
  ui.resultText.textContent='成功保护并交付 '+phase5SafeCount()+' 只小鸡，完成 '+phase5.runs+' 次取蛋突围，击败 '+foxesDefeated+' 只狐狸。';
  ui.resultBest.textContent='归巢通关 · '+formatEndlessTime(elapsed)+' · 不限时';
  playTone(900,.25,.05,'sine');
}
// Disable the earlier timed single-egg scheduler; the Phase 5 world uses 3
// persistent, player-pickable eggs and replenishes on delivery, not a timer.
phase4iUpdateEgg = function phase5NoLegacyEggs(){};
const phase5ResetBase = resetGame;
resetGame = function resetPhase5() {
  phase5.eggs=[];phase5.carried=null;phase5.runs=0;
  phase5.waveTimer=0;phase5.waveLeft=0;phase5.gold=0;
  phase5ResetBase();
  phase4i.egg=null;
  player.x=phase5Coop().x;player.y=phase5Coop().y+35;
  camera.x=player.x;camera.y=player.y;
  // Start with one safe chick. Leave it in the coop until explicitly selected.
  for (const chick of chicks) {
    chick.atCoop=true;
    chick.x=phase5Coop().x+18;
    chick.y=phase5Coop().y+18;
    chick.health=100;chick.maxHealth=100;
  }
  phase5RefillEggs();
  updateCamera(0,true);updateHud();
};
// Coop occupants neither trail the player nor become fox targets.
const phase5UpdateChicksBase = updateChicks;
updateChicks = function updatePhase5Chicks(dt) {
  const all=chicks;
  chicks=all.filter(c=>!c.atCoop);
  try { phase5UpdateChicksBase(dt); }
  finally { chicks=all; }
};
const phase5NearestBase = nearestAvailableChick;
nearestAvailableChick = function phase5NearestOutside(fox) {
  const all=chicks;
  chicks=all.filter(c=>!c.atCoop);
  try { return phase5NearestBase(fox); }
  finally { chicks=all; }
};
// No instant loss because all the surviving chickens are safely in the coop.
// The existing game update has an old 'no living chickens' failure case,
// but 1+ safe chicks remain represented in the chick array.
const phase5UpdateBase = update;
update = function updatePhase5(dt) {
  phase5UpdateBase(dt);
  if (state!=='playing') return;
  const coop=phase5Coop();
  // The legacy timed director becomes a baseline with bounded difficulty;
  // egg pickup contributes the meaningful bursts.
  if (!phase5.carried) {
    const egg=phase5.eggs.find(e=>Math.hypot(e.x-player.x,e.y-player.y)<=36);
    if (egg) {
      phase5.eggs.splice(phase5.eggs.indexOf(egg),1);
      phase5.carried=egg;
      phase5TriggerAmbush();
    }
  }
  phase5Deliver();
  phase5CoopButton.style.display=phase5NearCoop() && state==='playing' ? 'block':'none';
};
phase5CoopButton.addEventListener('click',()=>{
  if (state!=='playing' || !phase5NearCoop()) return;
  const outside=chicks.filter(c=>!c.atCoop&&!c.lost&&!c.carriedBy);
  if (outside.length) {
    for(const c of outside) {c.atCoop=true;c.x=phase5Coop().x+22;c.y=phase5Coop().y+18;}
    phase4iMessage('小鸡已留守鸡棚 · 安全不参战');
  } else {
    const stored=chicks.find(c=>c.atCoop&&!c.lost);
    if(stored) {
      stored.atCoop=false;stored.x=player.x+30;stored.y=player.y+30;
      phase4iMessage('小鸡出征！野外有被抓走的风险');
    }
  }
  updateHud();
});
const phase5HudBase = updateHud;
updateHud = function updatePhase5Hud(force=false) {
  phase5HudBase(force);
  if(!player) return;
  const safe=phase5SafeCount();
  const next=phase5.carried ? ' · 背蛋归巢' : ' · 地图寻蛋';
  phase4iPill.textContent='归巢 '+safe+'/'+PHASE5_GOAL+next;
  phase4iPill.title='拾取鸡蛋自动触发狐狸潮，亲自背回鸡棚孵化；鸡棚内小鸡安全';
  phase5Status.textContent=phase5.carried ? '背蛋中 · 狐狸潮！' : '归巢 '+safe+'/'+PHASE5_GOAL+' · 找蛋';
  ui.chicksAlive.textContent=String(safe);
};
const phase5DrawBase = drawWorld;
drawWorld = function drawPhase5World() {
  phase5DrawBase();
  const coop=phase5Coop();
  context.save();
  context.strokeStyle='rgba(112,137,81,.7)';
  context.lineWidth=3;
  context.beginPath();context.arc(coop.x,coop.y,PHASE4I.deliveryRadius,0,Math.PI*2);context.stroke();
  for (const egg of phase5.eggs) {
    context.fillStyle='#f8efca';context.strokeStyle='#9f8c5b';context.lineWidth=2;
    context.beginPath();context.ellipse(egg.x,egg.y,12,17,0,0,Math.PI*2);context.fill();context.stroke();
    context.strokeStyle='rgba(206,169,91,.7)';
    context.beginPath();context.arc(egg.x,egg.y,28+Math.sin(elapsed*4)*2,0,Math.PI*2);context.stroke();
  }
  if (phase5.carried) {
    context.fillStyle='#fff2c9';context.strokeStyle='#9f8c5b';context.lineWidth=2;
    context.beginPath();context.ellipse(player.x,player.y-35,11,14,0,0,Math.PI*2);
    context.fill();context.stroke();
  }
  context.restore();
};
// Minimap is screen-space, so render it after the main world draw.
const phase5DrawBaseScreen=draw;
draw = function drawPhase5Screen() {
  phase5DrawBaseScreen();
  if (!player) return;
  const ctx=phase5Map.getContext('2d');
  const w=phase5Map.width,h=phase5Map.height;
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle='#dce8ce';ctx.fillRect(0,0,w,h);
  const px=x=>7+x/world.width*(w-14),py=y=>7+y/world.height*(h-14);
  ctx.strokeStyle='#8d9d80';ctx.lineWidth=2;ctx.strokeRect(6,6,w-12,h-12);
  const coop=phase5Coop();
  ctx.fillStyle='#89694d';ctx.fillRect(px(coop.x)-6,py(coop.y)-5,12,10);
  for (const egg of phase5.eggs) {
    ctx.fillStyle='#f4e4a2';ctx.strokeStyle='#826b43';
    ctx.beginPath();ctx.arc(px(egg.x),py(egg.y),5,0,Math.PI*2);ctx.fill();ctx.stroke();
  }
  if (phase5.carried) {
    ctx.strokeStyle='#d1a048';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(px(player.x),py(player.y));ctx.lineTo(px(coop.x),py(coop.y));ctx.stroke();
  }
  ctx.fillStyle='#276f9a';ctx.strokeStyle='#fff';
  ctx.beginPath();ctx.arc(px(player.x),py(player.y),5,0,Math.PI*2);ctx.fill();ctx.stroke();
};
const phase5DefeatBase = defeatFox;
defeatFox = function defeatPhase5Fox(fox) {
  const wasAlive=!fox.dead;
  phase5DefeatBase(fox);
  if (wasAlive && fox.dead) phase5.gold+=fox.phase4gKind==='boss'?25:fox.phase4gKind?8:fox.type==='brute'?4:fox.type==='swift'?2:1;
};
