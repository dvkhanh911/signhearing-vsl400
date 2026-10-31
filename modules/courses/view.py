"""Server-side part of the 'courses' module (reference implementation for other modules).

context(request) returns extra template values. Rules (checked by app_modules.py):
- keys start with 'courses.'; keys ending in '.html' are inserted raw, so escape every value with request.esc
- raise request.NotFound for unknown URL params (this page has none)
"""


def context(request):
    t, esc, c, locale = request.t, request.esc, request.content, request.locale
    all_lessons = c.lessons()
    open_count = len([l for l in all_lessons if c.is_open(l)])

    summary = (
        '<div class="sh-card courses-summary">'
        f'<div><p class="courses-summary-label">{esc(t["courses.summary.title"])}</p>'
        f'<p class="courses-summary-value">{esc(t["courses.summary.open"].replace("{open}", str(open_count)).replace("{total}", str(len(all_lessons))))}</p></div>'
        f'<div class="courses-summary-progress"><p><span data-overall-label>{esc(t["courses.summary.js"])}</span></p>'
        '<div class="sh-progress" aria-hidden="true"><span data-overall-bar></span></div></div>'
        '</div>'
    )

    items = []
    for m in c.modules():
        lessons = c.lessons(m['id'])
        rows = []
        for l in lessons:
            title = esc(c.text(l['title'], locale, t['courses.lesson.untitled']))
            number = esc(t['courses.lesson.label'] + ' ' + str(l['id']))
            sign_count = esc(t['courses.signs'].replace('{n}', str(len(c.signs(l['id'])))))
            if c.is_open(l):
                badge = f'<span class="sh-badge sh-badge--sample">{esc(t["shell.badge.sample"])}</span>' if l['status'] == 'sample' else ''
                rows.append(
                    f'<li class="courses-lesson is-open" data-lesson-id="{l["id"]}">'
                    f'<a href="{esc(request.url("/app/lessons/" + str(l["id"])))}">'
                    f'<span class="courses-lesson-num">{number}</span>'
                    f'<span class="courses-lesson-title">{title}</span>{badge}'
                    f'<span class="courses-lesson-meta">{sign_count}</span>'
                    f'<span class="sh-badge courses-state" data-state>{esc(t["shell.state.not_started"])}</span>'
                    '<span class="courses-arrow" aria-hidden="true">→</span></a></li>')
            else:
                rows.append(
                    f'<li class="courses-lesson is-planned">'
                    f'<span class="courses-lesson-num">{number}</span>'
                    f'<span class="courses-lesson-title">{title}</span>'
                    f'<span class="sh-badge sh-badge--planned">{esc(t["shell.badge.planned"])}</span></li>')
        opened = len([l for l in lessons if c.is_open(l)])
        progress = (f'<span class="courses-module-progress" data-module-progress data-open="{opened}">'
                    f'{esc(t["courses.module.none"]) if opened == 0 else ""}</span>')
        items.append(
            f'<li class="sh-card courses-module" data-module-id="{m["id"]}" data-open="{opened}">'
            f'<div class="courses-module-head"><span class="courses-module-num">{m["id"]:02d}</span>'
            f'<div><p class="courses-module-label">{esc(t["courses.module.label"] + " " + str(m["id"]))}</p>'
            f'<h2>{esc(c.text(m["title"], locale))}</h2></div>{progress}</div>'
            f'<ol class="courses-lessons">{"".join(rows)}</ol></li>')

    return {'courses.summary.html': summary, 'courses.list.html': ''.join(items)}
