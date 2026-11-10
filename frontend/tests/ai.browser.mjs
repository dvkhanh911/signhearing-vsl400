// Loopback authenticated fixture, synthetic camera and mocked inference.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.AI_TEST_URL || "http://127.0.0.1:8017";
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const lang of ["vi", "en"]) {
    const context = await browser.newContext({ viewport: { width: lang === "vi" ? 390 : 1440, height: 1000 }, reducedMotion: "reduce" });
    await context.addInitScript(() => localStorage.setItem("signhearing_onboarding_v1", "skipped"));
    await context.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 640; canvas.height = 480;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "red"; ctx.fillRect(0, 0, 320, 480);
        ctx.fillStyle = "blue"; ctx.fillRect(320, 0, 320, 480);
        return canvas.captureStream(13);
      };
    });
    const page = await context.newPage();
    const posts = [], errors = [], captures = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", request => { if (request.method() === "POST") posts.push(new URL(request.url()).pathname); });
    await page.route("**/infer", route => {
      if (route.request().method() === "POST") {
        const frames = route.request().postDataJSON().frames;
        assert.equal(frames.length, 30);
        assert.ok(frames.every(frame => frame.startsWith("data:image/jpeg;base64,")));
        captures.push(frames[0]);
      }
      return route.fulfill({ status: 200, headers: {
      "Access-Control-Allow-Origin": base, "Access-Control-Allow-Headers": "authorization,content-type",
      }, contentType: "application/json", body: JSON.stringify({ success: true, predicted_gloss: "Test", confidence: 0.5, total_request_time_ms: 50, matches_expected: false }) });
    });
    await page.goto(`${base}/app/practice/an?lang=${lang}`);
    await page.locator(".is-auth-ready").waitFor();
    if (await page.locator("dialog.sh-tour[open]").count()) await page.keyboard.press("Escape");
    const controls = page.locator("[data-camera-controls]");
    assert.deepEqual(await controls.locator("button").evaluateAll(buttons => buttons.map(b => b.hasAttribute("data-camera-start") ? "start" : b.hasAttribute("data-camera-stop") ? "stop" : b.hasAttribute("data-ai-record") ? "record" : "mirror")), ["start", "stop", "record", "mirror"]);
    assert.equal(await page.locator("[data-ai-file], [data-ai-consent], [data-ai-send]").count(), 0);
    assert.equal(await page.locator("[data-ai-record]").isDisabled(), true);
    await page.locator("[data-camera-start]").click();
    await page.locator("[data-camera]:visible").waitFor();
    await page.locator("[data-camera-guide]:visible").waitFor();
    assert.deepEqual(posts, []);
    await page.locator("[data-ai-record]").click();
    assert.equal(await page.locator("[data-ai-countdown-number]").innerText(), "3");
    await page.waitForTimeout(1200);
    assert.equal(await page.locator("[data-ai-countdown-number]").innerText(), "2");
    assert.deepEqual(posts, []);
    await page.locator("[data-ai-recording]:visible").waitFor({ timeout: 5000 });
    assert.deepEqual(posts, []);
    await page.locator("[data-ai-result]:visible").waitFor({ timeout: 15000 });
    assert.deepEqual(posts, ["/api/ai/token", "/infer"]);
    assert.match(await page.locator("[data-ai-result]").innerText(), /50\.0%/);
    assert.equal(await page.locator("[data-history] li").count(), 0);
    await page.locator("[data-mirror]").click();
    await page.locator("[data-ai-record]").click();
    await page.waitForFunction(() => document.querySelector('[data-ai-result]').hidden === true);
    await page.locator("[data-ai-result]:visible").waitFor({ timeout: 15000 });
    const pixels = await page.evaluate(async images => Promise.all(images.map(async src => {
      const bytes = Uint8Array.from(atob(src.split(',')[1]), ch => ch.charCodeAt(0));
      const image = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }));
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
      return Array.from(ctx.getImageData(10, Math.floor(image.height / 2), 1, 1).data);
    })), captures);
    assert.ok(pixels[0][0] > pixels[0][2] && pixels[1][2] > pixels[1][0]);
    posts.length = 0;
    await page.locator("[data-ai-record]").click();
    await page.locator("[data-camera-stop]").click();
    await page.waitForTimeout(3500);
    assert.deepEqual(posts, []);
    assert.equal(await page.locator("[data-ai-countdown]").isVisible(), false);
    await page.locator("[data-camera-start]").click();
    await page.locator("[data-ai-record]").click();
    await page.locator("[data-ai-recording]:visible").waitFor({ timeout: 5000 });
    await page.locator("[data-camera-stop]").click();
    await page.waitForTimeout(3500);
    assert.deepEqual(posts, []);
    assert.equal(await page.locator("[data-ai-recording]").isVisible(), false);
    await page.goto(`${base}/app/practice/xin-chao?lang=${lang}`);
    await page.locator(".is-auth-ready").waitFor();
    assert.equal(await page.locator("[data-ai-record]").isDisabled(), true);
    assert.equal(await page.locator("[data-save]").isEnabled(), true);
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log("PASS: countdown, recording, result, cancellation and unsupported signs on mobile and desktop.");
} finally { await browser.close(); }
