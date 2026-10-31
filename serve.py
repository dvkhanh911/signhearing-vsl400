"""SignHearing: shared VI/EN rendering, landing, learning area (/app/*, see app_modules.py) and localised 404."""
import argparse
import html
import json
import mimetypes
import re
from http.cookies import CookieError, SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit

import app_modules
from i18n import DICTIONARIES, LOCALES, ROOT, format_number, render_file

STATIC = ROOT / 'static'
RAW = {'layout.head', 'layout.header', 'layout.footer', 'layout.languages', 'layout.contact', 'translation.jordan', 'translation.keller', 'state.vi', 'state.en'}
CONFIG = json.loads((ROOT / 'site-config.json').read_text(encoding='utf-8'))
CONTACT = CONFIG.get('contact_url', '')
if CONTACT:
    parsed = urlsplit(CONTACT)
    if not (parsed.scheme == 'https' and parsed.netloc) and not (parsed.scheme == 'mailto' and '@' in parsed.path and not parsed.query):
        raise ValueError('contact_url must be a verified HTTPS or mailto address')


def page_context(locale, path, kind):
    values = dict(DICTIONARIES[locale])
    values.update({
        'locale': locale,
        'locale.og': 'vi_VN' if locale == 'vi' else 'en_US',
        'meta.title': values['meta.' + kind + '.title'],
        'meta.description': values['meta.' + kind + '.description'],
        'url.home': '/?lang=' + locale,
        'url.app': '/app?lang=' + locale,
        'url.vi': path + '?lang=vi',
        'url.en': path + '?lang=en',
        'state.vi': 'aria-current="true"' if locale == 'vi' else '',
        'state.en': 'aria-current="true"' if locale == 'en' else '',
        'year': '2026',
        'number.modules': format_number(8, locale),
        'number.lessons': format_number(18, locale),
        'contact.url': CONTACT,
    })
    values['layout.languages'] = render_file('partials/languages.html', values, RAW)
    header = 'partials/header.html' if kind == 'home' else 'partials/app-header.html'
    values['layout.header'] = render_file(header, values, RAW)
    values['layout.footer'] = render_file('partials/footer.html', values, RAW)
    values['layout.head'] = render_file('partials/head.html', values, RAW)
    values['layout.contact'] = render_file('partials/contact-link.html' if CONTACT else 'partials/contact-missing.html', values, RAW)
    for author in ('jordan', 'keller'):
        values['translation.' + author] = (
            '<p class="quote-translation"><span>' + html.escape(values['quote.translation.label']) + ': </span>'
            + html.escape(values['quote.' + author + '.translation']) + '</p>'
        ) if locale == 'vi' else ''
    return values


