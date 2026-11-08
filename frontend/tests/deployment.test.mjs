import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { backendRewrites, siteOrigin } from "../src/lib/deployment.ts";
import { publicSupabaseConfig } from "../src/lib/supabase-config.ts";

test("Next.js reads the public Supabase variables and rejects privileged keys", () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  try {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://env-project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    assert.deepEqual(publicSupabaseConfig(), {
      url: "https://env-project.supabase.co",
      publishableKey: "sb_publishable_test",
    });
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_secret_rejected";
    assert.throws(publicSupabaseConfig, /publishable key/);
  } finally {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined)
      delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = previousKey;
  }
});

const require = createRequire(import.meta.url);
const { pathToRegexp } = require("next/dist/compiled/path-to-regexp");

test("Vercel routes backend pages, API and media before the frontend catch-all", async () => {
  const config = JSON.parse(
    await readFile(new URL("../../vercel.json", import.meta.url), "utf8"),
  );
  const cases = {
    "/": "frontend",
    "/features": "frontend",
    "/assets/mascot.png": "frontend",
    "/_next/static/chunks/app.js": "frontend",
    "/unknown-page": "frontend",
    "/api/health": "backend",
    "/app": "backend",
    "/app/": "backend",
    "/app/account": "backend",
    "/app/review/quiz/1": "backend",
    "/login": "backend",
    "/login/": "backend",
    "/static/app/onboarding.js": "backend",
    "/static/media/local-videos/am.mp4": "backend",
  };
  for (const [path, expected] of Object.entries(cases)) {
    const rule = config.rewrites.find(({ source }) =>
      pathToRegexp(source).test(path),
    );
    assert.equal(rule?.destination.service, expected, path);
  }
});

test("cloud builds cannot capture a local backend URL", () => {
  assert.deepEqual(
    backendRewrites({ VERCEL: "1", BACKEND_URL: "http://127.0.0.1:8001" }),
    [],
  );
  assert.deepEqual(
    backendRewrites({ VERCEL: "1", LOCAL_BACKEND_URL: "invalid" }),
    [],
  );
  assert.equal(
    backendRewrites({})[1].destination,
    "http://127.0.0.1:8001/app/:path*",
  );
  assert.equal(
    backendRewrites({ LOCAL_BACKEND_URL: "http://127.0.0.1:9001/" })[0]
      .destination,
    "http://127.0.0.1:9001/login",
  );
  assert.throws(() =>
    backendRewrites({ LOCAL_BACKEND_URL: "https://example.com/subpath" }),
  );
});

test("metadata uses the preview domain, production domain or explicit public origin", () => {
  const environment = {
    VERCEL: "1",
    VERCEL_ENV: "preview",
    VERCEL_URL: "preview-signhearing.vercel.app",
    VERCEL_PROJECT_PRODUCTION_URL: "signhearing.vercel.app",
  };
  assert.equal(
    siteOrigin(environment).origin,
    "https://preview-signhearing.vercel.app",
  );
  assert.equal(
    siteOrigin({ ...environment, VERCEL_ENV: "production" }).origin,
    "https://signhearing.vercel.app",
  );
  assert.equal(
    siteOrigin({ ...environment, SITE_URL: "https://signhearing.example/" })
      .origin,
    "https://signhearing.example",
  );
  assert.equal(siteOrigin({}).origin, "http://localhost:3000");
  assert.throws(() => siteOrigin({ VERCEL: "1" }));
  assert.throws(() =>
    siteOrigin({ VERCEL: "1", SITE_URL: "http://localhost:3000" }),
  );
});
