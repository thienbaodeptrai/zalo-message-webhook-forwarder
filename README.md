# 🔄 Zalo Data to Custom Endpoint Forwarder

Một tiện ích mở rộng dành cho trình duyệt Chrome (**Chrome Extension - Manifest V3**) hoạt động trên nền tảng Zalo Web (`https://zalo.me`). Tiện ích này đóng vai trò như một cầu nối dữ liệu tự động, giúp trích xuất nội dung cuộc hội thoại, bóc tách tệp tin văn phòng và chuyển tiếp (forward) dữ liệu thô đến một **Endpoint API tùy chỉnh** (như Webhook, Server riêng, hoặc các LLM API như Gemini, OpenAI) do bạn tự thiết lập.

Dự án được xây dựng theo kiến trúc Manifest V3 hiện đại, sử dụng Service Worker, Content Scripts và Popup UI, đảm bảo hiệu năng và bảo mật tối ưu cho người dùng.

---

## ✨ Tính năng nổi bật

| Tính năng | Mô tả |
| :--- | :--- |
| 📄 **Tự động trích xuất file** | Phát hiện thời gian thực khi bạn mở xem trước file `.docx` và `.pdf` trên Zalo Web, tự động bóc tách nội dung văn bản thuần. |
| 💬 **Quét tin nhắn thông minh** | Cho phép cấu hình bộ lọc (Filter) để thu thập dữ liệu hội thoại thời gian thực theo nhu cầu. |
| 🔄 **Chuyển tiếp linh hoạt** | Đóng gói dữ liệu đã trích xuất (text, metadata) thành định dạng JSON và gửi `POST` request đến Endpoint API do người dùng cấu hình. |
| 🛡️ **Vượt rào bảo mật & Anti-Bot** | Sử dụng Service Worker để thực thi `fetch()` với Cookie/Session Zalo hợp lệ nhằm vượt CORS, tránh lỗi `403 Forbidden`. Kết hợp với Bộ điều phối nhập liệu thông minh để ẩn danh hành vi. |
| ⚙️ **Điều khiển tính năng độc lập** | Giao diện Popup cung cấp các nút gạt (Toggle Switches) riêng biệt: bật/tắt Quét chữ, Phân tích file, Gửi ảnh mà không ảnh hưởng đến các chức năng khác. |
| 🔑 **Bảo mật dữ liệu tối đa** | Không hardcode Endpoint hay API Key. Quyền kết nối mạng được cấp động an toàn qua cơ chế `optional_host_permissions`. Không tự động nhấn nút Gửi (Enter) – quyền quyết định cuối cùng hoàn toàn thuộc về bạn. |

---

## 🧠 Bộ điều phối nhập liệu thông minh (Smart Input Dispatcher)

Khi nhận phản hồi dữ liệu ngược từ Endpoint, extension sẽ tự động điền văn bản vào ô chat Zalo với cơ chế thích ứng, giúp né hoàn toàn hệ thống phát hiện Keyboard Watcher của Zalo.

| Tiêu chí | Văn bản ngắn (< 30 ký tự) | Văn bản dài (≥ 30 ký tự) |
| :--- | :--- | :--- |
| **Phương thức** | 🔹 Giả lập gõ phím (Human Typing) | 🔸 Giả lập dán (Clipboard Paste) |
| **Cơ chế** | Mô phỏng từng phím bấm với độ trễ ngẫu nhiên từ 60ms – 180ms. | Khởi tạo đối tượng `DataTransfer` ảo để dán toàn bộ khối văn bản cùng một lúc. |
| **Mục đích** | Tạo hành vi gõ chữ tự nhiên như người thật, tránh bị hệ thống quét đánh dấu là Bot. | Xử lý nhanh khối lượng text lớn, tối ưu hóa bộ nhớ và tránh lỗi treo tab trình duyệt. |
| **An toàn** | ✅ **Không tự động gửi tin nhắn**. Người dùng nhấn Enter gửi thủ công. | ✅ **Không tự động gửi tin nhắn**. Người dùng nhấn Enter gửi thủ công. |

---

## 🛠️ Hướng dẫn cài đặt & Sử dụng

### 📥 1. Cài đặt Extension (Chế độ nhà phát triển)

* **Bước 1: Tải mã nguồn về máy**
  ```bash
  git clone https://github.com/thienbaodeptrai/zalo-message-webhook-forwarder.git
  ```
  *(Hoặc bạn có thể tải trực tiếp file mã nguồn dạng ZIP về máy và giải nén).*

* **Bước 2: Nạp Extension vào Chrome**
  1. Mở trình duyệt Google Chrome và truy cập đường dẫn: `chrome://extensions/`
  2. Bật công tắc **Chế độ dành cho nhà phát triển (Developer mode)** ở góc phải trên cùng.
  3. Chọn nút **Tải tiện ích đã giải nén (Load unpacked)** ở góc trái.
  4. Duyệt và chọn thư mục chứa toàn bộ mã nguồn dự án của bạn.

