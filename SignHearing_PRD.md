# SIGNHEARING — PRODUCT REQUIREMENTS DOCUMENT

**Sản phẩm:** AI-Powered Vietnamese Sign Language Learning Platform  
**Phiên bản:** 1.2 — Bản dự thảo triển khai, bổ sung khung giáo trình VSL 400  
**Ngày:** 28/10/2026  
**Phạm vi:** Website công khai, ứng dụng web cho người học, trang quản trị và dịch vụ AI.  
**Kế hoạch dự án:** 02/11/2026–30/04/2027; 6 thành viên; ngân sách tối đa 88.440.000 VNĐ, gồm dự phòng.

## 1. Mục đích và cách sử dụng

PRD xác định website SignHearing cần phục vụ ai, giải quyết vấn đề nào, gồm những chức năng gì và được nghiệm thu ra sao. Tài liệu là đầu vào cho thiết kế UI/UX, backlog phát triển, tích hợp AI, kiểm thử và bàn giao vận hành.

Thông tin nền được tổng hợp từ ngữ cảnh dự án đã trao đổi, bao gồm nội dung được truy xuất từ Project Charter, báo cáo DAT301m và RACI/Risk Register. Đây không phải bản chép nguyên văn hoặc bản đã được nhóm phê duyệt. Các chi tiết về giao diện, route, API, chính sách lưu giữ và chỉ tiêu kỹ thuật bên dưới là **đề xuất triển khai**, cần được ghi nhận khi chốt baseline.

**Quy ước ưu tiên:** P0 = bắt buộc để phát hành MVP; P1 = triển khai sau khi P0 ổn định và còn nguồn lực; P2 = hướng mở rộng sau MVP. Phạm vi toàn sản phẩm được mô tả đầy đủ nhưng không đưa toàn bộ vào kỳ phát hành đầu.

## 2. Tổng quan sản phẩm

SignHearing là nền tảng web hỗ trợ người nghe học Ngôn ngữ ký hiệu Việt Nam (VSL), đặc biệt người mới bắt đầu. Người học xem video mẫu đã được rà soát chuyên môn, thực hiện ký hiệu trước camera hoặc tải video phù hợp, nhận phản hồi giới hạn từ AI và theo dõi tiến độ.

Vòng lặp giá trị cốt lõi: **Xem mẫu → Thực hiện → Nhận phản hồi → So sánh → Điều chỉnh → Thử lại.**

Sản phẩm không thay thế giáo viên hoặc phiên dịch viên. AI MVP nhận diện từng ký hiệu độc lập trong danh sách hỗ trợ; kết quả nhận diện không chứng minh động tác hoàn toàn chính xác về ngôn ngữ.

### 2.1 Vấn đề cần giải quyết

- Người mới thiếu lộ trình và nguồn học VSL đáng tin cậy, được tổ chức theo chủ đề.
- Khi tự xem video, người học khó biết động tác của mình có phù hợp với ký hiệu mục tiêu hay không.
- Thiếu phản hồi nhanh, công cụ so sánh và môi trường luyện tập độc lập.
- Người học khó duy trì thói quen và không nhìn thấy tiến bộ rõ ràng.
- Lo ngại AI đánh giá sai và việc camera/video bị lưu hoặc sử dụng ngoài mong muốn.

### 2.2 Người dùng mục tiêu

| Nhóm | Nhu cầu chính | Giá trị sản phẩm |
|---|---|---|
| Học sinh, sinh viên và người trẻ mới học | Bắt đầu nhanh, học từng bước | Bài học ngắn, chủ đề gần gũi, luyện trực tiếp |
| Người thân của người Điếc/khiếm thính | Học từ vựng giao tiếp cơ bản | Video rõ ràng, luyện lại và ôn tập |
| Người nghe quan tâm tới VSL | Tự học linh hoạt | Thư viện, tìm kiếm, tiến độ cá nhân |
| Biên tập viên/chuyên gia VSL | Bảo đảm học liệu chính xác | Quy trình duyệt nội dung và quản lý phiên bản |
| Quản trị viên | Duy trì website và xử lý sự cố | Quản lý tài khoản, yêu cầu hỗ trợ, tình trạng AI |

Khảo sát trước đó có 77 phản hồi, chủ yếu người trẻ và học sinh/sinh viên; dùng làm tín hiệu định hướng, không suy rộng thành đại diện toàn thị trường.

## 3. Mục tiêu và thước đo

| Mã | Mục tiêu phát hành | Cách đo và điều kiện |
|---|---|---|
| G01 | Ít nhất 50 ký hiệu có học liệu | Đếm tối thiểu 50 ký hiệu có video, nghĩa, hướng dẫn, nguồn/quyền sử dụng, đã duyệt và xuất bản; mục chỉ có tên trong giáo trình không được tính |
| G02 | AI hỗ trợ ít nhất 30 ký hiệu mục tiêu | Công bố danh sách hỗ trợ; có kết quả kiểm thử theo lớp trước phát hành |
| G03 | Accuracy nhận diện mục tiêu ≥80% | Đo trên test set giữ riêng, không dùng để chọn mô hình/ngưỡng; báo cáo thêm macro-F1, precision/recall và confusion matrix |
| G04 | Phản hồi AI mục tiêu ≤5 giây | Đề xuất đo p95 từ lúc máy chủ nhận đủ clip hợp lệ tới khi trả kết quả, ở tải 5 job đồng thời và cấu hình triển khai đã ghi nhận; thời gian tải lên đo riêng |
| G05 | Người mới hoàn thành được vòng học | Đề xuất ≥80% trong tối thiểu 10 người thử hoàn thành xem bài → quay → nhận kết quả → thử lại mà không cần hướng dẫn trực tiếp |
| G06 | Không mất tiến độ hoặc lộ dữ liệu giữa tài khoản | Kiểm thử lưu tiến độ, phân quyền, truy cập chéo và xóa dữ liệu đạt toàn bộ ca P0 |

G01–G04 là các mục tiêu đã xuất hiện trong kế hoạch trao đổi; giao thức đo cụ thể và G05–G06 là đề xuất. Không mô tả các mục tiêu này như kết quả đã đạt. Nếu AI không đạt, nhóm phải thu hẹp vocabulary, điều chỉnh mốc/phạm vi có ghi nhận và đánh giá lại; không âm thầm hạ tiêu chuẩn.

Theo dõi thêm: tỷ lệ bắt đầu bài đầu tiên, hoàn thành bài, thử lại sau phản hồi, quay lại sau 7 ngày, tỷ lệ kết quả không chắc chắn, lỗi camera và chi phí mỗi lượt suy luận. Chưa đặt mục tiêu tăng trưởng/doanh thu khi chưa có baseline.

