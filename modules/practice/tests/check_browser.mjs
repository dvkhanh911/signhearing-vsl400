/* Run with isolated Chrome/Edge profiles, --use-fake-device-for-media-stream,
   and remote debugging enabled. Never uses the person's physical webcam.
   node modules/practice/tests/check_browser.mjs [base-url] [debug-url] [--screenshots] */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const urls = process.argv.filter(arg => arg.startsWith('http'));
const base = urls[0] || 'http://127.0.0.1:8015';
const debug = urls[1] || 'http://127.0.0.1:9333';
const browserName = (await (await fetch(debug + '/json/version')).json()).Browser.replace(/[^a-z0-9]/gi,'-');
const target = await (await fetch(debug + '/json/new?about:blank', {method:'PUT'})).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve,reject) => {ws.addEventListener('open',resolve);ws.addEventListener('error',reject);});
const pending = new Map();
const errors = [];
const requests = [];
let serial = 0;
let assertions = 0;
ws.addEventListener('message',event => {
  const message = JSON.parse(event.data);
  if (pending.has(message.id)) {
    const {resolve,reject,timer} = pending.get(message.id);
    clearTimeout(timer); pending.delete(message.id);
    if (message.error) reject(new Error(JSON.stringify(message.error))); else resolve(message.result);
  }
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
  if (message.method === 'Runtime.consoleAPICalled' && ['error','warning'].includes(message.params.type)) errors.push(message.params.args.map(arg=>arg.value||arg.description).join(' '));
  if (message.method === 'Network.requestWillBeSent') requests.push(message.params.request);
});
function cdp(method,params={}) {
  return new Promise((resolve,reject) => {
    const id=++serial;
    const timer=setTimeout(()=>{pending.delete(id);reject(new Error('Timeout: '+method));},12000);
    pending.set(id,{resolve,reject,timer}); ws.send(JSON.stringify({id,method,params}));
  });
}
async function evaluate(expression) {
  const result=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function waitFor(expression) {
  for(let i=0;i<120;i++) {
    if(await evaluate(expression)) return;
    await new Promise(resolve=>setTimeout(resolve,50));
  }
  throw new Error('Condition failed: '+expression+' '+JSON.stringify(await evaluate(`({url:location.href,persistent:window.SH&&SH.store.persistent(),attempts:window.SH&&SH.store.practiceLog().length,history:document.querySelectorAll('[data-history] li').length,status:document.querySelector('[data-camera-status]')?.textContent})`)));
}
async function check(expression,message) {assert.equal(await evaluate(expression),true,message); assertions++;}
async function navigate(path,selector='.practice-session') {
  const oldToken=await evaluate('window.__testDocumentToken || null');
  await cdp('Page.navigate',{url:base+path});
  await waitFor(`window.__testDocumentToken !== ${JSON.stringify(oldToken)} && location.href === ${JSON.stringify(base+path)} && document.readyState === 'complete' && !!window.SH && !!document.querySelector(${JSON.stringify(selector)})`);
}
async function click(selector) {await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);}
async function key(key,code,virtualKey) {
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:virtualKey,...(key==='Enter'?{text:'\r',unmodifiedText:'\r'}:{})});
  await cdp('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:virtualKey});
}
async function screenshot(name) {
  if(!process.argv.includes('--screenshots')) return;
  await waitFor('getComputedStyle(document.querySelector(".app-frame")).display==="grid" && document.querySelector(".app-brand").getBoundingClientRect().width<240');
  await evaluate('window.scrollTo({top:0,behavior:"instant"})');
  await evaluate('document.fonts.ready.then(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))');
  const folder=new URL('../.qa/',import.meta.url);await mkdir(folder,{recursive:true});
  const result=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  await writeFile(new URL(browserName+'-'+name+'.png',folder),Buffer.from(result.data,'base64'));
}
const noLiveStreams='window.__streams.every(s=>s.getTracks().every(t=>t.readyState === "ended"))';

