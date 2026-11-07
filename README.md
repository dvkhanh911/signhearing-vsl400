# SignHearing — homepage mới và khu học VSL

Homepage đã sửa UI và trang **Tính năng** nằm trong ứng dụng Next.js ở `frontend/`.
Khu học tập dùng các module Python mới nhất của nhóm, qua backend FastAPI.

## Chạy giao diện hiện tại

Từ PowerShell tại `D:\SignHearing`:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-modern.ps1
```

Script mở hai server ẩn và ghi log, PID trong `.runtime/`:

- **Homepage mới:** http://127.0.0.1:3000/?lang=vi
- **Tính năng:** http://127.0.0.1:3000/features?lang=vi
- **Khu học tập:** http://127.0.0.1:3000/app?lang=vi
- **English:** đổi `lang=vi` thành `lang=en`.
- **API health:** http://127.0.0.1:8001/api/health

`python serve.py` chạy giao diện Python cũ ở cổng 8000. Để xem homepage mới
và mục Tính năng, dùng server Next.js ở **cổng 3000** như trên.

Script tìm Node trong PATH hoặc `.tools/node-v*-win-x64/` ngay trong repo.
Chạy lại lệnh sẽ dùng lại server của đúng dự án được ghi trong `.runtime/processes.json`, kiểm tra
homepage/API, và khởi động server còn thiếu. Nếu cổng 3000 hoặc 8001 thuộc
ứng dụng khác, script sẽ báo rõ để bạn kiểm tra ứng dụng đang dùng cổng đó.

## Thiết lập trên máy mới

Yêu cầu Node.js 22+, Python 3.12+ và uv. Chạy từ gốc repo:

```powershell
npm --prefix frontend ci
uv sync --project backend --locked --python 3.12
powershell -ExecutionPolicy Bypass -File .\scripts\start-modern.ps1
```

Không cần PostgreSQL hoặc thông tin đăng nhập để mở homepage, trang Tính năng
và các module học hiện tại. Tiến độ học demo vẫn lưu trong trình duyệt theo origin.

## Deploy Vercel

`vercel.json` ở gốc triển khai Next.js và FastAPI bằng Vercel Services trong
cùng project. Trên Vercel đặt **Root Directory** về gốc repo (`./`), chọn nhánh
`vercal` và xóa các override build/output cũ. Cấu hình từng service đã
có sẵn; backend được build kèm template, module, bản dịch và video.

Không cần `BACKEND_URL` trên Vercel. App tự lấy domain deployment cho metadata;
`SITE_URL` chỉ cần khi muốn chỉ định domain riêng. Xem [hướng dẫn đầy đủ và các
URL cần kiểm tra](docs/VERCEL-DEPLOYMENT.md).

## Các file của homepage cần giữ khi đồng bộ

- `frontend/src/app/page.tsx`: homepage mới.
- `frontend/src/components/landing/immersive/`: hero, câu chuyện, hành trình,
  các thẻ giới thiệu tính năng và chuyển động.
- `frontend/src/app/features/page.tsx`, `frontend/src/components/features/`:
  trang Tính năng và các thẻ hướng dẫn.
- `frontend/src/components/layout/`: header có mục Tính năng, footer, menu,
  chuyển ngôn ngữ.
- `frontend/src/styles/immersive.css`, `frontend/src/styles/features.css`:
  giao diện homepage và trang Tính năng.
- `frontend/public/images/feature-guides/`: ảnh hướng dẫn tính năng VI/EN.
- `locales/vi.json`, `locales/en.json`: nội dung gốc, gồm các key `immersive.*`,
  `features.*`, `nav.features`. Giữ các key mới của nhóm khi ghép bản dịch.

`frontend/src/locales/` và `frontend/public/assets/` được tạo từ nguồn chung
bởi `frontend/scripts/sync-content.mjs` trước mỗi lần `npm run dev` hoặc build.
Không sửa trực tiếp các bản dịch được sinh tự động này.

Các cập nhật khu học tập nằm trong `modules/`, `app_shell/`, `app_modules.py`,
`content.py`, `i18n.py`, `serve.py` và `backend/`.

## Kiểm tra

```powershell
npm --prefix frontend run sync:content
npm --prefix frontend test
npm --prefix frontend run typecheck
npm --prefix frontend run test:deployment
npm --prefix frontend run test:http
uv run --project backend pytest
```

`test:http` cần hai server đang chạy ở cổng 3000 và 8001.
Xem thêm [kiến trúc và phát triển](docs/MODERN-DEVELOPMENT.md),
[homepage mới](docs/IMMERSIVE-LANDING.md),
[trang Tính năng](docs/FEATURES-REPORT.md), và [cấu trúc module](MODULES.md).

## Cấu trúc local đã dọn

Ứng dụng chạy trực tiếp ở gốc repo. Các checkout cũ, bản publish trùng, cache
cài đặt, công cụ thử nghiệm và cấu hình Vercel cho homepage Python cũ đã được dọn.
Cấu hình Vercel hiện tại triển khai đầy đủ Next.js và FastAPI.
Các component landing React cũ không còn được import cũng đã được bỏ.

Giữ `.tools/node-v*-win-x64/` và `.tools/python/` vì máy đang dùng Node/Python
portable tại đây; giữ `frontend/node_modules/`, `frontend/.next/` và
`backend/.venv/` để tiếp tục chạy app. `.runtime/` chỉ giữ PID và log đang dùng.

Các file Python ở gốc cùng `partials/`, `locales/`, `static/` vẫn được backend
dùng để render đăng nhập và khu học. Chúng thuộc ứng dụng hiện tại.

Gói khôi phục nguồn trước khi dọn nằm tại
`.backups/cleanup-20261108/source-recovery.zip`. Trong ZIP, `current/` chứa
mã nguồn gốc repo; các mục `previous*` và `historical/` giữ các thay đổi local
và bản sao lưu từ các checkout trước. Manifest và báo cáo dọn nằm cùng thư mục.

## Hai nhánh làm việc

- `local`: phát triển và chạy ứng dụng trên máy, theo dõi `origin/local`.
- `vercal`: bản dùng để deploy Vercel, theo dõi `origin/vercal`.

Hai nhánh ban đầu dùng cùng mã nguồn, gồm homepage mới và trang Tính năng.
Sau khi sửa, kiểm tra và commit trên `local`, cập nhật bản deploy bằng:

```powershell
git push origin local
git switch vercal
git merge local
git push origin vercal
git switch local
```

Đặt **Production Branch** của project Vercel thành `vercal`.
