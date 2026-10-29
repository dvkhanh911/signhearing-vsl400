# Bản duyệt SignHearing — cập nhật VI/EN

Ngày: **28/10/2026** (Asia/Saigon).

## Preview

| Trang | Tiếng Việt | English |
| --- | --- | --- |
| Trang chủ | [Mở VI](http://127.0.0.1:8000/?lang=vi) | [Open EN](http://127.0.0.1:8000/?lang=en) |
| Thông báo khu học | [Mở VI](http://127.0.0.1:8000/app?lang=vi) | [Open EN](http://127.0.0.1:8000/app?lang=en) |
| 404 | [Mở VI](http://127.0.0.1:8000/404?lang=vi) | [Open EN](http://127.0.0.1:8000/404?lang=en) |

Chạy `python serve.py`. Không khởi tạo database hoặc mở luồng học.

## Đã thay đổi

- Header: logo, VSL là gì, Câu chuyện, Hành trình, Đồng hành; VI/EN trên desktop và trong menu mobile; CTA mở /app.
- Hero giữ tiêu đề yêu cầu, dùng mô tả mới; CTA chính “Đọc câu chuyện”, CTA phụ “Khám phá SignHearing”. Hai cột trên desktop, xếp dọc trên mobile.
- Section VSL: nội dung mới, quote box navy/chữ trắng, tác giả và nguồn Congressional Record; có bản tạm dịch ở VI.
- Ba thẻ khó khăn đúng nội dung cung cấp; hover/focus nâng nhẹ, nội dung luôn nhìn thấy.
- Câu chuyện dùng nội dung và nhãn “Định hướng sản phẩm”; hình mascot/box Tìm hiểu → Quan sát → Thực hành, không giả lập mẫu VSL.
- Hành trình ghi khung **dự kiến** 8 học phần/18 bài, trạng thái giáo trình/video/công cụ; nêu rõ chưa có video chính thức. Không có số liệu thành tích.
- Đồng hành: trích Helen Keller có nguồn, banner xanh–tím nhạt/hồng, mascot và CTA liên hệ. Người dùng xác nhận chưa có địa chỉ chính thức: CTA mở thông báo thiếu thông tin, không tạo email/form/thông báo gửi thành công.
- Footer: thông điệp yêu cầu và liên hệ thật với trạng thái hiện tại; không liên kết chính sách chưa tồn tại.
- /app là trang thông báo layout riêng, đúng nội dung mới, có nút về trang chủ và VI/EN. URL /khu-hoc-tap cũ chuyển hướng, giữ ngôn ngữ.
- Dùng 97 key từ điển chung cho cả VI/EN: nội dung, head/metadata, menu, alt/ARIA, CTA, trạng thái và 404. Render SSR, không thay chuỗi trực tiếp trong DOM.
- Hoạt động khi JavaScript tắt. Menu có Escape/focus, nội dung reveal luôn hiện mặc định, motion chỉ dùng opacity/transform và có reduced-motion. Mascot chuyển động nhẹ trên desktop; dừng trên mobile/reduced-motion.
- Giữ các file/asset đang có, PRD và ảnh gốc; không xóa dữ liệu trong lượt này. Các chức năng auth/learning/CMS không tồn tại trong checkout đầu lượt, nên không tạo hoặc khôi phục ngoài phạm vi.

## Kiểm tra kỹ thuật

`python verify.py`: **297 assertions đạt**, gồm:

- Hai từ điển có 97 key giống nhau, không rỗng; thiếu key báo lỗi, không hiện key thô.
- Trang chủ, /app và 404 render VI/EN đầy đủ với document lang, Content-Language, title/description và ARIA có dịch.
- CTA/anchor/asset hợp lệ, giữ ngôn ngữ khi điều hướng; có liên kết hai nguồn trích dẫn.
- Lần đầu mặc định VI kể cả Accept-Language=en; đổi EN rồi reload, vào /app trực tiếp và 404 vẫn EN; đổi lại VI được ghi nhớ.
- Locale không hợp lệ fallback an toàn; redirect thông báo cũ giữ lựa chọn.
- Formatter ngày/số VI/EN; escape HTML; HEAD và GET nhất quán.
- URL chức năng học cũ và file nội bộ không được phục vụ; không có form/liên hệ giả.

`python -m py_compile serve.py i18n.py verify.py`: đạt.

Đây là assertions HTTP/HTML, **không phải** 297 ca browser E2E.

## Nguồn trích dẫn đã đối chiếu

- [Congressional Record, 28/03/2006, trang PDF 13](https://www.congress.gov/109/crec/2006/03/28/CREC-2006-03-28.pdf#page=13): xác nhận lời trích I. King Jordan và vai trò hiệu trưởng người Điếc đầu tiên của Gallaudet.
- [Helen Keller Services — Get Involved](https://www.helenkeller.org/get-involved/): xác nhận lời trích Helen Keller.
- Giao diện giữ nguyên lời tiếng Anh; VI ghi rõ tạm dịch. Không trình bày tác giả/nguồn như bên chứng thực hoặc bảo trợ SignHearing.

## Phần còn thiếu và giới hạn QA

**Chưa có kênh liên hệ chính thức**, đã được người dùng xác nhận. Không có video học liệu chính thức.

Đã thử hai bề mặt kiểm tra: Browser inventory trả `apps: [], browsers: []`; native Computer Use báo `Computer Use native pipe is unavailable … (os error 2)`. Vì vậy chưa có ảnh chụp website desktop/mobile, chưa xác minh trực quan bố cục hay thao tác browser. Không tạo ảnh mockup để thay bằng chứng này.

| Cần nghiệm thu trong browser | Kích thước / thao tác | Trạng thái |
| --- | --- | --- |
| Logo, hero, mascot, quote/card/banner | Desktop 1440 px, cả VI/EN | Chờ browser kết nối |
| Header/menu và section xen kẽ | Tablet 768 px | Chờ browser kết nối |
| Không tràn ngang, chữ/nút dễ đọc | Mobile 360/390 px, đặc biệt câu EN dài | Chờ browser kết nối |
| Menu mở/đóng, Escape/Tab, anchor bù header | Bàn phím và thao tác mobile | Chờ browser kết nối |
| Đổi ngôn ngữ, reload, direct URL | HTTP/cookie đã đạt; UI switch cần kiểm tra bằng browser | Chờ kiểm tra UI |
| Contact details, nguồn trích dẫn, reduced-motion | Browser có/không JS, reduced-motion bật | Chờ kiểm tra UI |

Landing được bàn giao qua URL để duyệt; khu học tiếp tục nằm ngoài phạm vi.
