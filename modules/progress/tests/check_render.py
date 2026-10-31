"""Run from project root: python -B modules/progress/tests/check_render.py."""
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

VIEW = app_modules.BY_ID['progress']['view']


def request(locale='en', **overrides):
    facade = SimpleNamespace(**{key: getattr(content, key) for key in
                               ('modules', 'lessons', 'is_open', 'signs', 'open_lessons', 'text')})
    for key, value in overrides.items():
        setattr(facade, key, value)
    return SimpleNamespace(content=facade, locale=locale, t=DICTIONARIES[locale],
                           esc=lambda value: html.escape(str(value), quote=True),
                           url=lambda path: path + '?lang=' + locale)


class Markup(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.tags = []
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))


class ProgressChecks(unittest.TestCase):
    def test_locales_and_accessible_server_frame(self):
        self.assertEqual({key for key in DICTIONARIES['vi'] if key.startswith('progress.')},
                         {key for key in DICTIONARIES['en'] if key.startswith('progress.')})
        for locale in ('vi', 'en'):
            values = VIEW.context(request(locale))
            self.assertTrue(all(key.startswith('progress.') for key in values))
            source = render_text((ROOT / 'modules/progress/page.html').read_text(encoding='utf-8'),
                                 dict(DICTIONARIES[locale], **values), {key for key in values if key.endswith('.html')})
            tags = Markup(source).tags
            self.assertEqual(1, sum(tag == 'h1' for tag, _ in tags))
            self.assertEqual(4, sum('data-stat' in attrs for _, attrs in tags))
            self.assertEqual(5, sum(tag == 'noscript' for tag, _ in tags))
            self.assertFalse(any(tag == 'form' or 'style' in attrs or any(key.startswith('on') for key in attrs) for tag, attrs in tags))
            for tag, attrs in tags:
                if tag == 'a':
                    self.assertEqual('/app/courses?lang=' + locale, attrs['href'])

    def test_only_open_lesson_ids_in_all_eight_modules(self):
        tags = Markup(VIEW.context(request())['progress.modules.html']).tags
        rows = [attrs for _, attrs in tags if 'data-lessons' in attrs]
        self.assertEqual(len(content.modules()), len(rows))
        for module, row in zip(content.modules(), rows):
            self.assertEqual(','.join(str(lesson['id']) for lesson in content.lessons(module['id']) if content.is_open(lesson)), row['data-lessons'])
        self.assertEqual(7, sum(attrs.get('class') == 'sh-badge sh-badge--planned' for _, attrs in tags))

    def test_no_open_content_has_no_fake_progress(self):
        values = VIEW.context(request(is_open=lambda _: False, open_lessons=lambda: [], signs=lambda: []))
        tags = Markup(values['progress.modules.html']).tags
        self.assertEqual(8, sum(attrs.get('class') == 'sh-badge sh-badge--planned' for _, attrs in tags))
        self.assertTrue(all(not attrs['data-lessons'] for _, attrs in tags if 'data-lessons' in attrs))
        self.assertEqual('', values['progress.sample.signs'])

    def test_untrusted_titles_ids_and_translations_are_escaped(self):
        malicious = '<img src=x onerror="bad()"> & \'quoted\''
        req = request(modules=lambda: [{'id': malicious, 'title': {'vi': malicious, 'en': malicious}}],
                      lessons=lambda _: [{'id': malicious, 'status': 'published'}])
        req.t = dict(req.t, **{'progress.empty.practice': malicious})
        values = VIEW.context(req)
        for key in ('progress.modules.html', 'progress.empty.practice.html'):
            self.assertNotIn(malicious, values[key])
            self.assertIn(html.escape(malicious, quote=True), values[key])

    def test_read_only_store_and_sample_metadata(self):
        values = VIEW.context(request())
        self.assertEqual({sign['slug'] for sign in content.signs() if sign['status'] == 'sample'}, set(values['progress.sample.signs'].split(',')))
        script = (ROOT / 'modules/progress/script.js').read_text(encoding='utf-8')
        for forbidden in ('localStorage', 'sessionStorage', 'setLessonState(', 'markSignSeen(', 'addPractice(', 'addQuizResult(', 'innerHTML'):
            self.assertNotIn(forbidden, script)
        self.assertIn("window.addEventListener('sh:store', render)", script)


if __name__ == '__main__':
    unittest.main()
