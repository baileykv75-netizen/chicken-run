// Run locally with: node tests/phase4h-smoke.test.js
// A lightweight isolated test for event lifecycle, rewards, and boss coordination.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'phase4h-events.js'), 'utf8');
new Function(source); // syntax parse
function element() {
  return { classList: { add(){}, remove(){}, toggle(){} }, style: {}, dataset: {},
    setAttribute(){}, append(){}, addEventListener(event, listener){ this.handler=listener; },
    querySelector(){ return {style:{}}; }, textContent: '', innerHTML: '' };
}
const world = { width: 2400, height: 1600 };
const player = { x: 500, y: 500, health: 70, maxHealth: 100 };
const chicks = Array.from({length: 10}, (_,i) => ({id:i,x:510,y:500,protectedFor:0,lost:false,carriedBy:null}));
let xp = 0, bossSpawns = 0, spawnCount=0;
const foxes = [];
const phase4g = { boss: null, suppressElite: false, nextBossAt: 180 };
const scope = {
  CONFIG: { chickCount: 10 }, world, player, chicks, foxes, phase4g,
  state: 'playing', elapsed:45, dangerLevel: 1, ui: {waveNotice:element()},
  document: {createElement:element,querySelector:element},
  context: {save(){},restore(){},translate(){},scale(){},beginPath(){},arc(){},fill(){},stroke(){},fillText(){}},
  currentFoxLimit:()=>20,
  clamp:(v,a,b)=>Math.min(b,Math.max(a,v)),
  spawnFox:(type)=>{
    spawnCount++;
    if (foxes.length>=20)return false;
    foxes.push({x:700,y:700,dead:false,health:90,maxHealth:90,xp:1,stunnedFor:0,type});
    return true;
  },
  gainExperience:(amount)=>{xp += amount;},
  phase4gAlive:(fox)=>!!fox && !fox.dead && fox.health>0,
  phase4gSpawnBoss:()=>{bossSpawns++;},
  nearestWorldEdgeVector:()=>({x:1,y:0}),
  defeatFox:(fox)=>{fox.health=0;fox.dead=true;},
  updateFoxes:()=>{},update:()=>{},resetGame:()=>{},updateHud:()=>{},drawWorld:()=>{},
};
const keys = Object.keys(scope);
function init() {
  return new Function(...keys, source + `
    return { get:()=>phase4h, spawn:phase4hSpawn, updateEvent:phase4hUpdate,
      reward:phase4hReward, expire:phase4hExpire, reset:phase4hReset,
      boss:phase4gSpawnBoss, chestGuards:phase4hSpawnChestGuards,
      kill:defeatFox, foxUpdate:updateFoxes, pick:phase4hNextType };
  `)(...keys.map(key=>scope[key]));
}
const events = init();
const seen = [];
for(let i=0;i<5;i++){
  events.spawn();
  const current=events.get().event;
  assert.ok(current,'event should be created');
  seen.push(current.id);
  if(current.id==='lost') {
    chicks[0].lost=true;
    events.reward(current);
    assert.equal(chicks.filter(c=>!c.lost).length,10,'replenish a lost chick');
  } else if(current.id==='chest') {
    assert.equal(events.get().event?.id, 'chest');
    const before=foxes.length;
    events.chestGuards(current);
    assert.ok(foxes.length>=before && foxes.length<=20);
    events.expire();
  } else if(current.id==='thief') {
    assert.ok(current.target?.phase4hThief);
    const victim=current.target;
    events.expire();
    assert.equal(victim.dead,true,'expired thief must be removed without XP');
  } else events.expire();
}
assert.deepEqual(new Set(seen),new Set(['lost','supply','thief','shelter','chest']),'shuffle bag covers all types');
assert.equal(events.get().stats.success,1);
assert.equal(events.get().stats.expired,4);
events.reset();
assert.equal(events.get().event,null);
assert.equal(events.get().serial,0);

// Event clock remains frozen while boss is active.
events.spawn();
const event=events.get().event;
const remaining=event.remaining;
phase4g.boss={health:500,dead:false};
events.updateEvent(1);
assert.equal(event.remaining,remaining);
const nextAt=events.get().nextAt;
assert.ok(nextAt>45);
phase4g.boss=null;

// Defer scheduled bosses while an active event remains.
events.boss();
assert.equal(bossSpawns,0);
assert.ok(phase4g.nextBossAt>scope.elapsed);

// A full group gets an alternative award instead of an 11th chick.
events.reset();
const full = {id:'lost',status:'active',name:'迷路的小鸡'};
events.reward(full);
assert.ok(xp>0);
assert.equal(chicks.filter(c=>!c.lost).length,10);

console.log('Phase 4H smoke tests passed: shuffle, rewards, expiry, reset, boss coordination');
