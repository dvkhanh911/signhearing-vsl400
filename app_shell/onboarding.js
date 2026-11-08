/* Navigation-only onboarding. No feature state, authentication or network writes. */
(async function () {
  'use strict';
  if (window.SH) { try { await window.SH.ready; } catch (error) { return; } }
  const SH = window.SH;
  const restart = document.querySelector('[data-tour-start]');
  if (!SH || !restart || typeof HTMLDialogElement === 'undefined' || typeof HTMLDialogElement.prototype.showModal !== 'function') return;

  const KEY = 'signhearing_onboarding_v1';
  const order = ['dashboard', 'courses', 'dictionary', 'practice', 'review', 'progress', 'settings', 'account'];
  let dismissed = false;
  let run = null;

  function hasFinished() {
    if (dismissed) return true;
    for (const name of ['localStorage', 'sessionStorage']) {
      try {
        if (['completed', 'skipped'].includes(window[name].getItem(KEY))) return true;
      } catch (error) { /* Storage may be disabled; the tour still works. */ }
    }
    return false;
  }

  function persist(status) {
    dismissed = true;
    for (const name of ['localStorage', 'sessionStorage']) {
      try { window[name].setItem(KEY, status); return; } catch (error) { /* Try session storage next. */ }
    }
  }

  function targetFor(id) {
    return Array.from(document.querySelectorAll('[data-tour="' + id + '"]')).find((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility === 'visible' && style.display !== 'none';
    });
  }

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  }

  function button(className, text, action) {
    const element = node('button', className, text);
    element.type = 'button';
    element.dataset.tourAction = action;
    return element;
  }

  function stop(status, restore = true) {
    if (!run) return;
    const previous = run;
    run = null;
    previous.events.abort();
    previous.resize.disconnect();
    previous.mutations.disconnect();
    cancelAnimationFrame(previous.frame);
    previous.dialog.close();
    previous.dialog.remove();
    document.documentElement.classList.remove('has-sh-tour');
    document.body.classList.remove('sh-tour-sidebar-open');
    if (status) persist(status);
    if (restore) {
      window.scrollTo({ left: previous.scrollX, top: previous.scrollY, behavior: 'instant' });
      previous.scrollers.forEach(({ element, left, top }) => element.scrollTo({ left, top, behavior: 'instant' }));
      const focus = previous.focus && previous.focus.isConnected ? previous.focus : restart;
      focus.focus({ preventScroll: true });
    }
  }

  function scrollTarget(target) {
    target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
  }

  const clamp = (value, min, max) => Math.max(min, Math.min(value, Math.max(min, max)));

  function position() {
    if (!run) return;
    const state = run;
    const oldId = state.ids[state.index];
    state.ids = order.filter(targetFor);
    if (!state.ids.length) { stop(null); return; }
    const currentIndex = state.ids.indexOf(oldId);
    state.index = currentIndex >= 0 ? currentIndex : Math.min(state.index, state.ids.length - 1);
    const id = state.ids[state.index];
    const target = targetFor(id);
    if (!target) { schedule(); return; }
    const width = document.documentElement.clientWidth;
    const height = window.innerHeight;
    let rect = target.getBoundingClientRect();
    if (rect.top < 0 || rect.left < 0 || rect.bottom > height || rect.right > width) {
      scrollTarget(target);
      rect = target.getBoundingClientRect();
    }

    // Keep the spotlight within the viewport, including horizontally scrolling mobile navigation.
    const left = clamp(rect.left - 4, 4, width - 8);
    const top = clamp(rect.top - 4, 4, height - 8);
    const right = clamp(rect.right + 4, left + 4, width - 4);
    const bottom = clamp(rect.bottom + 4, top + 4, height - 4);
    for (const [key, value] of Object.entries({ x: left, y: top, w: right - left, h: bottom - top })) {
      state.spotlight.style.setProperty('--tour-' + key, value + 'px');
    }

    const contentChanged = state.shownId !== id || state.shownTotal !== state.ids.length || state.shownIndex !== state.index;
    if (contentChanged) {
      state.shownId = id;
      state.shownTotal = state.ids.length;
      state.shownIndex = state.index;
      state.dialog.dataset.step = id;
      state.title.textContent = SH.t('shell.tour.' + id + '.title');
      state.body.textContent = SH.t('shell.tour.' + id + '.body');
      state.count.textContent = (state.index + 1) + ' / ' + state.ids.length;
      state.count.setAttribute('aria-label', SH.t('shell.tour.step', { current: state.index + 1, total: state.ids.length }));
      state.progress.max = state.ids.length;
      state.progress.value = state.index + 1;
      state.back.disabled = state.index === 0;
      state.next.textContent = SH.t(state.index === state.ids.length - 1 ? 'shell.tour.finish' : 'shell.tour.next');
      if (state.back.disabled && document.activeElement === state.back) state.next.focus({ preventScroll: true });
      state.resize.disconnect();
      [target, state.panel, document.querySelector('.app-nav'), document.querySelector('.app-topbar')]
        .filter(Boolean).forEach((element) => state.resize.observe(element));
    }
    const panelWidth = state.panel.offsetWidth;
    state.panel.style.maxHeight = (height - 24) + 'px';
    let panelHeight = state.panel.offsetHeight;
    const gap = 18;
    let x;
    let y;
    if (width - right >= panelWidth + gap + 12) {
      x = right + gap; y = top;
    } else if (left >= panelWidth + gap + 12) {
      x = left - panelWidth - gap; y = top;
    } else if (height - bottom >= panelHeight + gap + 12) {
      x = left; y = bottom + gap;
    } else if (top >= panelHeight + gap + 12) {
      x = left; y = top - panelHeight - gap;
    } else {
      // Small landscape viewports: scroll the tooltip instead of covering the selected item.
      x = (width - panelWidth) / 2;
      const available = Math.max(height - bottom - gap - 12, top - gap - 12);
      if (available >= 110) {
        state.panel.style.maxHeight = available + 'px';
        panelHeight = state.panel.offsetHeight;
      }
      y = height - bottom >= top ? bottom + gap : top - panelHeight - gap;
    }
    state.panel.style.setProperty('--panel-x', clamp(x, 12, width - panelWidth - 12) + 'px');
    state.panel.style.setProperty('--panel-y', clamp(y, 12, height - panelHeight - 12) + 'px');
  }

  function schedule() {
    if (!run || run.frame) return;
    run.frame = requestAnimationFrame(() => {
      if (!run) return;
      run.frame = 0;
      position();
    });
  }

  function move(direction) {
    if (!run) return;
    position();
    if (!run) return;
    if (direction > 0 && run.index === run.ids.length - 1) { stop('completed'); return; }
    run.index = clamp(run.index + direction, 0, run.ids.length - 1);
    const target = targetFor(run.ids[run.index]);
    if (target) scrollTarget(target);
    position();
  }

  function start(opener) {
    if (run || !window.SH) return;
    const focus = opener || document.activeElement;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const scrollers = Array.from(document.querySelectorAll('.app-nav,.app-sidebar')).map((element) =>
      ({ element, left: element.scrollLeft, top: element.scrollTop }));
    document.body.classList.add('sh-tour-sidebar-open');
    // Read layout after temporarily revealing a collapsed sidebar, without changing its saved preference.
    const ids = order.filter(targetFor);
    if (!ids.length) { document.body.classList.remove('sh-tour-sidebar-open'); return; }
    const dialog = node('dialog', 'sh-tour');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'sh-tour-title');
    dialog.setAttribute('aria-describedby', 'sh-tour-description');
    const spotlight = node('div', 'sh-tour-spotlight');
    spotlight.setAttribute('aria-hidden', 'true');
    const panel = node('div', 'sh-tour-panel');
    const top = node('div', 'sh-tour-top');
    const count = node('span', 'sh-tour-count');
    const skip = button('sh-tour-skip', SH.t('shell.tour.skip'), 'skip');
    top.append(count, skip);
    const content = node('div');
    content.setAttribute('aria-live', 'polite');
    content.setAttribute('aria-atomic', 'true');
    const title = node('h2'); title.id = 'sh-tour-title';
    const body = node('p', 'sh-tour-body'); body.id = 'sh-tour-description';
    content.append(title, body);
    const progress = node('progress', 'sh-tour-progress');
    progress.setAttribute('aria-label', SH.t('shell.tour.progress'));
    const hint = node('p', 'sh-tour-hint', SH.t('shell.tour.hint'));
    const actions = node('div', 'sh-tour-actions');
    const back = button('button button-outline', SH.t('shell.tour.back'), 'back');
    const next = button('button', SH.t('shell.tour.next'), 'next');
    actions.append(back, next);
    panel.append(top, content, progress, hint, actions);
    dialog.append(spotlight, panel);
    const events = new AbortController();
    run = { dialog, spotlight, panel, title, body, count, progress, back, next, events,
      focus, scrollX, scrollY, scrollers, ids, index: 0, frame: 0,
      resize: new ResizeObserver(schedule),
      mutations: new MutationObserver((records) => {
        if (records.some((record) => record.target !== dialog && !dialog.contains(record.target))) schedule();
      }) };
    document.documentElement.classList.add('has-sh-tour');
    document.body.append(dialog);
    dialog.showModal();
    const options = { signal: events.signal };
    dialog.addEventListener('click', (event) => {
      event.stopPropagation();
      const action = event.target.closest('[data-tour-action]');
      if (action) {
        if (action.disabled) return;
        if (action.dataset.tourAction === 'skip') stop('skipped');
        else move(action.dataset.tourAction === 'back' ? -1 : 1);
      } else if (!panel.contains(event.target)) {
        event.preventDefault();
        move(1);
      }
    }, options);
    dialog.addEventListener('cancel', (event) => { event.preventDefault(); stop('skipped'); }, options);
    dialog.addEventListener('keydown', (event) => {
      if (event.key === 'Tab') {
        const controls = Array.from(dialog.querySelectorAll('button:not(:disabled)'));
        const current = controls.indexOf(document.activeElement);
        const nextIndex = (current + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
        event.preventDefault();
        controls[nextIndex].focus({ preventScroll: true });
        return;
      }
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key === 'Escape') { event.preventDefault(); stop('skipped'); }
      else if (event.key === 'ArrowRight' || (event.key === 'Enter' && !event.target.closest('button'))) {
        event.preventDefault(); move(1);
      } else if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
    }, options);
    window.addEventListener('resize', schedule, options);
    window.addEventListener('scroll', schedule, { ...options, capture: true, passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', schedule, options);
      window.visualViewport.addEventListener('scroll', schedule, options);
    }
    window.addEventListener('pagehide', () => stop(null, false), options);
    run.mutations.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
    scrollTarget(targetFor(ids[0]));
    position();
    next.focus({ preventScroll: true });
  }

  restart.hidden = false;
  restart.addEventListener('click', () => start(restart));
  function ready() {
    const fonts = document.fonts ? document.fonts.ready : Promise.resolve();
    fonts.then(() => requestAnimationFrame(() => {
      if (!hasFinished() && !run) start();
    }));
  }
  if (document.readyState === 'complete') ready();
  else window.addEventListener('load', ready, { once: true });
})();
