# Prompt để hoàn thiện từng module bằng AI

Các prompt này dùng với công cụ AI **đọc được repo**, ví dụ Claude Code, Cursor hoặc Copilot agent. Mở đúng thư mục `signhearing-vsl400` rồi dán **nguyên một khối prompt** của module mình phụ trách.

Nếu dùng chatbot thường (không đọc được file), dán kèm nội dung các file được nhắc trong prompt: `docs/MODULES.md`, `modules/<id>/README.md`, `app_shell/core.js`, `app_shell/shell.css` và toàn bộ `modules/courses/`.

Thứ tự gợi ý: Nội dung (K) làm song song với các module. Sau khi xong mỗi module, lead dùng prompt Duyệt (L). Cuối cùng chạy prompt Kiểm thử tổng (M).

---

## Luật chung (mọi prompt đều yêu cầu AI đọc phần này)

1. **Chỉ tạo hoặc sửa file trong `modules/<id>/`.** Không sửa `app_shell/`, `app_modules.py`, `content.py`, `serve.py`, `i18n.py`, `locales/`, `static/`, `data/`, `verify.py`. Nếu bắt buộc phải đổi file chung thì dừng lại, ghi rõ cần đổi gì và vì sao, không tự sửa.
2. **Công nghệ:** Python stdlib + HTML/CSS/JS thuần. Không thêm thư viện, framework, CDN, font hay ảnh bên ngoài.
3. **Template:** dùng `{{key}}`. Key do `view.py` trả về phải bắt đầu bằng `<id>.`. Key kết thúc bằng `.html` được chèn nguyên văn, nên **mọi giá trị bên trong phải qua `request.esc()`**. Tham số URL sai hoặc bài chưa mở thì `raise request.NotFound()`.
4. **Chữ trên giao diện:** không viết cứng trong HTML/JS/Python. Thêm key `<id>.*` vào cả `locales/vi.json` và `locales/en.json`, hai file phải có cùng bộ key. Trong JS dùng `SH.t('<id>.key', {n: 3})`. Được đọc key `shell.*`, không dùng key của module khác. Bản tiếng Anh không được lẫn tiếng Việt.
5. **CSS:** mọi selector trong `style.css` bắt đầu bằng `.m-<id>`. Ưu tiên dùng UI kit `sh-*` và các biến `--navy --blue --pink --line`. Ưu tiên laptop 1280–1440 px; dưới 1100 px chỉ cần không vỡ bố cục.
6. **JS:** bọc toàn bộ trong IIFE `(function(){'use strict'; ... })();`, không tạo biến toàn cục. Chỉ dùng `window.SH` (data, `t`, `url`, `normalize`, `lesson`, `sign`, `signsOf`, `store`). **Không dùng `localStorage`/`sessionStorage` trực tiếp.** Nghe sự kiện `window` `'sh:store'` để cập nhật giao diện.
7. **CSP (bảo mật) đang bật:** không `<script>` inline, không `onclick=""`, không thuộc tính `style=""` trong HTML (đặt style bằng class, hoặc qua `element.style` trong JS), không dùng thẻ `<form>` (tìm kiếm và lọc làm bằng JS), không link ra ngoài. Chỉ được phép dùng ảnh và media từ chính site (`'self'` và `blob:`).
8. **Mỗi trang có đúng một `<h1>`.** Đã có trong template, giữ nguyên `id`. Mọi link nội bộ phải có `?lang=`: phía server dùng `request.url('/app/...')`, phía JS dùng `SH.url('/app/...')`. Link `#anchor` phải trỏ tới một `id` có thật trên trang.
9. **Trung thực:** không số liệu giả, không AI, không chữ “thành thạo”. `video` đang là `null`, nên hiện `.sh-video-placeholder` kèm `SH.t('shell.video.missing')`. Không tự viết cách làm ký hiệu khi chưa có chuyên gia VSL duyệt. Nội dung `status: "sample"` phải có nhãn `shell.badge.sample`.
10. **Không JS vẫn xem được nội dung chính** (server render). JS chỉ thêm tương tác và tiến độ.
11. **Truy cập được:** dùng `<button>` cho hành động và `<a>` cho điều hướng, có focus rõ, `aria-pressed`/`aria-live` khi cần, dùng được bằng bàn phím, không chỉ dùng màu để truyền tải thông tin. Tôn trọng `prefers-reduced-motion`.
12. **Khi xong:** chạy `python serve.py`, ở cửa sổ khác chạy `python verify.py`, phải PASS. Mở trang ở 1440 px và 1280 px với cả `?lang=vi` và `?lang=en`, thử cả trạng thái người mới (`SH.store.reset()` trong Console). Trong `module.json`, đặt `"status": "done"` và điền `"owner"`. Cuối cùng liệt kê các file đã đổi và những gì còn chưa làm.

