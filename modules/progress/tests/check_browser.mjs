/* Dependency-free Chromium acceptance checks. Run against a disposable profile:
   node modules/progress/tests/check_browser.mjs [base-url] [debug-url] [--screenshots] */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const urls=process.argv.filter(arg=>arg.startsWith('http'));
const base=urls[0]||'http://127.0.0.1:8017';
const debug=urls[1]||'http://127.0.0.1:9333';
const target=await(await fetch(debug+'/json/new?about:blank',{method:'PUT'})).json();
const ws=new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve);ws.addEventListener('error',reject);});
const pending=new Map();const errors=[];const requests=[];let serial=0;let assertions=0;
ws.addEventListener('message',event=>{
  const message=JSON.parse(event.data);
  if(pending.has(message.id)){const {resolve,reject,timer}=pending.get(message.id);clearTimeout(timer);pending.delete(message.id);if(message.error)reject(new Error(JSON.stringify(message.error)));else resolve(message.result);}
  if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.text);
  if(message.method==='Runtime.consoleAPICalled'&&['error','warning'].includes(message.params.type))errors.push(message.params.args.map(arg=>arg.value||arg.description).join(' '));
  if(message.method==='Network.requestWillBeSent')requests.push(message.params.request);
});
function cdp(method,params={}){return new Promise((resolve,reject)=>{const id=++serial;const timer=setTimeout(()=>{pending.delete(id);reject(new Error('Timeout: '+method));},12000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const result=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));return result.result.value;}
async function waitFor(expression){for(let i=0;i<100;i++){if(await evaluate(expression))return;await new Promise(resolve=>setTimeout(resolve,50));}throw new Error('Condition failed: '+expression);}
async function check(expression,message){assert.equal(await evaluate(expression),true,message);assertions++;}
async function navigate(path){const token=await evaluate('window.__testDocumentToken||null');await cdp('Page.navigate',{url:base+path});await waitFor(`window.__testDocumentToken!==${JSON.stringify(token)}&&location.href===${JSON.stringify(base+path)}&&document.readyState==='complete'&&!!window.SH&&!!document.querySelector('[data-calendar] .progress-day')`);}
async function screenshot(name,selector){
  if(!process.argv.includes('--screenshots'))return;
  await waitFor('getComputedStyle(document.querySelector(".app-frame")).display==="grid"');
  await evaluate(selector ? `document.querySelector(${JSON.stringify(selector)}).closest('section').scrollIntoView({block:'start',behavior:'instant'});true` : 'window.scrollTo({top:0,behavior:"instant"});true');
  await evaluate('document.fonts.ready.then(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))');
  await evaluate('Promise.all(document.getAnimations().filter(a=>a.playState==="running"&&Number.isFinite(a.effect.getTiming().iterations)).map(a=>a.finished.catch(()=>{})))');
  const folder=new URL('../.qa/',import.meta.url);await mkdir(folder,{recursive:true});
  const shot=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(new URL(name+'.png',folder),Buffer.from(shot.data,'base64'));
}
try{
  await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Network.enable');await cdp('Emulation.setFocusEmulationEnabled',{enabled:true});
  await cdp('Page.addScriptToEvaluateOnNewDocument',{source:'window.__testDocumentToken=Math.random();'});
  await cdp('Emulation.setTimezoneOverride',{timezoneId:'Asia/Bangkok'});
  for(const width of [1440,1280]){
    await cdp('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
    for(const lang of ['vi','en']){
      await navigate('/app/progress?lang='+lang);await evaluate('SH.store.reset()');
      await check(`Array.from(document.querySelectorAll('[data-stat]')).map(el=>el.textContent).join('|')==='0/2|0|0|0'`,'New learner summary from store');
      await check(`['practice','quiz','seen'].every(key=>document.querySelector('[data-'+key+'-content] .sh-empty a').getAttribute('href')===SH.url('/app/courses'))&&!document.querySelector('[data-calendar-empty]').hidden`,'Each empty section has course link');
      await check(`document.querySelectorAll('[data-lessons]').length===8&&document.querySelector('[data-lessons]').dataset.lessons==='1,2'&&document.querySelectorAll('.sh-badge--planned').length===7`,'Only open lessons as module denominator');
      await check(`document.querySelectorAll('[data-calendar] .progress-day').length===30&&Array.from(document.querySelectorAll('[data-calendar] .progress-day')).every(el=>el.dataset.count==='0'&&el.tabIndex===0&&el.getAttribute('aria-label'))`,'30 labelled, focusable empty days');
      await check(`document.querySelectorAll('h1').length===1&&document.documentElement.scrollWidth<=innerWidth`,'Layout and single page heading');
      await screenshot(`progress-new-${lang}-${width}`);
      await evaluate(`SH.store.addPractice('xin-chao',{handshape:true});SH.store.addQuizResult(1,6,7);SH.store.setLessonState(1,'completed');SH.store.setLessonState(2,'in_progress');SH.store.markSignSeen('xin-chao');SH.store.markSignSeen('tam-biet');`);
      await check(`Array.from(document.querySelectorAll('[data-stat]')).map(el=>el.textContent).join('|')==='1/2|2|1|1'`,'Actual practice, quiz, completed and seen totals');
      await check(`document.querySelector('[data-module-bar]').style.width==='50%'&&document.querySelector('[data-module-count]').textContent===SH.t('progress.modules.count',{done:1,total:2})`,'Module ratio and bar');
      await check(`document.querySelector('[data-practice-content] tbody td:last-child').textContent==='1/5'&&document.querySelector('[data-practice-content] a').getAttribute('href')===SH.url('/app/signs/xin-chao')`,'Checklist counts exactly the five assessment fields');
      await check(`Array.from(document.querySelectorAll('[data-quiz-content] tbody td')).map(el=>el.textContent).slice(1,3).join('|')==='1|6/7'&&document.querySelector('.progress-latest-score').textContent==='6/7'`,'Quiz best and latest real scores');
      await check(`document.querySelectorAll('[data-seen-content] a').length===2&&document.querySelectorAll('[data-seen-content] .sh-badge--sample').length===2`,'Seen sign chips carry sample labels');
      await check(`Array.from(document.querySelectorAll('.progress-day')).reduce((sum,el)=>sum+Number(el.dataset.count),0)===4&&document.querySelector('[data-calendar-empty]').hidden`,'Calendar counts lesson state + practice + quiz, excludes seen marks');
      await check(`document.querySelector('[data-practice-content] time').textContent===new Intl.DateTimeFormat('${lang==='vi'?'vi-VN':'en-US'}',{dateStyle:'medium',timeStyle:'short'}).format(new Date(SH.store.practiceLog()[0].at))`,'Locale-specific timestamps');
      await check(`Array.from(document.querySelectorAll('table')).every(el=>el.caption&&Array.from(el.querySelectorAll('th')).every(th=>th.scope==='col'))`,'Accessible captions and column headings');
      await screenshot(`progress-data-${lang}-${width}`);
      await screenshot(`progress-history-${lang}-${width}`,'[data-practice-content]');
      await evaluate(`SH.store.addQuizResult(1,1,7);SH.store.addQuizResult(2,4,6);SH.store.addPractice('ba-lo',{handshape:true,location:true,orientation:true,movement:true,expression:true,extra:true});`);
      await check(`document.querySelector('[data-stat=quiz]').textContent==='3'&&document.querySelector('[data-practice-content] tbody td:last-child').textContent==='5/5'`,'Event redraw and ignores extra checklist keys');
      await check(`(()=>{const rows=Array.from(document.querySelectorAll('[data-quiz-content] tbody tr'));const row=rows.find(row=>row.querySelector('a').getAttribute('href')===SH.url('/app/lessons/1'));return row.children[1].textContent==='2'&&row.children[2].textContent==='6/7'&&row.querySelector('.progress-latest-score').textContent==='1/7';})()`,'Highest score preserved when latest is lower');
      await evaluate(`for(let i=0;i<12;i++)SH.store.addPractice('tam-biet',{expression:i%2===0});`);
      await check(`document.querySelectorAll('[data-practice-content] tbody tr').length===10&&document.querySelector('[data-stat=practice]').textContent==='14'`,'Practice table latest ten, summary keeps all sessions');
      const saved=await evaluate('JSON.stringify(SH.store.export())');
      await navigate('/app/progress?lang='+lang);
      assert.equal(await evaluate('JSON.stringify(SH.store.export())'),saved,'Progress page never modifies the store');assertions++;
      await check(`document.querySelector('[data-stat=practice]').textContent==='14'&&document.querySelector('[data-stat=quiz]').textContent==='3'`,'Reload preserves totals');
      await evaluate('SH.store.reset()');
      await check(`document.querySelectorAll('tbody tr').length===0&&document.querySelectorAll('[data-seen-content] a[href*="/signs/"]').length===0&&document.querySelector('[data-stat=lessons]').textContent==='0/2'&&document.querySelector('[data-module-bar]').style.width==='0%'`,'Reset clears every report');
    }
  }
  // The store is mutable through its public API; temporary test stubs are restored by navigation.
  await navigate('/app/progress?lang=en');
  await evaluate(`(()=>{const at=new Date().toISOString();const snapshot={lessons:{},signs:{'no-longer-open':{at}},quiz:{999:[{score:1,total:2,at}]},practice:[{slug:'no-longer-open',checklist:{handshape:true},at}]};SH.store.export=()=>snapshot;SH.store.practiceLog=()=>snapshot.practice;SH.store.quizResults=id=>snapshot.quiz[id]||[];SH.store.summary=()=>({lessonsCompleted:0,lessonsOpen:2,signsSeen:1,practiceCount:1,quizCount:1});window.dispatchEvent(new CustomEvent('sh:store'));return true})()`);
  await check(`document.querySelector('[data-seen-content] p').textContent===SH.t('progress.seen.unavailable',{n:1})&&!document.querySelector('[data-practice-content] a')&&!document.querySelector('[data-quiz-content] a')`,'Unavailable signs and lessons do not create broken links');
  await evaluate(`(()=>{const at=new Date().toISOString();const snapshot={lessons:{},signs:{},quiz:{1:[{score:6,total:7,at},{score:1,total:7,at}]},practice:[{slug:'xin-chao',checklist:{},at},{slug:'ba-lo',checklist:{},at}]};SH.store.export=()=>snapshot;SH.store.practiceLog=()=>snapshot.practice;SH.store.quizResults=id=>snapshot.quiz[id]||[];window.dispatchEvent(new CustomEvent('sh:store'));return true})()`);
  await check(`document.querySelector('[data-practice-content] tbody a').getAttribute('href')===SH.url('/app/signs/ba-lo')&&document.querySelector('.progress-latest-score').textContent==='1/7'&&document.querySelector('[data-quiz-content] tbody tr').children[2].textContent==='6/7'`,'Tied timestamps keep the most recently appended attempt first');
  await navigate('/app/progress?lang=en');
  await evaluate(`SH.data.signs[0].word='<img src=x onerror=bad()> & test';SH.store.markSignSeen(SH.data.signs[0].slug);SH.store.addPractice(SH.data.signs[0].slug,{})`);
  await check(`document.querySelector('[data-seen-content] a').textContent.includes('<img src=x onerror=bad()>')&&!document.querySelector('[data-seen-content] img')&&!document.querySelector('[data-practice-content] img')`,'Stored content rendered as text');
  // Calendar window spanning a DST transition, plus local-midnight timestamp boundaries.
  for(const timezoneId of ['Asia/Bangkok','America/New_York']){
    await cdp('Emulation.setTimezoneOverride',{timezoneId});
    const injected=await cdp('Page.addScriptToEvaluateOnNewDocument',{source:`const RealDate=Date;window.Date=class extends RealDate{constructor(...args){super(...(args.length?args:['2026-03-15T16:00:00Z']));}static now(){return new RealDate('2026-03-15T16:00:00Z').getTime();}};`});
    await navigate('/app/progress?lang=en');await evaluate('SH.store.reset()');
    const records=['2026-02-13T16:00:00Z','2026-02-14T16:00:00Z','2026-03-15T16:00:00Z','2026-03-16T16:00:00Z','2026-03-14T23:30:00Z','invalid'];
    await evaluate(`(()=>{const stamps=${JSON.stringify(records)};const snapshot={lessons:{1:{state:'in_progress',at:stamps[4]}},signs:{},quiz:{1:[{score:1,total:2,at:stamps[2]}]},practice:stamps.map(at=>({slug:'xin-chao',checklist:{},at}))};SH.store.export=()=>snapshot;SH.store.practiceLog=()=>snapshot.practice;SH.store.quizResults=id=>snapshot.quiz[id]||[];window.dispatchEvent(new CustomEvent('sh:store'));return true})()`);
    await check(`(()=>{const days=Array.from(document.querySelectorAll('.progress-day'));return days.length===30&&new Set(days.map(el=>el.dataset.date)).size===30&&days[0].dataset.date==='2026-1-14'&&days.at(-1).dataset.date==='2026-2-15'&&days.reduce((sum,el)=>sum+Number(el.dataset.count),0)===5;})()`,'30 local calendar dates across month and DST; outside/invalid excluded');
    await check(`document.querySelector('[data-date="2026-2-${timezoneId==='Asia/Bangkok'?'15':'14'}"]').dataset.count==='${timezoneId==='Asia/Bangkok'?'4':'2'}'`,'UTC timestamps grouped by local day');
    await cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:injected.identifier});
  }
  await cdp('Emulation.setTimezoneOverride',{timezoneId:'Asia/Bangkok'});
  await navigate('/app/progress?lang=en');await evaluate('SH.store.reset()');
  for(const width of [1024,700,375]){
    await cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
    await check('document.querySelector(".progress-page").scrollWidth<=document.querySelector(".progress-page").clientWidth','Narrow module layout');
  }
  await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await check('getComputedStyle(document.querySelector("[data-module-bar]")).transitionDuration==="0s"','Reduced motion');
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  await evaluate('document.querySelector(".progress-day").focus()');
  await check('document.activeElement.classList.contains("progress-day")&&getComputedStyle(document.activeElement).outlineStyle!=="none"','Calendar keyboard focus visible');
  // Script-disabled pages retain all curriculum modules and explanation; no fake zero history.
  await cdp('Emulation.setScriptExecutionDisabled',{value:true});
  for(const lang of ['vi','en']){
    await cdp('Page.navigate',{url:base+'/app/progress?lang='+lang});
    await waitFor(`document.readyState==='complete'&&document.documentElement.lang===${JSON.stringify(lang)}&&!!document.querySelector('.progress-page')`);
    await check(`Array.from(document.querySelectorAll('[data-stat]')).every(el=>el.textContent==='—')&&document.querySelectorAll('[data-lessons]').length===8&&document.querySelectorAll('noscript').length===5`,'Honest useful server rendering without JavaScript');
  }
  await cdp('Emulation.setScriptExecutionDisabled',{value:false});
  assert.deepEqual(errors,[],'No browser exceptions or missing translations');assertions++;
  const network=requests.filter(request=>/^(https?|wss?):/.test(request.url));
  assert.ok(network.every(request=>request.url.startsWith(base+'/')&&['GET','HEAD'].includes(request.method)&&!request.hasPostData),'Read-only local requests only');assertions++;
  console.log(`PASS: ${assertions} browser assertions; VI/EN at 1440/1280px, real store totals, read-only reload, reset, ten-row history, best/latest quiz, sample labels, no JS, XSS, unavailable content, 30-day calendar and DST.`);
}finally{const closed=new Promise(resolve=>ws.addEventListener('close',resolve,{once:true}));ws.close();await closed;await fetch(debug+'/json/close/'+target.id);}
