(function(){'use strict';
  const SH = window.SH;
  const root = document.querySelector('.m-settings .settings-page');
  if (!SH || !root) return;
  const trigger = root.querySelector('[data-delete]');
  const confirmation = root.querySelector('[data-confirmation]');
  const message = root.querySelector('[data-data-message]');
  const objectURLs = new Set();
  let permissionStatus = null;
  root.querySelector('.settings-nav').addEventListener('click', event => {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const anchor = event.target.closest('a');
    const section = anchor && root.querySelector(anchor.getAttribute('href'));
    if (!section) return;
    event.preventDefault();
    if (location.hash !== anchor.hash) history.pushState(null, '', anchor.hash);
    section.scrollIntoView({behavior:'instant', block:'start'});
    section.tabIndex = -1; section.focus({preventScroll:true});
  });
  function paint() {
    const summary = SH.store.summary();
    const values = {lessons:SH.t('settings.summary.ratio', {done:summary.lessonsCompleted,open:summary.lessonsOpen}),
      signs:summary.signsSeen, practice:summary.practiceCount, quiz:summary.quizCount};
    Object.entries(values).forEach(([key,value]) => { root.querySelector('[data-stat="' + key + '"]').textContent = value; });
    root.querySelector('[data-in-progress]').textContent = SH.t('settings.summary.in_progress', {n:summary.lessonsInProgress});
    root.querySelector('[data-summary]').hidden = false;
    root.querySelector('[data-storage-warning]').hidden = SH.store.persistent();
  }
  function closeConfirmation(focus) {
    confirmation.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (focus) trigger.focus();
  }
  trigger.addEventListener('click', () => {
    message.textContent = '';
    confirmation.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    confirmation.focus();
  });
  root.querySelector('[data-cancel-delete]').addEventListener('click', () => closeConfirmation(true));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !confirmation.hidden) { event.preventDefault(); closeConfirmation(true); }
  });
  root.querySelector('[data-confirm-delete]').addEventListener('click', () => {
    if (confirmation.hidden) return;
    SH.store.reset();
    closeConfirmation(true);
    message.textContent = SH.t('settings.delete.success');
  });
  function release(url) {
    if (!objectURLs.has(url)) return;
    URL.revokeObjectURL(url); objectURLs.delete(url);
  }
  root.querySelector('[data-export]').addEventListener('click', () => {
    let url;
    let anchor;
    try {
      const blob = new Blob([JSON.stringify(SH.store.export(), null, 2)], {type:'application/json;charset=utf-8'});
      url = URL.createObjectURL(blob); objectURLs.add(url);
      anchor = document.createElement('a'); anchor.href = url; anchor.download = 'signhearing-tien-do.json'; anchor.hidden = true;
      root.append(anchor); anchor.click();
      message.textContent = SH.t('settings.export.success');
    } catch (error) {
      message.textContent = SH.t('settings.export.error');
    } finally {
      if (anchor) anchor.remove();
      if (url) window.setTimeout(() => release(url), 1000);
    }
  });
  function paintPermission() {
    const state = permissionStatus && ['granted','denied','prompt'].includes(permissionStatus.state) ? permissionStatus.state : 'unknown';
    const el = root.querySelector('[data-permission]');
    el.textContent = SH.t('settings.camera.permission.' + state); el.dataset.state = state; el.hidden = false;
  }
  async function readPermission() {
    try {
      if (navigator.permissions && typeof navigator.permissions.query === 'function') {
        permissionStatus = await navigator.permissions.query({name:'camera'});
        if (permissionStatus && typeof permissionStatus.addEventListener === 'function') permissionStatus.addEventListener('change', paintPermission);
      }
    } catch (error) { permissionStatus = null; }
    paintPermission();
  }
  window.addEventListener('pagehide', () => { objectURLs.forEach(release); });
  window.addEventListener('pageshow', paint);
  window.addEventListener('sh:store', paint);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) paint(); });
  root.querySelector('[data-data-actions]').hidden = false;
  paint(); paintPermission(); readPermission();
})();
