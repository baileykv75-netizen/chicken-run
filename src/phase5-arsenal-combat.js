// Phase 5D: independent four-slot combat behaviors, HP effects and controls.
// All 24 catalog entries have a real activation or passive effect.
let phase5Decoys=[],phase5BurnZones=[],phase5Traps=[];
function phase5HostileFoxes(x,y,range=Infinity){
  const limit=range*range;
  return foxes.filter(f=>!f.dead&&f.health>0&&(f.x-x)**2+(f.y-y)**2<=limit);
}
function phase5ClosestFox(x,y,range=Infinity,preferElite=false){
  const pool=phase5HostileFoxes(x,y,range);
  if(!pool.length)return null;
  pool.sort((a,b)=>{
    const ap=preferElite?(a.phase4gKind?0:1):0;
    const bp=preferElite?(b.phase4gKind?0:1):0;
    return ap-bp+((a.x-x)**2+(a.y-y)**2-(b.x-x)**2-(b.y-y)**2)/1000000;
  });
  return pool[0];
}
function phase5GearOwnerDamage(chick){
  let multiplier=1;
  for(const ally of chicks){
    if(ally.lost||ally.atCoop||ally.carriedBy||(ally.health||0)<=0)continue;
    const distance=Math.hypot(ally.x-chick.x,ally.y-chick.y);
    for(const flag of phase5ChickHas(ally,'banner')){
      if(distance<=130+flag.level*40)multiplier+=.06*flag.level;
    }
  }
  return Math.min(1.7,multiplier);
}
function phase5Heal(target,value){
  if(!target||!Number.isFinite(value))return;
  target.health=Math.min(target.maxHealth||100,(target.health||0)+value);
}
function phase5Deal(chick,fox,damage,knockback=8,stun=0){
  if(!fox||fox.dead||fox.health<=0)return 0;
  const previous=fox.health;
  const dir=normalized(fox.x-chick.x,fox.y-chick.y);
  damageFox(fox,damage*phase5GearOwnerDamage(chick),dir,knockback,stun);
  const dealt=Math.max(0,previous-Math.max(0,fox.health));
  const siphons=phase5ChickHas(chick,'leech');
  if(siphons.length&&dealt>0){
    const fraction=Math.min(.32,siphons.reduce((s,i)=>s+.025+i.level*.025,0));
    // Healing requires dealing real damage; no passive recovery in the coop.
    phase5Heal(chick,dealt*fraction);
  }
  return dealt;
}
function phase5GearDamageReduction(chick){
  return Math.min(.42,phase5ChickHas(chick,'armor').reduce((s,i)=>s+.045*i.level,0));
}
function phase5GearPreventFatal(chick){
  if(chick.phase5PhoenixUsed)return false;
  const phoenix=phase5ChickHas(chick,'phoenix')[0];
  if(!phoenix)return false;
  chick.phase5PhoenixUsed=true;
  chick.health=15+phoenix.level*17;
  chick.invulnerableFor=1+phoenix.level*.25;
  addParticles(chick.x,chick.y,'✦',10);
  return true;
}
function phase5GearOnHit(chick,fox){
  for(const spike of phase5ChickHas(chick,'thorns')){
    if(fox&&!fox.dead)phase5Deal(chick,fox,8+11*spike.level,12+6*spike.level,spike.level>=2?.16:0);
    if(spike.level>=3)
      for(const f of phase5HostileFoxes(chick.x,chick.y,77))
        if(f!==fox)phase5Deal(chick,f,11,26,.12);
  }
  if((chick.health||0)<=chick.maxHealth*.35&&(chick.phase5ShieldReady||0)<=elapsed){
    const shield=phase5ChickHas(chick,'shield')[0];
    if(shield){
      chick.invulnerableFor=Math.max(chick.invulnerableFor||0,.9+shield.level*.35);
      chick.phase5ShieldReady=elapsed+Math.max(5,11-shield.level*2);
      if(shield.level>=3)
        for(const f of phase5HostileFoxes(chick.x,chick.y,75))
          phase5Deal(chick,f,9,40,.17);
      addParticles(chick.x,chick.y,'◇',4);
    }
  }
}
function phase5GearActive(chick,item){
  const level=item.level;
  const target=phase5ClosestFox(chick.x,chick.y,260+level*40);
  const direct=(damage,range=260,knock=8,stun=0,elite=false)=>{
    const f=phase5ClosestFox(chick.x,chick.y,range,elite);
    if(!f)return false;
    phase5Deal(chick,f,damage,knock,stun);return true;
  };
  const blast=(x,y,radius,damage,knock=8,stun=0)=>{
    let any=false;
    for(const f of phase5HostileFoxes(x,y,radius)){
      any=true;phase5Deal(chick,f,damage,knock,stun);
    }
    return any;
  };
  switch(item.id){
    case 'rotary': {
      if(!target)return false;
      const enemies=phase5HostileFoxes(chick.x,chick.y,270+level*30)
        .sort((a,b)=>distanceSquared(chick,a)-distanceSquared(chick,b));
      const shots=level===3?4:level===2?2:1;
      for(let i=0;i<shots;i++)phase5Deal(chick,enemies[i%enemies.length],9+level*4,3);
      addParticles(target.x,target.y,'·',2);return true;
    }
    case 'storm-spear':{
      if(!target)return false;
      const direction=normalized(target.x-chick.x,target.y-chick.y);
      const reach=220+level*45;
      const enemies=phase5HostileFoxes(chick.x,chick.y,reach)
        .filter(f=>pointSegmentDistance(f.x,f.y,chick.x,chick.y,chick.x+direction.x*reach,chick.y+direction.y*reach)<f.radius+14)
        .slice(0,2+level*2);
      for(const f of enemies)phase5Deal(chick,f,22+level*12,10);
      if(level>=3){
        const chain=phase5HostileFoxes(target.x,target.y,105).find(f=>f!==target&&!enemies.includes(f));
        if(chain)phase5Deal(chick,chain,24,6,.14);
      }
      addParticles(target.x,target.y,'⚡',3);return true;
    }
    case 'sniper':{
      return direct((25+level*18)*(level>=3?1.4:1),470+level*80,8,level>=3?.24:0,true);
    }
    case 'grenade':{
      if(!target)return false;
      blast(target.x,target.y,58+level*23,15+level*11,19);
      if(level>=3)phase5BurnZones.push({x:target.x,y:target.y,r:88,life:2.8,tick:0,owner:chick});
      addParticles(target.x,target.y,'✦',5);return true;
    }
    case 'hammer':
      return blast(chick.x,chick.y,65+level*20,17+level*13,29+level*11,level>=3?.27:0);
    case 'orbit':
      return blast(chick.x,chick.y,53+level*13,9+level*7,9,0);
    case 'frost':{
      if(!target)return false;
      for(const f of phase5HostileFoxes(target.x,target.y,70+level*22)){
        f.stunnedFor=Math.max(f.stunnedFor||0,level>=3?.48:.17+level*.08);
        if(level>=2)phase5Deal(chick,f,6+level*3,0);
      }
      addParticles(target.x,target.y,'❄',3);return true;
    }
    case 'pulse':{
      const enemies=phase5HostileFoxes(chick.x,chick.y,180+level*22);
      if(!enemies.length)return false;
      for(const f of enemies.slice(0,level+1))
        phase5Deal(chick,f,9+level*9,12,.24+level*.08);
      addParticles(chick.x,chick.y,'⚡',3);return true;
    }
    case 'gravity':{
      if(!target)return false;
      let moved=0;
      for(const f of phase5HostileFoxes(target.x,target.y,115+level*30)){
        const dir=normalized(target.x-f.x,target.y-f.y);
        phase4jMoveEntity(f,f.x+dir.x*(25+level*13),f.y+dir.y*(25+level*13),f.radius||14);
        if(level>=3)phase5Deal(chick,f,14,0);
        moved++;
      }
      addParticles(target.x,target.y,'◉',3);return moved>0;
    }
    case 'trap':{
      const dir=normalized(chick.x-player.x,chick.y-player.y);
      phase5Traps.push({x:chick.x+dir.x*25,y:chick.y+dir.y*25,
        radius:42+level*8,life:4+level,level,owner:chick,tick:0});
      return true;
    }
    case 'heal':{
      let healed=false;
      const targets=level===1?[chick]:chicks.filter(c=>!c.lost&&!c.atCoop&&!c.carriedBy&&Math.hypot(c.x-chick.x,c.y-chick.y)<120+level*35);
      for(const ally of targets){
        if((ally.health||0)>0&&ally.health<(ally.maxHealth||100)){
          phase5Heal(ally,level===3?18:level===2?14:11);healed=true;
        }
      }
      if(healed)addParticles(chick.x,chick.y,'+',3);
      return healed;
    }
    case 'drone':{
      const friends=[player,...chicks.filter(c=>!c.lost&&!c.atCoop&&!c.carriedBy&&(c.health||0)>0)]
        .filter(c=>Math.hypot(c.x-chick.x,c.y-chick.y)<165+level*50)
        .filter(c=>(c.health||0)<(c.maxHealth||100));
      if(!friends.length)return false;
      friends.sort((a,b)=>(a.health/a.maxHealth)-(b.health/b.maxHealth));
      phase5Heal(friends[0],10+level*12);
      addParticles(friends[0].x,friends[0].y,'+',4);return true;
    }
    case 'lure':{
      if(!target)return false;
      const dummy={x:chick.x+random(-60,60),y:chick.y+random(-60,60),
        radius:4,phase5Dummy:true,protectedFor:0,lost:false};
      phase5Decoys.push({dummy,life:2.1+level*.7,level,owner:chick});
      for(const f of phase5HostileFoxes(dummy.x,dummy.y,125+level*30)){
        if(!f.phase4gKind&&!f.carrying)f.target=dummy;
      }
      addParticles(dummy.x,dummy.y,'?',3);return true;
    }
    case 'echo':{
      const other=phase5ChickItems(chick).find(g=>g.uid!==item.uid&&PHASE5_GEAR_BY_ID[g.id].category==='火力');
      if(!target)return false;
      return direct(other?(13+level*12)*Math.max(1,other.level*.75):9+level*8,340,5,0);
    }
    case 'timeslow':{
      const enemies=phase5HostileFoxes(chick.x,chick.y,95+level*35);
      if(!enemies.length)return false;
      for(const f of enemies)f.stunnedFor=Math.max(f.stunnedFor||0,.25+level*.12);
      addParticles(chick.x,chick.y,'◷',3);return true;
    }
    case 'overdrive':{
      const allies=chicks.filter(c=>!c.lost&&!c.atCoop&&!c.carriedBy&&Math.hypot(c.x-chick.x,c.y-chick.y)<100+level*50);
      for(const ally of allies)ally.phase5OverdriveUntil=elapsed+1+level*.5;
      addParticles(chick.x,chick.y,'✦',5);return true;
    }
    default:return false; // Remaining items are on-hit/on-kill/always-on passives.
  }
}
function phase5UpdateGearCombat(dt){
  for(const decoy of phase5Decoys) {
    decoy.life-=dt;
    if(decoy.life<=0){
      decoy.dummy.lost=true;
      for(const f of foxes)if(f.target===decoy.dummy)f.target=null;
      if(decoy.level>=3)
        for(const f of phase5HostileFoxes(decoy.dummy.x,decoy.dummy.y,70))
          phase5Deal(decoy.owner,f,19,28,.12);
    }
  }
  phase5Decoys=phase5Decoys.filter(d=>d.life>0);
  for(const area of phase5BurnZones){
    area.life-=dt;area.tick-=dt;
    if(area.tick<=0){
      area.tick=.55;
      for(const f of phase5HostileFoxes(area.x,area.y,area.r))phase5Deal(area.owner,f,11,0);
    }
  }
  phase5BurnZones=phase5BurnZones.filter(a=>a.life>0);
  for(const trap of phase5Traps){
    trap.life-=dt;trap.tick-=dt;
    if(trap.tick<=0){
      trap.tick=.5;
      for(const f of phase5HostileFoxes(trap.x,trap.y,trap.radius)){
        f.stunnedFor=Math.max(f.stunnedFor||0,trap.level>=3?.46:.18);
        if(trap.level>=2)phase5Deal(trap.owner,f,7+trap.level*3,3);
      }
    }
  }
  phase5Traps=phase5Traps.filter(t=>t.life>0);
  for(const chick of chicks){
    if(chick.atCoop||chick.lost||chick.carriedBy||(chick.health||0)<=0)continue;
    for(const item of phase5ChickItems(chick)){
      const type=PHASE5_GEAR_BY_ID[item.id];
      if(type.cooldown<=0)continue;
      item.cooldown=Math.max(0,(item.cooldown||0)-dt*(chick.phase5OverdriveUntil>elapsed?1.65:1));
      if(item.cooldown>0)continue;
      if(phase5GearActive(chick,item)){
        item.cooldown=type.cooldown*(item.level>=2?.88:1);
      }
    }
  }
}
function phase5GearLootReward(event,choice){
  // This wrapper retains the original event XP/health and adds a useful item.
  if(event?.id==='chest'&&event.status==='active'){
    const type=PHASE5_GEAR[Math.floor(Math.random()*PHASE5_GEAR.length)];
    const level=choice==='risk'&&Math.random()<.3?2:1;
    phase5AddItem(type.id,level);
  }
}
const phase5BaseEventReward=phase4hReward;
phase4hReward=function phase5EventReward(event,choice=''){
  phase5GearLootReward(event,choice);
  return phase5BaseEventReward(event,choice);
};
// Original class skills are now equipment mechanisms; preserve all other
// player upgrades and mission mechanics.
const phase5MechanismSkillsBase=currentSkillDefinitions;
currentSkillDefinitions=function phase5EquipmentSkills(){
  return phase5MechanismSkillsBase().filter(skill=>!['chick-awaken','rogue-cultivation','chicken-hill'].includes(skill.id));
};
const phase5GearResetBase=resetGame;
resetGame=function resetPhase5GearCombat(){
  phase5Decoys=[];phase5BurnZones=[];phase5Traps=[];
  phase5GearResetBase();
};
const phase5GearDefeatBase=defeatFox;
defeatFox=function defeatPhase5GearFox(fox){
  const wasAlive=!fox.dead;
  phase5GearDefeatBase(fox);
  if(wasAlive&&fox.dead){
    for(const chick of chicks){
      if(chick.lost||chick.atCoop||chick.carriedBy)continue;
      for(const item of phase5ChickHas(chick,'salvager'))
        phase5.gold+=item.level;
    }
  }
};
const phase5CombatDrawBase=drawWorld;
drawWorld=function drawPhase5GearFields(){
  phase5CombatDrawBase();
  context.save();
  for(const f of phase5BurnZones){
    context.fillStyle='rgba(202,120,55,.2)';
    context.beginPath();context.arc(f.x,f.y,f.r,0,Math.PI*2);context.fill();
  }
  for(const t of phase5Traps){
    context.strokeStyle='rgba(77,127,76,.65)';context.lineWidth=3;
    context.beginPath();context.arc(t.x,t.y,t.radius,0,Math.PI*2);context.stroke();
  }
  for(const d of phase5Decoys){
    context.fillStyle='rgba(211,196,233,.5)';
    context.beginPath();context.arc(d.dummy.x,d.dummy.y,11,0,Math.PI*2);context.fill();
  }
  context.restore();
};
const phase5RadarDrawBase=draw;
draw=function drawPhase5Radar(){
  phase5RadarDrawBase();
  if(state!=='playing')return;
  let range=0;
  for(const chick of chicks){
    if(chick.lost||chick.atCoop||chick.carriedBy)continue;
    for(const item of phase5ChickHas(chick,'radar'))range=Math.max(range,350+item.level*200);
  }
  if(range<=0)return;
  const ctx=phase5Map.getContext('2d');
  ctx.fillStyle='#b55d42';
  for(const f of foxes){
    if(f.dead||f.health<=0||!f.phase4gKind||Math.hypot(f.x-player.x,f.y-player.y)>range)continue;
    const x=7+f.x/world.width*208,y=7+f.y/world.height*148;
    ctx.beginPath();ctx.moveTo(x,y-5);ctx.lineTo(x+4,y+4);ctx.lineTo(x-4,y+4);ctx.fill();
  }
};
