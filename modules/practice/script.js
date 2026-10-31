(function(){'use strict';
  const SH = window.SH;
  if (!SH) return;
  const list = document.querySelector('.m-practice .practice-page');
  const session = document.querySelector('.m-practice .practice-session');
  const keys = ['handshape', 'location', 'orientation', 'movement', 'expression'];

  if (list) {
    const choices = Array.from(list.querySelectorAll('.practice-choice'));
    let mode = 'all';
    function paintList() {
      const counts = new Map();
      SH.store.practiceLog().forEach((entry) => counts.set(entry.slug, (counts.get(entry.slug) || 0) + 1));
      let visible = 0;
      choices.forEach((choice) => {
        const slug = choice.dataset.slug;
        const count = counts.get(slug) || 0;
        const show = mode === 'all' || (mode === 'seen' && SH.store.isSignSeen(slug))
          || (mode === 'favorites' && SH.store.isFavorite(slug)) || (mode === 'unpractised' && count === 0);
        choice.hidden = !show;
        if (show) visible += 1;
        const label = choice.querySelector('[data-practice-count]');
        label.hidden = false;
        label.textContent = SH.t('practice.attempts', { n: count });
      });
      list.querySelectorAll('[data-practice-group]').forEach((group) => {
        group.hidden = !group.querySelector('.practice-choice:not([hidden])');
      });
      list.querySelector('[data-empty]').hidden = visible !== 0;
      const result = list.querySelector('[data-result-count]');
      result.hidden = false;
      result.textContent = SH.t('practice.results', { n: visible });
    }
    list.querySelector('[data-filters]').hidden = false;
    list.querySelectorAll('[data-filter]').forEach((button) => button.addEventListener('click', () => {
      mode = button.dataset.filter;
      list.querySelectorAll('[data-filter]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
      paintList();
    }));
    window.addEventListener('sh:store', paintList);
    paintList();
  }

  if (!session) return;
  const find = (selector) => session.querySelector(selector);
  const slug = session.dataset.slug;
  const camera = find('[data-camera]');
  const startCamera = find('[data-camera-start]');
  const stopButton = find('[data-camera-stop]');
  const mirrorButton = find('[data-mirror]');
  const cameraStatus = find('[data-camera-status]');
  const countdown = find('[data-countdown]');
  const roundStart = find('[data-round-start]');
  const countdownCancel = find('[data-countdown-cancel]');
  const saved = find('[data-saved]');
  const reference = find('[data-reference]');
  let stream = null;
  let requestId = 0;
  let cameraTimer = null;
  let countdownTimer = null;
  let leaving = false;

  function cancelCountdown() {
    clearTimeout(countdownTimer);
    countdownTimer = null;
    countdown.hidden = true;
    countdown.classList.remove('is-ready');
    countdown.textContent = '';
    roundStart.disabled = false;
    countdownCancel.hidden = true;
  }

  function resetChecklist() {
    keys.forEach((key) => { find('[data-check="' + key + '"]').checked = false; });
  }

  function stopCamera(message = 'practice.camera.off') {
    requestId += 1;
    clearTimeout(cameraTimer);
    cameraTimer = null;
    const previousStream = stream;
    stream = null;
    if (previousStream) previousStream.getTracks().forEach((track) => track.stop());
    camera.pause();
    camera.srcObject = null;
    camera.hidden = true;
    find('[data-camera-off]').hidden = false;
    find('[data-camera-live]').hidden = true;
    startCamera.hidden = false;
    startCamera.disabled = false;
    stopButton.hidden = true;
    stopButton.textContent = SH.t('practice.camera.stop');
    mirrorButton.disabled = true;
    cameraStatus.textContent = SH.t(message);
  }

  function cameraError(error) {
    if (error && ['NotAllowedError', 'PermissionDeniedError', 'SecurityError'].includes(error.name)) return 'practice.camera.denied';
    if (error && ['NotFoundError', 'DevicesNotFoundError', 'OverconstrainedError'].includes(error.name)) return 'practice.camera.missing';
    if (error && ['NotReadableError', 'TrackStartError', 'AbortError'].includes(error.name)) return 'practice.camera.busy';
    return 'practice.camera.error';
  }

  startCamera.addEventListener('click', async () => {
    if (stream || startCamera.disabled) return;
    if (!window.isSecureContext) { stopCamera('practice.camera.insecure'); return; }
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      stopCamera('practice.camera.unsupported'); return;
    }
    const currentRequest = ++requestId;
    startCamera.disabled = true;
    stopButton.hidden = false;
    stopButton.textContent = SH.t('practice.camera.cancel');
    cameraStatus.textContent = SH.t('practice.camera.pending');
    cameraTimer = setTimeout(() => {
      if (currentRequest === requestId) stopCamera('practice.camera.timeout');
    }, 15000);
    try {
      const incoming = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: false,
      });
      if (currentRequest !== requestId || leaving || document.hidden) {
        incoming.getTracks().forEach((track) => track.stop());
        return;
      }
      clearTimeout(cameraTimer);
      cameraTimer = null;
      stream = incoming;
      camera.srcObject = incoming;
      camera.muted = true;
      camera.volume = 0;
      camera.hidden = false;
      find('[data-camera-off]').hidden = true;
      find('[data-camera-live]').hidden = false;
      startCamera.hidden = true;
      stopButton.textContent = SH.t('practice.camera.stop');
      mirrorButton.disabled = false;
      cameraStatus.textContent = SH.t('practice.camera.live');
      incoming.getVideoTracks().forEach((track) => track.addEventListener('ended', () => {
        if (stream === incoming) stopCamera('practice.camera.ended');
      }));
      await camera.play();
    } catch (error) {
      if (currentRequest === requestId) stopCamera(cameraError(error));
    }
  });
  stopButton.addEventListener('click', () => stopCamera());
  mirrorButton.addEventListener('click', () => {
    const mirrored = camera.classList.toggle('practice-is-mirrored');
    mirrorButton.setAttribute('aria-pressed', String(mirrored));
  });

  roundStart.addEventListener('click', () => {
    cancelCountdown();
    saved.textContent = '';
    countdown.hidden = false;
    function ready() {
      countdownTimer = null;
      countdown.classList.add('is-ready');
      countdown.textContent = SH.t('practice.round.perform');
      roundStart.disabled = false;
      countdownCancel.hidden = true;
    }
    if (!find('[data-countdown-enabled]').checked) { ready(); return; }
    roundStart.disabled = true;
    countdownCancel.hidden = false;
    let number = 3;
    function tick() {
      countdown.textContent = SH.t('practice.countdown.number', { n: number });
      countdownTimer = setTimeout(() => {
        number -= 1;
        if (number > 0) tick();
        else ready();
      }, 1000);
    }
    tick();
  });
  countdownCancel.addEventListener('click', cancelCountdown);
  find('[data-countdown-enabled]').addEventListener('change', cancelCountdown);
  find('[data-retry]').addEventListener('click', () => {
    cancelCountdown();
    resetChecklist();
    saved.textContent = SH.t('practice.retry.ready');
  });

  function paintHistory() {
    const entries = SH.store.practiceLog().filter((entry) => entry.slug === slug).reverse().slice(0, 10);
    const history = find('[data-history]');
    history.replaceChildren();
    const formatter = new Intl.DateTimeFormat(SH.locale === 'en' ? 'en-GB' : 'vi-VN', {
      dateStyle: 'medium', timeStyle: 'short',
    });
    entries.forEach((entry) => {
      const item = document.createElement('li');
      const time = document.createElement('time');
      const date = new Date(entry.at);
      if (Number.isNaN(date.getTime())) time.textContent = SH.t('practice.history.unknown_time');
      else {
        time.dateTime = date.toISOString();
        time.textContent = formatter.format(date);
      }
      const score = document.createElement('strong');
      const n = keys.filter((key) => entry.checklist && entry.checklist[key] === true).length;
      score.textContent = SH.t('practice.history.score', { n });
      item.append(time, score);
      history.appendChild(item);
    });
    const empty = find('[data-history-empty]');
    empty.hidden = entries.length !== 0;
    empty.textContent = SH.t('practice.history.empty');
  }

  find('[data-save]').addEventListener('click', () => {
    const checklist = {};
    keys.forEach((key) => { checklist[key] = find('[data-check="' + key + '"]').checked; });
    SH.store.addPractice(slug, checklist);
    cancelCountdown();
    resetChecklist();
    saved.textContent = SH.t('practice.saved', { n: keys.filter((key) => checklist[key]).length });
  });
  window.addEventListener('sh:store', (event) => {
    if (event.detail && event.detail.type === 'reset') {
      cancelCountdown();
      resetChecklist();
      saved.textContent = '';
    }
    paintHistory();
  });

  if (reference) {
    reference.muted = true;
    reference.volume = 0;
    reference.addEventListener('volumechange', () => {
      if (!reference.muted) reference.muted = true;
      if (reference.volume !== 0) reference.volume = 0;
    });
    find('[data-video-controls]').hidden = false;
    session.querySelectorAll('[data-rate]').forEach((button) => button.addEventListener('click', () => {
      reference.playbackRate = Number(button.dataset.rate);
    }));
    reference.addEventListener('ratechange', () => session.querySelectorAll('[data-rate]').forEach((button) => {
      button.setAttribute('aria-pressed', String(Number(button.dataset.rate) === reference.playbackRate));
    }));
    find('[data-loop]').addEventListener('click', (event) => {
      reference.loop = !reference.loop;
      event.currentTarget.setAttribute('aria-pressed', String(reference.loop));
    });
    function missingReference() {
      reference.pause();
      reference.hidden = true;
      find('[data-reference-missing]').hidden = false;
      find('[data-video-controls]').hidden = true;
    }
    reference.addEventListener('error', missingReference);
    if (reference.error) missingReference();
  }

  function suspend() {
    stopCamera();
    cancelCountdown();
    if (reference) reference.pause();
  }
  window.addEventListener('pagehide', () => { leaving = true; suspend(); });
  window.addEventListener('pageshow', () => { leaving = false; });
  document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); });
  find('[data-camera-controls]').hidden = false;
  find('[data-round-controls]').hidden = false;
  find('[data-save-actions]').hidden = false;
  paintHistory();
})();
