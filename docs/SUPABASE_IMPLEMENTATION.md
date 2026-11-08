# Báo cáo triển khai Supabase

## Audit trước thay đổi

- `vercel.json`: hai Vercel Services riêng. Next.js phục vụ landing/features, FastAPI phục vụ `/api`, `/app`, `/login`, `/static`. Routing được giữ nguyên.
- `backend/app/api/learning.py` gọi adapter `app/services/legacy.py`. Local dùng source root; Vercel dùng `backend/legacy_site` do `scripts/prepare_legacy.py` tạo. `app_modules.py` render HTML Python từ shell, module, curriculum và locale VI/EN.
- `static/login.js` từng chấp nhận mọi username/password, ghi `signhearing:demo-auth`, `signhearing:demo-user` và cookie demo. `app_shell/core.js` từng kiểm tra các cờ này trong browser. Chưa có xác minh user ở FastAPI.
- `signhearing:v1` từng chứa `lessons`, `signs`, `quiz`, `practice`, `favorites`, `activity`. Sidebar, onboarding, theme vẫn là preference local; không dùng làm danh tính hoặc tiến độ tài khoản.
- API cũ chỉ có health/readiness và route render/static; chưa có API nghiệp vụ user. Alembic `0001_foundation.py` không tạo bảng. Không có SQL Supabase nghiệp vụ hoặc credentials được cung cấp.
- `data/curriculum.json` là nguồn lesson/module/sign, lesson ID số, sign slug chuỗi, có ký hiệu không thuộc bài. `video` là ID quiz tổng hợp thật. Các bài/mục chưa mở không được client API ghi tiến độ. Quiz lấy các ký hiệu có video; pass ≥80% hoàn thành bài cụ thể. Tự luyện lưu checklist 5 tiêu chí tự đánh giá.
- Account từng có ID/ngày tham gia/Premium giả. Đã thay bằng profile/email/UUID/ngày tạo thật, gói Free; payment chưa được kết nối nên không thể tự nhận Premium.

## Đã triển khai

- Supabase email/password registration/login/logout, UI xác nhận password, lỗi VI/EN, session refresh bằng cookie HttpOnly và redirect server cho trang bảo vệ.
- Một hệ thống auth chung. Next header đọc cùng `/api/auth/session`; legacy không giữ hệ thống demo. Backend gọi Auth xác minh token trước khi truy cập dữ liệu.
- Tất cả tiến độ cá nhân lưu bằng PostgREST RPC dưới token của user: lesson state, viewed signs, favorites, lịch sử self-practice/quiz và hoạt động. Có idempotency UUID, khóa unique, transaction và chống ghi nhầm từ tab cũ sau khi đổi tài khoản.
- RLS bảy bảng, chỉ đọc own-row; ghi qua RPC xác định `auth.uid()`, không cấp quyền ghi trực tiếp timestamp. Profile trigger cho user mới và backfill user đã tồn tại.
- Dashboard/Progress/Account/Practice/Quiz dùng dữ liệu thật; lịch 30 ngày, current/longest streak và activity history dùng thời gian Việt Nam từ timestamp server.
- Giữ mascot, animation, curriculum/video, camera, VI/EN, layout; các module chờ hydrate trước render. Không thay `vercel.json`, framework hay tài nguyên hình ảnh.
- Dữ liệu local cũ được giữ, chỉ thông báo phát hiện. Phương án import một lần có xác nhận được đề xuất trong setup; chưa triển khai nút nhập.

## File thay đổi

- Backend mới: `backend/app/api/auth.py`, `backend/app/api/progress.py`, `backend/app/services/supabase.py`.
- Backend sửa: `backend/app/main.py`, `backend/app/api/learning.py`, `backend/app/core/config.py`, `backend/app/core/errors.py`, `backend/app/services/legacy.py`, `backend/pyproject.toml`, `backend/uv.lock`, `backend/.env.example`.
- Shell: `app_modules.py`, `app_shell/core.js`, `app_shell/streak.js` (mới), `app_shell/layout.html`, `app_shell/onboarding.js`, `app_shell/shell.css`, `app_shell/locales/{vi,en}.json`.
- Login: `login.html`, `static/login.js`, `static/login.css`, `locales/{vi,en}.json`.
- Module JS: `modules/{account,courses,dashboard,dictionary,lesson,practice,progress,review,settings}/script.js`; module HTML: `modules/account/page.html`; locale: `modules/{account,dashboard,practice,progress,settings}/locales/{vi,en}.json`.
- Next: `frontend/src/components/layout/header.tsx`, `frontend/src/components/layout/session-link.tsx` (mới), `frontend/src/lib/supabase-config.ts` (mới), `frontend/src/locales/{vi,en}.json` (sync từ source), `frontend/.env.example`, `frontend/package.json`.
- Kiểm thử: `backend/tests/conftest.py`, `backend/tests/test_auth_progress.py`, điều chỉnh renderer regression trong `backend/tests/{test_foundation,test_deployment,test_i18n_reload}.py`, `frontend/tests/auth-store.test.mjs`, `frontend/tests/deployment.test.mjs`, `frontend/tests/http.test.mjs`, `supabase/tests/migration.test.mjs`.
- Migration/hướng dẫn: `supabase/migrations/202611080001_learning_auth.sql`, `SUPABASE_SETUP.md`, báo cáo này.