try {
  await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Network.enable');
  await cdp('Emulation.setFocusEmulationEnabled',{enabled:true});
  await cdp('Browser.grantPermissions',{origin:base,permissions:['videoCapture']});
  await cdp('Page.addScriptToEvaluateOnNewDocument',{source:`
    window.__testDocumentToken=Math.random();window.__cameraCalls=[];window.__streams=[];window.__cameraMode='normal';
    window.__nativeCamera=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia=async function(constraints){
      window.__cameraCalls.push(constraints);
      if(window.__cameraMode==='pending') return new Promise(resolve=>{window.__resolveCamera=resolve;});
      if(window.__cameraMode!=='normal') throw new DOMException('Test camera error',window.__cameraMode);
      const stream=await window.__nativeCamera(constraints);window.__streams.push(stream);return stream;
    };
    const timer=window.setTimeout;
    window.setTimeout=function(callback,delay,...args){return timer(callback,window.__fastTimeout&&delay===15000?25:delay,...args);};
  `});
  for(const width of [1440,1280]) {
    await cdp('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
    for(const lang of ['vi','en']) {
      await navigate(`/app/practice?lang=${lang}`,'.practice-page');
      await evaluate('SH.store.reset()');
      await check('document.querySelectorAll(".practice-choice:not([hidden])").length === SH.data.signs.length','all choices including local collection');
      await check('document.documentElement.scrollWidth <= innerWidth && document.querySelectorAll("h1").length === 1 && getComputedStyle(document.querySelector(".app-frame")).display==="grid"','list layout');
      await screenshot(`choices-${lang}-${width}`);
      await click('[data-filter=seen]');await check('!document.querySelector("[data-empty]").hidden','new learner seen empty');
      await evaluate('SH.store.markSignSeen("xin-chao")');
      await check('document.querySelectorAll(".practice-choice:not([hidden])").length === 1 && !document.querySelector("[data-slug=xin-chao]").hidden','seen filter store event');
      await click('[data-filter=favorites]');await evaluate('SH.store.toggleFavorite("ba-lo")');
      await check('document.querySelectorAll(".practice-choice:not([hidden])").length === 1 && !document.querySelector("[data-slug=ba-lo]").hidden','favorite filter');
      await click('[data-filter=unpractised]');
      await evaluate('SH.store.addPractice("ba-lo",{handshape:true})');
      await check('document.querySelector("[data-slug=ba-lo]").hidden && document.querySelectorAll(".practice-choice:not([hidden])").length === SH.data.signs.length - 1','unpractised filter');
      await evaluate('SH.store.reset()');
      await check('document.querySelectorAll(".practice-choice:not([hidden])").length === SH.data.signs.length','reset updates choices');
      for(const slug of ['xin-chao','ba-lo']) {
        await navigate(`/app/practice/${slug}?lang=${lang}`);
        await check('window.__cameraCalls.length === 0 && document.querySelector("[data-camera]").srcObject === null && document.querySelector("[data-camera]").hidden','no automatic camera');
        await check('document.querySelectorAll("h1").length === 1 && document.documentElement.scrollWidth <= innerWidth','session layout');
        await check(`(()=>{const stages=[...document.querySelectorAll('.practice-stage')].map(el=>el.getBoundingClientRect());return Math.abs(stages[0].height-stages[1].height)<1 && stages.every(r=>Math.abs(r.width/r.height-16/9)<0.03)})()`,'equal 16:9 media stages');
        await check('document.querySelectorAll("[data-check]").length === 5 && !document.querySelector("form")','five accessible checklist fields');
        await screenshot(`session-${slug}-${lang}-${width}`);
        if(slug==='ba-lo') {
          await waitFor('document.querySelector("[data-reference]").readyState>=1');
          await click('[data-rate="0.5"]');
          await waitFor(`document.querySelector('[data-rate="0.5"]').getAttribute('aria-pressed')==='true'`);
          await click('[data-loop]');
          await check('document.querySelector("[data-reference]").playbackRate===0.5 && document.querySelector("[data-reference]").loop && document.querySelector("[data-reference]").muted','reference controls');
        } else await check('!!document.querySelector(".sh-video-placeholder") && !document.querySelector("[data-reference]")','missing reference placeholder');
        await evaluate('document.querySelector("[data-camera-start]").focus()');
        await key('Enter','Enter',13);
        await waitFor('!document.querySelector("[data-camera-live]").hidden && document.querySelector("[data-camera]").readyState>=2');
        await check('window.__cameraCalls.length===1 && window.__cameraCalls[0].audio===false && window.__cameraCalls[0].video.width.ideal===1280 && window.__cameraCalls[0].video.height.ideal===720 && window.__cameraCalls[0].video.facingMode==="user"','exact camera constraints');
        await check('document.querySelector("[data-camera]").srcObject.getAudioTracks().length===0 && document.querySelector("[data-camera]").classList.contains("practice-is-mirrored")','silent mirror default');
        await check('getComputedStyle(document.querySelector("[data-camera-live]")).position==="fixed"','camera-on indicator remains visible while scrolling');
        await click('[data-mirror]');
        await check('document.querySelector("[data-mirror]").getAttribute("aria-pressed")==="false" && !document.querySelector("[data-camera]").classList.contains("practice-is-mirrored")','mirror toggle');
        if(slug==='ba-lo') await screenshot(`live-${lang}-${width}`);
        await click('[data-camera-stop]');
        await check(noLiveStreams+' && document.querySelector("[data-camera-live]").hidden && document.querySelector("[data-camera]").srcObject===null','stop releases every track');
        await evaluate('document.querySelector("[data-check=handshape]").checked=true;document.querySelector("[data-check=expression]").checked=true');
        await click('[data-save]');
        await check(`SH.store.practiceLog().filter(e=>e.slug==='${slug}').length===1 && document.querySelector('[data-history] strong').textContent===SH.t('practice.history.score',{n:2})`,'save self assessment');
        await check('!document.querySelector("[data-check]:checked") && !!document.querySelector("[data-saved]").textContent','reset checklist and announce save');
        await check('SH.store.summary().signsSeen===0 && SH.store.summary().lessonsInProgress===0 && SH.store.summary().lessonsCompleted===0','practice never marks seen or completes a lesson');
        await evaluate(`for(let n=0;n<12;n++)SH.store.addPractice('${slug}',{handshape:n%2===0,location:false,orientation:false,movement:false,expression:false});SH.store.addPractice('unrelated-test-sign',{})`);
        await check('document.querySelectorAll("[data-history] li").length===10 && document.querySelectorAll("[data-history] time").length===10','history capped and scoped');
        const oldToken=await evaluate('window.__testDocumentToken');
        await cdp('Page.reload',{ignoreCache:true});
        await waitFor(`window.__testDocumentToken !== ${oldToken} && document.readyState==='complete' && document.querySelectorAll('[data-history] li').length===10`);
        await check('window.__cameraCalls.length===0','reload never reopens camera');
        await evaluate('SH.store.reset()');
        await check('document.querySelectorAll("[data-history] li").length===0 && !document.querySelector("[data-history-empty]").hidden','history store reset');
      }
      console.log(`PASS ${browserName}: list, sessions, granted camera, history; ${lang}, ${width}px`);
    }
  }
  await navigate('/app/practice/ba-lo?lang=en');
  await click('[data-round-start]');
  await check('document.querySelector("[data-countdown]").textContent==="3"','countdown begins at three');
  await waitFor('document.querySelector("[data-countdown]").textContent==="2"');assertions++;
  await waitFor('document.querySelector("[data-countdown]").textContent==="1"');assertions++;
  await waitFor('document.querySelector("[data-countdown]").textContent===SH.t("practice.round.perform")');assertions++;
  await evaluate('document.querySelector("[data-check=movement]").checked=true');await click('[data-retry]');
  await check('document.querySelector("[data-countdown]").hidden && !document.querySelector("[data-check]:checked")','retry clears draft and timer');
  await click('[data-round-start]');await click('[data-countdown-cancel]');
  await check('document.querySelector("[data-countdown]").hidden && !document.querySelector("[data-round-start]").disabled','cancel countdown');
  await evaluate('document.querySelector("[data-countdown-enabled]").checked=false');await click('[data-round-start]');
  await check('document.querySelector("[data-countdown]").textContent===SH.t("practice.round.perform")','countdown is optional');
  await click('[data-retry]');
  for(const [name,keyName] of [['NotFoundError','missing'],['OverconstrainedError','missing'],['NotReadableError','busy'],['AbortError','busy'],['UnexpectedError','error']]) {
    await evaluate(`window.__cameraMode=${JSON.stringify(name)}`);await click('[data-camera-start]');
    await waitFor(`document.querySelector('[data-camera-status]').textContent===SH.t('practice.camera.${keyName}')`);
    await check('!document.querySelector("[data-camera-start]").disabled && !document.querySelector("[data-save]").disabled','camera errors never block assessment');
    await click('[data-save]');assertions++;
  }
  // Real browser permission denial, using only the synthetic camera device.
  await evaluate('window.__cameraMode="normal"');
  await cdp('Browser.setPermission',{origin:base,permission:{name:'camera'},setting:'denied'});
  await click('[data-camera-start]');
  await waitFor('document.querySelector("[data-camera-status]").textContent===SH.t("practice.camera.denied")');assertions++;
  await screenshot('camera-denied');
  await cdp('Browser.grantPermissions',{origin:base,permissions:['videoCapture']});
  // Cancel a pending request. A late stream must be stopped as soon as it arrives.
  await evaluate('window.__cameraMode="pending"');await click('[data-camera-start]');await click('[data-camera-stop]');
  await evaluate('(async()=>{const stream=await window.__nativeCamera({video:true,audio:false});window.__streams.push(stream);window.__resolveCamera(stream);})()');
  await waitFor(noLiveStreams);assertions++;
  await check('document.querySelector("[data-camera]").srcObject===null && document.querySelector("[data-camera-live]").hidden','late camera result stays off');
  await evaluate('window.__fastTimeout=true');await click('[data-camera-start]');
  await waitFor('document.querySelector("[data-camera-status]").textContent===SH.t("practice.camera.timeout")');assertions++;
  await check('!document.querySelector("[data-camera-start]").disabled','permission wait has finite timeout');
  await evaluate('window.__fastTimeout=false;window.__cameraMode="normal"');await click('[data-camera-start]');
  await waitFor('!document.querySelector("[data-camera-live]").hidden');
  await evaluate('Object.defineProperty(document,"hidden",{configurable:true,value:true});document.dispatchEvent(new Event("visibilitychange"))');
  await check(noLiveStreams+' && document.querySelector("[data-camera-live]").hidden','hidden page releases tracks');
  await evaluate('delete document.hidden');await click('[data-camera-start]');await waitFor('!document.querySelector("[data-camera-live]").hidden');
  await evaluate('window.dispatchEvent(new PageTransitionEvent("pagehide"))');
  await check(noLiveStreams+' && document.querySelector("[data-camera-live]").hidden','pagehide releases tracks');
  await navigate('/app/practice/ba-lo?lang=en');
  await evaluate('Object.defineProperty(window,"isSecureContext",{configurable:true,value:false});true');await click('[data-camera-start]');
  await check('document.querySelector("[data-camera-status]").textContent===SH.t("practice.camera.insecure") && window.__cameraCalls.length===0','insecure context guidance');
  await navigate('/app/practice/xin-chao?lang=en');
  await evaluate('Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:undefined});true');await click('[data-camera-start]');
  await check('document.querySelector("[data-camera-status]").textContent===SH.t("practice.camera.unsupported")','unsupported browser guidance');
  // SSR stays usable without JavaScript; camera and persistence controls stay hidden.
  await cdp('Emulation.setScriptExecutionDisabled',{value:true});
  for(const lang of ['vi','en']) {
    await cdp('Page.navigate',{url:base+`/app/practice?lang=${lang}`});
    await waitFor(`document.readyState==='complete' && document.documentElement.lang==='${lang}' && !!document.querySelector('.practice-page')`);
    await check('document.querySelectorAll(".practice-choice").length===25 && document.querySelector("[data-filters]").hidden','no-JS choice list');
    await cdp('Page.navigate',{url:base+`/app/practice/ba-lo?lang=${lang}`});
    await waitFor(`document.readyState==='complete' && document.documentElement.lang==='${lang}' && !!document.querySelector('.practice-session')`);
    await check('document.querySelectorAll("[data-check]").length===5 && document.querySelector("[data-camera-controls]").hidden && document.querySelector("[data-reference]").controls','no-JS reference and checklist');
  }
  await cdp('Emulation.setScriptExecutionDisabled',{value:false});
  await navigate('/app/practice/ba-lo?lang=en');await evaluate('SH.store.reset()');
  for(const width of [1024,700,375]) {
    await cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
    await check('document.querySelector(".practice-session").scrollWidth<=document.querySelector(".practice-session").clientWidth','narrow session layout');
  }
  await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await check('getComputedStyle(document.querySelector("[data-countdown]")).animationName==="none"','reduced motion');
  for(const lang of ['vi','en']) {assert.equal((await fetch(base+'/app/practice/khong-co?lang='+lang)).status,404);assertions++;}
  assert.ok(requests.every(request=>['GET','HEAD'].includes(request.method)&&!request.hasPostData),'No image uploads or other outbound writes');
  // Chromium reports its built-in media-control data: SVG icons here too;
  // those are internal resources, not requests sent over the network.
  const networkRequests=requests.filter(request=>/^(https?|wss?):/.test(request.url));
  const external=networkRequests.filter(request=>!request.url.startsWith(base+'/'));
  assert.deepEqual(external.map(request=>({method:request.method,url:request.url.slice(0,100)})),[],'No external requests from practice');
  assert.deepEqual(errors,[],'No browser exceptions or missing translations');
  console.log(`PASS ${browserName}: ${assertions} browser assertions; fake camera allowed/denied/errors, cancellation/lifecycle, countdown, history, VI/EN, layout, no JS; all ${networkRequests.length} network requests are read-only and local.`);
} finally {
  const closed=new Promise(resolve=>ws.addEventListener('close',resolve,{once:true}));ws.close();await closed;
  await fetch(debug+'/json/close/'+target.id);
}
