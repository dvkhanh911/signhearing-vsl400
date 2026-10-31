# Module `dashboard` — Tổng quan (`/app`)

Trang đầu tiên sau khi bấm **Khám phá SignHearing**. Mục tiêu: người học biết ngay *học tiếp cái gì*.

**Độ khó:** dễ–vừa · **Phụ thuộc:** chỉ cần shell (đã có). Làm song song được với mọi module khác.

## File của bạn
`page.html`, `view.py` (tạo nếu cần), `style.css`, `script.js`, `locales/vi.json`, `locales/en.json` — tất cả key bắt đầu bằng `dashboard.`

## Chức năng
**P0 (phải có)**
- Lời chào + mascot (ảnh `/static/assets/mascot.png`, alt rỗng nếu chỉ trang trí).
- Thẻ **Tiếp tục học**: bài `in_progress` gần nhất (`SH.store.summary().lastActivity`), nếu không có thì bài mở đầu tiên chưa hoàn thành, nút tới `/app/lessons/{id}`.
- 4 ô số liệu **thật** từ `SH.store.summary()`: bài hoàn thành / bài đang mở, ký hiệu đã xem, lượt tự luyện, lượt kiểm tra. Không bịa số, không dùng 400 làm mẫu số.
- Lối tắt tới Lộ trình, Từ điển, Tự luyện, Ôn tập.
- Trạng thái người mới (chưa có hoạt động nào): mascot + nút “Bắt đầu bài 1”.

**P1 (nếu kịp)**
- “Ký hiệu nên luyện lại”: lấy từ `SH.store.practiceLog()` các lượt có checklist chưa tick đủ.
- Danh sách yêu thích rút gọn (`SH.store.favorites()`).

## Gợi ý bố cục laptop
Hàng 1: lời chào (trái) + thẻ Tiếp tục học (phải, nổi bật). Hàng 2: 4 ô số liệu. Hàng 3: lối tắt dạng thẻ.

## Thử nhanh
Mở DevTools Console: `SH.store.setLessonState(1,'in_progress')`, `SH.store.markSignSeen('xin-chao')`, rồi reload. `SH.store.reset()` để về trạng thái người mới.

## Xong khi
- Không có số liệu giả; đúng cả trạng thái người mới và người đã học.
- VI/EN đủ key; `python verify.py` đạt; đổi `module.json` → `"status": "done"`.

## Bản triển khai hiện tại

- Server render lời chào, mascot, bài mở đầu tiên và bốn lối tắt; khi không có JavaScript, số liệu để “—”. Nếu không có bài mở, dẫn về lộ trình.
- JavaScript đọc `SH.store.summary()`, chọn bài từ hoạt động gần nhất dạng bài học/ký hiệu, rồi tới bài mở đầu tiên chưa hoàn thành. Khi hoàn thành hết bài mở, gợi ý ôn tập. Dashboard không ghi tiến độ.
- Cập nhật ngay khi nhận `sh:store`, gồm trạng thái bài, nhãn nội dung mẫu, số ký hiệu đã xem và bốn số liệu.
- “Nên luyện lại” lấy tối đa bốn ký hiệu theo lượt tự đánh giá gần nhất, bỏ ký hiệu đã tick đủ năm mục và nội dung không còn mở. Yêu thích hiển thị tối đa bốn ký hiệu.
- Mọi nội dung động được escape ở server hoặc gán bằng `textContent` ở trình duyệt. Chuỗi VI/EN nằm trong locales của module.

## Kiểm tra tự động

Từ thư mục gốc dự án, chạy server rồi chạy bộ kiểm tra chung:

```powershell
python -B serve.py
# Trong terminal khác:
python -B verify.py
python -B -m unittest discover -s modules/dashboard/tests -v
node modules/dashboard/tests/test_dashboard.js
```

Kiểm tra Python bổ sung bao phủ SSR không JavaScript, URL giữ ngôn ngữ, trạng thái không có bài mở và escape nội dung. Kiểm tra Node dùng `core.js` thật cùng DOM mô phỏng để kiểm tra lựa chọn bài, số liệu, sự kiện store, reset, gợi ý luyện lại và yêu thích; không cần cài thư viện. Node chỉ dùng để kiểm tra, không phải dependency chạy website.

Kết quả trong phiên triển khai: `verify.py` PASS 1.412 checks; ba test Python PASS; kiểm tra tích hợp store PASS ở VI và EN. Phiên công cụ không có trình duyệt khả dụng, nên chưa xác minh trực quan ở 1440/1280 px hoặc thao tác bàn phím trên trình duyệt thật. Các bài học và module khác vẫn theo trạng thái riêng của chúng.
