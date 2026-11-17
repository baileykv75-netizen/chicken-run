// Run: node tests/phase4i-smoke.test.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/phase4i-growth.js'), 'utf8');
const rescue = fs.readFileSync(path.join(root, 'src/phase4h-events.js'), 'utf8');
new Function(source);
assert.match(rescue, /protectedFor: 0/, 'rescued chicks have no novice immunity');
const node = () => ({ className:'',classList:{add(){},remove(){},toggle(){}},
  setAttribute(){}, textContent:'',title:'' });
let id = 10;
const scene = {
  CONFIG:{chickCount:10}, world:{width:2500,height:1700},
  elapsed:0,player:null,chicks:[],state:'playing',eventActive:false,
  document:{createElement:node,querySelector:()=>({appendChild(){}})},
  clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
  phase4hCreateChick:()=>({id:id++,x:1100,y:850,protectedFor:0,lost:false,carriedBy:null}),
  phase4hNotify(){},phase4hActive:()=>scene.eventActive,
  phase4g:{boss:null},phase4gAlive:(f)=>!!f&&!f.dead&&f.health>0,
  addParticles(){},playTone(){},
  update(){},updateHud(){},drawWorld(){},context:{save(){},restore(){},translate(){},rotate(){},fill(){},stroke(){},
    beginPath(){},arc(){},ellipse(){},fillText(){},scale(){}},
};
scene.resetGame=()=>{
  scene.player={x:1250,y:850,level:1,maxHealth:100,health:100};
  scene.chicks=Array.from({length:10},(_,i)=>({
    id:i,x:1250+i*5,y:850,lost:false,carriedBy:null,protectedFor:0,
  }));
  scene.elapsed=0;
};
vm.createContext(scene);
vm.runInContext(source,scene,{filename:'phase4i-growth.js'});
const run=(expression)=>vm.runInContext(expression,scene);
const count=()=>run('phase4iLivingCount()');
const egg=()=>run('phase4i.egg');
const timer=()=>run('phase4i.nextEggAt');

scene.resetGame();
assert.equal(count(),1,'only one chick at the beginning');
assert.equal(scene.chicks[0].protectedFor,0,'no novice protection');
scene.player.level=20;scene.update(0.016);
assert.equal(count(),1,'leveling alone must not hatch chicks');
assert.equal(timer(),75,'first egg arrives after 75 game seconds');
scene.elapsed=75;
scene.eventActive=true;scene.update(.016);
assert.equal(egg(),null,'active random event defers egg spawn');
scene.eventActive=false;
scene.phase4g.boss={health:50,dead:false};scene.update(.016);
assert.equal(egg(),null,'boss battle defers egg spawn');
scene.phase4g.boss=null;scene.elapsed=76;scene.update(.016);
assert.equal(egg().status,'ground','egg appears once other objectives end');
const ground=egg();
scene.chicks[0].x=ground.x;scene.chicks[0].y=ground.y;
scene.update(.016);
assert.equal(egg().status,'carried','nearby vulnerable chick picks up egg');
assert.equal(egg().carrier,scene.chicks[0]);
const coop=run('phase4iCoop()');
scene.chicks[0].x=coop.x;scene.chicks[0].y=coop.y;
scene.update(.016);
assert.equal(count(),2,'delivering to existing coop hatches exactly one chick');
assert.equal(egg(),null);
assert.ok(timer()>=166&&timer()<=196,'new egg delay is 90-120 seconds');

// Egg is lost only after abducted chicken is actually lost, not when grabbed.
scene.elapsed=timer();scene.update(.016);
assert.equal(egg().status,'ground');
scene.chicks[0].x=egg().x;scene.chicks[0].y=egg().y;
scene.update(.016);
assert.equal(egg().status,'carried');
scene.chicks[0].carriedBy={x:1400,y:800};
scene.update(.016);
assert.equal(egg().status,'carried','egg remains recoverable while grabbed');
scene.chicks[0].carriedBy=null;
scene.update(.016);
assert.equal(egg().status,'carried','fox defeated: egg remains on rescued chick');
scene.chicks[0].lost=true;
scene.update(.016);
assert.equal(egg(),null,'abducted carrier lost: egg lost as well');
assert.equal(count(),1,'carrier itself is also lost');
assert.equal(run('phase4i.lostEggs'),1,'double-loss counted');

// Ground eggs time out; a maxed flock stops spawns.
scene.elapsed=timer();scene.update(.016);
assert.equal(egg().status,'ground');
scene.update(51);
assert.equal(egg(),null,'uncollected ground egg expires');
assert.equal(run('phase4i.expiredEggs'),1);
scene.chicks.push(...Array.from({length:9},(_,n)=>({id:50+n,x:1000,y:800,lost:false,protectedFor:0})));
scene.elapsed=timer()+20;scene.update(.016);
assert.equal(egg(),null,'full flock suppresses eggs');
scene.resetGame();
assert.equal(count(),1,'restart restores single-chick opening');
assert.equal(egg(),null,'restart clears any egg');
assert.equal(timer(),75,'restart resets egg schedule');
console.log('Phase 4I egg escort tests passed: spawn, pickup, delivery, loss, timeout, cap and restart.');
