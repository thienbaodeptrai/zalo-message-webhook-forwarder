// popup.js
document.addEventListener('DOMContentLoaded', async () => {
  const apiUrlInput = document.getElementById('apiUrl');
  const intervalInput = document.getElementById('interval');
  const intervalHint = document.getElementById('intervalHint');
  const mainToggle = document.getElementById('mainToggle');
  const btnApply = document.getElementById('btnApply');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const statusSub = document.getElementById('statusSub');
  const toast = document.getElementById('toast');
  const webhookLinkRow = document.getElementById('webhookLinkRow');
  const webhookLink = document.getElementById('webhookLink');

  const featTextScan = document.getElementById('featTextScan');
  const featFileAnalysis = document.getElementById('featFileAnalysis');
  const featImageSend = document.getElementById('featImageSend');

  // ========== TIỆN ÍCH UI ==========
  let toastTimer = null;
  function showToast(message, type) {
    toast.textContent = message;
    toast.className = 'toast' + (type ? ' ' + type : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.textContent = '';
      toast.className = 'toast';
    }, 2500);
  }

  function setStatusUI(running, subText) {
    statusDot.className = 'status-dot ' + (running ? 'on' : 'off');
    statusText.textContent = running ? 'Đang chạy' : 'Đã dừng';
    statusSub.textContent = subText || '';
    mainToggle.checked = !!running;
  }

  function updateIntervalHint() {
    const ms = parseInt(intervalInput.value, 10);
    if (!ms || ms < 1000) {
      intervalHint.textContent = 'Tối thiểu 1000ms';
      return;
    }
    const sec = ms / 1000;
    intervalHint.textContent = `= ${sec % 1 === 0 ? sec : sec.toFixed(1)} giây · tối thiểu 1000ms`;
  }
  intervalInput.addEventListener('input', updateIntervalHint);

  // Hàm yêu cầu quyền truy cập origin của API URL (tránh lỗi Failed to fetch)
  async function ensureApiPermission(apiUrl) {
    try {
      const origin = new URL(apiUrl).origin;
      // Kiểm tra xem đã có quyền chưa
      const has = await chrome.permissions.contains({
        origins: [`${origin}/*`]
      });
      if (has) return true;

      // Nếu chưa, yêu cầu người dùng cấp quyền
      const granted = await chrome.permissions.request({
        origins: [`${origin}/*`]
      });
      return granted;
    } catch (e) {
      console.error('Lỗi kiểm tra/yêu cầu quyền:', e);
      return false;
    }
  }

  function updateWebhookLink(url) {
    const match = /^https:\/\/webhook\.site\/([0-9a-f-]{8,})/i.exec(url || '');
    if (match) {
      webhookLink.href = `https://webhook.site/#!/view/${match[1]}`;
      webhookLinkRow.style.display = '';
    } else {
      webhookLinkRow.style.display = 'none';
    }
  }

  async function getActiveZaloTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !tab.url.startsWith('https://chat.zalo.me/')) return null;
    return tab;
  }

  // ========== NẠP CẤU HÌNH ĐÃ LƯU ==========
  let saved = {};
  try {
    saved = await chrome.storage.sync.get([
      'apiUrl', 'interval', 'enabled',
      'featTextScan', 'featFileAnalysis', 'featImageSend',
    ]);
  } catch (e) {
    showToast('Không đọc được cấu hình đã lưu', 'error');
  }

  if (saved.apiUrl) apiUrlInput.value = saved.apiUrl;
  if (saved.interval) intervalInput.value = saved.interval;
  // Mặc định BẬT cả 3 nếu người dùng chưa từng đổi — giữ nguyên hành vi hiện tại
  featTextScan.checked = saved.featTextScan !== false;
  featFileAnalysis.checked = saved.featFileAnalysis !== false;
  featImageSend.checked = saved.featImageSend !== false;
  updateIntervalHint();
  updateWebhookLink(saved.apiUrl);

  // ========== ĐỒNG BỘ TRẠNG THÁI THẬT TỪ CONTENT SCRIPT ==========
  const initialTab = await getActiveZaloTab();
  if (!initialTab) {
    setStatusUI(!!saved.enabled, 'Chưa mở tab Zalo Web — mở https://chat.zalo.me để điều khiển');
  } else {
    try {
      const res = await chrome.tabs.sendMessage(initialTab.id, { action: 'getStatus' });
      setStatusUI(!!(res && res.running), res && res.running ? `Đang gửi tới: ${res.apiUrl}` : '');
    } catch (e) {
      setStatusUI(!!saved.enabled, 'Không kết nối được content script — thử tải lại trang Zalo');
    }
  }

  // ========== CÔNG TẮC BẬT/TẮT CHÍNH ==========
  mainToggle.addEventListener('change', async () => {
    const wantRunning = mainToggle.checked;

    if (wantRunning) {
      const apiUrl = apiUrlInput.value.trim();
      const interval = parseInt(intervalInput.value, 10);
      if (!apiUrl) {
        showToast('Vui lòng nhập API URL', 'error');
        mainToggle.checked = false;
        return;
      }
      if (!interval || interval < 1000) {
        showToast('Chu kỳ phải >= 1000ms', 'error');
        mainToggle.checked = false;
        return;
      }

      const tab = await getActiveZaloTab();
      if (!tab) {
        showToast('Hãy mở Zalo Web trước', 'error');
        mainToggle.checked = false;
        return;
      }

      // 👉 YÊU CẦU QUYỀN TRUY CẬP API TRƯỚC KHI START
      const allowed = await ensureApiPermission(apiUrl);
      if (!allowed) {
        showToast('Bạn chưa cấp quyền truy cập API URL', 'error');
        mainToggle.checked = false;
        return;
      }

      try {
        await chrome.tabs.sendMessage(tab.id, { action: 'start', apiUrl, interval });
        setStatusUI(true, `Đang gửi tới: ${apiUrl}`);
        updateWebhookLink(apiUrl);
        showToast('Đã bắt đầu quét', 'success');
      } catch (e) {
        showToast('Lỗi: ' + e.message, 'error');
        mainToggle.checked = false;
      }
    } else {
      const tab = await getActiveZaloTab();
      if (!tab) {
        showToast('Hãy mở Zalo Web trước', 'error');
        mainToggle.checked = true;
        return;
      }
      try {
        await chrome.tabs.sendMessage(tab.id, { action: 'stop' });
        setStatusUI(false, '');
        showToast('Đã dừng quét', 'success');
      } catch (e) {
        showToast('Lỗi: ' + e.message, 'error');
        mainToggle.checked = true;
      }
    }
  });

  // ========== ÁP DỤNG LẠI API URL / CHU KỲ ==========
  btnApply.addEventListener('click', async () => {
    const apiUrl = apiUrlInput.value.trim();
    const interval = parseInt(intervalInput.value, 10);
    if (!apiUrl) { showToast('Vui lòng nhập API URL', 'error'); return; }
    if (!interval || interval < 1000) { showToast('Chu kỳ phải >= 1000ms', 'error'); return; }

    const tab = await getActiveZaloTab();
    if (!tab) { showToast('Hãy mở Zalo Web trước', 'error'); return; }

    // 👉 YÊU CẦU QUYỀN TRUY CẬP API TRƯỚC KHI ÁP DỤNG
    const allowed = await ensureApiPermission(apiUrl);
    if (!allowed) {
      showToast('Bạn chưa cấp quyền truy cập API URL', 'error');
      return;
    }

    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'start', apiUrl, interval });
      setStatusUI(true, `Đang gửi tới: ${apiUrl}`);
      updateWebhookLink(apiUrl);
      showToast('Đã áp dụng cấu hình mới', 'success');
    } catch (e) {
      showToast('Lỗi: ' + e.message, 'error');
    }
  });

  // ========== 3 CÔNG TẮC TÍNH NĂNG ==========
  // Lưu thẳng vào chrome.storage.sync ngay khi đổi.
  // content.js đã đọc và áp dụng các key này (loadConfig + onChanged).
  function bindFeatureToggle(input, key) {
    input.addEventListener('change', async () => {
      try {
        await chrome.storage.sync.set({ [key]: input.checked });
        showToast('Đã lưu', 'success');
      } catch (e) {
        showToast('Không lưu được: ' + e.message, 'error');
      }
    });
  }
  bindFeatureToggle(featTextScan, 'featTextScan');
  bindFeatureToggle(featFileAnalysis, 'featFileAnalysis');
  bindFeatureToggle(featImageSend, 'featImageSend');
});