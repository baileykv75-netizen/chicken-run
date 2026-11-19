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
// Keep navigation visible on mobile without covering the entire play area.
function phase5SizeNavigation(){
  const small=window.innerWidth<700;
  phase5Map.style.width=small?'150px':'222px';
  phase5Map.style.height=small?'110px':'162px';
  phase5Map.style.top=small?'98px':'72px';
  phase5Status.style.top=small?'216px':'243px';
  phase5Status.style.fontSize=small?'11px':'13px';
}
window.addEventListener('resize',phase5SizeNavigation);
phase5SizeNavigation();

// Every deployed chick has its own HP. No awakened/cultivated immunity.
// Repeated fox contact is throttled, but there is no automatic regeneration.
function phase5TryAttackChick(fox, chick) {
  if (!chick || chick.atCoop || chick.lost || chick.carriedBy) return;
  chick.maxHealth ??= 100;
  chick.health ??= chick.maxHealth;
  if ((chick.downedFor || 0)>0 || (chick.invulnerableFor || 0)>0) return;
  if (chick.health>0) {
    const baseDamage=fox.type==='brute'?34:fox.phase4gKind?30:22;
    const armor=typeof phase5GearDamageReduction==='function'?phase5GearDamageReduction(chick):0;
    chick.health=Math.max(0,chick.health-Math.max(2,Math.round(baseDamage*(1-armor))));
    chick.invulnerableFor=.8;
    addParticles(chick.x,chick.y,'!',2);
    if(chick.health===0 && typeof phase5GearPreventFatal==='function'
       && phase5GearPreventFatal(chick))return;
    if(typeof phase5GearOnHit==='function')phase5GearOnHit(chick,fox);
    if(chick.health===0) {
      chick.downedFor=2.2;
      phase4iMessage('小鸡倒地！赶快击退狐狸救援');
    }
    return;
  }
  fox.carrying=chick;
  chick.carriedBy=fox;
  chick.downedFor=0;
  fox.target=null;
  addParticles(fox.x,fox.y,'!',2);
  playTone(170,.1,.04,'sawtooth');
}
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
  // Retrieval should feel like a committed fight, not a trivial walk home.
  // The wave remains bounded by entity caps; enemy strength is scaled separately.
  const progress = Math.max(0, phase5SafeCount() - 1);
  phase5.waveLeft = Math.min(24, 10 + Math.floor(phase5.runs*1.4) + progress);
  phase5.waveTimer = 0;
  phase5.ambushUntil = elapsed + 26;
  waveRemaining = Math.min(28, waveRemaining + phase5.waveLeft);
  waveSpawnTimer = 0;
  waveNoticeTimer = 3.2;
  ui.waveNotice.textContent = '⚠ 鸡蛋到手！狐狸潮来袭 · 赶快归巢！';
  ui.waveNotice.classList.remove('hidden');
  addParticles(player.x,player.y,'!',6);
  playTone(230,.18,.055,'sawtooth');
}
function phase5Deliver() {
  if (!phase5NearCoop()) {
    // A deployed chick has now left the yard and can be delivered on return.
    for (const chick of chicks) chick.phase5Departing = false;
    return;
  }
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
    if (chick.lost || chick.atCoop || chick.carriedBy || chick.phase5Departing) continue;
    // Equipped escorts keep their expedition assignment on every return.
    // Only unarmed rescued/follower chicks are deposited automatically.
    // A player can deliberately recall an equipped chick from the coop panel.
    if (Array.isArray(chick.equipment) && chick.equipment.length > 0) continue;
    chick.atCoop = true;
    // Stop enemies from continuing to chase a chick that is now safely home.
    for (const fox of foxes) if (fox.target === chick) fox.target = null;
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
  phase5.waveTimer=0;phase5.waveLeft=0;phase5.ambushUntil=0;phase5.gold=0;
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
  for (const c of all) {
    if (c.atCoop || c.lost) continue;
    c.maxHealth ??= 100;
    c.health ??= c.maxHealth;
    c.invulnerableFor=Math.max(0,(c.invulnerableFor||0)-dt);
    c.downedFor=Math.max(0,(c.downedFor||0)-dt);
    if (c.health<=0 && !c.carriedBy) {
      // Hold position near a downed chick without an adjacent fox to revive it.
      const nearPlayer=Math.hypot(player.x-c.x,player.y-c.y)<57;
      const threatened=foxes.some(f=>!f.dead&&f.health>0&&Math.hypot(f.x-c.x,f.y-c.y)<68);
      c.reviveProgress=nearPlayer&&!threatened
        ? (c.reviveProgress||0)+dt : 0;
      if(c.reviveProgress>=1.5){
        c.health=15;c.reviveProgress=0;c.invulnerableFor=1.5;
        addParticles(c.x,c.y,'+',5);
        phase4iMessage('小鸡已被扶起，仅恢复15点生命');
      }
    }
  }
  chicks=all.filter(c=>!c.atCoop&&(c.health>0||c.carriedBy));
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
// Phase 5 difficulty follows homecoming progress, never unlimited elapsed time.
// The ordinary director's periodic waves and three-minute bosses would undermine
// the new one-goal egg ambush loop; keep regular roaming foxes for XP and gold.
// Strength and pacing scale with homecomings, combat progression and actual
// director measurements. Time alone never raises the challenge indefinitely.
function phase5Difficulty(){
  const progress=Math.max(0,phase5SafeCount()-1);
  const equipped=chicks.filter(c=>!c.lost&&!c.atCoop&&!c.carriedBy)
    .reduce((sum,c)=>sum+(c.equipment?.length||0),0);
  const base=1+progress*.10+Math.min(.20,Math.max(0,(player?.level||1)-1)*.025);
  const measured=phase4f?Math.max(.9,Math.min(1.7,phase4f.multiplier)):1;
  const team=1+Math.min(.12,equipped*.015);
  const fragile=(player?.health||0)<(player?.maxHealth||100)*.32;
  return Math.max(1,Math.min(2.5,base*measured*team*(fragile?.88:1)));
}
function phase5SpawnThreat(forced=null,isAmbush=false){
  if(foxes.length>=currentFoxLimit())return false;
  const before=foxes.length;
  const created=spawnFox(forced);
  if(!created||foxes.length<=before)return false;
  const fox=foxes[foxes.length-1];
  if(!fox.phase4gKind || fox.phase4gKind!=='boss'){
    const progress=Math.max(0,phase5SafeCount()-1);
    const intensity=phase5Difficulty();
    const hpFactor=1.15+.20*(intensity-1)+(isAmbush?.20:0);
    const speedFactor=1.05+.06*(intensity-1)+(isAmbush?.045:0);
    fox.health=Math.round(fox.health*hpFactor);
    fox.maxHealth=fox.health;
    fox.speed*=speedFactor;
    fox.phase5DamageScale=Math.min(1.9,1.15+progress*.055+(isAmbush?.11:0));
    fox.phase5Ambush=!!isAmbush;
    // Elite foxes introduce charge/control pressure after early homecomings,
    // without requiring an additional boss or exceeding the existing fox cap.
    if(isAmbush&&progress>=2&&!fox.phase4gKind
       &&Math.random()<Math.min(.20,.075+progress*.012)
       &&typeof phase4gMakeElite==='function'){
      const types=['charger','stalker','caller'];
      phase4gMakeElite(fox,types[(phase5.runs+waveRemaining)%types.length]);
    }
  }
  return true;
}
updateDirector = function updatePhase5Director(dt) {
  const progress=Math.max(0,phase5SafeCount()-1);
  dangerLevel=Math.min(10,2+Math.floor(progress*.85)+Math.floor((phase5Difficulty()-1)*1.4));
  if (phase4f) {
    phase4f.phase=progress>=6?'hard':progress>=3?'threat':'easy';
    phase4f.activeBuff=null;
  }
  if (waveNoticeTimer>0) {
    waveNoticeTimer=Math.max(0,waveNoticeTimer-dt);
    if (waveNoticeTimer===0) ui.waveNotice.classList.add('hidden');
  }
  if (waveRemaining>0) {
    waveSpawnTimer-=dt;
    if (waveSpawnTimer<=0 && foxes.length<currentFoxLimit()) {
      const forced=waveRemaining%4===0?'brute':waveRemaining%2===0?'swift':null;
      if(phase5SpawnThreat(forced,true))waveRemaining--;
      waveSpawnTimer=Math.max(.15,.27/Math.sqrt(phase5Difficulty()));
    }
  }
  spawnTimer-=dt;
  if (spawnTimer<=0 && foxes.length<currentFoxLimit()) {
    const forced=progress>=4&&Math.random()<.20?'swift':null;
    phase5SpawnThreat(forced,false);
    const fragile=player.health<player.maxHealth*.32;
    spawnTimer=Math.max(1.15,(2.8-progress*.14)/Math.sqrt(phase5Difficulty()))*(fragile?1.25:1);
  }
};
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
  // All deployment and recall now happens in the coop management panel.
  phase5CoopButton.style.display='none';
};
function phase5DispatchChick(chick){
  if(!chick || chick.lost || !chick.atCoop || chick.carriedBy) return false;
  chick.atCoop=false;
  chick.phase5Departing=true;
  chick.phase5PhoenixUsed=false;
  chick.phase5ShieldReady=0;
  chick.phase5ArmorGuardUsed=false;
  chick.x=player.x+30;chick.y=player.y+30;
  // Deployed chicks need to leave the safety region before they can be delivered again.
  return true;
}
function phase5RecallChick(chick){
  if(!chick || chick.lost || chick.atCoop || chick.carriedBy || !phase5NearCoop())return false;
  chick.atCoop=true;chick.phase5Departing=false;
  chick.x=phase5Coop().x+20;chick.y=phase5Coop().y+20;
  for(const fox of foxes)if(fox.target===chick)fox.target=null;
  return true;
}
// Kept for compatibility with existing coop flow and smoke tests;
// the visible coop controls live in the new roster screen.
phase5CoopButton.addEventListener('click',()=>{
  if(state!=='playing'||!phase5NearCoop())return;
  const deployed=chicks.filter(c=>!c.atCoop&&!c.lost&&!c.carriedBy);
  if(deployed.length){
    for(const chick of deployed)phase5RecallChick(chick);
  }else{
    const chick=chicks.find(c=>c.atCoop&&!c.lost);
    if(chick)phase5DispatchChick(chick);
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
  // HP indicators: visible even for non-cultivated chicks in danger.
  for(const chick of chicks) {
    if(chick.lost || chick.atCoop || chick.carriedBy)continue;
    const fraction=Math.max(0,(chick.health??100)/(chick.maxHealth||100));
    context.fillStyle='#4d4539';context.fillRect(chick.x-15,chick.y-23,30,5);
    context.fillStyle=fraction>.35?'#80b377':'#d87c66';
    context.fillRect(chick.x-14,chick.y-22,28*fraction,3);
    if((chick.health||0)<=0) {
      context.font='bold 12px sans-serif';context.textAlign='center';
      context.fillStyle='#aa574a';context.fillText('救援!',chick.x,chick.y-32);
    }
  }
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
  phase5Map.style.display = state === 'playing' ? 'block' : 'none';
  phase5Status.style.display = state === 'playing' ? 'block' : 'none';
  if (state !== 'playing' || !player) return;
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
  const rescued=fox.carrying;
  phase5DefeatBase(fox);
  if (rescued && fox.dead && !rescued.lost) {
    rescued.health=Math.max(18,rescued.health||0);
    rescued.downedFor=0;rescued.invulnerableFor=1.2;
  }
  if (wasAlive && fox.dead) phase5.gold+=fox.phase4gKind==='boss'?25:fox.phase4gKind?8:fox.type==='brute'?4:fox.type==='swift'?2:1;
};
