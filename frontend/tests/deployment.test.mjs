import test from "node:test";
import assert from "node:assert/strict";
import { backendUrl, siteOrigin } from "../src/lib/deployment.ts";
import { GET } from "../src/app/api/[[...path]]/route.ts";

test("an absent backend never creates a localhost production target", () => {
  for (const environment of [{}, { VERCEL: "1" }, { NODE_ENV: "production" }]) {
    assert.equal(backendUrl(environment), undefined);
  }
  assert.equal(backendUrl({ BACKEND_URL: "  " }), undefined);
});

test("backend configuration preserves the explicit origin and optional mount path", () => {
  assert.equal(
    backendUrl({
      BACKEND_URL: "https://backend.example.test/service/",
      VERCEL: "1",
    }),
    "https://backend.example.test/service",
  );
  assert.equal(
    backendUrl({ BACKEND_URL: "http://127.0.0.1:8001" }),
    "http://127.0.0.1:8001",
  );
  for (const value of [
    "not-a-url",
    "ftp://example.test",
    "https://user:password@example.test",
    "https://example.test?token=value",
    "https://example.test#fragment",
  ]) {
    assert.throws(() => backendUrl({ BACKEND_URL: value }));
  }
  for (const value of [
    "http://backend.example.test",
    "https://localhost",
    "https://127.0.0.1",
    "https://127.1",
    "https://[::1]",
    "https://0.0.0.0",
    "https://api.localhost",
  ]) {
    assert.throws(() => backendUrl({ BACKEND_URL: value, VERCEL: "1" }));
  }
});

test("metadata uses the configured origin or actual Vercel deployment host", () => {
  assert.equal(siteOrigin({}), undefined);
  assert.equal(
    siteOrigin({ VERCEL_URL: "preview.example.test" }).origin,
    "https://preview.example.test",
  );
  assert.equal(
    siteOrigin({
      SITE_URL: "https://site.example.test",
      VERCEL_URL: "preview.example.test",
    }).origin,
    "https://site.example.test",
  );
  assert.throws(() =>
    siteOrigin({ SITE_URL: "https://site.example.test/path" }),
  );
  assert.throws(() =>
    siteOrigin({ SITE_URL: "http://site.example.test", VERCEL: "1" }),
  );
});

test("unconfigured API requests return an explicit uncached 503", async () => {
  const response = GET();
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    status: "unavailable",
    code: "BACKEND_NOT_CONFIGURED",
  });
});
