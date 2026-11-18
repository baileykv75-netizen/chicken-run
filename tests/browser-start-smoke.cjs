const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({headless:true,args:['--no-sandbox']});
  try {
    const page = await browser.newPage({viewport:{width:1280,height:800}});
    const errors=[];
    page.on('pageerror',error=>{errors.push(error.stack||String(error));console.error('PAGE ERROR',error.stack||error)});
    page.on('console',msg=>{if(msg.type()==='error')console.error('CONSOLE ERROR',msg.text())});
    page.on('requestfailed',req=>console.error('NETWORK ERROR',req.url(),req.failure()?.errorText));
    await page.goto('http://127.0.0.1:8765/',{waitUntil:'load'});
    await page.click('#startButton');
    await page.waitForTimeout(2400);
    const info=await page.evaluate(()=>({
      timer:document.querySelector('#timer')?.textContent,
      startHidden:document.querySelector('#startPanel')?.classList.contains('hidden'),
      hudVisible:!document.querySelector('#hud')?.classList.contains('hidden'),
      globalState:typeof state!=='undefined'?state:'MISSING',
      elapsed:typeof elapsed!=='undefined'?elapsed:null,
      player:typeof player!=='undefined'&&player?{x:player.x,y:player.y}:null,
      chicks:typeof chicks!=='undefined'?chicks.length:null,
      terrain:typeof phase4j!=='undefined'?phase4j.solids.length:null,
      effects:typeof phase4lEffects!=='undefined'?phase4lEffects.length:null,
    }));
    console.log('GAME STATE',JSON.stringify(info));
    await page.screenshot({path:'browser-start-smoke.png',fullPage:true});
    if(errors.length)throw Error('Runtime errors: '+errors.join(' | ').slice(0,2200));
    if(info.globalState!=='playing'||info.elapsed<1.5||!info.player||info.chicks<1||info.timer==='00:00')
      throw Error('Game frozen or missing player: '+JSON.stringify(info));
    const captureCheck=await page.evaluate(()=>{
      function trial(kind,killBeforeEscape=false){
        resetGame();state='playing';
        const chick=chicks[0];
        // A caught chicken is recoverable until the captor actually escapes.
        const radius=kind==='elite'?17:14;
        const fox={
          x:radius,y:world.height/2,radius,speed:125,health:90,maxHealth:90,
          type:'normal',xp:1,target:null,carrying:chick,
          stunnedFor:0,hitFlash:0,dead:false,
        };
        if(kind==='elite'){
          fox.phase4gKind='stalker';fox.phase4gMode='pursue';
          fox.phase4gClock=0;fox.phase4gCooldown=5;
          fox.phase4gFacing={x:-1,y:0};
        }
        foxes.push(fox);chick.carriedBy=fox;
        if(killBeforeEscape){
          fox.health=0;defeatFox(fox);
          return {lost:chick.lost,carried:!!chick.carriedBy,dead:fox.dead};
        }
        for(let step=0;step<120&&!chick.lost;step++)updateFoxes(.033);
        return {lost:chick.lost,carried:!!chick.carriedBy,dead:fox.dead};
      }
      return {normalEscape:trial('normal'),eliteEscape:trial('elite'),
        rescued:trial('normal',true)};
    });
    console.log('CARRY CHECK',JSON.stringify(captureCheck));
    if(!captureCheck.normalEscape.lost||captureCheck.normalEscape.carried||!captureCheck.normalEscape.dead)
      throw Error('Normal fox failed to escape: '+JSON.stringify(captureCheck));
    if(!captureCheck.eliteEscape.lost||captureCheck.eliteEscape.carried||!captureCheck.eliteEscape.dead)
      throw Error('Elite fox failed to escape: '+JSON.stringify(captureCheck));
    if(captureCheck.rescued.lost||captureCheck.rescued.carried||!captureCheck.rescued.dead)
      throw Error('Defeating captor failed to rescue chick: '+JSON.stringify(captureCheck));
    // Long-lived capture regression: move real foxes through the normal
    // movement code for multiple seconds, including a rock/log blocking the
    // nearest exit. Previous one-frame edge tests missed the tug-of-war.
    const flightChecks=await page.evaluate(()=>{
      const scenarios=[
        {name:'open ordinary',kind:'normal',obstacles:[]},
        {name:'open elite',kind:'elite',obstacles:[]},
        {name:'rock ordinary',kind:'normal',x:1250,y:1300,obstacles:[
          {kind:'rock',x:1250,y:1460,r:86}]},
        {name:'log ordinary',kind:'normal',x:1250,y:1300,obstacles:[
          {kind:'log',ax:1100,ay:1460,bx:1400,by:1460,r:17}]},
        {name:'rock elite',kind:'elite',x:1250,y:1300,obstacles:[
          {kind:'rock',x:1250,y:1460,r:86}]},
        {name:'near visual fence',kind:'normal',obstacles:[],x:world.width/2,y:world.height-250},
      ];
      return scenarios.map(config=>{
        resetGame();state='playing';
        phase4j.solids=config.obstacles;
        const chick=chicks[0],r=config.kind==='elite'?17:14;
        const fox={
          x:config.x??world.width/2,y:config.y??world.height/2,
          radius:r,speed:165,health:90,maxHealth:90,type:'normal',
          xp:1,target:null,carrying:chick,stunnedFor:0,hitFlash:0,dead:false,
        };
        if(config.kind==='elite'){
          fox.phase4gKind='stalker';fox.phase4gMode='pursue';
          fox.phase4gClock=0;fox.phase4gCooldown=4;
          fox.phase4gFacing={x:-1,y:0};
        }
        foxes=[fox];chick.carriedBy=fox;
        let steps=0,turns=0,idleFrames=0,lastDirection=null,maxIdle=0;
        let maxSideways=0;
        for(;steps<1000&&!chick.lost;steps++){
          const px=fox.x,py=fox.y;
          updateFoxes(.033);
          const distance=Math.hypot(fox.x-px,fox.y-py);
          maxSideways=Math.max(maxSideways,Math.abs(fox.x-(config.x??world.width/2)));
          if(distance<.12)idleFrames++;else idleFrames=0;
          maxIdle=Math.max(maxIdle,idleFrames);
          if(distance>.15){
            const vx=(fox.x-px)/distance,vy=(fox.y-py)/distance;
            if(lastDirection&&vx*lastDirection.x+vy*lastDirection.y<-.5)turns++;
            lastDirection={x:vx,y:vy};
          }
        }
        return {name:config.name,steps,escaped:chick.lost,
          stillCarried:!!chick.carriedBy,turns,maxIdle,maxSideways,
          exit:fox.phase4jEscape?.target||null};
      });
    });
    console.log('FLIGHT CHECK',JSON.stringify(flightChecks));
    for(const result of flightChecks) {
      if(!result.escaped||result.stillCarried||result.steps>=1000)
        throw Error('Captor failed to finish flight: '+JSON.stringify(result));
      if(result.maxIdle>80||result.turns>15)
        throw Error('Captor stuttered excessively: '+JSON.stringify(result));
      if(['rock ordinary','log ordinary','rock elite'].includes(result.name)
         && result.maxSideways<65)
        throw Error('Escape did not actually detour around the obstacle: '+JSON.stringify(result));
    }
    // Regression: spear displacement must never follow enemy auto-aim.
    const spearDirectionCheck=await page.evaluate(()=>{
      resetGame();state='playing';player.weapon='spear';
      player.attackRange=260;player.dashEvery=1;player.spearThrows=0;
      player.spearBusy=false;player.spearCount=1;
      const fox={x:player.x+90,y:player.y,radius:14,health:100,maxHealth:100,
        type:'normal',dead:false,stunnedFor:0,hitFlash:0};
      foxes=[fox];
      const observed=[];
      const originalDash=performSpearDash;
      performSpearDash=(direction)=>observed.push({x:direction.x,y:direction.y});
      try {
        // The input is left, but auto-aim points right toward the fox.
        keys.add('a');getMovementInput();
        performSpearAttack();
        const moving={dash:observed.at(-1),aim:{...player.facing}};
        keys.delete('a');getMovementInput();
        // The idle fallback uses last actual input, even after facing updates.
        spearShots=[];player.spearBusy=false;
        performSpearAttack();
        const idle={dash:observed.at(-1),aim:{...player.facing}};
        // Rifle evolution used to override the movement choice entirely.
        player.gunMode=true;player.gunArchetype='rifle';
        player.damageOut=20;player.damageBack=15;player.maxPierce=2;
        player.spearThrows=0;
        performRifleAttack();
        const rifle={dash:observed.at(-1)};
        return {moving,idle,rifle,count:observed.length};
      } finally {
        performSpearDash=originalDash;
        keys.delete('a');
      }
    });
    console.log('SPEAR DIRECTION CHECK',JSON.stringify(spearDirectionCheck));
    if(spearDirectionCheck.count!==3||
      spearDirectionCheck.moving.dash.x>-.9||
      spearDirectionCheck.idle.dash.x>-.9||
      spearDirectionCheck.rifle.dash.x>-.9||
      spearDirectionCheck.moving.aim.x<.9)
      throw Error('Dash followed the enemy rather than movement: '+JSON.stringify(spearDirectionCheck));
    // Upgrades earned before a gun worldline must remain effective afterwards.
    const inheritance=await page.evaluate(()=>{
      function upgrade(id) {
        const u=[...commonUpgrades(),...weaponUpgrades()].find(u=>u.id===id);
        if(!u)throw Error('Missing upgrade '+id);
        u.apply();
      }
      function foxAt(distance=85) {
        return {x:player.x+distance,y:player.y,radius:14,
          health:10000,maxHealth:10000,type:'normal',xp:1,
          stunnedFor:0,hitFlash:0,dead:false,carrying:null};
      }
      const result={};
      selectedWeapon='sword';resetGame();state='playing';phase4j.solids=[];
      upgrade('damage');upgrade('rate');upgrade('sword-double');upgrade('sword-knock');
      stage4cApplyOverlimit('sword-ring');
      const swordBase=player.attackDamage,swordChance=player.doubleSlashChance;
      const swordSpeed=player.attackInterval/WEAPONS.sword.attackInterval;
      activateGunWorldline();
      const swordStats={attackDamage:player.attackDamage,interval:player.attackInterval,
        expectedInterval:Math.max(.25,.64*swordSpeed),chance:player.doubleSlashChance,
        targets:player.revolverTargets};
      const swordFox=foxAt();foxes=[swordFox];stage4bGunShots=[];hammerSlams=[];
      const random=Math.random;Math.random=()=>0;
      try {for(let n=0;n<3;n++)performRevolverAttack()}
      finally {Math.random=random}
      result.sword={...swordStats,originalDamage:swordBase,originalChance:swordChance,
        shots:stage4bGunShots.length,rhythm:player.swordRhythm,
        wave:hammerSlams.length,foxRemaining:swordFox.health};

      selectedWeapon='spear';resetGame();state='playing';phase4j.solids=[];
      upgrade('damage');upgrade('spear-return-force');
      upgrade('spear-edge');upgrade('spear-volley');
      const spearData={out:player.damageOut,back:player.damageBack,
        pierce:player.maxPierce,count:player.spearCount,projectileSpeed:player.projectileSpeed};
      activateGunWorldline();
      const rifleRange=stage4bRifleRange(),baseRange=Math.max(390,player.attackRange*1.35);
      const inheritedVolleyCount=player.spearCount;
      // Two volley rays can straddle a distant central target; independently
      // verify the inherited range using the centre barrel, retaining the
      // learned volley count in the stats snapshot above.
      player.spearCount=1;
      const target=foxAt((rifleRange+baseRange)/2);foxes=[target];
      const rifleHit=performRifleAttack();
      result.spear={...spearData,gunOut:player.damageOut,gunBack:player.damageBack,
        gunPierce:player.maxPierce,gunCount:inheritedVolleyCount,
        rifleRange,baseRange,rifleHit,remaining:target.health};

      selectedWeapon='hammer';resetGame();state='playing';phase4j.solids=[];
      upgrade('damage');upgrade('hammer-force');
      stage4cApplyOverlimit('hammer-sky');
      const hammerData={damage:player.attackDamage,knockback:player.knockback,
        secondarySlam:player.secondarySlam};
      activateGunWorldline();
      const hammerFox=foxAt();foxes=[hammerFox];stage4cDelayedSlams=[];
      const hit=performShotgunAttack(),afterShot=hammerFox.health;
      const pending=stage4cDelayedSlams.length;
      stage4cUpdateDelayedSlams(.45);
      result.hammer={...hammerData,gunDamage:player.attackDamage,
        gunKnockback:player.knockback,hit,afterShot,pending,
        afterEcho:hammerFox.health};
      return result;
    });
    console.log('WEAPON INHERITANCE CHECK',JSON.stringify(inheritance));
    const si=inheritance.sword, sp=inheritance.spear, hm=inheritance.hammer;
    if(si.attackDamage!==si.originalDamage||si.chance!==si.originalChance||
       Math.abs(si.interval-si.expectedInterval)>.0001||si.targets<6||
       si.shots<6||si.rhythm!==3||si.wave<1)
      throw Error('Sword -> revolver lost upgrades: '+JSON.stringify(si));
    if(sp.out!==sp.gunOut||sp.back!==sp.gunBack||sp.pierce!==sp.gunPierce||
       sp.count!==sp.gunCount||sp.rifleRange<=sp.baseRange||!sp.rifleHit||
       sp.remaining>=10000)
      throw Error('Spear -> rifle lost upgrades: '+JSON.stringify(sp));
    if(hm.gunDamage!==hm.damage||hm.gunKnockback!==hm.knockback||
       !hm.secondarySlam||!hm.hit||hm.pending!==1||hm.afterEcho>=hm.afterShot)
      throw Error('Hammer -> shotgun lost upgrades: '+JSON.stringify(hm));
    // Phase 5: map expansion, coop spawn, player-carried eggs, ambush and delivery.
    const homecoming=await page.evaluate(()=>{
      selectedWeapon='sword';resetGame();state='playing';
      const coop=phase5Coop();
      const initial={world:[world.width,world.height],startDistance:Math.hypot(player.x-coop.x,player.y-coop.y),
        eggs:phase5.eggs.length,safe:phase5SafeCount(),miniMap:!!document.querySelector('#phase5Map')};
      const egg=phase5.eggs[0];
      player.x=egg.x;player.y=egg.y;phase5Deliver();
      // Exercise the Phase 5 pickup path with update, not an injected carry flag.
      update(.016);
      const carried={status:!!phase5.carried,ambush:phase5.runs,wave:waveRemaining,
        safe:phase5SafeCount()};
      player.x=coop.x;player.y=coop.y;update(.016);
      const delivered={safe:phase5SafeCount(),stillCarried:!!phase5.carried};
      // A newly hatched chick is stored safely, not a target or a follower.
      const frozen=chicks.find(c=>c.atCoop);
      const before={x:frozen.x,y:frozen.y};
      updateChicks(.033);
      const remains=before.x===frozen.x&&before.y===frozen.y;
      // Verify no timed victory: a long-running game remains playing.
      elapsed=901;update(.016);
      const noTimedWin=state==='playing';
      // Complete with distinct deliveries, not counting same chicken twice.
      for(let i=0;i<8;i++){
        phase5.carried={id:'test'+i};player.x=coop.x;player.y=coop.y;
        phase5Deliver();
      }
      return {initial,carried,delivered,remains,noTimedWin,
        completed:{state,title:document.querySelector('#resultTitle').textContent,
          safe:phase5SafeCount()}};
    });
    console.log('HOMECOMING CHECK',JSON.stringify(homecoming));
    if(homecoming.initial.world[0]<4200||homecoming.initial.world[1]<3000||
      homecoming.initial.startDistance>50||homecoming.initial.eggs!==3||
      homecoming.initial.safe!==1||!homecoming.initial.miniMap||
      !homecoming.carried.status||homecoming.carried.ambush!==1||
      homecoming.carried.wave<1||homecoming.delivered.safe!==2||
      homecoming.delivered.stillCarried||!homecoming.remains||!homecoming.noTimedWin||
      homecoming.completed.state!=='result'||homecoming.completed.safe!==10)
      throw Error('Phase 5 homecoming regression: '+JSON.stringify(homecoming));
    const coopDeploy=await page.evaluate(()=>{
      resetGame();state='playing';
      const chick=chicks[0],coop=phase5Coop();
      phase5CoopButton.click();
      const deployed=!chick.atCoop;
      update(.033);
      const staysDeployed=!chick.atCoop;
      player.x=coop.x+PHASE4I.deliveryRadius+80;
      player.y=coop.y;
      update(.033);
      const outside=!chick.atCoop;
      player.x=coop.x;player.y=coop.y;
      update(.033);
      return {deployed,staysDeployed,outside,returned:chick.atCoop};
    });
    console.log('COOP DEPLOY CHECK',JSON.stringify(coopDeploy));
    if(!coopDeploy.deployed||!coopDeploy.staysDeployed||
       !coopDeploy.outside||!coopDeploy.returned)
      throw Error('Chick deployment/return bug: '+JSON.stringify(coopDeploy));
    const chickHealth=await page.evaluate(()=>{
      resetGame();state='playing';phase4j.solids=[];
      const coop=phase5Coop();player.x=coop.x+310;player.y=coop.y;
      const chick=chicks[0];chick.atCoop=false;chick.awakened=true;
      chick.x=player.x;chick.y=player.y;
      const fox={x:chick.x,y:chick.y,radius:14,type:'normal',health:100,maxHealth:100,
        dead:false,stunnedFor:0,hitFlash:0,carrying:null,target:chick};
      foxes=[fox];
      phase5TryAttackChick(fox,chick);
      const first={health:chick.health,carried:!!fox.carrying};
      phase5TryAttackChick(fox,chick);
      const sameFrameHealth=chick.health;
      chick.invulnerableFor=0;
      for(let i=0;i<4;i++){phase5TryAttackChick(fox,chick);chick.invulnerableFor=0;}
      const downed={health:chick.health,downTime:chick.downedFor,carried:!!fox.carrying};
      chick.downedFor=0;
      phase5TryAttackChick(fox,chick);
      const captured={carried:fox.carrying===chick,by:chick.carriedBy===fox};
      defeatFox(fox);
      const rescued={health:chick.health,carried:!!chick.carriedBy};
      return {first,sameFrameHealth,downed,captured,rescued};
    });
    console.log('CHICK HP CHECK',JSON.stringify(chickHealth));
    if(chickHealth.first.health!==78||chickHealth.first.carried||
       chickHealth.sameFrameHealth!==78||chickHealth.downed.health!==0||
       chickHealth.downed.downTime<1||chickHealth.downed.carried||
       !chickHealth.captured.carried||!chickHealth.captured.by||
       chickHealth.rescued.health<18||chickHealth.rescued.carried)
       throw Error('Deployed chick HP and capture regression: '+JSON.stringify(chickHealth));
    const arsenalChecks=await page.evaluate(()=>{
      selectedWeapon='spear';resetGame();state='playing';
      const chick=chicks[0];
      const initial={catalog:PHASE5_GEAR.length,gold:phase5.gold,level:chick.trainingLevel,
        hp:chick.health,max:chick.maxHealth,safe:chick.atCoop,
        availableSkills:currentSkillDefinitions().map(s=>s.id)};
      phase5.gold=1500;
      const purchased=['rotary','storm-spear','hammer','heal','armor','phoenix'].map(id=>phase5BuyGear(id));
      const items=phase5Arsenal.items.slice();
      const equipOne=phase5EquipItem(chick,items[0].uid);
      const level2=phase5UpgradeChick(chick);
      const oldHealth=chick.health;
      const upgrade1=phase5UpgradeGear(items[0].uid);
      const level3=phase5UpgradeChick(chick);
      const upgrade2=phase5UpgradeGear(items[0].uid);
      const otherEquip=items.slice(1,4).map(item=>phase5EquipItem(chick,item.uid));
      const exceedsSlots=!phase5EquipItem(chick,items[4].uid);
      const stats={level:chick.trainingLevel,health:chick.health,
        oldHealth,max:chick.maxHealth,slots:chick.equipment.length,
        weaponLevel:items[0].level,compatible:items[0].level<=chick.trainingLevel,
        equipOne,level2,level3,upgrade1,upgrade2,otherEquip,exceedsSlots};
      // Each of the four equipped weapons has its own active cooldown.
      chick.atCoop=false;chick.x=player.x+65;chick.y=player.y+30;
      player.x+=270;player.y+=5;
      const fox={x:chick.x+60,y:chick.y,radius:14,health:100000,
        maxHealth:100000,type:'normal',dead:false,stunnedFor:0,
        hitFlash:0,target:chick,carrying:null,xp:0};
      foxes=[fox];phase5UpdateGearCombat(.033);
      const combat={damage:100000-fox.health,
        activeCooldowns:phase5ChickItems(chick).filter(item=>item.cooldown>0).length};
      // No heal simply for returning to the coop.
      chick.atCoop=true;chick.health=12;
      updateChicks(5);
      const noFreeHeal=chick.health===12;
      const goldBeforeHeal=phase5.gold;
      const paidHeal=phase5HealChick(chick);
      const healed={paidHeal,hp:chick.health,max:chick.maxHealth,
        spent:goldBeforeHeal-phase5.gold};
      const saleBefore=phase5.gold;
      const sold=phase5SellGear(items[4].uid);
      const saleGain=phase5.gold-saleBefore;
      // Lost chick takes all 4 equipped items out of inventory.
      chick.lost=true;
      phase5RemoveLostGear();
      const loss={itemsLeft:phase5Arsenal.items.length,slots:chick.equipment.length};
      // Ensure each catalog item is backed by a real on-hit, combat, or passive effect.
      const active=PHASE5_GEAR.filter(g=>g.cooldown>0).map(g=>g.id);
      const passive=PHASE5_GEAR.filter(g=>g.cooldown===0).map(g=>g.id);
      return {initial,purchased,stats,combat,noFreeHeal,healed,sold,saleGain,
        loss,active,passive};
    });
    console.log('ARSENAL CHECK',JSON.stringify(arsenalChecks));
    const ar=arsenalChecks;
    if(ar.initial.catalog!==24||ar.initial.gold!==25||ar.initial.level!==1||
       ar.initial.availableSkills.includes('chick-awaken')||
       ar.initial.availableSkills.includes('rogue-cultivation')||
       !ar.purchased.every(Boolean)||
       !ar.stats.equipOne||!ar.stats.level2||!ar.stats.level3||
       !ar.stats.upgrade1||!ar.stats.upgrade2||
       !ar.stats.otherEquip.every(Boolean)||!ar.stats.exceedsSlots||
       ar.stats.level!==3||ar.stats.slots!==4||ar.stats.weaponLevel!==3||
       ar.stats.health!==ar.stats.oldHealth||!ar.stats.compatible||
       ar.combat.damage<=0||ar.combat.activeCooldowns<2||
       !ar.noFreeHeal||!ar.healed.paidHeal||
       ar.healed.hp!==ar.healed.max||ar.healed.spent<=0||
       !ar.sold||ar.saleGain<=0||ar.loss.itemsLeft!==1||ar.loss.slots!==0||
       ar.active.length+ar.passive.length!==24)
      throw Error('Phase 5 arsenal regression: '+JSON.stringify(ar));
    const shopUi=await page.evaluate(()=>{
      resetGame();state='playing';
      phase5ShopButton.click();
      const open=phase5Arsenal.shopOpen&&state==='paused'&&phase5ShopPanel.style.display==='block';
      phase5ShopPanel.querySelector('[data-action="close"]').click();
      const closed=!phase5Arsenal.shopOpen&&state==='playing';
      return {open,closed};
    });
    console.log('SHOP UI CHECK',JSON.stringify(shopUi));
    if(!shopUi.open||!shopUi.closed)throw Error('Coop shop UI regression: '+JSON.stringify(shopUi));
    const itemEffects=await page.evaluate(()=>{
      selectedWeapon='sword';resetGame();state='playing';phase4j.solids=[];
      phase5.gold=1000;
      const chick=chicks[0];chick.atCoop=false;
      chick.x=player.x+100;chick.y=player.y+50;
      player.x=chick.x+15;player.y=chick.y+15;
      const fox={x:chick.x+45,y:chick.y,radius:14,health:1000000,maxHealth:1000000,
        type:'normal',xp:0,dead:false,stunnedFor:0,hitFlash:0,carrying:null,target:chick};
      foxes=[fox];
      const activated=[],exceptions=[];
      for(const type of PHASE5_GEAR.filter(t=>t.cooldown>0)){
        // Isolate each ability: previous knockback must not move the fox outside
        // the next weapon's effective reach.
        fox.x=chick.x+35;fox.y=chick.y;fox.stunnedFor=0;
        chick.health=25;player.health=25;
        const item={uid:-1,id:type.id,level:3,ownerId:chick.id,cooldown:0};
        const previousEquipment=chick.equipment;
        chick.equipment=[];phase5Arsenal.items.push(item);
        chick.equipment=[item.uid];
        try{
          const yes=phase5GearActive(chick,item);
          activated.push({id:type.id,yes});
        }catch(error){exceptions.push({id:type.id,error:String(error)})}
        phase5Arsenal.items.pop();chick.equipment=previousEquipment;
      }
      const armor=phase5AddItem('armor',3);
      chick.equipment=[armor.uid];armor.ownerId=chick.id;
      phase5RefreshChickHp(chick);
      const armoredMax=chick.maxHealth,damageReduction=phase5GearDamageReduction(chick);
      const phoenix=phase5AddItem('phoenix',3);
      chick.equipment=[phoenix.uid];phoenix.ownerId=chick.id;
      phase5RefreshChickHp(chick);
      chick.health=5;chick.invulnerableFor=0;
      phase5TryAttackChick(fox,chick);
      const phoenixSave=chick.health>0&&chick.phase5PhoenixUsed&&!chick.downedFor;
      return {activated,exceptions,armoredMax,damageReduction,phoenixSave};
    });
    console.log('GEAR EFFECT CHECK',JSON.stringify(itemEffects));
    if(itemEffects.exceptions.length||itemEffects.activated.length!==16||
      itemEffects.activated.some(x=>!x.yes)||itemEffects.armoredMax<=100||
      itemEffects.damageReduction<=0||!itemEffects.phoenixSave)
      throw Error('Gear effect runtime failure: '+JSON.stringify(itemEffects));
    if(errors.length)throw Error('Runtime errors in capture checks: '+errors.join(' | ').slice(0,2200));
    console.log('PASS: time advances; normal/elite escapes lose the chick, defeating captor rescues it.');
  } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
