(function () {
  'use strict';
  const form = document.getElementById('login-form');
  if (!form) return;
  const vi = document.documentElement.lang !== 'en';
  const text = (a,b) => vi ? a : b;
  const error = form.querySelector('[data-login-error]');
  const toggle = document.querySelector('[data-auth-toggle]');
  const submit = form.querySelector('[type=submit]');
  const title = document.getElementById('login-form-title');
  const transition = document.querySelector('[data-login-transition]');
  const next = new URLSearchParams(location.search).get('next');
  let registering = false;
  let busy = false;
  document.querySelectorAll('.language-switch a').forEach(link => {
    if (!next) return;
    const url = new URL(link.href); url.searchParams.set('next', next); link.href = url.href;
  });
  function destination() {
    try {
      const url = new URL(next || '/app', location.origin);
      if (url.origin === location.origin && /^\/app(?:\/|$)/.test(url.pathname)) {
        url.searchParams.set('lang', vi ? 'vi' : 'en'); return url.pathname + url.search + url.hash;
      }
    } catch (ignored) { /* use default */ }
    return '/app?lang=' + (vi ? 'vi' : 'en');
  }
  const errors = {
    invalid_credentials:text('Email hoặc mật khẩu không đúng.', 'Email or password is incorrect.'),
    email_exists:text('Email này đã được đăng ký.', 'This email is already registered.'),
    user_already_exists:text('Email này đã được đăng ký.', 'This email is already registered.'),
    weak_password:text('Mật khẩu chưa đáp ứng yêu cầu bảo mật.', 'Password does not meet security requirements.'),
    email_not_confirmed:text('Email chưa được xác nhận. Kiểm tra cấu hình Auth.', 'Email is not confirmed. Check Auth settings.'),
    email_confirmation_required:text('Tài khoản chưa có phiên đăng nhập. Quản trị viên cần kiểm tra thiết lập xác nhận email trong Supabase.', 'No session was issued. Ask the administrator to check Supabase email confirmation settings.'),
    supabase_not_configured:text('Đăng nhập chưa được cấu hình. Vui lòng liên hệ quản trị viên.', 'Authentication is not configured. Please contact the administrator.'),
    rate_limited:text('Quá nhiều yêu cầu. Vui lòng chờ rồi thử lại.', 'Too many requests. Please wait and retry.'),
    signup_disabled:text('Đăng ký hiện đang tắt.', 'Registration is currently disabled.'),
  };
  toggle.addEventListener('click', () => {
    if (busy) return;
    registering = !registering;
    form.querySelector('[data-register-fields]').hidden = !registering;
    form.elements.confirm.required = registering;
    form.elements.password.autocomplete = registering ? 'new-password' : 'current-password';
    form.elements.password.minLength = registering ? 8 : 1;
    form.elements.password.maxLength = 128;
    title.textContent = registering ? text('Tạo tài khoản', 'Create account') : text('Đăng nhập', 'Sign in');
    submit.textContent = title.textContent;
    toggle.textContent = registering ? text('Đã có tài khoản? Đăng nhập', 'Have an account? Sign in') : text('Chưa có tài khoản? Đăng ký', 'New here? Create account');
    error.hidden = true;
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !form.reportValidity()) return;
    if (registering && form.elements.password.value !== form.elements.confirm.value) {
      error.textContent = text('Mật khẩu xác nhận không khớp.', 'Passwords do not match.'); error.hidden = false; return;
    }
    busy = true; submit.disabled = true; toggle.disabled = true; error.hidden = true;
    try {
      const body = {email:form.elements.username.value.trim(),password:form.elements.password.value};
      if (registering) body.display_name = form.elements.display_name.value.trim();
      const response = await fetch('/api/auth/' + (registering ? 'register' : 'login'), {
        method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(errors[result.error?.code] || text('Không thể đăng nhập/đăng ký. Kiểm tra thông tin và thử lại.', 'Could not sign in/register. Check your details and retry.'));
      try { localStorage.removeItem('signhearing:demo-auth'); localStorage.removeItem('signhearing:demo-user'); } catch (ignored) { /* optional cleanup */ }
      form.elements.password.value = ''; form.elements.confirm.value = '';
      const user = result.user.user_metadata?.display_name || result.user.email;
      document.querySelector('[data-transition-user]').textContent = text('Xin chào, ', 'Welcome, ') + user + '!';
      transition.setAttribute('aria-hidden', 'false');
      document.body.classList.add('is-authenticating');
      setTimeout(() => document.body.classList.add('is-auth-welcoming'), 1150);
      setTimeout(() => location.replace(destination()), matchMedia('(prefers-reduced-motion: reduce)').matches ? 300 : 3200);
    } catch (failure) {
      error.textContent = failure instanceof TypeError ? text('Không thể kết nối. Kiểm tra mạng rồi thử lại.', 'Connection failed. Check your network and retry.') : failure.message;
      error.hidden = false;
      busy = false; submit.disabled = false; toggle.disabled = false;
    }
  });
})();