## 4. Phạm vi phát hành

| P0 — MVP | P1 — Sau khi P0 ổn định | P2 — Sau MVP |
|---|---|---|
| Website giới thiệu, FAQ, liên hệ và chính sách | Bài tập tình huống, nhắc ôn tập | Gói trả phí, thanh toán và quyền truy cập theo gói |
| Tài khoản, hồ sơ và phiên đăng nhập | Yêu thích, streak và mục tiêu học | Cộng đồng có kiểm duyệt, chương trình khách hàng thân thiết |
| Thư viện, bài học theo chủ đề, video | Bộ sưu tập ôn tập cá nhân | Lớp học/nhóm tổ chức và báo cáo B2B |
| Camera/upload, AI từng ký hiệu, thử lại | Gợi ý nội dung dựa trên lịch sử | CRM, chiến dịch, đối tác và quản trị doanh thu |
| Lịch sử, tiến độ cơ bản | Khảo sát trải nghiệm tích hợp | Phản hồi lỗi động tác chi tiết khi có dữ liệu kiểm chứng |
| CMS, duyệt học liệu, phân quyền, hỗ trợ | Dashboard phân tích mở rộng | Tích hợp hệ thống bên ngoài |
| Consent, xóa dữ liệu, giám sát và backup | Xuất dữ liệu tự phục vụ | Mở rộng ngôn ngữ ký hiệu khác qua dự án riêng |

**Ngoài phạm vi MVP:** dịch hai chiều trực tiếp, dịch câu VSL liên tục hoặc không giới hạn, chứng nhận phiên dịch, ứng dụng native, tích hợp doanh nghiệp và thương mại quy mô lớn. Không coi 100 lớp dữ liệu hiện có là 100 lớp đã sẵn sàng phục vụ người dùng.

## 5. Vai trò và phân quyền

| Vai trò | Quyền chính | Giới hạn |
|---|---|---|
| Khách | Xem trang công khai, danh mục và bài mẫu được mở | Không xem lịch sử cá nhân hoặc CMS |
| Người học | Học, luyện tập, xem tiến độ, gửi hỗ trợ, yêu cầu xóa | Chỉ truy cập dữ liệu của mình |
| Biên tập viên | Tạo và sửa bản nháp học liệu | Không tự duyệt/xuất bản bản nháp của mình |
| Người duyệt VSL | Duyệt, yêu cầu sửa, ghi nhận biến thể và tiêu chí | Không quản lý hệ thống hoặc tài khoản quản trị |
| Quản trị viên | Quản lý người dùng, xuất bản bản đã duyệt, hỗ trợ, cấu hình | Không được bỏ qua trạng thái duyệt; không mặc định xem clip riêng tư |

Một thành viên có thể giữ nhiều vai trò, nhưng một phiên bản học liệu phải có người duyệt khác người biên tập. Mọi kiểm tra quyền phải diễn ra ở máy chủ. Truy cập dữ liệu hỗ trợ nhạy cảm phải có lý do và audit log.

## 6. Sơ đồ trang và điều hướng

| Khu vực | Route đề xuất | Nội dung/CTA chính |
|---|---|---|
| Trang chủ | `/` | Giá trị sản phẩm, cách học, giới hạn AI, “Bắt đầu học” |
| Giới thiệu | `/about` | Sứ mệnh, nhóm, vai trò tham vấn cộng đồng |
| Thư viện | `/library` | Tìm theo từ, lọc chủ đề, nhãn AI hỗ trợ |
| Chi tiết ký hiệu | `/signs/:slug` | Video, nghĩa, hướng dẫn, biến thể, bài liên quan |
| FAQ/hỗ trợ | `/help`, `/contact` | Camera, học tập, AI, biểu mẫu hỗ trợ |
| Chính sách | `/privacy`, `/terms` | Xử lý dữ liệu, quyền người dùng, giới hạn dịch vụ |
| Tài khoản | `/register`, `/login`, `/forgot-password` | Đăng ký, đăng nhập, khôi phục |
| Tổng quan học tập | `/app` | Tiếp tục học, tiến độ, ký hiệu cần luyện |
| Lộ trình/bài học | `/app/courses`, `/app/lessons/:id` | Chủ đề, bài, video và bài kiểm tra |
| Luyện tập | `/app/practice/:signId` | Video mẫu, camera/upload, kết quả, thử lại |
| Lịch sử/tiến độ | `/app/history`, `/app/progress` | Lượt luyện, hoàn thành bài, trạng thái từng ký hiệu |
| Hồ sơ/cài đặt | `/app/settings` | Hồ sơ, mật khẩu, consent, xóa dữ liệu |
| Quản trị | `/admin/*` | Học liệu, duyệt, người dùng, AI, hỗ trợ, audit |

Desktop dùng thanh điều hướng rõ ràng; khu học tập có điều hướng cố định theo nhóm. Mobile ưu tiên Học, Thư viện, Luyện tập, Tiến độ và Hồ sơ. Tránh tự mở camera khi người dùng chỉ xem bài.

## 7. Yêu cầu chức năng

### 7.1 Website công khai và tài khoản

| ID | Ưu tiên | Yêu cầu | Tiêu chí nghiệm thu |
|---|---|---|---|
| WEB01 | P0 | Trang chủ giải thích sản phẩm và CTA học thử | CTA đưa tới bài mẫu hoặc đăng ký; không quảng cáo dịch hội thoại/AI sửa lỗi từng ngón |
| WEB02 | P0 | FAQ, giới thiệu, liên hệ, privacy/terms | Truy cập được khi chưa đăng nhập; form có xác nhận gửi và chống spam |
| AUTH01 | P0 | Đăng ký bằng email/mật khẩu, xác minh email | Chặn email trùng, mật khẩu không hợp lệ; token xác minh hết hạn và dùng một lần |
| AUTH02 | P0 | Đăng nhập, đăng xuất, quên mật khẩu | Hủy phiên khi đăng xuất; reset token hết hạn/dùng một lần; thông báo không tiết lộ email tồn tại |
| AUTH03 | P0 | Hồ sơ, đổi mật khẩu, quản lý phiên | Đổi mật khẩu yêu cầu xác thực; cho phép hủy các phiên còn lại |
| AUTH04 | P0 | Bảo vệ route và dữ liệu theo vai trò | Truy cập URL/API trực tiếp vẫn bị từ chối nếu thiếu quyền |

Đề xuất chính sách mật khẩu tối thiểu 12 ký tự, cho phép trình quản lý mật khẩu và dán mật khẩu. Tài khoản quản trị phải có xác thực bổ sung trước môi trường vận hành thật.

### 7.2 Thư viện và bài học

