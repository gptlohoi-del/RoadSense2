# RoadSense One View v7 — Nền phân tích tùy chỉnh & cảnh báo 4 bíp (tiếp nối v6)

**Repository mặc định:** https://github.com/gptlohoi-del/RoadSense2

Đây là bộ mã nguồn PWA độc lập, không cần Tailwind/CDN. Đã loại bỏ Wyn. v5 giữ giao diện One View, chế độ Thoải mái/Cân bằng/Thể thao, tự cân bằng cảm biến, GPS, cảnh báo thử nghiệm, sáng/tối.



## Điểm mới v7 (so với v6)

1. **Đổi màu nền khung PHÂN TÍCH THỬ NGHIỆM**: mở **CÀI ĐẶT → Giao diện**, nhập mã `#RRGGBB` như `#17365D`, xem màu ô mẫu, nhấn **LƯU**. Không chấp nhận mã sai. Xóa trắng để về màu nền tự đổi theo sáng/tối. Nội dung trong khung tự đổi màu chữ/số nhằm dễ đọc hơn trên nền sáng hoặc tối. Màu đã chọn lưu trong khóa thiết bị `roadsense_settings_v3` cùng các cài đặt khác.
2. **Đổi cảnh báo bằng giọng đọc dài thành 4 tiếng bíp** bằng Web Audio API. Mỗi lượt gồm 4 âm bíp ngắn (105 ms/âm, khoảng cách 105 ms, tổng khoảng 0,74 giây). Sau lượt bíp, ứng dụng **nghỉ theo số giây nhập trong Cài đặt** (mặc định 12 giây), và lặp lại nếu tốc độ GPS vẫn cao hơn `mức gợi ý + biên độ`.
3. **Cấu hình cảnh báo**: bật/tắt, khoảng nghỉ 2–90 giây, biên độ vượt 0–30 km/h, cao độ 400–1400 Hz, âm lượng 10–100%. Biên độ mặc định của v7 là **0 km/h**, nghĩa là vượt mức gợi ý thì bíp. Các máy từng dùng bản cũ với biên độ mặc định 10 km/h được chuyển về 0; giá trị tùy chỉnh khác vẫn giữ nguyên.
4. Nút **🔊 NGHE THỬ 4 BÍP** hoạt động ngay trong Cài đặt và không yêu cầu bạn đã bật cảnh báo. Ứng dụng không dùng `speechSynthesis` cho cảnh báo vượt tốc độ nữa.
5. **Quy tắc an toàn**: chỉ cảnh báo **khi đang ghi hành trình**, GPS tốt, tọa độ mới trong 10 giây, và tốc độ vượt ngưỡng. Khi tốc độ trở về ngưỡng, GPS mất tín hiệu, tắt cảnh báo hoặc nhấn **DỪNG GHI**, ứng dụng dừng lượt bíp/lặp lại. Vì GPS và tốc độ gợi ý đều có sai số, chỉ coi âm báo là thông tin thử nghiệm, **không phải giới hạn tốc độ hợp pháp**.
6. Trình duyệt điện thoại thường chặn âm thanh tự phát. Nhấn **NGHE THỬ** hoặc **BẮT ĐẦU GHI** để kích hoạt hệ thống âm thanh. Nếu khóa màn hình/chuyển tab, âm báo có thể bị tạm ngừng; âm lượng thực tế phụ thuộc máy và mức âm lượng của hệ điều hành.

### Tệp sửa trong bản v7

| Tệp | Nội dung |
|---|---|
| `index.html` | Thêm ô nhập mã HEX; đổi Cảnh báo giọng nói thành 4 bíp; thêm cao độ, âm lượng và nghe thử. |
| `style.css` | Ô xem màu và màu chữ/viền tương phản theo nền tùy chỉnh. |
| `script.js` | Lưu/kiểm tra màu HEX; Web Audio 4 bíp, nghỉ/lặp theo điều kiện, dừng khi mất GPS/hạ tốc/dừng ghi. |
| `sw.js` | Đổi `CACHE_NAME` thành `roadsense-oneview-v7-customcolor-beeps` để làm mới shell PWA. |
| `README.md` | Cập nhật hướng dẫn và danh sách tệp sửa. |
| `archive.js`, `manifest.json`, `icons/*` | **Không thay đổi**. GitHub vẫn là `gptlohoi-del/RoadSense2` và đường dẫn `roadsense-data/v1/`. |

