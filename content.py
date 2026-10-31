"""Read-only access to data/curriculum.json, shared by every learning module.

Modules never open the JSON file themselves: they call these helpers, so the data
format can change (or move to a database/API later) without touching every module.
"""
import json
import unicodedata

from i18n import ROOT

DATA = json.loads((ROOT / 'data' / 'curriculum.json').read_text(encoding='utf-8'))
CONFIG = json.loads((ROOT / 'site-config.json').read_text(encoding='utf-8'))
SHOW_SAMPLE = bool(CONFIG.get('show_sample_content', False))

_MODULES = {m['id']: m for m in DATA['modules']}
_LESSONS = {l['id']: l for l in DATA['lessons']}
_SIGNS = {s['slug']: s for s in DATA['signs']}


def is_open(item):
    """Published content is always open; 'sample' only while the dev flag is on."""
    return item['status'] == 'published' or (SHOW_SAMPLE and item['status'] == 'sample')


def text(field, locale, fallback=''):
    """Localised value of a {"vi": ..., "en": ...} field; fallback when the field is null/empty."""
    if not field:
        return fallback
    return field.get(locale) or field.get('vi') or fallback


def modules():
    return DATA['modules']


def module(module_id):
    return _MODULES.get(module_id)


def lessons(module_id=None):
    return [l for l in DATA['lessons'] if module_id is None or l['module'] == module_id]


def lesson(lesson_id):
    """lesson_id may come from the URL as a string."""
    try:
        return _LESSONS.get(int(lesson_id))
    except (TypeError, ValueError):
        return None


def open_lessons():
    return [l for l in DATA['lessons'] if is_open(l)]


def signs(lesson_id=None, only_open=True):
    result = [s for s in DATA['signs'] if lesson_id is None or s['lesson'] == lesson_id]
    return [s for s in result if is_open(s)] if only_open else result


def sign(slug):
    found = _SIGNS.get(slug)
    return found if found and is_open(found) else None


def normalize(value):
    """Lower-case, strip Vietnamese diacritics: 'Cảm ơn' -> 'cam on' (for search)."""
    value = value.replace('đ', 'd').replace('Đ', 'D')
    value = unicodedata.normalize('NFD', value)
    return ''.join(ch for ch in value if unicodedata.category(ch) != 'Mn').lower().strip()


def public_payload(locale):
    """The data handed to browser JS (only open content, already localised)."""
    return {
        'sampleMode': SHOW_SAMPLE,
        'modules': [{'id': m['id'], 'title': text(m['title'], locale), 'lessons': m['lessons']} for m in modules()],
        'lessons': [{'id': l['id'], 'module': l['module'], 'title': text(l['title'], locale) or None,
                     'open': is_open(l), 'signs': [s['slug'] for s in signs(l['id'])]} for l in DATA['lessons']],
        'signs': [{'slug': s['slug'], 'word': text(s['word'], locale), 'meaning': text(s['meaning'], locale),
                   'lesson': s['lesson'], 'video': s['video'], 'search': normalize(text(s['word'], 'vi') + ' ' + text(s['word'], 'en'))}
                  for s in signs()],
    }