---

## A. `dashboard` — Tổng quan (`/app`)

```text
Bạn là frontend developer cho dự án SignHearing (web học Ngôn ngữ Ký hiệu Việt Nam, Python stdlib + HTML/CSS/JS thuần, render phía server, VI/EN).
Nhiệm vụ: hoàn thiện module `dashboard` tại route `/app` — trang đầu tiên người học thấy sau khi bấm "Khám phá SignHearing".

TRƯỚC KHI CODE, đọc kỹ: docs/PROMPTS.md (mục "Luật chung" — bắt buộc tuân thủ), docs/MODULES.md, modules/dashboard/README.md (đặc tả), toàn bộ modules/courses/ (module mẫu đã hoàn chỉnh: module.json, page.html, view.py, script.js, style.css, locales), app_shell/core.js (API window.SH), app_shell/shell.css (UI kit sh-*), content.py, data/curriculum.json.
Chỉ sửa trong modules/dashboard/.

Yêu cầu:
1. page.html + view.py: server render khung trang: lời chào kèm mascot (/static/assets/mascot.png, width="1351" height="1164", alt=""), thẻ "Tiếp tục học", hàng 4 ô số liệu, khối lối tắt tới /app/courses, /app/dictionary, /app/practice, /app/review (dùng request.url, kèm icon bằng request.icon('map'|'search'|'camera'|'cards')). Khi không có JS: thẻ Tiếp tục học trỏ tới bài mở đầu tiên (content.open_lessons()), ô số liệu hiện "—".
2. script.js tính từ SH.store.summary():
   - "Tiếp tục học": nếu lastActivity.type==='lesson' và bài đó chưa completed → bài đó; nếu type==='sign' → bài chứa ký hiệu đó (SH.sign(slug).lesson) nếu chưa completed; nếu không → bài open đầu tiên chưa completed; nếu tất cả bài open đã completed → gợi ý sang Ôn tập. Hiện tên học phần, tên bài, trạng thái (shell.state.*), số ký hiệu đã xem / tổng ký hiệu của bài.
   - 4 ô: bài hoàn thành/bài đang mở (lessonsCompleted/lessonsOpen), ký hiệu đã xem, lượt tự luyện, lượt kiểm tra. Chỉ số thật, không lấy 18 bài hay 400 từ làm mẫu số.
   - Người mới (summary không có lastActivity): đổi lời chào + nút "Bắt đầu bài 1".
   - Cập nhật lại khi có sự kiện 'sh:store'.
3. P1 nếu còn thời gian: khối "Nên luyện lại" — tối đa 4 ký hiệu từ SH.store.practiceLog() có lượt gần nhất tick < 5 mục; link /app/practice/{slug}.
4. Bố cục laptop: hàng 1 = lời chào (trái 1fr) + thẻ Tiếp tục học (phải 1.2fr, nổi bật nền xanh nhạt, nút .button); hàng 2 = 4 ô (grid 4 cột); hàng 3 = lối tắt (4 thẻ). Dùng sh-card, sh-badge, sh-progress.
5. Locales vi/en đủ key dashboard.*; title giữ "Tổng quan"/"Overview". Xóa eyebrow "MODULE ĐANG XÂY DỰNG" và {{shell.stub.html}} khỏi page.html.
6. Kết thúc: chạy verify.py PASS, thử SH.store.setLessonState(1,'in_progress') / SH.store.reset() trong Console, đặt module.json status "done", liệt kê file đã đổi.
```

## B. `lesson` — Bài học (`/app/lessons/{id}`)

