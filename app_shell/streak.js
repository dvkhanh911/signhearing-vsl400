(async function () {
  'use strict';
  const SH = window.SH;
  if (!SH) return;
  try { await SH.ready; } catch (error) { return; }
  const root = document.querySelector('.dashboard-page, .progress-page');
  if (!root) return;
  const card = document.createElement('section'); card.className = 'sh-card sh-streak';
  const stats = document.createElement('dl'); card.append(stats);
  const current = document.createElement('dd'), longest = document.createElement('dd');
  [['current', current], ['longest', longest]].forEach(([key,value]) => {
    const group = document.createElement('div'), label = document.createElement('dt');
    label.textContent = SH.t('shell.streak.' + key); group.append(label, value); stats.append(group);
  });
  const note = document.createElement('p'); note.textContent = SH.t('shell.streak.note'); card.append(note);
  root.querySelector('.sh-page-head')?.after(card);
  let list;
  if (root.classList.contains('progress-page')) {
    const history = document.createElement('section'); history.className = 'sh-card progress-section';
    const title = document.createElement('h2'); title.textContent = SH.t('shell.history.title');
    list = document.createElement('ol'); list.className = 'sh-activity-history'; history.append(title, list); root.append(history);
  }
  function render() {
    const streak = SH.store.streak();
    current.textContent = SH.t('shell.streak.days', {n:streak.current});
    longest.textContent = SH.t('shell.streak.days', {n:streak.longest});
    if (!list) return;
    list.replaceChildren();
    const activities = SH.store.activities().reverse();
    if (!activities.length) { const li = document.createElement('li'); li.textContent = SH.t('shell.history.empty'); list.append(li); }
    const formatter = new Intl.DateTimeFormat(SH.locale === 'vi' ? 'vi-VN' : 'en-GB', {dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Ho_Chi_Minh'});
    activities.slice(0,100).forEach(activity => {
      const li = document.createElement('li'), time = document.createElement('time');
      const resource = SH.sign(activity.id)?.word || SH.lesson(activity.id)?.title || activity.id;
      time.dateTime = activity.at; time.textContent = formatter.format(new Date(activity.at));
      li.append(time, ' · ' + SH.t('shell.history.' + activity.type) + ' · ' + resource); list.append(li);
    });
  }
  window.addEventListener('sh:store', render); render();
})();
