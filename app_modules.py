"""Learning-area registry: discovers modules/<id>/module.json and renders them inside the app shell.

Adding or changing a module never requires editing this file, serve.py or locales/*.json:
each module owns one folder (see docs/MODULES.md).
"""
import html
import importlib.util
import json
import re
from types import SimpleNamespace

import content
from i18n import DICTIONARIES, ROOT, render_file, render_text

SHELL = ROOT / 'app_shell'
MODULES_DIR = ROOT / 'modules'
ID_RE = re.compile(r'^[a-z][a-z0-9-]*$')
PARAM_RE = re.compile(r'{([a-z]+)}')
STATIC_SUFFIXES = {'.css', '.js', '.png', '.svg', '.webp', '.jpg'}


class NotFound(Exception):
    """Raise from a module's view.py when a URL parameter does not exist / is not open."""


ICONS = {
    'home': '<path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4.5v-5.5h-5V21H5a1 1 0 0 1-1-1z"/>',
    'map': '<path d="M9 5 4 7v12l5-2 6 2 5-2V5l-5 2-6-2zM9 5v12M15 7v12"/>',
    'search': '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>',
    'camera': '<rect x="3" y="7" width="13" height="10" rx="2"/><path d="m16 11 5-3v8l-5-3"/>',
    'cards': '<rect x="7" y="4" width="12" height="15" rx="2"/><path d="M5 7v12a2 2 0 0 0 2 2h9"/>',
    'chart': '<path d="M4 20h16M7 16v-4M12 16V8M17 16v-7"/>',
    'settings': '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
    'book': '<path d="M5 4h9a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM17 20h2V7"/>',
}


def icon(name):
    return ('<svg class="sh-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">'
            + ICONS.get(name, ICONS['book']) + '</svg>')