```text
Bạn là frontend developer cho dự án SignHearing (web học Ngôn ngữ Ký hiệu Việt Nam, Python stdlib + HTML/CSS/JS thuần, render phía server, VI/EN).
Nhiệm vụ: hoàn thiện module `lesson` tại route `/app/lessons/{id}` — trang học từng ký hiệu của một bài.

TRƯỚC KHI CODE, đọc kỹ: docs/PROMPTS.md (mục "Luật chung" — bắt buộc), docs/MODULES.md, modules/lesson/README.md, toàn bộ modules/courses/ (module mẫu), modules/lesson/view.py (đã kiểm tra id → 404), app_shell/core.js, app_shell/shell.css, content.py, data/curriculum.json.
Chỉ sửa trong modules/lesson/.

Yêu cầu:
1. view.py (giữ phần kiểm tra NotFound): render phía server
   - Đầu trang: nhãn học phần (content.module(lesson['module'])), h1 = lesson.heading (đã có), số ký hiệu, badge "Mẫu" nếu status sample, badge trạng thái (data-lesson-state, JS điền).
   - Bố cục 2 cột: <nav> danh sách ký hiệu bên trái (~280px, sticky), mỗi mục là <a href="#sign-{slug}"> kèm số thứ tự, từ, dấu đã xem (JS điền); bên phải là MỖI ký hiệu một <article id="sign-{slug}" data-slug="{slug}"> gồm: từ (h2), nghĩa, khối video (nếu sign['video'] là null → div.sh-video-placeholder với shell.video.missing; nếu có → <video src=... preload="metadata" playsinline muted> + thanh điều khiển), checklist quan sát 5 mục (hình dạng tay, vị trí, hướng lòng bàn tay, chuyển động, nét mặt) — chỉ là tiêu đề nhắc quan sát + 1 câu chung "Đối chiếu phần này với video mẫu", không mô tả cách làm cụ thể; link "Tự luyện" → /app/practice/{slug}, "Xem trong từ điển" → /app/signs/{slug}; nút "Đã xem" (button, ẩn khi không có JS).
   - Cuối trang: nút "Làm bài kiểm tra" → /app/review/quiz/{id} (chỉ hiện nếu bài có ≥ 2 ký hiệu) và link về /app/courses.
   Không JS: mọi article hiện lần lượt, anchor nhảy được.
2. script.js:
   - Khi mở trang: SH.store.setLessonState(id,'in_progress') (store tự không hạ completed).
   - Chế độ một ký hiệu mỗi lần: chỉ hiện article đang chọn; đồng bộ với location.hash; nút Trước/Sau; phím ← → (bỏ qua khi focus ở input); mục đang chọn có aria-current="true".
   - "Đã xem" → SH.store.markSignSeen(slug), tự chuyển sang ký hiệu sau; cập nhật dấu ✓ và đếm "x/y đã xem"; khi xem đủ → làm nổi bật nút Làm bài kiểm tra.
   - Điều khiển video (chỉ khi có <video>): phát/dừng, tốc độ 0.5×/0.75×/1× (chip aria-pressed), lặp, lật gương (class đổi transform: scaleX(-1)). Không bật âm thanh.
   - P1: nút yêu thích dùng SH.store.toggleFavorite / isFavorite.
   - Nghe 'sh:store' để cập nhật badge trạng thái bài.
3. Không tự đặt bài completed — việc đó do module review làm khi quiz ≥ 80%.
4. Locales vi/en đủ key lesson.* (giữ lesson.title, lesson.number). Bỏ eyebrow stub và {{shell.stub.html}}.
5. Kết thúc: verify.py PASS (verify sẽ kiểm tra cả anchor #sign-...), thử /app/lessons/1 và /app/lessons/2 ở vi/en, đặt status "done", liệt kê file đã đổi.
```

## C. `dictionary` — Từ điển (`/app/dictionary`, `/app/signs/{slug}`)

