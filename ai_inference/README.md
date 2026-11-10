# SignHearing — một SiFormer chạy CPU trên Windows

Đã tích hợp vào dự án hiện tại. Chế độ CPU được chọn theo yêu cầu ngày
10/11/2026; không cần Ubuntu hay CUDA. Website, đăng nhập và dữ liệu tiếp tục
thuộc backend/Next.js trên Vercel. Máy cá nhân chỉ nhận diện video.

## Mô hình đã xác minh

- Nguồn nhận diện duy nhất:
  `C:/Users/Admin/Desktop/demo/Vietnamese-Sign-Language/Siformer`.
- Kiến trúc thực tế: `project/vsl_tf/model.py::SiformerVSL`, bản thích nghi
  TensorFlow của SiFormer. Ba encoder cô lập tay trái, tay phải và thân,
  mỗi encoder 3 tầng ProbSparse; chiều 42/42/24, số head 3/3/2.
  Hai decoder cross-attention, chiều 108, 9 head; class query và head 100 lớp.
  Static inference, patience 0, không rectification, không ensemble.
- Checkpoint chính thức: `run/best.json` → `run/epoch_0047.json` →
  `run/epoch_0047.ckpt-48.index` và `.data-00000-of-00001`.
  Metadata chỉ rõ epoch 47, `smoke=false`, TensorFlow **2.20.0**.
- Loader kiểm tra SHA256 của checkpoint nhị phân, metadata, source và nhãn;
  restore phải đạt `assert_existing_objects_matched()`. Chỉ bỏ optimizer và
  biến đếm huấn luyện. Không đổi kiến trúc, không train lại, không sửa nguồn gốc.
- Export Windows đổi LF thành CRLF ở các file văn bản. Khi chuẩn hóa duy nhất
  CRLF → LF, toàn bộ 12 checksum source và metadata khớp receipt huấn luyện.
  Checksum file checkpoint nhị phân được so sánh nguyên byte.
- Đầu vào float32 **(1,16,54,2)**; đầu ra logits **(1,100)**, softmax để
  lấy dự đoán và confidence. Confidence chưa được hiệu chỉnh xác suất.
- Nhãn lấy từ `run/labels.json`, cũng khớp labels trong checkpoint metadata.
  Bản snapshot dùng cho website: `data/siformer-labels.json`.
  Mô hình có **100 lớp**, trong đó **27 từ** khớp chính xác giáo trình 400 từ.
  Những từ khác hiển thị trạng thái chưa hỗ trợ; không suy đoán nhãn từ slug.

## Tiền xử lý thực sự của bản demo cũ

Sau khi được cho phép kiểm tra thư mục `Vietnamese-Sign-Language`, đã xác định
`space/siformer.py` dùng pipeline landmark chia sẻ nằm dưới
`space/models/fusion/source/fusion_vsl`. Đây là **tiền xử lý CPU**, không phải
model Fusion nhận diện. Chỉ các hàm QC, sampling, MediaPipe và validation được
tách vào `ai_inference/landmarks`; provenance và các thay đổi import được ghi
trong `landmarks/provenance.json`. Không copy hoặc nạp model Fusion, Motion,
Landmark09, MobileNet, RGB encoder hay checkpoint nhận diện thứ hai.

Luồng xử lý:

1. Giải mã RGB theo thứ tự, kiểm tra số frame; bỏ frame gần phẳng theo QC gốc.
2. Chọn 16 frame bằng linspace/floor trên các frame QC hợp lệ. Clip ngắn dùng
   repeat-last padding và giữ mask riêng. Resize bilinear trực tiếp 224×224.
3. MediaPipe **0.10.14** Holistic Pose/Hands trên CPU, graph đã bỏ face.
   Kiểm tra hash graph và bốn asset detector theo receipt. Reset tracker mỗi
   video, chỉ xử lý frame thật; copy landmark cho padding.
