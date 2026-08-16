# 🔄 Zalo Data to Custom Endpoint Forwarder [UNOFFICIAL]

Một tiện ích mở rộng dành cho trình duyệt Chrome (**Chrome Extension - Manifest V3**) hoạt động trên nền tảng Zalo Web (`https://zalo.me`). Tiện ích này đóng vai trò như một cầu nối dữ liệu tự động, giúp trích xuất nội dung cuộc hội thoại, bóc tách tệp tin văn phòng và chuyển tiếp (forward) dữ liệu thô đến một **Endpoint API tùy chỉnh** (như Webhook, Server riêng, hoặc các LLM API như Gemini, OpenAI) do bạn tự thiết lập.

Dự án được xây dựng theo kiến trúc Manifest V3 hiện đại, sử dụng Service Worker, Content Scripts và Popup UI, đảm bảo hiệu năng và bảo mật tối ưu cho người dùng.

---

## ✨ Tính năng đỉnh cao & Khác biệt cốt lõi

Không chỉ dừng lại ở việc chuyển tiếp tin nhắn thô sơ như các thư viện backend thông thường, dự án sở hữu **khả năng tự động hóa khép kín ở tầng Client** với những tính năng độc quyền mạnh mẽ:

| Tính năng | Mô tả chi tiết & Sức mạnh kỹ thuật |
| :--- | :--- |
| 🚀 **Tự động hóa & Phân tích File Đỉnh cao** | **Vũ khí độc quyền:** Phát hiện thời gian thực ngay khi người dùng mở giao diện xem trước (Preview) file trên Zalo Web. Hệ thống tự động kích hoạt tải ngầm, parse nội dung chữ thô từ mã nhị phân file Word (`.docx` qua `mammoth.js`) và tệp `PDF`. Giải phóng hoàn toàn gánh nặng xử lý file cho máy chủ Backend (Zero-Server-Config). |
| 📸 **Xử lý Đa phương tiện sang Base64 cho AI** | **Nâng cấp Multimodal:** Tự động bắt giữ luồng dữ liệu của **Hình ảnh (JPG/PNG)** và **Tin nhắn thoại (Voice/Audio)** trong đoạn chat. Hệ thống lập tức mã hóa các tệp nhị phân này thành chuỗi dữ liệu sạch (**Inline Base64 String**). Cho phép các mô hình LLM thế hệ mới (Gemini, Claude, OpenAI) có thể trực tiếp "nhìn" hình ảnh và "nghe" giọng nói để phân tích mà không cần qua bước xử lý trung gian nào. |
| 🔄 **Đóng gói Payload & Forward Siêu tốc** | Đóng gói toàn bộ văn bản thô đã trích xuất (`fileText`), dữ liệu đa phương tiện mã hóa (`fileBase64`), tin nhắn thoại, cùng siêu dữ liệu Metadata (ID phòng chat, tên người gửi, thời gian) thành một gói JSON duy nhất và bắn trực tiếp (`POST`) sang Endpoint API tùy chỉnh của bạn. |
| 💬 **Quét hội thoại thời gian thực** | Tích hợp bộ lọc thông minh (Realtime Engine Filter) cho phép bóc tách cấu trúc DOM tin nhắn liên tục, thu thập chính xác luồng dữ liệu hội thoại theo nhu cầu cấu hình. |
| 🛡️ **Bypass Anti-Bot & Vượt rào Bảo mật** | Thực thi lệnh `fetch()` trực tiếp tại môi trường đặc quyền *Service Worker (Background Script)* giúp tự động đính kèm Cookie/Session Zalo hợp lệ của chính trình duyệt. **Bẻ gãy hoàn toàn lỗi chặn file `403 Forbidden`** và chính sách chặn CORS nghiêm ngặt của Zalo Web. |
| ⚙️ **Bảng điều khiển độc lập (Popup UI)** | Thiết kế Modern Toggle Switches hiện đại, cho phép người dùng bật/tắt riêng lẻ các luồng tính năng (Quét chữ, Phân tích file, Gửi ảnh/Voice) một cách linh hoạt mà không làm gián đoạn hệ thống. |
| 🔑 **Bảo mật & Kiểm soát Tuyệt đối** | Nói không với hardcode! Toàn bộ Endpoint/API Key được lưu trữ cục bộ an toàn (`chrome.storage.local`) và cấp quyền động qua `optional_host_permissions`. Đặc biệt, **không tự động nhấn nút Gửi (Enter)** — quyền quyết định cuối cùng luôn thuộc về người dùng thật để đảm bảo an toàn tài khoản 100%. |

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

