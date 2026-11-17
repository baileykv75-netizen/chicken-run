// Run: node tests/phase4i-smoke.test.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const growth = fs.readFileSync(path.join(root, 'src/phase4i-growth.js'), 'utf8');
const events = fs.readFileSync(path.join(root, 'src/phase4h-events.js'), 'utf8');
const director = fs.readFileSync(path.join(root, 'src/phase4f-director.js'), 'utf8');
new Function(growth);
assert.match(events, /protectedFor: 0/, 'rescued chicks must not have novice immunity');
assert.match(director, /const criticalFlock = chicks.length >= 6/, 'solo opening must not trigger permanent safety');

// The sandbox mimics the script-global variables of the browser game.
const node = () => ({ className: '', classList: {add(){},remove(){},toggle(){}},
  setAttribute(){},textContent:'',title:'' });
const scene = {
  CONFIG:{chickCount:10}, world:{width:2400,height:1600}, player:null,
  chicks:[], state:'playing', elapsed:0, document:{
    createElement:node,querySelector:()=>({appendChild(){}}),
  },
  clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),update(){},updateHud(){},
  phase4hCreateChick:()=>({
    id:scene.nextId++,x:1100,y:850,radius:10,lost:false,protectedFor:0,
  }),
  phase4hNotify(){},addParticles(){},playTone(){},
  nextId:10,
};
scene.resetGame = function originalReset() {
  scene.player = { x:1100,y:850,level:1,health:100,maxHealth:100 };
  scene.chicks = Array.from({length:10}, (_,id)=>({
    id,x:1000+id,y:850,radius:10,lost:false,protectedFor:0,
  }));
};
vm.createContext(scene);
vm.runInContext(growth, scene, {filename:'phase4i-growth.js'});
const count = () => vm.runInContext('phase4iLivingCount()',scene);
const nextLevel = () => vm.runInContext('phase4i.nextHatchLevel',scene);
scene.resetGame();
assert.equal(count(),1,'starts with exactly one chick');
assert.equal(scene.chicks[0].protectedFor,0,'initial chick is never immune');
scene.player.level=2;scene.update(.016);
assert.equal(count(),1,'no hatch at level 2');
scene.player.level=3;scene.update(.016);
assert.equal(count(),2,'first hatch at level 3');
assert.equal(scene.chicks[1].protectedFor,0,'hatchling is not immune');
scene.player.level=9;scene.update(.016);
assert.equal(count(),4,'exactly three milestone hatches through level 9');
scene.chicks[0].lost=true;
assert.equal(count(),3,'lost chicks excluded from living total');
scene.player.level=30;scene.update(.016);
assert.ok(count()<=10,'never exceeds max flock size');
assert.equal(nextLevel(),33,'milestones are not silently repeated');
scene.resetGame();
assert.equal(count(),1,'restart resets to one chick');
assert.equal(nextLevel(),3,'restart resets hatch progression');
console.log('Phase 4I tests passed: start, no protection, hatching, cap, restart.');
