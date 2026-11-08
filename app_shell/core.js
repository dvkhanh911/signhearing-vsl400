/* SignHearing app core — shared by every learning module. Owned by the shell lead.
 *
 * Modules use ONLY this public API (window.SH). Do not read localStorage directly:
 * when a real backend arrives, only this file changes and every module keeps working.
 *
 *   SH.data            curriculum payload from the server (modules, lessons, signs; open content only)
 *   SH.t(key, vars)    UI string for the current page: SH.t('courses.signs', {n: 3})
 *   SH.url(path)       adds ?lang=vi|en to an internal link
 *   SH.lesson(id) / SH.sign(slug) / SH.signsOf(lessonId)
 *   SH.normalize(text) lower-case, no Vietnamese diacritics (for search)
 *   SH.auth.*          verified Supabase account (HttpOnly server session)
 *   SH.store.*         learner progress (see below); fires window event 'sh:store'
 */
(function () {
  'use strict';

  const readJson = (id) => {
    const el = document.getElementById(id);
    try { return el ? JSON.parse(el.textContent) : {}; } catch (error) { return {}; }
  };

  const data = readJson('sh-data');
  const strings = readJson('sh-i18n');
  const locale = document.documentElement.lang === 'en' ? 'en' : 'vi';

  const t = (key, vars) => {
    let value = strings[key];
    if (value === undefined) {
      console.warn('[SH] missing string', key);
      return key;
    }
    Object.entries(vars || {}).forEach(([name, replacement]) => {
      value = value.split('{' + name + '}').join(String(replacement));
    });
    return value;
  };

  const url = (path) => path + (path.includes('?') ? '&' : '?') + 'lang=' + locale;
  const normalize = (text) => String(text || '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

  const lessons = new Map((data.lessons || []).map((l) => [String(l.id), l]));
  const signs = new Map((data.signs || []).map((s) => [s.slug, s]));

  /* Server state is memory-only; never mix two accounts or import the old browser store. */
  let state = {lessons:{}, signs:{}, quiz:{}, practice:[], favorites:[], activity:null, activities:[]};
  let queue = Promise.resolve();
  let pending = 0;
  const copy = value => JSON.parse(JSON.stringify(value));
  const message = (vi, en) => locale === 'vi' ? vi : en;
  const notice = (text, retry) => {
    const el = document.querySelector('[data-runtime-notice]');
    if (!el) return;
    el.replaceChildren(document.createTextNode(text)); el.hidden = false;
    el.setAttribute('role', 'alert');
    if (retry) {
      const button = document.createElement('button'); button.type = 'button';
      button.textContent = message('Thử lại', 'Retry');
      button.addEventListener('click', async () => {
        button.disabled = true;
        const ok = await retry();
        if (ok) el.hidden = true; else button.disabled = false;
      });
      el.append(' ', button);
    }
  };
  async function api(path, body) {
    const response = await fetch(path, {
      method:body ? 'POST' : 'GET', credentials:'same-origin', cache:'no-store',
      headers:body ? {'Content-Type':'application/json', 'X-SH-User':state.user?.id || ''} : {},
      body:body ? JSON.stringify(body) : undefined, keepalive:Boolean(body),
    });
    if (response.status === 401) {
      window.location.replace('/login?lang=' + locale + '&next=' + encodeURIComponent(location.pathname + location.search));
      throw new Error('session_required');
    }
    if (response.status === 409) {
      location.reload();
      throw new Error('account_changed');
    }
    if (!response.ok) throw new Error('request_failed');
    return response.status === 204 ? null : response.json();
  }
  async function hydrate(change) {
    const snapshot = await api('/api/learning/state');
    // An account change in another tab must never be applied to this tab's stale controls.
    if (state.user && state.user.id !== snapshot.user.id) {
      location.reload(); throw new Error('account_changed');
    }
    state = snapshot;
    window.dispatchEvent(new CustomEvent('sh:store', {detail:change || {type:'sync'}}));
  }
  function write(event) {
    pending++;
    const operation = queue.then(async () => {
      try {
        // Reusing the exact event on retry prevents duplicate practice/quiz records.
        await api('/api/learning/events', event);
        await hydrate(event);
        return true;
      } catch (error) {
        notice(message('Chưa thể xác nhận dữ liệu đã lưu. Vui lòng thử lại.',
          'Could not confirm your data was saved. Please retry.'), () => write(event));
        return false;
      } finally { pending--; }
    });
    queue = operation;
    return operation;
  }
  const store = {
    persistent: () => true,
    hasLegacyData() {
      try {
        const previous = JSON.parse(window.localStorage.getItem('signhearing:v1') || 'null');
        return Boolean(previous && Object.values(previous).some(value => value && Object.keys(value).length));
      } catch (ignored) { return false; }
    },
    lessonState: id => (state.lessons[id] && state.lessons[id].state) || 'not_started',
    setLessonState(id, value) {
      if (store.lessonState(id) === 'completed' || store.lessonState(id) === value) return Promise.resolve(true);
      return write({type:'lesson', id:String(id), state:value});
    },
    isSignSeen: slug => Boolean(state.signs[slug]),
    markSignSeen(slug) { return state.signs[slug] ? Promise.resolve(true) : write({type:'sign', id:slug}); },
    quizResults: id => (state.quiz[id] || []).slice(),
    addQuizResult(id, score, total, eventId) {
      return write({type:'quiz', id:String(id), score, total, event_id:eventId || crypto.randomUUID()});
    },
    practiceLog: () => state.practice.slice(),
    addPractice(slug, checklist, eventId) {
      return write({type:'practice', id:slug, checklist:copy(checklist), event_id:eventId || crypto.randomUUID()});
    },
    isFavorite: slug => state.favorites.includes(slug),
    favorites: () => state.favorites.slice(),
    toggleFavorite(slug) {
      return write({type:'favorite', id:slug, on:!store.isFavorite(slug)});
    },
    summary() {
      return {
        lessonsCompleted:Object.values(state.lessons).filter(l => l.state === 'completed').length,
        lessonsInProgress:Object.values(state.lessons).filter(l => l.state === 'in_progress').length,
        lessonsOpen:(data.lessons || []).filter(l => l.open).length,
        signsSeen:Object.keys(state.signs).length, practiceCount:state.practice.length,
        quizCount:Object.values(state.quiz).reduce((sum, list) => sum + list.length, 0),
        lastActivity:state.activity,
      };
    },
    export: () => copy(state),
    streak: () => copy(state.streak || {current:0,longest:0,days:[]}),
    activities: () => copy(state.activities),
    sync: () => hydrate(),
  };
  const auth = Object.freeze({
    isAuthenticated: () => Boolean(state.user),
    username: () => state.profile?.display_name || state.user?.email || '',
    user: () => copy(state.user),
    profile: () => copy(state.profile),
    async logout() {
      await queue;
      try {
        await api('/api/auth/logout', {});
        state = {lessons:{},signs:{},quiz:{},practice:[],favorites:[],activity:null,activities:[]};
        window.location.replace('/login?lang=' + locale);
      } catch (error) { notice(message('Đăng xuất chưa thành công. Hãy thử lại.', 'Sign out failed. Please retry.')); }
    },
  });
  const ready = hydrate().then(() => {
    document.body.classList.add('is-auth-ready');
    const loading = document.querySelector('[data-auth-loading]'); if (loading) loading.remove();
  }).catch(error => {
    const loading = document.querySelector('[data-auth-loading]');
    if (loading) {
      loading.textContent = message('Không thể tải dữ liệu học tập. ', 'Could not load learning data. ');
      const retry = document.createElement('button'); retry.type = 'button';
      retry.textContent = message('Tải lại', 'Reload'); retry.addEventListener('click', () => location.reload());
      loading.append(retry);
      const signout = document.createElement('button'); signout.type = 'button';
      signout.textContent = message('Đăng xuất', 'Sign out'); signout.addEventListener('click', auth.logout);
      loading.append(' ', signout);
    }
    throw error;
  });
  // The promise is also consumed by every module before it renders learner data.
  ready.catch(() => {});
  window.SH = Object.freeze({
    data, locale, t, url, normalize, store, auth, ready,
    lesson:id => lessons.get(String(id)) || null,
    sign:slug => signs.get(slug) || null,
    signsOf:lessonId => (data.signs || []).filter(s => String(s.lesson) === String(lessonId)),
  });
  document.querySelectorAll('[data-shell-logout]').forEach(button => button.addEventListener('click', auth.logout));
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!pending || !link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey
        || link.target || link.download || link.origin !== location.origin || link.pathname === location.pathname) return;
    event.preventDefault(); queue.then(() => location.assign(link.href));
  });
  // Refresh after returning from another device/tab. Never write on visibility or login.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) ready.then(() => queue).then(() => hydrate()).catch(() => {});
  });

  /* ---------- shell preferences ---------- */
  const sidebarToggle = document.querySelector('[data-sidebar-toggle]');
  if (sidebarToggle) {
    const SIDEBAR_KEY = 'signhearing:sidebar:collapsed';
    const page = document.body;
    let collapsed = false;
    try { collapsed = window.localStorage.getItem(SIDEBAR_KEY) === 'true'; } catch (error) { /* use default */ }

    const setSidebar = (next, savePreference) => {
      collapsed = Boolean(next);
      page.classList.toggle('is-sidebar-collapsed', collapsed);
      sidebarToggle.setAttribute('aria-expanded', String(!collapsed));
      const label = collapsed ? sidebarToggle.dataset.labelExpand : sidebarToggle.dataset.labelCollapse;
      sidebarToggle.setAttribute('aria-label', label);
      sidebarToggle.setAttribute('title', label);
      if (savePreference) {
        try { window.localStorage.setItem(SIDEBAR_KEY, String(collapsed)); } catch (error) { /* preference is optional */ }
      }
    };

    document.documentElement.classList.add('has-sidebar-js');
    setSidebar(collapsed, false);
    sidebarToggle.addEventListener('click', () => setSidebar(!collapsed, true));
  }

})();
