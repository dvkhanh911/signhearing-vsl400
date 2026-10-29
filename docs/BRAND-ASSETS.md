# Nhận diện SignHearing — asset đang sử dụng

Nguồn: `mascot.jpg` do người dùng cung cấp. Giữ nguyên ảnh gốc làm tham chiếu. Hai asset đã được xử lý trong lượt trước bằng **built-in ImageGen**, giữ đặc điểm axolotl xanh nhạt, viền navy, mang hồng và wordmark SignHearing.

| File | Kích thước | Sử dụng |
| --- | --- | --- |
| `static/assets/logo-horizontal.png` | 2172 × 724 | Header/footer, PNG RGBA trong suốt |
| `static/assets/mascot.png` | 1351 × 1164 | Hero/banner/trang thông báo, PNG RGBA trong suốt |

Đã mở từng file bằng công cụ xem ảnh, kiểm tra không có slogan/chú thích/đường gạch của bảng tham chiếu; đã kiểm tra kênh alpha và hàng pixel đầu trong suốt. Asset là ảnh raster xử lý từ tham chiếu, không phải vector gốc.

Giao diện dùng hai ảnh độc lập qua thẻ `img`, không crop ảnh bảng tham chiếu bằng CSS, không dùng ảnh preview làm nền trang. Blob, cánh hồng và hình trang trí đơn giản được dựng bằng CSS. Mascot mang ý nghĩa nhận diện, không phải mẫu động tác VSL.

Palette giao diện tham chiếu: navy `#082953`, xanh `#2678ed`, hồng `#f595b3`, xanh nền `#e7f4ff`. Chữ thân bài dùng tông đậm trên nền sáng. Font hệ thống Segoe UI/Arial, hỗ trợ tiếng Việt và không tải font bên ngoài.

## Prompt mascot đã dùng

```text
Use case: background-extraction. Edit target: the provided SignHearing brand reference sheet. Extract ONLY the complete axolotl mascot on the left as a clean standalone PNG cutout with REAL transparent background. Preserve the original exact character, pose, facial expression, proportions, navy outline, pale blue body, cream belly and pink gills. Remove every word, wordmark, slogan, caption, dashed annotation lines, pink decorative marks beside it, white background and ground shadow. No redesign, no new pose, no text, no extra objects. Center the entire character, uncropped gills, tail and feet, with small transparent padding. This is an asset for a website hero, NOT a screenshot or page design.
```

## Prompt logo đã dùng

```text
Use case: background-extraction. Produce one compact horizontal SignHearing header logo PNG with REAL transparent background based exactly on the provided brand sheet. Use the existing mascot head as a small icon on the LEFT, and the provided exact wordmark SignHearing on its RIGHT. Preserve the original mascot head, large eyes, pink gills, blue tones and navy outline, and original rounded lettering: Sign in navy, Hearing in blue, the existing small pink/blue accent above the word. Spell exactly SignHearing. Remove the white background, slogan, full body, caption labels, dashed annotation rules and all design-sheet annotations. The logo must be tightly framed with about 3% clear padding, very wide horizontal aspect ratio approximately 4.5 to 1, no tagline. Flat layout suitable for a website navbar. Do not produce a website screenshot.
```

Phương án tinh chỉnh icon nhỏ hơn từng được thử nhưng không chọn; file được dùng vẫn là phương án đầu. Không tạo thêm tư thế mascot trong giai đoạn landing hiện tại.