def _load_view(folder):
    file = folder / 'view.py'
    if not file.is_file():
        return None
    spec = importlib.util.spec_from_file_location('signhearing_view_' + folder.name.replace('-', '_'), file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    if not hasattr(module, 'context'):
        raise ValueError(f'{file.relative_to(ROOT)} must define context(request)')
    return module


def _discover():
    modules, routes, seen = [], [], {}
    for folder in sorted(MODULES_DIR.iterdir()):
        if not folder.is_dir() or folder.name.startswith(('_', '.')):
            continue
        meta = json.loads((folder / 'module.json').read_text(encoding='utf-8'))
        if meta.get('id') != folder.name or not ID_RE.match(folder.name):
            raise ValueError(f'modules/{folder.name}/module.json: "id" must equal the folder name')
        meta['folder'] = folder
        meta['view'] = _load_view(folder)
        meta['has_css'] = (folder / 'style.css').is_file()
        meta['has_js'] = (folder / 'script.js').is_file()
        for route in meta['routes']:
            path = route['path']
            if not path.startswith('/app') or path in seen:
                raise ValueError(f'{folder.name}: route {path} is invalid or already used by {seen.get(path)}')
            seen[path] = folder.name
            if not (folder / route['page']).is_file():
                raise ValueError(f'{folder.name}: page file {route["page"]} not found')
            pattern = '^' + PARAM_RE.sub(lambda m: f'(?P<{m.group(1)}>[a-z0-9-]{{1,60}})', re.escape(path).replace('\\{', '{').replace('\\}', '}')) + '$'
            routes.append((re.compile(pattern), meta, route))
        modules.append(meta)
    return modules, routes


MODULES, ROUTES = _discover()
BY_ID = {m['id']: m for m in MODULES}


def match(path):
    """Return (module meta, route, params) or None."""
    path = path.rstrip('/') or '/'
    for pattern, meta, route in ROUTES:
        found = pattern.match(path)
        if found:
            return meta, route, found.groupdict()
    return None


def is_app_path(path):
    return match(path) is not None


def _json_block(value):
    return json.dumps(value, ensure_ascii=False).replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026')


def _nav(locale, active_id):
    items = sorted((m for m in MODULES if m.get('nav')), key=lambda m: m['nav']['order'])
    links = []
    for m in items:
        current = ' aria-current="page"' if m['id'] == active_id else ''
        label = html.escape(DICTIONARIES[locale][m['nav']['label_key']])
        href = html.escape(m['routes'][0]['path'] + '?lang=' + locale)
        status = '' if m.get('status') == 'done' else '<span class="sh-nav-dot" aria-hidden="true"></span>'
        links.append(f'<a href="{href}"{current}>{icon(m["nav"]["icon"])}<span>{label}</span>{status}</a>')
    return ''.join(links)


def render(locale, path, base_values):
    """Render one learning-area page. Raises NotFound for unknown params."""
    meta, route, params = match(path)
    t = DICTIONARIES[locale]
    request = SimpleNamespace(
        locale=locale, params=params, path=path, route=route, t=t, content=content, NotFound=NotFound,
        url=lambda target: target + ('&' if '?' in target else '?') + 'lang=' + locale,
        esc=lambda value: html.escape(str(value), quote=True), icon=icon,
    )
    extra = meta['view'].context(request) if meta['view'] else {}
    for key in extra:
        if not (key.startswith(meta['id'] + '.') or key == 'page.title'):
            raise ValueError(f'{meta["id"]}/view.py returned "{key}": keys must start with "{meta["id"]}."')

    values = dict(base_values)
    values.update(extra)
    title = extra.get('page.title') or t[route['title_key']]
    values['meta.title'] = title + ' · ' + t['site.name']
    values['meta.description'] = t.get(route.get('description_key', ''), t['shell.meta.description'])
    values['module.id'] = meta['id']

    # Stub card for modules nobody has built yet.
    owner = meta.get('owner') or t['shell.stub.unassigned']
    values['shell.stub.html'] = (
        '<div class="sh-card sh-stub-card"><p class="sh-stub-title">' + html.escape(t['shell.stub.title']) + '</p>'
        '<p>' + html.escape(t['shell.stub.body']) + '</p><dl><dt>' + html.escape(t['shell.stub.owner']) + '</dt><dd>'
        + html.escape(owner) + '</dd><dt>' + html.escape(t['shell.stub.spec']) + '</dt><dd><code>modules/'
        + html.escape(meta['id']) + '/README.md</code></dd></dl></div>')

    raw = {k for k in values if k.endswith('.html')} | {'layout.head', 'layout.languages'}
    values['module.body'] = render_file(str((meta['folder'] / route['page']).relative_to(ROOT)), values, raw)

    parent_id = meta.get('nav_parent', meta['id'])
    parent = BY_ID.get(parent_id)
    crumbs = ['<a href="' + html.escape('/app?lang=' + locale) + '">' + html.escape(t['shell.crumb.root']) + '</a>']
    if parent and parent['id'] != 'dashboard' and (parent is not meta or route is not meta['routes'][0]):
        crumbs.append('<a href="' + html.escape(parent['routes'][0]['path'] + '?lang=' + locale) + '">'
                      + html.escape(t[parent['nav']['label_key']]) + '</a>')
    if path != '/app':
        crumbs.append('<span aria-current="page">' + html.escape(title) + '</span>')
    values['shell.crumbs.html'] = '<span class="sh-crumb-sep" aria-hidden="true">/</span>'.join(crumbs)
    values['shell.nav.html'] = _nav(locale, parent_id)
    values['shell.notice.html'] = ('<span class="sh-notice-sample">' + html.escape(t['shell.notice.sample']) + '</span>') if content.SHOW_SAMPLE else ''

    assets = ['<link rel="stylesheet" href="/static/app/shell.css">']
    if meta['has_css']:
        assets.append(f'<link rel="stylesheet" href="/static/m/{meta["id"]}/style.css">')
    assets.append('<script src="/static/app/core.js" defer></script>')
    if meta['has_js']:
        assets.append(f'<script src="/static/m/{meta["id"]}/script.js" defer></script>')
    values['shell.assets.html'] = ''.join(assets)
    values['layout.head'] = render_file('app_shell/head.html', values, raw | {'shell.assets.html'})

    strings = {k: v for k, v in t.items() if k.startswith(('shell.', meta['id'] + '.'))}
    values['shell.data.json'] = _json_block(content.public_payload(locale))
    values['shell.i18n.json'] = _json_block(strings)
    raw |= {'shell.assets.html', 'shell.data.json', 'shell.i18n.json', 'module.body', 'layout.head',
            'shell.crumbs.html', 'shell.nav.html', 'shell.notice.html', 'shell.stub.html'}
    return render_file('app_shell/layout.html', values, raw)


def static_file(path):
    """/static/app/<file> -> app_shell/<file>; /static/m/<id>/<file> -> modules/<id>/<file>. No sub-folders except assets/."""
    if path.startswith('/static/app/'):
        base, rest = SHELL, path[len('/static/app/'):]
    elif path.startswith('/static/m/'):
        module_id, _, rest = path[len('/static/m/'):].partition('/')
        if module_id not in BY_ID:
            return None
        base = BY_ID[module_id]['folder']
    else:
        return None
    candidate = (base / rest).resolve()
    allowed = {base.resolve()} | {(base / 'assets').resolve()}
    if candidate.parent in allowed and candidate.suffix in STATIC_SUFFIXES and candidate.is_file():
        return candidate
    return None