## 📊 Cấu trúc dữ liệu gửi đến Endpoint (JSON Payload Schema)

Mỗi khi có dữ liệu mới (tin nhắn văn bản hoặc tệp tin văn phòng), extension sẽ đóng gói thông tin dưới định dạng JSON chuẩn mã hóa UTF-8 và thực hiện lệnh `POST` đến Endpoint API của bạn. 

Đối với các trường liên quan đến nội dung tệp tin (`fileText`, `fileBase64`, `fileMimeType`), hệ thống sẽ tự động tối ưu: Trả về **`null` nếu đó là tin nhắn chữ thuần túy**, hoặc **trả về chuỗi văn bản thô/chuỗi dữ liệu mã hóa Inline Base64** tương ứng tùy thuộc vào định dạng file thu thập được.

### 📝 Ví dụ gói tin JSON mẫu (Payload Example):
```json
{
  "convId": "5797335599570623765",
  "convName": "My Documents",
  "convType": "personal",
  "isGroup": false,
  "isVerified": false,
  "time": "2026-08-16T11:20:19.577Z",
  "messages": [
    {
      "msgId": "8156288959334@1786799735262_0_5797335599570623765",
      "isMe": true,
      "senderName": "",
      "sendTime": "20:15",
      "type": "text",
      "content": "dawg",
      "images": [],
      "voice": null,
      "fileText": null,
      "fileBase64": null,
      "fileMimeType": null
    }
  ]
}
```

### 🔍 Giải thích chi tiết các trường dữ liệu:

* **Thông tin phòng chat (Conversation Metadata):**
  * `convId` (*String*): ID định danh duy nhất của cuộc hội thoại trên hệ thống Zalo.
  * `convName` (*String*): Tên của phòng chat hoặc tên của người đang nhắn tin cùng.
  * `convType` (*String*): Phân loại cuộc hội thoại (`personal` cho chat đôi, `group` cho phòng chat nhóm).
  * `isGroup` (*Boolean*): Trạng thái xác định xem đây có phải là nhóm hay không.
  * `isVerified` (*Boolean*): Trạng thái xác thực tài khoản (Tích vàng doanh nghiệp OA).
  * `time` (*String*): Mốc thời gian hệ thống ghi nhận gói tin theo chuẩn ISO 8601.

* **Danh sách tin nhắn (Messages Array):**
  * `msgId` (*String*): ID định danh duy nhất của từng tin nhắn cụ thể.
  * `isMe` (*Boolean*): `true` nếu tin nhắn do chính bạn gửi đi, `false` nếu do người khác gửi đến.
  * `senderName` (*String*): Tên người gửi tin nhắn (Trả về chuỗi rỗng `""` nếu `isMe` là `true`).
  * `sendTime` (*String*): Thời gian gửi hiển thị trên giao diện Zalo (Ví dụ: `"20:15"`).
  * `type` (*String*): Loại tin nhắn (`text`, `file`, `image`, `voice`).
  * `content` (*String*): Nội dung chữ thuần của tin nhắn chat.
  * `images` (*Array*): Mảng chứa danh sách chuỗi Base64 của các hình ảnh đính kèm (Mặc định là mảng rỗng `[]` nếu không phải tin ảnh).
  * `voice` (*String/Null*): Chuỗi dữ liệu âm thanh mã hóa (Trả về `null` nếu không có tin nhắn thoại).

