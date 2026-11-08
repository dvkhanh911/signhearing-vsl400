import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

const source = await readFile(
  new URL("../../app_shell/core.js", import.meta.url),
  "utf8",
);
const initial = () => ({
  lessons: {},
  signs: {},
  quiz: {},
  practice: [],
  favorites: [],
  activity: null,
  activities: [],
  user: { id: "user-a", email: "a@example.invalid" },
  profile: { display_name: "Learner A" },
  streak: { current: 0, longest: 0, days: [] },
});

function runtime({ failWrite = false } = {}) {
  let state = initial();
  const calls = [],
    redirects = [],
    events = [];
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const listeners = {};
  const el = {
    classList: { add() {}, toggle() {} },
    setAttribute() {},
    addEventListener() {},
    append() {},
    replaceChildren() {},
    remove() {},
    hidden: false,
  };
  const document = {
    documentElement: { lang: "en", classList: el.classList },
    body: el,
    getElementById: (id) => ({
      textContent: JSON.stringify(
        id === "sh-data"
          ? {
              lessons: [{ id: 1, open: true }],
              signs: [{ slug: "am", lesson: 1 }],
            }
          : {},
      ),
    }),
    querySelector: (selector) =>
      selector === "[data-sidebar-toggle]" ? null : el,
    querySelectorAll: () => [],
    createElement: () => ({ ...el }),
    createTextNode: (text) => text,
    addEventListener: (name, fn) => {
      listeners[name] = fn;
    },
  };
  const location = {
    origin: "https://test.invalid",
    pathname: "/app",
    search: "",
    replace: (url) => redirects.push(url),
    reload: () => redirects.push("reload"),
  };
  const context = vm.createContext({
    document,
    location,
    console,
    URL,
    Promise,
    crypto: { randomUUID },
    CustomEvent: class {
      constructor(type, options) {
        this.type = type;
        this.detail = options.detail;
      }
    },
    fetch: async (path, options) => {
      calls.push({ path, ...options });
      if (path === "/api/learning/events") {
        if (failWrite) return { status: 503, ok: false };
        const event = JSON.parse(options.body);
        if (event.type === "practice")
          state.practice.push({
            slug: event.id,
            checklist: event.checklist,
            at: "2026-11-08T00:00:00Z",
          });
        if (event.type === "sign")
          state.signs[event.id] = { at: "2026-11-08T00:00:00Z" };
      }
      return { status: 200, ok: true, json: async () => clone(state) };
    },
  });
  context.window = {
    location,
    dispatchEvent: (event) => events.push(event),
    addEventListener() {},
    // Browser progress must never be read as authenticated user state.
    localStorage: {
      getItem() {
        throw new Error("unexpected user localStorage access");
      },
    },
  };
  vm.runInContext(source, context);
  return {
    SH: context.window.SH,
    calls,
    redirects,
    events,
    changeUser: () => {
      state.user.id = "user-b";
    },
  };
}

test("hydrate server data before use, save asynchronously, use the verified subject header", async () => {
  const run = runtime();
  await run.SH.ready;
  assert.equal(run.SH.auth.username(), "Learner A");
  assert.equal(run.SH.store.summary().practiceCount, 0);
  assert.equal(await run.SH.store.markSignSeen("am"), true);
  assert.equal(run.SH.store.isSignSeen("am"), true);
  const write = run.calls.find((call) => call.path.endsWith("/events"));
  assert.equal(write.headers["X-SH-User"], "user-a");
  assert.equal(JSON.parse(write.body).user_id, undefined);
  const checks = {
    handshape: true,
    location: false,
    orientation: true,
    movement: false,
    expression: true,
  };
  assert.equal(await run.SH.store.addPractice("am", checks), true);
  assert.equal(run.SH.store.summary().practiceCount, 1);
  assert.ok(run.events.some((event) => event.detail.type === "practice"));
});

test("a failed save never reports success or increments progress", async () => {
  const run = runtime({ failWrite: true });
  await run.SH.ready;
  assert.equal(await run.SH.store.markSignSeen("am"), false);
  assert.equal(run.SH.store.isSignSeen("am"), false);
});

test("account change reloads instead of mixing another account into the store", async () => {
  const run = runtime();
  await run.SH.ready;
  run.changeUser();
  await assert.rejects(run.SH.store.sync(), /account_changed/);
  assert.ok(run.redirects.includes("reload"));
  assert.equal(run.SH.auth.user().id, "user-a");
});
