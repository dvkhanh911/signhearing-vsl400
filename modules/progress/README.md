# Module `progress` — Tiến độ (`/app/progress`)

Owner: Codex. Status: done.

## Đã triển khai

- Bốn ô số liệu dùng cùng kiểu trình bày với dashboard, đọc trực tiếp `SH.store.summary()`.
- Server render đủ 8 học phần; `data-lessons` chỉ gồm bài đang mở. Học phần chưa mở có nhãn đang biên soạn.
- Tiến độ từng học phần tính bài hoàn thành / bài đang mở; chỉ chiều rộng thanh dùng tỉ lệ, giao diện không quy đổi ra phần trăm.
- Lịch sử 10 lượt tự luyện gần nhất, đúng 5 trường checklist; nhãn mẫu và liên kết từ điển theo ngôn ngữ hiện tại.
- Kết quả kiểm tra theo bài: số lần, điểm cao nhất theo tỉ lệ điểm/tổng câu, điểm và thời gian lần gần nhất. Lượt mới nhất đứng đầu kể cả khi các timestamp bằng nhau.
- Chip ký hiệu đã xem và trạng thái rỗng riêng cho từng khu, có đường dẫn về bài học.
- Lịch hoạt động 30 ngày theo ngày địa phương, nhãn ngày/số hoạt động cho trình đọc màn hình, ô có thể focus bằng bàn phím và chú thích mức hoạt động.
- Tự cập nhật khi nhận `sh:store`, khi quay lại trang hoặc khi trang được hiển thị lại. Không ghi hoặc sửa tiến độ.
- Không JavaScript: giữ khung số liệu “—”, danh sách học phần và hướng dẫn bật JavaScript để đọc dữ liệu trình duyệt.

## Giới hạn dữ liệu

Lịch tính các timestamp `at` trong lượt luyện, kết quả kiểm tra và trạng thái bài học từ API công khai `SH.store.export()`. Kho dữ liệu chỉ giữ mốc trạng thái gần nhất của mỗi bài, nên đây không phải lịch sử đầy đủ mọi lần mở bài. Không cộng timestamp xem ký hiệu để tránh tự bổ sung loại hoạt động ngoài đặc tả.

Ký hiệu hoặc bài học không còn mở vẫn được tính trong tổng lịch sử của store; giao diện không tạo liên kết tới trang đã đóng. Với ký hiệu đã xem không còn mở, hiện số lượng cùng lời giải thích.

Chỉ có thay đổi trong thư mục này. Hai bộ dịch thuộc `modules/progress/locales/`; không cần đổi locale hay API dùng chung.

## Kiểm tra

Từ thư mục gốc dự án:

```text
python -B serve.py --port 8017
python -B verify.py --url http://127.0.0.1:8017
python -B modules/progress/tests/check_render.py
node modules/progress/tests/check_browser.mjs http://127.0.0.1:8017 http://127.0.0.1:9333 --screenshots
```

Browser test dùng Chrome headless và hồ sơ tạm riêng, CDP cổng 9333; không cần thêm thư viện. Các ảnh kiểm tra được tạo ở `.qa/` nếu bật `--screenshots`. Không chạy test có `SH.store.reset()` trên hồ sơ trình duyệt thật.

Đã kiểm tra: 5 test SSR; 92 xác nhận trên Chrome, VI/EN tại 1440 và 1280 px; trạng thái người mới, thêm dữ liệu bằng API store, đối chiếu số liệu, cập nhật sự kiện, reset/reload, giới hạn 10 dòng, điểm cao nhất/lần gần nhất, timestamp trùng, nhãn mẫu, nội dung không còn mở, escape nội dung, bàn phím, giảm chuyển động, không JavaScript và bố cục hẹp. Lịch được thử ở Asia/Bangkok và America/New_York qua ranh giới tháng/giờ mùa hè. Request trình duyệt chỉ GET/HEAD tới site cục bộ.

Không còn hạng mục P0/P1 nào chưa triển khai. Hạn chế lịch sử bài học nêu trên thuộc dữ liệu store hiện có.
