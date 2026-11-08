(async function(){'use strict';
  if (window.SH) { try { await window.SH.ready; } catch (error) { return; } }
  const SH = window.SH;
  const root = document.querySelector('.m-account .account-page');
  if (!SH || !root) return;
  const message = root.querySelector('[data-plan-message]');
  const accountName = root.querySelector('[data-account-name]');
  const username = SH.auth && SH.auth.username();
  if (username) root.querySelectorAll('[data-account-name]').forEach(el => { el.textContent = username; });
  const user = SH.auth.user();
  root.querySelectorAll('[data-account-email]').forEach(el => { el.textContent = user.email; });
  root.querySelector('[data-account-id]').textContent = user.id;
  root.querySelector('[data-account-joined]').textContent = new Intl.DateTimeFormat(SH.locale === 'vi' ? 'vi-VN' : 'en-GB', {dateStyle:'medium', timeZone:'Asia/Ho_Chi_Minh'}).format(new Date(user.created_at));
  root.querySelector('[data-legacy-data]').hidden = !SH.store.hasLegacyData();
  const logout = root.querySelector('[data-account-logout]');
  if (logout && SH.auth) logout.addEventListener('click', () => SH.auth.logout());
  root.addEventListener('click', event => {
    const button = event.target.closest('[data-plan-choice]');
    if (!button) return;
    message.textContent = SH.t('account.plan.unavailable', {plan:button.dataset.planChoice});
    message.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',block:'nearest'});
  });
})();
