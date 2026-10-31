/* Run against a disposable Chrome profile, never a learner's profile:
   node modules/settings/tests/check_browser.mjs [base-url] [debug-url] [--screenshots] */
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const urls=process.argv.filter(arg=>arg.startsWith('http'));
const base=urls[0]||'http://127.0.0.1:8018';const debug=urls[1]||'http://127.0.0.1:9333';
const downloadDir=fileURLToPath(new URL('../.qa/downloads/',import.meta.url));await mkdir(downloadDir,{recursive:true});
const target=await(await fetch(debug+'/json/new?about:blank',{method:'PUT'})).json();
const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve);ws.addEventListener('error',reject);});
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
async function click(selector){await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);}
async function navigate(path,selector='.settings-page'){
  const token=await evaluate('window.__testDocumentToken||null');await cdp('Page.navigate',{url:base+path});
  await waitFor(`window.__testDocumentToken!==${JSON.stringify(token)}&&location.href===${JSON.stringify(base+path)}&&document.readyState==='complete'&&!!window.SH&&!!document.querySelector(${JSON.stringify(selector)})`);
}
async function key(value,code,virtualKey){await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:value,code,windowsVirtualKeyCode:virtualKey,...(value==='Enter'?{text:'\r',unmodifiedText:'\r'}:{})});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:value,code,windowsVirtualKeyCode:virtualKey});}
async function screenshot(name,selector){
  if(!process.argv.includes('--screenshots'))return;
  await waitFor('getComputedStyle(document.querySelector(".app-frame")).display==="grid"');
  await evaluate(selector?`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'start',behavior:'instant'});true`:'window.scrollTo({top:0,behavior:"instant"});true');
  await evaluate('document.fonts.ready.then(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))');
  await evaluate('Promise.all(document.getAnimations().filter(a=>a.playState==="running"&&Number.isFinite(a.effect.getTiming().iterations)).map(a=>a.finished.catch(()=>{})))');
  const folder=new URL('../.qa/',import.meta.url);await mkdir(folder,{recursive:true});const shot=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(new URL(name+'.png',folder),Buffer.from(shot.data,'base64'));
}
async function seed(){await evaluate(`SH.store.setLessonState(1,'completed');SH.store.setLessonState(2,'in_progress');SH.store.markSignSeen('xin-chao');SH.store.addPractice('xin-chao',{handshape:true});SH.store.addQuizResult(1,6,7);SH.store.toggleFavorite('xin-chao');`);}
async function exportAndCheck(){
  const filename=join(downloadDir,'signhearing-tien-do.json');await rm(filename,{force:true});
  const expected=await evaluate('SH.store.export()');const before=await evaluate('JSON.stringify(SH.store.export())');
  await click('[data-export]');let text;
  for(let i=0;i<100;i++){try{text=await readFile(filename,'utf8');break;}catch{}await new Promise(resolve=>setTimeout(resolve,50));}
  assert.equal(text,JSON.stringify(expected,null,2),'Downloaded JSON exactly matches the store, including favourites');assertions++;
  await check('document.querySelector("[data-data-message]").textContent===SH.t("settings.export.success")&&document.querySelectorAll("a[download]").length===0','Download feedback and temporary anchor cleanup');
  await waitFor('window.__settingsURLs.created.length===window.__settingsURLs.revoked.length');
  assert.equal(await evaluate('JSON.stringify(SH.store.export())'),before,'Export does not change progress');assertions++;
}
try{
  await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Network.enable');await cdp('Emulation.setFocusEmulationEnabled',{enabled:true});
  await cdp('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloadDir});
  await cdp('Page.addScriptToEvaluateOnNewDocument',{source:`
    window.__testDocumentToken=Math.random();window.__cameraCalls=0;window.__resetCalls=0;
    window.addEventListener('sh:store',e=>{if(e.detail.type==='reset')window.__resetCalls++;});
    window.confirm=()=>{throw new Error('Native confirm must not be used');};
    if(navigator.mediaDevices)navigator.mediaDevices.getUserMedia=()=>{window.__cameraCalls++;return Promise.reject(new Error('Settings must never request a camera'));};
    const created=[];const revoked=[];window.__settingsURLs={created,revoked};
    const create=URL.createObjectURL.bind(URL);const revoke=URL.revokeObjectURL.bind(URL);
    URL.createObjectURL=blob=>{const url=create(blob);created.push(url);return url;};URL.revokeObjectURL=url=>{revoked.push(url);revoke(url);};
    const mode=new URL(location.href).searchParams.get('test-permission');
    if(mode==='unsupported')Object.defineProperty(navigator,'permissions',{value:undefined,configurable:true});
    else if(mode&&navigator.permissions){navigator.permissions.query=async()=>{if(mode==='reject')throw new TypeError('Camera query unsupported');const status=Object.assign(new EventTarget(),{state:mode});window.__permissionStatus=status;return status;};}
  `});
  for(const width of [1440,1280]){
    await cdp('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
    for(const lang of ['vi','en']){
      await navigate('/app/settings?lang='+lang);await evaluate('SH.store.reset()');
      await check(`document.querySelector('.settings-language[aria-current]').hreflang==='${lang}'&&document.querySelectorAll('.settings-language[aria-current]').length===1`,'Native language selection is server-rendered');
      await check(`Array.from(document.querySelectorAll('.settings-nav a')).every(a=>document.getElementById(a.hash.slice(1)))`,'Every section anchor exists');
      await check(`!document.querySelector('[data-data-actions]').hidden&&Array.from(document.querySelectorAll('[data-stat]')).map(el=>el.textContent).join('|')==='0/2|0|0|0'`,'New learner summary, enabled data controls');
      await check(`document.querySelector('[data-storage-warning]').hidden&&document.querySelector('[data-confirmation]').hidden`,'No spurious warning or confirmation');
      await check(`document.querySelectorAll('h1').length===1&&document.documentElement.scrollWidth<=innerWidth`,'Page heading and laptop layout');
      await check(`document.querySelector('.settings-account').getAttribute('aria-disabled')==='true'&&document.querySelector('.settings-account button').disabled`,'Account is visibly unavailable');
      await screenshot(`settings-new-${lang}-${width}`);
      await screenshot(`settings-info-${lang}-${width}`,'#camera');
      await seed();
      await check(`Array.from(document.querySelectorAll('[data-stat]')).map(el=>el.textContent).join('|')==='1/2|1|1|1'&&document.querySelector('[data-in-progress]').textContent===SH.t('settings.summary.in_progress',{n:1})`,'Summary redraws from real store events');
      await exportAndCheck();
      const before=await evaluate('JSON.stringify(SH.store.export())');
      await click('[data-delete]');
      await check(`!document.querySelector('[data-confirmation]').hidden&&document.activeElement===document.querySelector('[data-confirmation]')&&document.querySelector('[data-delete]').getAttribute('aria-expanded')==='true'`,'Inline confirmation receives focus');
      await screenshot(`settings-confirm-${lang}-${width}`,'#du-lieu');
      await click('[data-cancel-delete]');
      await check(`document.querySelector('[data-confirmation]').hidden&&document.activeElement===document.querySelector('[data-delete]')&&document.querySelector('[data-delete]').getAttribute('aria-expanded')==='false'`,'Cancel closes confirmation and restores focus');
      assert.equal(await evaluate('JSON.stringify(SH.store.export())'),before,'Cancel does not delete');assertions++;
      await click('[data-delete]');await key('Escape','Escape',27);
      await check(`document.querySelector('[data-confirmation]').hidden&&document.activeElement===document.querySelector('[data-delete]')`,'Escape cancels');
      assert.equal(await evaluate('JSON.stringify(SH.store.export())'),before,'Escape does not delete');assertions++;
      await click('[data-delete]');await key('Tab','Tab',9);
      await check(`document.activeElement===document.querySelector('[data-confirm-delete]')&&getComputedStyle(document.activeElement).outlineStyle!=='none'`,'Keyboard reaches permanent delete with visible focus');
      await key('Enter','Enter',13);
      await check(`document.querySelector('[data-confirmation]').hidden&&document.activeElement===document.querySelector('[data-delete]')&&document.querySelector('[data-data-message]').textContent===SH.t('settings.delete.success')`,'Confirmed deletion closes, restores focus and announces success');
      await check(`Array.from(document.querySelectorAll('[data-stat]')).map(el=>el.textContent).join('|')==='0/2|0|0|0'&&SH.store.favorites().length===0&&SH.store.lessonState(2)==='not_started'`,'Confirmed deletion resets every data category');
      const resets=await evaluate('window.__resetCalls');await click('[data-confirm-delete]');
      assert.equal(await evaluate('window.__resetCalls'),resets,'Hidden confirmation cannot repeat deletion');assertions++;
      await navigate('/app/courses?lang='+lang,'.courses');
      await check(`Array.from(document.querySelectorAll('.courses-lesson.is-open')).every(el=>el.dataset.state==='not_started'&&el.querySelector('[data-state]').textContent===SH.t('shell.state.not_started'))`,'Courses show Not started after reset and navigation');
      await navigate('/app/settings?lang='+lang);
      await check('window.__cameraCalls===0&&Object.keys(SH.store.export().lessons).length===0','Reset persists on reload and settings never starts camera');
    }
  }
  await seed();const saved=await evaluate('JSON.stringify(SH.store.export())');
  await click('.settings-language[hreflang="vi"]');await waitFor('document.readyState==="complete"&&document.documentElement.lang==="vi"&&document.querySelector(".settings-language[aria-current]").hreflang==="vi"');
  assert.equal(await evaluate('JSON.stringify(SH.store.export())'),saved,'Language switch preserves progress');assertions++;
  // Permission status changes are tested without prompting for or opening a device.
  for(const lang of ['vi','en'])for(const mode of ['granted','denied','prompt','unsupported','reject']){
    await navigate('/app/settings?lang='+lang+'&test-permission='+mode);
    const state=['granted','denied','prompt'].includes(mode)?mode:'unknown';
    await waitFor(`document.querySelector('[data-permission]').dataset.state==='${state}'`);
    await check(`document.querySelector('[data-permission]').textContent===SH.t('settings.camera.permission.${state}')&&window.__cameraCalls===0`,'Permission state or graceful fallback without camera request');
    if(mode==='prompt'){
      await evaluate('window.__permissionStatus.state="granted";window.__permissionStatus.dispatchEvent(new Event("change"));true');
      await check(`document.querySelector('[data-permission]').dataset.state==='granted'`,'Permission changes update while page is open');
    }
  }
  await navigate('/app/settings?lang=en');
  await evaluate('SH.store.persistent=()=>false;window.dispatchEvent(new CustomEvent("sh:store",{detail:{type:"test"}}));true');
  await check(`!document.querySelector('[data-storage-warning]').hidden&&document.querySelector('[data-storage-warning]').textContent===SH.t('settings.storage.unavailable')`,'Memory-only storage warning');
  await exportAndCheck();await screenshot('settings-memory-only-en-1280','#du-lieu');
  await evaluate('URL.createObjectURL=()=>{throw new Error("Simulated Blob failure")};true');await click('[data-export]');
  await check(`document.querySelector('[data-data-message]').textContent===SH.t('settings.export.error')&&!document.querySelector('a[download]')`,'Download failure gives a clear message');
  await navigate('/app/settings?lang=en');
  for(const width of [1024,700,375]){await cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});await check('document.querySelector(".settings-page").scrollWidth<=document.querySelector(".settings-page").clientWidth','Narrow settings layout');}
  await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await check('getComputedStyle(document.querySelector("[data-export]")).transitionDuration==="0s"','Reduced motion');
  await click('.settings-nav a[href="#du-lieu"]');
  await check('location.hash==="#du-lieu"&&document.activeElement.id==="du-lieu"&&document.activeElement.getBoundingClientRect().top>=68&&document.activeElement.getBoundingClientRect().top<230','Reduced-motion anchor navigation jumps immediately and moves focus');
  await cdp('Emulation.setScriptExecutionDisabled',{value:true});
  for(const lang of ['vi','en']){
    await cdp('Page.navigate',{url:base+'/app/settings?lang='+lang});
    await waitFor(`document.readyState==='complete'&&document.documentElement.lang==='${lang}'&&!!document.querySelector('.settings-page')`);
    await check(`document.querySelector('[data-data-actions]').hidden&&document.querySelector('[data-confirmation]').hidden&&document.querySelector('[data-summary]').hidden&&document.querySelector('noscript').textContent.trim().length>0`,'No-JS data actions hidden, explanatory content remains');
    await check(`document.querySelector('.settings-language[aria-current]').hreflang==='${lang}'&&Array.from(document.querySelectorAll('.settings-nav a')).every(a=>document.getElementById(a.hash.slice(1)))`,'No-JS language selection and real section anchors');
  }
  await cdp('Emulation.setScriptExecutionDisabled',{value:false});
  assert.deepEqual(errors,[],'No browser exceptions or missing translations');assertions++;
  const network=requests.filter(request=>/^(https?|wss?):/.test(request.url));
  assert.ok(network.every(request=>request.url.startsWith(base+'/')&&['GET','HEAD'].includes(request.method)&&!request.hasPostData),'Only local GET/HEAD requests; data never uploaded');assertions++;
  console.log(`PASS: ${assertions} browser assertions; VI/EN, 1440/1280px, real JSON download and revocation, cancel/Esc/keyboard delete, courses reset, language preservation, memory-only warning, permission states/change/unsupported, no camera, no JS and narrow layout.`);
}finally{const closed=new Promise(resolve=>ws.addEventListener('close',resolve,{once:true}));ws.close();await closed;await fetch(debug+'/json/close/'+target.id);}
