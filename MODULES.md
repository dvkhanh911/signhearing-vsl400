# Khu học tập SignHearing — chia module để làm song song

Phạm vi đợt này: **web trên laptop trước** (thiết kế ở 1280–1440 px), **chưa có AI**. Khi bấm **Khám phá SignHearing** ở trang chủ, người học vào `/app` — khu học tập có sidebar cố định và 8 module.

Mỗi module nằm trong **một thư mục riêng** `modules/<id>/`. Server tự tìm module, tự gắn route, menu, chuỗi VI/EN, CSS và JS của module đó. Vì vậy mỗi người chỉ sửa trong thư mục của mình, và không ai phải đụng vào file chung.

## 1. Bản đồ module

| # | Module (`id`) | Route | Nội dung chính | Độ khó | Phụ thuộc |
|---|---|---|---|---|---|
| 0 | **Shell** (`app_shell/` + `app_modules.py`, `content.py`) | — | Sidebar, topbar, breadcrumb, VI/EN, UI kit `sh-*`, `SH.store` | — | **Đã xong** |
| 1 | `courses` | `/app/courses` | Lộ trình 8 học phần / 18 bài | vừa | **Đã xong**, là module mẫu |
| 2 | `dashboard` | `/app` | Tiếp tục học, số liệu thật, lối tắt | dễ–vừa | shell |
| 3 | `lesson` | `/app/lessons/{id}` | Học từng ký hiệu, video, checklist quan sát | vừa–khó | shell |
| 4 | `dictionary` | `/app/dictionary`, `/app/signs/{slug}` | Tìm không dấu, lọc, chi tiết ký hiệu | vừa | shell |
| 5 | `practice` | `/app/practice`, `/app/practice/{slug}` | Video mẫu + gương camera + tự đánh giá (không AI) | khó | shell |
| 6 | `review` | `/app/review`, `/app/review/quiz/{id}` | Flashcard, quiz; **đặt bài “Hoàn thành” khi ≥ 80%** | vừa | shell |
| 7 | `progress` | `/app/progress` | Thống kê, lịch sử luyện/kiểm tra | dễ–vừa | shell |
| 8 | `settings` | `/app/settings` | Ngôn ngữ, xuất/xóa dữ liệu, camera | dễ | shell |
| — | **Nội dung** | `data/curriculum.json` | Nhập tên bài 3–18 và danh sách từ của giáo trình VSL 400 | không cần code | — |

Module 2–8 **chỉ phụ thuộc shell**, nên làm song song được ngay. Các module nối với nhau bằng **đường dẫn** (ví dụ `lesson` có link sang `/app/practice/{slug}`) và bằng **`SH.store`**, không gọi code của nhau. Module nào chưa làm xong vẫn hiện trang “đang xây dựng” đúng route, nên link không bao giờ gãy.

Đặc tả chi tiết của từng module (chức năng P0/P1, dữ liệu dùng, tiêu chí xong) nằm ở `modules/<id>/README.md`.

### Gợi ý phân công cho 6 người

| Người | Phần việc |
|---|---|
| A — lead | Giữ shell, duyệt PR, làm `settings` |
| B | `lesson` |
| C | `practice` |
| D | `dictionary` |
| E | `review` |
| F | `dashboard` + `progress` (cùng loại số liệu) |
| Thành viên không code (có thể kiêm) | Điền `data/curriculum.json` theo giáo trình |

Điền tên vào `"owner"` trong `modules/<id>/module.json`; tên sẽ hiện trên trang “đang xây dựng”. Khi xong, đổi `"status": "done"` để tắt chấm hồng trên menu.

## 2. Năm quy tắc để không ảnh hưởng nhau

1. **Chỉ sửa trong `modules/<id>/`.** Các file `app_shell/*`, `app_modules.py`, `content.py`, `serve.py`, `i18n.py` và `locales/*.json` thuộc lead. Cần đổi gì chung thì nhắn lead, không tự sửa.
2. **Key chuỗi phải bắt đầu bằng `<id>.`**, đặt trong `modules/<id>/locales/vi.json` và `en.json`. Hai file phải có cùng bộ key. Server sẽ báo lỗi ngay khi khởi động nếu key sai tiền tố, trùng key, hoặc thiếu bản dịch. Được *đọc* key `shell.*`, nhưng không đọc key của module khác.
3. **CSS phải bắt đầu bằng `.m-<id>`.** Trang của bạn có `<body class="app-page m-<id>">`. `verify.py` sẽ kiểm tra quy tắc này. Được dùng các class `sh-*` của shell.
4. **JS bọc trong IIFE, không tạo biến toàn cục**, và chỉ dùng `window.SH`. Không đọc/ghi `localStorage` trực tiếp, để sau này đổi sang backend chỉ phải sửa `core.js`.
5. **Không có số liệu hay nội dung giả.** Video chưa có thì dùng `.sh-video-placeholder`. Không viết cách làm ký hiệu khi chưa có chuyên gia duyệt. Không nói có “AI”.

## 3. Cấu trúc một module

```text
modules/<id>/
  module.json        id, owner, status, nav (menu), routes
  page.html          template; có thể có thêm trang khác (detail.html, quiz.html…)
  view.py            (tùy chọn) dựng phần động phía server, kiểm tra tham số URL
  style.css          (tùy chọn) mọi selector bắt đầu .m-<id>
  script.js          (tùy chọn) dùng window.SH
  locales/vi.json    key <id>.*
  locales/en.json
  assets/            (tùy chọn) ảnh png/svg/webp → /static/m/<id>/assets/…
  README.md          đặc tả của module
```

