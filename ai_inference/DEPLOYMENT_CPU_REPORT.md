# SiFormer CPU — xác minh và giới hạn triển khai

Kết quả kiểm tra ngày 10/11/2026 trên bản thử nghiệm của chủ dự án. Bản thử
nghiệm được đưa lên `Thasi16/test_` trước khi chuẩn bị pull request này; PR
hướng tới `vercal` và không tự merge hoặc triển khai thay cho dự án đích.
Không cài Ubuntu/WSL, không dùng GPU, không retrain hay thay checkpoint.

## Nguồn, preprocessing và nhãn

Nhận diện chỉ nạp `Siformer/project/vsl_tf/model.py` và checkpoint mà
`Siformer/run/best.json` chỉ định. Checksum nhị phân, metadata và 12 file source
khớp receipt; khác biệt CRLF/LF chỉ được chuẩn hóa khi kiểm tra văn bản.
`run/labels.json`, labels trong checkpoint và snapshot website khớp toàn bộ
100 nhãn, ID liên tục 0–99. Không dùng thứ tự lớp của giáo trình 400 từ.

Chuyển 75×4 về 54×2, thứ tự tay trái/tay phải/thân, ngưỡng visibility,
mask/padding, y hướng lên, temporal sampling và normalize khớp mã nguồn đã
kiểm tra. Source của QC/sampling/MediaPipe còn khớp hash recipe của demo cũ.
Chỉ dùng các hàm tiền xử lý CPU chia sẻ; không nạp model nhận diện Fusion,
Motion hoặc RGB encoder. API từ chối chế độ GPU.

Đã đối chiếu với adapter SiFormer của demo cũ trên ba video: cùng nhãn dự
đoán, sai khác confidence tối đa 2.99e-7. Điều đó xác minh tái tạo đường chạy,
không chứng minh preprocessing giống từng byte dữ liệu training. Bộ NPZ/cache
training gốc không nằm trong export hiện có, nên chưa thể tái tạo kiểm thử
parity trên một mẫu training đã biết nhãn và feature chuẩn.

## Nhận diện chưa đạt chất lượng

Ba video gốc vẫn sai: Ăn → Cảm ơn, Uống → Băn khoăn, Khóc → Áp dụng.
21 lượt kiểm thử gồm 3 video × 7 biến thể đều được xử lý nhưng không khớp
từ mục tiêu. Đây là phép thử độ nhạy với ba clip, không phải accuracy benchmark.
Toàn bộ dữ liệu đo nằm trong `reports/quality.json`.

- Clip gốc có pose ở 16/16 frame. Tay phải chỉ được phát hiện ở 14/16 frame
  với Ăn, 13/16 với Uống, 8/16 với Khóc; tay trái ở 16/16 với cả ba.
- Lật ngang đổi nhãn dự đoán ở cả ba clip và đổi đặc điểm phát hiện tay.
  Pipeline giữ trái/phải giải phẫu, không tự hoán đổi theo vị trí x trên ảnh.
- Thu nhỏ người ký còn 75% làm Ăn đổi nhãn so với control; tay phải giảm từ
  9 xuống 8 frame với Ăn, từ 13 xuống 12 với Uống. Zoom 125% vẫn nhận sai.
- Xoay ảnh 2D 10° làm Uống và Khóc đổi nhãn; Ăn không đổi nhãn.
  Đây không phải phép đo góc quay 3D hay camera nhìn nghiêng thực tế.
- Giảm độ sáng còn 65% không sửa được ba dự đoán. Việc encode lại control
  cũng làm confidence và số frame thấy tay thay đổi; không quy toàn bộ sai
  khác của các biến thể cho góc/scale vì có nhiễu codec.
- Confidence có thể tăng trên dự đoán sai (Ăn xoay 10° khoảng 94.9%). Không
  diễn giải confidence thành độ chính xác hoặc điểm kỹ năng.

Các biến thể chỉ là đầu vào chẩn đoán; không được đưa thành preprocessing
production hay dùng để chọn lại checkpoint.

## Khác biệt webcam/training cần kiểm chứng tiếp

Giao diện hiện lấy 30 JPEG ở khoảng 13 FPS, cắt vuông giữa (tối đa 480 px)
và áp dụng nút lật như demo; QC lấy 16 frame và resize 224×224. Với cùng một
bộ 30 JPEG tạo từ video mẫu Ăn, adapter demo và API CPU cùng dự đoán Cảm ơn,
độ tin cậy bằng nhau trong phép thử. Đây không phải kiểm thử webcam vật lý.
Mô hình dùng landmark nhập từ archive VSL100; chưa có clip/NPZ chuẩn training
để xác minh phân bố camera, kích thước người, người ký và vùng miền giống
bộ video VSL400 trên website. Độ dài động tác, phần chờ đầu/cuối, crop,
tay bị che và detector tracking trên frame đã sample đều có thể ảnh hưởng.

Chưa thu webcam vật lý hoặc dữ liệu người ký mới. Cần mẫu có nhãn đúng cùng
source training, feature chuẩn và đánh giá riêng trên người ký mới trước
khi kết luận nguyên nhân hoặc cho rằng chất lượng đã cải thiện.

## Bảo mật và kiểm thử

- Backend Vercel chỉ ký capability sau khi xác minh session Supabase và
  same-origin. Chữ ký, issuer/audience/scope/origin/expiry được kiểm tra ở local.
- Token TTL 120 giây, một lần dùng; giới hạn request và xử lý đồng thời.
  Không có token trong URL hoặc `NEXT_PUBLIC_*`.