```text
Bạn là frontend developer cho dự án SignHearing (web học Ngôn ngữ Ký hiệu Việt Nam, Python stdlib + HTML/CSS/JS thuần, render phía server, VI/EN).
Nhiệm vụ: hoàn thiện module `dictionary`: trang tra cứu /app/dictionary và trang chi tiết /app/signs/{slug}.

TRƯỚC KHI CODE, đọc kỹ: docs/PROMPTS.md (mục "Luật chung" — bắt buộc), docs/MODULES.md, modules/dictionary/README.md, toàn bộ modules/courses/ (module mẫu), modules/dictionary/view.py (đã kiểm tra slug → 404), app_shell/core.js, app_shell/shell.css, content.py, data/curriculum.json.
Chỉ sửa trong modules/dictionary/.

Yêu cầu — trang danh sách (page.html + view.py khi không có slug):
1. Server render TẤT CẢ ký hiệu đang mở (content.signs()) thành lưới thẻ (grid 3–4 cột ở 1440px). Mỗi thẻ là <a href="/app/signs/{slug}?lang=.."> chứa: từ, nghĩa (rút gọn 2 dòng bằng CSS line-clamp), "Bài N · tên học phần", badge Mẫu nếu sample, nhãn nhỏ "Chưa có video" nếu video null. Gắn data-search (content.normalize của từ VI + EN + nghĩa), data-module, data-slug.
2. Thanh công cụ (ẩn bằng thuộc tính hidden, JS bỏ hidden): <div role="search"> chứa <label> + <input type="search"> (KHÔNG dùng <form>); chip lọc "Tất cả" + 8 học phần (chip của học phần chưa có ký hiệu thì disabled); chip "Yêu thích".
3. script.js: lọc tức thì (input event, so khớp SH.normalize(query) với data-search, tìm theo từng từ), kết hợp lọc học phần + yêu thích; câu đếm kết quả trong vùng aria-live; trạng thái rỗng (.sh-empty với mascot + nút "Xóa bộ lọc"); phím "/" focus vào ô tìm (trừ khi đang gõ); Esc xóa ô tìm.
   Kiểm thử: "cam on" → Cảm ơn; "THANK" → Cảm ơn; "bo" → Bố.

Trang chi tiết (detail.html + view.py khi có slug):
4. Bố cục 2 cột: trái = video hoặc .sh-video-placeholder (to, 16:9); phải = từ (h1 đã có), nghĩa, "Thuộc Bài N — tên bài" (link /app/lessons/N nếu bài mở), học phần, biến thể (sign['variants'], nếu rỗng ghi "Chưa có biến thể được ghi nhận"), nhãn "Luyện bằng AI: chưa hỗ trợ", nút chính "Tự luyện" → /app/practice/{slug}, nút phụ "Yêu thích" (button, JS), link quay lại từ điển.
5. Bên dưới: "Ký hiệu khác trong bài" — thẻ nhỏ các sign cùng lesson (trừ chính nó).
6. script.js trên trang chi tiết: yêu thích (SH.store.toggleFavorite/isFavorite, aria-pressed); SH.store.markSignSeen KHÔNG gọi ở đây (chỉ module lesson đánh dấu đã xem).
7. Locales vi/en đủ key dictionary.* (giữ nav/title/detail.title). Bỏ eyebrow stub và {{shell.stub.html}} ở cả 2 trang.
8. Kết thúc: verify.py PASS, /app/signs/khong-co vẫn 404, đặt status "done", liệt kê file đã đổi.
```

## D. `practice` — Tự luyện, không AI (`/app/practice`, `/app/practice/{slug}`)

