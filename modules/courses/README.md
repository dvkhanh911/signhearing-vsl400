# Module `courses` — Lộ trình học (`/app/courses`) — **ĐÃ XONG, dùng làm mẫu**

Đọc module này trước khi làm module của bạn: nó minh họa đủ 6 file.

| File | Vai trò |
|---|---|
| `module.json` | id, route, menu, trạng thái, người phụ trách |
| `page.html` | khung trang, dùng `{{courses.*}}` và class `sh-*` của shell |
| `view.py` | dựng phần động phía server (danh sách học phần/bài) — mọi giá trị phải `request.esc(...)` |
| `script.js` | phủ tiến độ từ `SH.store` lên HTML server đã dựng; bộ lọc |
| `style.css` | mọi selector bắt đầu bằng `.m-courses` |
| `locales/vi.json`, `en.json` | chuỗi giao diện, key `courses.*` |

Nguyên tắc: không JS vẫn xem được lộ trình; JS chỉ thêm trạng thái học và bộ lọc.