- File giới hạn 20 MB, 12 giây, 360 frame, 1920×1080 và 256 MiB decode.
  Dừng cả hai worker nếu timeout; xóa thư mục tạm.
- Không lưu tự động video hay kết quả AI vào Supabase. Không đổi schema/RLS.
- Không thay file OAuth hoặc callback/Redirect URLs. Regression kiểm thử
  auth dùng mock; live Google consent/callback cần người dùng kiểm tra.
- Local end-to-end dùng video thật với CPU và identity fixture riêng chỉ
  bind loopback; không đưa fixture đó lên tunnel hay Vercel.
- Browser kiểm tra VI/EN, mobile/desktop, consent, upload, ghi hình tổng hợp,
  nhãn ngoài tập hỗ trợ và lỗi mất kết nối. Lỗi AI không đăng xuất hay chặn
  checklist/bài học. Kiểm thử offline dùng mô phỏng ngắt kết nối trình duyệt.
- Khi backend thiếu biến AI, endpoint ký token trả `503 ai_unavailable`;
  khi chưa đăng nhập trả 401. Việc deploy code không tự cấu hình AI online.

## Cấu hình thủ công và chạy

Vercel backend cần `AI_API_URL` là HTTPS origin của tunnel hiện tại và
`AI_TOKEN_SECRET` trùng giá trị trong file local được Git bỏ qua
`ai_inference/.env`. Không gửi secret vào chat, Git hoặc URL.
Phiên Codex hiện không có plugin/CLI/browser Vercel đăng nhập nên không tự
ghi các biến này. Chủ dự án cấu hình chúng và redeploy sau khi đã kiểm tra.

Local `AI_ALLOWED_ORIGINS` phải chứa chính xác origin Vercel đang mở, không
có dấu `/` cuối và không có wildcard; CSP tự lấy đúng `AI_API_URL` đã xác thực.
Nếu đổi URL Quick Tunnel phải cập nhật `AI_API_URL` trên Vercel. Không đổi
Google Redirect URLs để chữa lỗi AI.

```powershell
python -B -m ai_inference.configure --device cpu --origin https://test-signhearing.vercel.app --origin http://127.0.0.1:3000
powershell -ExecutionPolicy Bypass -File ai_inference/start-local.ps1 -Device cpu
# Terminal khác:
powershell -ExecutionPolicy Bypass -File ai_inference/start-tunnel.ps1
```

`MP_PYTHON` dùng môi trường MediaPipe 0.10.14 riêng như `.env.example`.
Không có TensorFlow/model weights trong deploy backend Vercel; model vẫn ở
đường dẫn local đã cho phép. Xem `README.md` về cài dependencies và test CLI.

## Rollback và điều kiện còn thiếu

Rollback code bằng `git revert <commit-SiFormer>` rồi push bình thường;
không dùng force push/reset main. Các biến môi trường và dữ liệu không được
Git revert khôi phục tự động. Lượt triển khai này không đổi Production env,
OAuth callback hay schema nên không có migration mới phải hoàn tác.

Trước khi coi AI sẵn sàng: cấu hình hai biến backend, kiểm tra user thật
đăng nhập và lấy token, kiểm thử online qua tunnel, thử ngắt laptop/tunnel
trong phiên người dùng thật, và xác minh chất lượng trên dữ liệu có nhãn
chuẩn. Hiện chưa đạt chất lượng và không được báo cáo đã hoàn tất live
authenticated end-to-end khi các bước đó chưa chạy.

## 27 nhãn khớp giáo trình

Danh sách dưới đây là khớp chuỗi nhãn chính xác, không phải xác nhận chuyên
gia về ngữ nghĩa hoặc biến thể ký hiệu.

### 2 - Hành động & Phản hồi giao tiếp cơ bản

- Cho (class 13, `cho`)
- Cảm ơn (class 26, `cam-on`)
- Cần (class 27, `can`)
- Nghe (class 48, `nghe`)
- Nói (class 55, `noi`)
- Xin lỗi (class 86, `xin-loi`)
- Đồng ý (class 98, `dong-y`)

### 8 - Chế biến, Hương vị & Mua sắm

- Uống (class 80, `uong`)
- Ăn (class 92, `an`)

### 10 - Đồ dùng gia đình & Sinh hoạt thường nhật

- Nghỉ ngơi (class 49, `nghi-ngoi`)
- Thức dậy (class 73, `thuc-day`)

### 11 - Trường lớp & Dụng cụ học tập

- Học sinh (class 38, `hoc-sinh`)
- Trường học (class 76, `truong-hoc`)

### 13 - Địa điểm, Quốc gia & Khoảng cách

- Bệnh viện (class 10, `benh-vien`)
- Nhà (class 51, `nha`)
- Xa (class 83, `xa`)

### 14 - Phương tiện & Hoạt động di chuyển

- Chạy (class 17, `chay`)
- Xe máy (class 84, `xe-may`)
- Xe đạp (class 85, `xe-dap`)
- Ô tô (class 91, `o-to`)
- Đi (class 94, `di-2`)

### 16 - Ngoại hình, Sức khỏe & Tính chất vật lý

- Nặng (class 58, `nang-2`)

### 17 - Cảm xúc, Tính cách & Đánh giá

- Ghét (class 31, `ghet`)
- Khóc (class 41, `khoc`)
- Thích (class 69, `thich`)
- Vâng lời (class 82, `vang-loi`)
- Dễ (class 30, `de`)
