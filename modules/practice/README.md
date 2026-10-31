# Module `practice` — Tự luyện, **không AI** (`/app/practice`, `/app/practice/{slug}`)

Người học đặt video mẫu cạnh **gương camera** của chính mình, tự so sánh rồi tự đánh dấu. Chưa có AI chấm — chừa sẵn chỗ để sau này gắn AI mà không phải làm lại giao diện.

**Độ khó:** khó nhất (camera) · **Phụ thuộc:** shell.

## File của bạn
`page.html` (chọn ký hiệu), `session.html` (phiên luyện), `view.py` (đã kiểm tra slug → 404), `style.css`, `script.js`, `locales/*.json` (key `practice.*`).

## Chức năng
**P0 — `/app/practice`**: chọn ký hiệu theo bài (nhóm theo `SH.data.lessons`), lọc “đã xem trong bài học”, “yêu thích”; mỗi mục link tới phiên luyện.

**P0 — `/app/practice/{slug}`** (bố cục laptop 2 cột bằng nhau)
- Trái: video mẫu (hoặc placeholder), tốc độ chậm, lặp.
- Phải: **gương camera**. Chỉ bật khi người dùng bấm “Bật camera” (không tự bật). Hiển thị lật gương mặc định, nút tắt camera. Dừng track khi rời trang (`pagehide`).
- Xử lý lỗi: từ chối quyền (`NotAllowedError`), không có camera (`NotFoundError`), trình duyệt không hỗ trợ → thông báo + vẫn luyện được bằng gương thật. Không spinner vô hạn.
- **Không ghi hình, không tải lên, không thu âm.** Ghi rõ điều này trên giao diện.
- Đếm ngược 3-2-1 (tùy chọn) rồi người học làm ký hiệu.
- Checklist tự đánh giá 5 thông số (hình dạng tay, vị trí, hướng lòng bàn tay, chuyển động, nét mặt) → “Lưu lượt luyện” → `SH.store.addPractice(slug, {handshape:true,...})`.
- Lịch sử lượt luyện của ký hiệu này (`SH.store.practiceLog()` lọc theo slug); “Thử lại”, “Ký hiệu tiếp theo”.
- Một vùng `<div class="practice-feedback">` để trống — chỗ gắn AI sau này (ghi chú trong code).

## Ghi chú kỹ thuật
`navigator.mediaDevices.getUserMedia({video:true, audio:false})` cần `localhost` hoặc HTTPS. CSP đã cho `media-src 'self' blob:`. Gán stream bằng `video.srcObject`.

## Xong khi
Chạy được trên Chrome/Edge laptop; từ chối camera không làm kẹt trang; không có request mạng nào gửi hình; VI/EN đủ; `python verify.py` đạt.

## Triển khai

- Danh sách bài đang mở và ký hiệu render trên server. Bộ video người dùng đã nhập nằm trong nhóm riêng, không gán thêm bài học. Các bộ lọc và số lượt lấy từ `SH.store`, cập nhật khi có `sh:store`.
- Hai vùng video/gương có cùng kích thước 16:9 trên laptop. Video thiếu hoặc phát lỗi trở về thông báo của shell. Video có sẵn hỗ trợ tốc độ 0.5×/0.75×/1× và lặp, luôn tắt âm thanh.
- Chỉ nút Bật camera mới gọi `getUserMedia`, luôn `audio: false`. Gương lật mặc định; nhãn camera đang bật cố định trên màn hình kể cả khi cuộn.
- Tắt camera, `pagehide` và chuyển trang sang ẩn đều dừng tất cả track. Yêu cầu quyền có thể hủy và hết thời gian chờ sau 15 giây; nếu stream đến muộn sau khi hủy/rời trang, track bị dừng ngay.
- Có thông báo riêng cho từ chối quyền, thiếu camera, camera bận, không hỗ trợ, địa chỉ không an toàn và lỗi khác. Checklist vẫn sử dụng được khi camera lỗi.
- Đếm ngược tùy chọn 3–2–1, có hủy; không có hiệu ứng chuyển động. Thử lại đặt lại checklist và đếm ngược.
- Lưu đúng 5 giá trị tự đánh giá qua `addPractice`; không đánh dấu đã xem, không sửa trạng thái bài học. Lịch sử hiển thị tối đa 10 lượt cho đúng ký hiệu, mới nhất trước, định dạng thời gian theo ngôn ngữ.
- Không dùng API ghi hình, chụp ảnh hay gửi dữ liệu. Không JavaScript vẫn đọc được nội dung, xem video có sẵn và dùng checklist với gương thật; lưu lịch sử cần JavaScript.

## Kiểm tra tự động

Từ thư mục gốc dự án:

```powershell
python -B serve.py --port 8014
python -B verify.py --url http://127.0.0.1:8014
python -B modules/practice/tests/check_render.py
```

`tests/check_browser.mjs` dùng Chrome DevTools, không cần cài thư viện. Mở Chrome/Edge headless với hồ sơ riêng trong module, cờ `--use-fake-device-for-media-stream` và remote debugging trên cổng 9333/9334. Chạy:

```powershell
node modules/practice/tests/check_browser.mjs http://127.0.0.1:8014 http://127.0.0.1:9333
node modules/practice/tests/check_browser.mjs http://127.0.0.1:8014 http://127.0.0.1:9334
```

Thêm `--screenshots` để lưu ảnh kiểm tra vào `modules/practice/.qa/`. Bộ kiểm tra dùng camera giả của trình duyệt, không mở webcam vật lý. Nó kiểm tra thao tác cấp quyền/từ chối thật của trình duyệt, giả lập các lỗi không có/bận camera, hủy yêu cầu, stream đến muộn, thời gian chờ, `pagehide`/ẩn trang, đếm ngược, bàn phím, lưu/tải lại/reset, giới hạn lịch sử, VI/EN, 1440/1280 px, cửa sổ hẹp và không JavaScript. Kiểm tra Network chỉ chấp nhận request GET/HEAD đến site; các icon SVG nội bộ `data:` của thanh điều khiển video Chromium không phải request gửi qua mạng.

Kiểm tra thủ công webcam vật lý vẫn cần thực hiện trên máy sử dụng thực tế. Video mẫu vẫn chờ chuyên gia duyệt; không có hướng dẫn ký hiệu cụ thể được bổ sung.
