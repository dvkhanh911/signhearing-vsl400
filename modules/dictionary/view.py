"""Server-rendered sign catalogue and details; no learner progress is written here."""

from urllib.parse import urlsplit


def context(request):
    c, t, esc, locale = request.content, request.t, request.esc, request.locale

    def sample(sign):
        return (f'<span class="sh-badge sh-badge--sample">{esc(t["shell.badge.sample"])}</span>'
                if sign['status'] == 'sample' else '')

    def video_source(sign):
        source = sign.get('video')
        if (isinstance(source, str) and source.startswith('/') and not source.startswith('//')
                and '\\' not in source and not urlsplit(source).netloc and not urlsplit(source).scheme):
            return source
        return None

    def card(sign):
        lesson = c.lesson(sign['lesson'])
        module = c.module(lesson['module']) if lesson else None
        # Keep both languages in the index regardless of the displayed language.
        search = c.normalize(' '.join(c.text(sign[field], language)
                                     for field in ('word', 'meaning') for language in ('vi', 'en')))
        caption = (t['dictionary.card.context'].replace('{n}', str(lesson['id'])).replace('{module}', c.text(module['title'], locale))
                   if lesson else t['dictionary.collection.name'])
        media_label = (t['dictionary.video.imported'] if sign.get('collection') == 'local-videos'
                       else t['dictionary.video.available']) if video_source(sign) else t['dictionary.video.missing']
        module_id = module['id'] if module else 'local'
        return (
            f'<li class="dictionary-item" data-slug="{esc(sign["slug"])}" data-module="{esc(module_id)}" data-search="{esc(search)}">'
            f'<a class="sh-card dictionary-card" href="{esc(request.url("/app/signs/" + sign["slug"]))}">'
            f'<span class="dictionary-card-badges">{sample(sign)}'
            f'<span class="sh-badge dictionary-favorite-mark" data-favorite-mark hidden>{esc(t["dictionary.favorite.mark"])}</span></span>'
            f'<h2>{esc(c.text(sign["word"], locale))}</h2>'
            f'<p class="dictionary-card-meaning">{esc(c.text(sign["meaning"], locale))}</p>'
            f'<p class="dictionary-card-context">{esc(caption)}</p>'
            f'<span class="dictionary-card-video">{esc(media_label)}</span>'
            '</a></li>')

    slug = request.params.get('slug')
    if slug is None:
        signs = c.signs()
        module_ids = {lesson['module'] for sign in signs if (lesson := c.lesson(sign['lesson']))}
        filters = []
        local_signs = [sign for sign in signs if sign.get('collection') == 'local-videos']
        if local_signs:
            filters.append('<button type="button" class="sh-chip" data-module-filter="local" aria-pressed="false">'
                           + esc(t['dictionary.collection.filter']) + '</button>')
        for module in c.modules():
            label = t['dictionary.filter.module'].replace('{n}', str(module['id'])).replace('{title}', c.text(module['title'], locale))
            disabled = '' if module['id'] in module_ids else ' disabled'
            filters.append(
                f'<button type="button" class="sh-chip" data-module-filter="{esc(module["id"])}" aria-pressed="false"{disabled}>'
                f'{esc(label)}</button>')
        return {
            'dictionary.cards.html': ''.join(card(sign) for sign in signs),
            'dictionary.filters.html': ''.join(filters),
            'dictionary.result_count': t['dictionary.results'].replace('{n}', str(len(signs))),
            'dictionary.empty_hidden.html': ' hidden' if signs else '',
            'dictionary.collection_summary.html': (
                '<p class="dictionary-collection-summary">'
                + esc(t['dictionary.collection.summary'].replace('{n}', str(len(local_signs)))) + '</p>'
                if local_signs else ''),
        }
    sign = c.sign(slug)
    if not sign:
        raise request.NotFound()
    lesson = c.lesson(sign['lesson'])
    local = sign.get('collection') == 'local-videos' and sign['lesson'] is None
    if (not lesson and not local) or (lesson and not c.is_open(lesson)):
        raise request.NotFound()
    module = c.module(lesson['module']) if lesson else None
    source = video_source(sign)
    video = (
        f'<video src="{esc(source)}" controls preload="metadata" playsinline muted '
        f'aria-label="{esc(t["dictionary.video.label"].replace("{word}", c.text(sign["word"], locale)))}"></video>'
        if source else '')
    video += ('<div class="sh-video-placeholder" data-video-missing' + (' hidden' if source else '') + '>'
              + f'<span>{esc(t["shell.video.missing"])}</span></div>')
    if local:
        video += '<p class="dictionary-video-notice">' + esc(t['dictionary.collection.notice']) + '</p>'
        lesson_link = esc(t['dictionary.collection.unassigned'])
    else:
        lesson_caption = t['dictionary.detail.lesson'].replace('{n}', str(lesson['id'])).replace('{title}', c.text(lesson['title'], locale))
        lesson_link = f'<a href="{esc(request.url("/app/lessons/" + str(lesson["id"])))}">{esc(lesson_caption)}</a>'
    variants = [c.text(value, locale) if isinstance(value, dict) else str(value)
                for value in sign.get('variants', [])]
    variants = [value for value in variants if value.strip()]
    variants_html = ('<ul>' + ''.join(f'<li>{esc(value)}</li>' for value in variants) + '</ul>'
                     if variants else f'<p>{esc(t["dictionary.variants.empty"])}</p>')
    related = ([other for other in c.signs() if other.get('collection') == 'local-videos' and other['slug'] != slug]
               if local else [other for other in c.signs(lesson['id']) if other['slug'] != slug])
    return {
        'dictionary.heading': c.text(sign['word'], locale),
        'dictionary.slug': slug,
        'dictionary.meaning': c.text(sign['meaning'], locale),
        'dictionary.sample.html': sample(sign),
        'dictionary.media.html': video,
        'dictionary.lesson.html': lesson_link,
        'dictionary.module_name': t['dictionary.collection.name'] if local else c.text(module['title'], locale),
        'dictionary.module_caption': t['dictionary.collection.label'] if local else t['dictionary.module.label'],
        'dictionary.related_heading': t['dictionary.collection.related'] if local else t['dictionary.related.title'],
        'dictionary.variants.html': variants_html,
        'dictionary.practice_url': request.url('/app/practice/' + slug),
        'dictionary.back_url': request.url('/app/dictionary'),
        'dictionary.related.html': ('<ul class="dictionary-grid dictionary-related-grid">' + ''.join(card(other) for other in related) + '</ul>'
                                    if related else f'<p class="dictionary-related-empty">{esc(t["dictionary.related.empty"])}</p>'),
    }
