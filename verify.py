"""Read-only acceptance checks: SSR i18n, cookie persistence, routes, asset links and module isolation."""
import argparse
import html
import json
import re
from datetime import date
from html.parser import HTMLParser
from http.cookiejar import CookieJar
from urllib.error import HTTPError
from urllib.parse import parse_qs, urljoin, urlsplit
from urllib.request import HTTPCookieProcessor, Request, build_opener

import app_modules
from i18n import DICTIONARIES, ROOT, TOKEN, format_date, format_number, render_text, validate

# One concrete URL per learning-area route (params filled with open sample content).
APP_PARAMS = {'id': '1', 'slug': 'xin-chao'}
APP_ROUTES = [(app_modules.PARAM_RE.sub(lambda m: APP_PARAMS[m.group(1)], r['path']), meta, r)
              for meta in app_modules.MODULES for r in meta['routes']]


def css_selectors(css):
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    for block in re.findall(r'([^{}]+)\{', css):
        block = block.strip()
        if block.startswith('@') or re.match(r'^(from|to|[\d.]+%)', block):
            continue
        yield from (part.strip() for part in block.split(','))


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
        self.links = []
        self.assets = set()
        self.headings = 0
        self.forms = 0
        self.lang = None
        self.values = []
        self.text = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        self.values.extend(value or '' for value in attrs.values())
        if tag == 'html':
            self.lang = attrs.get('lang')
        if 'id' in attrs:
            self.ids.add(attrs['id'])
        if tag == 'a':
            self.links.append(attrs.get('href', ''))
        if tag in ('img', 'script'):
            self.assets.add(attrs.get('src', ''))
        if tag == 'link':
            self.assets.add(attrs.get('href', ''))
        self.headings += tag == 'h1'
        self.forms += tag == 'form'

    def handle_data(self, data):
        self.text.append(data)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--url', default='http://127.0.0.1:8000')
    args = parser.parse_args()
    count = 0
    verified_assets = set()

    def check(condition, message):
        nonlocal count
        if not condition:
            raise AssertionError(message)
        count += 1

    def request(path, expected=200, opener=None, method='GET', headers=None):
        req = Request(urljoin(args.url, path), method=method, headers=headers or {})
        client = opener or build_opener()
        try:
            response = client.open(req, timeout=10)
        except HTTPError as error:
            response = error
        check(response.status == expected, (path, response.status, expected))
        with response:
            return response.read(), response.headers

    validate()
    check(set(DICTIONARIES['vi']) == set(DICTIONARIES['en']), 'Locale key mismatch')
    check(format_number(1234.5, 'vi') == '1.234,5', 'Vietnamese number format')
    check(format_number(1234.5, 'en') == '1,234.5', 'English number format')
    check(format_date(date(2026,10,28),'vi') == '28/10/2026', 'Vietnamese date')
    check(format_date(date(2026,10,28),'en') == 'Oct 28, 2026', 'English date')
    check(render_text('{{value}}', {'value':'<script>'}) == '&lt;script&gt;', 'HTML escaping')
    try:
        render_text('{{missing}}', {})
        raise AssertionError('Missing keys must fail')
    except KeyError:
        count += 1

    sources = {
        'https://www.congress.gov/109/crec/2006/03/28/CREC-2006-03-28.pdf#page=13',
        'https://www.helenkeller.org/get-involved/',
    }
    for locale in ('vi', 'en'):
        dictionary = DICTIONARIES[locale]
        for route, status, meta, app_route in [('/',200,None,None),('/404',404,None,None)] + [(path,200,meta,r) for path,meta,r in APP_ROUTES]:
            body, headers = request(route+'?lang='+locale, status)
            source = body.decode('utf-8')
            page = Page()
            page.feed(source)
            check(page.lang == locale, (route, 'document language'))
            check(headers['Content-Language'] == locale, (route,'response language'))
            check('Cookie' in headers['Vary'], 'Cache must vary on language cookie')
            check('no-store' in headers['Cache-Control'], 'Rendered language response must not be shared')
            check(page.headings == 1 and page.forms == 0, (route,'headings or fake form'))
            check(not TOKEN.search(source), (route,'raw translation token'))
            check('mailto:' not in source, 'No unverified contact address')
            text = ''.join(page.text)
            kind = 'home' if route == '/' else 'app' if meta else 'error'
            if kind == 'app':
                check('app-page m-' + meta['id'] in page.values, (route, 'module body class'))
                check(dictionary['shell.nav.label'] in page.values, (route, 'Untranslated app navigation'))
                description = dictionary.get(app_route.get('description_key', ''), dictionary['shell.meta.description'])
                check(description in page.values, (route, 'Untranslated metadata description'))
                if '{' not in app_route['path']:
                    check('<title>' + html.escape(dictionary[app_route['title_key']]) + ' · ' in source, (route, 'Untranslated page title'))
            else:
                check(dictionary['meta.'+kind+'.title'] in text, 'Untranslated page title')
                check(dictionary['meta.'+kind+'.description'] in page.values, 'Untranslated metadata description')
            check(dictionary['a11y.home'] in page.values, 'Untranslated home ARIA label')
            check(dictionary['a11y.language'] in page.values, 'Untranslated language control ARIA label')
            if route != '/404':
                check(dictionary['journey.material.note'] in text, 'Missing material status')
            if locale == 'en':
                check(not any(word in text for word in ('Chúng mình', 'Trở về', 'Đang chuẩn bị', 'Tạm dịch')), 'Mixed-language interface')
            if route == '/':
                check({'vsl','cau-chuyen','hanh-trinh','dong-hanh','lien-he'} <= page.ids, 'Missing story anchors')
                check(sources <= set(page.links), 'Quote sources missing')
                check(dictionary['contact.missing.body'] in text, 'Missing-contact disclosure')
                check('lang="en"' in source, 'Original quotations must keep English lang')
                if locale == 'vi':
                    check(dictionary['quote.translation.label'] in text, 'Vietnamese quote translation label')
            for asset in page.assets:
                if asset and asset not in verified_assets:
                    asset_body, asset_headers = request(asset)
                    check(bool(asset_body), 'Empty asset '+asset)
                    verified_assets.add(asset)
            for href in page.links:
                target = urlsplit(urljoin(args.url+route,href))
                if target.scheme == 'https':
                    check(href in sources, 'Unexpected external link '+href)
                    continue
                check(target.path in ('/','/404') or app_modules.is_app_path(target.path), 'Unexpected application flow '+href)
                if target.fragment and target.path == route:
                    check(target.fragment in page.ids, 'Broken local anchor '+href)
                if target.query:
                    lang = parse_qs(target.query).get('lang',[''])[0]
                    check(lang in ('vi','en'), 'Invalid language link')
            _, head_headers = request(route+'?lang='+locale, status, method='HEAD')
            check(head_headers['Content-Length'] == str(len(body)), 'HEAD length differs from GET')

    jar = CookieJar()
    browser = build_opener(HTTPCookieProcessor(jar))
    _, headers = request('/', opener=browser, headers={'Accept-Language':'en-US,en'})
    check(headers['Content-Language'] == 'vi', 'First visit must default to Vietnamese')
    _, headers = request('/?lang=en', opener=browser)
    check(headers['Content-Language'] == 'en', 'Explicit English selection')
    check('HttpOnly' in headers['Set-Cookie'] and 'SameSite=Lax' in headers['Set-Cookie'], 'Preference cookie flags')
    for path in ('/','/app','/app?lang=invalid','/not-a-page'):
        _, headers = request(path, 404 if path=='/not-a-page' else 200, opener=browser)
        check(headers['Content-Language'] == 'en', 'Language lost on direct/reload/error navigation')
    _, headers = request('/app?lang=vi', opener=browser)
    check(headers['Content-Language'] == 'vi', 'Switch back to Vietnamese')
    _, headers = request('/', opener=browser)
    check(headers['Content-Language'] == 'vi', 'Vietnamese preference was not saved')
    body,_ = request('/khu-hoc-tap?lang=en')
    check(DICTIONARIES['en']['dashboard.title'] in body.decode(), 'Legacy notice redirect lost language')
    _, headers = request('/?lang=invalid')
    check(headers['Content-Language']=='vi', 'Invalid locale should safely fall back')
    request('/app',404,method='POST')
    for route in ('/app/lessons/3','/app/lessons/999','/app/lessons/abc','/app/signs/khong-co','/app/practice/khong-co','/app/review/quiz/9',
                  '/app/library','/app/courses/1','/static/m/courses/view.py','/static/m/courses/module.json','/static/m/courses/locales/vi.json',
                  '/static/m/nope/style.css','/static/app/locales/vi.json','/static/m/courses/%2e%2e/%2e%2e/serve.py','/data/curriculum.json','/login','/register','/library','/courses','/admin','/api/health','/data/signhearing.db','/serve.py','/site-config.json','/locales/en.json','/static/../serve.py','/static/%2e%2e/serve.py'):
        request(route,404)
    check(json.loads((ROOT/'site-config.json').read_text())['contact_url']=='', 'Contact must remain unconfigured until verified')
    # Module isolation: scoped CSS, no direct storage access, every route reachable from code above.
    for meta in app_modules.MODULES:
        folder = meta['folder']
        if meta['has_css']:
            for selector in css_selectors((folder/'style.css').read_text(encoding='utf-8')):
                check(selector.startswith('.m-' + meta['id']), f"modules/{meta['id']}/style.css: selector '{selector}' must start with .m-{meta['id']}")
        if meta['has_js']:
            script = (folder/'script.js').read_text(encoding='utf-8')
            check('localStorage' not in script and 'sessionStorage' not in script, f"modules/{meta['id']}/script.js must use SH.store, not web storage")
        for key in [k for k in DICTIONARIES['vi'] if k.startswith(meta['id'] + '.')]:
            check(bool(DICTIONARIES['en'][key].strip()), f'{key} missing English')
    print(f'PASS: {count} HTTP/i18n/content checks; {len(DICTIONARIES["vi"])} matching keys per language; {len(app_modules.MODULES)} modules, {len(APP_ROUTES)} app routes.')
    print('Verified: VI/EN SSR, metadata, ARIA, all routes, anchors, asset links, cookies, reload/direct navigation, 404 and missing-contact disclosure.')
    print('Quote sources were verified separately against Congress.gov and Helen Keller Services.')
    print('Browser layout, animations, mobile interaction and screenshots are not covered by HTTP checks.')


if __name__ == '__main__':
    main()