| ID | Ưu tiên | Yêu cầu | Tiêu chí nghiệm thu |
|---|---|---|---|
| LEARN01 | P0 | Danh mục ký hiệu đã phát hành theo học phần/bài và tìm theo từ tiếng Việt | Có kết quả rỗng và xóa bộ lọc; chuẩn hóa chữ hoa/thường, hỗ trợ tìm không dấu; không đưa mục bản nháp vào kết quả công khai |
| LEARN02 | P0 | Chi tiết ký hiệu | Hiển thị nghĩa, video, hướng dẫn, nguồn, biến thể nếu có và trạng thái AI hỗ trợ |
| LEARN03 | P0 | Trình phát video mẫu | Phát/dừng, tua, lặp lại, tốc độ chậm; giữ rõ tay, mặt và vùng thân cần thiết |
| LEARN04 | P0 | Học phần → bài học → ký hiệu → kiểm tra theo giáo trình | Có thứ tự, mục tiêu giao tiếp và trọng tâm thực hành; chỉ bài có học liệu đã duyệt mới mở học; phân biệt chưa học/đang học/hoàn thành |
| LEARN05 | P0 | Câu hỏi kiểm tra nhận biết | Có đáp án được duyệt, giải thích và thử lại; kết quả lưu cho đúng người học |
| LEARN06 | P1 | Yêu thích và ôn tập cá nhân | Thêm/xóa yêu thích, lọc ký hiệu cần luyện |

Mỗi ký hiệu cần: mã ổn định, từ tiếng Việt, mô tả nghĩa theo ngữ cảnh, chủ đề, video, hình đại diện, hướng dẫn quan sát, nguồn/quyền sử dụng, người duyệt, ngày duyệt, phiên bản và nhãn/biến thể VSL. Chỉ dẫn trái/phải và video lật gương phải thống nhất, có nhãn, tránh khiến người học hiểu sai.

**Khung chương trình:** tài liệu người dùng cung cấp “Giáo trình Ngôn ngữ Ký hiệu Việt Nam (VSL 400)” nêu 8 học phần, 18 bài và tổng dự kiến 400 từ vựng. Dùng cấu trúc này làm khung biên tập, không tuyên bố rằng 400 ký hiệu đã được quay video, duyệt hoặc được AI hỗ trợ. Thứ tự học phần: (1) Gia đình & giao tiếp nền tảng — bài 1–2; (2) Thời gian, thời tiết & lễ hội — bài 3–5; (3) Ẩm thực & mua sắm — bài 6–8; (4) Nhà cửa, trang phục & sinh hoạt — bài 9–10; (5) Trường học & công việc — bài 11–12; (6) Đi lại, địa điểm & quốc gia — bài 13–14; (7) Sức khỏe, vận động & giải trí — bài 15–16; (8) Tính cách, cảm xúc & động vật — bài 17–18.

Nhập tên, thứ tự, mục tiêu giao tiếp, trọng tâm thực hành và danh mục từ của từng bài vào CMS. Có thể tạo từ vựng ở trạng thái `planned`/`draft` khi chưa có video. Sau khi bổ sung video, kiểm tra quyền sử dụng, biến thể ký hiệu, nguồn và chuyên gia duyệt mới chuyển sang `published`. Giao diện công khai có thể giới thiệu khung học phần và đánh dấu “Đang biên soạn”; không hiện trang ký hiệu rỗng như bài học đã sẵn sàng. Số lượng khóa học/từ đã phát hành lấy từ dữ liệu thực tế, không lấy tổng 400 làm mẫu số tiến độ cá nhân.

MVP chọn các bài/nhóm từ ưu tiên để phát hành ít nhất 50 ký hiệu đã có học liệu; không mặc định hoàn thành toàn bộ 18 bài. Nội dung thực hành câu, chỉ ngôi, phân biệt nhánh gia đình, biểu cảm khuôn mặt, cấu trúc câu và biến thể vùng miền cần chuyên gia VSL duyệt. Chúng có thể là hướng dẫn/bài tập nhận biết hoặc thực hành tự luyện; AI hiện chỉ nhận diện từng ký hiệu độc lập trong tập đủ điều kiện, không chấm câu hay biểu cảm. Bài 17 có chênh lệch giữa nhãn nhóm nhỏ và số mục liệt kê; phải kiểm đếm, rà soát trùng/nghĩa và phê duyệt danh mục trước khi nhập hàng loạt hoặc công bố tổng số.

### 7.3 Luyện tập camera và upload

| ID | Ưu tiên | Yêu cầu | Tiêu chí nghiệm thu |
|---|---|---|---|
| PRA01 | P0 | Chọn ký hiệu mục tiêu và xem video mẫu | Chỉ cho gửi AI khi ký hiệu có video mẫu đã duyệt, đã xuất bản và nằm trong danh sách hỗ trợ của phiên bản mô hình đang chạy |
| PRA02 | P0 | Hướng dẫn và xin quyền camera sau thao tác chủ động | Nêu mục đích xử lý; từ chối quyền không làm kẹt trang; có hướng dẫn mở lại quyền/upload |
| PRA03 | P0 | Preview, đếm ngược, quay, dừng, xem lại và quay lại | Dừng track khi rời trang; không thu âm; chưa gửi lên server trước khi người dùng bấm phân tích |
| PRA04 | P0 | Tải video có sẵn | Kiểm tra định dạng/dung lượng/thời lượng ở client và server; lỗi có hướng dẫn sửa |
| PRA05 | P0 | Phân tích sau khi hoàn thành động tác | Hiển thị tiến trình tải và xử lý riêng; không tạo lượt luyện trùng khi bấm nhiều lần |
| PRA06 | P0 | Kết quả và thử lại | Có trạng thái rõ ràng, xem lại mẫu, thực hiện lại; lỗi kỹ thuật không tính thành lần sai |
| PRA07 | P0 | So sánh video trong phiên | Phát lại video của người học và mẫu cạnh nhau hoặc chuyển tab trên mobile; không yêu cầu lưu clip lâu dài |

Đề xuất đầu vào ban đầu: clip 2–10 giây, tối đa 20 MB, nhận WebM và MP4 có codec giải mã được. Backend chuẩn hóa trước suy luận; bộ dữ liệu thử phải bao gồm clip từ các trình duyệt mục tiêu. Nếu giới hạn thực tế khác, cập nhật UI và API cùng phiên bản.

Hướng dẫn quay: một người, đủ ánh sáng, nhìn thấy hai tay và vùng thân/mặt cần thiết, camera cố định. Bài học được xem bình thường khi thiết bị không có camera.

### 7.4 AI và phản hồi

