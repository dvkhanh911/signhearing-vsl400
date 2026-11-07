# Deploy SignHearing lên Vercel

Repo có cấu hình **Vercel Services** tại `vercel.json` ở gốc. Một project chạy
Next.js trong `frontend/` và FastAPI trong `backend/`, cùng một domain.
Homepage và trang Tính năng dùng giao diện Next.js hiện tại.

## Thiết lập project

1. Dùng nhánh `vercal` trên GitHub để deploy; nhánh `local` dành cho phát triển trên máy.
2. Import repo `dvkhanh911/signhearing-vsl400` vào Vercel hoặc mở project hiện có.
3. Trong **Settings → Build and Deployment**, đặt **Root Directory** là gốc
   repo: để trống hoặc `./`. Cấu hình sẽ đọc cả `frontend/` và `backend/`.
4. Xóa các override Build Command, Install Command và Output Directory của
   cấu hình Python/landing cũ. Các lệnh build và framework của từng service
   được khai báo trong `vercel.json`.
5. Đặt **Production Branch** là `vercal`, giữ system environment variables của Vercel được bật và deploy nhánh này.

Node được cố định ở `22.x` trong `frontend/package.json`; Python ở `3.12`
trong `backend/.python-version`. `npm ci` và `uv.lock` giữ bộ dependency đã khóa.

Không cần đặt `BACKEND_URL` hoặc một server backend bên ngoài. Các request
backend được Vercel chuyển thẳng tới service FastAPI. `SITE_URL` là tùy chọn:
nếu dùng, đặt thành origin HTTPS thực tế, ví dụ `https://ten-domain-cua-ban`.
Nếu bỏ trống, app lấy domain preview hoặc production do Vercel cung cấp.

`DATABASE_URL` không cần để chạy giao diện và các module hiện tại. Chỉ đặt URL
PostgreSQL khi sử dụng chức năng database. Không chép các giá trị localhost
trong file ví dụ local vào biến môi trường của deployment.

## Các URL trên cùng domain

| URL | Service |
| --- | --- |
| `/`, `/features`, `/_next/*`, `/assets/*`, `/images/*` | Next.js |
| `/login`, `/app`, `/app/*` | FastAPI |
| `/api/*`, gồm `/api/health` | FastAPI |
| `/static/*`, gồm CSS/JS của module và video MP4 | FastAPI |

Các route được chuyển nguyên đường dẫn và query, nên ngôn ngữ, đăng nhập demo,
cookie và các liên kết `/app/*` tiếp tục dùng cùng origin. Tiến độ và tài khoản
demo vẫn dùng cơ chế lưu trong trình duyệt hiện tại; deployment này không tạo
tài khoản server hoặc thay thế bằng dữ liệu database. Dữ liệu trình duyệt theo
origin, vì vậy địa chỉ local và domain Vercel có vùng lưu riêng.

## Ảnh trên homepage và trang Tính năng

`frontend/next.config.ts` đặt `images.unoptimized: true` để trình duyệt tải
ảnh trực tiếp từ `/assets/*` và `/images/feature-guides/*`. Trên deployment
được kiểm tra, ảnh gốc trả HTTP 200 nhưng URL `/_next/image?...` trả HTTP 404.
Cấu hình này bỏ qua endpoint tối ưu ảnh đang lỗi, giữ nguyên ảnh và bố cục.
Ảnh được gửi ở kích thước file gốc nên dung lượng tải có thể lớn hơn ảnh đã tối ưu.

Sau deploy, chạy `test:http` với `TEST_URL` của deployment. Bài kiểm tra tải
các URL `src` và `srcset` thực tế của ảnh trên homepage và trang Tính năng,
ở cả VI/EN; kiểm tra HTTP 200, Content-Type ảnh và nội dung không rỗng.

## Đóng gói backend

Build Command của backend chạy `python scripts/prepare_legacy.py`. Script tạo
`backend/legacy_site/` từ danh sách nguồn rõ ràng: renderer Python, template,
`partials/`, `locales/`, `modules/`, `app_shell/`, curriculum và `static/`.
Folder này được `includeFiles` đưa vào function. Backend chạy độc lập sau build,
không cần thư mục cha của repo tồn tại trong function.

`legacy_site/` là dữ liệu build, không commit. Script build tạo lại để loại file
cũ từ cache; nó bỏ qua test, công cụ nhập video và Python cache. Khi chạy local,
backend tiếp tục đọc nguồn ở gốc repo để sửa code/bản dịch có hiệu lực trực tiếp.

`.vercelignore` bỏ các công cụ portable, backup, cache, dependency local và file
môi trường khi upload bằng CLI. Không bỏ video hoặc template của ứng dụng.

## Kiểm tra trước và sau deploy

Từ gốc repo, với Node 22 và môi trường backend đã cài:

```powershell
npm --prefix frontend run test:deployment
npm --prefix frontend run build
uv run --project backend pytest -p no:cacheprovider
```

Trên máy hiện tại, script `scripts/start-modern.ps1` tự tìm Node portable.
Để gọi npm bằng tay khi Node chưa có trong PATH:

```powershell
$env:PATH = 'D:\SignHearing\.tools\node-v22.23.4-win-x64;' + $env:PATH
```

Sau deploy, mở homepage, `/features?lang=vi`, `/features?lang=en`, `/login`,
`/app/courses?lang=en` và `/app/account?lang=vi`. Kiểm tra `/api/health` trả
`{"status":"ok","service":"signhearing-api"}`, video tải/tua được, đổi ngôn
ngữ và reload giữ lựa chọn. Có thể chạy HTTP checks trên deployment truy cập được:

```powershell
$env:TEST_URL = 'https://DOMAIN-DEPLOYMENT-CUA-BAN'
npm --prefix frontend run test:http
```

Nếu deployment bị Vercel Deployment Protection chặn, cần mở quyền truy cập phù
hợp cho bản preview trước khi chạy kiểm tra HTTP từ máy ngoài.

Các kiểm tra local gồm build Next.js, bảng route, metadata domain và backend
được đóng gói trong thư mục độc lập. Một deployment thật vẫn cần kiểm tra các
URL trên sau khi Vercel tạo domain.

Kết quả kiểm tra bản cập nhật ngày 08/11/2026:

- Build production Next.js thành công với môi trường Vercel preview; manifest
  không chứa rewrite sang localhost.
- `vercel.json` hợp lệ theo schema Vercel chính thức.
- 3 kiểm tra cấu hình deployment, 8 kiểm tra HTTP/content trên bản production
  và 40 kiểm tra backend đạt; 1 kiểm tra PostgreSQL được bỏ qua khi chưa có DB.
- Backend đóng gói khoảng 13,9 MB mã nguồn/media, chạy được trong thư mục riêng,
  gồm 26 trang VI/EN, cookie HTTPS và video range request.
- Trang Tính năng có đủ 6 mục ở cả VI/EN. Bảng route Services được mô phỏng
  ở local để kiểm tra hai service cùng origin; đây chưa phải kết quả deploy cloud.

## Tài liệu chính thức

- [Vercel Services](https://vercel.com/docs/services)
- [Service routing](https://vercel.com/docs/services/routing)
- [Cấu hình service](https://vercel.com/docs/services/config-reference)
- [FastAPI trên Vercel](https://vercel.com/docs/frameworks/backend/fastapi)
