# RoadSense One View — phiên bản thử nghiệm cho điện thoại

## Các tệp
- `index.html`: giao diện dashboard và các bảng cài đặt, đồng bộ.
- `style.css`: giao diện One View, thích ứng điện thoại dọc/ngang, theme sáng/tối.
- `script.js`: GPS, dữ liệu cảm biến, lưu hành trình, cài đặt, xuất và tải lên GitHub.
- `manifest.json`: thông tin cài PWA.
- `sw.js`: bộ đệm offline (Service Worker).
- `icons/`: icon PNG 192 và 512.

**Đã xóa toàn bộ mã dành cho Wyn.** Không sử dụng Tailwind CDN hoặc thư viện JavaScript bên ngoài.

## Cách chạy đúng (đặc biệt để GPS hoạt động)
1. Tải **toàn bộ thư mục** lên GitHub Pages, Netlify hoặc máy chủ **HTTPS**. Không mở file HTML bằng `file://` trên điện thoại.
2. Trên điện thoại, mở URL HTTPS bằng Safari/Chrome; cấp quyền **vị trí chính xác** khi trang yêu cầu. Bật Dịch vụ vị trí trên hệ điều hành.
3. Nhấn nút `GPS` để yêu cầu lại nếu đã cấp quyền mà vẫn không nhận tín hiệu. Xem thông báo chi tiết trong Cài đặt.
4. Chạm `CÂN BẰNG` khi điện thoại đặt chắc chắn, đứng yên. Trên iPhone, trình duyệt có thể hỏi quyền **Motion & Orientation** khi bạn chạm.
5. Nhấn `BẮT ĐẦU GHI` để lưu mẫu GPS. Sau khi dừng, vào biểu tượng `⇪` để xuất JSON hoặc tải lên GitHub.
6. Thử `☾/☀` để đổi theme thủ công. Theme và cài đặt lưu cục bộ.

## Cần biết
- Bảng điều khiển thiết kế không cuộn; cửa sổ Cài đặt có cuộn để đủ nhiều tham số.
- Thông số `Mức gợi ý` là **giá trị tham khảo tính bằng quy tắc thử nghiệm**, không biết giới hạn tốc độ thực tế trên đường và không tự động lấy dữ liệu biển báo. Không dùng số đó thay thế luật giao thông.
- Độ xóc và bán kính cua là phép ước tính, phụ thuộc loại thiết bị, tư thế cố định máy, tần suất và độ chính xác cảm biến/GPS.
- Số `--` là **chưa có dữ liệu**, tuyệt đối không phải `0` hay giả lập.
- Khoảng cách tới điểm xóc chỉ xuất hiện nếu đã phát hiện và lưu điểm xóc trong một lần ghi trước; GPS phải đủ tốt. Các vị trí này không được kiểm chứng và có thể sai số lớn.
- Trình duyệt trên điện thoại có thể giới hạn GPS, cảm biến, giọng nói hoặc ghi dữ liệu khi màn hình tắt, khi chạy nền, khi pin yếu. Wake Lock có dùng nếu trình duyệt hỗ trợ, không bảo đảm chạy nền.
- Hành trình được lưu tại **IndexedDB** của trình duyệt và có thể bị xóa nếu dọn dữ liệu trang, dùng chế độ ẩn danh hoặc gỡ ứng dụng. Hãy thường xuyên **xuất JSON**.
- Cấu hình và điểm xóc lưu trong localStorage (gắn với website). GitHub token không lưu trong localStorage, chỉ cần nhập lúc tải lên. Không đặt token vào mã, không đưa dữ liệu vị trí vào GitHub public nếu muốn giữ riêng tư.
- GitHub upload chỉ chạy khi **có mạng**, cần repo có sẵn và fine-grained token cấp `Contents: Read and write`. Mỗi lần tải lên sinh một tệp mới trong thư mục `trips/`.
- Nếu vẫn thấy phiên bản cũ, gỡ PWA đã cài hoặc xóa dữ liệu cache của tên miền sau khi triển khai.

## Thử cục bộ trên máy tính
```bash
cd RoadSense_OneView
python -m http.server 8000
```
Mở `http://localhost:8000`. GPS trên **điện thoại** không hoạt động qua địa chỉ HTTP nội bộ thông thường; cần HTTPS.

## Lưu ý an toàn
**Chỉ thử khi dừng xe hoặc có người khác thao tác.** Không sử dụng điện thoại khi đang điều khiển phương tiện. Phần mềm đang ở dạng thử nghiệm, không phải thiết bị hỗ trợ an toàn đã được kiểm định.
