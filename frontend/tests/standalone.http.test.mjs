import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const base = process.env.TEST_URL || "http://127.0.0.1:3002";
const escape = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("'", "&#x27;")
    .replaceAll('"', "&quot;");

for (const locale of ["vi", "en"]) {
  test(`frontend-only homepage and learning fallback (${locale})`, async () => {
    const t = JSON.parse(
      await readFile(
        new URL(`../src/locales/${locale}.json`, import.meta.url),
        "utf8",
      ),
    );
    for (const route of ["/", "/features"]) {
      const response = await fetch(`${base}${route}?lang=${locale}`);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("content-language"), locale);
      const html = await response.text();
      assert.ok(html.includes(`/app/courses?lang=${locale}`));
      assert.ok(!html.includes('src="http://127.0.0.1'));
    }
    for (const route of [
      "/app",
      "/app/courses",
      "/app/practice/am",
      "/app/account",
      "/login",
    ]) {
      const response = await fetch(`${base}${route}?lang=${locale}`);
      assert.equal(response.status, 200);
      const html = await response.text();
      assert.ok(html.includes(escape(t["availability.learning.title"])));
      assert.ok(html.includes(escape(t["availability.learning.body"])));
      assert.ok(
        html.includes(`href="${route}?lang=${locale === "vi" ? "en" : "vi"}"`),
      );
      assert.ok(html.includes('content="noindex, nofollow"'));
      assert.ok(!html.includes('id="login-password"'));
    }
  });
}

test("API calls have a controlled unavailable response and assets remain public", async () => {
  for (const route of ["/api", "/api/health", "/api/future-endpoint"]) {
    const response = await fetch(base + route);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      status: "unavailable",
      code: "BACKEND_NOT_CONFIGURED",
    });
    assert.equal((await fetch(base + route, { method: "HEAD" })).status, 503);
  }
  for (const asset of [
    "/assets/logo-horizontal.png",
    "/assets/mascot.png",
    "/images/feature-guides/learning-roadmap-vi.webp",
  ]) {
    assert.equal((await fetch(base + asset)).status, 200);
  }
  assert.equal((await fetch(base + "/unknown-page?lang=en")).status, 404);
});
