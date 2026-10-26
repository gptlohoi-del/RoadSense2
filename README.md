# RoadSense One View · Tự cân bằng (v4)

Bản mã đầy đủ gồm `index.html`, `style.css`, `script.js`, `manifest.json`, `sw.js` và `icons/` (2 icon PNG). **Đã xóa hoàn toàn Wyn.** CSS/JS độc lập, không dùng CDN.

## Thao tác chính — chỉ cần một nút ghi

1. Gắn điện thoại chắc chắn lên giá đỡ và **giữ yên khi mở web**. GPS sẽ tự xin quyền và cảm biến sẽ **tự đo mức nền/tự cân bằng** nếu được phép.
2. Xem trạng thái **TỰ CÂN BẰNG**: “Đang tự cân bằng…” hoặc “Đã cân bằng tự động”. Nếu chưa có dữ liệu, cần kiểm tra quyền và hỗ trợ cảm biến của thiết bị.
3. Nhấn **BẮT ĐẦU GHI** khi chuẩn bị di chuyển. Nhấn **DỪNG GHI** khi kết thúc. Chỉ khoảng thời gian giữa hai thao tác này mới được lưu thành hành trình GPS.
4. Khi cần, nhấn ⇪ để **xuất JSON** hoặc tải hành trình lên GitHub, hoặc ⚙ để thử tham số.

**Điện thoại iPhone/Safari:** iOS có thể yêu cầu bạn chạm **BẮT ĐẦU GHI** hoặc **Cấp quyền / Cân bằng lại cảm biến** trong Cài đặt để cho phép nhận `devicemotion`. Trang web không được phép tự mở hộp thoại cấp quyền cảm biến mà không có cử chỉ người dùng. Nếu trình duyệt vừa cấp quyền khi bạn nhấn BẮT ĐẦU, hãy **giữ xe đứng yên cho tới khi hiện “Đã cân bằng tự động”** rồi mới di chuyển. Nếu trình duyệt không cung cấp cảm biến, dữ liệu đo xóc sẽ để trống, không tạo dữ liệu giả.

## Các điểm thay đổi v4

- **Tự cân bằng:** chạy khi mở ứng dụng, lấy mẫu cảm biến nếu thiết bị có tín hiệu. Kiểm tra độ ổn định của các mẫu; nếu máy rung mạnh thì chờ đứng yên, không báo cân bằng thành công giả.
- **Một nút ghi chính:** thay nút CÂN BẰNG bằng **ô trạng thái tự cân bằng**, còn nút BẮT ĐẦU GHI chuyển thành DỪNG GHI khi đang ghi.
- **Ba chế độ cùng hàng:** Thoải mái · Cân bằng · Thể thao (chọn trực tiếp, lưu cài đặt).
- **Chi tiết GPS:** hai hàng “GPS tốt / 1.0 Hz · ±8 m” (chỉ là ví dụ). **Hz là số lần cập nhật vị trí mỗi giây, không phải Mbps.** Khi trình duyệt hỗ trợ, cửa sổ Cài đặt cũng có ước tính băng thông **Internet** (Mbps) được gắn nhãn riêng; đây không phải tốc độ truyền dữ liệu GPS.
- **Giảm chớp popup:** bỏ `backdrop-filter`, không tự focus vào ô nhập liệu khiến bàn phím bật lên, hạn chế vẽ lại bảng điều khiển khi popup mở, không đóng hộp thoại khi chạm nhầm vùng nền.
- **PWA cache v4:** đổi cache để trình duyệt tải phiên bản mới.

## Cài web và GPS

1. Upload **toàn bộ các tệp** lên website HTTPS (ví dụ GitHub Pages, Netlify). Không mở `file://` hay web HTTP nội bộ trên điện thoại.
2. Cấp quyền **vị trí chính xác**, bật dịch vụ vị trí trên máy; có thể chạm ô GPS ở trên nếu muốn thử kết nối lại.
3. Nếu cài PWA từ bản cũ, sau khi thay tệp hãy làm mới trang; nếu vẫn thấy bản cũ, xóa dữ liệu web của tên miền hoặc gỡ/cài lại PWA. Việc xóa dữ liệu website cũng xóa dữ liệu hành trình lưu trên máy: **xuất JSON trước khi xóa**.
4. Nên sử dụng nút đổi giao diện sáng/tối ở thanh trên.

## Kỹ thuật và an toàn

- Lịch sử hành trình lưu vào **IndexedDB**; cấu hình và điểm xóc vào `localStorage`. Việc tắt màn hình hoặc chuyển app có thể làm trình duyệt ngừng cung cấp GPS/cảm biến. Wake Lock chỉ hỗ trợ giữ sáng trên trình duyệt phù hợp.
- Phần GitHub yêu cầu token cá nhân có quyền Contents: Read and write của repo; token chỉ nằm trong ô nhập của phiên hiện tại, không ghi vào bộ nhớ cục bộ. Tránh upload vị trí cá nhân vào repo công khai.
- Số **tốc độ gợi ý** là kết quả thuật toán **thử nghiệm** và không đọc giới hạn pháp lý, biển báo hoặc dữ liệu đường được xác minh. Cảm biến có sai số do vị trí gắn máy và chất lượng GPS.
- Chỉ thao tác với điện thoại **khi xe đã dừng an toàn hoặc có hành khách thao tác**.

## Thử trên máy tính

```bash
cd RoadSense_OneView_Auto
python -m http.server 8000
```
Mở `http://localhost:8000` và cấp quyền vị trí nếu cần. Máy tính thường không có cảm biến `devicemotion` như điện thoại.
