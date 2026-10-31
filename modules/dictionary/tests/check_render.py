"""Run from the repository: python -B modules/dictionary/tests/check_render.py."""
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

VIEW = app_modules.BY_ID['dictionary']['view']


def request(locale='en', slug=None, **overrides):
    facade = SimpleNamespace(**{name: getattr(content, name) for name in
                               ('lesson', 'module', 'modules', 'sign', 'signs', 'text', 'normalize', 'is_open')})
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


class RenderChecks(unittest.TestCase):
    def test_all_open_signs_and_locales(self):
        vi = {key for key in DICTIONARIES['vi'] if key.startswith('dictionary.')}
        en = {key for key in DICTIONARIES['en'] if key.startswith('dictionary.')}
        self.assertEqual(vi, en)
        for locale in ('vi', 'en'):
            for slug in (None, 'xin-chao', 'bo'):
                values = VIEW.context(request(locale, slug))
                self.assertTrue(all(key.startswith('dictionary.') for key in values))
                template = 'detail.html' if slug else 'page.html'
                rendered = render_text((ROOT / 'modules/dictionary' / template).read_text(encoding='utf-8'),
                                       dict(DICTIONARIES[locale], **values),
                                       {key for key in values if key.endswith('.html')})
                markup = Markup(rendered)
                self.assertEqual(1, sum(tag == 'h1' for tag, _ in markup.tags))
                self.assertFalse(any(tag == 'form' for tag, _ in markup.tags))
                for tag, attrs in markup.tags:
                    if tag == 'a':
                        self.assertIn('?lang=' + locale, attrs['href'])
                if slug is None:
                    cards = [attrs for tag, attrs in markup.tags if tag == 'li' and 'data-slug' in attrs]
                    self.assertEqual({s['slug'] for s in content.signs()}, {card['data-slug'] for card in cards})

    def test_search_index_has_words_and_meanings_in_both_languages(self):
        values = VIEW.context(request())
        cards = {attrs['data-slug']: attrs for tag, attrs in Markup(values['dictionary.cards.html']).tags
                 if tag == 'li'}
        for query, slug in [('cam on', 'cam-on'), ('THANK', 'cam-on'), ('bo', 'bo'), ('bày tỏ', 'cam-on'), ('speaker', 'toi')]:
            index = cards[slug]['data-search']
            self.assertTrue(all(token in index for token in content.normalize(query).split()))

    def test_unavailable_modules_disabled(self):
        filters = [attrs for tag, attrs in Markup(VIEW.context(request())['dictionary.filters.html']).tags if tag == 'button']
        modules = [attrs for attrs in filters if attrs['data-module-filter'] != 'local']
        self.assertEqual(len(content.modules()), len(modules))
        self.assertNotIn('disabled', modules[0])
        self.assertTrue(all('disabled' in attrs for attrs in modules[1:]))

    def test_local_collection_not_assigned_to_a_lesson(self):
        local = [sign for sign in content.signs() if sign.get('collection') == 'local-videos']
        for sign in local:
            self.assertIsNone(sign['lesson'])
            for locale in ('vi', 'en'):
                values = VIEW.context(request(locale, sign['slug']))
                self.assertIn('<video', values['dictionary.media.html'])
                self.assertIn(DICTIONARIES[locale]['dictionary.collection.notice'], values['dictionary.media.html'])
                self.assertNotIn('/app/lessons/', values['dictionary.lesson.html'])
                self.assertNotIn('data-slug="' + sign['slug'] + '"', values['dictionary.related.html'])

    def test_unknown_and_closed_signs(self):
        with self.assertRaises(app_modules.NotFound):
            VIEW.context(request(slug='khong-co'))
        with self.assertRaises(app_modules.NotFound):
            VIEW.context(request(slug='xin-chao', lesson=lambda _id: dict(content.lesson(1), status='planned')))
        with self.assertRaises(app_modules.NotFound):
            VIEW.context(request(slug='xin-chao', sign=lambda _slug: None))

    def test_escaped_content_and_variants(self):
        malicious = '<img src=x onerror="bad()"> & \'quoted\''
        sign = dict(content.sign('xin-chao'), slug=malicious, word={'vi': malicious, 'en': malicious},
                    meaning={'vi': malicious, 'en': malicious}, variants=[{'en': malicious}],
                    video='/media/" onerror="bad.webm')
        listing = VIEW.context(request(signs=lambda *_: [sign]))
        detail = VIEW.context(request(slug='fixture', sign=lambda _: sign, signs=lambda *_: []))
        for value in [listing['dictionary.cards.html'], detail['dictionary.variants.html'], detail['dictionary.media.html']]:
            self.assertNotIn('<img', value)
        self.assertIn(html.escape(malicious, quote=True), listing['dictionary.cards.html'])
        self.assertIn(html.escape(malicious, quote=True), detail['dictionary.variants.html'])
        self.assertIn('src="/media/&quot; onerror=&quot;bad.webm"', detail['dictionary.media.html'])

    def test_media_variants_and_related(self):
        original = content.sign('xin-chao')
        for source in (None, 'https://example.com/video.webm', '//example.com/video.webm', '/\\example.com/video.webm'):
            values = VIEW.context(request(slug='xin-chao', sign=lambda _, s=source: dict(original, video=s)))
            self.assertNotIn('<video', values['dictionary.media.html'])
            self.assertIn(DICTIONARIES['en']['shell.video.missing'], values['dictionary.media.html'])
        values = VIEW.context(request(slug='xin-chao', sign=lambda _: dict(original, video='/media/sign.webm')))
        self.assertIn('controls preload="metadata" playsinline muted', values['dictionary.media.html'])
        self.assertIn(DICTIONARIES['en']['dictionary.variants.empty'], values['dictionary.variants.html'])
        related = {attrs['data-slug'] for tag, attrs in Markup(values['dictionary.related.html']).tags if tag == 'li'}
        self.assertEqual({s['slug'] for s in content.signs(1)} - {'xin-chao'}, related)

    def test_empty_collection_and_no_related(self):
        values = VIEW.context(request(signs=lambda *_: []))
        self.assertEqual('', values['dictionary.cards.html'])
        self.assertEqual('', values['dictionary.empty_hidden.html'])
        detail = VIEW.context(request(slug='bo', signs=lambda *_: []))
        self.assertIn(DICTIONARIES['en']['dictionary.related.empty'], detail['dictionary.related.html'])


if __name__ == '__main__':
    unittest.main()