## Kết quả xác minh

- `npm run build`: PASS, Next.js 16.4.3 production webpack build; không cần credentials để build public landing.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm test`: 5/5 PASS (content/brand assets và JavaScript store trong Node VM).
- `npm run test:deployment`: 4/4 PASS (routing Vercel Services, local rewrites, metadata, đọc đúng public Supabase env và từ chối secret key).
- `npm run test:http`: 11/11 PASS trên Next production server local port 3000, proxy sang FastAPI port 8001. Kiểm tra SSR VI/EN, redirect bảo vệ, CSRF, API health, ảnh, 404 và video range. Không đăng ký tài khoản thật.
- `pytest -q`: 54 PASS, 1 SKIPPED. Test skipped là kết nối PostgreSQL thật do không có `DATABASE_URL`. Auth và PostgREST trong bộ này dùng mock upstream. Bao gồm renderer đóng gói chạy độc lập khỏi repo như Vercel, assets, cookie HTTPS, đăng ký/login/logout/refresh, JWT giả, CSRF, đổi tài khoản ở tab cũ, validation và streak qua nửa đêm Việt Nam.
- `ruff check app tests`: PASS. Format check của Python mới/sửa trong implementation: PASS.
- `node --test supabase/tests/migration.test.mjs`: PASS trên PGlite PostgreSQL engine: project schema mới, chạy lại migration trước/sau khi có dữ liệu, profile trigger, RLS giữa hai user, anonymous bị chặn, không ghi trực tiếp timestamp/profile, idempotency practice/quiz, hoàn thành bài và không hạ trạng thái.
- `python verify.py`: PASS sau khi chạy standalone renderer local port 8000: 2.893 kiểm tra HTTP/i18n/content, 814 keys mỗi ngôn ngữ, 9 modules, 12 app routes. Đây là kiểm tra renderer legacy, không chứng minh Auth trong standalone server cũ; sử dụng Next.js/FastAPI cho ứng dụng có Auth.
- `node --check` cho login/shell/module JS và `git diff --check`: PASS.
- Quét 281 file tracked/untracked hợp lệ: không thấy `.env` thật, chuỗi Secret key thực hoặc private key. Chỉ các `.env.example` là cấu hình mẫu; không tạo commit.
- Prettier check các file frontend đã thay đổi: PASS. `npm run format:check` toàn repo vẫn báo 45 file **không thay đổi** trong đợt này; không tự format lại phần ngoài phạm vi.

Host kiểm thử dùng Node 24.19.0; package dự án yêu cầu Node 22.x cho Vercel. Build và test local đạt trên host này, vẫn cần xác minh runtime Node 22 và Vercel hosted sau deploy. Có warning từ Starlette về HTTPX test client và từ Node về module type trong test deployment; không có test lỗi ở các bộ chức năng trên.

Không có kết nối Supabase hosted được xác minh; không push/deploy hoặc thay dữ liệu production.

## Giới hạn và bước thủ công

- Bạn cần chạy migration, cấu hình Auth và thêm bốn biến Supabase theo `SUPABASE_SETUP.md`, rồi tự deploy.
- Auth/refresh và PostgREST được kiểm thử bằng upstream giả lập; RLS/transaction được thực thi trên PostgreSQL WASM. Cần kiểm thử lại trên Supabase thực với hai tài khoản.
- Chưa xác minh UI trong trình duyệt thật với hosted credentials, gửi đăng ký thực, đồng bộ đa thiết bị thực hoặc streak qua nhiều ngày thực. Hướng dẫn sau deploy liệt kê đầy đủ các bước này.
- Quiz/self-assessment là công cụ học cá nhân, không phải kỳ thi có cơ chế chống gian lận. Không thêm AI chấm điểm giả hoặc tính năng gửi email giả.
