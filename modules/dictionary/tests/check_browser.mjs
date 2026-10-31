/* No dependencies. Use an isolated Chrome headless profile on debugging port 9333.
   node modules/dictionary/tests/check_browser.mjs [base-url] [--screenshots]
   Optional screenshots go only to this module's .qa directory. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.argv.find(arg => arg.startsWith('http')) || 'http://127.0.0.1:8014';
const debug = 'http://127.0.0.1:9333';
const target = await (await fetch(debug + '/json/new?about:blank', { method: 'PUT' })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.addEventListener('open', resolve); ws.addEventListener('error', reject); });
const pending = new Map();
const errors = [];
let serial = 0;
let assertions = 0;
ws.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (pending.has(message.id)) {
    const { resolve, reject, timer } = pending.get(message.id);
    clearTimeout(timer); pending.delete(message.id);
    if (message.error) reject(new Error(JSON.stringify(message.error)));
    else resolve(message.result);
  }
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
  if (message.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(message.params.type)) {
    errors.push(message.params.args.map(arg => arg.value || arg.description).join(' '));
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
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  const diagnostic = await evaluate(`({url:location.href,video:(()=>{const v=document.querySelector('video');return v?{ready:v.readyState,network:v.networkState,error:v.error&&v.error.message,source:v.currentSrc}:null})()})`);
  throw new Error('Condition failed: ' + expression + ' ' + JSON.stringify(diagnostic));
}
async function navigate(path, selector) {
  await cdp('Page.navigate', { url: base + path });
  await waitFor(`location.href === ${JSON.stringify(base + path)} && document.readyState === 'complete' && !!document.querySelector(${JSON.stringify(selector)})`);
}
async function check(expression, message) {
  assert.equal(await evaluate(expression), true, message);
  assertions++;
}
async function key(key, code) {
  const virtualKey = { Enter:13, Escape:27, '/':191 }[key];
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode:virtualKey, nativeVirtualKeyCode:virtualKey, ...(key === 'Enter' ? {text:'\r',unmodifiedText:'\r'} : {}) });
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode:virtualKey, nativeVirtualKeyCode:virtualKey });
}
async function query(value) {
  await evaluate(`(() => { const input = document.querySelector('[data-search-input]'); input.value = ${JSON.stringify(value)}; input.dispatchEvent(new Event('input', {bubbles:true})); })()`);
}
async function screenshot(name) {
  if (!process.argv.includes('--screenshots')) return;
  await evaluate('window.scrollTo({top:0,behavior:"instant"})');
  const folder = new URL('../.qa/', import.meta.url);
  await mkdir(folder, { recursive: true });
  const result = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(new URL(name + '.png', folder), Buffer.from(result.data, 'base64'));
}
const visibleSlugs = `Array.from(document.querySelectorAll('.dictionary-page .dictionary-item:not([hidden])')).map(el => el.dataset.slug)`;

try {
  await cdp('Page.enable'); await cdp('Runtime.enable');
  await cdp('Emulation.setFocusEmulationEnabled', {enabled:true});
  for (const width of [1440, 1280]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    for (const lang of ['vi', 'en']) {
      await navigate(`/app/dictionary?lang=${lang}`, '.dictionary-page');
      await waitFor('!!window.SH && !document.querySelector("[data-toolbar]").hidden');
      await evaluate('SH.store.reset()');
      await check(`${visibleSlugs}.length === SH.data.signs.length`, 'all open signs, new learner');
      await check('document.querySelectorAll("h1").length === 1 && document.documentElement.scrollWidth <= innerWidth', 'list heading and layout');
      await check('getComputedStyle(document.querySelector(".dictionary-grid")).gridTemplateColumns.split(" ").length === 3', 'three columns on laptop');
      await check('document.querySelectorAll("[data-module-filter][disabled]").length === 7', 'unavailable modules disabled');
      await check('Array.from(document.querySelectorAll(".dictionary-item")).every(el => el.dataset.search && el.dataset.module && el.querySelector(".sh-badge--sample") && el.querySelector(".dictionary-card-video").textContent === SH.t(SH.sign(el.dataset.slug).video ? "dictionary.video.imported" : "dictionary.video.missing"))', 'SSR card content');
      await screenshot(`dictionary-${lang}-${width}`);
      for (const [term, slug] of [['cam on','cam-on'], ['THANK','cam-on'], ['bo','bo'], ['on cam','cam-on'], ['bày tỏ','cam-on'], ['speaker','toi']]) {
        await query(term);
        await check(`JSON.stringify(${visibleSlugs}) === ${JSON.stringify(JSON.stringify([slug]))}`, 'search: ' + term);
      }
      await query('no-such-sign');
      await check('!document.querySelector("[data-empty]").hidden && document.querySelector("[data-result-count]").textContent === SH.t("dictionary.results",{n:0})', 'empty result and live count');
      await evaluate('document.querySelector("[data-clear-filters]").click()');
      await check(`${visibleSlugs}.length === SH.data.signs.length && document.activeElement === document.querySelector('[data-search-input]')`, 'clear restores signs and focus');
      await evaluate('document.activeElement.blur()');
      await key('/', 'Slash');
      await check('document.activeElement === document.querySelector("[data-search-input]")', 'slash focuses search');
      await query('cam on');
      await key('Escape', 'Escape');
      await check(`${visibleSlugs}.length === SH.data.signs.length && document.querySelector('[data-search-input]').value === ''`, 'escape clears search');
      await evaluate('document.querySelector("[data-favorites-filter]").click()');
      await check(`${visibleSlugs}.length === 0`, 'empty favorites');
      await evaluate('SH.store.toggleFavorite("cam-on")');
      await check(`JSON.stringify(${visibleSlugs}) === '["cam-on"]' && !document.querySelector('[data-slug="cam-on"] [data-favorite-mark]').hidden`, 'store event updates favorites filter');
      await evaluate(`document.querySelector('[data-module-filter="1"]').click()`);
      await query('bo');
      await check(`${visibleSlugs}.length === 0`, 'search intersects module and favorites');
      await evaluate('document.querySelector("[data-clear-filters]").click()');
      await check('document.querySelector("[data-module-filter=all]").getAttribute("aria-pressed") === "true" && document.querySelector("[data-favorites-filter]").getAttribute("aria-pressed") === "false"', 'clear resets every filter');
      await check('SH.store.summary().signsSeen === 0 && SH.store.summary().lessonsInProgress === 0', 'list never records progress');
      for (const slug of ['cam-on', 'bo']) {
        await navigate(`/app/signs/${slug}?lang=${lang}`, '.dictionary-detail');
        await waitFor('!!window.SH && !document.querySelector("[data-favorite]").hidden');
        await check('document.querySelectorAll("h1").length === 1 && document.documentElement.scrollWidth <= innerWidth', 'detail heading and layout');
        await check('!!document.querySelector(".sh-video-placeholder") && document.querySelector(".sh-video-placeholder").textContent.trim() === SH.t("shell.video.missing")', 'missing approved video');
        await check('document.querySelector(".dictionary-facts dd:last-child").textContent === SH.t("dictionary.variants.empty")', 'honest variant disclosure');
        await check(`!document.querySelector('.dictionary-related [data-slug="${slug}"]')`, 'related excludes current sign');
        await check(`document.querySelectorAll('.dictionary-related .dictionary-item').length === ${slug === 'bo' ? 5 : 6}`, 'related same lesson');
        await check('Array.from(document.querySelectorAll(".dictionary-detail a")).every(a => a.href.includes("lang="))', 'localized detail links');
        await screenshot(`detail-${slug}-${lang}-${width}`);
        const on = await evaluate('SH.store.isFavorite(document.querySelector(".dictionary-detail").dataset.slug)');
        await evaluate('document.querySelector("[data-favorite]").focus()');
        await key('Enter', 'Enter');
        await check(`document.querySelector('[data-favorite]').getAttribute('aria-pressed') === '${!on}' && SH.store.isFavorite('${slug}') === ${!on}`, 'keyboard favorite action');
        await cdp('Page.reload', {ignoreCache:true});
        await waitFor(`document.readyState === 'complete' && document.querySelector('[data-favorite]').getAttribute('aria-pressed') === '${!on}'`);
        await check(`SH.store.isFavorite('${slug}') === ${!on}`, 'favorite persists reload');
        await evaluate('SH.store.reset()');
        await check('document.querySelector("[data-favorite]").getAttribute("aria-pressed") === "false" && SH.store.summary().signsSeen === 0 && SH.store.summary().lessonsInProgress === 0', 'detail reset, no progress writes');
      }
      console.log(`PASS list and two details: ${lang}, ${width}px`);
    }
  }
  const localSigns = await evaluate('SH.data.signs.filter(sign => sign.video && sign.lesson === null)');
  if (localSigns.length) {
    await navigate('/app/dictionary?lang=vi', '.dictionary-page');
    await evaluate(`document.querySelector('[data-module-filter="local"]').click()`);
    await check(`${visibleSlugs}.length === ${localSigns.length}`, 'local collection filter');
    await screenshot('local-collection-vi');
    for (const width of [1440, 1280]) {
      await cdp('Emulation.setDeviceMetricsOverride', {width,height:1000,deviceScaleFactor:1,mobile:false});
      for (const lang of ['vi', 'en']) {
        for (const sign of localSigns) {
          await navigate(`/app/signs/${sign.slug}?lang=${lang}`, '.dictionary-detail');
          await waitFor('document.querySelector("video") && document.querySelector("video").readyState >= 1');
          await check('document.querySelector("video").videoWidth > 0 && document.querySelector("video").muted && document.querySelector("video").volume === 0 && !!document.querySelector(".dictionary-video-notice")', 'real MP4 decoded and unreviewed notice');
          await check('document.documentElement.scrollWidth <= innerWidth && !document.querySelector(".dictionary-lesson a") && document.querySelectorAll(".dictionary-related .dictionary-item").length === 11', 'standalone collection layout and related signs');
          await evaluate('(async () => {const video=document.querySelector("video"); await video.play();})()');
          await waitFor('document.querySelector("video").currentTime > 0.05');
          await evaluate('document.querySelector("video").pause(); document.querySelector("video").currentTime = document.querySelector("video").duration * 0.6');
          await waitFor('!document.querySelector("video").seeking && document.querySelector("video").currentTime >= document.querySelector("video").duration * 0.5');
          assertions++;
          await check('document.querySelector("video").error === null && SH.store.summary().signsSeen === 0', 'play and seek leave progress intact');
          if (['ba-lo', 'anh'].includes(sign.slug)) await screenshot(`video-${sign.slug}-${lang}-${width}`);
        }
        console.log(`PASS 12 real MP4s, playback and seeking: ${lang}, ${width}px`);
      }
    }
  }
  // No JavaScript: full list and sign definitions still render.
  await cdp('Emulation.setScriptExecutionDisabled', {value:true});
  for (const lang of ['vi', 'en']) {
    await navigate(`/app/dictionary?lang=${lang}`, '.dictionary-page');
    await check('document.querySelectorAll(".dictionary-item:not([hidden])").length === JSON.parse(document.getElementById("sh-data").textContent).signs.length && document.querySelector("[data-toolbar]").hidden', 'no-JS catalogue');
    await navigate(`/app/signs/bo?lang=${lang}`, '.dictionary-detail');
    await check('!!document.querySelector("h1").textContent && !!document.querySelector(".sh-lead").textContent && document.querySelector("[data-favorite]").hidden', 'no-JS detail');
    await screenshot(`no-js-detail-${lang}`);
    if (localSigns.length) {
      await navigate(`/app/signs/ba-lo?lang=${lang}`, '.dictionary-detail');
      await check('document.querySelector("video").controls && document.querySelector("video").hasAttribute("muted") && document.querySelector("[data-favorite]").hidden', 'local video available without JS');
    }
  }
  await cdp('Emulation.setScriptExecutionDisabled', {value:false});
  for (const path of ['/app/dictionary?lang=en','/app/signs/bo?lang=en']) {
    await navigate(path, path.includes('/signs/') ? '.dictionary-detail' : '.dictionary-page');
    for (const width of [1024, 700, 375]) {
      await cdp('Emulation.setDeviceMetricsOverride', {width,height:900,deviceScaleFactor:1,mobile:false});
      await check('document.querySelector(".dictionary-page, .dictionary-detail").scrollWidth <= document.querySelector(".dictionary-page, .dictionary-detail").clientWidth', 'narrow module layout');
    }
  }
  for (const lang of ['vi','en']) {
    assert.equal((await fetch(base + '/app/signs/khong-co?lang=' + lang)).status, 404);
    assertions++;
  }
  assert.deepEqual(errors, [], 'browser exceptions or missing translations');
  console.log(`PASS: ${assertions} browser assertions; VI/EN, 1280/1440px, search, filters, favorites, keyboard, reset, no JS, narrow layouts, 404.`);
} finally {
  const closed = new Promise(resolve => ws.addEventListener('close', resolve, {once:true}));
  ws.close(); await closed;
  await fetch(debug + '/json/close/' + target.id);
}
