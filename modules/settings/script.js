(async function(){'use strict';
  if (window.SH) { try { await window.SH.ready; } catch (error) { return; } }
  const SH = window.SH;
  const root = document.querySelector('.m-settings .settings-page');
  if (!SH || !root) return;
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
  paintPermission(); readPermission();
})();