| ID | Ưu tiên | Yêu cầu | Tiêu chí nghiệm thu |
|---|---|---|---|
| AI01 | P0 | Nhận diện ký hiệu độc lập | API trả nhãn dự đoán, phiên bản mô hình và trạng thái xử lý; chỉ dùng nhãn trong vocabulary công bố |
| AI02 | P0 | So sánh nhãn dự đoán với mục tiêu | Chỉ kết luận phù hợp khi đủ điều kiện chất lượng và vượt ngưỡng đã hiệu chỉnh |
| AI03 | P0 | Cho phép từ chối kết luận | Clip không chắc chắn, ngoài miền hoặc không đủ tín hiệu không bị gán cứng là sai |
| AI04 | P0 | Phản hồi giới hạn, có giải thích | Không tạo nhận xét vị trí ngón/tay/hướng chuyển động cụ thể nếu chưa có cơ chế và dữ liệu kiểm chứng |
| AI05 | P0 | Theo dõi phiên bản và hiệu năng | Mỗi lượt có model version, content version, thời gian xử lý và mã lỗi; không ghi raw video vào log |
| AI06 | P0 | Tắt AI/rollback khi sự cố | Admin có thể ngừng nhận job mới; bài học vẫn hoạt động và UI thông báo dịch vụ tạm dừng |

**Các trạng thái kết quả bắt buộc:**

| Trạng thái | Diễn giải cho người học | Hành động |
|---|---|---|
| `match` | “AI nhận diện ký hiệu phù hợp với mục tiêu.” | Thử lại hoặc tiếp tục |
| `mismatch` | “AI nhận diện một ký hiệu khác với mục tiêu.” | Xem lại mẫu và luyện lại |
| `uncertain` | “AI chưa đủ chắc chắn để đánh giá.” | Kiểm tra khung hình/ánh sáng, quay lại |
| `invalid_input` | Video không đáp ứng điều kiện kỹ thuật | Sửa đầu vào theo thông báo |
| `unsupported` | Ký hiệu chưa được AI hỗ trợ | Tiếp tục học video |
| `service_error` | Không phân tích được do hệ thống | Thử lại; không tính là sai |

Không diễn đạt confidence như “% động tác đúng”. `match` chỉ phản ánh mô hình nhận diện, không xác nhận chuẩn ngữ pháp, nét mặt hoặc toàn bộ cấu phần của ký hiệu. Gợi ý quan sát trong MVP là checklist do chuyên gia biên soạn, không phải lỗi AI đã phát hiện.

**Yêu cầu dữ liệu và đánh giá:** dữ liệu đã trao đổi gồm 100 lớp, pipeline 16 frame, kích thước 224×224 và chuẩn hóa ImageNet; đây là thông tin lịch sử cần kiểm tra lại khi triển khai. Chia train/validation/test độc lập; ưu tiên tách theo người thực hiện và nhóm nguồn để giảm rò rỉ. Tập test cần người chưa xuất hiện trong train, nhiều điều kiện camera và tập kiểm tra riêng cho clip không có ký hiệu/ngoài vocabulary. Ngưỡng từ chối được chọn trên validation, không trên test. Báo cáo cả tỷ lệ từ chối, độ chính xác trên phần được kết luận và kết quả từng lớp. Dataset chủ yếu mẫu đúng chưa đủ để xây hệ thống chấm lỗi động tác chi tiết.

### 7.5 Tiến độ và lịch sử

| ID | Ưu tiên | Yêu cầu | Tiêu chí nghiệm thu |
|---|---|---|---|
| PRO01 | P0 | Lưu trạng thái bài học | Tải lại hoặc đăng nhập trên thiết bị khác vẫn thấy dữ liệu đã đồng bộ |
| PRO02 | P0 | Lưu lượt luyện và kết quả | Có ký hiệu, thời gian, trạng thái, model version; không cần lưu raw video |
| PRO03 | P0 | Dashboard học tập | Hiển thị bài hoàn thành, số ký hiệu đã học, số lượt luyện và nội dung gần nhất |
| PRO04 | P0 | Phân biệt tiến độ học và kết quả AI | Một lần `match` không tự gán người học “thành thạo” |
| PRO05 | P1 | Streak, mục tiêu, nhắc ôn | Có thể tắt nhắc; quy tắc tính ngày được hiển thị |

Quy tắc đề xuất: chỉ tính tiến độ trong các bài đã xuất bản; bài hoàn thành khi người học xem đủ nội dung bắt buộc và đạt ≥80% câu hỏi nhận biết. Mẫu số tiến độ là số bài/ký hiệu đã phát hành trong lộ trình người học, không phải 18 bài/400 từ của khung biên tập. Luyện AI được ghi riêng, không chặn hoàn thành bài khi dịch vụ lỗi hoặc ký hiệu chưa được hỗ trợ. Ghi nhận hoàn thành ở server và đảm bảo gửi lại request không cộng trùng.

### 7.6 CMS, chuyên môn và vận hành

| ID | Ưu tiên | Yêu cầu | Tiêu chí nghiệm thu |
|---|---|---|---|
| CMS01 | P0 | Quản lý 8 học phần, 18 bài, mục từ, video và câu hỏi | Nhập cấu trúc giáo trình và bản nháp chưa có video; kiểm tra nguồn/quyền sử dụng và trường bắt buộc trước khi gửi duyệt; preview riêng tư |
| CMS02 | P0 | Workflow học liệu | Dự kiến/nháp → chờ duyệt → yêu cầu sửa/đã duyệt → xuất bản → lưu trữ; mục không có video hoặc chưa duyệt không xuất bản như ký hiệu hoàn chỉnh |
| CMS03 | P0 | Phiên bản và lịch sử duyệt | Sửa nội dung đã xuất bản tạo bản nháp mới; bản đang phục vụ vẫn dùng được tới khi bản mới được duyệt |
| ADM01 | P0 | Quản lý người dùng | Tìm, xem trạng thái, khóa/mở khóa có lý do; thao tác nhạy cảm có audit |
| ADM02 | P0 | Quản lý AI và từ vựng hỗ trợ | Chỉ bật model có báo cáo đánh giá, mapping nhãn và cấu hình đầu vào tương ứng |
| OPS01 | P0 | Ticket hỗ trợ và báo lỗi học liệu/AI | Có mã yêu cầu, trạng thái mới/đang xử lý/đã giải quyết; không bắt người dùng gửi clip riêng tư |
| OPS02 | P0 | Dashboard vận hành tối thiểu | Số job, lỗi, latency, chi phí và tình trạng dịch vụ; hạn chế dữ liệu cá nhân |
| OPS03 | P0 | Backup, restore và audit | Có bản sao dữ liệu, thử khôi phục trước phát hành và ghi kết quả |

