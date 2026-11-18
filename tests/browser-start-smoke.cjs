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
        updateFoxes(.016);
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
    if(errors.length)throw Error('Runtime errors in capture checks: '+errors.join(' | ').slice(0,2200));
    console.log('PASS: time advances; normal/elite escapes lose the chick, defeating captor rescues it.');
  } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
