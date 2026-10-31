"""Language selection is available without JavaScript."""


def context(request):
    values = {}
    for locale in ('vi', 'en'):
        current = request.locale == locale
        values[f'settings.language.{locale}.current.html'] = ' aria-current="true"' if current else ''
        values[f'settings.language.{locale}.status'] = request.t['settings.language.current' if current else 'settings.language.choose']
    return values
