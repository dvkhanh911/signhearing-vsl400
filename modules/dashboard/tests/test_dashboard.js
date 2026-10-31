/* Run: node modules/dashboard/tests/test_dashboard.js
 * Exercises the real shell store and dashboard script against a minimal DOM.
 * This verifies state changes, not browser rendering or accessibility layout.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const project = path.resolve(__dirname, '../../..');
const read = (name) => fs.readFileSync(path.join(project, name), 'utf8');
const curriculum = JSON.parse(read('data/curriculum.json'));
const config = JSON.parse(read('site-config.json'));
const isOpen = (item) => item.status === 'published' || (config.show_sample_content && item.status === 'sample');

class Element {
  constructor() {
    this.children = [];
    this.dataset = {};
    this.style = {};
    this.hidden = false;
    this.textContent = '';
  }
  appendChild(child) { this.children.push(child); return child; }
  replaceChildren(...children) { this.children = children; }
}

function start(locale, noOpen = false) {
  const data = {
    modules: curriculum.modules.map((item) => ({ ...item, title: item.title[locale] })),
    lessons: curriculum.lessons.map((item) => ({ ...item, title: item.title && item.title[locale], open: !noOpen && isOpen(item) })),
    signs: noOpen ? [] : curriculum.signs.filter(isOpen).map((item) => ({
      ...item, word: item.word[locale], meaning: item.meaning[locale],
    })),
  };
  const strings = { ...JSON.parse(read('locales/' + locale + '.json')),
    ...JSON.parse(read('app_shell/locales/' + locale + '.json')),
    ...JSON.parse(read('modules/dashboard/locales/' + locale + '.json')) };
  const nodes = new Map();
  const selectors = ['[data-welcome]', '[data-welcome-note]', '[data-resume-state]', '[data-resume-link]',
    '[data-resume-progress]', '[data-resume-sample]', '[data-resume-title]', '[data-resume-note]',
    '[data-resume-module]', '[data-resume-count]', '[data-resume-bar]', '[data-retry-list]',
    '[data-retry-section]', '[data-favorites-list]', '[data-favorites-section]', '.dashboard-personal',
    '[data-stat="lessons"]', '[data-stat="signs"]', '[data-stat="practice"]', '[data-stat="quiz"]'];
  selectors.forEach((selector) => nodes.set(selector, new Element()));
  const root = new Element();
  root.dataset.sampleLessons = noOpen ? '' : curriculum.lessons.filter((item) => isOpen(item) && item.status === 'sample').map((item) => item.id).join(',');
  root.dataset.sampleSigns = noOpen ? '' : curriculum.signs.filter((item) => isOpen(item) && item.status === 'sample').map((item) => item.slug).join(',');
  root.querySelector = (selector) => {
    assert(nodes.has(selector), 'Unexpected dashboard selector: ' + selector);
    return nodes.get(selector);
  };
  const listeners = new Map();
  const document = {
    documentElement: { lang: locale },
    getElementById: (id) => ({ textContent: JSON.stringify(id === 'sh-data' ? data : strings) }),
    querySelector: () => root,
    createElement: () => new Element(),
    addEventListener: () => {},
  };
  const window = {
    addEventListener(name, callback) { listeners.set(name, callback); },
    dispatchEvent(event) { if (listeners.has(event.type)) listeners.get(event.type)(event); },
  };
  const context = vm.createContext({ document, window, console,
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } } });
  vm.runInContext(read('app_shell/core.js'), context);
  vm.runInContext(read('modules/dashboard/script.js'), context);
  return { nodes, data: window.SH.data, strings, store: window.SH.store,
    get: (selector) => nodes.get(selector), value: (selector) => nodes.get(selector).textContent };
}

for (const locale of ['vi', 'en']) {
  const app = start(locale);
  const { store, get, value, strings } = app;
  const lessonLink = (id) => '/app/lessons/' + id + '?lang=' + locale;
  assert.equal(get('[data-resume-link]').href, lessonLink(1));
  assert.equal(get('[data-resume-link]').textContent, strings['dashboard.action.start'].replace('{n}', '1'));
  assert.equal(value('[data-stat="lessons"]'), '0/2');
  assert.equal(value('[data-stat="signs"]'), 0);
  assert.equal(store.summary().lastActivity, null, 'Viewing the dashboard must not write progress');
  assert.equal(get('[data-resume-sample]').hidden, false);
  assert.equal(get('.dashboard-personal').hidden, true);

  store.setLessonState(2, 'in_progress');
  assert.equal(get('[data-resume-link]').href, lessonLink(2));
  assert.equal(value('[data-resume-state]'), strings['shell.state.in_progress']);
  store.markSignSeen('bo');
  assert.equal(get('[data-resume-link]').href, lessonLink(2), 'Sign activity should resume its lesson');
  assert.equal(value('[data-resume-count]'), strings['dashboard.resume.seen'].replace('{seen}', '1').replace('{total}', '6'));
  assert.equal(get('[data-resume-bar]').style.width, (100 / 6) + '%');
  assert.equal(value('[data-stat="signs"]'), 1);
  store.setLessonState(1, 'in_progress');
  assert.equal(get('[data-resume-link]').href, lessonLink(1), 'Most recent lesson wins');
  store.setLessonState(1, 'completed');
  assert.equal(get('[data-resume-link]').href, lessonLink(2));
  assert.equal(value('[data-stat="lessons"]'), '1/2');
  store.markSignSeen('xin-chao');
  assert.equal(get('[data-resume-link]').href, lessonLink(2), 'Do not resume a completed lesson');
  store.markSignSeen('missing-sign');
  assert.equal(get('[data-resume-link]').href, lessonLink(2), 'Ignore activity for unavailable content');

  const full = { handshape: true, location: true, orientation: true, movement: true, expression: true };
  store.addPractice('xin-chao', { handshape: true });
  store.addPractice('bo', full);
  assert.equal(value('[data-stat="practice"]'), 2);
  assert.equal(get('[data-retry-list]').children.length, 1);
  assert.equal(get('[data-retry-list]').children[0].children[0].href, '/app/practice/xin-chao?lang=' + locale);
  store.addPractice('xin-chao', full);
  assert.equal(get('[data-retry-section]').hidden, true, 'An improved latest attempt removes the suggestion');
  ['xin-chao', 'bo', 'me', 'cam-on', 'ten', 'ban'].forEach((slug) => store.addPractice(slug, {}));
  store.addPractice('missing-sign', {});
  assert.equal(get('[data-retry-list]').children.length, 4, 'Limit suggestions and skip unavailable signs');
  const retryLinks = get('[data-retry-list]').children.map((row) => row.children[0].href);
  assert.equal(new Set(retryLinks).size, retryLinks.length, 'No duplicate suggestions');
  assert.equal(retryLinks[0], '/app/practice/ban?lang=' + locale);
  ['xin-chao', 'bo', 'me', 'cam-on', 'ten'].forEach((slug) => store.toggleFavorite(slug));
  assert.equal(get('[data-favorites-list]').children.length, 4);
  assert.equal(get('[data-favorites-section]').hidden, false);
  app.data.signs[0].word = '<img src=x onerror=alert(1)>';
  store.toggleFavorite('missing-sign');
  assert.equal(get('[data-favorites-list]').children[0].children[0].children[0].textContent, '<img src=x onerror=alert(1)>');
  store.addQuizResult(2, 5, 6);
  assert.equal(value('[data-stat="quiz"]'), 1);
  assert.equal(store.lessonState(2), 'in_progress', 'Dashboard must not complete lessons from quiz results');
  store.setLessonState(2, 'completed');
  assert.equal(get('[data-resume-link]').href, '/app/review?lang=' + locale);
  assert.equal(value('[data-resume-title]'), strings['dashboard.complete.title']);
  assert.equal(get('[data-resume-progress]').hidden, true);
  assert.equal(get('[data-resume-state]').hidden, true);
  assert.equal(get('[data-resume-sample]').hidden, true);

  store.reset();
  assert.equal(value('[data-stat="lessons"]'), '0/2');
  assert.equal(value('[data-stat="practice"]'), 0);
  assert.equal(value('[data-stat="quiz"]'), 0);
  assert.equal(get('[data-resume-link]').href, lessonLink(1));
  assert.equal(get('.dashboard-personal').hidden, true);
  assert.equal(value('[data-welcome]'), strings['dashboard.welcome.new']);
  store.setLessonState(3, 'in_progress');
  assert.equal(get('[data-resume-link]').href, lessonLink(1), 'Planned lessons must never be recommended');

  const empty = start(locale, true);
  assert.equal(empty.get('[data-resume-link]').href, '/app/courses?lang=' + locale);
  assert.equal(empty.value('[data-resume-title]'), empty.strings['dashboard.empty.title']);
  assert.equal(empty.value('[data-stat="lessons"]'), '0/0');
  assert.equal(empty.get('[data-resume-progress]').hidden, true);
  console.log('PASS dashboard store integration: ' + locale);
}
