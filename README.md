# SignHearing — landing kể chuyện, VI/EN

Website Python 3.11+ dùng thư viện chuẩn; không cần Node.js, dependency, database hay dịch vụ ngoài để chạy.

## Chạy

```powershell
cd D:\SignHearing
python serve.py
```

- Tiếng Việt: **http://127.0.0.1:8000/?lang=vi**
- English: **http://127.0.0.1:8000/?lang=en**
- Khu học tập (laptop-first, chưa có AI): **http://127.0.0.1:8000/app** — lộ trình mẫu ở `/app/courses`
- Thử 404 có dịch: **http://127.0.0.1:8000/trang-khong-co?lang=en**

Nếu cổng bận, dùng `python serve.py --port 8001`. Chỉ lắng nghe loopback. Dừng bằng Ctrl+C.

## Phạm vi

Trang chủ kể chuyện: hero → VSL và trích dẫn I. King Jordan → khó khăn lúc bắt đầu → câu chuyện SignHearing và định hướng sản phẩm → hành trình hiện tại → đồng hành và trích dẫn Helen Keller → footer.

CTA chính hero “Đọc câu chuyện” cuộn tới nội dung; “Khám phá SignHearing” mở `/app` thông báo đang xây dựng, với layout riêng. Đường cũ `/khu-hoc-tap` chuyển hướng về `/app`, giữ ngôn ngữ.

Hiện chưa có video học liệu chính thức. Các con số 8 học phần/18 bài được ghi là khung dự kiến. Không có số người dùng, phần trăm hoàn thành hoặc kết quả AI giả. Các định hướng sản phẩm trong câu chuyện không mở chức năng học.

Checkout ở đầu lượt này chỉ có landing và trang thông báo: tài khoản, CMS, database và khu học đã bị xóa ở giai đoạn trước theo yêu cầu trước đó. Lượt hiện tại **giữ mã và dữ liệu đang có**, không xóa thêm và không tự dựng lại chức năng đó. Auth/form/learning không có để dịch hoặc kiểm thử; mọi route chưa tồn tại trả trang 404 có VI/EN.

## i18n dùng chung

- `locales/vi.json`, `locales/en.json`: 97 key khớp nhau, bao gồm nội dung, metadata, alt/ARIA, nút, menu, trạng thái liên hệ, thông báo và 404.
- `i18n.py`: kiểm tra key, escape HTML, render template; formatter ngày/số theo locale.
- `serve.py`: render từ máy chủ; ưu tiên `?lang=vi|en`, sau đó cookie, mặc định VI cho lần truy cập đầu.
- Cookie ngôn ngữ có Path=/, Max-Age 1 năm, HttpOnly, SameSite=Lax. Lựa chọn giữ qua reload và truy cập trực tiếp; link nội bộ cũng giữ query ngôn ngữ.
- Hoạt động khi tắt JavaScript. JS chỉ hỗ trợ menu, chuyển động, giữ hash khi đổi ngôn ngữ và mở thông báo liên hệ, không thay chuỗi trong DOM.
- Trang hiện tại render qua máy chủ; mở file HTML trực tiếp sẽ thấy placeholder template. Luôn dùng URL preview.
- Đổi giao diện sang EN không đổi VSL thành ASL. Trích dẫn giữ nguyên tiếng Anh; giao diện VI có “Tạm dịch bởi SignHearing”.

Xem [docs/I18N.md](docs/I18N.md) trước khi thêm trang/component.

## Thông tin liên hệ

Người dùng xác nhận **chưa có** email/URL liên hệ chính thức. CTA “Liên hệ với SignHearing” mở thông báo rõ, không gửi form hoặc báo thành công. `site-config.json` để `contact_url` rỗng; chỉ thêm mailto/HTTPS sau khi có thông tin đã được xác nhận.

Footer không đưa liên kết tới chính sách chưa tồn tại. Các trích dẫn có nguồn và không được trình bày như sự bảo trợ của tác giả.

## Kiểm tra

```powershell
python verify.py
python -m py_compile serve.py i18n.py verify.py
```

Kết quả mới: **297 assertions HTTP/i18n/content đạt**, 97 key mỗi ngôn ngữ. Kiểm tra parity, render VI/EN, metadata/ARIA, CTA, nguồn trích dẫn trong HTML, anchor, asset, cookie, reload/direct navigation, 404, redirect cũ và chặn file nội bộ.

Browser/native hiện chưa kết nối được: chưa có ảnh chụp desktop/mobile hoặc bằng chứng tương tác UI. Không coi các assertion HTTP là kiểm tra responsive bằng mắt. Xem [báo cáo duyệt](docs/REVIEW.md).

## Cấu trúc

```text
index.html / under-construction.html / 404.html   Template từng trang
partials/                                       Layout/component dùng chung
locales/vi.json / locales/en.json                Từ điển UI
i18n.py / serve.py                               Renderer và máy chủ preview
site-config.json                                Cấu hình liên hệ, hiện để trống
static/landing.css / story.css / landing.js       Bố cục, tương tác và motion
static/assets/                                  Logo/mascot PNG riêng, giữ tỷ lệ
verify.py / docs/                                Kiểm tra và bàn giao
mascot.jpg / SignHearing_PRD.md                   Nguồn tham chiếu được giữ nguyên
```

## Khu học tập `/app` — chia module

Nút “Khám phá SignHearing” mở khu học tập gồm 8 module độc lập trong `modules/<id>/`; mỗi thành viên chỉ sửa thư mục của mình. Đọc **[docs/MODULES.md](docs/MODULES.md)** (bản đồ module, quy tắc, hợp đồng dữ liệu `SH.store`, quy trình Git) và `modules/<id>/README.md` (đặc tả từng module). Module `courses` đã làm xong để làm mẫu; các module còn lại hiện trang “đang xây dựng” đúng route.

```text
app_shell/        layout, sidebar, UI kit sh-*, core.js (SH.store), chuỗi shell.*   — lead
app_modules.py    tự tìm module, route, menu, render                                — lead
content.py        đọc data/curriculum.json                                          — lead
data/             khung giáo trình VSL 400 (8 học phần/18 bài) + nội dung mẫu       — phụ trách nội dung
modules/<id>/     module.json, page.html, view.py, style.css, script.js, locales/   — từng thành viên
```

`site-config.json` → `show_sample_content: true` bật 2 bài mẫu để dựng giao diện; tắt trước khi demo với học liệu thật.