```text
Bạn là frontend developer cho dự án SignHearing (web học Ngôn ngữ Ký hiệu Việt Nam, Python stdlib + HTML/CSS/JS thuần, render phía server, VI/EN).
Nhiệm vụ: hoàn thiện module `practice`: người học đặt video mẫu cạnh GƯƠNG CAMERA của mình, tự so sánh và tự đánh giá. TUYỆT ĐỐI KHÔNG có AI, không ghi hình, không tải lên, không thu âm.

TRƯỚC KHI CODE, đọc kỹ: docs/PROMPTS.md (mục "Luật chung" — bắt buộc), docs/MODULES.md, modules/practice/README.md, toàn bộ modules/courses/ (module mẫu), modules/practice/view.py (đã kiểm tra slug → 404), app_shell/core.js, app_shell/shell.css, content.py, data/curriculum.json.
Chỉ sửa trong modules/practice/.

Trang chọn /app/practice (page.html + view.py khi không có slug):
1. Server render danh sách theo bài đang mở: tiêu đề "Bài N · tên", dưới là các thẻ ký hiệu link /app/practice/{slug}. Chip lọc (JS): Tất cả / Đã xem trong bài học (SH.store.isSignSeen) / Yêu thích / Chưa luyện. Mỗi thẻ có số lượt đã luyện (JS, từ SH.store.practiceLog()).
2. Khối giải thích ngắn: camera chỉ để làm gương, không ghi hình, không gửi đi; chưa có AI chấm.

Phiên luyện /app/practice/{slug} (session.html + view.py):
3. Bố cục laptop 2 cột bằng nhau, cùng chiều cao 16:9:
   - Trái "Video mẫu": video hoặc .sh-video-placeholder; nếu có video: tốc độ 0.5×/0.75×/1×, lặp.
   - Phải "Gương của bạn": trạng thái tắt mặc định với nút "Bật camera" + 1 câu giải thích quyền riêng tư. KHÔNG tự bật camera.
4. script.js camera:
   - navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720},facingMode:'user'},audio:false}); gán video.srcObject; video muted playsinline autoplay; mặc định lật gương (CSS scaleX(-1)) với nút bật/tắt lật.
   - Khi đang bật: chấm đỏ + chữ "Camera đang bật" luôn nhìn thấy; nút "Tắt camera" dừng mọi track.
   - Dừng track khi pagehide, visibilitychange→hidden (tùy chọn), và khi rời trang.
   - Xử lý lỗi bằng thông báo rõ + hướng dẫn, không spinner vô hạn: NotAllowedError (bị từ chối → hướng dẫn mở lại quyền ở biểu tượng ổ khóa trên thanh địa chỉ), NotFoundError/OverconstrainedError (không có camera), NotReadableError (camera đang bị ứng dụng khác dùng), không hỗ trợ / không phải secure context. Trong mọi trường hợp vẫn cho tự đánh giá (luyện trước gương thật).
   - KHÔNG dùng MediaRecorder, canvas chụp hình, fetch/XHR gửi dữ liệu.
5. Đếm ngược tùy chọn: nút "Bắt đầu lượt" → 3-2-1 lớn đè lên gương (aria-live), rồi "Làm ký hiệu", tắt được trong prefers-reduced-motion (bỏ hiệu ứng, giữ số).
6. Tự đánh giá: 5 checkbox (hình dạng tay, vị trí, hướng lòng bàn tay, chuyển động, nét mặt) trong <fieldset> (KHÔNG <form>), nút "Lưu lượt luyện" → SH.store.addPractice(slug, {handshape, location, orientation, movement, expression}); thông báo đã lưu (aria-live); reset checkbox.
7. Lịch sử lượt luyện ký hiệu này (lọc SH.store.practiceLog() theo slug, mới nhất trước, tối đa 10): thời gian (Intl.DateTimeFormat theo SH.locale), số mục đạt x/5.
8. Điều hướng: "Thử lại" (reset checklist + đếm ngược), "Ký hiệu tiếp theo" (ký hiệu kế trong SH.signsOf(lesson)), link về bài học /app/lessons/{lesson}.
9. Để sẵn <div class="practice-feedback" hidden></div> kèm comment HTML: "Vùng phản hồi AI — sẽ gắn sau, không dùng ở bản này".
10. Locales vi/en đủ key practice.* (giữ nav/title/session.title). Bỏ eyebrow stub và {{shell.stub.html}}.
11. Kết thúc: verify.py PASS; thử trên Chrome/Edge tại http://127.0.0.1:8000 với camera cho phép / từ chối / không có camera (DevTools → Sensors hoặc tắt quyền); kiểm tra tab Network không có request nào gửi hình; đặt status "done", liệt kê file đã đổi.
```

## E. `review` — Ôn tập & kiểm tra (`/app/review`, `/app/review/quiz/{id}`)

```text
Bạn là frontend developer cho dự án SignHearing (web học Ngôn ngữ Ký hiệu Việt Nam, Python stdlib + HTML/CSS/JS thuần, render phía server, VI/EN).
Nhiệm vụ: hoàn thiện module `review`: flashcard ôn tập và bài kiểm tra nhận biết theo bài. Module này là nơi DUY NHẤT đặt bài sang "completed".

TRƯỚC KHI CODE, đọc kỹ: docs/PROMPTS.md (mục "Luật chung" — bắt buộc), docs/MODULES.md, modules/review/README.md, toàn bộ modules/courses/ (module mẫu), modules/review/view.py (đã kiểm tra bài mở và ≥2 ký hiệu → 404), app_shell/core.js, app_shell/shell.css, content.py, data/curriculum.json.
Chỉ sửa trong modules/review/.

Flashcard /app/review (page.html + view.py khi không có id):
1. Server render: danh sách "Kiểm tra theo bài" — mỗi bài mở có ≥2 ký hiệu: tên, số ký hiệu, link /app/review/quiz/{id}, điểm cao nhất (JS điền từ SH.store.quizResults). Khối flashcard có <noscript> giải thích cần bật JavaScript.
2. script.js flashcard: chọn nguồn bằng chip (Đã xem / Yêu thích / Theo bài: chọn bài) — lấy từ SH.data.signs + SH.store; nếu nguồn rỗng → .sh-empty hướng dẫn đi học bài trước.
   Thẻ lớn ở giữa: mặt trước = video/placeholder + câu hỏi "Ký hiệu này là gì?" (khi chưa có video thì mặt trước là TỪ, mặt sau là NGHĨA); mặt sau = đáp án. Lật bằng nút (aria-expanded) và phím Space/Enter; hiệu ứng lật 3D bỏ khi prefers-reduced-motion. Nút "Chưa nhớ" / "Nhớ rồi" (chỉ lưu trong phiên, biến JS): thẻ Chưa nhớ được đưa lại cuối hàng. ← → chuyển thẻ. Thanh tiến độ phiên "x/y".
Quiz /app/review/quiz/{id} (quiz.html + view.py):
3. Sinh câu hỏi ở JS từ SH.signsOf(id): mỗi ký hiệu 1 câu, thứ tự xáo trộn. Vì chưa có video: dạng chữ "Từ nào có nghĩa: “{meaning}”?" với lựa chọn là các từ. (Viết sẵn nhánh: nếu sign.video có giá trị thì dạng "Video này là ký hiệu nào?" + video.) Đáp án đúng + tối đa 3 phương án nhiễu lấy từ cùng bài trước rồi các ký hiệu mở khác; không bao giờ trùng.
4. Mỗi câu: nhóm nút lựa chọn (role="radiogroup" hoặc các <button>), chọn xong khóa lại, báo Đúng/Sai trong aria-live, tô màu + biểu tượng (không chỉ màu), hiện đáp án đúng, nút "Câu tiếp". Phím 1–4 để chọn.
5. Màn kết quả: điểm x/y; SH.store.addQuizResult(id, score, total); nếu score/total >= 0.8 → SH.store.setLessonState(id,'completed') + thông điệp khích lệ với mascot (không dùng chữ "thành thạo"); nếu thấp hơn → gợi ý ôn lại các từ sai, link về /app/lessons/{id}. Nút "Làm lại", link /app/courses.
6. Locales vi/en đủ key review.* (giữ nav/title/quiz.title/quiz.lesson). Bỏ eyebrow stub và {{shell.stub.html}}.
7. Kết thúc: verify.py PASS; làm quiz bài 1 đạt ≥80% → /app/courses hiện "Hoàn thành" ở Bài 1; <80% không đổi; đặt status "done", liệt kê file đã đổi.
```

