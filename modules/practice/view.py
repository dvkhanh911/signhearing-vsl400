"""Render practice choices and private mirror sessions using the shared content API."""

from urllib.parse import urlsplit


def context(request):
    c, t, esc, locale = request.content, request.t, request.esc, request.locale

    def badge(item):
        return ('<span class="sh-badge sh-badge--sample">' + esc(t['shell.badge.sample']) + '</span>'
                if item['status'] == 'sample' else '')

    def cards(signs):
        return ''.join(
            f'<li class="practice-choice" data-slug="{esc(sign["slug"])}">'
            f'<a class="sh-card practice-choice-link" href="{esc(request.url("/app/practice/" + sign["slug"]))}">'
            f'<span class="practice-choice-top"><strong>{esc(c.text(sign["word"], locale))}</strong>{badge(sign)}</span>'
            f'<span class="practice-choice-meaning">{esc(c.text(sign["meaning"], locale))}</span>'
            '<span class="practice-choice-count" data-practice-count hidden></span></a></li>'
            for sign in signs)

    slug = request.params.get('slug')
    if slug is None:
        groups = []
        for lesson in c.open_lessons():
            signs = c.signs(lesson['id'])
            if not signs:
                continue
            title = t['practice.lesson'].replace('{n}', str(lesson['id'])).replace('{title}', c.text(lesson['title'], locale))
            groups.append(
                f'<section class="practice-group" data-practice-group aria-labelledby="practice-lesson-{esc(lesson["id"])}">'
                f'<h2 id="practice-lesson-{esc(lesson["id"])}">{esc(title)}</h2>'
                f'<ul class="practice-choices">{cards(signs)}</ul></section>')
        local = [sign for sign in c.signs() if sign.get('collection') == 'local-videos' and sign['lesson'] is None]
        if local:
            groups.insert(0,
                '<section class="practice-group" data-practice-group aria-labelledby="practice-local-title">'
                f'<h2 id="practice-local-title">{esc(t["practice.collection.title"])}</h2>'
                f'<p class="practice-group-note">{esc(t["practice.collection.notice"])}</p>'
                f'<ul class="practice-choices">{cards(local)}</ul></section>')
        return {
            'practice.groups.html': ''.join(groups) if groups else f'<p class="sh-card sh-empty">{esc(t["practice.empty.content"])}</p>',
            'practice.courses_url': request.url('/app/courses'),
        }
    sign = c.sign(slug)
    if not sign:
        raise request.NotFound()
    lesson = c.lesson(sign['lesson'])
    local = sign.get('collection') == 'local-videos' and sign['lesson'] is None
    if (not lesson and not local) or (lesson and not c.is_open(lesson)):
        raise request.NotFound()
    word = c.text(sign['word'], locale)
    source = sign.get('video')
    if not (isinstance(source, str) and source.startswith('/') and not source.startswith('//')
            and '\\' not in source and not urlsplit(source).netloc and not urlsplit(source).scheme):
        source = None
    media = (f'<video data-reference src="{esc(source)}" controls muted playsinline preload="metadata" '
             f'aria-label="{esc(t["practice.video.label"].replace("{word}", word))}"></video>' if source else '')
    media += ('<div class="sh-video-placeholder" data-reference-missing' + (' hidden' if source else '') + '>'
              + esc(t['shell.video.missing']) + '</div>')
    controls = ''
    if source:
        rates = ''.join(f'<button class="sh-chip" type="button" data-rate="{esc(rate)}" aria-pressed="{esc(str(rate == "1").lower())}">{esc(t[key])}</button>'
                        for rate, key in (('0.5', 'practice.video.half'), ('0.75', 'practice.video.three_quarters'), ('1', 'practice.video.normal')))
        controls = (f'<div class="practice-video-controls" data-video-controls hidden>'
                    f'<div class="practice-rates" role="group" aria-label="{esc(t["practice.video.speed"])}">{rates}</div>'
                    f'<button class="sh-chip" type="button" data-loop aria-pressed="false">{esc(t["practice.video.loop"])}</button></div>')
    observation_keys = ('handshape', 'location', 'orientation', 'movement', 'expression')
    checklist = ''.join(
        f'<label class="practice-check" for="practice-{esc(key)}"><input id="practice-{esc(key)}" '
        f'type="checkbox" data-check="{esc(key)}"><span>{esc(t["practice.check." + key])}</span></label>'
        for key in observation_keys)
    siblings = ([other for other in c.signs() if other.get('collection') == 'local-videos' and other['lesson'] is None]
                if local else c.signs(lesson['id']))
    index = next(i for i, other in enumerate(siblings) if other['slug'] == slug)
    next_link = (f'<a class="button button-outline" data-next-sign href="{esc(request.url("/app/practice/" + siblings[index + 1]["slug"]))}">{esc(t["practice.next"])}</a>'
                 if index + 1 < len(siblings) else '')
    parent_link = (f'<a href="{esc(request.url("/app/lessons/" + str(lesson["id"])))}">{esc(t["practice.back.lesson"])}</a>'
                   if lesson else f'<span class="practice-collection-note">{esc(t["practice.collection.unassigned"])}</span>')
    return {
        'practice.heading': t['practice.session.title'] + ' · ' + word,
        'practice.word': word,
        'practice.slug': slug,
        'practice.meaning': c.text(sign['meaning'], locale),
        'practice.sample.html': badge(sign),
        'practice.reference.html': media,
        'practice.video_controls.html': controls,
        'practice.checklist.html': checklist,
        'practice.next.html': next_link,
        'practice.parent.html': parent_link,
        'practice.back_url': request.url('/app/practice'),
        'practice.collection_notice.html': ('<p class="practice-source-note">' + esc(t['practice.collection.notice']) + '</p>') if local else '',
    }