4. Chuyển 75×4 về 54×2 đúng `Siformer/project/scripts/import_landmark_cache.py`:
   21 tay trái, 21 tay phải, 12 thân/mặt; ngưỡng pose visibility 0.5;
   cổ là midpoint vai; y hướng lên; padding/mất điểm có mask riêng.
5. Gọi trực tiếp `vsl.augmentation.temporal_sample` và `vsl.adapter.normalize`
   từ nguồn SiFormer được chỉ định. Missing point sau normalize bằng -0.5.
   Reset RNG ProbSparse về seed 396 trước mỗi request, `training=False`.

TensorFlow/protobuf mới và MediaPipe/protobuf 4 dùng **hai môi trường Python**.
MediaPipe không phải mô hình nhận diện ký hiệu thứ hai. Một worker TensorFlow
nạp SiFormer duy nhất lúc startup và tái sử dụng cho các request tiếp theo.

## Chạy ngay trên máy hiện tại

Chạy từ thư mục gốc bản checkout chứa `ai_inference`.
Python 3.12 hiện có trên máy đã chạy được TensorFlow 2.20.0. Môi trường
MediaPipe sẵn có là `../demo/.../.venv-mp` theo đường dẫn tuyệt đối dưới đây.

```powershell
python -B -m ai_inference.configure --device cpu --origin http://127.0.0.1:3000 --origin https://test-signhearing.vercel.app
powershell -ExecutionPolicy Bypass -File ai_inference/start-local.ps1 -Device cpu
```

`configure` chỉ tạo/cập nhật biến AI trong các file `.env` được Git bỏ qua,
giữ nguyên mọi biến OAuth/Supabase khác. Secret ngẫu nhiên không được in ra.
Sau khi đổi cấu hình, khởi động lại backend hiện tại để nạp biến mới.
Không dùng `backend/tests/materials_preview.py` làm server thật: đó là fixture
kiểm thử có identity giả, chỉ dành cho loopback QA.

Ở terminal khác:

```powershell
Invoke-RestMethod http://127.0.0.1:8018/health
Invoke-RestMethod http://127.0.0.1:8018/ready
python -B -m ai_inference.verify_http --video static/media/local-videos/an.mp4 --origin http://127.0.0.1:3000
```

`/ready` phải trả `ready=true, device=CPU`. `verify_http` là chẩn đoán cho chủ
máy có signing key; người dùng website phải lấy token qua session hiện tại.

## Cài trên môi trường Python mới

Không cài MediaPipe chung vào venv TensorFlow:

```powershell
python -m venv ai_inference/.venv
ai_inference/.venv/Scripts/python.exe -m pip install -r ai_inference/requirements.txt
python -m venv ai_inference/.venv-mp
ai_inference/.venv-mp/Scripts/python.exe -m pip install -r ai_inference/requirements-landmark.txt
ai_inference/.venv/Scripts/python.exe -B -m ai_inference.configure --device cpu --origin http://127.0.0.1:3000 --mp-python ai_inference/.venv-mp/Scripts/python.exe
powershell -ExecutionPolicy Bypass -File ai_inference/start-local.ps1 -Device cpu -Python ai_inference/.venv/Scripts/python.exe
```

Trên máy này có thể dùng môi trường MediaPipe đã chạy được:
`C:/Users/Admin/Desktop/demo/Vietnamese-Sign-Language/.venv-mp/Scripts/python.exe`.
Không cần thư viện hoặc trọng số từ các mô hình nhận diện khác của bản demo.

## Kết nối Vercel qua Cloudflare Tunnel

Chỉ mở tunnel sau khi `/ready` đạt:

```powershell
powershell -ExecutionPolicy Bypass -File ai_inference/start-tunnel.ps1
```

Cloudflare in URL HTTPS tạm thời, ví dụ `https://...trycloudflare.com`.
Trong **backend Vercel**, cấu hình hai biến server-side:

- `AI_API_URL`: origin HTTPS của tunnel, không có `/infer` hay dấu `/` cuối.
- `AI_TOKEN_SECRET`: chính xác cùng giá trị trong `ai_inference/.env`.