Vận hành nội bộ: kiểm tra lỗi và hàng đợi hằng ngày; xử lý ticket theo mức độ; rà soát học liệu và báo cáo AI định kỳ; ghi chi phí hạ tầng/GPU. Công việc HR, phân bổ nguồn lực, dòng tiền và chiến lược kinh doanh được quản lý trong kế hoạch dự án; không xây hệ thống ERP/HRM riêng trong website MVP.

### 7.7 Quyền riêng tư và dữ liệu

| ID | Ưu tiên | Yêu cầu | Tiêu chí nghiệm thu |
|---|---|---|---|
| PRIV01 | P0 | Tách quyền camera, xử lý video và dùng dữ liệu để nghiên cứu | Đồng ý xử lý để nhận kết quả không đồng nghĩa đồng ý huấn luyện; mặc định không dùng clip luyện để huấn luyện |
| PRIV02 | P0 | Giới hạn vòng đời video | Đề xuất xóa raw clip sau xử lý; tác vụ dọn dẹp bảo đảm không còn quá 24 giờ kể cả lỗi; có kiểm thử TTL |
| PRIV03 | P0 | Xóa lịch sử, yêu cầu xóa tài khoản | Người dùng thấy trạng thái yêu cầu; xác thực lại trước xóa; xóa cả DB/object liên quan theo chính sách công bố |
| PRIV04 | P0 | Phân quyền clip và dữ liệu cá nhân | Bucket không công khai; URL có thời hạn; người dùng A không đọc/xóa dữ liệu người dùng B |
| PRIV05 | P0 | Ghi consent có phiên bản | Lưu mục đích, thời điểm và phiên bản thông báo; có quy trình rút lại đồng ý nếu thu thập nghiên cứu |

Đề xuất xử lý xóa tài khoản trên hệ thống chính trong 7 ngày, dữ liệu backup hết hạn trong tối đa 30 ngày. Khi khôi phục backup phải áp lại danh sách yêu cầu xóa trước khi mở dịch vụ. Chính sách này phải được thống nhất và phản ánh đúng khả năng hạ tầng trước khi công bố. Chưa mở chương trình thu thập clip huấn luyện nếu chưa có consent riêng, quy trình truy xuất/xóa và người phụ trách.

## 8. Luồng người dùng và trạng thái giao diện

**Luồng A — Bắt đầu học:** Trang chủ → xem bài mẫu → đăng ký/xác minh → chọn chủ đề → học bài đầu → làm câu hỏi → lưu tiến độ → gợi ý bài tiếp theo. Khách được hiểu giá trị trước khi tạo tài khoản.

**Luồng B — Luyện ký hiệu:** Mở ký hiệu → kiểm tra AI hỗ trợ → xem mẫu → đọc hướng dẫn xử lý video → bật camera → quay/xem lại → bấm phân tích → tải lên → chờ kết quả → xem phản hồi → so sánh → thử lại/tiếp tục. Nếu từ chối camera, cho upload hoặc quay lại học.

**Luồng C — Duyệt nội dung:** Biên tập tạo nháp → kiểm tra nguồn/quyền sử dụng → gửi duyệt → chuyên gia duyệt hoặc yêu cầu sửa → admin xuất bản bản đã duyệt → người học thấy nội dung. Khi phát hiện lỗi, ẩn bản lỗi và mở ticket sửa.

**Luồng D — AI lỗi:** Hệ thống timeout/hỏng dịch vụ → thông báo không tính sai → cho thử lại hoặc tiếp tục bài → ghi lỗi và cảnh báo vận hành → đối soát job để tránh kết quả/counter trùng.

Mỗi màn hình cần trạng thái loading, empty, success, validation error, network error và permission denied khi liên quan. Trang luyện tập bổ sung camera denied/not found, định dạng không hỗ trợ, upload gián đoạn, processing, timeout, uncertain và AI tạm ngừng. Không dùng spinner vô hạn.

## 9. UI/UX và khả năng tiếp cận

- Ngôn ngữ giao diện mặc định là tiếng Việt; dùng cách gọi nhất quán, tôn trọng cộng đồng Điếc.
- Thiết kế mobile-first, kiểm tra từ chiều rộng 360 px tới desktop; camera và video không bị che bởi CTA.
- Nhận diện theo mascot/logo do người dùng cung cấp: nhân vật kỳ giông axolotl cách điệu màu xanh nhạt, viền xanh navy, điểm nhấn hồng; wordmark SignHearing và slogan “DIFFERENT EXPRESSIONS / EQUAL VOICES”. Nền trắng, xanh dương là màu chủ đạo; hồng dùng làm điểm nhấn. Mã màu cuối cùng cần lấy từ asset chuẩn và kiểm tra độ tương phản.
- Mỗi màn hình có một hành động chính rõ ràng. Trang bài học tập trung video; trang luyện tập tập trung mẫu và vùng camera.
- Dùng được bằng bàn phím, có focus rõ, nhãn cho control và thông báo đọc được bởi công cụ hỗ trợ; màu sắc không phải tín hiệu duy nhất.
- Nội dung hướng dẫn không phụ thuộc âm thanh. Nếu có lời nói trong video phải có phụ đề tương ứng; văn bản giải thích không che tay/mặt.
- Không tự phát âm thanh hoặc tự bật camera. Có thông báo rõ khi đang quay và đang gửi dữ liệu.
- Thông báo AI trung tính, không gây cảm giác kết luận tuyệt đối về năng lực người học.

### 9.1 Mascot và nhận diện thương hiệu — yêu cầu đã xác nhận

**Nguồn tham chiếu:** `mascot.jpg`, hình người dùng cung cấp ngày 28/10/2026. Website phải dùng nhân vật này làm mascot của SignHearing. Giữ đặc điểm nhận diện: đầu tròn, mắt lớn, mang ngoài hai bên, thân xanh nhạt, viền xanh đậm và điểm nhấn hồng. Không tự đặt tên nhân vật hoặc thay đổi thiết kế cốt lõi.

