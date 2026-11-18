// Phase 4L: lightweight Canvas 2D adaptations of patch-gg/pixelfx recipes.
// Source concepts: melee/sword-slash, melee/thrust, melee/hammer-smash,
// impacts/hit-spark, impacts/blunt-hit, impacts/bullet-impact,
// spawn-and-death/poof and spawn-and-death/egg-hatch.
// MIT licensed upstream: https://github.com/patch-gg/pixelfx
// This is a Canvas-oriented adaptation, not a bundled copy of pixelfx's runtime.
// Crucial: visual-only changes; NO health, timing, damage, hitbox or attack modifications.
const PHASE4L = Object.freeze({
  desktopCap: 58, mobileCap: 24, lowFxCap: 15,
  palettes: {
    sword: ['#c5d9d7','#e4e3ce','#f7eaca'],
    spear: ['#8bb9ad','#c8ded1','#f3eed8'],
    hammer: ['#aa9584','#d3b89b','#efe0bd'],
    gun: ['#bf9976','#e3c69b','#f6e1ae'],
    hit: ['#c09f83','#e6c7aa','#fff0c9'],
    death: ['#a8a99c','#c9c6b5','#eee1c5'],
    hatch: ['#d1b78a','#f6dda1','#fff0d1'],
    danger: ['#9f6d66','#bb8277','#e2b9a0'],
  },
});
let phase4lEffects = [];
let phase4lSerial = 0;
let phase4lPrevEgg = null;
let phase4lPrevGrabbed = new Set();
function phase4lQualityCap() {
  if (typeof stage4cLowFxMode !== 'undefined' && stage4cLowFxMode) return PHASE4L.lowFxCap;
  if (typeof isTouchDevice === 'function' && isTouchDevice()) return PHASE4L.mobileCap;
  return PHASE4L.desktopCap;
}
function phase4lVisible(x,y,margin=150) {
  if (typeof stage4cVisiblePoint === 'function') return stage4cVisiblePoint(x,y,margin);
  return player && Math.abs(x-camera.x)<width/(2*camera.zoom)+margin
    && Math.abs(y-camera.y)<height/(2*camera.zoom)+margin;
}
function phase4lEmit(kind,x,y,options={}) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !phase4lVisible(x,y)) return false;
  const cap=phase4lQualityCap();
  if (phase4lEffects.length>=cap) phase4lEffects.shift();
  const duration=kind==='slam'?.37:kind==='hatch'?.62:kind==='death'?.46:
    kind==='warning'?.4:kind==='shot'?.18:kind==='spear'?.26:.24;
  const intensity=typeof stage4cLowFxMode !== 'undefined' && stage4cLowFxMode?.68:1;
  phase4lEffects.push({kind,x,y,duration,age:0,angle:options.angle||0,
    radius:Math.max(8,Math.min(options.radius||35,150)),intensity,
    seed:++phase4lSerial,angleOffset:(phase4lSerial%2?1:-1)*.1});
  return true;
}
function phase4lArc(ctx,r,a0,a1,color,lineWidth,alpha) {
  if(alpha<=0)return;
  ctx.globalAlpha=alpha;ctx.strokeStyle=color;ctx.lineWidth=lineWidth;
  ctx.lineCap='round';ctx.beginPath();ctx.arc(0,0,r,a0,a1);ctx.stroke();
}
function phase4lBurst(ctx,e,colors,amount,radius,t,spread=Math.PI*2,angle=0) {
  for(let i=0;i<amount;i++){
    // Deterministic seeded spokes, no per-frame random flicker.
    const seed=((i*37+e.seed*17)%113)/113;
    const a=angle+(seed-.5)*spread;
    const distance=radius*(.2+.8*t)*(0.7+((i*13)%7)/20);
    const x=Math.cos(a)*distance,y=Math.sin(a)*distance*.67;
    const len=(2.5+(i%3)*1.8)*(1-t);
    ctx.globalAlpha=(1-t)*e.intensity*.75;
    ctx.strokeStyle=colors[i%colors.length];ctx.lineWidth=i%4===0?2.3:1.5;
    ctx.beginPath();ctx.moveTo(x,y);
    ctx.lineTo(x+Math.cos(a)*len,y+Math.sin(a)*len);ctx.stroke();
  }
}
function phase4lDrawEffect(e) {
  const t=Math.min(1,e.age/e.duration);
  const pal=PHASE4L.palettes[e.kind==='slash'?'sword':
    e.kind==='spear'?'spear':e.kind==='slam'?'hammer':
    e.kind==='shot'?'gun':e.kind==='death'?'death':
    e.kind==='hatch'?'hatch':e.kind==='warning'?'danger':'hit'];
  context.save();context.translate(e.x,e.y);
  const fade=(1-t)*e.intensity;
  if(e.kind==='slash'){
    // pixelfx sword-slash: head sweeps rapidly, rim lingers and cools.
    context.rotate(e.angle);
    const start=-1.38,head=Math.min(1,t/.36)*2.8,tail=Math.max(0,t-.17)/.83*2.8;
    const r=e.radius*.86;
    if(head>tail){
      phase4lArc(context,r,start+tail,start+head,pal[0],8*(1-t*.65),fade*.28);
      phase4lArc(context,r,start+tail,start+head,pal[2],3.2*(1-t*.6),fade*.83);
    }
    if(t<.65)phase4lBurst(context,e,pal,5,r*.8,t,1.5,start+head);
  }else if(e.kind==='spear'){
    context.rotate(e.angle);
    const len=e.radius*(.35+1.45*Math.min(1,t/.5));
    context.globalAlpha=fade*.85;context.strokeStyle=pal[2];
    context.lineWidth=4*(1-t*.7);context.lineCap='round';
    context.beginPath();context.moveTo(5,0);context.lineTo(len,0);context.stroke();
    context.strokeStyle=pal[0];context.lineWidth=1.4;
    context.beginPath();context.moveTo(10,5);context.lineTo(len*.93,5);context.stroke();
    phase4lBurst(context,e,pal,5,Math.min(70,len),t,1.3,0);
  }else if(e.kind==='slam'){
    // pixelfx hammer-smash/ground-slam: quick shock ring with heavy dust.
    const radius=e.radius*(.12+.92*Math.sqrt(t));
    context.save();context.scale(1,.49);
    phase4lArc(context,radius,0,Math.PI*2,pal[1],8*(1-t),fade*.65);
    phase4lArc(context,radius*.78,0,Math.PI*2,pal[2],2.8,fade*.65);
    context.restore();
    phase4lBurst(context,e,pal,12,e.radius*.8,t);
  }else if(e.kind==='hit'||e.kind==='shot'){
    // pixelfx hit-spark / bullet-impact: short bright core + tapered debris.
    const radius=e.radius*(.28+.9*t);
    phase4lBurst(context,e,pal,e.kind==='shot'?9:6,radius,t,
      e.kind==='shot'?Math.PI*1.6:Math.PI*2,e.angle+Math.PI);
    context.globalAlpha=fade*.85;context.fillStyle=pal[2];context.beginPath();
    context.ellipse(0,0,Math.max(.4,5*(1-t)),Math.max(.4,3*(1-t)),0,0,Math.PI*2);context.fill();
  }else if(e.kind==='death'){
    // pixelfx poof: drifting soft fragments, no animated character substitution.
    for(let i=0;i<9;i++){
      const a=(i/9)*Math.PI*2+e.seed*.4,r=e.radius*(.2+.75*t)*(i%3===0?.8:1);
      const x=Math.cos(a)*r,y=Math.sin(a)*r*.58-9*t;
      context.globalAlpha=fade*.6;context.fillStyle=pal[i%pal.length];
      context.beginPath();context.arc(x,y,2.5+(i%3)*1.3,0,Math.PI*2);context.fill();
    }
  }else if(e.kind==='hatch'){
    // pixelfx egg-hatch: outward pale shell-light and small rising flecks.
    context.save();context.scale(1,.67);
    phase4lArc(context,e.radius*(.3+.9*t),0,Math.PI*2,pal[1],4*(1-t)+.8,fade*.65);
    context.restore();
    phase4lBurst(context,e,pal,9,e.radius,t);
  }else if(e.kind==='warning'){
    const radius=e.radius*(.82+.17*Math.sin(t*Math.PI));
    context.save();context.scale(1,.65);
    phase4lArc(context,radius,0,Math.PI*2,pal[1],2.2,fade*.6);
    context.restore();
  }
  context.restore();
}
const phase4lBaseUpdateEffects=updateEffects;
updateEffects=function phase4lUpdateEffects(dt) {
  phase4lBaseUpdateEffects(dt);
  for(const e of phase4lEffects)e.age+=dt;
  phase4lEffects=phase4lEffects.filter(e=>e.age<e.duration);
  // The original gameplay logic is unaffected by this visual state inspection.
  if (!player || state!=='playing') return;
  const carrier=typeof phase4i!=='undefined' ? phase4i?.egg?.carrier : null;
  if(phase4lPrevEgg && !phase4i?.egg && phase4i?.deliveries>phase4lPrevEgg.deliveries){
    const coop=phase4iCoop();phase4lEmit('hatch',coop.x,coop.y,{radius:46});
  }
  phase4lPrevEgg=typeof phase4i!=='undefined'?{
    deliveries:phase4i?.deliveries||0,carrier:carrier?.id||null}:null;
  const nowGrabbed=new Set();
  for(const chick of chicks) {
    if(!chick.lost&&chick.carriedBy){
      nowGrabbed.add(chick.id);
      if(!phase4lPrevGrabbed.has(chick.id))
        phase4lEmit('warning',chick.x,chick.y,{radius:28});
    }
  }
  phase4lPrevGrabbed=nowGrabbed;
};
const phase4lBaseDamageFox=damageFox;
damageFox=function phase4lDamageFox(fox,amount,direction,knockback,stun=0){
  const before=fox?.health;
  phase4lBaseDamageFox(fox,amount,direction,knockback,stun);
  if(Number.isFinite(before)&&fox.health<before){
    const gun=!!player?.gunMode;
    phase4lEmit(gun?'shot':'hit',fox.x,fox.y,{
      radius:gun?21:Math.min(36,20+(fox.radius||14)*.35),
      angle:direction?Math.atan2(direction.y,direction.x):0});
  }
};
const phase4lBaseDefeatFox=defeatFox;
defeatFox=function phase4lDefeatFox(fox){
  const wasAlive=fox&&!fox.dead&&fox.health<=0;
  phase4lBaseDefeatFox(fox);
  if(wasAlive&&fox.dead)phase4lEmit('death',fox.x,fox.y,
    {radius:fox.phase4gKind==='boss'?65:fox.type==='brute'?44:29});
};
const phase4lBaseWeaponAttack=performWeaponAttack;
performWeaponAttack=function phase4lWeaponAttack(){
  const ok=phase4lBaseWeaponAttack();
  if(ok&&player&&state==='playing'){
    const d=player.facing||{x:1,y:0},a=Math.atan2(d.y,d.x);
    if(player.gunMode) {
      const gun=player.gunArchetype||'revolver';
      phase4lEmit('shot',player.x+d.x*23,player.y+d.y*23,
        {angle:a,radius:gun==='shotgun'?34:23});
    }else if(player.weapon==='sword'){
      phase4lEmit('slash',player.x+d.x*18,player.y+d.y*18,{angle:a,radius:Math.min(84,player.attackRange*.72)});
    }else if(player.weapon==='spear'){
      phase4lEmit('spear',player.x+d.x*20,player.y+d.y*20,{angle:a,radius:48});
    }
    // Hammer impact is attached to resolveHammerAttack, not the wind-up.
  }
  return ok;
};
const phase4lBaseHammerResolve=resolveHammerAttack;
resolveHammerAttack=function phase4lHammerImpact(){
  const d=player?.hammerDirection||player?.facing||{x:1,y:0};
  const x=player.x+d.x*Math.min(44,player.attackRange*.38);
  const y=player.y+d.y*Math.min(44,player.attackRange*.38);
  phase4lBaseHammerResolve();
  phase4lEmit('slam',x,y,{radius:Math.min(135,player.slamRadius||95)});
};
const phase4lBaseDrawWorld=drawWorld;
drawWorld=function phase4lDrawWorld(){
  phase4lBaseDrawWorld();
  // Existing boss telegraph shapes stay intact; a restrained pulse reinforces
  // the dangerous wind-up without inventing a new mechanic.
  for(const fox of foxes){
    if(!fox.phase4gKind || fox.dead || !phase4lVisible(fox.x,fox.y,160))continue;
    if(!['chargeTell','swipeTell','windup'].includes(fox.phase4gMode))continue;
    context.save();
    context.translate(fox.x,fox.y);
    const pulse=.4+.3*Math.sin(elapsed*11)**2;
    const r=fox.phase4gKind==='boss'?Math.min(90,(fox.radius||35)*2.3):38;
    context.globalAlpha=pulse;
    context.strokeStyle=PHASE4L.palettes.danger[1];
    context.lineWidth=2;context.setLineDash([7,9]);
    context.beginPath();context.arc(0,0,r,0,Math.PI*2);context.stroke();
    context.setLineDash([]);context.restore();
  }
  for(const effect of phase4lEffects){
    if(phase4lVisible(effect.x,effect.y,160))phase4lDrawEffect(effect);
  }
};
const phase4lBaseReset=resetGame;
resetGame=function phase4lReset(){
  phase4lEffects=[];phase4lPrevEgg=null;
  phase4lPrevGrabbed=new Set();phase4lSerial=0;
  phase4lBaseReset();
};
