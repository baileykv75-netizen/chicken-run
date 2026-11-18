// Run: node tests/phase4l-smoke.test.js
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'src/phase4l-effects.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
new Function(source);
assert.ok(html.includes('src/phase4l-effects.js'),'Phase 4L must load after terrain');
const noop=()=>{};
let currentState='playing';
const mock={
  console,Math,Set,
  state:'playing',player:{x:500,y:500,weapon:'sword',gunMode:false,attackRange:70,slamRadius:110,
    hammerDirection:{x:1,y:0},facing:{x:1,y:0}},chicks:[],foxes:[],elapsed:10,
  camera:{x:500,y:500,zoom:1},width:1000,height:700,particles:[],cameraShake:0,
  stage4cLowFxMode:false,isTouchDevice:()=>false,
  stage4cVisiblePoint:(x,y)=>Math.abs(x-500)<650&&Math.abs(y-500)<500,
  phase4i:{egg:null,deliveries:0},phase4iCoop:()=>({x:200,y:200}),
  updateEffects:noop,drawWorld:noop,resetGame:noop,
  performWeaponAttack:()=>true,resolveHammerAttack:noop,
  damageFox:(fox,amount)=>{fox.health-=amount;},
  defeatFox:(fox)=>{fox.dead=true;fox.health=0;},
  context:new Proxy({save:noop,restore:noop}, {
    get(target,key){return target[key]||noop;},
    set(target,key,value){target[key]=value;return true;},
  }),
};
vm.createContext(mock);vm.runInContext(source,mock,{filename:'phase4l-effects.js'});
const run=(script)=>vm.runInContext(script,mock);
const count=()=>run('phase4lEffects.length');
assert.equal(count(),0);
mock.performWeaponAttack();
assert.equal(count(),1,'successful sword attack generates one slash effect');
assert.equal(run('phase4lEffects[0].kind'),'slash');
mock.player.weapon='spear';mock.performWeaponAttack();
assert.equal(run('phase4lEffects[1].kind'),'spear');
mock.player.gunMode=true;mock.performWeaponAttack();
assert.equal(run('phase4lEffects[2].kind'),'shot');
mock.player.gunMode=false;
const fox={x:520,y:510,health:100,dead:false,radius:14};mock.foxes=[fox];
mock.damageFox(fox,21,{x:1,y:0},12,0);
assert.equal(fox.health,79,'damage number remains original');
assert.equal(run('phase4lEffects[3].kind'),'hit');
mock.damageFox(fox,0,{x:1,y:0},12,0);
assert.equal(count(),4,'zero damage does not produce a hit effect');
fox.health=0;mock.defeatFox(fox);
assert.equal(run('phase4lEffects[4].kind'),'death');
mock.resolveHammerAttack();
assert.equal(run('phase4lEffects[5].kind'),'slam');
mock.updateEffects(1);
assert.equal(count(),0,'visual effects expire during normal updates');
mock.player.weapon='sword';mock.player.gunMode=false;
for(let i=0;i<100;i++)mock.performWeaponAttack();
assert.ok(count()<=58,'active effects obey desktop cap');
mock.resetGame();
assert.equal(count(),0,'restart clears all visual effects');
assert.equal(mock.player.attackRange,70,'combat parameters are not adjusted');
console.log('Phase 4L smoke passed: sword/spear/gun/hammer, damage/death, expiry, cap, restart.');
