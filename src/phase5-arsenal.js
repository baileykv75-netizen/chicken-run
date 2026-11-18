// Phase 5C: coins, chicken upgrades, four weapon slots, inventory and shop.
const phase5Arsenal={items:[],serial:1,selectedId:null,category:'火力',tab:'equip',shopOpen:false,chest:null,chestSeed:0};
const phase5ShopButton=document.createElement('button');
phase5ShopButton.id='phase5ShopButton';phase5ShopButton.type='button';
phase5ShopButton.textContent='鸡棚商店 / 小鸡培养';
phase5ShopButton.style.cssText='position:fixed;bottom:40px;left:50%;transform:translateX(-50%);z-index:12;background:#e0bb77;border:2px solid #92724e;color:#352c20;border-radius:12px;padding:10px 15px;font-weight:bold;display:none';
document.querySelector('#app').append(phase5ShopButton);
const phase5ShopPanel=document.createElement('div');
phase5ShopPanel.id='phase5ShopPanel';
phase5ShopPanel.className='p5-shop-panel';
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
function phase5ShopCard(text,action,disabled=false,style=''){
  return '<button type="button" class="p5-action '+style+'" data-action="'+action+'" '+(disabled?'disabled':'')+'>'+text+'</button>';
}
function phase5ShopItemInfo(item){
  const gear=PHASE5_GEAR_BY_ID[item.id];
  return gear.icon+' '+gear.name+' <small>Lv.'+item.level+'</small>';
}
function phase5ShopRender(){
  if(!phase5Arsenal.shopOpen)return;
  const selected=phase5SelectedChick();
  if(selected)phase5Arsenal.selectedId=selected.id;
  const survivors=chicks.filter(c=>c.atCoop&&!c.lost);
  const held=selected?phase5ChickItems(selected):[];
  const available=phase5Arsenal.items.filter(item=>item.ownerId===null);
  const tab=phase5Arsenal.tab;
  let html='<div class="p5-top"><div><h2>鸡棚整备</h2><p>给小鸡配武器，整备好了再出发</p></div>'+phase5ShopCard('✕ 关闭','close',false,'p5-close')+'</div>';
  html+='<div class="p5-summary"><strong>🪙 '+phase5.gold+' <span>金币</span></strong><span>🏠 归巢 '+phase5SafeCount()+'/10</span><span>🎒 装备 '+phase5Arsenal.items.length+'件</span></div>';
  html+='<nav class="p5-tabs" aria-label="鸡棚功能">';
  for(const [key,label] of [['equip','① 装备小鸡'],['buy','② 购买武器'],['sell','③ 出售装备']])
    html+=phase5ShopCard(label,'tab:'+key,false,tab===key?'p5-active':'');
  html+='</nav>';
  if(tab==='equip'){
    html+='<div class="p5-section-head"><b>选择小鸡</b><small>只有留守鸡棚的小鸡可以整备</small></div>';
    html+='<div class="p5-chicks">';
    for(const chick of survivors){
      phase5EnsureChick(chick);
      html+=phase5ShopCard('🐥 #'+chick.id+' <small>Lv.'+chick.trainingLevel+'</small>','select:'+chick.id,false,selected===chick?'p5-active':'');
    }
    html+='</div>';
    if(!selected)html+='<div class="p5-empty">当前没有留守的小鸡，请先带小鸡返回鸡棚。</div>';
    else{
      phase5RefreshChickHp(selected);
      const cost=selected.trainingLevel===1?35:selected.trainingLevel===2?75:0;
      const hp=Math.max(0,Math.ceil(selected.health)), max=selected.maxHealth;
      const healCost=Math.max(2,Math.ceil((max-hp)/5));
      html+='<div class="p5-chick-status"><div class="p5-status-title"><b>🐥 小鸡 #'+selected.id+' · Lv.'+selected.trainingLevel+'</b><span>武器 '+held.length+'/4</span></div>';
      html+='<div class="p5-hp-row"><span>生命 '+hp+'/'+max+'</span><div class="p5-hp-track"><i style="width:'+Math.max(0,Math.min(100,Math.round(hp/max*100)))+'%"></i></div></div>';
      html+='<div class="p5-actions">';
      html+=phase5ShopCard(cost?'升级小鸡 · 🪙'+cost:'已满级','level',!cost||phase5.gold<cost,'p5-primary');
      html+=phase5ShopCard(hp>=max?'生命已满':'付费治疗 · 🪙'+healCost,'heal',hp>=max||phase5.gold<healCost);
      html+='</div></div>';
      html+='<div class="p5-section-head"><b>已装备 '+held.length+'/4</b><small>四件武器可同时生效</small></div>';
      html+='<div class="p5-slots">';
      for(let i=0;i<4;i++){
        const item=held[i];
        html+='<div class="p5-slot"><span class="p5-slot-index">'+(i+1)+'</span>';
        if(item){
          html+='<div class="p5-slot-name">'+phase5ShopItemInfo(item)+'</div>';
          const price=item.level===1?25:55;
          html+='<div class="p5-slot-buttons">'+phase5ShopCard('强化'+(item.level<3?' 🪙'+price:''),'upgrade:'+item.uid,item.level>=3||phase5.gold<price||selected.trainingLevel<=item.level)+phase5ShopCard('卸下','equip:'+item.uid)+'</div>';
        }else html+='<span class="p5-placeholder">空装备槽</span>';
        html+='</div>';
      }
      html+='</div><div class="p5-section-head"><b>背包 · 可装备 '+available.length+'件</b><small>点击「装上」分配给当前小鸡</small></div>';
      html+='<div class="p5-inventory">';
      if(!available.length)html+='<div class="p5-empty">背包为空。可以去「购买武器」选购，或去野外开箱。</div>';
      for(const item of available) {
        html+='<div class="p5-inventory-row"><span>'+phase5ShopItemInfo(item)+'</span>';
        const locked=item.level>selected.trainingLevel;
        html+=phase5ShopCard(locked?'需要小鸡Lv.'+item.level:'装上','equip:'+item.uid,locked||held.length>=4,'p5-primary');
        html+='</div>';
      }
      html+='</div>';
    }
  } else if(tab==='buy'){
    html+='<div class="p5-section-head"><b>购买一级武器</b><small>购买后进入背包，回「装备小鸡」安装</small></div>';
    html+='<div class="p5-categories">';
    for(const category of ['火力','守护','控制','生存','战术','奇术'])
      html+=phase5ShopCard(category,'category:'+category,false,phase5Arsenal.category===category?'p5-active':'');
    html+='</div><div class="p5-catalog">';
    for(const type of PHASE5_GEAR.filter(g=>g.category===phase5Arsenal.category)){
      html+='<div class="p5-product"><div class="p5-product-title"><b>'+type.icon+' '+type.name+'</b><strong>🪙 '+type.cost+'</strong></div>';
      html+='<p>'+type.description+'</p>';
      html+=phase5ShopCard('购买','buy:'+type.id,phase5.gold<type.cost,'p5-primary');
      html+='</div>';
    }
    html+='</div>';
  } else {
    html+='<div class="p5-section-head"><b>出售装备</b><small>返还累计投入约65%的金币；已穿戴的装备也可出售</small></div>';
    html+='<div class="p5-sell-list">';
    if(!phase5Arsenal.items.length)html+='<div class="p5-empty">当前没有可出售的装备。</div>';
    for(const item of phase5Arsenal.items){
      const owner=chicks.find(c=>(c.equipment||[]).includes(item.uid));
      const canSell=!owner||owner.atCoop;
      html+='<div class="p5-inventory-row"><span>'+phase5ShopItemInfo(item)+'<small class="p5-sub">'+(owner?'已装备：小鸡 #'+owner.id:'背包中')+'</small></span>';
      html+=phase5ShopCard('出售 · 🪙'+Math.floor(phase5GearValue(item)*.65),'sell:'+item.uid,!canSell);
      html+='</div>';
    }
    html+='</div>';
  }
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
  else if(action.startsWith('tab:'))phase5Arsenal.tab=action.slice(4);
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
  phase5Arsenal.shopOpen=false;phase5Arsenal.tab='equip';phase5ShopPanel.style.display='none';
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
