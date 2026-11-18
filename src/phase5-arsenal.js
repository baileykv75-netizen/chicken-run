// Phase 5C: coins, chicken upgrades, four weapon slots, inventory and shop.
const phase5Arsenal={items:[],serial:1,selectedId:null,category:'火力',shopOpen:false,chest:null,chestSeed:0};
const phase5ShopButton=document.createElement('button');
phase5ShopButton.id='phase5ShopButton';phase5ShopButton.type='button';
phase5ShopButton.textContent='鸡棚商店 / 小鸡培养';
phase5ShopButton.style.cssText='position:fixed;bottom:40px;left:50%;transform:translateX(-50%);z-index:12;background:#e0bb77;border:2px solid #92724e;color:#352c20;border-radius:12px;padding:10px 15px;font-weight:bold;display:none';
document.querySelector('#app').append(phase5ShopButton);
const phase5ShopPanel=document.createElement('div');
phase5ShopPanel.id='phase5ShopPanel';
phase5ShopPanel.style.cssText='position:fixed;inset:3% 7%;z-index:70;background:#f8f0da;color:#403725;border:3px solid #a58956;border-radius:18px;overflow:auto;padding:18px;box-shadow:0 0 0 100vmax #0007;display:none;font:15px/1.5 sans-serif';
document.querySelector('#app').append(phase5ShopPanel);
const phase5CoinPill=document.createElement('div');
phase5CoinPill.id='phase5CoinPill';phase5CoinPill.className='pill';
document.querySelector('#hud .hud-left')?.append(phase5CoinPill);

