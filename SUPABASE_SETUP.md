# Hướng dẫn setup Supabase cho SignHearing

Hướng dẫn cấu hình Supabase Auth và dữ liệu học tập cho dự án hiện tại: `frontend/` dùng Next.js, `backend/` dùng FastAPI, deployment dùng Vercel Services. Tài liệu này có thể đưa lên GitHub; mọi URL và key minh họa đều là **placeholder**, không phải credentials thật.

Thực hiện theo thứ tự: chuẩn bị project → chạy SQL → bật Email Auth → điền biến môi trường → chạy local → kiểm tra → cấu hình Vercel khi cần. Tạo file `.env` hoặc chạy build thành công chưa chứng minh ứng dụng đã kết nối được Supabase; cần đăng ký, đăng nhập và lưu/đọc dữ liệu thật ở bước kiểm thử.

## 0. Chuẩn bị và lấy thông tin Supabase

Trên máy phát triển cần Node.js **22.x**, Python **3.12+**, npm và uv. Thực hiện các lệnh trong thư mục gốc của repository, nơi có `vercel.json`, `frontend/` và `backend/`.

1. Đăng nhập [Supabase Dashboard](https://supabase.com/dashboard) và mở project muốn sử dụng. Nếu chưa có project, tạo project mới và chờ khởi tạo hoàn tất. Nên dùng project phát triển riêng khi thử ghi dữ liệu local.
2. Lấy **Project URL** trong phần cấu hình API của project, ví dụ `https://YOUR_PROJECT.supabase.co`.
3. Mở **Settings → API Keys** và lấy **Publishable key** bắt đầu bằng `sb_publishable_`. Tên/vị trí menu có thể thay đổi theo phiên bản Dashboard.
4. Giữ hai giá trị này để điền vào hai file môi trường trên máy của bạn. Cả frontend và backend phải dùng cùng một project.

Ứng dụng hiện tại chỉ cần Project URL và Publishable key. Nếu Supabase yêu cầu đặt database password khi tạo project, không đưa password đó vào cấu hình ứng dụng này. Không dùng Secret key, Service Role key hoặc legacy JWT key để thay cho Publishable key.

Tham khảo: [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys).

## 1. Chạy migration

1. Mở đúng Supabase Project → SQL Editor → New query.
2. Chạy **toàn bộ** [supabase/migrations/202611080001_learning_auth.sql](supabase/migrations/202611080001_learning_auth.sql), gồm `begin` và `commit`.
3. Kiểm tra bảy bảng: `profiles`, `lesson_progress`, `viewed_signs`, `favorite_signs`, `practice_sessions`, `quiz_attempts`, `study_activities`.
4. Mỗi bảng phải bật RLS và có policy `sh_select_own` dành cho `authenticated`. `anon` không có quyền đọc dữ liệu cá nhân. Ghi dữ liệu chỉ qua RPC `sh_record_learning_event`; `sh_learning_snapshot` đọc dưới RLS của user.

Migration dùng UUID của `auth.users`, `timestamptz`, khóa duy nhất theo user/resource hoặc user/event UUID; không cần extension hoặc mật khẩu database. Trigger tạo profile khi đăng ký; tài khoản đã tồn tại cũng được bổ sung profile. Chạy lại migration này không xóa tiến độ, hồ sơ hoặc lịch sử.

Migration này tương ứng với curriculum và module thực tế trong repository. Nếu project đã có bảng cùng tên với cấu trúc khác, hãy đối chiếu/sao lưu trước. Migration sẽ rollback khi gặp lỗi cấu trúc hoặc phát hiện policy khác cần rà soát; đây không phải công cụ tự chuyển đổi mọi schema cũ. Không xóa policy/bảng cũ để ép chạy. Cần lập migration bổ sung khi cấu trúc khác nhau; không dùng `DROP TABLE` hay reset project.

Có thể kiểm tra trạng thái RLS bằng truy vấn chỉ đọc sau trong SQL Editor:

```sql
select relname as table_name, relrowsecurity as rls_enabled,
       relforcerowsecurity as rls_forced
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in (
    'profiles', 'lesson_progress', 'viewed_signs', 'favorite_signs',
    'practice_sessions', 'quiz_attempts', 'study_activities'
  )
order by relname;
```

Kết quả mong đợi: đủ 7 bảng, `rls_enabled` và `rls_forced` đều là `true`. SQL Editor thường chạy với quyền quản trị, vì vậy việc nhìn thấy mọi hàng ở đây không phải cách kiểm thử phân quyền giữa hai user; dùng hai tài khoản qua ứng dụng ở bước 7.

## 2. Cấu hình Authentication

Trong Supabase Dashboard:

- Authentication → Providers / Sign In → bật Email và cho phép đăng ký email/password.
- Tắt **Confirm email** cho MVP như yêu cầu. Nếu vẫn bật, ứng dụng báo rõ không nhận được phiên đăng nhập, không giả lập gửi email hoặc đăng nhập thành công.
- Đặt độ dài mật khẩu tối thiểu 8 ký tự. Giao diện kiểm tra nhập lại mật khẩu; Supabase áp dụng quy tắc bảo mật cuối cùng.
- Authentication → URL Configuration: với project chỉ dùng local, đặt Site URL là `http://127.0.0.1:3000`. Với project triển khai thật, đặt Site URL là origin HTTPS thật của website, ví dụ `https://YOUR_SITE.vercel.app`. Khi cần Redirect URLs, khai báo rõ URL local/preview tin cậy; tránh wildcard quá rộng. Luồng hiện tại dùng email/password qua backend và không có OAuth, magic-link hoặc callback mới cần tạo.
- Giữ cơ chế refresh token rotation và khoảng reuse mặc định của Supabase; ứng dụng có thể gửi nhiều request đồng thời từ các tab.
- Project Settings → API: lấy Project URL và **Publishable key** dạng `sb_publishable_...`. Code chủ động từ chối Secret key và legacy JWT keys để tránh dùng nhầm quyền cao.

Tham khảo chính thức: [Password Auth](https://supabase.com/docs/guides/auth/passwords), [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [User sessions](https://supabase.com/docs/guides/auth/sessions), [User data and RLS](https://supabase.com/docs/guides/auth/managing-user-data).

## 3. Environment variables trên Vercel Services

Thêm vào môi trường Production và Preview phù hợp, đúng service:

**Frontend (`frontend/`, Next.js, được đọc lúc build):**

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_PUBLIC_KEY
```

**Backend (`backend/`, FastAPI):**

```dotenv
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_PUBLIC_KEY
APP_ENV=production
```

Hai cặp URL/key phải thuộc **cùng một project**. Không thêm dấu nháy hoặc khoảng trắng ngoài giá trị trên Vercel. Thay public variables cần build lại frontend. `/api/auth/config` chỉ trả về cấu hình công khai; header Next.js kiểm tra đối chiếu với backend. `/api/auth/session` dùng chính cookie đã đăng nhập ở trang legacy, không tạo session riêng trong Next.js.

`DATABASE_URL` không cần cho các chức năng Supabase này. Để trống nếu không dùng health check PostgreSQL cũ. Không thêm Secret Key, Service Role Key hoặc Database Password vào frontend; implementation này không cần chúng ở backend. `.env.example` chứa ô trống, `.env`/`.env.*` thật bị gitignore.

## 4. Kiến trúc và Vercel

Giữ nguyên `vercel.json`: `/api/*`, `/app/*`, `/login/*`, `/static/*` vẫn vào FastAPI; các đường dẫn còn lại vào Next.js. Không thay framework hoặc rebuild website.

- Next.js landing dùng public variables ở `src/lib/supabase-config.ts` và gọi API cùng origin.
- `/login` có cả đăng nhập và đăng ký, giữ mascot/animation, VI/EN và tham số `next` an toàn trong `/app`.
- FastAPI gọi Supabase Auth HTTP API bằng publishable key. Access token và refresh token nằm trong cookie HttpOnly, SameSite=Lax, Secure trên production. Không trả token cho JavaScript hoặc lưu token trong localStorage.
- Trước mỗi trang bảo vệ/API dữ liệu, backend xác minh access token với `/auth/v1/user`; token hết hạn được refresh và xác minh lại. Cookie demo không có giá trị xác thực.
- Ghi cookie cần request JSON cùng origin; chặn CSRF. Có xử lý origin của local Next proxy và public host được edge Vercel chuyển tiếp.
- PostgREST/RPC nhận token của user đã xác minh. RLS và `auth.uid()` xác định chủ sở hữu; không nhận `user_id` từ client để phân quyền. Header `X-SH-User` chỉ chống tab cũ ghi nhầm sau khi đổi tài khoản, luôn được so sánh với danh tính backend đã xác minh.
- `backend/scripts/prepare_legacy.py` đóng gói các file shell/module/locale/static mới vào `legacy_site` như trước. Không đóng gói `.env`.

## 5. Dữ liệu, streak và dữ liệu trình duyệt cũ

`SH.store` giữ giao diện đọc đồng bộ cho module, nhưng chờ tải dữ liệu tài khoản trước khi render. Mọi thao tác ghi đều chờ server xác nhận, sau đó nạp lại snapshot. Có thông báo lỗi và thử lại; UUID của một lượt luyện/quiz được giữ khi thử lại để tránh nhân đôi. Lesson progress không bị hạ từ completed xuống in_progress. Bài học hoàn thành khi quiz của bài đạt ít nhất 80%; bài video tổng hợp không hoàn thành bài học cụ thể.

Checklist luyện tập là **tự đánh giá**, camera không được tải lên. Quiz hiện lưu kết quả từ trình nhận diện trắc nghiệm chạy trong browser, backend kiểm tra curriculum, số câu và giới hạn điểm; đây không phải hệ thống thi chống gian lận. Không thay đổi hoặc thêm AI chấm điểm giả.

Streak chỉ đọc `study_activities`, được ghi cùng transaction khi hoàn tất tự luyện, nộp quiz hoặc hoàn thành bài. Đăng nhập, mở bài, xem ký hiệu và yêu thích không tạo ngày học. Timestamp do PostgreSQL đặt, lưu `timestamptz` với thời điểm UTC; client không được ghi/backdate trực tiếp. Ngày học quy đổi sang `Asia/Ho_Chi_Minh`, nhiều hoạt động cùng ngày chỉ tăng một ngày streak. Current streak giữ nguyên nếu đã học hôm qua và hôm nay chưa học; về 0 khi bỏ trọn một ngày. Longest streak dùng toàn bộ lịch sử. Calendar hiển thị đúng 30 ngày giờ Việt Nam.

**Dữ liệu localStorage cũ:** không tự nhập hay ghi đè server. Account hiển thị thông báo nếu phát hiện `signhearing:v1`. Dữ liệu cũ được giữ nguyên. Đề xuất nhập một lần: chủ tài khoản xuất bản JSON cũ, xem trước số bài/ký hiệu/lượt luyện/quiz, xác nhận tài khoản đích và danh sách mục; sau đó dùng migration nhập riêng theo kiểu chỉ thêm mục chưa tồn tại, đánh dấu import theo user/hash. Không dùng timestamp cũ chưa xác minh để tạo streak. **Luồng nhập có xác nhận này là đề xuất, chưa có nút nhập trong MVP.** Giữ bản JSON và liên hệ người quản trị nếu cần chuyển dữ liệu cũ; không dán JSON vào SQL có quyền cao một cách trực tiếp.

## 6. Chạy và kiểm thử local

### 6.1. Tạo file môi trường, giữ nguyên file đã có

Kiểm tra `backend/.env` và `frontend/.env.local` trước khi tạo. Nếu đã có, mở và bổ sung biến còn thiếu; giữ nguyên giá trị đang có cho đến khi bạn chủ động thay đổi. Không copy đè file đã cấu hình.

Nếu chưa có, có thể tạo từ mẫu bằng PowerShell dưới đây, chạy tại **gốc repo**. Lệnh chỉ copy khi file đích chưa tồn tại:

```powershell
if (-not (Test-Path -LiteralPath backend/.env)) {
    Copy-Item -LiteralPath backend/.env.example -Destination backend/.env
}
if (-not (Test-Path -LiteralPath frontend/.env.local)) {
    Copy-Item -LiteralPath frontend/.env.example -Destination frontend/.env.local
}
```

**File `backend/.env`:**

```dotenv
# Thay hai placeholder bằng thông tin project Supabase thật
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY

# Giữ development khi chạy local
APP_ENV=development
```

**File `frontend/.env.local`:**

```dotenv
# Phải trùng Project URL và Publishable key trong backend/.env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY

# Backend FastAPI local
LOCAL_BACKEND_URL=http://127.0.0.1:8001
```

Bạn cần thay **4 dòng Supabase** trong hai file bằng URL/key thật. Dán URL đúng như Dashboard cung cấp, không thêm `/auth/v1`, `/rest/v1`, dấu cách hay ký tự minh họa `YOUR_PROJECT`. Các placeholder chưa điền không thể dùng để đăng nhập.

Giữ nguyên `APP_ENV=development` và `LOCAL_BACKEND_URL=http://127.0.0.1:8001` khi chạy local theo hướng dẫn. `LOCAL_BACKEND_URL` đã có giá trị mặc định này trong code, nhưng ghi rõ trong file giúp kiểm tra cấu hình. `API_HOST`, `API_PORT`, `CORS_ORIGINS` có sẵn giá trị mặc định phù hợp trong backend; các giá trị tương ứng ở file mẫu có thể giữ nguyên. `DATABASE_URL` có thể để trống, không cần thêm database password.

### 6.2. Khởi động hai dịch vụ

Dùng hai terminal riêng. Các lệnh `cd` dưới đây đều bắt đầu tại gốc repo:

```powershell
# Terminal 1
cd backend
uv sync --group dev
uv run uvicorn app.main:app --host 127.0.0.1 --port 8001
```

```powershell
# Terminal 2
cd frontend
npm ci
npm run dev
```

Mở **http://127.0.0.1:3000/login?lang=vi** để đăng ký/đăng nhập. Truy cập khu học qua port **3000**, để Next.js chuyển tiếp các đường dẫn backend và giữ cùng origin. Không dùng `python serve.py` ở port 8000 cho luồng Auth này; đó là preview renderer cũ.

Kiểm tra API qua proxy bằng terminal thứ ba:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/health
```

Kết quả mong đợi có `status: ok`. Health chỉ xác nhận API đang chạy, chưa xác nhận kết nối Supabase. Đăng ký/đăng nhập và lưu/khôi phục dữ liệu ở bước 7 mới kiểm tra kết nối thực.

Sau khi thay `.env`, dừng và chạy lại cả hai server. Nếu dùng `npm run start`, cần build lại frontend trước để cập nhật các biến `NEXT_PUBLIC_*`.

Không đặt `LOCAL_BACKEND_URL` trên Vercel. Chỉ giữ localhost trong `CORS_ORIGINS` cho local, không bật CORS wildcard. Trên Vercel, frontend/backend giao tiếp cùng origin và không cần cross-origin credentials.

### 6.3. Kiểm tra tự động

Chạy từng nhóm lệnh trong đúng thư mục được ghi ở phần chú thích:

```powershell
# backend/
uv run pytest -q
uv run ruff check app tests

# frontend/
npm run build
npm run typecheck
npm run lint
npm test
npm run test:deployment

# frontend/, khi cả Next.js và FastAPI local đang chạy
npm run test:http

# repo root: PostgreSQL WASM, cài dưới thư mục runtime bị gitignore
npm install --prefix .runtime/sql-check @electric-sql/pglite
node --test supabase/tests/migration.test.mjs
```

Test FastAPI mock dịch vụ Auth/PostgREST để kiểm tra HTTP contract; test SQL dùng engine PostgreSQL PGlite với schema `auth` tối thiểu, không phải Supabase hosted. Test `auth-store` chạy JavaScript trong Node VM, không phải kiểm thử trình duyệt thật. Xem [docs/SUPABASE_IMPLEMENTATION.md](docs/SUPABASE_IMPLEMENTATION.md) để biết kết quả cuối cùng và giới hạn xác minh.

## 7. Kiểm thử sau khi bạn chạy SQL và deploy

1. Chưa đăng nhập: mở trực tiếp `/app/progress?lang=vi`, phải về `/login` với `next`; tự đặt cookie/cờ demo không được vượt bảo vệ.
2. Tạo tài khoản A bằng email mới, tên hiển thị, password ≥8 ký tự và xác nhận khớp. Thử xác nhận khác nhau, email sai, mật khẩu sai và email đã đăng ký; lỗi phải rõ ràng, không có phiên giả.
3. Đăng ký thành công phải vào khu học tập. Đổi VI/EN, reload và mở tab mới: phiên còn hoạt động. Account hiển thị đúng tên/email/UUID/ngày tạo, không có ID hoặc ngày tham gia mẫu.
4. Mở một bài, đánh dấu ký hiệu đã xem và chọn yêu thích. Tải lại: các lựa chọn còn nguyên. Mở cùng tài khoản trên thiết bị khác: dữ liệu được nạp từ server.
5. Hoàn tất một lượt tự luyện, lưu checklist; xem lịch sử Practice/Progress và số liệu Dashboard. Nhấn lưu hai lần nhanh hoặc gửi lại cùng UUID: chỉ có một bản ghi.
6. Nộp quiz: lưu điểm, số câu, thời điểm và lịch sử. Quiz bài học đạt ≥80% hoàn thành bài; thất bại hoặc quiz video tổng hợp không hoàn thành bài cụ thể.
7. Đăng xuất, truy cập lại đường dẫn bảo vệ: về login. Đăng nhập lại A: dữ liệu phục hồi. Tạo B trong cửa sổ riêng: không thấy tiến độ, yêu thích, profile hoặc lịch sử A. Đổi tài khoản ở tab khác rồi thử ghi ở tab cũ: phải tải lại hoặc bị từ chối.
8. Chỉ đăng nhập/mở bài/xem ký hiệu: streak không tăng. Lưu một lượt luyện hoặc nộp quiz: current=1, longest≥1 và calendar hôm nay có hoạt động. Nhiều lượt cùng ngày không tăng số ngày. Kiểm tra tiếp hôm sau theo giờ Việt Nam; bỏ một ngày phải ngắt chuỗi. Không sửa thời gian production để test.
9. Kiểm tra DevTools: API riêng tư có `Cache-Control: private, no-store`; không có token ở localStorage/response JSON; cookie `sh_access`/`sh_refresh` có HttpOnly/Secure. Thử JWT giả, `user_id` tự gửi và đọc bảng bằng tài khoản khác: phải bị chặn hoặc không trả hàng của người khác.
10. Kiểm tra `/`, `/features`, video VSL, camera tự luyện, mascot, sidebar, onboarding và responsive trên điện thoại. Thử mạng lỗi lúc lưu: không báo thành công; thử lại cùng lượt không tạo dữ liệu trùng.

## 8. Đưa hướng dẫn lên GitHub

Đưa file **`SUPABASE_SETUP.md` ở gốc repo** lên GitHub cùng source code tích hợp và migration được tham chiếu. Không cần tạo một bản hướng dẫn khác có thông tin project riêng.

Các file cấu hình được chia sẻ là `frontend/.env.example` và `backend/.env.example`, giữ placeholder hoặc để trống. Các file thực `frontend/.env.local` và `backend/.env` chỉ nằm trên máy bạn; chúng không được commit.

Trước khi tự commit, chạy từ gốc repo:

```powershell
# Phải hiển thị quy tắc .env.* và .env trong .gitignore
git check-ignore -v -- frontend/.env.local backend/.env

# Mong đợi không có kết quả: hai file thực chưa được Git track
git ls-files -- frontend/.env.local backend/.env

# Xem các file đang được chuẩn bị commit, không in nội dung credentials
git diff --cached --name-only
```

Nếu hai file thực xuất hiện trong danh sách tracked/staged, xử lý trước khi commit. Không dùng `git add -f` để ép thêm chúng và không upload `.env` qua giao diện GitHub. Credentials cũng không được dán vào README, issue, ảnh chụp màn hình hoặc ví dụ trong tài liệu này.

Khi review xong, bạn tự commit/push theo nhánh đang sử dụng. Việc đưa tài liệu lên GitHub không tự chạy SQL migration; vẫn phải thực hiện bước 1 trong đúng Supabase Project. Biến môi trường trên Vercel được điền qua cài đặt project/service, không lấy từ file `.env` local đã bị Git bỏ qua. Chỉ deploy sau khi hoàn tất các bước cấu hình và kiểm tra phù hợp.

## 9. Lỗi thường gặp

- **`supabase_not_configured`**: thiếu URL/key ở backend. Kiểm tra đúng file `backend/.env` hoặc đúng backend service trên Vercel; sau đó khởi động lại.
- **`supabase_unavailable`**: kiểm tra URL đã thay placeholder, project đang hoạt động và máy/server truy cập được Supabase.
- **`authentication_failed` / `invalid_credentials`**: kiểm tra email/password, Publishable key đúng project và hai phía dùng cùng URL/key.
- **`email_confirmation_required` / `email_not_confirmed`**: kiểm tra Confirm email đã tắt đúng project cho MVP. Nếu tài khoản được tạo trước đó đang chưa xác nhận, kiểm tra riêng trạng thái tài khoản trong Authentication.
- **`learning_unavailable`**: kiểm tra đã chạy toàn bộ migration trong đúng project, có đủ bảng/RPC/grants/RLS, và Data API có bật với schema `public`. Đăng nhập thành công chưa bảo đảm schema học tập đã được tạo.
- **`origin_rejected`**: dùng đúng `http://127.0.0.1:3000` qua Next proxy khi local; kiểm tra origin/forwarded host khi Vercel. Giữ `APP_ENV=development` cho local.
- **Frontend báo URL không hợp lệ hoặc cấu hình không khớp**: bỏ placeholder, copy đúng origin HTTPS từ Dashboard và dùng cùng cặp URL/key ở hai file. Khởi động lại hoặc build lại Next.js sau thay đổi.
- **API `/api/auth/session` trả `401` khi chưa đăng nhập**: đây là trạng thái dự kiến. Sau khi đăng nhập thành công, gọi cùng browser có cookie phải nhận đúng user.
- **Health OK nhưng chưa vào được khu học**: tiếp tục kiểm tra Supabase Auth, migration và credentials; health không kết nối Supabase.
- **Migration báo policy/schema cũ không tương thích**: dừng và đối chiếu schema trước khi lập migration bổ sung. Không reset database, xóa dữ liệu hoặc tắt RLS để bỏ qua lỗi.

Tài liệu mô tả cách cấu hình; trạng thái kết nối thực phải được xác minh trên project của người triển khai. Đối với kết quả kiểm thử code và các phần chưa xác minh trên Supabase hosted, xem [báo cáo triển khai](docs/SUPABASE_IMPLEMENTATION.md).