## F. `progress` — Tiến độ (`/app/progress`)

```text
Bạn là frontend developer cho dự án SignHearing (web học Ngôn ngữ Ký hiệu Việt Nam, Python stdlib + HTML/CSS/JS thuần, render phía server, VI/EN).
Nhiệm vụ: hoàn thiện module `progress` tại /app/progress — tổng hợp tiến độ học của người dùng (dữ liệu từ SH.store, lưu trên trình duyệt).

TRƯỚC KHI CODE, đọc kỹ: docs/PROMPTS.md (mục "Luật chung" — bắt buộc), docs/MODULES.md, modules/progress/README.md, toàn bộ modules/courses/ (module mẫu), app_shell/core.js, app_shell/shell.css, content.py, data/curriculum.json. Nếu modules/dashboard đã xong, dùng cùng kiểu ô số liệu cho thống nhất (copy CSS sang, đổi tiền tố .m-progress — không import chéo).
Chỉ sửa trong modules/progress/.

Yêu cầu:
1. view.py + page.html: server render khung: 4 ô số liệu (hiện "—" khi không có JS); danh sách 8 học phần, mỗi học phần có thanh .sh-progress và data-lessons="1,2" (id các bài ĐANG MỞ), học phần không có bài mở hiện badge shell.badge.planned; khu "Lượt tự luyện gần đây" và "Kết quả kiểm tra" với <noscript>.
2. script.js:
   - 4 ô từ SH.store.summary(): bài hoàn thành / bài đang mở, ký hiệu đã xem, lượt tự luyện, lượt kiểm tra.
   - Mỗi học phần: completed/open, độ rộng thanh = tỉ lệ đó (đặt qua element.style.width), chữ "x/y bài hoàn thành".
   - Bảng lượt tự luyện (<table> có <caption>, <th scope>): 10 lượt mới nhất — thời gian (Intl.DateTimeFormat 'vi-VN'/'en-US' theo SH.locale, dateStyle medium + timeStyle short), ký hiệu (link /app/signs/{slug} qua SH.url), số mục tick x/5.
   - Kết quả kiểm tra theo bài: số lần làm, điểm cao nhất, lần gần nhất.
   - Danh sách ký hiệu đã xem dạng chip link tới từ điển.
   - Trạng thái người mới cho từng khu (.sh-empty + link tới /app/courses).
   - Nghe 'sh:store' để vẽ lại.
3. P1: lịch hoạt động 30 ngày gần nhất (lưới ô vuông, mức đậm theo số hoạt động/ngày tính từ các mốc at trong practiceLog + quizResults + lessons), có chú thích và nhãn aria cho từng ô.
4. Không dùng chữ "thành thạo", không quy ra %, không dùng 18 bài/400 từ làm mẫu số.
5. Locales vi/en đủ key progress.*. Bỏ eyebrow stub và {{shell.stub.html}}.
6. Kết thúc: verify.py PASS; tạo dữ liệu thử trong Console (SH.store.addPractice('xin-chao',{handshape:true}), SH.store.addQuizResult(1,6,7)...), kiểm tra số khớp; đặt status "done", liệt kê file đã đổi.
```