| Vị trí | Cách dùng | Điều kiện |
|---|---|---|
| Header/footer | Logo phù hợp kích thước; mobile có thể dùng biểu tượng mascot rút gọn | Chữ SignHearing phải rõ; không ép toàn bộ ảnh tham chiếu vào header |
| Hero trang chủ | Mascot đồng hành với lời giới thiệu và CTA bắt đầu học | Không lấn át CTA hoặc thông tin sản phẩm |
| Onboarding | Mascot chào mừng, giới thiệu cách học và quyền camera | Nội dung consent vẫn là văn bản rõ ràng, không gây áp lực đồng ý |
| Dashboard | Minh họa lời chào, tiếp tục học và mục tiêu | Không che thông tin tiến độ |
| Hoàn thành bài | Mascot biểu cảm vui kèm lời khích lệ | Không diễn đạt như chứng nhận thành thạo VSL |
| Thử lại/AI không chắc chắn | Mascot động viên nhẹ nhàng kèm hướng dẫn | Không dùng biểu cảm chê trách; không tạo cảm giác AI chắc chắn khi kết quả uncertain |
| Trạng thái rỗng/lỗi | Mascot nhỏ kèm giải thích và hành động tiếp theo | Lỗi và hướng xử lý phải hiểu được mà không cần nhìn hình |
| Màn hình luyện tập | Chỉ dùng ở phần hướng dẫn hoặc kết quả | Không che video mẫu, tay/mặt, preview camera và nút điều khiển |

**Asset và triển khai:**

- Ảnh JPG hiện tại là bảng tham chiếu gồm mascot, wordmark, slogan và chú thích bố cục; không dùng nguyên bảng này làm logo trong giao diện. Các chữ “MASCOT”, “WORDMARK + SLOGAN”, “LOGO CHÍNH” và đường gạch chú thích không thuộc giao diện thương hiệu.
- Trước khi hoàn thiện UI, chuẩn bị asset riêng: logo ngang, mascot độc lập, biểu tượng thu gọn và favicon. Ưu tiên file gốc vector nếu có hoặc ảnh raster nền trong suốt đủ nét; không đổi đuôi JPG thành SVG để giả lập vector.
- Bản mascot hiện có là yêu cầu sử dụng chính thức; các tư thế chào mừng/khích lệ/hoàn thành là biến thể đề xuất, chỉ triển khai khi asset được chuẩn bị và kiểm tra nhất quán. MVP có thể dùng một hình tĩnh ở các vị trí phù hợp.
- Không dùng tư thế tay của mascot làm video mẫu hoặc đáp án VSL khi chưa được chuyên gia kiểm chứng. Nội dung học vẫn dùng video người thực hiện đã duyệt.
- Giữ tỷ lệ hình, không kéo méo hoặc đổi màu tùy tiện. Slogan phải là chữ đọc được ở nơi phù hợp; bỏ slogan ở kích thước nhỏ thay vì thu quá nhỏ.
- Hình trang trí có alt rỗng; logo liên kết về trang chủ có nhãn “SignHearing — Trang chủ”. Mọi trạng thái có nội dung chữ tương ứng.
- Animation là P1, không autoplay gây phân tâm; hỗ trợ tùy chọn giảm chuyển động. Mascot không kéo theo yêu cầu chatbot hoặc trợ lý AI mới.

**Nghiệm thu thương hiệu:** mascot xuất hiện đúng thiết kế tham chiếu ở trang chủ và ít nhất một điểm trong luồng học; các vị trí còn lại áp dụng khi phù hợp bố cục. Kiểm tra desktop/mobile, không méo hình, không có chú thích bảng tham chiếu, không che vùng ký hiệu và không làm giảm khả năng đọc. Chốt palette có độ tương phản phù hợp trước khi khóa design system.

## 10. Yêu cầu phi chức năng — chỉ tiêu đề xuất

| Nhóm | Yêu cầu kiểm chứng |
|---|---|
| Hiệu năng web | Nội dung chính trang chủ/thư viện xuất hiện trong ≤3 giây trên profile mobile 4G được ghi lại; lazy-load video và phân trang danh mục |
| API thường | p95 ≤500 ms với 30 người dùng hoạt động theo kịch bản đọc/lưu tiến độ; không tính tải video hoặc inference |
| Tải AI | Kiểm thử 5 job đồng thời; vượt capacity phải xếp hàng có giới hạn hoặc trả trạng thái bận, không treo dịch vụ |
| Tính sẵn sàng | Mục tiêu beta 99%/tháng, loại trừ bảo trì có thông báo; có health check và cảnh báo |
| Tương thích | Kiểm tra Chrome/Edge desktop, Chrome Android, Safari iOS tại thời điểm UAT; capability detection cho camera/codec |
| An toàn | HTTPS, mật khẩu băm, giới hạn đăng nhập/upload/inference, xác thực server, bí mật nằm ngoài repository và frontend |
| Upload | Kiểm tra MIME, nội dung giải mã, kích thước, thời lượng; xử lý media cách ly với timeout và giới hạn tài nguyên |
| Khôi phục | Đề xuất RPO 24 giờ, RTO 8 giờ cho beta; kiểm chứng bằng buổi diễn tập restore |
| Quan sát | Request/job ID xuyên suốt, log có cấu trúc, không log token hoặc raw video; phân loại lỗi theo mã |
| Bảo trì | Tách dev/staging/production; migration có kế hoạch phục hồi, có cấu hình và hướng dẫn triển khai |

Các chỉ tiêu trên là yêu cầu thiết kế/đo kiểm, không phải tuyên bố website hiện đã đáp ứng một tiêu chuẩn hay chứng nhận.

## 11. Kiến trúc triển khai đề xuất

Website gồm frontend responsive, backend ứng dụng, cơ sở dữ liệu quan hệ, object storage riêng tư cho video và dịch vụ AI độc lập. Backend xác thực người dùng, quản lý học liệu/tiến độ và tạo job; AI nhận đầu vào đã chuẩn hóa, chạy mô hình và trả kết quả có phiên bản. Client không quyết định điểm, quyền hoặc trạng thái hoàn thành chính thức.

Đề xuất stack để nhóm đánh giá: React/Next.js với TypeScript cho giao diện; Python/FastAPI cho API; PostgreSQL cho dữ liệu nghiệp vụ; TensorFlow/Keras cho mô hình theo hướng nghiên cứu DAT301m; object storage tương thích S3 cho media. Có thể dùng job table/worker cho tải nhỏ, chỉ bổ sung Redis/queue riêng khi cần. Đây là lựa chọn đề xuất, chưa phải stack đã chốt; không khóa phiên bản dependency trong PRD.

Luồng inference: client xin quyền gửi clip → backend tạo lượt luyện/job → upload vào vùng tạm có kiểm soát → kiểm tra/chuẩn hóa → worker inference → lưu metadata/kết quả → client nhận kết quả → xóa clip theo vòng đời. Timeout đề xuất 30 giây; job quá hạn chuyển failed, không tự tính thành mismatch.

## 12. Mô hình dữ liệu tối thiểu