* **Bước 3: Ghim tiện ích lên thanh công cụ**
  * Nhấn vào biểu tượng mảnh ghép (Tiện ích) trên thanh công cụ Chrome, tìm extension của dự án và nhấn biểu tượng **Ghim 📌** để hiển thị Popup nhanh.

---

## ⚙️ Cấu hình & Khởi tạo

1. Nhấp vào biểu tượng extension trên thanh công cụ để mở giao diện **Popup**.
2. **Điền thông tin Endpoint:**
   * **API Endpoint:** URL máy chủ nhận dữ liệu của bạn (Ví dụ mẫu: `https://webhook.site/xxx` để thử nghiệm hoặc đường dẫn nội bộ `http://localhost:5000/webhook`).
   * **API Key / Token:** Nhập khóa xác thực của bạn (nếu có).
3. **Cấp quyền động (Optional Host Permission):**
   * Bấm nút **Lưu & Kích Hoạt Quyền** để trình duyệt hiển thị hộp thoại hệ thống xin phép truy cập mạng. Nhấn **Cho phép (Allow)** để hoàn tất kết nối động.
4. **Bật/Tắt tính năng:**
   * Sử dụng các nút gạt (Toggle Switch) trong Popup để bật riêng lẻ từng luồng dữ liệu:
     * 🔍 Quét tin nhắn
     * 📄 Phân tích file
     * 🖼️ Gửi ảnh (nếu có)

> ⚠️ **Lưu ý quan trọng:**
> * Bạn cần duy trì trạng thái đăng nhập hợp lệ trên trang Zalo Web để Service Worker ngầm có thể sử dụng Cookie/Session này thực thi tải các tệp tin xem trước.
> * Bạn có thể nhấn phím `F12` và chuyển qua tab `Console` để theo dõi các log lịch sử hoạt động hoặc debug lỗi nếu có.

---

## 🏗️ Cấu trúc thư mục dự án

```text
zalo-message-webhook-forwarder/
├── manifest.json            # File cấu hình Chrome Extension Manifest V3
├── background.js            # Service Worker xử lý fetch ngầm, truyền tin và bypass CORS
├── content.js               # Content Script nhúng trực tiếp vào trang Zalo để quét DOM
├── popup.html               # Giao diện Popup bảng điều khiển
├── popup.js                 # Logic điều khiển Popup (lưu config, toggles, xin quyền mạng)
├── mammoth.browser.min.js   # Thư viện cục bộ dùng để đọc và parse file Word (.docx)
└── README.md                # Tài liệu hướng dẫn sử dụng dự án
```

---

## 🛡️ Cơ chế bảo mật & An toàn

* **Minh bạch quyền (`optional_host_permissions`):** Extension không tự ý đòi quyền truy cập tất cả website ngay khi cài. Quyền kết nối mạng chỉ được kích hoạt cụ thể khi bạn nhập URL Endpoint của mình và xác nhận, đảm bảo tính chủ động.
* **Service Worker Fetch Proxy:** Mọi request gửi đến Endpoint đều được điều hướng xử lý qua Service Worker, giúp tận dụng Cookie Session của trình duyệt để vượt rào CORS và né triệt để lỗi chặn file `403 Forbidden` của Zalo.
* **An toàn dữ liệu:** Văn bản trích xuất được chuyển thẳng đến URL Endpoint do chính bạn cấu hình, cam kết không lưu trữ trung gian hay gửi về máy chủ bên thứ ba.

---

## 🤝 Đóng góp & Phát triển

Dự án được phát triển theo tinh thần Mã nguồn mở (Open-Source). Mọi ý kiến đóng góp, báo lỗi (Bug Report) hoặc đề xuất tính năng mới đều được hoan nghênh:
1. Fork dự án này.
2. Tạo một nhánh tính năng mới: `git checkout -b feature/AmazingFeature`.
3. Commit các thay đổi của bạn: `git commit -m 'Add some AmazingFeature'`.
4. Push code lên nhánh vừa tạo: `git push origin feature/AmazingFeature`.
5. Mở một **Pull Request** trên GitHub.

---

## 📜 Giấy phép bản quyền (License) & Ghi công

* **Dự án chính:** Được phân phối tự do dưới giấy phép mã nguồn mở **MIT License**. Xem chi tiết tại file `LICENSE`.
* **Thư viện bên thứ ba (Third-party License):** Dự án có tích hợp sẵn file thư viện [Mammoth.js](https://github.com) (Bản quyền © 2012-2024 thuộc về tác giả **Michael Parsons**) dưới giấy phép **BSD 2-Clause License** để phục vụ riêng cho tính năng trích xuất văn bản từ mã nhị phân của tệp tin Word `.docx`.

---

## 📬 Liên hệ & Hỗ trợ

* **Tác giả:** Leon Thien
* **Email:** leonthien24@gmail.com
* **Báo lỗi & Đóng góp:** Tạo thẻ thảo luận trực tiếp tại mục [GitHub Issues](https://github.com/thienbaodeptrai/zalo-message-webhook-forwarder/issues)
