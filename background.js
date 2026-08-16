// background.js
const API_TIMEOUT_MS = 15000; // Tránh treo vô hạn nếu webhook không phản hồi (content script sẽ chờ mãi nếu không có timeout)
const FILE_FETCH_TIMEOUT_MS = 20000; // File docx/pdf có thể vài MB, cần thời gian dài hơn API_TIMEOUT_MS

// Chuyển ArrayBuffer -> base64 thủ công. Service worker MV3 KHÔNG có FileReader
// (không có DOM), nên không thể dùng cách reader.readAsDataURL() như trong
// content.js (imageToBase64/fetchBlobAsBase64). Chunk theo khối 32KB để tránh
// lỗi "Maximum call stack size exceeded" khi String.fromCharCode(...) nhận
// một mảng quá lớn (file vài MB trở lên).
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const CHUNK_SIZE = 0x8000; // 32KB
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'sendToApi') {
    const { apiUrl, body } = request;

    if (!apiUrl || !/^https?:\/\//i.test(apiUrl)) {
      console.error('[Background] apiUrl không hợp lệ:', apiUrl);
      sendResponse({ ok: false, error: `apiUrl không hợp lệ: ${apiUrl}` });
      return true;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: controller.signal,
    })
      .then(async (resp) => {
        const text = await resp.text();
        console.log(`[Background] Nhận phản hồi ${resp.status} từ ${apiUrl}`);
        sendResponse({ ok: resp.ok, status: resp.status, body: text });
      })
      .catch((err) => {
        const msg = err.name === 'AbortError'
          ? `Timeout: không nhận được phản hồi sau ${API_TIMEOUT_MS / 1000}s`
          : err.message;
        console.error('[Background] Lỗi fetch:', msg);
        sendResponse({ ok: false, error: msg });
      })
      .finally(() => clearTimeout(timeoutId));

    // Bắt buộc return true để giữ kênh giao tiếp cho sendResponse bất đồng bộ
    return true;
  }

  if (request.action === 'fetchFileBinary') {
    const { url } = request;

    if (!url || !/^https?:\/\//i.test(url)) {
      console.error('[Background] URL file không hợp lệ:', url);
      sendResponse({ ok: false, error: `URL file không hợp lệ: ${url}` });
      return true;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FILE_FETCH_TIMEOUT_MS);

    // Fetch từ context extension (service worker) — KHÔNG bị CORS của trang Zalo
    // chi phối, MIỄN LÀ domain này đã được khai trong "host_permissions" của
    // manifest.json (vd "*://*.dlfl.vn/*" — xem ghi chú cuối content.js).
    // URL này là link ký tạm (signed URL có hạn dùng, thấy rõ từ trạng thái
    // "server_temp"/"expired-soon" trong tin nhắn gốc) nên phải fetch NGAY,
    // tuyệt đối không cache URL lại dùng sau.
    fetch(url, { signal: controller.signal })
      .then(async (resp) => {
        if (!resp.ok) {
          sendResponse({ ok: false, error: `HTTP ${resp.status} khi tải file` });
          return;
        }
        const buffer = await resp.arrayBuffer();
        console.log(`[Background] Đã tải file (${buffer.byteLength} bytes) từ ${url}`);
        sendResponse({ ok: true, base64: arrayBufferToBase64(buffer) });
      })
      .catch((err) => {
        const msg = err.name === 'AbortError'
          ? `Timeout: không tải xong file sau ${FILE_FETCH_TIMEOUT_MS / 1000}s`
          : err.message;
        console.error('[Background] Lỗi fetch file:', msg);
        sendResponse({ ok: false, error: msg });
      })
      .finally(() => clearTimeout(timeoutId));

    return true;
  }

  // Không xử lý action nào khác ở đây
  return false;
});
