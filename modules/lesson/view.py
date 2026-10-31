"""Render every open sign; JavaScript adds navigation and learner progress."""

from urllib.parse import urlsplit


def context(request):
    c = request.content
    lesson = c.lesson(request.params['id'])
    if not lesson or not c.is_open(lesson):
        raise request.NotFound()  # planned / unknown lessons -> 404, never an empty lesson page
    t, esc, locale = request.t, request.esc, request.locale
    signs = c.signs(lesson['id'])
    title = t['lesson.number'].replace('{n}', str(lesson['id'])) + ' · ' + c.text(lesson['title'], locale)
    module = c.module(lesson['module'])

    def sample(item):
        return (f'<span class="sh-badge sh-badge--sample">{esc(t["shell.badge.sample"])}</span>'
                if item['status'] == 'sample' else '')

    rows, articles = [], []
    observation_keys = ('handshape', 'location', 'orientation', 'movement', 'expression')
    for index, sign in enumerate(signs, 1):
        slug = sign['slug']
        word = c.text(sign['word'], locale)
        rows.append(
            f'<li><a href="#sign-{esc(slug)}" data-sign-link="{esc(slug)}">'
            f'<span class="lesson-sign-number" aria-hidden="true">{esc(str(index).zfill(2))}</span>'
            f'<span class="lesson-sign-word">{esc(word)}</span>'
            '<span class="lesson-seen-indicator"><span data-seen-symbol aria-hidden="true"></span>'
            '<span class="sh-sr-only" data-seen-label></span></span></a></li>')

        # Accept only site-relative media paths, never an external origin.
        source = sign.get('video')
        if not (isinstance(source, str) and source.startswith('/')
                and not source.startswith('//') and '\\' not in source
                and not urlsplit(source).netloc and not urlsplit(source).scheme):
            source = None
        video = ''
        if source:
            rates = ''.join(
                f'<button type="button" class="sh-chip" data-rate="{esc(rate)}" '
                f'aria-pressed="{esc(str(rate == "1").lower())}">{esc(t[key])}</button>'
                for rate, key in (('0.5', 'lesson.video.half'), ('0.75', 'lesson.video.three_quarters'), ('1', 'lesson.video.normal')))
            video = (
                f'<video src="{esc(source)}" preload="metadata" playsinline muted controls '
                f'aria-label="{esc(t["lesson.video.label"].replace("{word}", word))}"></video>'
                f'<div class="lesson-video-controls" data-video-controls hidden role="group" aria-label="{esc(t["lesson.video.controls"])}">'
                f'<button type="button" class="sh-chip" data-play aria-pressed="false">{esc(t["lesson.video.play"])}</button>'
                f'<div class="lesson-rates" role="group" aria-label="{esc(t["lesson.video.speed"])}">{rates}</div>'
                f'<button type="button" class="sh-chip" data-loop aria-pressed="false">{esc(t["lesson.video.loop"])}</button>'
                f'<button type="button" class="sh-chip" data-mirror aria-pressed="false">{esc(t["lesson.video.mirror"])}</button></div>')
        placeholder = (
            '<div class="sh-video-placeholder lesson-video-missing" data-video-missing'
            + (' hidden' if source else '') + '>'
            + f'<span>{esc(t["shell.video.missing"])}</span></div>')
        observations = ''.join(
            f'<li><span class="lesson-observe-number" aria-hidden="true">{esc(n)}</span>'
            f'<span>{esc(t["lesson.observe." + key])}</span></li>'
            for n, key in enumerate(observation_keys, 1))
        articles.append(
            f'<article class="sh-card lesson-sign" id="sign-{esc(slug)}" data-slug="{esc(slug)}" '
            f'aria-labelledby="sign-title-{esc(slug)}">'
            '<header class="lesson-sign-head"><div>'
            f'<p class="sh-eyebrow">{esc(t["lesson.position"].replace("{n}", str(index)).replace("{total}", str(len(signs))))}</p>'
            f'<h2 id="sign-title-{esc(slug)}" tabindex="-1">{esc(word)}</h2></div>{sample(sign)}'
            f'<button type="button" class="sh-chip lesson-favorite" data-favorite aria-pressed="false" hidden>{esc(t["lesson.favorite.add"])}</button></header>'
            f'<p class="lesson-meaning">{esc(c.text(sign["meaning"], locale))}</p>'
            f'<div class="lesson-media">{video}{placeholder}</div>'
            f'<section class="lesson-observe" aria-labelledby="observe-{esc(slug)}">'
            f'<h3 id="observe-{esc(slug)}">{esc(t["lesson.observe.title"])}</h3>'
            f'<p>{esc(t["lesson.observe.hint"])}</p><ul>{observations}</ul></section>'
            '<div class="lesson-sign-actions">'
            f'<button type="button" class="button" data-mark-seen aria-pressed="false" hidden>{esc(t["lesson.seen.action"])}</button>'
            f'<a class="button button-outline" href="{esc(request.url("/app/practice/" + slug))}">{esc(t["lesson.practice"])}</a>'
            f'<a class="lesson-dictionary-link" href="{esc(request.url("/app/signs/" + slug))}">{esc(t["lesson.dictionary"])}</a>'
            '</div></article>')
    quiz = (
        f'<a class="button button-outline lesson-quiz" data-quiz href="{esc(request.url("/app/review/quiz/" + str(lesson["id"])))}">'
        f'{esc(t["lesson.quiz"])}</a>' if len(signs) >= 2 else '')
    return {
        'lesson.heading': title,
        'lesson.id': str(lesson['id']),
        'lesson.module_label': t['lesson.module'].replace('{n}', str(module['id'])) + ' · ' + c.text(module['title'], locale),
        'lesson.sign_count': t['lesson.signs'].replace('{n}', str(len(signs))),
        'lesson.sample.html': sample(lesson),
        'lesson.list.html': ''.join(rows),
        'lesson.articles.html': ''.join(articles) if signs else f'<p class="sh-card sh-empty">{esc(t["lesson.empty"])}</p>',
        'lesson.quiz.html': quiz,
        'lesson.courses_url': request.url('/app/courses'),
    }
