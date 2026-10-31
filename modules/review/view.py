"""Render review choices and quiz reading content; validate every quiz lesson."""


def context(request):
    c, t, esc, locale = request.content, request.t, request.esc, request.locale
    sample_slugs = ','.join(sign['slug'] for sign in c.signs() if sign['status'] == 'sample')

    def sample(item):
        return ('<span class="sh-badge sh-badge--sample">' + esc(t['shell.badge.sample']) + '</span>'
                if item['status'] == 'sample' else '')

    def lesson_title(lesson):
        return t['review.lesson.heading'].replace('{n}', str(lesson['id'])).replace('{title}', c.text(lesson['title'], locale))

    lesson_id = request.params.get('id')
    if lesson_id is None:
        lessons, options = [], []
        for lesson in c.open_lessons():
            signs = c.signs(lesson['id'])
            if signs:
                options.append(f'<option value="{esc(lesson["id"])}">{esc(lesson_title(lesson))}</option>')
            if len(signs) < 2:
                continue
            lessons.append(
                f'<li class="sh-card review-lesson" data-lesson-id="{esc(lesson["id"])}">'
                f'<div class="review-lesson-heading"><h3>{esc(lesson_title(lesson))}</h3>{sample(lesson)}</div>'
                f'<p>{esc(t["review.signs"].replace("{n}", str(len(signs))))}</p>'
                '<p class="review-best" data-best hidden></p>'
                f'<a class="button button-outline" href="{esc(request.url("/app/review/quiz/" + str(lesson["id"])))}">{esc(t["review.quiz.start"])}</a></li>')
        return {
            'review.lessons.html': ''.join(lessons) if lessons else '<li class="sh-card sh-empty">' + esc(t['review.lessons.empty']) + '</li>',
            'review.lesson_options.html': ''.join(options),
            'review.lesson_disabled.html': '' if options else ' disabled',
            'review.sample_slugs': sample_slugs,
            'review.courses_url': request.url('/app/courses'),
        }
    lesson = c.lesson(lesson_id)
    if not lesson or not c.is_open(lesson) or len(c.signs(lesson['id'])) < 2:
        raise request.NotFound()
    signs = c.signs(lesson['id'])
    reading = ''.join(
        f'<li><h3>{esc(c.text(sign["word"], locale))}</h3>{sample(sign)}'
        f'<p>{esc(c.text(sign["meaning"], locale))}</p></li>' for sign in signs)
    return {
        'review.heading': t['review.quiz.title'] + ' · ' + t['review.quiz.lesson'].replace('{n}', str(lesson['id'])),
        'review.lesson_title': c.text(lesson['title'], locale),
        'review.lesson_id': str(lesson['id']),
        'review.sample.html': sample(lesson),
        'review.sample_slugs': sample_slugs,
        'review.reading.html': reading,
        'review.lesson_url': request.url('/app/lessons/' + str(lesson['id'])),
        'review.courses_url': request.url('/app/courses'),
        'review.back_url': request.url('/app/review'),
    }
