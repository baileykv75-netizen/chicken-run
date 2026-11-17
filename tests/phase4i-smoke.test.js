// Run with: node tests/phase4i-smoke.test.js
// Isolated smoke test of single-chick opening and simple flock growth.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname,'../src/phase4i-growth.js'),'utf8');
const hsrc = fs.readFileSync(path.join(__dirname,'../src/phase4h-events.js'),'utf8');
const fsrc = fs.readFileSync(path.join(__dirname,'../src/phase4f-director.js'),'utf8');
new Function(src);
assert.match(hsrc, /protectedFor: 0/, 'rescued chicks should not receive novice immunity');
assert.match(fsrc, /const criticalFlock = chicks.length >= 6/, 'small opening flock must not be permanently considered critical');
const element=()=>({className:'',classList:{add(){},remove(){},toggle(){}},
  setAttribute(){},textContent:'',title:''});
const document={createElement:element,querySelector(){return{appendChild(){}}}};
const ui={};
let player=null, chicks=[], state='playing', elapsed=0, experience=0, hatchNotices=0;
let chickId=10;
const args={
  CONFIG:{chickCount:10},world:{width:2400,height:1600},document,
  player:null,chicks:[],state:'playing',ui,elapsed:0,
  clamp:(x,a,b)=>Math.min(b,Math.max(a,x)),
  resetGame(){
    player={x:1100,y:850,level:1,health:100,maxHealth:100};
    chicks=Array.from({length:10},(_,id)=>({id,x:1000+id,y:850,lost:false,protectedFor:0}));
  },
  update(){},
  updateHud(){},
  phase4hCreateChick(){return{id:chickId++,x:1100,y:850,lost:false,protectedFor:0}},
  phase4hNotify(){hatchNotices++;},
  addParticles(){},playTone(){},
};
// The original game uses global lexical variables. This wrapper rebinds them
// for testing while keeping the production extension untouched.
const keys=Object.keys(args);
const runtime=new Function(...keys,src + `
  return {
    reset:resetGame,update:update,hatch:phase4iHatch,
    count:phase4iLivingCount,
    get:()=>({player,chicks,phase4i,limit:PHASE4I.maxChicks}),
    setLevel:(n)=>{player.level=n;},
    loseOne:()=>{chicks.find(c=>!c.lost).lost=true;},
  };
`)(...keys.map(k=>args[k]));
runtime.reset();
assert.equal(runtime.count(),1,'opening must contain one chick');
assert.equal(runtime.get().chicks[0].protectedFor,0,'initial chick has no immunity');
runtime.setLevel(2);runtime.update(.016);
assert.equal(runtime.count(),1,'do not hatch before first level threshold');
runtime.setLevel(3);runtime.update(.016);
assert.equal(runtime.count(),2,'first hatch at level 3');
assert.equal(runtime.get().chicks[1].protectedFor,0,'hatchling has no new protection');
runtime.setLevel(9);runtime.update(.016);
assert.equal(runtime.count(),4,'milestones 3, 6, 9 hatch once each');
runtime.loseOne();assert.equal(runtime.count(),3);
runtime.setLevel(30);runtime.update(.016);
assert.ok(runtime.count()<=10,'flock maximum');
assert.equal(runtime.get().phase4i.nextHatchLevel,33);
runtime.reset();
assert.equal(runtime.count(),1,'new run resets flock to one');
assert.equal(runtime.get().phase4i.nextHatchLevel,3,'new run resets milestones');
console.log('Phase 4I smoke tests passed: one-chick opening, no immunity, hatching, max, reset.');
