"""Module-only SSR checks. Run from the repository: python -B modules/lesson/tests/check_render.py."""
import html
import json
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))
import app_modules
import content
from i18n import DICTIONARIES, render_text

VIEW = app_modules.BY_ID['lesson']['view']


def request(locale='en', lesson_id='1', signs=None):
    facade = SimpleNamespace(
        lesson=content.lesson, is_open=content.is_open, text=content.text,
        module=content.module,
        signs=content.signs if signs is None else lambda _id: signs,
    )
    return SimpleNamespace(
        content=facade, params={'id': lesson_id}, locale=locale,
        t=DICTIONARIES[locale], NotFound=app_modules.NotFound,
        esc=lambda value: html.escape(str(value), quote=True),
        url=lambda path: path + '?lang=' + locale,
    )


def fixture():
    signs = [dict(sign) for sign in content.signs(1)]
    signs[0]['video'] = '/static/m/lesson/test-only.webm'
    values = dict(DICTIONARIES['en'], **VIEW.context(request(signs=signs)))
    page = (ROOT / 'modules/lesson/page.html').read_text(encoding='utf-8')
    return render_text(page, values, {key for key in values if key.endswith('.html')})


class RenderChecks(unittest.TestCase):
    def test_invalid_and_closed_lessons(self):
        for identifier in ('3', '999', 'abc', '-1', ''):
            with self.subTest(identifier=identifier), self.assertRaises(app_modules.NotFound):
                VIEW.context(request(lesson_id=identifier))

    def test_locale_and_anchor_contract(self):
        vi = {key for key in DICTIONARIES['vi'] if key.startswith('lesson.')}
        en = {key for key in DICTIONARIES['en'] if key.startswith('lesson.')}
        self.assertEqual(vi, en)
        for locale in ('vi', 'en'):
            for identifier in ('1', '2'):
                values = VIEW.context(request(locale, identifier))
                self.assertTrue(all(key.startswith('lesson.') for key in values))
                for sign in content.signs(int(identifier)):
                    self.assertIn('href="#sign-' + sign['slug'] + '"', values['lesson.list.html'])
                    self.assertIn('id="sign-' + sign['slug'] + '"', values['lesson.articles.html'])
                self.assertEqual(values['lesson.articles.html'].count('data-video-missing'), len(content.signs(int(identifier))))

    def test_escape_all_content_and_media_attributes(self):
        sign = dict(content.signs(1)[0])
        malicious = '<img src=x onerror="alert(1)"> & \'quote\''
        sign.update(slug=malicious, word={'en': malicious}, meaning={'en': malicious},
                    video='/media/" onerror="bad.webm')
        values = VIEW.context(request(signs=[sign]))
        for key in ('lesson.list.html', 'lesson.articles.html'):
            self.assertNotIn(malicious, values[key])
            self.assertIn(html.escape(malicious, quote=True), values[key])
        self.assertIn('src="/media/&quot; onerror=&quot;bad.webm"', values['lesson.articles.html'])

    def test_media_and_quiz_branches(self):
        original = dict(content.signs(1)[0])
        for source in (None, 'https://example.com/video.webm', '//example.com/video.webm', '/\\example.com/video.webm'):
            values = VIEW.context(request(signs=[dict(original, video=source)]))
            self.assertNotIn('<video', values['lesson.articles.html'])
            self.assertEqual('', values['lesson.quiz.html'])
        values = VIEW.context(request(signs=[dict(original, video='/media/sign.webm')]))
        self.assertIn('preload="metadata" playsinline muted controls', values['lesson.articles.html'])
        self.assertEqual(3, values['lesson.articles.html'].count('data-rate='))
        self.assertIn('data-video-controls hidden', values['lesson.articles.html'])
        self.assertEqual(5, values['lesson.articles.html'].count('lesson-observe-number'))
        self.assertIn('?lang=en', VIEW.context(request())['lesson.quiz.html'])

    def test_empty_open_lesson(self):
        values = VIEW.context(request(signs=[]))
        self.assertEqual('', values['lesson.list.html'])
        self.assertEqual('', values['lesson.quiz.html'])
        self.assertIn(DICTIONARIES['en']['lesson.empty'], values['lesson.articles.html'])


if __name__ == '__main__':
    if '--fixture' in sys.argv:
        print(json.dumps(fixture(), ensure_ascii=True))
    else:
        unittest.main()