**Cập nhật từ v6:** thay `index.html`, `style.css`, `script.js`, `sw.js` trên GitHub Pages; nếu muốn có hướng dẫn mới thì thêm `README.md`. Không xóa IndexedDB/localStorage; không cần thay `archive.js`. Cảnh báo mới mặc định đang tắt nếu bạn chưa từng bật trước đó, cần bật ở **Cài đặt → Cảnh báo âm thanh** và nhấn **LƯU**.

---

## Tính năng được giữ từ v6 (so với v5)

- **CÀI ĐẶT**: nút **LƯU** nằm trên thanh tiêu đề, ngay cạnh **✕**; nút **Mặc định** vẫn ở cuối hộp thoại. Nút LƯU gửi biểu mẫu bằng thuộc tính `form="settings-form"` nên hoạt động dù ở ngoài form.
- **Cảnh báo (được thay ở v7)**: tính năng giọng nói v6 đã được thay bằng 4 tiếng bíp nhanh như mô tả phía trên.
- **Thu phóng nội dung 60–200%**: thay đổi kích thước nội dung dashboard. Mức 100% ưu tiên One View; mức cao có thể **cuộn dashboard** thay vì bị cắt mất nội dung trên màn hình nhỏ. Cửa sổ Cài đặt luôn có thể cuộn độc lập.
- **Hai cỡ số độc lập**: Cỡ số MỨC GỢI Ý và TỐC ĐỘ GPS điều chỉnh qua thanh trượt 34–110 px; giá trị lưu riêng. CSS giới hạn cỡ chữ khi cần để tránh tràn màn hình quá hẹp.
- **Giữ tương thích**: vẫn dùng `roadsense_settings_v3`, tự chuyển giá trị cỡ chữ kiểu cũ sang cỡ số mới. Không thay đổi dữ liệu hành trình hay bộ đồng bộ GitHub của v5.

### Những tệp được sửa ở v6

| Tệp | Nội dung |
|---|---|
| `index.html` | Đưa LƯU cạnh ✕, đổi tiêu đề CÀI ĐẶT, bổ sung nghe thử, hai thanh cỡ tốc độ, thu phóng 60–200%. |
| `style.css` | Điều chỉnh kiểu modal, tăng ưu tiên hiển thị tốc độ, hỗ trợ zoom lớn không cắt chữ. |
| `script.js` | Lưu/cập nhật hai cỡ số riêng, thu phóng 60–200%, phát thử cảnh báo bằng giọng nói. |
| `sw.js` | Tăng phiên bản cache PWA để tải bản mới. |
| `archive.js` | **Không sửa** (đồng bộ GitHub và định dạng dữ liệu vẫn như v5). |
| `manifest.json`, `icons/*.png` | **Không sửa**. |
| `README.md` | Thêm hướng dẫn và danh sách thay đổi. |

### Cập nhật website

Đưa `index.html`, `style.css`, `script.js`, `sw.js` mới lên GitHub Pages; giữ nguyên `archive.js`, `manifest.json`, `icons`. Tải lại trang/PWA để nhận giao diện mới. Không xóa dữ liệu website (IndexedDB/localStorage) vì đang lưu hành trình và có thể đang lưu token theo lựa chọn của bạn.

## Hướng dẫn sử dụng nhanh

