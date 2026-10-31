/* Dependency-free Chrome DevTools checks in an isolated headless test profile.
   Start Chrome with --headless=new --remote-debugging-port=9333 and a disposable profile.
   Run: node modules/lesson/tests/check_browser.mjs [base-url] [--screenshots]
   Screenshots, if requested, are written only inside this module's .qa directory. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const base = process.argv.find((arg) => arg.startsWith('http')) || 'http://127.0.0.1:8012';
const debug = 'http://127.0.0.1:9333';
const target = await (await fetch(debug + '/json/new?about:blank', { method: 'PUT' })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.addEventListener('open', resolve); ws.addEventListener('error', reject); });
const pending = new Map();
const errors = [];
let serial = 0;
let count = 0;
ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject, timer } = pending.get(message.id);
    clearTimeout(timer);
    pending.delete(message.id);
    if (message.error) reject(new Error(JSON.stringify(message.error)));
    else resolve(message.result);
  }
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
  if (message.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(message.params.type)) {
    errors.push(message.params.args.map((arg) => arg.value || arg.description).join(' '));
  }
});
function cdp(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++serial;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('Timeout: ' + method)); }, 12000);
    pending.set(id, { resolve, reject, timer });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function waitFor(expression) {
  for (let i = 0; i < 80; i++) {
    if (await evaluate(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Condition failed: ' + expression);
}
async function navigate(path) {
  await cdp('Page.navigate', { url: base + path });
  await waitFor(`location.href === ${JSON.stringify(base + path)} || location.href.startsWith(${JSON.stringify(base + path + '#')})`);
  await waitFor('document.readyState === "complete" && !!window.SH');
}
async function check(expression, message) {
  assert.equal(await evaluate(expression), true, message);
  count++;
}
async function key(key, code) {
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key, code });
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key, code });
}
async function screenshot(name) {
  if (!process.argv.includes('--screenshots')) return;
  const folder = new URL('../.qa/', import.meta.url);
  await mkdir(folder, { recursive: true });
  const result = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(new URL(name + '.png', folder), Buffer.from(result.data, 'base64'));
}

try {
  await cdp('Page.enable');
  await cdp('Runtime.enable');
  for (const width of [1440, 1280]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    for (const lang of ['vi', 'en']) {
      for (const id of [1, 2]) {
        await navigate(`/app/lessons/${id}?lang=${lang}`);
        await evaluate('SH.store.reset()');
        await check(`SH.store.lessonState(${id}) === 'not_started' && SH.store.summary().signsSeen === 0`, 'reset is reflected');
        await cdp('Page.reload', { ignoreCache: true });
        await waitFor(`document.readyState === 'complete' && document.querySelector('[data-lesson-state]').textContent === SH.t('shell.state.in_progress')`);
        await check('document.querySelectorAll("article[data-slug]:not([hidden])").length === 1', 'single sign enhancement');
        await check('document.querySelectorAll("h1").length === 1 && document.documentElement.scrollWidth <= innerWidth', 'heading and horizontal layout');
        await check('SH.store.summary().signsSeen === 0', 'opening does not mark viewed');
        await check(`document.querySelector('[data-seen-count]').textContent === SH.t('lesson.progress', {seen:0,total:SH.signsOf(${id}).length})`, 'new learner count');
        await check('document.querySelectorAll("video").length === 0 && !!document.querySelector("article:not([hidden]) .sh-video-placeholder")', 'real missing-video state');
        await check('Array.from(document.querySelectorAll(".lesson-page a[href^=\"/\"]")).every(a => a.href.includes("lang="))', 'localized links');
        await evaluate('window.scrollTo(0, 0)');
        await screenshot(`lesson-${id}-${lang}-${width}`);
        await evaluate('document.activeElement.blur()');
        await key('ArrowRight', 'ArrowRight');
        await check('document.querySelector("[data-sign-link][aria-current]").dataset.signLink === SH.signsOf(' + id + ')[1].slug', 'keyboard navigation from body');
        await evaluate('document.querySelector("article:not([hidden]) [data-favorite]").click()');
        await check(`SH.store.isFavorite(SH.signsOf(${id})[1].slug) && document.querySelector('article:not([hidden]) [data-favorite]').getAttribute('aria-pressed') === 'true'`, 'favorite toggle');
        await evaluate('document.querySelector("article:not([hidden]) [data-favorite]").click()');
        await check(`!SH.store.isFavorite(SH.signsOf(${id})[1].slug)`, 'favorite removal');
        await evaluate('document.querySelector("[data-previous]").click()');
        await evaluate('document.querySelector("article:not([hidden]) [data-mark-seen]").click()');
        await check(`SH.store.isSignSeen(SH.signsOf(${id})[0].slug) && location.hash === '#sign-' + SH.signsOf(${id})[1].slug`, 'viewed action advances');
        await check('document.activeElement === document.querySelector("article:not([hidden]) h2")', 'focus follows viewed action');
        await check('document.querySelector("[data-seen-symbol]").textContent === SH.t("lesson.seen.symbol")', 'viewed marker');
        await evaluate('window.lessonInput = document.createElement("input"); document.querySelector(".lesson-page").append(lessonInput); lessonInput.focus()');
        await key('ArrowRight', 'ArrowRight');
        await check(`location.hash === '#sign-' + SH.signsOf(${id})[1].slug`, 'editing ignores arrow shortcut');
        await evaluate('lessonInput.remove(); delete window.lessonInput');
        await evaluate(`location.hash = '#sign-' + SH.signsOf(${id})[3].slug`);
        await waitFor(`document.querySelector('article:not([hidden])').dataset.slug === SH.signsOf(${id})[3].slug`);
        await cdp('Page.reload', { ignoreCache: true });
        await waitFor(`document.readyState === 'complete' && document.querySelector('article:not([hidden])').dataset.slug === SH.signsOf(${id})[3].slug`);
        await check(`SH.store.isSignSeen(SH.signsOf(${id})[0].slug)`, 'progress survives reload');
        await evaluate(`document.querySelector('[data-sign-link]').click(); SH.signsOf(${id}).forEach(() => document.querySelector('article:not([hidden]) [data-mark-seen]').click())`);
        await check(`document.querySelector('[data-quiz]').classList.contains('is-ready') && !document.querySelector('[data-ready]').hidden && SH.store.lessonState(${id}) === 'in_progress'`, 'ready never completes lesson');
        await check('document.querySelector("[data-next]").disabled && document.querySelector("article:not([hidden]) [data-mark-seen]").getAttribute("aria-pressed") === "true"', 'last viewed sign stays selected');
        if (id === 1 && lang === 'en' && width === 1280) {
          await evaluate('document.querySelector(".lesson-footer").scrollIntoView({block:"end"})');
          await screenshot('lesson-ready-en-1280');
        }
        await evaluate(`SH.store.setLessonState(${id}, 'completed')`);
        await cdp('Page.reload', { ignoreCache: true });
        await waitFor(`document.readyState === 'complete' && document.querySelector('[data-lesson-state]').textContent === SH.t('shell.state.completed')`);
        await check(`SH.store.lessonState(${id}) === 'completed'`, 'completed is preserved');
        await evaluate('SH.store.reset()');
        await check('document.querySelectorAll("[data-seen-symbol]").length > 0 && !document.querySelector("[data-quiz]").classList.contains("is-ready") && document.querySelector("[data-ready]").hidden', 'store event resets UI');
        console.log(`PASS lesson ${id}, ${lang}, ${width}px`);
      }
    }
  }
  // Browser history and malformed fragments retain one visible article.
  await navigate('/app/lessons/1?lang=en');
  await evaluate('document.querySelectorAll("[data-sign-link]")[2].click()');
  await evaluate('document.querySelectorAll("[data-sign-link]")[4].click()');
  await evaluate('history.back()');
  await waitFor('location.hash === "#sign-cam-on" && !document.getElementById("sign-cam-on").hidden');
  count++;
  await evaluate('location.hash = "#missing"');
  await waitFor('location.hash === "#sign-xin-chao"');
  count++;
  // No-JS SSR: every sign, observation list, anchor and destination is present.
  await cdp('Emulation.setScriptExecutionDisabled', { value: true });
  for (const lang of ['vi', 'en']) {
    for (const id of [1, 2]) {
      await cdp('Page.navigate', { url: base + `/app/lessons/${id}?lang=${lang}` });
      await waitFor(`document.readyState === 'complete' && document.documentElement.lang === '${lang}' && document.querySelector('.lesson-page').dataset.lessonId === '${id}'`);
      await check(`document.querySelectorAll('article:not([hidden])').length === ${id === 1 ? 7 : 6} && !!document.querySelector('[data-mark-seen][hidden]')`, 'no-JS content and actions');
      await check('Array.from(document.querySelectorAll("[data-sign-link]")).every(a => document.getElementById(a.hash.slice(1)))', 'no-JS anchor targets');
      if (id === 2 && lang === 'en') await screenshot('lesson-2-en-no-js');
    }
  }
  await cdp('Emulation.setScriptExecutionDisabled', { value: false });
  await navigate('/app/lessons/1?lang=en');
  // Test the real server-rendered video branch with a disposable generated blank clip.
  const fixture = JSON.parse(execFileSync('python', ['-B', fileURLToPath(new URL('check_render.py', import.meta.url)), '--fixture'], { encoding: 'utf8' }));
  const script = await readFile(new URL('../script.js', import.meta.url), 'utf8');
  await evaluate(`document.body.innerHTML = ${JSON.stringify(fixture)}; document.querySelector('video').removeAttribute('src')`);
  await evaluate(`(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 90;
    canvas.getContext('2d').fillRect(0, 0, 160, 90);
    const stream = canvas.captureStream(10); const recorder = new MediaRecorder(stream);
    const chunks = []; recorder.ondataavailable = e => chunks.push(e.data);
    const done = new Promise(resolve => recorder.onstop = resolve);
    recorder.start(); await new Promise(resolve => setTimeout(resolve, 250)); recorder.stop(); await done;
    const video = document.querySelector('video'); video.src = URL.createObjectURL(new Blob(chunks, {type:recorder.mimeType}));
    stream.getTracks().forEach(track => track.stop());
  })()`);
  await evaluate(script);
  await waitFor('document.querySelector("video").readyState >= 2');
  await check('document.querySelector("video").muted && document.querySelector("video").volume === 0 && !document.querySelector("[data-video-controls]").hidden', 'video enabled and silent');
  await evaluate(`document.querySelector('[data-rate="0.5"]').click()`);
  await waitFor(`document.querySelector('[data-rate="0.5"]').getAttribute('aria-pressed') === 'true'`);
  await check('document.querySelector("video").playbackRate === 0.5', 'half speed');
  await evaluate(`document.querySelector('[data-rate="0.75"]').click(); document.querySelector('[data-loop]').click(); document.querySelector('[data-mirror]').click()`);
  await check('document.querySelector("video").playbackRate === 0.75 && document.querySelector("video").loop && document.querySelector("video").classList.contains("is-mirrored")', 'speed loop mirror');
  await evaluate('document.querySelector("[data-play]").click()');
  await waitFor('!document.querySelector("video").paused');
  await evaluate('document.querySelector("[data-next]").click()');
  await check('document.querySelector("video").paused', 'navigation pauses hidden media');
  await evaluate('document.querySelector("[data-previous]").click(); document.querySelector("video").dispatchEvent(new Event("error"))');
  await check('document.querySelector("video").hidden && document.querySelector("[data-video-controls]").hidden && !document.querySelector("[data-video-missing]").hidden', 'media failure placeholder');
  await navigate('/app/lessons/1?lang=en');
  await evaluate('SH.store.reset()');
  for (const width of [1024, 700, 375]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
    await check('document.querySelector(".lesson-page").scrollWidth <= document.querySelector(".lesson-page").clientWidth', 'narrow module layout');
  }
  await cdp('Emulation.setEmulatedMedia', { features: [{name:'prefers-reduced-motion',value:'reduce'}] });
  await check('getComputedStyle(document.querySelector("[data-progress-bar]")).transitionDuration === "0s"', 'reduced motion');
  assert.deepEqual(errors, [], 'browser exceptions or missing translations');
  console.log(`PASS: ${count} browser assertions; layout matrix, store events, keyboard, history, SSR without JS, video controls.`);
} finally {
  const closed = new Promise((resolve) => ws.addEventListener('close', resolve, { once: true }));
  ws.close();
  await closed;
  await fetch(debug + '/json/close/' + target.id);
}