## G. `settings` — Cài đặt & dữ liệu (`/app/settings`)

```text
Bạn là frontend developer cho dự án SignHearing (web học Ngôn ngữ Ký hiệu Việt Nam, Python stdlib + HTML/CSS/JS thuần, render phía server, VI/EN).
Nhiệm vụ: hoàn thiện module `settings` tại /app/settings.

TRƯỚC KHI CODE, đọc kỹ: docs/PROMPTS.md (mục "Luật chung" — bắt buộc), docs/MODULES.md, modules/settings/README.md, toàn bộ modules/courses/ (module mẫu), app_shell/core.js, app_shell/shell.css.
Chỉ sửa trong modules/settings/.

Yêu cầu (bố cục: cột điều hướng nội bộ nhỏ bên trái với link #ngon-ngu, #du-lieu, #camera, #gioi-thieu; nội dung các sh-card bên phải):
1. #ngon-ngu — Ngôn ngữ giao diện: hai lựa chọn lớn Tiếng Việt / English là link {{url.vi}} và {{url.en}} (đã có sẵn trong template context), lựa chọn hiện tại có aria-current — tính ở view.py từ request.locale. Không cần JS.
2. #du-lieu — Dữ liệu của bạn: giải thích tiến độ chỉ lưu trong trình duyệt này, không đồng bộ giữa thiết bị, xóa dữ liệu trình duyệt sẽ mất. JS hiện tóm tắt (SH.store.summary()). Nút "Tải dữ liệu (JSON)": tạo Blob từ JSON.stringify(SH.store.export(), null, 2), URL.createObjectURL, thẻ <a download="signhearing-tien-do.json"> tạo bằng JS rồi click, sau đó revokeObjectURL. Nút "Xóa toàn bộ tiến độ": KHÔNG dùng window.confirm — mở khối xác nhận ngay dưới nút (nút "Xóa vĩnh viễn" màu cảnh báo + "Hủy"), focus chuyển vào khối xác nhận, Esc để hủy; xóa xong gọi SH.store.reset() và báo trong aria-live. Nếu SH.store.persistent() là false thì ghi rõ dữ liệu không được lưu.
3. #camera — Camera: chỉ dùng làm gương ở phần Tự luyện, chỉ bật khi bạn bấm, không ghi hình, không gửi đi; cách mở lại quyền trên Chrome/Edge (biểu tượng ổ khóa cạnh địa chỉ → Camera → Cho phép). Nếu trình duyệt hỗ trợ navigator.permissions.query({name:'camera'}) thì hiện trạng thái quyền hiện tại (bọc try/catch).
4. #gioi-thieu — Giới thiệu & giới hạn: SignHearing hỗ trợ tự học, không thay giáo viên hay phiên dịch viên; học liệu đang biên soạn và chưa có video chính thức; bản này chưa có AI; nội dung mẫu được gắn nhãn.
5. P1: card "Tài khoản" disabled với chữ "Sẽ có khi có đăng nhập".
6. Không JS: các nút dữ liệu ẩn (hidden), hiện câu cần bật JavaScript.
7. Locales vi/en đủ key settings.*. Bỏ eyebrow stub và {{shell.stub.html}}.
8. Kết thúc: verify.py PASS (anchor #... phải có id thật); thử xóa dữ liệu rồi vào /app/courses thấy "Chưa học"; đặt status "done", liệt kê file đã đổi.
```

---

## K. Nội dung — điền `data/curriculum.json` (không cần biết code)