function phase5EnsureChick(chick) {
  if (!chick) return;
  chick.trainingLevel??=1;
  chick.equipment??=[];
  chick.maxHealth??=100;
  chick.health??=chick.maxHealth;
}
function phase5FindItem(uid) { return phase5Arsenal.items.find(item=>item.uid===uid); }
function phase5ChickItems(chick) {
  return (chick?.equipment||[]).map(phase5FindItem).filter(Boolean);
}
function phase5ChickHas(chick,id) {
  return phase5ChickItems(chick).filter(item=>item.id===id);
}
function phase5GearValue(item){
  const type=PHASE5_GEAR_BY_ID[item.id];
  return type.cost+(item.level>=2?25:0)+(item.level>=3?55:0);
}
function phase5ChickHpLimit(chick){
  phase5EnsureChick(chick);
  const base=[0,100,160,240][chick.trainingLevel]||100;
  const armor=phase5ChickHas(chick,'armor').reduce((sum,i)=>sum+30*i.level,0);
  return base+armor;
}
function phase5RefreshChickHp(chick){
  phase5EnsureChick(chick);
  chick.maxHealth=phase5ChickHpLimit(chick);
  chick.health=Math.min(chick.health,chick.maxHealth);
}
function phase5AddItem(id,level=1){
  if(!PHASE5_GEAR_BY_ID[id])return null;
  const item={uid:phase5Arsenal.serial++,id,level:Math.max(1,Math.min(3,level)),cooldown:0,ownerId:null};
  phase5Arsenal.items.push(item);
  return item;
}
function phase5RemoveLostGear(){
  for(const chick of chicks){
    if(!chick.lost||chick.phase5GearRemoved)continue;
    const equipped=new Set(chick.equipment||[]);
    phase5Arsenal.items=phase5Arsenal.items.filter(item=>!equipped.has(item.uid));
    chick.equipment=[];chick.phase5GearRemoved=true;
  }
}
function phase5ChickById(id){
  return chicks.find(chick=>!chick.lost&&chick.id===id);
}
function phase5SelectedChick(){
  const selected=phase5ChickById(phase5Arsenal.selectedId);
  return selected&&selected.atCoop?selected:chicks.find(chick=>chick.atCoop&&!chick.lost)||null;
}
function phase5BuyGear(id){
  const type=PHASE5_GEAR_BY_ID[id];
  if(!type||phase5.gold<type.cost)return false;
  phase5.gold-=type.cost;phase5AddItem(id);
  return true;
}
function phase5SellGear(uid){
  const item=phase5FindItem(uid);
  if(!item)return false;
  const owner=chicks.find(c=>(c.equipment||[]).includes(uid));
  if(owner&&!owner.atCoop)return false;
  if(owner){owner.equipment=owner.equipment.filter(x=>x!==uid);phase5RefreshChickHp(owner);}
  phase5.gold+=Math.floor(phase5GearValue(item)*.65);
  phase5Arsenal.items=phase5Arsenal.items.filter(x=>x!==item);
  return true;
}
function phase5UpgradeGear(uid){
  const item=phase5FindItem(uid);
  const owner=chicks.find(c=>(c.equipment||[]).includes(uid));
  if(!item||item.level>=3||owner&&!owner.atCoop)return false;
  const cost=item.level===1?25:55;
  if(phase5.gold<cost)return false;
  // A chick cannot keep using a weapon that would exceed its training level.
  if(owner&&(owner.trainingLevel||1)<=item.level)return false;
  phase5.gold-=cost;item.level++;if(owner)phase5RefreshChickHp(owner);
  return true;
}
function phase5UpgradeChick(chick){
  if(!chick||!chick.atCoop)return false;
  phase5EnsureChick(chick);
  const cost=chick.trainingLevel===1?35:chick.trainingLevel===2?75:null;
  if(cost===null||phase5.gold<cost)return false;
  phase5.gold-=cost;chick.trainingLevel++;
  phase5RefreshChickHp(chick);
  // Leveling raises max HP but does not restore HP.
  return true;
}
function phase5EquipItem(chick,uid){
  const item=phase5FindItem(uid);
  if(!chick||!chick.atCoop||!item)return false;
  phase5EnsureChick(chick);
  if(item.ownerId===chick.id){
    chick.equipment=chick.equipment.filter(x=>x!==uid);
    item.ownerId=null;phase5RefreshChickHp(chick);return true;
  }
  if(item.ownerId!==null||item.level>chick.trainingLevel||chick.equipment.length>=4)return false;
  chick.equipment.push(uid);item.ownerId=chick.id;
  phase5RefreshChickHp(chick);return true;
}
function phase5HealChick(chick){
  if(!chick||!chick.atCoop)return false;
  phase5RefreshChickHp(chick);
  const missing=Math.ceil(chick.maxHealth-chick.health);
  if(missing<=0)return false;
  const cost=Math.max(2,Math.ceil(missing/5));
  if(phase5.gold<cost)return false;
  phase5.gold-=cost;chick.health=chick.maxHealth;return true;
}
function phase5ShopCard(text,action,disabled=false){
  return '<button type="button" data-action="'+action+'" '+(disabled?'disabled':'')+' style="padding:6px 9px;border-radius:8px;border:1px solid #aa9364;background:#fff9e8;color:#4b3825;cursor:pointer">'+text+'</button>';
}
function phase5ShopRender(){
  if(!phase5Arsenal.shopOpen)return;
  const selected=phase5SelectedChick();
  if(selected)phase5Arsenal.selectedId=selected.id;
  const survivors=chicks.filter(c=>c.atCoop&&!c.lost);
  let html='<div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><h2 style="margin:0">鸡棚 · 整备与交易</h2>'+phase5ShopCard('关闭','close')+'</div>';
  html+='<p style="margin:6px 0 10px">🪙 金币 '+phase5.gold+' · 装备库存 '+phase5Arsenal.items.length+' · 归巢 '+phase5SafeCount()+'/10</p>';
  html+='<div style="border:1px solid #bfb197;border-radius:12px;padding:10px;margin-bottom:12px"><b>选择小鸡</b><div style="display:flex;gap:7px;flex-wrap:wrap;margin:8px 0">';
  for(const chick of survivors){
    phase5EnsureChick(chick);
    html+=phase5ShopCard('🐥 #'+chick.id+' Lv.'+chick.trainingLevel+(selected===chick?' ✓':''),'select:'+chick.id);
  }
  html+='</div>';
  if(selected){
    phase5RefreshChickHp(selected);
    const cost=selected.trainingLevel===1?35:selected.trainingLevel===2?75:0;
    html+='<div>Lv.'+selected.trainingLevel+' · HP '+Math.ceil(selected.health)+'/'+selected.maxHealth+' · 武器 '+selected.equipment.length+'/4</div>';
    html+='<div style="margin:6px 0;display:flex;gap:7px;flex-wrap:wrap">';
    html+=phase5ShopCard(cost?'升级小鸡（'+cost+'金币）':'已达Lv.3','level',!cost||phase5.gold<cost);
    const healCost=Math.max(2,Math.ceil((selected.maxHealth-selected.health)/5));
    html+=phase5ShopCard('治疗（'+healCost+'金币）','heal',selected.health>=selected.maxHealth||phase5.gold<healCost);
    html+='</div><small>升级仅增加生命上限，不能免费回血；装备等级不可超过小鸡等级。</small>';
  } else html+='<div>没有留守小鸡：先带小鸡安全返回鸡棚。</div>';
  html+='</div><h3 style="margin:4px 0">装备库存</h3><div style="display:flex;flex-wrap:wrap;gap:7px;margin-bottom:14px">';
  for(const item of phase5Arsenal.items){
    const type=PHASE5_GEAR_BY_ID[item.id];
    const owner=chicks.find(c=>(c.equipment||[]).includes(item.uid));
    html+='<div style="border:1px solid #bfb197;border-radius:9px;padding:8px;min-width:175px"><b>'+type.icon+' '+type.name+' Lv.'+item.level+'</b><div><small>'+(owner?'已配给 #'+owner.id:'在库存')+'</small></div>';
    html+=phase5ShopCard(owner===selected?'卸下':'装备','equip:'+item.uid,!selected||owner&&owner!==selected||!owner&&(item.level>selected.trainingLevel||selected.equipment.length>=4));
    html+=' '+phase5ShopCard('强化','upgrade:'+item.uid,item.level>=3||phase5.gold<(item.level===1?25:55)||owner&&owner.trainingLevel<=item.level);
    html+=' '+phase5ShopCard('卖 '+Math.floor(phase5GearValue(item)*.65),'sell:'+item.uid,owner&&!owner.atCoop)+'</div>';
  }
  if(!phase5Arsenal.items.length)html+='<small>库存为空，选择下方装备购买或去野外开宝箱。</small>';
  html+='</div><h3 style="margin:4px 0">常驻商店</h3><div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">';
  for(const category of ['火力','守护','控制','生存','战术','奇术'])
    html+=phase5ShopCard(category+(phase5Arsenal.category===category?' ✓':''),'category:'+category);
  html+='</div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(215px,1fr));gap:9px">';
  for(const type of PHASE5_GEAR.filter(g=>g.category===phase5Arsenal.category)){
    html+='<div style="border:1px solid #b9a886;border-radius:10px;padding:10px"><strong>'+type.icon+' '+type.name+'</strong><div style="font-size:12px;min-height:35px">'+type.description+'</div><div style="margin-top:5px">'+phase5ShopCard('购买 Lv.1 · '+type.cost+'金币','buy:'+type.id,phase5.gold<type.cost)+'</div></div>';
  }
  html+='</div>';
  phase5ShopPanel.innerHTML=html;
}
function phase5ShopClose(){
  if(!phase5Arsenal.shopOpen)return;
  phase5Arsenal.shopOpen=false;
  phase5ShopPanel.style.display='none';
  state='playing';previousTime=performance.now();
}
// Escape closes this modal instead of inadvertently resuming the game behind it.
window.addEventListener('keydown',ev=>{
  if(phase5Arsenal.shopOpen&&ev.key==='Escape'){
    ev.preventDefault();ev.stopImmediatePropagation();phase5ShopClose();
  }
},true);
phase5ShopButton.addEventListener('click',()=>{
  if(state!=='playing'||!phase5NearCoop())return;
  phase5Arsenal.shopOpen=true;state='paused';
  phase5ShopPanel.style.display='block';phase5ShopRender();
});
phase5ShopPanel.addEventListener('click',ev=>{
  const action=ev.target.closest('[data-action]')?.dataset.action;
  if(!action)return;
  if(action==='close'){phase5ShopClose();return;}
  const selected=phase5SelectedChick();
  if(action.startsWith('select:'))phase5Arsenal.selectedId=Number(action.slice(7));
  else if(action.startsWith('category:'))phase5Arsenal.category=action.slice(9);
  else if(action.startsWith('buy:'))phase5BuyGear(action.slice(4));
  else if(action.startsWith('equip:'))phase5EquipItem(selected,Number(action.slice(6)));
  else if(action.startsWith('sell:'))phase5SellGear(Number(action.slice(5)));
  else if(action.startsWith('upgrade:'))phase5UpgradeGear(Number(action.slice(8)));
  else if(action==='level')phase5UpgradeChick(selected);
  else if(action==='heal')phase5HealChick(selected);
  phase5ShopRender();
});
const phase5ArsenalResetBase=resetGame;
resetGame=function resetPhase5Arsenal(){
  phase5Arsenal.items=[];phase5Arsenal.serial=1;phase5Arsenal.selectedId=null;
  phase5Arsenal.chest=null;phase5Arsenal.chestSeed=0;
  phase5Arsenal.shopOpen=false;phase5ShopPanel.style.display='none';
  phase5ArsenalResetBase();
  phase5.gold=25;
  for(const chick of chicks)phase5RefreshChickHp(chick);
  phase5CoinPill.textContent='🪙 '+phase5.gold;
};
// Treasure chests are discoverable and continuously replenished when opened.
function phase5SpawnChest(){
  if(phase5Arsenal.chest||!player)return false;
  const coop=phase5Coop();
  for(let tries=0;tries<65;tries++){
    const x=120+Math.random()*(world.width-240);
    const y=120+Math.random()*(world.height-240);
    if(Math.hypot(x-coop.x,y-coop.y)<360)continue;
    if(typeof phase4jClear==='function'&&!phase4jClear(x,y,42))continue;
    phase5Arsenal.chest={x,y};return true;
  }
  return false;
}
const phase5ArsenalUpdateBase=update;
update=function updatePhase5Arsenal(dt){
  phase5ArsenalUpdateBase(dt);
  if(state!=='playing')return;
  for(const chick of chicks)phase5EnsureChick(chick);
  phase5RemoveLostGear();
  phase5ShopButton.style.display=phase5NearCoop()?'block':'none';
  phase5CoinPill.textContent='🪙 '+phase5.gold;
  if(!phase5Arsenal.chest)phase5SpawnChest();
  const chest=phase5Arsenal.chest;
  if(chest&&Math.hypot(chest.x-player.x,chest.y-player.y)<37){
    // A found item goes into coop inventory; it cannot be equipped in the field.
    const random=PHASE5_GEAR[Math.floor(Math.random()*PHASE5_GEAR.length)];
    const level=Math.random()<Math.min(.25,phase5SafeCount()*.017)?2:1;
    phase5AddItem(random.id,level);
    phase5Arsenal.chest=null;phase5Arsenal.chestSeed++;
    phase4iMessage('宝箱：获得 '+random.name+' Lv.'+level+'，回鸡棚整备！');
    addParticles(player.x,player.y,'★',7);
  }
  if(typeof phase5UpdateGearCombat==='function')phase5UpdateGearCombat(dt);
};
const phase5ArsenalDrawBase=drawWorld;
drawWorld=function drawPhase5ArsenalWorld(){
  phase5ArsenalDrawBase();
  const chest=phase5Arsenal.chest;
  if(!chest)return;
  context.save();context.translate(chest.x,chest.y);
  context.fillStyle='#98734c';context.strokeStyle='#5b503b';context.lineWidth=3;
  context.fillRect(-17,-11,34,25);context.strokeRect(-17,-11,34,25);
  context.fillStyle='#e6c17a';context.fillRect(-3,-10,6,25);
  context.fillStyle='#4d392d';context.font='bold 13px sans-serif';
  context.textAlign='center';context.fillText('装备',0,-23);context.restore();
};
const phase5ArsenalDrawScreenBase=draw;
draw=function drawPhase5ArsenalScreen(){
  phase5ArsenalDrawScreenBase();
  const chest=phase5Arsenal.chest;
  if(!chest||state!=='playing')return;
  const ctx=phase5Map.getContext('2d');
  ctx.fillStyle='#8f6744';ctx.fillRect(7+chest.x/world.width*208-4,7+chest.y/world.height*148-4,8,8);
};
