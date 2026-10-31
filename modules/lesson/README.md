# Module `lesson` — Bài học (`/app/lessons/{id}`)

Trang học một bài: xem từng ký hiệu, đọc hướng dẫn quan sát, đánh dấu đã xem, rồi sang kiểm tra / tự luyện.

**Độ khó:** vừa–khó (trình phát video) · **Phụ thuộc:** shell. Link sang `practice`, `review`, `dictionary` chỉ là đường dẫn — không cần chờ các module đó xong.

## File của bạn
`page.html`, `view.py` (đã có phần kiểm tra id → 404 cho bài chưa mở), `style.css`, `script.js`, `locales/*.json` (key `lesson.*`).

## Dữ liệu
- Server: `request.content.lesson(id)`, `request.content.signs(lesson_id)`, `request.content.module(id)`.
- Browser: `SH.lesson(id)`, `SH.signsOf(id)`; mỗi sign có `slug, word, meaning, video` (`video` = `null` khi chưa có).

## Chức năng
**P0**
- Đầu trang: học phần, tên bài, số ký hiệu, trạng thái bài (`SH.store.lessonState`).
- Bố cục 2 cột: danh sách ký hiệu (trái, ~280px, có dấu ✓ đã xem) | vùng học (phải).
- Vùng học: video mẫu (nếu `video` null → khối `.sh-video-placeholder` với `SH.t('shell.video.missing')`), nghĩa, **checklist quan sát** 5 thông số: hình dạng tay · vị trí · hướng lòng bàn tay · chuyển động · nét mặt (chỉ là tiêu đề nhắc quan sát, không tự viết cách làm ký hiệu khi chưa có chuyên gia duyệt).
- Điều khiển video (khi có video): phát/dừng, tốc độ 0.5× / 0.75× / 1×, lặp, lật gương. Không tự phát âm thanh.
- Nút “Đã xem” → `SH.store.markSignSeen(slug)`; Trước / Sau; phím ← → để chuyển ký hiệu.
- Mở trang → `SH.store.setLessonState(id, 'in_progress')` (store không bao giờ hạ từ completed xuống).
- Xem hết ký hiệu → nút “Làm bài kiểm tra” tới `/app/review/quiz/{id}`. **Hoàn thành bài do module review đặt khi quiz ≥ 80%** — module này không tự đánh dấu completed.
- Mỗi ký hiệu có link “Tự luyện” → `/app/practice/{slug}` và “Xem trong từ điển” → `/app/signs/{slug}`.

**P1**: nút yêu thích (`SH.store.toggleFavorite`), ghi nhớ ký hiệu đang xem khi reload (query `?sign=slug`).

## Xong khi
Chạy được cả khi chưa có video; điều khiển dùng được bằng bàn phím; VI/EN đủ; `python verify.py` đạt.

## Triển khai và kiểm tra

- Server render toàn bộ ký hiệu và anchor; khi có JavaScript, hash URL giữ ký hiệu đang chọn qua tải lại và lịch sử trình duyệt.
- Chỉ hành động “Đã xem” ghi nhận lượt xem. Xem hết làm nổi bật liên kết kiểm tra; module này chỉ đặt trạng thái `in_progress`, giữ nguyên `completed` đã có.
- Yêu thích, dấu đã xem, số đếm và badge cập nhật qua sự kiện `sh:store`, kể cả khi reset.
- Video hiện tại đều thiếu; giữ thông báo học liệu của shell. Nhánh có video hỗ trợ tốc độ, lặp, lật gương, luôn tắt âm thanh và trở về placeholder khi lỗi media.
- Chuỗi giao diện nằm trong `locales/vi.json` và `locales/en.json` của module.

Kiểm tra từ thư mục gốc dự án (không cần cài thư viện):

```powershell
python -B serve.py --port 8012
python -B verify.py --url http://127.0.0.1:8012
python -B modules/lesson/tests/check_render.py
```

`tests/check_browser.mjs` dùng Chrome DevTools tại `127.0.0.1:9333`. Chạy Chrome headless với hồ sơ kiểm thử riêng trong module, sau đó:

```powershell
node modules/lesson/tests/check_browser.mjs http://127.0.0.1:8012
```

Kiểm tra bao gồm bài 1/2, VI/EN, 1440/1280 px, reset, phím mũi tên, yêu thích, xem lần lượt đến cuối, lịch sử/hash, trạng thái completed, chế độ không JavaScript, video với clip trống tạo tạm trong trình duyệt, bố cục cửa sổ hẹp và giảm chuyển động. Thêm `--screenshots` để lưu ảnh kiểm tra vào `modules/lesson/.qa/`; clip kiểm thử không được lưu vào dữ liệu học liệu.
