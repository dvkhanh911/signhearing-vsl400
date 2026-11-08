import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const base = process.env.TEST_URL || "http://127.0.0.1:3000";
test("unauthenticated app routes redirect and cookie mutations reject cross-site origins", async () => {
  const redirect = await fetch(`${base}/app/progress?lang=en`, {
    redirect: "manual",
  });
  assert.equal(redirect.status, 303);
  const target = new URL(redirect.headers.get("location"), base);
  assert.equal(target.pathname, "/login");
  assert.equal(target.searchParams.get("next"), "/app/progress?lang=en");
  const session = await fetch(`${base}/api/auth/session`);
  assert.equal(session.status, 401);
  const csrf = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://attacker.invalid",
    },
    body: JSON.stringify({
      email: "nobody@example.invalid",
      password: "test-only",
    }),
  });
  assert.equal(csrf.status, 403);
});
for (const route of ["/", "/features"]) {
  for (const locale of ["vi", "en"]) {
    test(`rendered images load as images (${route}, ${locale})`, async () => {
      const response = await fetch(`${base}${route}?lang=${locale}`);
      assert.equal(response.status, 200);
      const html = await response.text();
      const images = html.match(/<img\b[^>]*>/gi) || [];
      assert.ok(images.length > 0, "Page must render its images");
      const sources = new Set();
      for (const image of images) {
        const source = image.match(/\bsrc="([^"]+)"/i)?.[1];
        assert.ok(source, `Image has no source: ${image}`);
        sources.add(source.replaceAll("&amp;", "&"));
        const candidates = image.match(/\bsrcset="([^"]+)"/i)?.[1];
        for (const candidate of candidates?.split(",") || []) {
          sources.add(
            candidate.trim().split(/\s+/)[0].replaceAll("&amp;", "&"),
          );
        }
      }
      for (const source of sources) {
        const image = await fetch(new URL(source, base));
        assert.equal(image.status, 200, `Image failed: ${source}`);
        assert.match(
          image.headers.get("content-type") || "",
          /^image\//,
          `Image URL returned a non-image response: ${source}`,
        );
        assert.ok((await image.arrayBuffer()).byteLength > 0, source);
      }
    });
  }
}

for (const locale of ["vi", "en"]) {
  test(`SSR landing, metadata, citations, CTA semantics and assets (${locale})`, async () => {
    const t = JSON.parse(
      await readFile(
        new URL(`../src/locales/${locale}.json`, import.meta.url),
        "utf8",
      ),
    );
    const response = await fetch(`${base}/?lang=${locale}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-language"), locale);
    assert.match(response.headers.get("set-cookie"), /HttpOnly/i);
    assert.match(response.headers.get("cache-control"), /no-store/);
    const html = await response.text();
    assert.ok(html.includes(`<html lang="${locale}"`));
    for (const key of [
      "hero.title.first",
      "hero.title.second",
      "immersive.hero.description",
      "story.one",
      "story.two",
      "contact.missing.body",
      "quote.jordan.text",
      "quote.keller.text",
      "meta.home.description",
      "immersive.hero.first",
      "immersive.hero.second",
      "immersive.emotion.first",
      "immersive.emotion.second",
      "immersive.journey.practice.body",
      "immersive.journey.feedback.body",
      "immersive.preview.ai.note",
    ]) {
      const escape = (s) =>
        s
          .replaceAll("&", "&amp;")
          .replaceAll("'", "&#x27;")
          .replaceAll('"', "&quot;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;");
      assert.ok(
        html.includes(escape(t[key])),
        `Missing original content ${key}`,
      );
    }
    assert.match(html, /href="#cau-chuyen"/);
    assert.ok(html.includes(`/app?lang=${locale}`));
    assert.ok(html.includes(`/app/courses?lang=${locale}`));
    assert.ok(html.includes(`/app/practice?lang=${locale}`));
    assert.ok(html.includes(`/app/dictionary?lang=${locale}`));
    assert.ok(html.includes(`/app/progress?lang=${locale}`));
    assert.ok(
      html.includes(
        "https://www.congress.gov/109/crec/2006/03/28/CREC-2006-03-28.pdf#page=13",
      ),
    );
    assert.ok(html.includes("https://www.helenkeller.org/get-involved/"));
    assert.equal((html.match(/<h1(?:\s|>)/g) || []).length, 1);
    assert.equal((html.match(/<section(?:\s|>)/g) || []).length, 6);
    // No-JS output must include the complete story, with continuous effects idle.
    assert.match(html, /class="immersive-landing" data-motion="idle"/);
    assert.ok(!html.includes("<video"));
    assert.ok(!html.includes("{{"));
    let position = -1;
    for (const id of [
      "vsl",
      "cau-chuyen",
      "hanh-trinh",
      "kham-pha",
      "dong-hanh",
      "lien-he",
    ]) {
      const next = html.indexOf(`id="${id}"`);
      assert.ok(next > position);
      position = next;
    }
    for (const asset of ["/assets/logo-horizontal.png", "/assets/mascot.png"])
      assert.equal((await fetch(base + asset)).status, 200);
    for (const path of [
      "/app/courses",
      "/app/practice",
      "/app/dictionary",
      "/app/progress",
    ]) {
      const target = await fetch(`${base}${path}?lang=${locale}`);
      assert.equal(target.status, 200, `Landing CTA target ${path}`);
      assert.equal(target.headers.get("content-language"), locale);
    }
  });
  test(`unknown routes use translated HTTP 404 (${locale})`, async () => {
    const response = await fetch(`${base}/unknown-test-page?lang=${locale}`);
    assert.equal(response.status, 404);
    const html = await response.text();
    assert.ok(html.includes(`<html lang="${locale}"`));
    // Next's internal router payload records the requested URL; UI links must stay canonical.
    assert.ok(!/href="[^"]*unknown-test-page/.test(html));
    assert.ok(html.includes("404"));
  });
}
test("language persists through reload, app navigation, and legacy redirect", async () => {
  const selected = await fetch(`${base}/?lang=en`);
  const cookie = selected.headers.get("set-cookie").split(";")[0];
  for (const path of [
    "/",
    "/?lang=invalid",
    "/app",
    "/app/settings",
    "/app/dictionary",
  ]) {
    const response = await fetch(base + path, { headers: { Cookie: cookie } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-language"), "en");
    assert.ok((await response.text()).includes('<html lang="en"'));
  }
  const redirect = await fetch(`${base}/khu-hoc-tap?lang=en`, {
    redirect: "manual",
  });
  assert.equal(redirect.status, 302);
  assert.equal(
    new URL(redirect.headers.get("location"), base).pathname,
    "/app",
  );
  assert.equal(
    new URL(redirect.headers.get("location"), base).search,
    "?lang=en",
  );
});
test("same-origin API proxy and video seeking work", async () => {
  const health = await fetch(`${base}/api/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).status, "ok");
  const video = await fetch(`${base}/static/media/local-videos/am.mp4`, {
    headers: { Range: "bytes=0-31" },
  });
  assert.equal(video.status, 206);
  assert.equal((await video.arrayBuffer()).byteLength, 32);
  assert.equal((await fetch(`${base}/static/app/modern.css`)).status, 200);
});
