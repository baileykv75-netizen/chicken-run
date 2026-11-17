// Run: node tests/phase4j-smoke.test.js
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const terrainSource=fs.readFileSync(path.join(root,'src/phase4j-terrain.js'),'utf8');
const loopSource=fs.readFileSync(path.join(root,'src/phase4a-loop.js'),'utf8');
const bossSource=fs.readFileSync(path.join(root,'src/phase4g-enemies-boss.js'),'utf8');
const eventsSource=fs.readFileSync(path.join(root,'src/phase4h-events.js'),'utf8');
new Function(terrainSource);
assert.match(loopSource,/phase4jMoveEntity\(player/,'player must use terrain-aware movement');
assert.match(loopSource,/phase4jSteer\(fox/,'normal foxes must steer around obstacles');
assert.match(bossSource,/phase4jMoveEntity\(fox/,'boss dashes must obey terrain collision');
assert.match(eventsSource,/phase4jFindObjective\(event.x/,'event guards must spawn in free space');
const noOp=()=>{};
const context={
  Math,Uint8Array,Int32Array,
  world:{width:2500,height:1700},width:1000,height:650,
  camera:{x:1250,y:850,zoom:1},player:{x:1250,y:850,radius:18},
  chicks:[],foxes:[],state:'playing',elapsed:60,
  clamp:(n,a,b)=>Math.max(a,Math.min(b,n)),
  resetGame(){},spawnPointNearCamera(){return{x:1475,y:920};},
  phase4hLocation(){return{x:1400,y:900};},
  phase4iSpawnEgg(){return false;}, phase4i:null,
  damageFox(fox,amount){fox.health-=amount;},
  update(){},drawBackground(){},drawWorld(){},drawFox(){},
  context:new Proxy({}, {get(target,key){return key in target?target[key]:noOp;}}),
};
vm.createContext(context);
vm.runInContext(terrainSource,context,{filename:'phase4j-terrain.js'});
const go=(js)=>vm.runInContext(js,context);
context.resetGame();
assert.ok(go('phase4j.solids.length')>=15,'solid rocks/logs should be generated');
assert.ok(go('phase4j.mud.length')>=10,'mud patches should exist');
assert.ok(go('phase4j.bushes.length')>=10,'bush patches should exist');
assert.equal(go('phase4jNavBuild().ok'),true,'map should be connected');
assert.equal(go('phase4jClear(world.width/2,world.height/2,18)'),true,'spawn clearing');
assert.equal(go('phase4jClear(world.width*.18,world.height*.22,105)'),true,'coop clearing');
// Construct a predictable obstacle for collision and line-of-sight tests.
go('phase4j.solids=[{kind:"rock",x:700,y:700,r:43}]');
const actor={x:620,y:700,radius:14};
context.actor=actor;
go('phase4jMoveEntity(actor,800,700,14)');
assert.ok(actor.x<=644 && actor.x>=620,'actor cannot travel through a rock');
assert.equal(go('phase4jLineClear(620,700,800,700,5)'),false,'rock blocks attacks');
assert.equal(go('phase4jLineClear(620,600,800,600,5)'),true,'open shots remain valid');
assert.equal(go('phase4jClear(700,700,12)'),false,'rock has solid geometry');
assert.equal(go('phase4jClear(620,700,12)'),true);
// Mud reduces travel speed but does not block a route.
go('phase4j.solids=[];phase4j.mud=[{x:1200,y:800,rx:120,ry:90}]');
const mudActor={x:1200,y:800};context.mudActor=mudActor;
go('phase4jMoveEntity(mudActor,1300,800,14)');
assert.ok(mudActor.x>1278&&mudActor.x<1282,'mud should slow movement by 20%');
assert.equal(go('phase4jClear(1250,800,14)'),true,'mud must be passable');
// Objective placement should never lie inside rocks.
go('phase4j.solids=[{kind:"rock",x:1400,y:900,r:55}]');
const objective=go('phase4jFindObjective(1400,900,35)');
context.objective=objective;
assert.equal(go('phase4jClear(objective.x,objective.y,35)'),true,'event objectives must be placed safely');
console.log('Phase 4J tests passed: generator, topology, collision, projectile cover, mud, objectives.');
