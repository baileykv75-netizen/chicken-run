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
    console.log('PASS: time moves, player/chick present, no uncaught runtime errors');
  } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
