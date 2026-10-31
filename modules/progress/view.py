"""Read-only server frame; private progress is filled by the browser store."""


def context(request):
    c, t, esc = request.content, request.t, request.esc
    modules = []
    for module in c.modules():
        lessons = [lesson for lesson in c.lessons(module['id']) if c.is_open(lesson)]
        ids = ','.join(str(lesson['id']) for lesson in lessons)
        badge = (f'<span class="sh-badge sh-badge--planned">{esc(t["shell.badge.planned"])}</span>'
                 if not lessons else '')
        label = t['progress.module.label'].replace('{n}', str(module['id']))
        modules.append(
            f'<li data-lessons="{esc(ids)}">'
            f'<div class="progress-module-head"><div><p class="progress-note">{esc(label)}</p>'
            f'<h3>{esc(c.text(module["title"], request.locale))}</h3></div>{badge}</div>'
            f'<p class="progress-module-count" data-module-count>{esc(t["progress.unknown"] if lessons else t["progress.modules.none"])}</p>'
            '<div class="sh-progress" aria-hidden="true"><span data-module-bar></span></div></li>')

    values = {'progress.modules.html': ''.join(modules),
              'progress.sample.signs': ','.join(sign['slug'] for sign in c.signs() if sign['status'] == 'sample'),
              'progress.sample.lessons': ','.join(str(lesson['id']) for lesson in c.open_lessons() if lesson['status'] == 'sample')}
    for section in ('calendar', 'practice', 'quiz', 'seen'):
        values[f'progress.empty.{section}.html'] = (
            '<div class="sh-empty"><img src="/static/assets/mascot.png" width="96" height="83" alt="">'
            f'<p>{esc(t[f"progress.empty.{section}"])}</p>'
            f'<a class="sh-chip" href="{esc(request.url("/app/courses"))}">{esc(t["progress.courses"])}</a></div>')
    return values
