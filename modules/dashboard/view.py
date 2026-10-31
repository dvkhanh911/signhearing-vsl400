"""Render dashboard content without requiring browser progress or JavaScript."""


def context(request):
    t, esc, c, locale = request.t, request.esc, request.content, request.locale
    opened = c.open_lessons()
    first = opened[0] if opened else None
    module = c.module(first['module']) if first else None
    title = (t['dashboard.lesson.title'].replace('{n}', str(first['id']))
             .replace('{title}', c.text(first['title'], locale, t['dashboard.lesson.untitled']))) if first else t['dashboard.empty.title']
    action = t['dashboard.action.start'].replace('{n}', str(first['id'])) if first else t['dashboard.shortcut.courses']
    target = '/app/lessons/' + str(first['id']) if first else '/app/courses'
    sample = first and first['status'] == 'sample'

    resume = (
        '<section class="sh-card dashboard-resume" aria-labelledby="dashboard-resume-title">'
        f'<h2 id="dashboard-resume-title">{esc(t["dashboard.resume.title"])}</h2>'
        '<div class="dashboard-badges">'
        f'<span class="sh-badge" data-resume-state hidden></span>'
        f'<span class="sh-badge sh-badge--sample" data-resume-sample{("" if sample else " hidden")}>{esc(t["shell.badge.sample"])}</span></div>'
        f'<p class="dashboard-module" data-resume-module>{esc(c.text(module["title"], locale) if module else "")}</p>'
        f'<h3 data-resume-title>{esc(title)}</h3>'
        f'<p class="dashboard-note" data-resume-note>{esc(t["dashboard.resume.note"] if first else t["dashboard.empty.note"])}</p>'
        '<div class="dashboard-resume-progress" data-resume-progress hidden>'
        '<p data-resume-count role="status"></p>'
        '<div class="sh-progress" aria-hidden="true"><span data-resume-bar></span></div></div>'
        f'<a class="button" data-resume-link href="{esc(request.url(target))}">{esc(action)}</a>'
        '</section>'
    )

    shortcuts = []
    for name, icon in (('courses', 'map'), ('dictionary', 'search'), ('practice', 'camera'), ('review', 'cards')):
        shortcuts.append(
            f'<a class="sh-card dashboard-shortcut" href="{esc(request.url("/app/" + name))}">'
            f'<span class="dashboard-shortcut-icon">{request.icon(icon)}</span>'
            f'<h3>{esc(t["dashboard.shortcut." + name])}</h3>'
            f'<p>{esc(t["dashboard.shortcut." + name + ".note"])}</p>'
            '<span class="dashboard-arrow" aria-hidden="true">↗</span></a>'
        )

    return {
        'dashboard.sample.lessons': ','.join(str(l['id']) for l in opened if l['status'] == 'sample'),
        'dashboard.sample.signs': ','.join(s['slug'] for s in c.signs() if s['status'] == 'sample'),
        'dashboard.resume.html': resume,
        'dashboard.shortcuts.html': ''.join(shortcuts),
    }