Giữ origin website thật trong `AI_ALLOWED_ORIGINS` ở máy local. Nếu đổi domain
website, cập nhật danh sách này rồi restart inference. Nếu Quick Tunnel đổi
URL, cập nhật `AI_API_URL` trên Vercel và redeploy backend sau khi được duyệt.
Không đưa secret vào `NEXT_PUBLIC_*`, Git, ảnh chụp hay URL.

Không cần sửa `NEXT_PUBLIC_AI_API_URL`: backend cung cấp URL trong response
token, nên endpoint có thể đổi độc lập khỏi bundle frontend. CSP của trang
tự luyện chỉ thêm đúng origin cấu hình. `vercel.json` và các rewrite `/api/*`
được giữ nguyên; không redirect OAuth callback qua tunnel.

## API và bảo vệ

- Backend hiện tại: `POST /api/ai/token`, JSON `{"slug":"an"}`.
  Kiểm tra same-origin, session Supabase đã xác minh, từ mục tiêu thuộc 100 nhãn;
  sau đó ký capability `v1` bằng HMAC-SHA256, TTL 120 giây.
- Local: `POST /infer`, giao diện gửi JSON gồm 30 JPEG, hoặc công cụ chẩn đoán
  gửi byte MP4/WebM; cần `Authorization: Bearer ...` và `Origin` được cho phép.
  File không đi qua Vercel serverless.
- Kiểm tra signature constant-time, issuer, audience, scope `infer`, thời hạn,
  origin và subject. Token dùng một lần; khoảng cách request cùng user 3 giây.
- Tối đa 20 MB; 12 giây; 360 frame; 1920×1080; tổng mảng decode 256 MiB.
  Video độ phân giải cao có thể chạm giới hạn decode trước 12 giây: dùng clip
  ngắn 2–3 giây. Khung JPEG webcam phải vuông, tối đa 480×480, đúng 30 ảnh.
- Một request tại một thời điểm. Upload timeout 15 giây, xử lý timeout 45 giây.
  Timeout xử lý dừng cả worker landmark và model; restart service để phục hồi.
- Thư mục tạm được xóa khi xong/lỗi. Không tự lưu video hoặc dự đoán vào
  Supabase; checklist tự đánh giá tiếp tục dùng API/lịch sử hiện có.
- Không phục vụ folder, checkpoint hoặc đường dẫn local qua HTTP. Lỗi API
  chỉ trả mã đã cho phép. `/health` kiểm tra tiến trình; `/ready` kiểm tra workers.

UI nằm trong module tự luyện hiện có, được frontend Next.js/Vercel route tới
FastAPI. Nút Ghi hình đếm ngược ba giây, lấy 30 ảnh ở 13 FPS, cắt vuông
giữa và gửi để nhận diện. Mặc định ảnh giữ chiều camera; nút lật cũng lật ảnh
gửi đi như demo. Thông báo cạnh nút nêu rõ việc gửi và cách xử lý tạm thời.

## Kết quả xác minh ngày 10/11/2026

Đã chạy inference thật trên CPU, không tạo trọng số hoặc prediction giả.
Một lần khởi tạo đo được 8.93 giây. Ba request API sau khi nạp model:

- Video **Ăn** → **Cảm ơn**, confidence 64.54%; preprocessing 1311.89 ms,
  model 148.86 ms, toàn request 1485.99 ms.
- Video **Uống** → **Băn khoăn**, confidence 57.81%; preprocessing 1396.97 ms,
  model 201.60 ms, toàn request 1622.81 ms.
- Video **Khóc** → **Áp dụng**, confidence 79.50%; preprocessing 1466.19 ms,
  model 175.71 ms, toàn request 1666.48 ms.

