(async function(){'use strict';
  if (window.SH) { try { await window.SH.ready; } catch (error) { return; } }
  const SH = window.SH;
  const root = document.querySelector('.progress-page');
  if (!SH || !root) return;
  const sampleSigns = new Set(root.dataset.sampleSigns.split(',').filter(Boolean));
  const sampleLessons = new Set(root.dataset.sampleLessons.split(',').filter(Boolean));
  const locale = SH.locale === 'vi' ? 'vi-VN' : 'en-US';
  const dateTime = new Intl.DateTimeFormat(locale, {dateStyle:'medium', timeStyle:'short',timeZone:'Asia/Ho_Chi_Minh'});
  const dayDate = new Intl.DateTimeFormat(locale, {dateStyle:'full',timeZone:'Asia/Ho_Chi_Minh'});
  const shortDate = new Intl.DateTimeFormat(locale, {dateStyle:'medium',timeZone:'Asia/Ho_Chi_Minh'});
  const checks = ['handshape', 'location', 'orientation', 'movement', 'expression'];
  function node(tag, text, className) {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
  }
  function translated(key, values) { return SH.t('progress.' + key, values); }
  function link(path, text, className) {
    const el = node('a', text, className); el.href = SH.url(path); return el;
  }
  function sample() { return node('span', SH.t('shell.badge.sample'), 'sh-badge sh-badge--sample'); }
  function time(at) {
    const date = new Date(at);
    if (!at || !Number.isFinite(date.getTime())) return node('span', translated('date.unknown'));
    const el = node('time', dateTime.format(date)); el.dateTime = date.toISOString(); return el;
  }
  function newest(list) { return list.slice().reverse().sort((a,b) => (Date.parse(b.at)||0) - (Date.parse(a.at)||0)); }
  function empty(target, section) {
    target.replaceChildren(root.querySelector('[data-empty-' + section + ']').content.cloneNode(true));
  }
  function table(target, caption, headings) {
    const wrap = node('div', undefined, 'progress-table-wrap');
    wrap.tabIndex = 0; wrap.setAttribute('role', 'region'); wrap.setAttribute('aria-label', caption);
    const el = node('table'); el.append(node('caption', caption));
    const head = node('thead'); const row = node('tr');
    headings.forEach(text => { const cell = node('th', text); cell.scope = 'col'; row.append(cell); });
    head.append(row); const body = node('tbody'); el.append(head, body); wrap.append(el); target.replaceChildren(wrap);
    return body;
  }
  function cell(row, child) { const el = node('td'); el.append(child); row.append(el); return el; }
  function signLabel(slug) {
    const sign = SH.sign(slug);
    if (!sign) return node('span', translated('sign.unavailable'));
    const el = link('/app/signs/' + encodeURIComponent(sign.slug), sign.word);
    return el;
  }
  function practice() {
    const target = root.querySelector('[data-practice-content]');
    const records = newest(SH.store.practiceLog()).slice(0,10);
    if (!records.length) { empty(target, 'practice'); return; }
    const body = table(target, translated('practice.caption'),
      [translated('table.time'), translated('table.sign'), translated('table.checks')]);
    records.forEach(record => {
      const row = node('tr'); cell(row, time(record.at));
      const word = cell(row, signLabel(record.slug)); if (sampleSigns.has(record.slug)) word.append(sample());
      const count = checks.filter(key => record.checklist && record.checklist[key] === true).length;
      cell(row, node('span', translated('checks', {n:count}))); body.append(row);
    });
  }
  function quiz(snapshot) {
    const target = root.querySelector('[data-quiz-content]');
    const groups = Object.entries(snapshot.quiz).filter(([,records]) => records.length)
      .map(([id]) => ({id, records:newest(SH.store.quizResults(id))}));
    groups.sort((a,b) => (Date.parse(b.records[0].at)||0) - (Date.parse(a.records[0].at)||0));
    if (!groups.length) { empty(target, 'quiz'); return; }
    const body = table(target, translated('quiz.caption'),
      [translated('table.lesson'), translated('table.attempts'), translated('table.best'), translated('table.latest')]);
    groups.forEach(({id, records}) => {
      const lesson = SH.lesson(id);
      const label = translated('lesson.label', {n:id});
      const title = lesson && lesson.title ? label + ' · ' + lesson.title : label;
      const row = node('tr');
      const name = cell(row, lesson && lesson.open ? link('/app/lessons/' + encodeURIComponent(id), title) : node('span', title));
      if (sampleLessons.has(id)) name.append(sample());
      cell(row, node('span', String(records.length)));
      const best = records.reduce((winner, record) => record.total > 0 && (!winner || record.score / record.total > winner.score / winner.total) ? record : winner, null);
      cell(row, node('span', best ? translated('score', {score:best.score,total:best.total}) : translated('unknown')));
      const latest = cell(row, node('span', translated('score', {score:records[0].score,total:records[0].total}), 'progress-latest-score'));
      latest.append(time(records[0].at)); body.append(row);
    });
  }
  function seen(snapshot) {
    const target = root.querySelector('[data-seen-content]');
    const slugs = Object.keys(snapshot.signs);
    if (!slugs.length) { empty(target, 'seen'); return; }
    const list = node('ul', undefined, 'progress-signs');
    let missing = 0;
    slugs.forEach(slug => {
      const sign = SH.sign(slug);
      if (!sign) { missing++; return; }
      const item = node('li'); const el = link('/app/signs/' + encodeURIComponent(slug), sign.word, 'sh-chip');
      if (sampleSigns.has(slug)) el.append(sample()); item.append(el); list.append(item);
    });
    target.replaceChildren(list);
    if (missing) target.append(node('p', translated('seen.unavailable', {n:missing}), 'progress-note progress-missing'));
  }
  function calendar() {
    const days = SH.store.streak().days;
    const dates = days.map(day => new Date(day.date + 'T12:00:00+07:00'));
    root.querySelector('[data-calendar-range]').textContent = translated('calendar.range', {start:shortDate.format(dates[0]),end:shortDate.format(dates[29])});
    const grid = root.querySelector('[data-calendar]'); grid.replaceChildren();
    days.forEach((day,index) => {
      const count = day.count;
      const level = count === 0 ? 0 : count === 1 ? 1 : count < 4 ? 2 : 3;
      const item = node('div'); item.setAttribute('role','listitem');
      const square = node('span', String(Number(day.date.slice(-2))), 'progress-day level-' + level + (count ? ' has-activity' : ''));
      const label = translated('calendar.day', {date:dayDate.format(dates[index]),n:count});
      square.setAttribute('role','img'); square.setAttribute('aria-label',label); square.tabIndex = 0; square.title = label;
      square.dataset.count = String(count); square.dataset.date = day.date; item.append(square); grid.append(item);
    });
    root.querySelector('[data-calendar-region]').hidden = false;
    root.querySelector('[data-calendar-empty]').hidden = days.some(day => day.count > 0);
  }
  function render(event) {
    const summary = SH.store.summary(); const snapshot = SH.store.export();
    const values = {lessons:translated('ratio', {done:summary.lessonsCompleted,total:summary.lessonsOpen}),
      signs:summary.signsSeen, practice:summary.practiceCount, quiz:summary.quizCount};
    Object.entries(values).forEach(([key,value]) => { root.querySelector('[data-stat="' + key + '"]').textContent = value; });
    root.querySelectorAll('[data-lessons]').forEach(item => {
      const ids = item.dataset.lessons.split(',').filter(Boolean);
      const completed = ids.filter(id => SH.store.lessonState(id) === 'completed').length;
      item.querySelector('[data-module-count]').textContent = ids.length ? translated('modules.count', {done:completed,total:ids.length}) : translated('modules.none');
      item.querySelector('[data-module-bar]').style.width = (ids.length ? completed / ids.length * 100 : 0) + '%';
    });
    practice(); quiz(snapshot); seen(snapshot); calendar(snapshot);
    if (event && event.type === 'sh:store') root.querySelector('[data-updated]').textContent = translated('updated', {practice:summary.practiceCount,quiz:summary.quizCount,signs:summary.signsSeen});
  }
  window.addEventListener('sh:store', render);
  window.addEventListener('pageshow', render);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  render();
})();
