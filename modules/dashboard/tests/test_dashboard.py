"""Run from the project root: python -B -m unittest discover -s modules/dashboard/tests -v."""
import html
import importlib.util
from pathlib import Path
from types import SimpleNamespace
import unittest

import content
from i18n import DICTIONARIES, render_text

FOLDER = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('dashboard_test_view', FOLDER / 'view.py')
view = importlib.util.module_from_spec(spec)
spec.loader.exec_module(view)


class DashboardSSRTests(unittest.TestCase):
    def request(self, locale, source=content):
        return SimpleNamespace(
            t=DICTIONARIES[locale], locale=locale, content=source,
            esc=lambda value: html.escape(str(value), quote=True),
            url=lambda target: target + '?lang=' + locale,
            icon=lambda name: '<svg aria-hidden="true"></svg>',
        )

    def render(self, request):
        extra = view.context(request)
        values = dict(request.t, **extra)
        return render_text((FOLDER / 'page.html').read_text(encoding='utf-8'), values,
                           {key for key in extra if key.endswith('.html')})

    def test_no_javascript_content_and_locale_links(self):
        for locale in ('vi', 'en'):
            with self.subTest(locale=locale):
                source = self.render(self.request(locale))
                self.assertIn('/app/lessons/1?lang=' + locale, source)
                for name in ('courses', 'dictionary', 'practice', 'review'):
                    self.assertIn('/app/' + name + '?lang=' + locale, source)
                self.assertEqual(source.count('<h1 '), 1)
                self.assertEqual(source.count('>—</dd>'), 4)
                self.assertNotIn('shell.stub', source)
                self.assertNotIn('{{', source)
                self.assertIn(DICTIONARIES[locale]['shell.badge.sample'], source)

    def test_no_open_lessons_has_valid_fallback(self):
        source = SimpleNamespace(open_lessons=lambda: [], signs=lambda: [])
        for locale in ('vi', 'en'):
            rendered = self.render(self.request(locale, source))
            self.assertIn('/app/courses?lang=' + locale, rendered)
            self.assertNotIn('/app/lessons/', rendered)
            self.assertIn(DICTIONARIES[locale]['dashboard.empty.title'], rendered)

    def test_html_context_escapes_curriculum_and_translations(self):
        unsafe = '<img src=x onerror="alert(1)">'
        source = SimpleNamespace(
            open_lessons=lambda: [dict(content.open_lessons()[0], title={'vi': unsafe, 'en': unsafe})],
            module=lambda _: {'title': {'vi': unsafe, 'en': unsafe}},
            text=content.text, signs=content.signs,
        )
        request = self.request('en', source)
        request.t = dict(request.t, **{'dashboard.shortcut.courses': unsafe})
        rendered = self.render(request)
        self.assertNotIn(unsafe, rendered)
        self.assertIn(html.escape(unsafe), rendered)
        self.assertTrue(all(key.startswith('dashboard.') for key in view.context(request)))


if __name__ == '__main__':
    unittest.main()
