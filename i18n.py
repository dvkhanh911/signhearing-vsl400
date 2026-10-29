"""Shared server-rendered VI/EN dictionaries; no DOM text replacement or dependency."""
import html
import json
import re
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent
LOCALES = ('vi', 'en')
TOKEN = re.compile(r'{{\s*([a-z][a-z0-9_.]*)\s*}}')
DICTIONARIES = {locale: json.loads((ROOT / 'locales' / (locale + '.json')).read_text(encoding='utf-8')) for locale in LOCALES}


def validate():
    reference = set(DICTIONARIES['vi'])
    for locale, entries in DICTIONARIES.items():
        if set(entries) != reference:
            raise ValueError(f'Locale {locale}: missing={reference-set(entries)}, extra={set(entries)-reference}')
        if any(not isinstance(value, str) or not value.strip() for value in entries.values()):
            raise ValueError(f'Locale {locale} has an empty or invalid entry')


def render_text(template, values, raw=()):
    def replace(match):
        key = match.group(1)
        if key not in values:
            raise KeyError(f'Missing template translation/context: {key}')
        return str(values[key]) if key in raw else html.escape(str(values[key]), quote=True)
    return TOKEN.sub(replace, template)


def render_file(name, values, raw=()):
    return render_text((ROOT / name).read_text(encoding='utf-8'), values, raw)


def format_number(value, locale='vi'):
    result = format(value, ',')
    return result.replace(',', '\u0000').replace('.', ',').replace('\u0000', '.') if locale == 'vi' else result


def format_date(value: date, locale='vi'):
    if locale == 'vi':
        return value.strftime('%d/%m/%Y')
    months = ('Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec')
    return f'{months[value.month-1]} {value.day}, {value.year}'


validate()
