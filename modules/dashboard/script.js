(function () {
  'use strict';
  const root = document.querySelector('.m-dashboard .dashboard-page');
  if (!root || !window.SH) return;
  const { data, t, url, store, lesson, sign, signsOf } = window.SH;
  const opened = (data.lessons || []).filter((item) => item.open);
  const sampleLessons = new Set(root.dataset.sampleLessons.split(',').filter(Boolean));
  const sampleSigns = new Set(root.dataset.sampleSigns.split(',').filter(Boolean));
  const stateClasses = { not_started: '', in_progress: 'sh-badge--progress', completed: 'sh-badge--done' };
  const checklistKeys = ['handshape', 'location', 'orientation', 'movement', 'expression'];
  const find = (selector) => root.querySelector(selector);
  const text = (selector, value) => { find(selector).textContent = value; };
  const pending = (item) => item && item.open && store.lessonState(item.id) !== 'completed';
  const lessonTitle = (item) => t('dashboard.lesson.title', {
    n: item.id, title: item.title || t('dashboard.lesson.untitled'),
  });

  function resumeLesson(activity) {
    let candidate = null;
    if (activity && activity.type === 'lesson') candidate = lesson(activity.id);
    if (activity && activity.type === 'sign') {
      const lastSign = sign(activity.id);
      candidate = lastSign ? lesson(lastSign.lesson) : null;
    }
    return pending(candidate) ? candidate : opened.find(pending) || null;
  }

  function paintResume(summary) {
    const isNew = !summary.lastActivity;
    text('[data-welcome]', t(isNew ? 'dashboard.welcome.new' : 'dashboard.welcome.returning'));
    text('[data-welcome-note]', t(isNew ? 'dashboard.welcome.new.note' : 'dashboard.welcome.returning.note'));
    const current = resumeLesson(summary.lastActivity);
    const badge = find('[data-resume-state]');
    const link = find('[data-resume-link]');
    find('[data-resume-progress]').hidden = !current;
    find('[data-resume-sample]').hidden = !current || !sampleLessons.has(String(current.id));
    badge.hidden = !current;
    if (!current) {
      const allDone = opened.length > 0;
      text('[data-resume-title]', t(allDone ? 'dashboard.complete.title' : 'dashboard.empty.title'));
      text('[data-resume-note]', t(allDone ? 'dashboard.complete.note' : 'dashboard.empty.note'));
      text('[data-resume-module]', '');
      link.href = url(allDone ? '/app/review' : '/app/courses');
      link.textContent = t(allDone ? 'dashboard.action.review' : 'dashboard.shortcut.courses');
      return;
    }
    const module = (data.modules || []).find((item) => String(item.id) === String(current.module));
    const state = store.lessonState(current.id);
    const signs = signsOf(current.id);
    const seen = signs.filter((item) => store.isSignSeen(item.slug)).length;
    badge.textContent = t('shell.state.' + state);
    badge.className = 'sh-badge ' + (stateClasses[state] || '');
    text('[data-resume-module]', module ? module.title : '');
    text('[data-resume-title]', lessonTitle(current));
    text('[data-resume-note]', t('dashboard.resume.note'));
    text('[data-resume-count]', t('dashboard.resume.seen', { seen, total: signs.length }));
    find('[data-resume-bar]').style.width = signs.length ? (100 * seen / signs.length) + '%' : '0%';
    link.href = url('/app/lessons/' + current.id);
    link.textContent = isNew ? t('dashboard.action.start', { n: current.id }) : t('dashboard.action.continue');
  }

  // Build content with textContent so curriculum words never become HTML.
  function signItem(item, path, note) {
    const row = document.createElement('li');
    const link = document.createElement('a');
    link.href = url(path + item.slug);
    const word = document.createElement('strong');
    word.textContent = item.word;
    link.appendChild(word);
    if (note) {
      const label = document.createElement('span');
      label.className = 'dashboard-note';
      label.textContent = note;
      link.appendChild(label);
    }
    if (sampleSigns.has(item.slug)) {
      const badge = document.createElement('span');
      badge.className = 'sh-badge sh-badge--sample';
      badge.textContent = t('shell.badge.sample');
      link.appendChild(badge);
    }
    row.appendChild(link);
    return row;
  }

  function paintPersonal() {
    const latest = new Map();
    // The store appends attempts in time order. Keep only the latest per sign.
    store.practiceLog().slice().reverse().forEach((entry) => {
      if (!latest.has(entry.slug)) latest.set(entry.slug, entry);
    });
    const retry = [];
    latest.forEach((entry) => {
      const item = sign(entry.slug);
      const count = checklistKeys.filter((key) => entry.checklist && entry.checklist[key] === true).length;
      if (item && count < checklistKeys.length && retry.length < 4) retry.push({ item, count });
    });
    const retryList = find('[data-retry-list]');
    retryList.replaceChildren();
    retry.forEach(({ item, count }) => retryList.appendChild(signItem(item, '/app/practice/',
      t('dashboard.retry.count', { n: count }))));
    find('[data-retry-section]').hidden = retry.length === 0;

    const favorites = store.favorites().map(sign).filter(Boolean).slice(0, 4);
    const favoriteList = find('[data-favorites-list]');
    favoriteList.replaceChildren();
    favorites.forEach((item) => favoriteList.appendChild(signItem(item, '/app/signs/', item.meaning)));
    find('[data-favorites-section]').hidden = favorites.length === 0;
    find('.dashboard-personal').hidden = retry.length === 0 && favorites.length === 0;
  }

  function paint() {
    const summary = store.summary();
    text('[data-stat="lessons"]', t('dashboard.stats.ratio', { done: summary.lessonsCompleted, open: summary.lessonsOpen }));
    text('[data-stat="signs"]', summary.signsSeen);
    text('[data-stat="practice"]', summary.practiceCount);
    text('[data-stat="quiz"]', summary.quizCount);
    paintResume(summary);
    paintPersonal();
  }

  window.addEventListener('sh:store', paint);
  paint();
})();
