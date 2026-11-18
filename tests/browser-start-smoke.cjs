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
    if(errors.length)throw Error('Runtime errors in capture checks: '+errors.join(' | ').slice(0,2200));
    console.log('PASS: time advances; normal/elite escapes lose the chick, defeating captor rescues it.');
  } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