**Cả ba dự đoán không khớp từ mục tiêu.** Đã chạy lại chính adapter
`space/siformer.py` và pipeline landmark của bản demo cũ, nhưng vẫn dùng duy
nhất source/checkpoint tại `Siformer/`: cả ba nhãn dự đoán khớp bản tích hợp,
chênh lệch confidence tối đa 2.99e-7. Đây là bằng chứng đường tích hợp tái tạo
kết quả bản cũ trên các video này; không phải bằng chứng độ chính xác tốt.
Không chỉnh lớp, retrain hoặc thay model để che giấu lỗi nhận diện.

NVIDIA RTX 4050 được hệ điều hành nhận diện. Cả TensorFlow Windows hiện tại
2.20 và TensorFlow 2.21 trong venv demo cũ đều báo không có GPU. Chế độ CPU
đã được yêu cầu rõ ràng. Không có benchmark GPU hoặc VRAM TensorFlow để báo cáo.

Đã kiểm tra **120 test backend**, **9 test API/provenance**, **7 test render
tự luyện**, **12 test frontend unit/deployment**; một test database được skip
vì không có PostgreSQL kiểm thử. Đã kiểm tra token/CORS/timeout/replay/cleanup, checksum nguồn và
checkpoint, build Next.js, frontend unit/deployment và browser VI/EN ở
390/1440 px. Phiên bản trước được kiểm tra gửi video thật tới API CPU; phiên bản
nút Ghi hình mới được kiểm thử với camera tổng hợp và API nhận diện giả lập.
Camera vật lý và đăng nhập Google trực tiếp chưa được kiểm thử; OAuth callback
và schema/RLS Supabase không đổi, các test auth dùng mock upstream hiện có.

Quick Tunnel đã được mở và một request HTTPS có token/origin hợp lệ đã trả
prediction CPU thật. Không có token trong query string. URL tạm thời được ghi
trong `.runtime/ai-demo-status.json`, không cố định trong source. Việc này
không có nghĩa frontend Vercel đã được cập nhật hoặc Google OAuth live đã được thử.

## Kiểm thử lại

```powershell
# Môi trường QA đã có trên máy hiện tại:
.runtime/loading-qa-venv/Scripts/python.exe -m pytest ai_inference/tests -q
Set-Location backend
../.runtime/loading-qa-venv/Scripts/python.exe -m pytest -q
Set-Location ..
python -B modules/practice/tests/check_render.py
npm --prefix frontend test
npm --prefix frontend run test:deployment
npm --prefix frontend run build
```

Trên máy mới, dùng venv backend đã cài dependencies/dev dependencies theo
`backend/pyproject.toml`; pytest backend chạy từ `backend/`. Bài kiểm thử browser cần Playwright và hai server riêng:
fixture backend loopback, inference CPU thật. Cấu hình `AI_TEST_URL` và
`PLAYWRIGHT_MODULE` nếu dùng installation ngoài `frontend/node_modules`.
Fixture chỉ được bind `127.0.0.1`, không được đưa lên tunnel.

## Checklist trước buổi trình diễn

- Laptop cắm nguồn, CPU inference `/ready` đạt, đúng checkpoint đã nạp.
- Tunnel còn kết nối; `AI_API_URL`, signing key và CORS khớp.
- Website Vercel truy cập được; kiểm tra Google login và Supabase bằng tài khoản thật.
- Chọn từ được hỗ trợ, bật camera, chọn Ghi hình và kiểm tra dự đoán hiển thị.
- Đánh giá chất lượng nhận diện bằng video/người ký phù hợp trước khi dùng
  làm minh họa nhận diện đúng. Ba video kiểm tra hiện tại đều nhận sai.
- Ngắt AI thử một lần: bài học, đăng nhập và checklist vẫn dùng được.

Chủ dự án đã cho phép đẩy lên main/Production sau yêu cầu Preview ban đầu.
Bản này chỉ chấp nhận CPU; không có lựa chọn GPU hoặc thiết lập WSL.
Xem [báo cáo triển khai và chất lượng](DEPLOYMENT_CPU_REPORT.md), gồm 27 nhãn
khớp giáo trình và những kiểm thử live còn cần cấu hình thủ công.
