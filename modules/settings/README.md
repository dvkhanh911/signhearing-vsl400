# Module `settings` — Cài đặt & dữ liệu (`/app/settings`)

**Độ khó:** dễ · **Phụ thuộc:** shell. Hợp cho thành viên mới làm quen code.

## File của bạn
`page.html`, `style.css`, `script.js`, `locales/*.json` (key `settings.*`).

## Chức năng
**P0**
- Ngôn ngữ giao diện: 2 lựa chọn VI/EN (link `?lang=vi|en`, không cần JS).
- **Dữ liệu của bạn**: giải thích tiến độ lưu trong trình duyệt này, không đồng bộ giữa máy; nút **Tải dữ liệu (JSON)** từ `SH.store.export()`; nút **Xóa toàn bộ tiến độ** với bước xác nhận ngay trên trang (không dùng `window.confirm`), gọi `SH.store.reset()`.
- **Camera**: giải thích camera chỉ dùng cho gương tự luyện, không ghi hình/gửi đi; cách mở lại quyền trong trình duyệt.
- **Giới thiệu & giới hạn**: chưa có AI chấm, học liệu đang biên soạn, không thay giáo viên.

**P1**: khu “Tài khoản” để trống, ghi “Sẽ có khi có đăng nhập”.

## Xong khi
Xóa dữ liệu xong thì Lộ trình về “Chưa học”; VI/EN đủ; `python verify.py` đạt.

## Đã triển khai

Owner: Codex. Status: done. Chỉ thay đổi trong `modules/settings/`.

- Điều hướng nội bộ tới 4 ID thật, cột nhỏ bên trái trên laptop. Ngôn ngữ là liên kết server render, có `aria-current` và nhãn ngôn ngữ cho trình đọc màn hình.
- Thông tin dữ liệu, camera, giới hạn và tài khoản được render ngay trên server. Nút dữ liệu ẩn khi không có JavaScript.
- Tóm tắt đọc `SH.store.summary()` và cập nhật qua `sh:store`; có cảnh báo riêng khi `persistent()` là false.
- Tải tệp `signhearing-tien-do.json` đúng nội dung `JSON.stringify(SH.store.export(), null, 2)` qua Blob. Liên kết tạm được xóa và object URL được thu hồi sau khi bắt đầu tải hoặc khi rời trang. Không gửi dữ liệu đi.
- Xác nhận xóa ngay trên trang, focus vào khối xác nhận, hỗ trợ Hủy và Esc, trả focus về nút mở xác nhận. Chỉ gọi `SH.store.reset()` sau nút Xóa vĩnh viễn. Kết quả thông báo qua `aria-live`.
- Quyền camera dùng `navigator.permissions.query({name:'camera'})`, xử lý lỗi hoặc thiếu API bằng thông báo không đọc được trạng thái; theo dõi sự kiện thay đổi quyền. Không gọi camera hoặc yêu cầu cấp quyền từ trang này.
- Khi bật giảm chuyển động, điều hướng nội bộ chuyển ngay tới nội dung và chuyển focus, không cuộn có hiệu ứng.
- Card tài khoản vô hiệu hóa theo phạm vi P1. Không có chức năng đăng nhập hoặc nhập lại tệp JSON trong đặc tả này.

## Kiểm tra

Chạy từ thư mục gốc dự án, ở các terminal riêng:

```text
python -B serve.py --port 8018
python -B verify.py --url http://127.0.0.1:8018
python -B modules/settings/tests/check_render.py
node modules/settings/tests/check_browser.mjs http://127.0.0.1:8018 http://127.0.0.1:9333 --screenshots
```

Browser test cần Chrome headless với CDP cổng 9333 và hồ sơ tạm riêng. Không chạy test trên hồ sơ của người học vì test có reset tiến độ. Không cần thêm thư viện. Tệp tải và ảnh kiểm tra được ghi dưới `.qa/` khi chạy test; có thể xóa sau khi kiểm tra.

Đã qua 4 test SSR và 113 kiểm tra trên trình duyệt: VI/EN tại 1440/1280 px; người mới, dữ liệu thật từ API store, tải JSON thật và đối chiếu từng trường, thu hồi object URL, hủy/Esc/xác nhận xóa bằng bàn phím, focus, trạng thái Chưa học ở courses sau reset và reload, giữ dữ liệu khi đổi ngôn ngữ, cảnh báo bộ nhớ tạm, lỗi tải tệp, quyền camera và thay đổi quyền, API quyền không hỗ trợ hoặc báo lỗi, không JavaScript, giảm chuyển động, bố cục hẹp và request chỉ GET/HEAD tới site cục bộ.

Không còn hạng mục P0/P1 chưa triển khai. Trạng thái quyền phụ thuộc khả năng của trình duyệt; luôn có hướng dẫn mở quyền thủ công.