1. **Đưa toàn bộ tệp** `index.html`, `style.css`, `script.js`, `archive.js`, `sw.js`, `manifest.json`, `icons/` lên website **HTTPS**. Không mở bằng `file://` để đo GPS/cảm biến hoặc cài PWA.
2. Trong GitHub, tạo **Fine-grained personal access token** tại https://github.com/settings/personal-access-tokens/new. Chọn **Repository access → Only select repositories → RoadSense2**, **Repository permissions → Contents → Read and write**. Giới hạn thời hạn và thu hồi token khi không dùng nữa. Không dán token vào GitHub repository hoặc chia sẻ cho người khác.
3. Mở RoadSense trên điện thoại → chạm biểu tượng **⇪** → ô Repository đã điền sẵn **`gptlohoi-del/RoadSense2`**, không cần gõ nữa → **dán token**. Bản mặc định giữ token trong bộ nhớ của trang, cần nhập lại khi tải lại/đóng trang.
4. Nếu muốn chỉ nhập một lần trên **điện thoại cá nhân**, bật **Ghi nhớ token trên điện thoại này**. Lựa chọn này **lưu token dạng văn bản thuần trong localStorage, kém an toàn**, chỉ dùng trên thiết bị đáng tin cậy, không dùng trên điện thoại chia sẻ. Có nút **Xóa token đã lưu trên thiết bị**. Nếu thiết bị bị đánh cắp, lộ mã/script độc hại, token có thể bị đánh cắp. Quyền token chỉ nên giới hạn vào repo RoadSense2.
5. Mặc định: **Tự động Upload bật**, định kỳ **3 phút** khi có mạng và trang còn hoạt động; **Upload khi DỪNG GHI bật**. Có thể bật/tắt và chọn 2/3/5/10/15 phút ngay trong cửa sổ ⇪.
6. Gắn điện thoại cố định, cấp quyền GPS/cảm biến, chờ **TỰ CÂN BẰNG** (nếu có cảm biến). Nhấn **BẮT ĐẦU GHI**. Trong lúc ghi, mở ⇪ và chạm **UPLOAD NGAY** bất cứ lúc nào: hoạt động ghi vẫn tiếp tục. Khi đến nơi nhấn **DỪNG GHI**. Hạn chế thao tác khi đang lái xe.
7. Để kiểm tra, mở ⇪ → **Xem dữ liệu đã tải lên** hoặc **Mở repository**; xuất **CSV tọa độ** để xem bằng Excel, hoặc **Sao lưu toàn bộ JSON** để kiểm tra bằng công cụ khác.

## Cấu trúc dữ liệu trên GitHub

```text
RoadSense2/
└── roadsense-data/
    └── v1/
        └── <session-id>/
            ├── manifest.json
            ├── part-000000.json
            ├── part-000001.json
            └── ...
```

- Mỗi lần nhấn BẮT ĐẦU sinh một **session-id duy nhất**. Chuyến khác có session-id khác, không trộn dữ liệu.
- `part-*.json`: phần dữ liệu gốc **bất biến** khi đã Upload, có `schemaVersion=1`, đơn vị đo, thời gian, dữ liệu GPS, gia tốc/rotation 3 trục và sự kiện hiệu chỉnh/cấu hình. GPS giữ tọa độ ngay cả khi sai số cao và có cờ `quality`. Mẫu chuyển động ghi tối đa khoảng **20 Hz** (phụ thuộc trình duyệt/cảm biến); không giả định thiết bị luôn cấp đủ mẫu.
- `manifest.json`: thời gian bắt đầu/kết thúc, trạng thái `recording`, `completed` hoặc `interrupted`, cấu hình và môi trường khi bắt đầu, số lượng mẫu, danh sách các tệp theo thứ tự, trạng thái đồng bộ. Tệp này được cập nhật khi Upload; các phần dữ liệu đã Upload **không bị sửa lại**.
- Mẫu trong `records[]` có `kind`: `gps`, `motion`, `session_started`, `session_stopped`, `calibration`, `settings_change`, `mode_change`, `road_event`, `gps_error`, `gps_gap`... Dữ liệu GPS có đơn vị mét/mét trên giây; gia tốc có đơn vị m/s². Trường không được trình duyệt cung cấp để `null` thay vì bịa giá trị.
- Tệp lưu dữ liệu gốc, không phụ thuộc công thức tốc độ khuyến nghị hiện tại. Phiên bản RoadSense tương lai có thể đọc `schemaVersion=1` để phân tích lại.

## Cách kiểm tra dữ liệu được ghi có chính xác không

1. Vào trang repository → thư mục `roadsense-data/v1/` → chọn một `session-id` → mở `manifest.json`. Đối chiếu `startedAt`, `endedAt`, `status`, `stats.gps`, `stats.motion`, `parts`.
2. Mở một `part-xxxxxx.json`, xem `records`: thời gian (`at`), tọa độ (`coords.latitude/longitude`), sai số (`coords.accuracy`, m), gia tốc (`acceleration`), gia tốc có trọng lực (`accelerationIncludingGravity`), tốc độ GPS (`coords.speed`, m/s). Nếu GPS bị yếu, `quality` sẽ cho biết mẫu không đạt ngưỡng sử dụng cho giao diện.
3. Trong RoadSense, nhấn **Xuất CSV tọa độ** → mở Excel hoặc Google Sheets. So sánh timestamp, lat/lon, tốc độ, sai số với đường đi thực tế. Kiểm tra khoảng trống giữa các timestamp; web không đảm bảo có dữ liệu khi trình duyệt bị tạm dừng.
4. Nếu một lần Upload bị mất kết nối, nhấn lại Upload. RoadSense không ghi đè phần cũ: nếu GitHub đã có tệp đó, web đọc lại và xác minh nội dung trước khi đánh dấu thành công.

