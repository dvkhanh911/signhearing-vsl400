# Hướng dẫn cài đặt AI SiFormer trên Windows

Tài liệu này hướng dẫn kết nối website SignHearing trên Vercel với SiFormer chạy bằng **CPU của máy Windows**. Website và backend đăng nhập vẫn chạy trên Vercel; Google OAuth và Supabase dùng cấu hình riêng trong [GOOGLE_OAUTH_SETUP.md](GOOGLE_OAUTH_SETUP.md) và [SUPABASE_SETUP.md](SUPABASE_SETUP.md).

Luồng hoạt động: **website → backend Vercel cấp token → Cloudflare Tunnel → API SiFormer trên máy Windows**. Máy chạy AI phải được bật, có mạng và giữ API cùng Tunnel hoạt động. Website vẫn mở được khi AI ngoại tuyến.

> **Giới hạn chất lượng:** ba video mẫu đã kiểm tra đều nhận diện sai. Kết quả chỉ là dự đoán, chưa phải đánh giá kỹ năng đáng tin cậy. SiFormer có 100 nhãn, trong đó 27 tên khớp với giáo trình 400 từ.

## 1. Chuẩn bị

- Windows, Python 3.12 và Cloudflare `cloudflared` có trong PATH. Không cần Ubuntu, WSL hoặc GPU.
- Thư mục model gốc phải tồn tại tại `C:\Users\Admin\Desktop\demo\Vietnamese-Sign-Language\Siformer`, gồm `project` và `run` cùng checkpoint theo `run/best.json`. Không đưa checkpoint lên Git.
- Máy cần được cài thư viện inference. TensorFlow và MediaPipe phải nằm trong **hai môi trường Python riêng** vì khác phiên bản phụ thuộc.
- Cần quyền quản lý biến môi trường backend trên Vercel. Không thay đổi OAuth Redirect URLs hoặc Supabase schema để thiết lập AI.

Mở PowerShell tại thư mục gốc bản code có `ai_inference`. Ví dụ trên máy đã kiểm tra:

```powershell
cd C:\Users\Admin\Desktop\final_demo\signhearing-vsl400\.runtime\siformer-cpu-preview
```

Nếu dùng một bản clone khác, thay đường dẫn `cd` bằng thư mục gốc của bản clone đó. Các lệnh dưới đây đều chạy từ gốc repository.

## 2. Cài thư viện lần đầu trên máy mới

Chạy các lệnh sau để tạo môi trường TensorFlow CPU và môi trường MediaPipe:

```powershell
python -m venv ai_inference\.venv
.\ai_inference\.venv\Scripts\python.exe -m pip install -r ai_inference\requirements.txt

python -m venv ai_inference\.venv-mp
.\ai_inference\.venv-mp\Scripts\python.exe -m pip install -r ai_inference\requirements-landmark.txt
```

Máy hiện tại đã có môi trường MediaPipe tại `C:\Users\Admin\Desktop\demo\Vietnamese-Sign-Language\.venv-mp\Scripts\python.exe`; có thể dùng môi trường này thay cho `.venv-mp` mới. Các script bên dưới cho phép chỉ rõ đường dẫn Python.

## 3. Cấu hình AI lần đầu

Nếu **chưa có** cấu hình AI local, chạy lệnh dưới đây. Thay origin website bằng domain HTTPS thực tế nếu khác ví dụ. Không thêm dấu `/` ở cuối origin.

```powershell
.\ai_inference\.venv\Scripts\python.exe -B -m ai_inference.configure --device cpu --origin https://test-signhearing.vercel.app --origin http://127.0.0.1:3000 --mp-python .\ai_inference\.venv-mp\Scripts\python.exe
```

Lệnh tạo/cập nhật các biến AI trong `ai_inference/.env` và `backend/.env`, giữ lại các biến OAuth/Supabase khác. Nó dùng lại `AI_TOKEN_SECRET` nếu đã có trong `ai_inference/.env`, hoặc tạo secret mới nếu chưa có. Nếu secret đổi, **phải cập nhật secret tương ứng ở backend Vercel**. Không cần chạy lại lệnh này mỗi lần mở máy.

Trong `ai_inference/.env`, các biến chính là:

```dotenv
AI_DEVICE=cpu
SIFORMER_MODEL_ROOT=C:/Users/Admin/Desktop/demo/Vietnamese-Sign-Language/Siformer
MP_PYTHON=C:/duong-dan-toi-moi-truong-mediapipe/Scripts/python.exe
AI_ALLOWED_ORIGINS=["https://test-signhearing.vercel.app","http://127.0.0.1:3000"]
AI_TOKEN_SECRET=<secret-rieng-cua-ban>
```

Giá trị trên chỉ là ví dụ; `MP_PYTHON` phải trỏ đúng file Python thật. `AI_ALLOWED_ORIGINS` là danh sách origin website chính xác, không dùng `*`. Tệp `.env` là riêng tư và được Git bỏ qua: **không commit, gửi lên chat, chụp ảnh hoặc đặt secret vào `NEXT_PUBLIC_*`**.

## 4. Chạy API CPU

Mở PowerShell thứ nhất tại gốc repository:

```powershell
powershell -ExecutionPolicy Bypass -File ai_inference/start-local.ps1 -Device cpu -Python .\ai_inference\.venv\Scripts\python.exe
```

Trên máy hiện tại, nếu Python mặc định đã cài đúng TensorFlow và các phụ thuộc, cũng có thể chạy:

```powershell
powershell -ExecutionPolicy Bypass -File ai_inference/start-local.ps1 -Device cpu
```

Giữ cửa sổ này mở. Ở PowerShell khác, kiểm tra:

```powershell
Invoke-RestMethod http://127.0.0.1:8018/ready
```

Kết quả mong đợi có `ready : True` và `device : CPU`. Nếu cổng 8018 đã có API SiFormer đang chạy, kiểm tra `/ready` trước khi mở thêm tiến trình để tránh xung đột cổng.

## 5. Mở Cloudflare Quick Tunnel

Sau khi API sẵn sàng, mở PowerShell thứ hai tại gốc repository:

```powershell
powershell -ExecutionPolicy Bypass -File ai_inference/start-tunnel.ps1
```

Giữ cửa sổ mở. Cloudflare sẽ in một URL dạng `https://ten-ngau-nhien.trycloudflare.com`. Đây là URL tạm: khi tạo lại Quick Tunnel, URL thường đổi; phải cập nhật `AI_API_URL` trên Vercel và redeploy. [Tài liệu Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).

## 6. Cấu hình backend Vercel

Trong dự án Vercel, mở **Settings → Environment Variables** và thêm vào **backend** cho môi trường cần dùng, chẳng hạn Production:

| Biến | Giá trị |
| --- | --- |
| `AI_API_URL` | Origin HTTPS của Tunnel, ví dụ `https://ten-ngau-nhien.trycloudflare.com`; không thêm `/infer` hay dấu `/` cuối. |
| `AI_TOKEN_SECRET` | Chính xác giá trị `AI_TOKEN_SECRET` trong `ai_inference/.env` trên máy chạy AI. |

Mở file local để sao chép secret trực tiếp vào Vercel, không gửi secret qua chat:

```powershell
notepad ai_inference\.env
```

Redeploy deployment phù hợp sau khi thêm hoặc sửa biến để backend nạp cấu hình mới. Các biến AI là **server-side**; không thêm tiền tố `NEXT_PUBLIC_`. Origin của website thực tế phải nằm trong `AI_ALLOWED_ORIGINS` local; sau khi sửa file local, khởi động lại API CPU. CSP của trang luyện dùng origin `AI_API_URL` do backend cung cấp.

## 7. Tunnel có địa chỉ cố định

Để không phải đổi `AI_API_URL` khi mở lại Quick Tunnel, có thể dùng **Cloudflare Tunnel có tên** với tài khoản Cloudflare và tên miền bạn quản lý trên Cloudflare, ví dụ `ai.tenmiencuaban.com`. Tạo tunnel trong Cloudflare, gắn hostname tới `http://localhost:8018` và chạy `cloudflared` theo hướng dẫn của Cloudflare. Sau đó đặt origin HTTPS cố định vào `AI_API_URL` một lần và redeploy. Xem [thiết lập Cloudflare Tunnel](https://developers.cloudflare.com/tunnel/get-started/).

Tunnel cố định không thay thế API CPU: máy và hai tiến trình vẫn phải hoạt động. Không tự chia sẻ tunnel token hoặc credential file. Các lệnh `start-tunnel.ps1` ở trên tạo **Quick Tunnel**, không tự chuyển thành tunnel cố định.

## 8. Kiểm tra trên website

1. Xác nhận `/ready` trả CPU sẵn sàng và Tunnel còn kết nối.
2. Đăng nhập website bằng tài khoản thật, mở phần tự luyện và chọn từ có hỗ trợ SiFormer.
3. Bật camera; bấm **Ghi hình**, chuẩn bị theo đếm ngược 3–2–1 và thực hiện ký hiệu trong khung vuông. Website lấy 30 ảnh khoảng 13 FPS, gửi cho API rồi hiện dự đoán dưới camera.
4. Kiểm tra thông báo và kết quả. Dữ liệu ảnh được xử lý tạm thời, không tự lưu vào tài khoản. Khi API/Tunnel tắt, phần nhận diện không khả dụng nhưng có thể tiếp tục tự luyện.

## 9. Lỗi thường gặp

- **`ready: false` hoặc không truy cập được cổng 8018:** kiểm tra API còn chạy, đường dẫn checkpoint, `MP_PYTHON`, các môi trường Python và nhật ký PowerShell.
- **Website báo AI không khả dụng:** kiểm tra Tunnel, `AI_API_URL`, hai secret phải khớp và đã redeploy Vercel sau khi cập nhật biến.
- **Lỗi CORS hoặc yêu cầu bị từ chối:** origin website phải khớp chính xác một mục trong `AI_ALLOWED_ORIGINS`; restart API sau khi sửa. Không dùng wildcard.
- **Không mở được camera:** cho phép quyền camera trong trình duyệt, đóng ứng dụng khác đang dùng camera và mở website qua HTTPS.
- **Không hỗ trợ từ:** website chỉ bật AI cho những nhãn SiFormer tương thích; vẫn có thể dùng phần tự đánh giá.
- **AI trả nhãn sai:** kiểm tra ánh sáng, góc quay và người/tay trong khung vuông; đây không bảo đảm dự đoán đúng. Xem [báo cáo kiểm thử và giới hạn](ai_inference/DEPLOYMENT_CPU_REPORT.md).

Thông tin kỹ thuật, model provenance và các lệnh chẩn đoán khác: [ai_inference/README.md](ai_inference/README.md).