| Thực thể | Trường/quan hệ chính |
|---|---|
| User, Role, Session | ID, email, password hash, trạng thái, quyền, phiên hết hạn |
| Curriculum, Module, Lesson | Phiên bản giáo trình, 8 học phần, 18 bài, mục tiêu giao tiếp, trọng tâm thực hành, thứ tự, trạng thái; số từ theo danh mục đã kiểm đếm |
| Sign, LessonSign, SignVersion | Mã từ ổn định, nghĩa/biến thể, thứ tự trong bài, trạng thái planned/draft/review/published, hướng dẫn, phiên bản; một từ có thể thuộc nhiều bài |
| MediaAsset | Liên kết tùy chọn với bản nháp từ; storage key, loại, độ dài, checksum, nguồn/quyền sử dụng, trạng thái duyệt và vòng đời; video mẫu bắt buộc trước khi xuất bản ký hiệu |
| Review | Content version, người gửi/người duyệt, quyết định, ghi chú, thời điểm |
| QuizQuestion, QuizAttempt | Nội dung, đáp án server-side, phiên bản, kết quả |
| LessonProgress | User, lesson/version, trạng thái, thời điểm hoàn thành |
| PracticeAttempt, InferenceJob | User, sign mục tiêu, prediction, trạng thái, model version, latency, mã lỗi |
| ModelVersion, ModelVocabulary | Artifact, mapping label, preprocessing, ngưỡng, metrics, trạng thái |
| ConsentRecord, DeletionRequest | Mục đích, phiên bản, thời gian, trạng thái thực hiện |
| SupportTicket, AuditLog | Chủ thể, hành động, trạng thái, metadata tối thiểu |

Danh mục giáo trình tồn tại độc lập với video; khóa học, bài và từ có thể ở trạng thái biên soạn, nhưng API công khai chỉ phát nội dung đã xuất bản. Không dùng số liệu từ giáo trình như số lượng học liệu hiện có. Kết quả lượt luyện giữ tham chiếu tới phiên bản ký hiệu/mô hình tại thời điểm thực hiện. Không xóa cứng nội dung đã được tham chiếu nếu làm hỏng lịch sử; có cơ chế lưu trữ hoặc ẩn phù hợp. Xóa tài khoản vẫn phải xóa/ẩn danh hóa dữ liệu cá nhân theo chính sách đã công bố.

## 13. Hợp đồng API mức sản phẩm

| Nhóm | Endpoint đề xuất | Kết quả bắt buộc |
|---|---|---|
| Auth | `POST /auth/register`, `/login`, `/logout`, `/password-reset` | Phiên an toàn, lỗi nhất quán, rate limit |
| Học liệu | `GET /modules`, `/lessons/:id`, `/signs` | Trả cấu trúc học phần/bài được phép công bố; chỉ trả ký hiệu đã xuất bản, trạng thái sẵn có và danh sách AI hỗ trợ; phân trang |
| Tiến độ | `GET /me/progress`, `PUT /me/lessons/:id/progress` | Lưu idempotent, user ID lấy từ phiên |
| Luyện tập | `POST /practice-attempts`, `POST /practice-attempts/:id/submit` | Attempt ID, điều kiện upload, idempotency key và trạng thái |
| Kết quả | `GET /practice-attempts/:id` | Job state, result state, model version, message code, retryability |
| Lịch sử | `GET /me/practice-attempts` | Phân trang, bộ lọc, chỉ dữ liệu chủ tài khoản |
| Quyền dữ liệu | `DELETE /me/history`, `POST /me/deletion-requests` | Xác thực, trạng thái xử lý và thời hạn |
| Quản trị | `/admin/content`, `/reviews`, `/models`, `/tickets` | Phân quyền, kiểm tra workflow, audit |

Phân biệt job state (`created`, `uploaded`, `queued`, `processing`, `succeeded`, `failed`, `expired`) với result state (`match`, `mismatch`, `uncertain`...). Một job succeeded có thể trả uncertain. Response lỗi gồm mã lỗi, thông báo an toàn, request ID và có thể thử lại hay không. Lỗi nội bộ không trả stack trace.

## 14. Đo lường, hỗ trợ và kinh doanh

Sự kiện tối thiểu: đăng ký hoàn tất, bài học bắt đầu/hoàn tất, camera bị từ chối, upload hoàn tất/thất bại, inference bắt đầu/kết thúc, result state, thử lại và ticket được tạo. Không đưa video, email hoặc nội dung riêng tư vào công cụ analytics. Dashboard phân tách lỗi kỹ thuật với kết quả học tập.

Website công khai phục vụ marketing qua trang giới thiệu, FAQ và CTA trải nghiệm. P1 có thể thêm đăng ký nhận tin với consent riêng. P2 mới bổ sung pricing, checkout, entitlement, hóa đơn/hoàn tiền theo chính sách, báo cáo doanh thu, referral/khách hàng thân thiết và yêu cầu hợp tác B2B. Chưa có cơ sở chốt giá, mô hình thu phí hoặc doanh thu mục tiêu.

Nếu mở cộng đồng, phải có báo cáo vi phạm, kiểm duyệt và nguồn lực vận hành trước khi phát hành. Nếu mở B2B, phải đặc tả tenant, quản trị tổ chức và cô lập dữ liệu; không tái sử dụng quyền admin nội bộ cho khách hàng doanh nghiệp.

## 15. Kế hoạch triển khai và nguồn lực

Các mốc dưới đây là đề xuất phân kỳ trong thời gian dự án đã có, không thay thế lịch baseline đã phê duyệt.

| Giai đoạn | Thời gian | Bàn giao và điều kiện chuyển bước |
|---|---|---|
| Chốt phạm vi, dữ liệu, UX | 02/11–30/11/2026 | PRD, wireframe, vocabulary sơ bộ, tiêu chí AI, data split và phân công |
| Nền tảng và baseline | 01/12–31/12/2026 | Auth, schema, CMS khung, lesson player, baseline AI; xác minh khả năng triển khai |
| Phát triển P0 | 01/01–31/01/2027 | Học liệu, camera/upload, API job, progress và quy trình duyệt |
| Tích hợp và đánh giá | 01/02–28/02/2027 | AI tích hợp, private storage, consent/xóa, báo cáo chất lượng và hiệu năng |
| Beta và sửa lỗi | 01/03–31/03/2027 | UAT, kiểm thử thiết bị, hoàn thiện 50 học liệu và 30 ký hiệu AI mục tiêu |
| Ổn định, triển khai, bàn giao | 01/04–30/04/2027 | Kiểm thử hồi quy, restore, hướng dẫn vận hành, release và báo cáo cuối |

Đề xuất 6 vai trò chính: PM/BA; UX/frontend; frontend/tích hợp; backend/triển khai; AI/data; QA/điều phối học liệu. Nhóm có thể kiêm nhiệm. Chuyên gia VSL và đại diện cộng đồng là bên tham vấn/duyệt cần được bố trí rõ, không mặc định là nhân lực miễn phí hoặc thành viên thứ bảy.