```text
Bạn hỗ trợ nhập liệu cho dự án SignHearing. Tôi đính kèm giáo trình "Ngôn ngữ Ký hiệu Việt Nam (VSL 400)" (8 học phần, 18 bài).
Nhiệm vụ: cập nhật data/curriculum.json theo giáo trình, GIỮ NGUYÊN cấu trúc hiện có (đọc file và trường "_readme" trước; đọc thêm content.py để biết code dùng trường nào).

Quy tắc:
1. Không đổi id, slug hay thứ tự 8 học phần. Với bài 3–18: điền "title": {"vi": "...", "en": "..."} đúng tên trong giáo trình; tên tiếng Anh dịch ngắn gọn.
2. Thêm từ vựng của từng bài vào "signs" và slug vào mảng "signs" của bài đó: slug chỉ gồm a-z, 0-9, dấu gạch ngang, không dấu, duy nhất (trùng thì thêm hậu tố -2); "word" vi/en; "meaning" vi/en ngắn, trung tính; "lesson" = id bài; "video": null; "thumbnail": null; "variants": []; "ai_supported": false.
3. "status": từ mới nhập = "planned" (chưa video) — KHÔNG đặt "published" vì chưa có video đã duyệt. Bài 3–18 giữ "planned". Bài 1–2 và các ký hiệu "sample" giữ nguyên để nhóm dựng giao diện.
4. Không tự viết cách làm ký hiệu. Không suy đoán từ không có trong giáo trình. Bài 17 có chênh lệch giữa số nhóm và số mục: liệt kê đúng như giáo trình và ghi chú chỗ không khớp vào cuối câu trả lời, không tự sửa.
5. File phải là JSON hợp lệ, UTF-8, thụt lề 2 dấu cách.
6. Cuối cùng báo: số từ mỗi bài, tổng số từ, các slug bị trùng đã xử lý, những chỗ giáo trình chưa rõ. Sau đó chạy `python serve.py` + `python verify.py` để chắc chắn PASS.
```

## L. Lead duyệt PR của một module

```text
Bạn là reviewer cho dự án SignHearing. Hãy duyệt thay đổi của module <id> trên nhánh hiện tại so với nhánh chính.
Đọc docs/PROMPTS.md (mục "Luật chung"), docs/MODULES.md và modules/<id>/README.md làm chuẩn.

Kiểm tra và báo cáo theo danh sách:
1. `git diff --stat main...HEAD`: có file nào NGOÀI modules/<id>/ bị đổi không? Nếu có, liệt kê và đề xuất tách ra.
2. Từng mục P0 trong README đã làm chưa (bảng: mục — đạt/thiếu — ghi chú).
3. Vi phạm luật chung: key thiếu tiền tố/thiếu bản dịch, chuỗi viết cứng, CSS không bắt đầu .m-<id>, biến toàn cục, localStorage, <form>, style="" inline, script inline, link ngoài, link nội bộ thiếu ?lang=, nhiều hơn 1 h1, giá trị .html chưa escape trong view.py (XSS), số liệu giả, nhắc tới AI.
4. Chạy `python serve.py` và `python verify.py`, dán kết quả.
5. Rủi ro tương thích với module khác (dùng SH.store đúng hợp đồng chưa, có tự đặt completed ngoài module review không).
Chỉ sửa code khi tôi đồng ý; trước tiên đưa danh sách vấn đề xếp theo mức độ nghiêm trọng.
```

## M. Kiểm thử tổng sau khi ghép đủ module

```text
Dự án SignHearing đã ghép đủ 8 module khu học tập. Hãy kiểm thử toàn bộ luồng trên laptop (1440 px và 1280 px), cả ?lang=vi và ?lang=en, rồi báo lỗi theo mức độ nghiêm trọng (chưa sửa code khi chưa được đồng ý).
Đọc docs/MODULES.md và README từng module làm chuẩn.

Luồng cần đi (bắt đầu bằng SH.store.reset() trong Console):
1. Trang chủ → "Khám phá SignHearing" → /app hiện trạng thái người mới.
2. Lộ trình → Bài 1 → xem hết ký hiệu → Làm bài kiểm tra → đạt ≥80% → Lộ trình hiện Bài 1 "Hoàn thành", Tổng quan và Tiến độ cập nhật đúng số.
3. Từ một ký hiệu → Tự luyện → bật camera / từ chối camera → lưu lượt luyện → Tiến độ có lượt đó.
4. Từ điển: tìm "cam on", "THANK", lọc học phần, yêu thích → Ôn tập flashcard nguồn Yêu thích.
5. Cài đặt → tải JSON → xóa tiến độ → mọi trang về trạng thái người mới.
6. Đổi ngôn ngữ ở từng trang giữ nguyên trang; không lẫn tiếng Việt trong bản EN.
7. Bàn phím: Tab qua sidebar và mọi điều khiển, focus nhìn thấy, phím tắt từng module hoạt động.
8. Tắt JavaScript: các trang vẫn đọc được nội dung chính.
9. `python verify.py` PASS; DevTools Console không lỗi; tab Network không có request gửi hình ảnh.
Kết quả: bảng (bước — đạt/lỗi — mô tả — module chịu trách nhiệm).
```