`module.json`:

```json
{
  "id": "lesson",
  "owner": "Tên người phụ trách",
  "status": "todo | in-progress | done",
  "nav": {"order": 3, "icon": "search", "label_key": "lesson.nav"},
  "nav_parent": "courses",
  "routes": [
    {"path": "/app/lessons/{id}", "page": "page.html", "title_key": "lesson.title"}
  ]
}
```

- `nav`: bỏ đi nếu module không có mục menu riêng (ví dụ `lesson`). `nav_parent` là mục menu được tô sáng khi đang ở trang này.
- Icon có sẵn: `home, map, search, camera, cards, chart, settings, book`.
- Tham số `{id}`/`{slug}` chỉ nhận `a-z 0-9 -`.

`view.py` (xem mẫu ở `modules/courses/view.py`):

```python
def context(request):
    # request.locale, request.params, request.t (mọi chuỗi), request.content (dữ liệu),
    # request.url(path) thêm ?lang=, request.esc(text) escape HTML, request.NotFound
    lesson = request.content.lesson(request.params['id'])
    if not lesson or not request.content.is_open(lesson):
        raise request.NotFound()            # → trang 404 VI/EN
    return {
        'lesson.heading': '...',            # text thường, tự escape
        'lesson.list.html': '<li>…</li>',   # key kết thúc .html được chèn nguyên → phải esc từng giá trị
        'page.title': '...',                # (tùy chọn) đổi <title> và breadcrumb
    }
```

## 4. Hợp đồng dùng chung

### Dữ liệu — `content.py` (server) và `SH.data` (browser)

| Server (`request.content`) | Browser | Ghi chú |
|---|---|---|
| `modules()`, `module(id)` | `SH.data.modules` | 8 học phần |
| `lessons(module_id=None)`, `lesson(id)`, `is_open(item)` | `SH.data.lessons`, `SH.lesson(id)` | bài `planned` không mở → 404 |
| `signs(lesson_id=None)`, `sign(slug)` | `SH.data.signs`, `SH.sign(slug)`, `SH.signsOf(id)` | chỉ nội dung đang mở |
| `text(field, locale, fallback)` | (đã dịch sẵn) | |
| `normalize(text)` | `SH.normalize(text)` | “Cảm ơn” → “cam on” |

Sign: `slug, word, meaning, lesson, video (null = chưa có), status`. Trạng thái nội dung: `planned → draft → sample → published`. `sample` chỉ hiện khi `site-config.json` có `"show_sample_content": true` (bật sẵn để dựng giao diện; tắt khi demo thật).

### Tiến độ — `SH.store` (lưu trong trình duyệt, khóa `signhearing:v1`)

| Hàm | Ai gọi |
|---|---|
| `lessonState(id)` → `not_started / in_progress / completed` | mọi module |
| `setLessonState(id, state)` | `lesson` (in_progress), `review` (completed khi quiz ≥ 80%) |
| `markSignSeen(slug)`, `isSignSeen(slug)` | `lesson` / mọi module |
| `addQuizResult(id, score, total)`, `quizResults(id)` | `review` / `progress` |
| `addPractice(slug, checklist)`, `practiceLog()` | `practice` / `dashboard`, `progress` |
| `toggleFavorite(slug)`, `isFavorite(slug)`, `favorites()` | `lesson`, `dictionary` / … |
| `summary()`, `export()`, `reset()` | `dashboard`, `progress`, `settings` |

Mỗi lần ghi, store phát sự kiện `window` `'sh:store'`. Module nào cần cập nhật giao diện thì nghe sự kiện này. Chuỗi cho JS: `SH.t('<id>.key', {n: 3})`; link nội bộ: `SH.url('/app/…')`.

### UI kit của shell (dùng được trong mọi module)

`sh-page-head`, `sh-eyebrow`, `sh-lead`, `sh-card`, `sh-grid`, `sh-badge` (`--sample --planned --progress --done`), `sh-progress > span`, `sh-chip[aria-pressed]`, `sh-empty`, `sh-video-placeholder`, `sh-sr-only`, `button`, `button button-outline`. Biến màu: `--navy --blue --pink --line --text --muted`.

## 5. Quy trình Git

1. Lead merge nhánh khung (`app_shell`, registry, `courses`, các module trống) vào nhánh chính trước.
2. Mỗi người tạo nhánh `feature/m-<id>` từ nhánh chính.
3. PR chỉ được chứa thay đổi trong `modules/<id>/`. Lead xem nhanh bằng `git diff --stat`. Nếu thấy file ngoài thư mục đó, tách ra một PR riêng cho lead.
4. Trước khi mở PR: `python verify.py` (đang chạy `python serve.py`) phải đạt, và đã xem trang ở 1440 px và 1280 px.

## 6. Chạy và kiểm tra

```powershell
python serve.py                 # http://127.0.0.1:8000/app
python verify.py                # chạy ở cửa sổ khác khi server đang mở
```

Thử tiến độ nhanh trong DevTools Console: `SH.store.setLessonState(1,'completed')`, `SH.store.summary()`, `SH.store.reset()`.

## 7. Thêm một module mới về sau

Copy một thư mục module trống (ví dụ `modules/settings/`), đổi tên thư mục và `id`, đổi tiền tố key, rồi khởi động lại server. Không cần sửa file nào khác.