Phân bổ ngân sách theo kế hoạch đã trao đổi: governance 9.000.000; learning design & VSL content 12.000.000; learning platform MVP 25.000.000; AI feedback subsystem 25.000.000; testing/deployment 9.400.000; dự phòng 8.040.000 VNĐ. Tổng 88.440.000 VNĐ. Chi phí recurring phải theo dõi để không vượt trần, đặc biệt video, GPU và inference.

## 16. Rủi ro và phụ thuộc

| Rủi ro/phụ thuộc | Tác động | Biện pháp và quyết định |
|---|---|---|
| Dữ liệu ít/thiếu mẫu sai | Phản hồi quá tự tin, không sửa được lỗi cụ thể | MVP chỉ nhận diện, có uncertain; bổ sung test ngoài miền; chưa triển khai chấm lỗi bộ phận |
| Rò rỉ train/test, trùng người hoặc nguồn | Metrics cao nhưng dùng thực tế kém | Audit split và trùng lặp; báo cáo riêng theo người/điều kiện |
| Biến thể VSL và học liệu thiếu kiểm chứng | Dạy sai hoặc đánh giá nhầm biến thể hợp lệ | Gắn nhãn biến thể, reviewer chuyên môn, đồng bộ vocabulary |
| Thiết bị/ánh sáng/codec khác nhau | Không quay hoặc suy luận được | Kiểm thử ma trận thiết bị, normalize media, upload thay thế |
| GPU/hạ tầng hạn chế | Chậm, hết ngân sách | Clip giới hạn, quota/rate limit, queue hữu hạn, đo chi phí mỗi job |
| Camera và quyền riêng tư | Mất niềm tin, lộ dữ liệu | Consent rõ, storage riêng tư, TTL, kiểm thử xóa và phân quyền |
| Thiếu video học liệu/chậm duyệt | Không đủ 50 ký hiệu đã phát hành | Nhập khung giáo trình trước, chọn lô MVP, lập kế hoạch quay và duyệt; không tính từ dự kiến vào chỉ tiêu |
| Mở rộng thương mại quá sớm | Trễ MVP, thiếu nguồn lực | Khóa P0; P1/P2 cần ước lượng và quyết định phạm vi riêng |

## 17. Kiểm thử và điều kiện nghiệm thu

| ID | Kịch bản bắt buộc | Kết quả đạt |
|---|---|---|
| UAT01 | Người mới đăng ký, xác minh, học và đăng xuất | Toàn bộ luồng hoàn tất; dữ liệu lưu đúng tài khoản |
| UAT02 | Tìm ký hiệu, xem chậm/lặp và hoàn thành quiz | Nội dung đúng phiên bản đã duyệt; bài/từ chỉ có trong giáo trình nhưng thiếu video không hiện như bài đã phát hành; mẫu số tiến độ chỉ tính nội dung đang mở |
| UAT03 | Quay trên desktop/mobile và upload clip | Camera hoạt động ở thiết bị hỗ trợ; lỗi định dạng có hướng dẫn |
| UAT04 | Gửi clip mục tiêu, clip khác, clip không đủ tín hiệu | Hiển thị match/mismatch/uncertain theo hợp đồng; không tạo phản hồi lỗi bộ phận |
| UAT05 | Mất mạng, bấm gửi nhiều lần, timeout, AI ngừng | Không lưu/cộng trùng; lỗi kỹ thuật không tính sai; vẫn học được video |
| UAT06 | Người dùng A truy cập API của B | Bị từ chối trên mọi endpoint liên quan |
| UAT07 | Biên tập viên tự xuất bản hoặc sửa bản đã duyệt | Không bỏ qua bước duyệt; bản sửa tạo revision mới |
| UAT08 | Xóa lịch sử/tài khoản và clip hết TTL | DB/storage được xử lý đúng; có bằng chứng job xóa và quy trình backup |
| UAT09 | AI test, load test và đo p95 | Có cấu hình, dataset, model version, kết quả và giới hạn được ghi rõ |
| UAT10 | Restore và rollback | Khôi phục được dữ liệu; rollback được model; áp lại yêu cầu xóa |

**Release gate:** tất cả P0 có bằng chứng nghiệm thu; không còn lỗi chặn luồng học hoặc lỗi nghiêm trọng về quyền/dữ liệu; đủ học liệu và vocabulary theo baseline; báo cáo AI không dùng dữ liệu rò rỉ; giao diện phản ánh đúng năng lực thực tế; policy và quy trình hỗ trợ đã sẵn sàng. Nếu chưa đạt G01–G04, chỉ phát hành dưới phạm vi beta đã được điều chỉnh và công bố rõ, không gọi là MVP đạt mục tiêu ban đầu.

Gói bàn giao gồm mã nguồn, cấu hình mẫu không chứa secret, schema/migration, API specification, model artifact/checksum và preprocessing, data/evaluation report, sổ tay CMS, hướng dẫn vận hành/restore, kết quả UAT và danh sách giới hạn còn lại.

## 18. Các quyết định cần chốt trước khi khóa backlog

| Quyết định | Đề xuất hiện tại | Chủ trì |
|---|---|---|
| Vocabulary và biến thể VSL | Rà soát danh mục VSL 400, đặc biệt số mục Bài 17; chọn ≥50 ký hiệu có học liệu và ≥30 ký hiệu AI đạt chất lượng | PM + AI + reviewer VSL |
| Tiêu chí kiểm chứng AI và split cuối | Test độc lập theo người/nguồn, có tập ngoài miền, ngưỡng từ validation | AI + QA |
| Stack và nơi triển khai | Frontend TypeScript, backend Python, DB quan hệ, private object storage | Backend + frontend + AI |
| Consent và vòng đời dữ liệu | Raw video xóa sau xử lý, hạn chót 24h; không huấn luyện mặc định | PM + backend |
| Quy tắc hoàn thành bài | Nội dung bắt buộc + quiz ≥80%, kết quả AI theo dõi riêng | PM + learning design |
| Thương hiệu và học liệu | Mascot đã được chọn; cần chuẩn hóa asset, palette, reviewer, quyền sử dụng video và biến thể | UX + content |
| Kinh doanh sau MVP | Chưa chốt giá, checkout hoặc tổ chức B2B | PM + phụ trách business |

Mọi thay đổi sau khi chốt baseline phải ghi yêu cầu bị ảnh hưởng, lý do, chi phí/thời gian, tác động dữ liệu/AI và người quyết định. Có thể tiếp tục wireframe, thiết kế schema và phát triển các phần độc lập trong lúc hoàn thiện các quyết định còn mở.
