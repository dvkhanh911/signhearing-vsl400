# Module `dictionary` — Từ điển (`/app/dictionary`, `/app/signs/{slug}`)

**Độ khó:** vừa · **Phụ thuộc:** shell.

## File của bạn
`page.html` (danh sách), `detail.html` (chi tiết), `view.py` (đã kiểm tra slug → 404), `style.css`, `script.js`, `locales/*.json` (key `dictionary.*`).

## Chức năng
**P0 — danh sách**
- Server render **toàn bộ** ký hiệu đang mở dưới dạng lưới thẻ (để không có JS vẫn xem được). Lưu ý CSP đặt `form-action 'none'`: tìm kiếm làm bằng JS, không submit form.
- Ô tìm kiếm: lọc tức thì theo từ VI/EN, **không phân biệt dấu** (`SH.normalize`, mỗi sign có sẵn trường `search`).
- Chip lọc theo học phần; chip “Yêu thích”.
- Đếm kết quả (“7 ký hiệu”), trạng thái **không có kết quả** + nút xóa bộ lọc.
- Thẻ: từ, nghĩa ngắn, “Bài N”, nhãn “Mẫu” nếu là nội dung mẫu, biểu tượng có/chưa có video.

**P0 — chi tiết `/app/signs/{slug}`**
- Video mẫu hoặc placeholder, nghĩa, thuộc bài/học phần (link về bài), biến thể (nếu có), nhãn AI hỗ trợ: hiện tại luôn “Chưa hỗ trợ”.
- Nút “Tự luyện” → `/app/practice/{slug}`, “Yêu thích”, ký hiệu khác cùng bài.

**P1**: sắp xếp A–Z / theo bài; phím `/` để focus ô tìm kiếm.

## Xong khi
Tìm “cam on” ra “Cảm ơn”; tìm “thank” ra “Cảm ơn”; slug sai → 404; VI/EN đủ; `python verify.py` đạt.

## Triển khai

- Danh sách và chi tiết render đầy đủ trên server. Không JavaScript vẫn đọc được từ, nghĩa, bài/học phần, biến thể và các liên kết.
- Chỉ mục tìm kiếm gồm từ và nghĩa ở cả VI/EN, đã bỏ dấu. Tất cả từ trong truy vấn phải khớp; tìm kiếm kết hợp học phần và yêu thích.
- Chip của học phần chưa có ký hiệu bị vô hiệu hóa. Nút xóa bộ lọc đặt lại truy vấn, học phần và yêu thích, rồi đưa focus về ô tìm.
- `/` đưa focus vào ô tìm khi không nhập liệu; `Esc` xóa truy vấn. Số kết quả dùng vùng thông báo `aria-live`.
- Yêu thích và nhãn trên thẻ cập nhật qua `sh:store`, kể cả sau reset. Không ghi nhận lượt xem hay thay đổi trạng thái bài học.
- Media chỉ dùng đường dẫn cùng site. Video thiếu hoặc phát lỗi hiển thị thông báo của shell; video có sẵn luôn tắt âm thanh.
- Bộ sưu tập `local-videos` có 12 video do người dùng cung cấp, trạng thái mẫu, chưa được chuyên gia duyệt. Các mục này có `lesson: null`, không tự mở bài hay thay đổi khung giáo trình. “Anh” giữ riêng với “Anh trai”; “Bận” dùng slug `ban-ron` để không trùng “Bạn”.
- Video gốc MPEG-4 Part 2 được giữ nguyên ở `demo_thasi/data/`. Bản H.264 dùng trên web nằm trong `static/media/local-videos/`, có checksum truy vết về bản gốc. Server hỗ trợ byte ranges để phát/tua bằng trình duyệt. Chuẩn bị video dùng PyAV đã có sẵn trên máy phát triển; website không import hoặc cần thư viện này khi chạy.
- P1 sắp xếp A–Z/theo bài chưa triển khai; phím tắt `/` đã có.

## Kiểm tra

Chạy từ thư mục gốc dự án, không cần cài thư viện:

```powershell
python -B serve.py --port 8014
python -B verify.py --url http://127.0.0.1:8014
python -B modules/dictionary/tests/check_render.py
python -B modules/dictionary/tests/check_local_videos.py --url http://127.0.0.1:8014
```

`tests/check_browser.mjs` dùng Chrome headless với hồ sơ kiểm thử riêng và Chrome DevTools tại `127.0.0.1:9333`:

```powershell
node modules/dictionary/tests/check_browser.mjs http://127.0.0.1:8014
```

Bộ kiểm tra bao gồm VI/EN, 1440/1280 px, danh sách và hai bài khác nhau, tìm không dấu và theo nghĩa, kết hợp bộ lọc, yêu thích bằng bàn phím, tải lại, reset, không JavaScript, cửa sổ hẹp và slug sai → 404. Thêm `--screenshots` để lưu ảnh kiểm tra vào `modules/dictionary/.qa/`.

Khi có bộ video cục bộ, kiểm tra trình duyệt còn phát/tua cả 12 video ở VI/EN và 1440/1280 px. `check_local_videos.py` kiểm tra checksum bản gốc/bản H.264, HTTP Range, HEAD, phạm vi byte sai và đường dẫn bị chặn.

## Khôi phục bản trước khi tích hợp video

Bản sao cùng hướng dẫn nằm ở `.backups/local-videos-before-20261029/README.md`. Dùng `restore.py --check` trong thư mục đó để kiểm tra checksum mà không thay đổi dữ liệu; dùng `restore.py` rồi khởi động lại server để quay lại bản cũ. Công cụ khôi phục sẽ dừng nếu phát hiện chỉnh sửa mới sau bản thử.