def render_page(locale, path, kind):
    template = {'home': 'index.html', 'app': 'under-construction.html', 'error': '404.html'}[kind]
    return render_file(template, page_context(locale, path, kind), RAW).encode('utf-8')


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.serve()

    def do_HEAD(self):
        self.serve(head_only=True)

    def do_POST(self):
        self.serve(error=True)

    def do_PUT(self):
        self.serve(error=True)

    def do_DELETE(self):
        self.serve(error=True)

    def request_locale(self, query):
        cookie = SimpleCookie()
        try:
            cookie.load(self.headers.get('Cookie', ''))
        except CookieError:
            cookie = SimpleCookie()
        remembered = cookie['signhearing_language'].value if 'signhearing_language' in cookie else 'vi'
        selected = parse_qs(query).get('lang', [''])[0]
        return selected if selected in LOCALES else remembered if remembered in LOCALES else 'vi'

    def response_headers(self, status, mime, size, locale=None):
        self.send_response(status)
        self.send_header('Content-Type', mime)
        self.send_header('Content-Length', str(size))
        self.send_header('Cache-Control', 'private, no-store' if locale else 'no-cache')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('Referrer-Policy', 'same-origin')
        self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; media-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'none'")
        if locale:
            self.send_header('Content-Language', locale)
            self.send_header('Vary', 'Cookie')
            self.send_header('Set-Cookie', 'signhearing_language=' + locale + '; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax')

    def send_static(self, candidate, head_only):
        if candidate.suffix == '.mp4':
            self.send_video(candidate, head_only)
            return
        body = candidate.read_bytes()
        mime = 'text/javascript' if candidate.suffix == '.js' else mimetypes.guess_type(candidate)[0] or 'application/octet-stream'
        if candidate.suffix in {'.css', '.js', '.svg'}:
            mime += '; charset=utf-8'
        self.response_headers(200, mime, len(body))
        self.end_headers()
        if not head_only:
            self.wfile.write(body)

    def send_video(self, candidate, head_only):
        """Stream local MP4s and single byte ranges so native seeking works."""
        with candidate.open('rb') as video:
            size = candidate.stat().st_size
            start, end, status = 0, size - 1, 200
            byte_range = self.headers.get('Range')
            # If-Range has no validator here: return the full representation.
            if byte_range and not self.headers.get('If-Range'):
                match = re.fullmatch(r'bytes=(\d{0,20})-(\d{0,20})', byte_range.strip())
                valid = bool(match and any(match.groups()) and size)
                if valid:
                    first, last = match.groups()
                    if first:
                        start = int(first)
                        end = min(int(last), size - 1) if last else size - 1
                    else:
                        suffix = int(last)
                        start = max(0, size - suffix)
                        valid = suffix > 0
                    valid = valid and start <= end and start < size
                if not valid:
                    self.response_headers(416, 'video/mp4', 0)
                    self.send_header('Content-Range', f'bytes */{size}')
                    self.send_header('Accept-Ranges', 'bytes')
                    self.end_headers()
                    return
                status = 206
            length = max(0, end - start + 1)
            self.response_headers(status, 'video/mp4', length)
            self.send_header('Accept-Ranges', 'bytes')
            if status == 206:
                self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
            self.end_headers()
            if head_only:
                return
            video.seek(start)
            try:
                while length:
                    block = video.read(min(length, 64 * 1024))
                    if not block:
                        break
                    self.wfile.write(block)
                    length -= len(block)
            except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
                pass  # Browsers cancel an old range when seeking to a new one.

    def serve(self, head_only=False, error=False):
        url = urlsplit(self.path)
        path = unquote(url.path)
        locale = self.request_locale(url.query)
        if path in ('/khu-hoc-tap', '/khu-hoc-tap/') and not error:
            self.response_headers(302, 'text/html; charset=utf-8', 0, locale)
            self.send_header('Location', '/app?lang=' + locale)
            self.end_headers()
            return
        if path.startswith(('/static/app/', '/static/m/')) and not error:
            candidate = app_modules.static_file(path)
            if candidate:
                self.send_static(candidate, head_only)
                return
        elif path.startswith('/static/') and not error:
            candidate = (ROOT / path.lstrip('/')).resolve()
            if candidate.is_relative_to(STATIC) and candidate.suffix in {'.css', '.js', '.png', '.svg', '.webp', '.woff2', '.mp4'} and candidate.is_file():
                self.send_static(candidate, head_only)
                return
        body = None
        if not error and app_modules.is_app_path(path):
            # Learning area: the path matched a registered module route, so it is safe to reuse.
            app_path = path.rstrip('/') or '/'
            try:
                body = app_modules.render(locale, app_path, page_context(locale, app_path, 'app')).encode('utf-8')
                kind = 'app'
            except app_modules.NotFound:
                body = None
        if body is None:
            kind = 'home' if path == '/' and not error else 'error'
            # Unknown paths never enter a template or language-switch href.
            canonical_path = '/' if kind == 'home' else '/404'
            body = render_page(locale, canonical_path, kind)
        self.response_headers(404 if kind == 'error' else 200, 'text/html; charset=utf-8', len(body), locale)
        self.end_headers()
        if not head_only:
            self.wfile.write(body)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='SignHearing bilingual preview')
    parser.add_argument('--port', type=int, default=8000)
    args = parser.parse_args()
    with ThreadingHTTPServer(('127.0.0.1', args.port), Handler) as server:
        print(f'SignHearing preview: http://127.0.0.1:{args.port} · VI/EN', flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
