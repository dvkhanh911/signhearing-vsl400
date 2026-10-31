(function(){'use strict';
  const root = document.querySelector('.m-lesson .lesson-page');
  if (!root || !window.SH) return;
  const SH = window.SH;
  const articles = Array.from(root.querySelectorAll('article[data-slug]'));
  const links = Array.from(root.querySelectorAll('[data-sign-link]'));
  const previous = root.querySelector('[data-previous]');
  const next = root.querySelector('[data-next]');
  let selected = 0;

  function paint() {
    const state = SH.store.lessonState(root.dataset.lessonId);
    const badge = root.querySelector('[data-lesson-state]');
    badge.hidden = false;
    badge.textContent = SH.t('shell.state.' + state);
    badge.className = 'sh-badge' + (state === 'completed' ? ' sh-badge--done' : state === 'in_progress' ? ' sh-badge--progress' : '');
    let seen = 0;
    articles.forEach((article, index) => {
      const slug = article.dataset.slug;
      const viewed = SH.store.isSignSeen(slug);
      if (viewed) seen += 1;
      links[index].querySelector('[data-seen-symbol]').textContent = viewed ? SH.t('lesson.seen.symbol') : '';
      links[index].querySelector('[data-seen-label]').textContent = SH.t(viewed ? 'lesson.seen.label' : 'lesson.unseen.label');
      const button = article.querySelector('[data-mark-seen]');
      button.setAttribute('aria-pressed', String(viewed));
      const favorite = article.querySelector('[data-favorite]');
      const on = SH.store.isFavorite(slug);
      favorite.setAttribute('aria-pressed', String(on));
      favorite.textContent = SH.t(on ? 'lesson.favorite.remove' : 'lesson.favorite.add');
    });
    root.querySelector('[data-seen-count]').textContent = SH.t('lesson.progress', { seen, total: articles.length });
    root.querySelector('[data-progress-bar]').style.width = articles.length ? (100 * seen / articles.length) + '%' : '0%';
    const ready = articles.length >= 2 && seen === articles.length;
    root.querySelector('[data-ready]').hidden = !ready;
    const quiz = root.querySelector('[data-quiz]');
    if (quiz) quiz.classList.toggle('is-ready', ready);
  }

  function choose(index, focus, historyMode) {
    if (!articles[index]) return;
    selected = index;
    const active = document.activeElement;
    const hidingFocusedArticle = articles.some((article, i) => i !== index && article.contains(active));
    articles.forEach((article, i) => {
      article.hidden = i !== index;
      if (i !== index) article.querySelectorAll('video').forEach((video) => video.pause());
      if (i === index) links[i].setAttribute('aria-current', 'true');
      else links[i].removeAttribute('aria-current');
    });
    previous.disabled = index === 0;
    next.disabled = index === articles.length - 1;
    root.querySelector('[data-position]').textContent = SH.t('lesson.position', { n: index + 1, total: articles.length });
    const hash = '#' + articles[index].id;
    if (window.location.hash !== hash) {
      if (historyMode === 'replace') window.history.replaceState(null, '', hash);
      else window.history.pushState(null, '', hash);
    }
    if (focus || hidingFocusedArticle || (active === previous && previous.disabled) || (active === next && next.disabled)) {
      articles[index].querySelector('h2').focus({ preventScroll: true });
    }
  }

  function fromHash() {
    const index = articles.findIndex((article) => '#' + article.id === window.location.hash);
    choose(index < 0 ? 0 : index, false, 'replace');
  }

  function setupVideo(article) {
    const video = article.querySelector('video');
    if (!video) return;
    const controls = article.querySelector('[data-video-controls]');
    const play = controls.querySelector('[data-play]');
    const missing = article.querySelector('[data-video-missing]');
    video.muted = true;
    video.volume = 0;
    function unavailable() {
      video.pause();
      video.hidden = true;
      controls.hidden = true;
      missing.hidden = false;
    }
    function playback() {
      play.textContent = SH.t(video.paused ? 'lesson.video.play' : 'lesson.video.pause');
      play.setAttribute('aria-pressed', String(!video.paused));
    }
    video.addEventListener('volumechange', () => {
      if (!video.muted) video.muted = true;
      if (video.volume !== 0) video.volume = 0;
    });
    ['play', 'pause', 'ended'].forEach((event) => video.addEventListener(event, playback));
    video.addEventListener('error', unavailable);
    play.addEventListener('click', () => {
      if (video.paused) {
        video.muted = true;
        const attempt = video.play();
        if (attempt) attempt.catch(() => {
          if (video.error) unavailable();
          else playback();
        });
      } else video.pause();
    });
    controls.querySelectorAll('[data-rate]').forEach((button) => {
      button.addEventListener('click', () => { video.playbackRate = Number(button.dataset.rate); });
    });
    video.addEventListener('ratechange', () => controls.querySelectorAll('[data-rate]').forEach((button) => {
      button.setAttribute('aria-pressed', String(Number(button.dataset.rate) === video.playbackRate));
    }));
    controls.querySelector('[data-loop]').addEventListener('click', (event) => {
      video.loop = !video.loop;
      event.currentTarget.setAttribute('aria-pressed', String(video.loop));
    });
    controls.querySelector('[data-mirror]').addEventListener('click', (event) => {
      const on = video.classList.toggle('is-mirrored');
      event.currentTarget.setAttribute('aria-pressed', String(on));
    });
    video.controls = false;
    controls.hidden = false;
    if (video.error) unavailable();
  }

  articles.forEach((article) => {
    const seen = article.querySelector('[data-mark-seen]');
    seen.hidden = false;
    seen.addEventListener('click', () => {
      SH.store.markSignSeen(article.dataset.slug);
      if (selected < articles.length - 1) choose(selected + 1, true);
    });
    const favorite = article.querySelector('[data-favorite]');
    favorite.hidden = false;
    favorite.addEventListener('click', () => SH.store.toggleFavorite(article.dataset.slug));
    setupVideo(article);
  });
  links.forEach((link, index) => link.addEventListener('click', (event) => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    choose(index, true);
  }));
  previous.addEventListener('click', () => choose(selected - 1, false));
  next.addEventListener('click', () => choose(selected + 1, false));
  document.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.target.closest('input, textarea, select, video, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="slider"]')) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    choose(selected + (event.key === 'ArrowLeft' ? -1 : 1), false);
  });
  window.addEventListener('hashchange', fromHash);
  window.addEventListener('popstate', fromHash);
  window.addEventListener('sh:store', paint);
  root.querySelector('[data-navigation]').hidden = articles.length === 0;
  root.querySelector('[data-progress]').hidden = articles.length === 0;
  fromHash();
  SH.store.setLessonState(root.dataset.lessonId, 'in_progress');
  paint();
})();
