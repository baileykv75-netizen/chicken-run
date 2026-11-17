// Phase 4J: static rocks, fallen logs, mud and see-through shrubs.
// No trees, destruction, combat towers or new weapons.
const PHASE4J = Object.freeze({
  cell: 65, rockCount: 17, logCount: 11, mudCount: 13, bushCount: 19,
  mudSpeed: 0.80, clearCoop: 168, clearSpawn: 174,
});
let phase4j = { solids:[], mud:[], bushes:[], cols:0, rows:0, reachable:null };
function phase4jDistSq(x,y,x2,y2) { return (x-x2)**2+(y-y2)**2; }
function phase4jNearestOnLog(x,y,o) {
  const dx=o.bx-o.ax,dy=o.by-o.ay;
  const t=clamp(((x-o.ax)*dx+(y-o.ay)*dy)/Math.max(1,dx*dx+dy*dy),0,1);
  return {x:o.ax+dx*t,y:o.ay+dy*t};
}
function phase4jHits(o,x,y,r=0) {
  if(o.kind==='rock')return phase4jDistSq(x,y,o.x,o.y)<(o.r+r)**2;
  const near=phase4jNearestOnLog(x,y,o);
  return phase4jDistSq(x,y,near.x,near.y)<(o.r+r)**2;
}
function phase4jClear(x,y,r=14) {
  if(x<r || x>world.width-r || y<r || y>world.height-r)return false;
  for(const o of phase4j.solids)if(phase4jHits(o,x,y,r))return false;
  return true;
}
function phase4jNearestFree(x,y,r=20) {
  if(phase4jClear(x,y,r))return{x,y};
  for(let d=30;d<=240;d+=30){
    for(let k=0;k<16;k++){
      const a=2*Math.PI*k/16,xx=clamp(x+Math.cos(a)*d,r,world.width-r);
      const yy=clamp(y+Math.sin(a)*d,r,world.height-r);
      if(phase4jClear(xx,yy,r))return{x:xx,y:yy};
    }
  }
  return {x:world.width/2,y:world.height/2};
}
function phase4jMudAt(x,y) {
  for(const o of phase4j.mud)
    if(((x-o.x)/o.rx)**2+((y-o.y)/o.ry)**2<1)return true;
  return false;
}
function phase4jBushAt(x,y) {
  return phase4j.bushes.some(o=>phase4jDistSq(x,y,o.x,o.y)<o.r**2);
}
function phase4jMoveEntity(entity, nextX,nextY,r=14) {
  if(!entity || !Number.isFinite(nextX+nextY))return false;
  const startX=entity.x,startY=entity.y;
  const factor=phase4jMudAt(startX,startY)?PHASE4J.mudSpeed:1;
  const dx=(nextX-startX)*factor,dy=(nextY-startY)*factor;
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/10));
  let blocked=false;
  for(let i=0;i<steps;i++){
    const xx=clamp(entity.x+dx/steps,r,world.width-r);
    const yy=clamp(entity.y+dy/steps,r,world.height-r);
    if(phase4jClear(xx,yy,r)){entity.x=xx;entity.y=yy;continue;}
    // Sliding along each axis prevents sticky corners.
    let moved=false;
    if(phase4jClear(xx,entity.y,r)){entity.x=xx;moved=true;}
    if(phase4jClear(entity.x,yy,r)){entity.y=yy;moved=true;}
    if(!moved)blocked=true;
  }
  return !blocked;
}
function phase4jSteer(entity,tx,ty) {
  const dx=tx-entity.x,dy=ty-entity.y,d=Math.hypot(dx,dy);
  if(d<1)return{x:0,y:0};
  const direct={x:dx/d,y:dy/d},r=(entity.radius||14)+2;
  if(phase4jLineClear(entity.x,entity.y,tx,ty,r)) {
    entity.phase4jWaypoint=null;
    return direct;
  }
  const waypoint=entity.phase4jWaypoint;
  if(waypoint && Math.hypot(waypoint.x-entity.x,waypoint.y-entity.y)>14
     && phase4jLineClear(entity.x,entity.y,waypoint.x,waypoint.y,r)) {
    const angle=Math.atan2(waypoint.y-entity.y,waypoint.x-entity.x);
    return{x:Math.cos(angle),y:Math.sin(angle)};
  }
  entity.phase4jWaypoint=null;
  // Find the first rock/log intercepting the line of travel.
  let blocker=null;
  const look=Math.min(d,400),step=16,count=Math.ceil(look/step);
  for(let i=1;i<=count&&!blocker;i++){
    const t=i/count;
    const x=entity.x+direct.x*look*t,y=entity.y+direct.y*look*t;
    blocker=phase4j.solids.find(o=>phase4jHits(o,x,y,r))||null;
  }
  if(!blocker)return direct;
  const margin=r+22,candidates=[];
  if(blocker.kind==='rock'){
    const rad=blocker.r+margin;
    for(let i=0;i<16;i++){
      const a=i*Math.PI/8;
      candidates.push({x:blocker.x+Math.cos(a)*rad,y:blocker.y+Math.sin(a)*rad});
    }
  }else{
    const vx=blocker.bx-blocker.ax,vy=blocker.by-blocker.ay;
    const len=Math.hypot(vx,vy)||1,nx=-vy/len,ny=vx/len;
    for(const end of [{x:blocker.ax,y:blocker.ay},{x:blocker.bx,y:blocker.by}])
      for(const sign of [-1,1])
        candidates.push({x:end.x+nx*margin*sign,y:end.y+ny*margin*sign});
  }
  let best=null,bestScore=Infinity;
  for(const p of candidates){
    if(!phase4jClear(p.x,p.y,r))continue;
    if(!phase4jLineClear(entity.x,entity.y,p.x,p.y,r))continue;
    const remaining=Math.hypot(tx-p.x,ty-p.y);
    const score=Math.hypot(p.x-entity.x,p.y-entity.y)+remaining
      +(phase4jLineClear(p.x,p.y,tx,ty,r)?0:175);
    if(score<bestScore){best=p;bestScore=score;}
  }
  if(best){
    entity.phase4jWaypoint=best;
    const angle=Math.atan2(best.y-entity.y,best.x-entity.x);
    return{x:Math.cos(angle),y:Math.sin(angle)};
  }
  // If two nearby obstacles overlap, a short tangent avoids a stationary loop.
  const nearest=blocker.kind==='rock'?blocker:phase4jNearestOnLog(entity.x,entity.y,blocker);
  const rad=Math.atan2(entity.y-nearest.y,entity.x-nearest.x);
  const a=rad+Math.PI/2*(entity.phase4jTurn||1);
  return{x:Math.cos(a),y:Math.sin(a)};
}
function phase4jNavBuild(){
  const size=PHASE4J.cell;
  const cols=Math.ceil(world.width/size),rows=Math.ceil(world.height/size);
  const pass=new Uint8Array(cols*rows);
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
    const cx=Math.min(world.width-25,x*size+size/2);
    const cy=Math.min(world.height-25,y*size+size/2);
    pass[y*cols+x]=phase4jClear(cx,cy,24)?1:0;
  }
  // Keep all usable cells in one connected component, not just the coop.
  const start=Math.floor(rows/2)*cols+Math.floor(cols/2);
  if(!pass[start])return{ok:false,pass,cols,rows};
  const marked=new Uint8Array(pass.length),queue=new Int32Array(pass.length);
  let head=0,tail=0;queue[tail++]=start;marked[start]=1;
  while(head<tail){
    const index=queue[head++],x=index%cols,y=(index/cols)|0;
    for(const next of [x>0?index-1:-1,x<cols-1?index+1:-1,y>0?index-cols:-1,y<rows-1?index+cols:-1]){
      if(next<0||!pass[next]||marked[next])continue;
      marked[next]=1;queue[tail++]=next;
    }
  }
  // Tiny fully enclosed pockets are not acceptable even if unused.
  for(let i=0;i<pass.length;i++)if(pass[i]&&!marked[i])return{ok:false,pass,cols,rows};
  return{ok:true,pass,cols,rows,marked};
}
function phase4jSafeCandidate(o) {
  const origin={x:world.width/2,y:world.height/2};
  const coop={x:world.width*.18,y:world.height*.22};
  const loc=o.kind==='log'?{x:(o.ax+o.bx)/2,y:(o.ay+o.by)/2}:o;
  const extent=o.kind==='log'?Math.hypot(o.bx-o.ax,o.by-o.ay)/2+o.r:o.r;
  if(Math.hypot(loc.x-origin.x,loc.y-origin.y)<PHASE4J.clearSpawn+extent)return false;
  if(Math.hypot(loc.x-coop.x,loc.y-coop.y)<PHASE4J.clearCoop+extent)return false;
  for(const other of phase4j.solids) {
    const pos=other.kind==='log'?{x:(other.ax+other.bx)/2,y:(other.ay+other.by)/2}:other;
    const radius=other.kind==='log'?Math.hypot(other.bx-other.ax,other.by-other.ay)/2+other.r:other.r;
    if(phase4jDistSq(loc.x,loc.y,pos.x,pos.y)<(extent+radius+65)**2)return false;
  }
  return true;
}
function phase4jGenerate(){
  phase4j={solids:[],mud:[],bushes:[],cols:0,rows:0,reachable:null};
  const rand=(a,b)=>a+Math.random()*(b-a);
  const newXY=()=>({x:rand(160,world.width-160),y:rand(160,world.height-160)});
  let rocks=0,logs=0;
  for(let i=0;i<250&&(rocks<PHASE4J.rockCount||logs<PHASE4J.logCount);i++){
    const makeLog=logs<PHASE4J.logCount&&(rocks>=PHASE4J.rockCount||Math.random()<.43);
    const p=newXY();let o;
    if(makeLog){
      const angle=rand(0,Math.PI),len=rand(90,150);
      o={kind:'log',ax:p.x-Math.cos(angle)*len/2,ay:p.y-Math.sin(angle)*len/2,
        bx:p.x+Math.cos(angle)*len/2,by:p.y+Math.sin(angle)*len/2,r:13};
    } else o={kind:'rock',x:p.x,y:p.y,r:rand(29,43)};
    if(!phase4jSafeCandidate(o))continue;
    phase4j.solids.push(o);
    const nav=phase4jNavBuild();
    if(!nav.ok){phase4j.solids.pop();continue;}
    if(makeLog)logs++;else rocks++;
  }
  for(let i=0;i<PHASE4J.mudCount;i++){
    const p=newXY();phase4j.mud.push({...p,rx:rand(62,115),ry:rand(38,65)});
  }
  for(let i=0;i<PHASE4J.bushCount;i++){
    const p=newXY();
    if(!phase4jClear(p.x,p.y,35))continue;
    phase4j.bushes.push({...p,r:rand(38,68)});
  }
  const nav=phase4jNavBuild();
  phase4j.cols=nav.cols;phase4j.rows=nav.rows;phase4j.reachable=nav;
}
function phase4jReachable(x,y,r=18) {
  if(!phase4jClear(x,y,r))return false;
  const nav=phase4j.reachable;
  if(!nav?.marked)return true;
  const cx=clamp(Math.floor(x/PHASE4J.cell),0,nav.cols-1);
  const cy=clamp(Math.floor(y/PHASE4J.cell),0,nav.rows-1);
  return nav.marked[cy*nav.cols+cx]===1;
}
function phase4jFindObjective(x,y,r=38) {
  if(phase4jReachable(x,y,r))return{x,y};
  const original={x,y};
  for(let d=48;d<=380;d+=32)for(let i=0;i<20;i++){
    const a=i*Math.PI/10;
    const xx=clamp(original.x+Math.cos(a)*d,r+10,world.width-r-10);
    const yy=clamp(original.y+Math.sin(a)*d,r+10,world.height-r-10);
    if(phase4jReachable(xx,yy,r))return{x:xx,y:yy};
  }
  const cx=world.width/2,cy=world.height/2;
  return phase4jNearestFree(cx,cy,r);
}
// Terrain is regenerated only on restart, not every frame.
const phase4jResetBase=resetGame;
resetGame=function resetPhase4jGame(){
  phase4jResetBase();
  phase4jGenerate();
};
const phase4jSpawnPointBase=spawnPointNearCamera;
spawnPointNearCamera=function spawnPhase4jPoint(){
  const p=phase4jSpawnPointBase();
  return phase4jFindObjective(p.x,p.y,22);
};
// Both event and egg locations reuse the same nav-valid spawn filter.
const phase4jEventLocationBase=phase4hLocation;
phase4hLocation=function phase4jEventLocation(){
  const p=phase4jEventLocationBase();
  return phase4jFindObjective(p.x,p.y,45);
};
const phase4jEggSpawnBase=phase4iSpawnEgg;
phase4iSpawnEgg=function phase4jSpawnSafeEgg(){
  const made=phase4jEggSpawnBase();
  if(made&&phase4i?.egg?.status==='ground'){
    const p=phase4jFindObjective(phase4i.egg.x,phase4i.egg.y,35);
    phase4i.egg.x=p.x;phase4i.egg.y=p.y;
  }
  return made;
};
function phase4jVisible(o,margin=140){
  const hw=width/(2*camera.zoom)+margin,hh=height/(2*camera.zoom)+margin;
  return Math.abs(o.x-camera.x)<=hw&&Math.abs(o.y-camera.y)<=hh;
}
function phase4jDrawTerrain(){
  context.save();
  for(const m of phase4j.mud) {
    if(!phase4jVisible(m,130))continue;
    context.fillStyle='rgba(154,123,89,.32)';
    context.strokeStyle='rgba(130,112,87,.27)';context.lineWidth=2;
    context.beginPath();context.ellipse(m.x,m.y,m.rx,m.ry,-.15,0,Math.PI*2);
    context.fill();context.stroke();
    context.fillStyle='rgba(111,91,71,.14)';
    for(let i=-2;i<=2;i++){context.beginPath();context.ellipse(m.x+i*17,m.y+9,5,2,0,0,Math.PI*2);context.fill();}
  }
  for(const o of phase4j.solids){
    const c=o.kind==='rock'?o:{x:(o.ax+o.bx)/2,y:(o.ay+o.by)/2};
    if(!phase4jVisible(c,150))continue;
    if(o.kind==='rock'){
      context.fillStyle='#8f9c92';context.strokeStyle='#657b76';context.lineWidth=3;
      context.beginPath();context.ellipse(o.x,o.y,o.r,o.r*.77,-.18,0,Math.PI*2);context.fill();context.stroke();
      context.fillStyle='#bdc9b7';context.beginPath();context.ellipse(o.x-o.r*.22,o.y-o.r*.24,o.r*.45,o.r*.25,-.3,0,Math.PI*2);context.fill();
    }else{
      context.lineCap='round';context.lineWidth=o.r*2+5;context.strokeStyle='#745f4d';
      context.beginPath();context.moveTo(o.ax,o.ay);context.lineTo(o.bx,o.by);context.stroke();
      context.lineWidth=o.r*2-2;context.strokeStyle='#ae8d69';
      context.beginPath();context.moveTo(o.ax,o.ay);context.lineTo(o.bx,o.by);context.stroke();
      context.lineWidth=2;context.strokeStyle='rgba(242,216,168,.54)';
      context.beginPath();context.moveTo(o.ax,o.ay-3);context.lineTo(o.bx,o.by-3);context.stroke();
    }
  }
  for(const b of phase4j.bushes){
    if(!phase4jVisible(b,90))continue;
    context.fillStyle='rgba(100,137,88,.25)';
    for(const [dx,dy,rr] of [[-b.r*.34,0,.62],[b.r*.28,-5,.7],[0,-b.r*.2,.7]]){
      context.beginPath();context.arc(b.x+dx,b.y+dy,b.r*rr,0,Math.PI*2);context.fill();
    }
  }
  context.restore();
}
const phase4jBackgroundBase=drawBackground;
drawBackground=function drawPhase4jBackground(){phase4jBackgroundBase();phase4jDrawTerrain();};
function phase4jDrawBushCanopy(){
  context.save();
  for(const b of phase4j.bushes){
    if(!phase4jVisible(b,80))continue;
    context.fillStyle='rgba(93,128,82,.14)';
    context.strokeStyle='rgba(81,121,73,.30)';context.lineWidth=1.5;
    for(const [dx,dy,r] of [[-.34,.02,.64],[.31,-.04,.68],[0,-.23,.66]]){
      context.beginPath();context.arc(b.x+b.r*dx,b.y+b.r*dy,b.r*r,0,Math.PI*2);
      context.fill();context.stroke();
    }
  }
  context.restore();
}
const phase4jWorldBase=drawWorld;
drawWorld=function drawPhase4jWorld(){phase4jWorldBase();phase4jDrawBushCanopy();};
// Shrubs are concealment, not collision or full invisibility.
const phase4jFoxDrawBase=drawFox;
drawFox=function drawPhase4jConcealedFox(fox){
  context.save();
  if(phase4jBushAt(fox.x,fox.y) &&
    phase4jDistSq(player.x,player.y,fox.x,fox.y)>95**2)
    context.globalAlpha*=.46;
  phase4jFoxDrawBase(fox);
  context.restore();
};

