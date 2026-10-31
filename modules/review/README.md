# Module `review` — Ôn tập & kiểm tra (`/app/review`, `/app/review/quiz/{id}`)

**Độ khó:** vừa · **Phụ thuộc:** shell. Đây là module **đặt trạng thái hoàn thành bài**.

## File của bạn
`page.html` (flashcard), `quiz.html` (kiểm tra), `view.py` (đã kiểm tra bài mở và có ≥ 2 ký hiệu), `style.css`, `script.js`, `locales/*.json` (key `review.*`).

## Chức năng
**P0 — Flashcard `/app/review`**
- Chọn nguồn thẻ: ký hiệu đã xem (`SH.store.isSignSeen`) · yêu thích · theo bài.
- Thẻ lật: mặt trước video (hoặc placeholder + từ), mặt sau nghĩa. Space = lật, ← → = chuyển, nút “Nhớ rồi / Chưa nhớ” (lưu trong phiên).
- Danh sách bài có thể kiểm tra, link tới quiz.

**P0 — Quiz `/app/review/quiz/{id}`**
- Sinh câu hỏi nhận biết từ ký hiệu của bài: khi có video “Video này là ký hiệu nào?”, khi chưa có video dùng dạng chữ “Từ nào có nghĩa: …?”. 4 lựa chọn (hoặc ít hơn nếu bài ít ký hiệu), đáp án lấy từ dữ liệu, không tự bịa.
- Phản hồi sau mỗi câu, điểm cuối, thử lại.
- Lưu `SH.store.addQuizResult(id, score, total)`; nếu `score/total >= 0.8` → `SH.store.setLessonState(id, 'completed')` (quy tắc PRD).

**P1**: xáo trộn ổn định theo lượt, xem lại câu sai.

## Xong khi
Đạt ≥ 80% thì Lộ trình hiện “Hoàn thành”; < 80% không đổi; VI/EN đủ; `python verify.py` đạt.

## Triển khai

- Server render các bài đủ điều kiện, bộ chọn bài và nội dung đọc của quiz khi không JavaScript. Tham số bài sai, bài chưa mở hoặc có ít hơn hai ký hiệu trả 404.
- Nguồn flashcard: đã xem, yêu thích, theo bài. Bộ video người dùng nhập có thể ôn qua nguồn yêu thích. Video không phát hoặc chưa có chuyển sang thẻ từ/nghĩa; không tự viết hướng dẫn ký hiệu.
- Lật bằng nút, Space/Enter; mũi tên trái/phải chuyển thẻ. Mặt không hoạt động bị loại khỏi tương tác và cây truy cập. Chế độ giảm chuyển động bỏ lật 3D.
- “Chưa nhớ” chuyển thẻ xuống cuối hàng, không tạo bản sao. “Nhớ rồi” loại thẻ khỏi hàng còn lại. Tiến độ là số thẻ tự đánh dấu nhớ / số thẻ của nguồn khi bắt đầu; không ghi vào store.
- Quiz xáo trộn câu và đáp án một lần cho mỗi lượt. Lựa chọn ưu tiên từ cùng bài rồi từ mở khác; loại trùng theo từ hiển thị, kể cả khác hoa/thường hoặc khoảng trắng. Câu chữ không dùng phương án nhiễu có nghĩa giống hệt câu hỏi.
- Sau khi chọn, các đáp án khóa lại; phản hồi có chữ và biểu tượng, đáp án đúng được chỉ rõ. Phím 1–4 chọn đáp án, Tab/Enter dùng các nút.
- Chỉ mở màn kết quả mới gọi `addQuizResult`, một lần cho mỗi lượt. Tỉ lệ đúng từ 80% đặt `completed`; thấp hơn không ghi trạng thái bài, kể cả khi bài đã hoàn thành từ trước. Tải lại hoặc bỏ dở không lưu lượt chưa xong.
- Điểm cao nhất lấy từ kết quả thật. Từ trả lời sai có liên kết ôn lại. Reset store cập nhật điểm và bắt đầu lại lượt hiện tại; không đánh dấu đã xem hay ghi lượt tự luyện.
- Video chỉ từ cùng site, luôn tắt âm thanh; dừng khi lật, chuyển thẻ/câu, ẩn hoặc rời trang.

## Kiểm tra

Từ thư mục gốc dự án:

```powershell
python -B serve.py --port 8014
python -B verify.py --url http://127.0.0.1:8014
python -B modules/review/tests/check_render.py
```

Kiểm tra trình duyệt dùng Chrome headless với hồ sơ riêng trong module và remote debugging cổng 9333, không cần cài thư viện:

```powershell
node modules/review/tests/check_browser.mjs http://127.0.0.1:8014 http://127.0.0.1:9333
```

Thêm `--screenshots` để lưu ảnh kiểm tra vào `modules/review/.qa/`. Kiểm tra bao gồm bài 1/2, VI/EN, 1440/1280 px, người mới, bộ nguồn, hàng ôn lại, video thật trong nguồn yêu thích, không lưu trạng thái flashcard, khóa đáp án, lựa chọn ổn định/không trùng, điểm cao nhất, lưu đúng một lần, ngưỡng đúng 80% với fixture năm câu, dưới 80%, không hạ completed, cập nhật lộ trình, bỏ dở/tải lại, reset, nội dung không JavaScript, cửa sổ hẹp, giảm chuyển động, escape dữ liệu và 404.

Fixture dùng trong trình duyệt không sửa dữ liệu giáo trình: kiểm tra nhánh quiz video và chuỗi không tin cậy bằng dữ liệu trong bộ nhớ. Các bài hiện có chưa được gán video; nội dung mẫu và video do người dùng cung cấp vẫn chờ chuyên gia duyệt.
