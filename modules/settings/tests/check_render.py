"""Run from project root: python -B modules/settings/tests/check_render.py."""
from html.parser import HTMLParser
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))
import app_modules
from i18n import DICTIONARIES, render_text

VIEW = app_modules.BY_ID['settings']['view']


class Markup(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.tags = []
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))


def rendered(locale, **translations):
    dictionary = dict(DICTIONARIES[locale], **translations)
    values = VIEW.context(SimpleNamespace(locale=locale, t=dictionary))
    source = render_text((ROOT / 'modules/settings/page.html').read_text(encoding='utf-8'),
                         dict(dictionary, **values, **{'url.vi': '/app/settings?lang=vi', 'url.en': '/app/settings?lang=en'}),
                         {key for key in values if key.endswith('.html')})
    return values, source, Markup(source).tags


class SettingsChecks(unittest.TestCase):
    def test_locales_prefix_and_language_selection(self):
        self.assertEqual({key for key in DICTIONARIES['vi'] if key.startswith('settings.')},
                         {key for key in DICTIONARIES['en'] if key.startswith('settings.')})
        for locale in ('vi', 'en'):
            values, _, tags = rendered(locale)
            self.assertTrue(all(key.startswith('settings.') for key in values))
            languages = [attrs for tag, attrs in tags if attrs.get('class') == 'settings-language']
            self.assertEqual(2, len(languages))
            self.assertEqual([locale], [attrs['hreflang'] for attrs in languages if 'aria-current' in attrs])
            self.assertTrue(all(attrs['href'] == '/app/settings?lang=' + attrs['hreflang'] for attrs in languages))

    def test_native_anchors_and_accessible_server_content(self):
        for locale in ('vi', 'en'):
            _, source, tags = rendered(locale)
            ids = [attrs['id'] for _, attrs in tags if 'id' in attrs]
            self.assertEqual(len(ids), len(set(ids)))
            self.assertEqual(1, sum(tag == 'h1' for tag, _ in tags))
            anchors = [attrs['href'][1:] for tag, attrs in tags if tag == 'a' and attrs['href'].startswith('#')]
            self.assertEqual(['ngon-ngu', 'du-lieu', 'camera', 'gioi-thieu'], anchors)
            self.assertTrue(all(anchor in ids for anchor in anchors))
            self.assertFalse(any(tag in ('form', 'script') or 'style' in attrs or any(key.startswith('on') for key in attrs) for tag, attrs in tags))
            self.assertIn('<noscript>', source)
            self.assertTrue(any('data-data-actions' in attrs and 'hidden' in attrs for _, attrs in tags))
            self.assertTrue(any(attrs.get('class') == 'sh-badge sh-badge--sample' for _, attrs in tags))
            self.assertTrue(any(tag == 'button' and 'disabled' in attrs for tag, attrs in tags))
            self.assertNotIn('shell.stub', source)

    def test_translated_status_is_escaped(self):
        malicious = '<img src=x onerror="bad()"> & test'
        _, source, tags = rendered('en', **{'settings.language.current': malicious, 'settings.confirm.note': malicious})
        self.assertNotIn(malicious, source)
        self.assertIn('&lt;img src=x onerror=&quot;bad()&quot;&gt; &amp; test', source)
        self.assertFalse(any(tag == 'img' for tag, _ in tags))

    def test_data_and_camera_api_boundaries(self):
        script = (ROOT / 'modules/settings/script.js').read_text(encoding='utf-8')
        for forbidden in ('localStorage', 'sessionStorage', 'window.confirm', 'getUserMedia', 'MediaRecorder', 'fetch(', 'XMLHttpRequest', 'innerHTML', 'setLessonState(', 'markSignSeen(', 'addPractice(', 'addQuizResult('):
            self.assertNotIn(forbidden, script)
        for required in ('SH.store.reset()', 'SH.store.export()', 'SH.store.summary()', 'SH.store.persistent()', 'URL.revokeObjectURL', "window.addEventListener('sh:store', paint)"):
            self.assertIn(required, script)


if __name__ == '__main__':
    unittest.main()
