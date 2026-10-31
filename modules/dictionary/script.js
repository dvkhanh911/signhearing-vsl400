(function(){'use strict';
  const SH = window.SH;
  if (!SH) return;
  const catalogue = document.querySelector('.m-dictionary .dictionary-page');
  const detail = document.querySelector('.m-dictionary .dictionary-detail');

  function paintFavorites(root) {
    root.querySelectorAll('.dictionary-item').forEach((card) => {
      card.querySelector('[data-favorite-mark]').hidden = !SH.store.isFavorite(card.dataset.slug);
    });
  }

  if (catalogue) {
    const input = catalogue.querySelector('[data-search-input]');
    const cards = Array.from(catalogue.querySelectorAll('.dictionary-item'));
    const moduleFilters = Array.from(catalogue.querySelectorAll('[data-module-filter]'));
    const favorites = catalogue.querySelector('[data-favorites-filter]');
    let moduleId = 'all';
    let onlyFavorites = false;

    function filter() {
      const tokens = SH.normalize(input.value).split(/\s+/).filter(Boolean);
      let count = 0;
      cards.forEach((card) => {
        const match = tokens.every((token) => card.dataset.search.includes(token))
          && (moduleId === 'all' || card.dataset.module === moduleId)
          && (!onlyFavorites || SH.store.isFavorite(card.dataset.slug));
        card.hidden = !match;
        if (match) count += 1;
      });
      catalogue.querySelector('[data-result-count]').textContent = SH.t('dictionary.results', { n: count });
      catalogue.querySelector('[data-empty]').hidden = count !== 0;
      paintFavorites(catalogue);
    }

    moduleFilters.forEach((button) => button.addEventListener('click', () => {
      moduleId = button.dataset.moduleFilter;
      moduleFilters.forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
      filter();
    }));
    favorites.addEventListener('click', () => {
      onlyFavorites = !onlyFavorites;
      favorites.setAttribute('aria-pressed', String(onlyFavorites));
      filter();
    });
    input.addEventListener('input', filter);
    input.addEventListener('search', filter);
    catalogue.querySelector('[data-clear-filters]').addEventListener('click', () => {
      input.value = '';
      moduleId = 'all';
      onlyFavorites = false;
      moduleFilters.forEach((item) => item.setAttribute('aria-pressed', String(item.dataset.moduleFilter === 'all')));
      favorites.setAttribute('aria-pressed', 'false');
      filter();
      input.focus();
    });
    document.addEventListener('keydown', (event) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      const editing = event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]');
      if (event.key === '/' && !editing) {
        event.preventDefault();
        input.focus();
      } else if (event.key === 'Escape' && (!editing || event.target === input)) {
        event.preventDefault();
        input.value = '';
        filter();
        input.focus();
      }
    });
    catalogue.querySelector('[data-toolbar]').hidden = false;
    catalogue.querySelector('[data-clear-filters]').hidden = false;
    window.addEventListener('sh:store', filter);
    filter();
  }

  if (detail) {
    const favorite = detail.querySelector('[data-favorite]');
    function paint() {
      const on = SH.store.isFavorite(detail.dataset.slug);
      favorite.setAttribute('aria-pressed', String(on));
      favorite.textContent = SH.t(on ? 'dictionary.favorite.remove' : 'dictionary.favorite.add');
      paintFavorites(detail);
    }
    favorite.addEventListener('click', () => SH.store.toggleFavorite(detail.dataset.slug));
    favorite.hidden = false;
    window.addEventListener('sh:store', paint);
    paint();

    const video = detail.querySelector('video');
    if (video) {
      video.muted = true;
      video.volume = 0;
      video.addEventListener('volumechange', () => {
        if (!video.muted) video.muted = true;
        if (video.volume !== 0) video.volume = 0;
      });
      const missing = () => {
        video.pause();
        video.hidden = true;
        detail.querySelector('[data-video-missing]').hidden = false;
      };
      video.addEventListener('error', missing);
      if (video.error) missing();
    }
  }
})();
