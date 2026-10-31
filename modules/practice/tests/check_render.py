"""Stdlib SSR checks: python -B modules/practice/tests/check_render.py."""
import html
from html.parser import HTMLParser
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))
import app_modules
import content
from i18n import DICTIONARIES, render_text

VIEW = app_modules.BY_ID['practice']['view']


def request(locale='en', slug=None, **overrides):
    facade = SimpleNamespace(**{name: getattr(content, name) for name in
                               ('lesson', 'sign', 'signs', 'text', 'is_open', 'open_lessons')})
    for name, value in overrides.items():
        setattr(facade, name, value)
    return SimpleNamespace(
        locale=locale, params={} if slug is None else {'slug': slug}, content=facade,
        t=DICTIONARIES[locale], NotFound=app_modules.NotFound,
        esc=lambda value: html.escape(str(value), quote=True),
        url=lambda path: path + '?lang=' + locale,
    )


class Markup(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.tags = []
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))


class PracticeChecks(unittest.TestCase):
    def test_locale_keys_and_valid_markup(self):
        vi = {key for key in DICTIONARIES['vi'] if key.startswith('practice.')}
        en = {key for key in DICTIONARIES['en'] if key.startswith('practice.')}
        self.assertEqual(vi, en)
        for locale in ('vi', 'en'):
            for slug in (None, 'xin-chao', 'ba-lo'):
                values = VIEW.context(request(locale, slug))
                self.assertTrue(all(key.startswith('practice.') for key in values))
                file = 'session.html' if slug else 'page.html'
                source = render_text((ROOT / 'modules/practice' / file).read_text(encoding='utf-8'),
                                     dict(DICTIONARIES[locale], **values), {key for key in values if key.endswith('.html')})
                tags = Markup(source).tags
                self.assertEqual(1, sum(tag == 'h1' for tag, _ in tags))
                self.assertFalse(any(tag == 'form' or 'style' in attrs or any(key.startswith('on') for key in attrs) for tag, attrs in tags))
                for tag, attrs in tags:
                    if tag == 'a':
                        self.assertIn('?lang=' + locale, attrs['href'])
                    if tag == 'video' and 'data-camera' in attrs:
                        self.assertTrue({'hidden', 'muted', 'playsinline', 'autoplay'} <= attrs.keys())
                        self.assertNotIn('src', attrs)
                if slug:
                    self.assertEqual(5, sum(tag == 'input' and 'data-check' in attrs for tag, attrs in tags))
                    self.assertEqual(1, sum(tag == 'fieldset' for tag, _ in tags))
                    self.assertIn('class="practice-feedback" hidden', source)

    def test_all_open_signs_and_collection_listed(self):
        groups = VIEW.context(request())['practice.groups.html']
        choices = {attrs['data-slug'] for tag, attrs in Markup(groups).tags if 'data-slug' in attrs}
        self.assertEqual({sign['slug'] for sign in content.signs()}, choices)
        self.assertIn('practice-local-title', groups)
        self.assertIn('practice-lesson-1', groups)
        self.assertIn('practice-lesson-2', groups)
        self.assertNotIn('practice-lesson-3', groups)

    def test_invalid_and_closed_signs_return_404(self):
        with self.assertRaises(app_modules.NotFound):
            VIEW.context(request(slug='khong-co'))
        with self.assertRaises(app_modules.NotFound):
            VIEW.context(request(slug='xin-chao', lesson=lambda _: dict(content.lesson(1), status='planned')))
        with self.assertRaises(app_modules.NotFound):
            VIEW.context(request(slug='bad', sign=lambda _: dict(content.sign('xin-chao'), lesson=None)))

    def test_next_signs_and_parent_links(self):
        first = VIEW.context(request(slug='xin-chao'))
        self.assertIn('/app/practice/tam-biet?lang=en', first['practice.next.html'])
        self.assertIn('/app/lessons/1?lang=en', first['practice.parent.html'])
        self.assertEqual('', VIEW.context(request(slug='ten'))['practice.next.html'])
        local = VIEW.context(request(slug='ba-lo'))
        self.assertIn('/app/practice/ba-ngoai?lang=en', local['practice.next.html'])
        self.assertNotIn('/app/lessons/', local['practice.parent.html'])
        self.assertEqual('', VIEW.context(request(slug='ban-ron'))['practice.next.html'])

    def test_escape_and_site_only_media(self):
        malicious = '<img src=x onerror="bad()"> & \'quoted\''
        original = content.sign('xin-chao')
        sign = dict(original, word={'vi': malicious, 'en': malicious}, meaning={'vi': malicious, 'en': malicious}, video='/media/" onerror="bad.mp4')
        listing = VIEW.context(request(signs=lambda *_: [sign]))
        detail = VIEW.context(request(slug=sign['slug'], sign=lambda _: sign, signs=lambda *_: [sign]))
        self.assertIn(html.escape(malicious, quote=True), listing['practice.groups.html'])
        self.assertNotIn(malicious, listing['practice.groups.html'])
        self.assertIn('src="/media/&quot; onerror=&quot;bad.mp4"', detail['practice.reference.html'])
        for media in (None, 'https://example.com/video.mp4', '//example.com/video.mp4', '/\\example.com/video.mp4'):
            value = VIEW.context(request(slug=sign['slug'], sign=lambda _, source=media: dict(original, video=source)))
            self.assertNotIn('<video', value['practice.reference.html'])
            self.assertEqual('', value['practice.video_controls.html'])
            self.assertIn(DICTIONARIES['en']['shell.video.missing'], value['practice.reference.html'])

    def test_empty_list(self):
        values = VIEW.context(request(signs=lambda *_: [], open_lessons=lambda: []))
        self.assertIn(DICTIONARIES['en']['practice.empty.content'], values['practice.groups.html'])

    def test_no_capture_or_transport_apis(self):
        script = (ROOT / 'modules/practice/script.js').read_text(encoding='utf-8')
        for forbidden in ('MediaRecorder', 'canvas', 'fetch(', 'XMLHttpRequest', 'localStorage', 'sessionStorage', 'markSignSeen', 'setLessonState'):
            self.assertNotIn(forbidden, script)
        self.assertIn('audio: false', script)
        self.assertIn("window.addEventListener('pagehide'", script)


if __name__ == '__main__':
    unittest.main()
