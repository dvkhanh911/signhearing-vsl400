/* Dependency-free acceptance tests in a disposable headless Chromium profile.
   node modules/review/tests/check_browser.mjs [base-url] [debug-url] [--screenshots] */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const urls=process.argv.filter(arg=>arg.startsWith('http'));
const base=urls[0]||'http://127.0.0.1:8016';
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
async function waitFor(expression){for(let i=0;i<100;i++){if(await evaluate(expression))return;await new Promise(resolve=>setTimeout(resolve,50));}throw new Error('Condition failed: '+expression+' '+await evaluate('location.href'));}
async function check(expression,message){assert.equal(await evaluate(expression),true,message);assertions++;}
async function click(selector){await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);}
async function navigate(path,selector){const token=await evaluate('window.__testDocumentToken||null');await cdp('Page.navigate',{url:base+path});await waitFor(`window.__testDocumentToken!==${JSON.stringify(token)}&&location.href===${JSON.stringify(base+path)}&&document.readyState==='complete'&&!!window.SH&&!!document.querySelector(${JSON.stringify(selector)})`);}
async function key(value,code,virtualKey){await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:value,code,windowsVirtualKeyCode:virtualKey,...(value==='Enter'?{text:'\r',unmodifiedText:'\r'}:{})});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:value,code,windowsVirtualKeyCode:virtualKey});}
async function screenshot(name){if(!process.argv.includes('--screenshots'))return;await waitFor('getComputedStyle(document.querySelector(".app-frame")).display==="grid"');await evaluate('window.scrollTo({top:0,behavior:"instant"});document.fonts.ready.then(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))');await evaluate('Promise.all(document.getAnimations().filter(a=>a.playState==="running"&&Number.isFinite(a.effect.getTiming().iterations)).map(a=>a.finished.catch(()=>{})))');const folder=new URL('../.qa/',import.meta.url);await mkdir(folder,{recursive:true});const shot=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(new URL(name+'.png',folder),Buffer.from(shot.data,'base64'));}

async function completeQuiz(id,correctCount,feedbackShot){
  const count=await evaluate(`SH.signsOf(${id}).length`);
  const oldResults=await evaluate(`SH.store.quizResults(${id}).length`);
  const previousState=await evaluate(`SH.store.lessonState(${id})`);
  const seen=new Set();
  for(let i=0;i<count;i++){
    const state=await evaluate(`(()=>{const root=document.querySelector('.review-quiz');const options=[...document.querySelectorAll('[data-options] button')];return {slug:root.dataset.currentSlug,slugs:options.map(b=>b.dataset.slug),words:options.map(b=>b.querySelector('.review-option-word').textContent)}})()`);
    assert.ok(!seen.has(state.slug),'One question per sign');seen.add(state.slug);assertions++;
    assert.equal(new Set(state.words.map(word=>word.normalize('NFC').trim().toLowerCase())).size,state.words.length,'Unique visible options');assertions++;
    assert.ok(state.words.length>=2&&state.words.length<=4&&state.slugs.filter(slug=>slug===state.slug).length===1,'Correct answer exactly once');assertions++;
    const selected=state.slugs.findIndex(slug=>i<correctCount?slug===state.slug:slug!==state.slug);
    if(i===0)await key(String(selected+1),'Digit'+(selected+1),49+selected);else await click(`[data-options] button:nth-child(${selected+1})`);
    await check('Array.from(document.querySelectorAll("[data-options] button")).every(b=>b.disabled)&&document.querySelectorAll("[data-options] [aria-pressed=true]").length===1','Answer locks every option');
    await check('document.querySelectorAll("[data-options] .is-correct").length===1&&!!document.querySelector("[data-feedback]").textContent','Symbol feedback and correct answer');
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll("[data-options] .review-option-word")).map(el=>el.textContent)'),state.words,'Options stay stable after choosing');assertions++;
    if(i===0&&feedbackShot)await screenshot(feedbackShot);
    await key(String((selected+1)%state.words.length+1),'Digit1',49);
    await check(`SH.store.quizResults(${id}).length===${oldResults}`,'No result before final screen');
    await click('[data-next-question]');
  }
  await check(`!document.querySelector('[data-result]').hidden&&SH.store.quizResults(${id}).length===${oldResults+1}`,'One result saved after finish');
  await check(`(()=>{const result=SH.store.quizResults(${id}).at(-1);return result.score===${correctCount}&&result.total===${count}})()`,'Actual score and denominator');
  const expected=correctCount/count>=0.8?'completed':previousState;
  await check(`SH.store.lessonState(${id})===${JSON.stringify(expected)}`,'Completion threshold and no downgrade');
  await check(`document.querySelectorAll('[data-mistake-list] li').length===${count-correctCount}`,'Wrong words listed accurately');
  await click('[data-next-question]');await key('1','Digit1',49);
  await check(`SH.store.quizResults(${id}).length===${oldResults+1}`,'Duplicate events cannot save result twice');
}

