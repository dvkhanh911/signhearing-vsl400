(function(){'use strict';
  const SH = window.SH;
  if (!SH) return;
  const page = document.querySelector('.m-review .review-page');
  const quiz = document.querySelector('.m-review .review-quiz');
  const root = page || quiz;
  if (!root) return;
  const samples = new Set(root.dataset.sampleSlugs.split(',').filter(Boolean));
  const wordKey = (word) => String(word || '').normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();

  function shuffle(items) {
    const result = items.slice();
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function paintBest() {
    root.querySelectorAll('[data-best]').forEach((label) => {
      const id = label.closest('[data-lesson-id]').dataset.lessonId;
      const results = SH.store.quizResults(id).filter((entry) => Number.isInteger(entry.score)
        && Number.isInteger(entry.total) && entry.total > 0 && entry.score >= 0 && entry.score <= entry.total);
      const best = results.reduce((current, item) => !current || item.score / item.total > current.score / current.total ? item : current, null);
      label.hidden = false;
      label.textContent = best ? SH.t('review.best', { score: best.score, total: best.total, percent: Math.round(100 * best.score / best.total) }) : SH.t('review.best.empty');
    });
  }

  function stopMedia(container) {
    container.querySelectorAll('video').forEach((video) => video.pause());
  }

  function safeVideo(source) {
    if (typeof source !== 'string' || !source.startsWith('/') || source.startsWith('//') || /[\\\u0000-\u001f]/.test(source)) return null;
    try { return new URL(source, window.location.href).origin === window.location.origin ? source : null; }
    catch (error) { return null; }
  }

  function showMedia(container, sign, onMissing) {
    stopMedia(container);
    container.replaceChildren();
    function placeholder() {
      const missing = document.createElement('div');
      missing.className = 'sh-video-placeholder';
      missing.textContent = SH.t('shell.video.missing');
      container.replaceChildren(missing);
    }
    const source = safeVideo(sign.video);
    if (!source) { placeholder(); return false; }
    const video = document.createElement('video');
    video.src = source;
    video.controls = true;
    video.muted = true;
    video.volume = 0;
    video.playsInline = true;
    video.preload = 'metadata';
    video.setAttribute('aria-label', SH.t('review.video.label'));
    video.addEventListener('volumechange', () => {
      if (!video.muted) video.muted = true;
      if (video.volume !== 0) video.volume = 0;
    });
    video.addEventListener('error', () => {
      if (!container.contains(video)) return;
      video.pause();
      placeholder();
      onMissing();
    });
    container.appendChild(video);
    return true;
  }

  if (page) {
    const find = (selector) => page.querySelector(selector);
    const picker = find('[data-lesson-select]');
    let source = 'seen';
    let poolIds = '';
    let queue = [];
    let cursor = 0;
    let total = 0;
    let flipped = false;
    let remembered = new Set();

    function pool() {
      if (source === 'lesson') return SH.signsOf(picker.value);
      return SH.data.signs.filter((sign) => source === 'favorites' ? SH.store.isFavorite(sign.slug) : SH.store.isSignSeen(sign.slug));
    }

    function setFlipped(value) {
      flipped = value;
      find('[data-flash-inner]').classList.toggle('is-flipped', value);
      find('[data-flash-front]').setAttribute('aria-hidden', String(value));
      find('[data-flash-front]').inert = value;
      find('[data-flash-back]').setAttribute('aria-hidden', String(!value));
      find('[data-flash-back]').inert = !value;
      find('[data-flip]').setAttribute('aria-expanded', String(value));
      find('[data-flip]').textContent = SH.t(value ? 'review.flash.front' : 'review.flash.flip');
      if (value) stopMedia(find('[data-flash-media]'));
    }

    function paintCard() {
      const sign = queue[cursor];
      find('[data-flash-empty]').hidden = total !== 0;
      find('[data-flash-done]').hidden = total === 0 || queue.length !== 0;
      find('[data-flash-active]').hidden = !sign;
      find('[data-flash-progress]').textContent = SH.t('review.flash.progress', { done: remembered.size, total });
      find('[data-flash-bar]').style.width = total ? (100 * remembered.size / total) + '%' : '0%';
      stopMedia(find('[data-flash-media]'));
      if (!sign) { find('[data-flash-media]').replaceChildren(); return; }
      page.dataset.currentSlug = sign.slug;
      setFlipped(false);
      find('[data-flash-position]').textContent = SH.t('review.flash.position', { n: cursor + 1, total: queue.length });
      find('[data-flash-sample]').hidden = !samples.has(sign.slug);
      find('[data-flash-word]').textContent = sign.word;
      find('[data-flash-answer-word]').textContent = sign.word;
      find('[data-flash-answer-meaning]').textContent = sign.meaning;
      function textPrompt() {
        find('[data-flash-word]').hidden = false;
        find('[data-flash-prompt]').textContent = SH.t('review.flash.word_prompt');
      }
      const hasVideo = showMedia(find('[data-flash-media]'), sign, textPrompt);
      find('[data-flash-word]').hidden = hasVideo;
      find('[data-flash-prompt]').textContent = SH.t(hasVideo ? 'review.flash.video_prompt' : 'review.flash.word_prompt');
      find('[data-flash-previous]').disabled = cursor === 0;
      find('[data-flash-next]').disabled = cursor === queue.length - 1;
    }

    function restart() {
      const signs = pool();
      poolIds = signs.map((sign) => sign.slug).join(',');
      queue = signs.slice();
      cursor = 0;
      total = signs.length;
      remembered = new Set();
      find('[data-flash-message]').textContent = '';
      paintCard();
    }

    function changeSource(value) {
      source = value;
      page.querySelectorAll('[data-source]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.source === source)));
      find('[data-lesson-picker]').hidden = source !== 'lesson';
      restart();
    }

    function move(step) {
      const next = cursor + step;
      if (next < 0 || next >= queue.length) return;
      const focused = document.activeElement;
      cursor = next;
      paintCard();
      if (focused && focused.disabled) find('[data-flash-scene]').focus({ preventScroll: true });
    }

    page.querySelectorAll('[data-source]').forEach((button) => button.addEventListener('click', () => changeSource(button.dataset.source)));
    picker.addEventListener('change', () => changeSource('lesson'));
    find('[data-flip]').addEventListener('click', () => setFlipped(!flipped));
    find('[data-flash-previous]').addEventListener('click', () => move(-1));
    find('[data-flash-next]').addEventListener('click', () => move(1));
    find('[data-forgot]').addEventListener('click', () => {
      if (!queue[cursor]) return;
      const oldCursor = cursor;
      const [sign] = queue.splice(cursor, 1);
      queue.push(sign);
      cursor = oldCursor >= queue.length - 1 ? 0 : oldCursor;
      paintCard();
      find('[data-flash-message]').textContent = SH.t('review.flash.requeued', { word: sign.word });
    });
    find('[data-remembered]').addEventListener('click', () => {
      if (!queue[cursor]) return;
      const [sign] = queue.splice(cursor, 1);
      remembered.add(sign.slug);
      cursor = Math.min(cursor, Math.max(0, queue.length - 1));
      paintCard();
      find('[data-flash-message]').textContent = SH.t('review.flash.marked', { word: sign.word });
      if (!queue.length) find('[data-flash-restart]').focus({ preventScroll: true });
    });
    find('[data-flash-restart]').addEventListener('click', restart);
    document.addEventListener('keydown', (event) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || !queue.length) return;
      if (event.target !== document.body && !page.contains(event.target)) return;
      if (event.target.closest('input,textarea,select,video,[contenteditable]:not([contenteditable="false"]),[role="slider"]')) return;
      if ([' ', 'Enter'].includes(event.key) && !event.target.closest('button,a')) {
        event.preventDefault(); setFlipped(!flipped);
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault(); move(event.key === 'ArrowLeft' ? -1 : 1);
      }
    });
    window.addEventListener('sh:store', (event) => {
      paintBest();
      if ((event.detail && event.detail.type === 'reset') || pool().map((sign) => sign.slug).join(',') !== poolIds) restart();
    });
    find('[data-flash-tools]').hidden = false;
    restart();
  }

  if (quiz) {
    const find = (selector) => quiz.querySelector(selector);
    const id = quiz.dataset.lessonId;
    let questions = [];
    let position = 0;
    let score = 0;
    let answered = false;
    let finished = false;
    let mistakes = [];

    function optionsFor(sign, signs) {
      const used = new Set([wordKey(sign.word)]);
      const options = [sign];
      const same = shuffle(signs.filter((other) => other.slug !== sign.slug));
      const outside = shuffle(SH.data.signs.filter((other) => String(other.lesson) !== String(id)));
      for (const other of same.concat(outside)) {
        const key = wordKey(other.word);
        if (!key || used.has(key)) continue;
        if (!safeVideo(sign.video) && wordKey(other.meaning) === wordKey(sign.meaning)) continue;
        used.add(key);
        options.push(other);
        if (options.length === 4) break;
      }
      return shuffle(options);
    }

    function textQuestion(sign) {
      return SH.t('review.quiz.text_question', { meaning: sign.meaning });
    }

    function paintQuestion(focus) {
      const current = questions[position];
      if (!current) return;
      answered = false;
      quiz.dataset.currentSlug = current.sign.slug;
      find('[data-question-card]').hidden = false;
      find('[data-result]').hidden = true;
      find('[data-question-position]').textContent = SH.t('review.quiz.position', { n: position + 1, total: questions.length });
      find('[data-quiz-bar]').style.width = (100 * position / questions.length) + '%';
      find('[data-question-sample]').hidden = !samples.has(current.sign.slug);
      find('[data-feedback]').textContent = '';
      const next = find('[data-next-question]');
      next.disabled = true;
      next.textContent = SH.t(position === questions.length - 1 ? 'review.quiz.finish' : 'review.quiz.next');
      const media = find('[data-question-media]');
      stopMedia(media);
      media.replaceChildren();
      media.hidden = !safeVideo(current.sign.video);
      find('[data-question]').textContent = media.hidden ? textQuestion(current.sign) : SH.t('review.quiz.video_question');
      if (!media.hidden) showMedia(media, current.sign, () => {
        find('[data-question]').textContent = textQuestion(current.sign);
      });
      const options = find('[data-options]');
      options.replaceChildren();
      current.options.forEach((sign, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'review-option';
        button.dataset.slug = sign.slug;
        button.setAttribute('aria-pressed', 'false');
        const number = document.createElement('span');
        number.className = 'review-option-number';
        number.setAttribute('aria-hidden', 'true');
        number.textContent = String(index + 1);
        const word = document.createElement('span');
        word.className = 'review-option-word';
        word.textContent = sign.word;
        button.append(number, word);
        button.addEventListener('click', () => answer(index));
        options.appendChild(button);
      });
      if (focus) find('[data-question]').focus({ preventScroll: true });
    }

    function answer(index) {
      if (answered || finished) return;
      const current = questions[position];
      const selected = current && current.options[index];
      if (!selected) return;
      answered = true;
      const correct = selected.slug === current.sign.slug;
      if (correct) score += 1;
      else mistakes.push(current.sign);
      find('[data-options]').querySelectorAll('button').forEach((button) => {
        const isCorrect = button.dataset.slug === current.sign.slug;
        const isChosen = button.dataset.slug === selected.slug;
        button.disabled = true;
        button.setAttribute('aria-pressed', String(isChosen));
        button.classList.toggle('is-correct', isCorrect);
        button.classList.toggle('is-wrong', isChosen && !isCorrect);
        if (isCorrect || isChosen) {
          const status = document.createElement('span');
          status.className = 'review-option-status';
          status.textContent = SH.t(isCorrect ? 'review.quiz.correct_option' : 'review.quiz.your_choice');
          button.appendChild(status);
        }
      });
      find('[data-feedback]').textContent = SH.t(correct ? 'review.quiz.correct' : 'review.quiz.incorrect', { word: current.sign.word });
      find('[data-next-question]').disabled = false;
      find('[data-next-question]').focus({ preventScroll: true });
    }

    function finish() {
      if (finished || !answered || position !== questions.length - 1) return;
      finished = true;
      const total = questions.length;
      const passed = score / total >= 0.8;
      SH.store.addQuizResult(id, score, total);
      if (passed) SH.store.setLessonState(id, 'completed');
      stopMedia(find('[data-question-media]'));
      find('[data-question-card]').hidden = true;
      find('[data-result]').hidden = false;
      find('[data-result-mascot]').hidden = !passed;
      find('[data-result-score]').textContent = SH.t('review.result.score', { score, total, percent: Math.round(100 * score / total) });
      find('[data-result-message]').textContent = SH.t(passed ? 'review.result.passed' : 'review.result.again');
      const list = find('[data-mistake-list]');
      list.replaceChildren();
      mistakes.forEach((sign) => {
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.href = SH.url('/app/signs/' + sign.slug);
        link.textContent = sign.word;
        const meaning = document.createElement('p');
        meaning.textContent = sign.meaning;
        item.append(link, meaning);
        list.appendChild(item);
      });
      find('[data-mistakes]').hidden = mistakes.length === 0;
      find('[data-result-title]').focus({ preventScroll: true });
    }

    function restart(focus) {
      const signs = SH.signsOf(id);
      questions = shuffle(signs).map((sign) => ({ sign, options: optionsFor(sign, signs) }));
      position = 0;
      score = 0;
      answered = false;
      finished = false;
      mistakes = [];
      paintQuestion(focus);
    }

    find('[data-next-question]').addEventListener('click', () => {
      if (!answered || finished) return;
      if (position === questions.length - 1) finish();
      else { position += 1; paintQuestion(true); }
    });
    find('[data-retry]').addEventListener('click', () => restart(true));
    document.addEventListener('keydown', (event) => {
      if (event.defaultPrevented || event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return;
      if (event.target.closest('input,textarea,select,video,[contenteditable]:not([contenteditable="false"]),[role="slider"]')) return;
      if (/^[1-4]$/.test(event.key)) { event.preventDefault(); answer(Number(event.key) - 1); }
    });
    window.addEventListener('sh:store', (event) => {
      paintBest();
      if (event.detail && event.detail.type === 'reset') restart(false);
    });
    find('[data-quiz-app]').hidden = false;
    restart(false);
  }
  window.addEventListener('pagehide', () => stopMedia(root));
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopMedia(root); });
  paintBest();
})();