## Lưu cục bộ và dữ liệu v4

- **Không xóa kho `trips` IndexedDB cũ** hay các khóa cấu hình/điểm xóc v4. Các hành trình mới ghi vào hai object store riêng `archiveSessions`, `archiveChunks` (IndexedDB `RoadSenseDB`, version 2).
- Chương trình ghi **checkpoint cục bộ khoảng mỗi 15 giây hoặc sau ~250 mẫu**. Khi Upload thủ công, đoạn hiện tại được đóng gói thành phần riêng để có thể tải lên mà không phải DỪNG GHI.
- Nút **Sao lưu toàn bộ JSON** xuất cả `legacyV4.trips`/`roadEvents` và dữ liệu v5. Dữ liệu v4 **chưa tự chuyển thành các tệp `part-*` để Upload**; muốn bảo vệ dữ liệu v4, hãy xuất JSON và tự tải bản sao vào kho riêng tư.
- Không xóa bộ nhớ trang/PWA, reset trình duyệt hoặc gỡ app trước khi sao lưu. Safari/iOS/Android có thể dừng GPS, sensor, timer, sync khi tab sang nền hoặc khóa máy; bản web **không thể đảm bảo thu thập liên tục** trong trường hợp đó.
- Nếu mất Internet, dữ liệu vẫn ở IndexedDB; lần sau mở trang và cung cấp token, nhấn Upload hoặc để chế độ tự động thử lại.

## Hạn chế/bảo mật

- Nếu **RoadSense2 là repo công khai**, người khác có thể xem toàn bộ vị trí GPS mà bạn tải lên. Hãy kiểm tra quyền riêng tư của repository trước khi ghi tuyến đường nhạy cảm.
- GitHub không phải cơ sở dữ liệu telemetry chuyên dụng. Đồng bộ có thể chậm, bị giới hạn tốc độ và không phù hợp cho lượng lớn chuyến đi/người dùng.
- Token được gửi trực tiếp từ trình duyệt qua HTTPS đến `api.github.com`. Token **không nằm trong JSON Upload**, nhưng tùy chọn ghi nhớ token trên máy làm tăng rủi ro.
- Tốc độ gợi ý chỉ là **thử nghiệm**, không thay thế giới hạn tốc độ, biển báo hoặc đánh giá của người lái. Không thao tác trên điện thoại khi đang lái xe.

## Các tệp sửa so với v4

| Tệp | Thay đổi |
|---|---|
| `index.html` | Giao diện ⇪ mới, repository điền sẵn, token, ghi nhớ, cấu hình lịch đồng bộ, nút Upload/JSON/CSV; tải thêm `archive.js`. |
| `script.js` | Kết nối nút ghi với kho mới; ghi raw GPS/sensor, thông tin cân bằng; manual/auto Upload, token, CSV/JSON; nâng IndexedDB version 2. |
| `archive.js` | **Tệp mới** quản lý session-id, ghi checkpoint, chia phần, manifest v1, đồng bộ tăng dần, tránh trùng tệp. |
| `style.css` | Kiểu hiển thị cho các trường GitHub mới. |
| `sw.js` | Đổi cache v5 và lưu thêm `archive.js` offline. |
| `manifest.json` | Chỉnh mô tả PWA. |
| `README.md` | Hướng dẫn phiên bản v5. |
| `icons/*.png` | **Không đổi**. |

**Kiểm thử:** đã kiểm tra cú pháp JS, kiểm thử độc lập kho lưu trữ + GitHub API giả lập (đang ghi → Upload → ghi tiếp → Upload → kết thúc), và mô phỏng giao diện 320–800 px. **Chưa dùng token thật, chưa Upload vào repository thật, chưa xác minh GPS/cảm biến trên điện thoại vật lý.**