* **Cơ chế xử lý tài liệu đính kèm (File Modality States):**
  * `fileText` (*String/Null*): Trích xuất toàn bộ văn bản thô (Plain Text) bên trong tệp tin Word (`.docx`) sau khi parse thành công qua thư viện `mammoth.js`. Trả về `null` nếu tin nhắn không chứa file Word.
  * `fileBase64` (*String/Null*): Chuỗi mã hóa nhị phân dữ liệu sạch (**Inline Base64 String**) của các tệp tin phức tạp như tệp PDF (`.pdf`), hình ảnh hoặc âm thanh để hệ thống API/LLM bên ngoài có thể trực tiếp xử lý cấu trúc gốc. Trả về `null` đối với tin nhắn văn bản thông thường.
  * `fileMimeType` (*String/Null*): Định dạng định danh internet của tệp tin đính kèm (Ví dụ: `"application/pdf"`, `"application/vnd.openxmlformats-officedocument.wordprocessingml.document"`). Trả về `null` nếu không có file.


---

## 🛠️ Hướng dẫn cài đặt & Sử dụng

### 📥 1. Cài đặt Extension (Chế độ nhà phát triển)

* **Bước 1: Tải mã nguồn về máy**
  ```bash
  git clone https://github.com/thienbaodeptrai/zalo-webhook-extension.git
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
zalo-webhook-extension/
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

---
## ⚠️ Miễn trừ trách nhiệm (Disclaimer)

> 🔴 **QUY ĐỊNH BẮT BUỘC TRƯỚC KHI SỬ DỤNG:**
>
> 1. **Dự án không chính thức (UNOFFICIAL):** Dự án này là một tiện ích mở rộng không chính thức được phát triển thuần túy cho mục đích nghiên cứu học thuật, sử dụng cá nhân và tự động hóa hiệu suất công việc. Dự án hoàn toàn không liên quan, không đại diện cho, không được tài trợ hoặc xác nhận bởi Zalo hoặc bất kỳ nhà cung cấp dịch vụ API/LLM nào khác.
> 2. **Trách nhiệm về dữ liệu:** Người sử dụng tự chịu hoàn toàn trách nhiệm về việc cấu hình Endpoint, bảo mật API Key/Token, cũng như tính nhạy cảm của dữ liệu được thu thập, truyền đi, xử lý hoặc lưu trữ. Tác giả không chịu bất kỳ trách nhiệm nào đối với việc người dùng vô tình hoặc cố ý gửi dữ liệu nhạy cảm, thông tin cá nhân, tài liệu có bản quyền hoặc dữ liệu bảo mật của bên thứ ba đến Endpoint riêng hoặc các dịch vụ bên ngoài.
> 3. **Cung cấp theo nguyên trạng (AS IS):** Tiện ích mở rộng này được cung cấp theo nguyên trạng (AS IS), không kèm theo bất kỳ đảm bảo nào về tính chính xác, tính liên tục của dịch vụ, khả năng tương thích vĩnh viễn với mọi phiên bản giao diện Zalo Web hoặc các thay đổi đột ngột trong cơ chế mã nguồn của website bên thứ ba. Người dùng được khuyến nghị nên tự kiểm tra mã nguồn, rà soát quyền truy cập và bảo mật Endpoint trước khi đưa vào vận hành với dữ liệu quan trọng.
> 4. **Rủi ro tài khoản (Anti-ban):** Việc tự động hóa giao diện có thể vi phạm điều khoản dịch vụ của Zalo. Tác giả không chịu trách nhiệm dưới mọi hình thức nếu tài khoản Zalo của người dùng bị hạn chế tính năng hoặc bị khóa tạm thời/vĩnh viễn. Hãy luôn sử dụng công cụ này một cách có trách nhiệm và tuân thủ các quy định pháp luật hiện hành.
Zalo Web hoặc các thay đổi trong cơ chế của website bên thứ ba. Người dùng nên tự kiểm tra mã nguồn, quyền truy cập và bảo mật Endpoint trước khi sử dụng với dữ liệu quan trọng.
Việc sử dụng có thể vi phạm điều khoản dịch vụ của Zalo. Tác giả không chịu trách nhiệm nếu tài khoản bị khóa. Hãy sử dụng có trách nhiệm
