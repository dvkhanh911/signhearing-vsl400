/* courses module — reference pattern for module scripts.
   - Wrap everything in an IIFE, no globals.
   - Read data/progress only through window.SH (app_shell/core.js).
   - All UI text comes from SH.t('<module>.*' or 'shell.*'). */
(function () {
  'use strict';
  const root = document.querySelector('.m-courses .courses');
  if (!root || !window.SH) return;
  const { t, store } = window.SH;

  const STATE_CLASS = { not_started: '', in_progress: 'sh-badge--progress', completed: 'sh-badge--done' };

  function paint() {
    let done = 0;
    let open = 0;
    root.querySelectorAll('.courses-module').forEach((moduleEl) => {
      let moduleDone = 0;
      const lessons = moduleEl.querySelectorAll('.courses-lesson.is-open');
      lessons.forEach((lessonEl) => {
        const state = store.lessonState(lessonEl.dataset.lessonId);
        const badge = lessonEl.querySelector('[data-state]');
        badge.textContent = t('shell.state.' + state);
        badge.className = 'sh-badge courses-state ' + STATE_CLASS[state];
        lessonEl.dataset.state = state;
        if (state === 'completed') moduleDone += 1;
      });
      if (lessons.length) {
        moduleEl.querySelector('[data-module-progress]').textContent =
          t('courses.module.progress', { done: moduleDone, open: lessons.length });
      }
      done += moduleDone;
      open += lessons.length;
    });
    root.querySelector('[data-overall-label]').textContent = t('courses.summary.progress', { done, open });
    root.querySelector('[data-overall-bar]').style.width = open ? (100 * done / open) + '%' : '0';
  }

  // Filters are progressive enhancement: hidden without JS.
  const filters = root.querySelector('.courses-filters');
  filters.hidden = false;
  filters.addEventListener('click', (event) => {
    const button = event.target.closest('[data-filter]');
    if (!button) return;
    filters.querySelectorAll('[data-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
    const mode = button.dataset.filter;
    root.querySelectorAll('.courses-lesson').forEach((lessonEl) => {
      const isOpen = lessonEl.classList.contains('is-open');
      lessonEl.hidden = (mode === 'open' && !isOpen) || (mode === 'todo' && (!isOpen || lessonEl.dataset.state === 'completed'));
    });
    root.querySelectorAll('.courses-module').forEach((moduleEl) => {
      moduleEl.hidden = !moduleEl.querySelector('.courses-lesson:not([hidden])');
    });
  });

  window.addEventListener('sh:store', paint);
  paint();
})();
