const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#main-nav');

if (menuButton && navigation) {
  const setOpen = (open, restoreFocus = false) => {
    menuButton.setAttribute('aria-expanded', String(open));
    navigation.classList.toggle('is-open', open);
    if (restoreFocus) menuButton.focus();
  };

  document.documentElement.classList.add('has-menu-js');
  menuButton.addEventListener('click', () => {
    setOpen(menuButton.getAttribute('aria-expanded') !== 'true');
  });
  navigation.addEventListener('click', (event) => {
    const link = event.target.closest('a');
    if (!link) return;
    setOpen(false);
    const target = link.hash ? document.getElementById(link.hash.slice(1)) : null;
    if (target) {
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
      setOpen(false, true);
    }
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.header-inner')) setOpen(false);
  });
  const mobileQuery = window.matchMedia('(max-width: 960px)');
  mobileQuery.addEventListener('change', () => setOpen(false));
}

// Language links navigate to a complete server-rendered page. Preserve the story position.
document.querySelectorAll('.language-switch a').forEach(link => {
  link.addEventListener('click', () => {
    const next = new URL(link.href);
    next.hash = window.location.hash;
    link.href = next.toString();
  });
});

// Footer contact links reveal the honest missing-contact state, without a fake form.
const revealContact = () => {
  if (window.location.hash !== '#lien-he') return;
  const contact = document.getElementById('lien-he');
  if (contact?.tagName === 'DETAILS') contact.open = true;
};
window.addEventListener('hashchange', revealContact);
revealContact();

const header = document.querySelector('.site-header');
if (header && 'ResizeObserver' in window) {
  new ResizeObserver(() => {
    document.documentElement.style.setProperty('--sticky-offset', `${header.getBoundingClientRect().height}px`);
  }).observe(header);
}

// Content starts visible. Animation is only added after a section is already on screen.
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
if ('IntersectionObserver' in window && !reducedMotion.matches) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-entering');
      observer.unobserve(entry.target);
    });
  }, {threshold: 0.08});
  document.querySelectorAll('.reveal').forEach(section => observer.observe(section));
}
