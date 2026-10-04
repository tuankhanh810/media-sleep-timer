# Media Sleep Timer — Chrome & Edge Extension (Manifest V3)

Extension hẹn giờ thông minh, tự động tạm dừng phát media trên **YouTube**, **YouTube Music**, **SoundCloud**, và **Spotify Web Player**.

---

## 🌟 Tính Năng Nổi Bật

- **Sleep Timer chuẩn xác**: Sử dụng `chrome.alarms` của Chrome Manifest V3, đảm bảo timer hoạt động bền bỉ ngay cả khi Service Worker bị đình chỉ (suspend) hoặc popup đã đóng.
- **Không bao giờ làm mất tiến trình**:
  - ❌ **Không** đóng tab.
  - ❌ **Không** reload trang.
  - ❌ **Không** chuyển tab đang xem.
  - ❌ **Không** can thiệp âm lượng hệ thống.
  - ❌ **Không** xóa danh sách phát (playlist).
  - ✅ **Chỉ dừng phát (Pause)** media đang chạy.
- **Hỗ trợ đồng thời nhiều tab**: Dừng nhạc/video trên tất cả các tab được hỗ trợ cùng lúc chỉ với một lệnh.
- **Đa dạng chế độ hẹn giờ**:
  - **Nút nhanh (Presets)**: 15 phút, 30 phút, 45 phút, 1 giờ, 1 giờ 30, 2 giờ.
  - **Số phút tùy chọn (Custom Timer)**: Nhập số phút bất kỳ (Ví dụ: `90`).
  - **Giờ cụ thể (Clock Time)**: Đặt thời điểm dừng (Ví dụ: `23:30`). Tự động tính sang ngày mai nếu giờ đã qua.
- **Dừng phát ngay (Instant Pause)**: Quét và dừng toàn bộ media trên các tab ngay lập tức mà không cần chờ đếm ngược.
- **Giao diện hiện đại (Modern Dark UI)**: Thiết kế Dark Mode phong cách glassmorphism, hiển thị đồng hồ số lớn, các trạng thái rõ ràng (🟢 Đang chạy, 🟡 Sắp hết giờ, ⚪ Chưa đặt).
- **Lưu trữ trạng thái tin cậy**: Popup tính toán thời gian dựa trên `endTime - Date.now()`, đóng mở popup hoặc khởi động lại trình duyệt đều giữ nguyên thời gian đếm ngược chính xác.

---

## 📁 Cấu Trúc Thư Mục

```text
d:/Downloads/hẹn giờ/
│
├── manifest.json       # Khai báo extension Manifest V3 & permissions
├── background.js      # Service Worker xử lý alarm, persistence và pause script
├── popup.html         # Giao diện popup Dark Mode
├── popup.css          # Styling giao diện hiện đại & responsive
├── popup.js           # Logic countdown, presets, custom timer, và kết nối background
│
├── icons/             # Bộ icon chuẩn cho extension
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
│
└── README.md          # Hướng dẫn chi tiết
```

---

## 🚀 Hướng Dẫn Cài Đặt

### 1. Cài đặt trên Google Chrome

1. Mở trình duyệt Chrome, truy cập vào đường dẫn:
   ```text
   chrome://extensions/
   ```
2. Ở góc trên bên phải, gạt bật công tắc **Chế độ dành cho nhà phát triển** (**Developer mode**).
3. Nhấp vào nút **Tải tiện ích đã giải nén** (**Load unpacked**).
4. Điều hướng và chọn thư mục:
   ```text
   d:\Downloads\hẹn giờ
   ```
5. Tiện ích **Media Sleep Timer** sẽ xuất hiện trên danh sách extension. Nhấp vào biểu tượng Ghim (Pin) trên thanh công cụ để mở nhanh bất kỳ lúc nào.

### 2. Cài đặt trên Microsoft Edge

1. Mở trình duyệt Microsoft Edge, truy cập:
   ```text
   edge://extensions/
   ```