function phase4jLineClear(x1,y1,x2,y2,r=5) {
  const dist=Math.hypot(x2-x1,y2-y1);
  const steps=Math.max(1,Math.ceil(dist/16));
  for(let i=1;i<=steps;i++) {
    const t=i/steps;
    if(!phase4jClear(x1+(x2-x1)*t,y1+(y2-y1)*t,r))return false;
  }
  return true;
}
// Prevent attacks on foxes through solid rock/logs. This is deliberately shared
// by all weapons to avoid inconsistent gun/spear piercing behavior in 4J.
const phase4jDamageFoxBase=damageFox;
damageFox=function damagePhase4jFox(fox,damage,direction,knockback,stun=0) {
  if (player && !phase4jLineClear(player.x,player.y,fox.x,fox.y,5))return;
  const startX=fox.x,startY=fox.y;
  phase4jDamageFoxBase(fox,damage,direction,knockback,stun);
  if(fox.dead)return;
  const nx=fox.x,ny=fox.y;
  fox.x=startX;fox.y=startY;
  phase4jMoveEntity(fox,nx,ny,fox.radius||14);
};
// Knockback from older skills should not strand the player or chicks inside a rock.
const phase4jUpdateBase=update;
update=function updatePhase4jTerrain(dt) {
  const px=player?.x,py=player?.y;
  const recorded=new Map();
  for(const chick of chicks)recorded.set(chick,[chick.x,chick.y]);
  phase4jUpdateBase(dt);
  if(state!=='playing' || !player)return;
  if(!phase4jClear(player.x,player.y,player.radius||18) && Number.isFinite(px+py)){
    const nx=player.x,ny=player.y;
    player.x=px;player.y=py;
    phase4jMoveEntity(player,nx,ny,player.radius||18);
  }
  for(const chick of chicks){
    if(chick.lost||chick.carriedBy||phase4jClear(chick.x,chick.y,chick.radius||10))continue;
    const before=recorded.get(chick);
    if(!before)continue;
    const nx=chick.x,ny=chick.y;
    chick.x=before[0];chick.y=before[1];
    phase4jMoveEntity(chick,nx,ny,chick.radius||10);
  }
};