try{
  await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Network.enable');await cdp('Emulation.setFocusEmulationEnabled',{enabled:true});
  await cdp('Page.addScriptToEvaluateOnNewDocument',{source:`
    window.__testDocumentToken=Math.random();
    (function(){const query=new URL(location.href).searchParams;const count=Number(query.get('test-count'));const video=query.has('test-video');const xss=query.has('test-xss');if(!count&&!video&&!xss)return;let api;Object.defineProperty(window,'SH',{configurable:true,get(){return api;},set(value){api=Object.freeze({...value,signsOf(id){let signs=value.signsOf(id).map(sign=>({...sign}));if(count)signs=signs.slice(0,count);if(video&&signs[0])signs[0].video='/static/media/local-videos/ba-lo.mp4';if(xss&&signs[0]){signs[0].word='<img src=x onerror=bad()> & test';signs[0].meaning='<span id=quiz-xss>unsafe</span>';}return signs;}});}});})();
  `});
  for(const width of [1440,1280]){
    await cdp('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
    for(const lang of ['vi','en']){
      await navigate(`/app/review?lang=${lang}`,'.review-page');await evaluate('SH.store.reset()');
      await check('!document.querySelector("[data-flash-empty]").hidden&&document.querySelectorAll(".review-lesson").length===2','New learner empty source and eligible quizzes');
      await check('document.querySelectorAll("h1").length===1&&document.documentElement.scrollWidth<=innerWidth','Review layout');
      await screenshot(`review-new-${lang}-${width}`);
      await evaluate('SH.store.markSignSeen("xin-chao");SH.store.markSignSeen("tam-biet")');
      const snapshot=await evaluate('JSON.stringify(SH.store.export())');
      await click('[data-flip]');await check('document.querySelector("[data-flip]").getAttribute("aria-expanded")==="true"&&!document.querySelector("[data-flash-back]").inert','Accessible flip');
      await evaluate('document.querySelector("[data-flash-scene]").focus()');await key(' ','Space',32);
      await check('document.querySelector("[data-flip]").getAttribute("aria-expanded")==="false"','Space flips once');
      await key('Enter','Enter',13);await check('document.querySelector("[data-flip]").getAttribute("aria-expanded")==="true"','Enter flips once');
      await key('ArrowRight','ArrowRight',39);
      await check('document.querySelector(".review-page").dataset.currentSlug==="tam-biet"&&document.querySelector("[data-flip]").getAttribute("aria-expanded")==="false"','Arrows switch and reset face');
      await click('[data-forgot]');await check('document.querySelector(".review-page").dataset.currentSlug==="xin-chao"','Not remembered goes to queue end');
      await click('[data-remembered]');await click('[data-remembered]');
      await check('!document.querySelector("[data-flash-done]").hidden&&document.querySelector("[data-flash-bar]").style.width==="100%"','Finish flashcard queue');
      assert.equal(await evaluate('JSON.stringify(SH.store.export())'),snapshot,'Flashcards never persist their self-assessment');assertions++;
      await click('[data-flash-restart]');await check('!document.querySelector("[data-flash-active]").hidden','Restart flashcards');
      await click('[data-source=favorites]');await check('!document.querySelector("[data-flash-empty]").hidden','Empty favorites source');
      await evaluate('SH.store.toggleFavorite("ba-lo")');
      await waitFor('document.querySelector("[data-flash-media] video")&&document.querySelector("[data-flash-media] video").readyState>=1');
      await check('document.querySelector("[data-flash-word]").hidden&&!document.querySelector("[data-flash-sample]").hidden','Video front hides answer and shows sample badge');
      await evaluate('(async()=>{await document.querySelector("[data-flash-media] video").play()})()');await click('[data-flip]');
      await check('document.querySelector("[data-flash-media] video").paused','Flipping pauses video');
      await screenshot(`flash-answer-${lang}-${width}`);
      await click('[data-flip]');await evaluate('document.querySelector("[data-flash-media] video").dispatchEvent(new Event("error"))');
      await check('!document.querySelector("[data-flash-word]").hidden&&!!document.querySelector(".sh-video-placeholder")','Media failure switches to word front');
      await click('[data-source=lesson]');
      await evaluate('document.querySelector("[data-lesson-select]").value="2";document.querySelector("[data-lesson-select]").dispatchEvent(new Event("change"))');
      await check('document.querySelector(".review-page").dataset.currentSlug==="gia-dinh"&&document.querySelector("[data-flash-progress]").textContent===SH.t("review.flash.progress",{done:0,total:6})','By-lesson source');
      await evaluate('SH.store.reset()');
      await navigate(`/app/review/quiz/1?lang=${lang}`,'.review-quiz');await screenshot(`quiz-question-${lang}-${width}`);await completeQuiz(1,5,`quiz-feedback-${lang}-${width}`);
      await screenshot(`quiz-fail-${lang}-${width}`);
      await click('[data-retry]');await completeQuiz(1,6);
      await screenshot(`quiz-pass-${lang}-${width}`);
      await navigate(`/app/courses?lang=${lang}`,'.courses');
      await check(`document.querySelector('[data-lesson-id="1"]').dataset.state==='completed'`,'Courses receives completed state');
      await navigate(`/app/review/quiz/1?lang=${lang}`,'.review-quiz');await completeQuiz(1,0);
      await check('document.querySelector("[data-best]").textContent===SH.t("review.best",{score:6,total:7,percent:86})','A later lower score keeps the best result');
      await navigate(`/app/review/quiz/2?lang=${lang}`,'.review-quiz');await completeQuiz(2,4);
      await click('[data-retry]');await completeQuiz(2,5);
      await check('SH.store.summary().signsSeen===0&&SH.store.summary().practiceCount===0','Quizzes do not fake viewed or practice counts');
      console.log(`PASS review and lesson 1/2 quizzes, threshold, no downgrade: ${lang}, ${width}px`);
    }
  }
  // Exactly 80% boundary in a five-question fixture, without changing curriculum files.
  await navigate('/app/review/quiz/1?lang=en&test-count=5','.review-quiz');await evaluate('SH.store.reset()');await completeQuiz(1,4);
  await check('SH.store.lessonState(1)==="completed"','Exactly 80 percent completes');
  await click('[data-retry]');await evaluate('SH.store.reset()');await completeQuiz(1,3);
  await check('SH.store.lessonState(1)==="not_started"','Below 80 percent leaves untouched state');
  // Partially answered attempts are never committed on reload.
  await click('[data-retry]');await click('[data-options] button');
  const before=await evaluate('SH.store.quizResults(1).length');
  await navigate('/app/review/quiz/1?lang=en','.review-quiz');
  await check(`SH.store.quizResults(1).length===${before}&&document.querySelector('[data-next-question]').disabled`,'Abandoning partial attempt never saves');
  // Duplicate global words are filtered from distractors.
  await navigate('/app/review/quiz/1?lang=vi&test-count=2','.review-quiz');
  await evaluate('(()=>{const first=SH.data.signs.find(s=>s.slug==="xin-chao"),second=SH.data.signs.find(s=>s.slug==="tam-biet");SH.data.signs.splice(0,SH.data.signs.length,first,second,{...first,slug:"duplicate-test",word:" Xin  chào ",lesson:null},{...second,slug:"duplicate-two",lesson:null});})()');await click('[data-retry]');
  await completeQuiz(1,2);
  // Future video question branch and content escaping, using only a local fixture.
  await navigate('/app/review/quiz/1?lang=en&test-video=1&test-xss=1','.review-quiz');
  for(let i=0;i<7;i++){
    if(await evaluate('!document.querySelector("[data-question-media]").hidden'))break;
    await click('[data-options] button');await click('[data-next-question]');
  }
  await waitFor('document.querySelector("[data-question-media] video")&&document.querySelector("[data-question-media] video").readyState>=1');
  await check('document.querySelector("[data-question]").textContent===SH.t("review.quiz.video_question")&&!document.querySelector("#quiz-xss")&&!document.querySelector("[data-options] img")','Video branch and escaped option content');
  await evaluate('document.querySelector("[data-question-media] video").dispatchEvent(new Event("error"))');
  await check('document.querySelector("[data-question]").textContent.includes("<span id=quiz-xss>")&&!document.querySelector("#quiz-xss")','Video error uses safe text question');
  await cdp('Emulation.setScriptExecutionDisabled',{value:true});
  for(const lang of ['vi','en']){
    await cdp('Page.navigate',{url:base+`/app/review?lang=${lang}`});
    await waitFor(`document.readyState==='complete'&&document.documentElement.lang==='${lang}'&&!!document.querySelector('.review-page')`);
    await check('document.querySelectorAll(".review-lesson").length===2&&document.querySelector("[data-flash-tools]").hidden','No-JS quiz list');
    await cdp('Page.navigate',{url:base+`/app/review/quiz/1?lang=${lang}`});
    await waitFor(`document.readyState==='complete'&&document.documentElement.lang==='${lang}'&&!!document.querySelector('.review-quiz')`);
    await check('document.querySelector("[data-quiz-app]").hidden&&document.querySelectorAll(".review-reading li").length===7','No-JS lesson reading');
  }
  await cdp('Emulation.setScriptExecutionDisabled',{value:false});
  await navigate('/app/review?lang=en','.review-page');await evaluate('SH.store.reset()');await click('[data-source=lesson]');
  await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await click('[data-flip]');
  await check('getComputedStyle(document.querySelector("[data-flash-inner]")).transform==="none"&&getComputedStyle(document.querySelector("[data-flash-front]")).visibility==="hidden"','Reduced-motion accessible flip');
  for(const width of [1024,700,375]){await cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});await check('document.querySelector(".review-page").scrollWidth<=document.querySelector(".review-page").clientWidth','Narrow review layout');}
  await navigate('/app/review/quiz/1?lang=en','.review-quiz');await evaluate('SH.store.reset()');
  await check('document.querySelectorAll("[data-options] button:disabled").length===0&&document.querySelector("[data-best]").textContent===SH.t("review.best.empty")','Reset refreshes best score and attempt');
  for(const lang of ['vi','en'])for(const id of ['3','999','abc']){assert.equal((await fetch(base+'/app/review/quiz/'+id+'?lang='+lang)).status,404);assertions++;}
  assert.deepEqual(errors,[],'No missing translations or browser exceptions');
  const network=requests.filter(request=>/^(https?|wss?):/.test(request.url));
  assert.ok(network.every(request=>request.url.startsWith(base+'/')&&['GET','HEAD'].includes(request.method)&&!request.hasPostData),'Read-only local page requests only');
  console.log(`PASS: ${assertions} browser assertions; VI/EN, 1440/1280px, flashcard queue, video/text, unique stable options, 80% boundary, saved-once results, courses integration, no downgrade, reset, no JS, XSS and 404.`);
}finally{const closed=new Promise(resolve=>ws.addEventListener('close',resolve,{once:true}));ws.close();await closed;await fetch(debug+'/json/close/'+target.id);}