2. Bật tùy chọn **Chế độ dành cho nhà phát triển** (**Developer mode**) ở menu bên trái.
3. Nhấp vào nút **Tải bản chưa giải nén** (**Load unpacked**).
4. Chọn thư mục:
   ```text
   d:\Downloads\hẹn giờ
   ```
5. Hoàn tất cài đặt!

---

## 🧪 Hướng Dẫn Kiểm Thử (Testing Guide)

### 1. Test tính năng "Dừng phát ngay" (Instant Pause)
1. Mở một tab YouTube và bấm phát một video ca nhạc bất kỳ.
2. Mở một tab SoundCloud hoặc Spotify Web Player và phát nhạc.
3. Mở popup **Media Sleep Timer**.
4. Nhấp vào nút **`⏸ Dừng phát ngay`**.
5. **Kết quả**: Tất cả video/nhạc trên các tab đang phát sẽ lập tức tạm dừng. Popup thông báo: `Đã dừng phát trên 2 tab.` Các tab vẫn giữ nguyên vị trí, không bị reload hay tắt.

### 2. Test hẹn giờ với YouTube
1. Mở tab YouTube và phát video.
2. Mở popup tiện ích, nhập `1` vào ô **Nhập số phút** rồi bấm **Bắt đầu** (hoặc chọn giờ cụ thể cách thời điểm hiện tại 1 phút).
3. Đóng popup hoặc chuyển sang làm việc khác.
4. Chờ 1 phút cho đến khi hết giờ.
5. **Kết quả**: Video YouTube tự động dừng phát, icon tiện ích thông báo hết giờ.

### 3. Test với Spotify Web Player & SoundCloud
- Với **Spotify** (`https://open.spotify.com/*`): Tiện ích sử dụng cơ chế đa tầng — ưu tiên gọi `.pause()` trên phần tử audio HTML5, sau đó fallback kiểm tra nút `control-button-playpause` theo aria-label để đảm bảo dừng phát chuẩn xác mà không vô tình bấm Play trở lại.
- Với **SoundCloud** (`https://soundcloud.com/*`): Tiện ích tạm dừng trực tiếp qua audio element và fallback nút `.playControls__play.playing`.

### 4. Test hủy hẹn giờ
1. Chọn bất kỳ preset nào (ví dụ: `15 phút`).
2. Đồng hồ sẽ đếm ngược: `00:15:00` -> `00:14:59`.
3. Bấm **`✕ Hủy hẹn giờ`**.
4. **Kết quả**: Đồng hồ trở về `00:00:00`, trạng thái chuyển thành `Chưa đặt`, alarm được xóa hoàn toàn và nhạc đang phát không bị ảnh hưởng.

---

## 🔒 Danh Sách Quyền (Permissions) & Giải Thích

| Quyền | Mục đích sử dụng |
| :--- | :--- |
| `alarms` | Hẹn giờ chạy ngầm chính xác trong Manifest V3. Giúp kích hoạt Service Worker đúng thời điểm hẹn ngay cả khi trình duyệt đã cho Service Worker vào trạng thái ngủ (idle suspend). |
| `tabs` | Quét danh sách các tab đang mở để tìm các tab thuộc YouTube, SoundCloud, Spotify đang phát media. |
| `scripting` | Thực thi mã Javascript cục bộ (`pause()`) an toàn bên trong các tab media mục tiêu mà không cần nạp script tĩnh nặng nề vào mọi trang web. |
| `storage` | Lưu trữ trạng thái timer (`endTime`, `timerRunning`, kết quả lần dừng gần nhất) vào bộ nhớ cục bộ trình duyệt `chrome.storage.local`. |
| `host_permissions` | Giới hạn quyền can thiệp chặt chẽ chỉ trên các trang web được người dùng yêu cầu: `youtube.com`, `music.youtube.com`, `soundcloud.com`, `open.spotify.com`. Đảm bảo an toàn và bảo mật tuyệt đối cho dữ liệu duyệt web của người dùng. |
