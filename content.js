// content.js
(() => {
  // ========== CẤU HÌNH MẶC ĐỊNH ==========
  const DEFAULT_API_URL = 'https://example.com/webhook';
  const DEFAULT_INTERVAL = 5000; // ms
  const MAX_MESSAGES_PER_CONV = 20;
  const MAX_IDS_PER_CONV = 50;
  const MAX_TRACKED_CONVS = 300;
  const PERSIST_KEY = 'zaloExtProcessedMsgs';

  // ===== Cấu hình 2 nhánh xử lý file đính kèm =====
  const TEXT_FILE_EXT = ['docx', 'txt'];
  const BINARY_FILE_EXT = ['pdf', 'png', 'jpg', 'jpeg', 'mp3'];
  const FILE_MIME_MAP = {
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain',
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    mp3: 'audio/mpeg',
  };
  const FILE_PREVIEW_WAIT_MS = 6000;

  // ========== BIẾN TRẠNG THÁI (đã thêm 3 biến mới) ==========
  let apiUrl = DEFAULT_API_URL;
  let interval = DEFAULT_INTERVAL;
  let timer = null;
  let isScanning = false;
  let persistPending = false;
  const processedMsgs = new Map(); // convId -> Set(msgId)

  // 3 biến điều khiển tính năng – mặc định bật (true) khi chưa có giá trị lưu
  let featTextScan = true;
  let featFileAnalysis = true;
  let featImageSend = true;

  // ========== TIỆN ÍCH (giữ nguyên) ==========
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  function getText(el) {
    return el ? el.textContent.replace(/[ \t\u00A0]+/g, ' ').trim() : '';
  }

  function getClassAttr(el) {
    if (!el || !el.getAttribute) return '';
    return el.getAttribute('class') || '';
  }

  function extractPlainText(el) {
    return getText(el);
  }

  function waitForElement(selector, root, timeoutMs) {
    return new Promise((resolve) => {
      const existing = root.querySelector(selector);
      if (existing) { resolve(existing); return; }

      const observer = new MutationObserver(() => {
        const el = root.querySelector(selector);
        if (el) {
          observer.disconnect();
          clearTimeout(timer);
          resolve(el);
        }
      });
      observer.observe(root, { childList: true, subtree: true });

      const timer = setTimeout(() => {
        observer.disconnect();
        resolve(root.querySelector(selector));
      }, timeoutMs);
    });
  }

  function waitForRemoval(selector, root, timeoutMs) {
    return new Promise((resolve) => {
      if (!root.querySelector(selector)) { resolve(true); return; }

      const observer = new MutationObserver(() => {
        if (!root.querySelector(selector)) {
          observer.disconnect();
          clearTimeout(timer);
          resolve(true);
        }
      });
      observer.observe(root, { childList: true, subtree: true });

      const timer = setTimeout(() => {
        observer.disconnect();
        resolve(!root.querySelector(selector));
      }, timeoutMs);
    });
  }

  function base64ToArrayBuffer(base64) {
    const clean = base64.includes(',') ? base64.split(',')[1] : base64;
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }

  function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 31 + str.charCodeAt(i)) | 0;
    }
    return (hash >>> 0).toString(36);
  }

  async function imageToBase64(url) {
    try {
      if (!url || url.startsWith('data:')) return url;
      const resp = await fetch(url, { mode: 'cors' });
      const blob = await resp.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.warn('[ZaloExt] Không chuyển được ảnh:', url, e);
      return url;
    }
  }

  async function fetchBlobAsBase64(url) {
    if (!url) return null;
    try {
      if (url.startsWith('data:')) return url;
      const resp = await fetch(url);
      if (!resp.ok) return null;
      const blob = await resp.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.warn('[ZaloExt] Không tải được blob:', url, e);
      return null;
    }
  }

  async function extractVoiceBase64(voiceNormalEl) {
    if (!voiceNormalEl) return null;
    let rawId = voiceNormalEl.id || '';

    if (!rawId.startsWith('blob:')) {
      const playBtn = voiceNormalEl.querySelector('.voice-message-normal__playback-button-wrapper');
      if (playBtn) {
        playBtn.click();
        await wait(700);
        playBtn.click();
        rawId = voiceNormalEl.id || '';
      }
    }

    if (!rawId.startsWith('blob:')) {
      console.warn('[ZaloExt] Tin thoại chưa có blob URL — bỏ qua audio.');
      return null;
    }

    return fetchBlobAsBase64(rawId);
  }

  const VIEWER_PARAM_BY_HOST = [
    { hostIncludes: 'officeapps.live.com', param: 'src' },
    { hostIncludes: 'drive.google.com', param: 'url' },
  ];

  async function extractFileUrl(msgEl) {
    const trigger = msgEl.querySelector('.file-message__content-info-preview-file')
      || msgEl.querySelector('.file-message__container');
    if (!trigger) {
      console.warn('[ZaloExt] Không tìm thấy trigger preview cho tin file.');
      return null;
    }

    trigger.click();

    const previewEl = await waitForElement('.file-preview', document.body, FILE_PREVIEW_WAIT_MS);
    if (!previewEl) {
      console.warn('[ZaloExt] Đã click preview nhưng không thấy overlay .file-preview.');
      return null;
    }

    let fileUrl = null;
    const iframe = previewEl.querySelector('iframe');
    if (iframe) {
      const iframeSrc = iframe.getAttribute('src') || '';
      const match = VIEWER_PARAM_BY_HOST.find((v) => iframeSrc.includes(v.hostIncludes));
      if (match) {
        try {
          fileUrl = new URL(iframeSrc).searchParams.get(match.param);
        } catch (e) {
          console.warn('[ZaloExt] Không parse được URL từ iframe viewer:', e);
        }
      } else {
        console.warn('[ZaloExt] Viewer lạ chưa được khai báo:', iframeSrc);
        fileUrl = iframeSrc || null;
      }
    } else {
      const mediaEl = previewEl.querySelector('img, audio, audio source, video, video source');
      if (mediaEl) fileUrl = mediaEl.getAttribute('src') || null;
    }

    const closeBtn = previewEl.querySelector('.file-preview__buttons-container .close, .file-preview__header-right .close');
    if (closeBtn) {
      closeBtn.click();
      const closed = await waitForRemoval('.file-preview', document.body, 3000);
      if (!closed) {
        console.warn('[ZaloExt] Overlay vẫn còn sau khi bấm đóng — trạng thái có thể bị ảnh hưởng.');
      }
    } else {
      console.warn('[ZaloExt] Không tìm thấy nút đóng preview.');
    }

    return fileUrl;
  }

  async function fetchFileBinaryViaBackground(url) {
    if (!url) return null;
    try {
      const resp = await chrome.runtime.sendMessage({ action: 'fetchFileBinary', url });
      if (resp && resp.ok) return resp.base64;
      console.warn('[ZaloExt] Background báo lỗi khi fetch file:', resp && resp.error);
      return null;
    } catch (e) {
      console.warn('[ZaloExt] Lỗi gửi message fetchFileBinary tới background:', e);
      return null;
    }
  }

  // ========== LƯU TRẠNG THÁI ĐÃ XỬ LÝ (giữ nguyên) ==========
  function serializeProcessedMsgs() {
    const obj = {};
    for (const [convId, idSet] of processedMsgs.entries()) {
      obj[convId] = Array.from(idSet);
    }
    return obj;
  }

  async function loadProcessedMsgs() {
    try {
      const result = await chrome.storage.local.get([PERSIST_KEY]);
      const saved = result[PERSIST_KEY];
      if (saved && typeof saved === 'object') {
        for (const convId of Object.keys(saved)) {
          processedMsgs.set(convId, new Set(saved[convId]));
        }
        console.log(`[ZaloExt] Đã khôi phục trạng thái đã xử lý cho ${processedMsgs.size} phòng.`);
      }
    } catch (e) {
      console.warn('[ZaloExt] Không đọc được processedMsgs đã lưu:', e);
    }
  }

  function trimProcessedMsgs() {
    for (const [convId, idSet] of processedMsgs.entries()) {
      if (idSet.size > MAX_IDS_PER_CONV) {
        const arr = Array.from(idSet);
        processedMsgs.set(convId, new Set(arr.slice(-MAX_IDS_PER_CONV)));
      }
    }
    while (processedMsgs.size > MAX_TRACKED_CONVS) {
      const oldestKey = processedMsgs.keys().next().value;
      processedMsgs.delete(oldestKey);
    }
  }

  async function saveProcessedMsgs() {
    if (persistPending) return;
    persistPending = true;
    try {
      trimProcessedMsgs();
      await chrome.storage.local.set({ [PERSIST_KEY]: serializeProcessedMsgs() });
    } catch (e) {
      console.warn('[ZaloExt] Không lưu được processedMsgs:', e);
    } finally {
      persistPending = false;
    }
  }

  function touchProcessedConv(convId, idSet) {
    processedMsgs.delete(convId);
    processedMsgs.set(convId, idSet);
  }

  // ========== PHÁT HIỆN PHÒNG CHAT CHƯA ĐỌC (giữ nguyên) ==========
  function getUnreadConversations() {
    const items = document.querySelectorAll('[data-id="div_TabMsg_ThrdChItem"]');
    const unread = [];

    items.forEach((item) => {
      const convInner = item.querySelector('.conv-item') || item;
      const hasUnreadClass = /unread/i.test(getClassAttr(convInner));
      const hasBadge = item.querySelector(
        '.z-noti-badge, .z-noti-badge--dot, .z-noti-badge--number, .unread-count, .badge, [class*="unread" i], [class*="badge" i]'
      );
      const convStatus = item.querySelector('.conv-status');
      const convStatusText = getText(convStatus);

      if (hasUnreadClass || hasBadge || convStatusText !== '') {
        const id = item.getAttribute('anim-data-id');
        if (!id) {
          console.warn('[ZaloExt] Bỏ qua phòng unread vì không lấy được anim-data-id.');
          return;
        }
        const name = getText(item.querySelector('.conv-item-title__name .truncate'));
        const time = getText(item.querySelector('.preview-time'));
        const sender = getText(item.querySelector('.z-conv-message__preview-sender-name')).replace(/:\s*$/, '');
        const isGroup = /^g/i.test(id) || !!item.querySelector('.zavatar-multi');
        const isVerified = !!item.querySelector('[id^="zic_svg-Verified"]');

        unread.push({ id, name, time, sender, isGroup, isVerified, el: item });
      }
    });
    return unread;
  }

  function findConvItemById(id) {
    if (!id) return null;
    return Array.from(document.querySelectorAll('[data-id="div_TabMsg_ThrdChItem"]'))
      .find((item) => item.getAttribute('anim-data-id') === id) || null;
  }

  function findConvMetaById(id) {
    const item = findConvItemById(id);
    if (!item) return null;
    const name = getText(item.querySelector('.conv-item-title__name .truncate'));
    const isGroup = /^g/i.test(id) || !!item.querySelector('.zavatar-multi');
    const isVerified = !!item.querySelector('[id^="zic_svg-Verified"]');
    return { id, name, isGroup, isVerified, el: item };
  }

  function getCurrentConversationName() {
    const headerTitle = document.querySelector('.threadChat__title .header-title');
    return headerTitle ? getText(headerTitle) : '';
  }

  function getCurrentConversationId() {
    const container = document.getElementById('messageViewScroll');
    if (!container) return null;

    const qidEls = container.querySelectorAll('[data-qid]');
    if (!qidEls.length) return null;

    const lastQid = qidEls[qidEls.length - 1].getAttribute('data-qid') || '';
    const parts = lastQid.split('_');
    return (parts.length ? parts[parts.length - 1] : '') || null;
  }

  // ========== TRÍCH XUẤT TIN NHẮN (có điều chỉnh theo toggles) ==========
  async function extractLatestMessages(conv) {
    await wait(800);

    const container = document.getElementById('messageViewScroll');
    if (!container) {
      console.warn(`[ZaloExt] "${conv.name}": không tìm thấy #messageViewScroll`);
      return [];
    }

    const msgItems = Array.from(container.querySelectorAll('.chat-item'));
    if (!msgItems.length) {
      const allEls = container.querySelectorAll('*');
      const classSet = new Set();
      allEls.forEach((el) => {
        const cls = el.getAttribute('class');
        if (cls) classSet.add(cls);
      });
      console.log(
        `[ZaloExt] "${conv.name}": 0 khớp .chat-item. Danh sách class (tối đa 40):`,
        Array.from(classSet).slice(0, 40)
      );
      return [];
    }

    const results = [];
    const processedSet = new Set(processedMsgs.get(conv.id) || []);

    // Xác định tên người gửi cho từng tin (giữ nguyên)
    let lastKnownSender = '';
    const senderNames = msgItems.map((el) => {
      if (el.classList.contains('me')) {
        lastKnownSender = 'Bạn';
        return lastKnownSender;
      }
      const nameEl = el.querySelector('.message-sender-name-wrapper');
      const name = nameEl ? getText(nameEl) : '';
      if (name) lastKnownSender = name;
      return name || lastKnownSender;
    });

    const recentItems = msgItems.slice(-MAX_MESSAGES_PER_CONV);
    const recentSenderNames = senderNames.slice(-MAX_MESSAGES_PER_CONV);

    for (let idx = 0; idx < recentItems.length; idx++) {
      const msgEl = recentItems[idx];
      const bubble = msgEl.querySelector('[data-component="bubble-message"]');
      const qidEl = msgEl.querySelector('[data-qid]');
      const qid = qidEl?.getAttribute('data-qid') || '';
      const bubbleId = bubble?.id?.replace('bb_msg_id_', '') || '';
      const isMe = msgEl.classList.contains('me');
      const sendTime = getText(msgEl.querySelector('.card-send-time__sendTime'));
      const senderName = conv.isGroup ? recentSenderNames[idx] : '';

      let content = '';
      let images = [];
      let hasFile = false;
      let voice = null;
      let fileText = null;
      let fileBase64 = null;
      let fileMimeType = null;

      // ----- TEXT -----
      // CHỈ lấy text nếu featTextScan = true
      let hasText = false;
      if (featTextScan) {
        const textEl = msgEl.querySelector('[data-component="text-container"], .text-message');
        if (textEl) {
          content = extractPlainText(textEl);
          hasText = !!content;
        }
      }

      // ----- FILE -----
      const fileTitleEl = msgEl.querySelector('.file-message__content-title');
      if (fileTitleEl) {
        hasFile = true;
        const fileName = fileTitleEl.getAttribute('title') || getText(fileTitleEl);
        content += ` [File: ${fileName}]`;

        const ext = (fileName.split('.').pop() || '').toLowerCase();
        const isTextExt = TEXT_FILE_EXT.includes(ext);
        const isBinaryExt = BINARY_FILE_EXT.includes(ext);

        // CHỈ xử lý nội dung file nếu featFileAnalysis = true
        if (featFileAnalysis && (isTextExt || isBinaryExt)) {
          const fileUrl = await extractFileUrl(msgEl);
          const base64 = fileUrl ? await fetchFileBinaryViaBackground(fileUrl) : null;

          if (!base64) {
            console.warn(`[ZaloExt] Không lấy được nội dung file "${fileName}" (ext=${ext})`);
          } else if (isTextExt && ext === 'docx') {
            if (typeof mammoth === 'undefined') {
              console.warn('[ZaloExt] Thiếu thư viện mammoth — bỏ qua trích chữ docx.');
            } else {
              try {
                const buf = base64ToArrayBuffer(base64);
                const { value } = await mammoth.extractRawText({ arrayBuffer: buf });
                fileText = value;
              } catch (e) {
                console.warn('[ZaloExt] mammoth lỗi khi đọc docx:', e);
              }
            }
          } else if (isTextExt && ext === 'txt') {
            try {
              fileText = new TextDecoder('utf-8').decode(base64ToArrayBuffer(base64));
            } catch (e) {
              console.warn('[ZaloExt] Lỗi decode file txt:', e);
            }
          } else {
            fileBase64 = base64;
            fileMimeType = FILE_MIME_MAP[ext] || 'application/octet-stream';
          }
        }
      }

      // ----- VOICE (không có toggle, vẫn giữ nguyên) -----
      const voiceNormalEl = msgEl.querySelector('.voice-message-normal');
      if (voiceNormalEl) {
        const voiceDuration = getText(voiceNormalEl.querySelector('.voice-message-normal__meta-duration'));
        voice = await extractVoiceBase64(voiceNormalEl);
        if (voice) {
          content += ` [Voice ${voiceDuration}]`.trim();
        } else {
          content += ` [Voice ${voiceDuration} - không lấy được audio]`.trim();
        }
      }
      const hasVoice = !!voice;

      // ----- IMAGE -----
      // CHỈ lấy ảnh nếu featImageSend = true
      let hasImage = false;
      if (featImageSend) {
        const imgEls = msgEl.querySelectorAll('img.zimg-el, .chatImageMessage--audit img, .photo-message-v2 img');
        for (const imgEl of imgEls) {
          const src = imgEl.getAttribute('src') || '';
          if (src && !src.startsWith('data:')) {
            const base64 = await imageToBase64(src);
            if (base64) images.push(base64);
          } else if (src) {
            images.push(src);
          }
        }
        hasImage = images.length > 0;
      }

      // ----- XÁC ĐỊNH TYPE và lọc tin rỗng -----
      let type;
      if (!hasText && !hasImage && !hasFile && !hasVoice) {
        // Nếu không có gì và người dùng đã tắt text scan thì bỏ qua
        if (!featTextScan || /sticker/i.test(getClassAttr(msgEl))) continue;
        type = 'other';
        content = extractPlainText(msgEl);
        if (!content && !hasImage) continue;
      } else {
        const typeParts = [];
        if (hasText) typeParts.push('text');
        if (hasImage) typeParts.push('image');
        if (hasFile) typeParts.push('file');
        if (hasVoice) typeParts.push('voice');
        type = typeParts.join('+');
      }

      // ----- ID và dedup (giữ nguyên) -----
      let msgId = qid || bubbleId;
      if (!msgId) {
        msgId = `synth_${simpleHash(`${sendTime}|${type}|${content}|${idx}`)}`;
      }

      if (processedSet.has(msgId)) continue;

      results.push({
        msgId,
        isMe,
        senderName,
        sendTime,
        type,
        content: content.trim(),
        images,
        voice,
        fileText,
        fileBase64,
        fileMimeType,
      });

      processedSet.add(msgId);
    }

    console.log(`[ZaloExt] "${conv.name}": xét ${recentItems.length} tin gần nhất → ${results.length} tin MỚI.`);
    touchProcessedConv(conv.id, processedSet);

    return results;
  }

  // ========== GỬI DỮ LIỆU ĐẾN API (giữ nguyên) ==========
  async function sendToAPI(conv, messages) {
    if (!messages.length) return;

    const payload = {
      convId: conv.id,
      convName: conv.name,
      convType: conv.isGroup ? 'group' : (conv.isVerified ? 'oa' : 'personal'),
      isGroup: conv.isGroup,
      isVerified: conv.isVerified,
      time: new Date().toISOString(),
      messages,
    };

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'sendToApi',
        apiUrl: apiUrl,
        body: JSON.stringify(payload)
      });

      if (response && response.ok) {
        console.log(`[ZaloExt] ✓ Gửi ${messages.length} tin từ "${conv.name}" thành công`);
      } else {
        console.error(`[ZaloExt] API trả lỗi:`, response);
      }
    } catch (e) {
      console.error(`[ZaloExt] Lỗi gửi message:`, e);
    }
  }

  // ========== VÒNG QUÉT CHÍNH (giữ nguyên) ==========
  async function scanAndProcess() {
    const processedThisCycle = new Set();

    const currentId = getCurrentConversationId();
    if (currentId) {
      const conv = findConvMetaById(currentId) || {
        id: currentId,
        name: getCurrentConversationName() || 'Đang mở',
        isGroup: false,
        isVerified: false,
      };
      console.log(`[ZaloExt] Kiểm tra phòng đang mở: ${conv.name}`);
      const messages = await extractLatestMessages(conv);
      await sendToAPI(conv, messages);
      processedThisCycle.add(conv.id);
    }

    const unreadConvs = getUnreadConversations().filter((c) => !processedThisCycle.has(c.id));
    if (unreadConvs.length) {
      console.log(`[ZaloExt] Phát hiện ${unreadConvs.length} phòng khác có tin mới.`);
      for (const conv of unreadConvs) {
        const clickTarget = conv.el.querySelector('.gridv2.conv-item') || conv.el;
        clickTarget.click();
        await wait(500);
        const messages = await extractLatestMessages(conv);
        await sendToAPI(conv, messages);
        processedThisCycle.add(conv.id);
      }

      if (currentId) {
        const originalItem = findConvItemById(currentId);
        if (originalItem) {
          const clickTarget = originalItem.querySelector('.gridv2.conv-item') || originalItem;
          clickTarget.click();
        } else {
          console.warn('[ZaloExt] Không thể tự động quay lại phòng ban đầu (dòng đã bị ẩn khỏi sidebar do cuộn ảo hoá).');
        }
      }
    }

    saveProcessedMsgs();
  }

  // ========== QUẢN LÝ VÒNG LẶP (giữ nguyên) ==========
  async function safeScan() {
    if (isScanning) {
      console.warn('[ZaloExt] Bỏ qua lượt quét mới vì lượt trước chưa xong.');
      return;
    }
    isScanning = true;
    try {
      await scanAndProcess();
    } catch (e) {
      console.error('[ZaloExt] Lỗi không mong muốn trong scanAndProcess:', e);
    } finally {
      isScanning = false;
    }
  }

  function startTimer() {
    if (timer) clearInterval(timer);
    timer = setInterval(safeScan, interval);
    console.log(`[ZaloExt] Bắt đầu quét mỗi ${interval}ms, gửi tới: ${apiUrl}`);
  }

  function stopTimer() {
    if (timer) {
      clearInterval(timer);
      timer = null;
      console.log('[ZaloExt] Đã dừng quét.');
    }
  }

  // ========== ĐỌC CẤU HÌNH (đã bổ sung đọc toggles) ==========
  async function loadConfig() {
    try {
      const result = await chrome.storage.sync.get([
        'apiUrl', 'interval', 'enabled',
        'featTextScan', 'featFileAnalysis', 'featImageSend'
      ]);
      if (result.apiUrl) apiUrl = result.apiUrl;
      if (result.interval) interval = Number(result.interval);
      // Gán toggles với giá trị mặc định true nếu chưa từng lưu
      featTextScan = result.featTextScan !== false;
      featFileAnalysis = result.featFileAnalysis !== false;
      featImageSend = result.featImageSend !== false;

      if (result.enabled === true) {
        startTimer();
        safeScan();
      }
    } catch (e) {
      console.warn('[ZaloExt] Không đọc được cấu hình:', e);
    }
  }

  // ========== LẮNG NGHE THAY ĐỔI STORAGE (mới) ==========
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync') {
      if (changes.featTextScan) featTextScan = changes.featTextScan.newValue;
      if (changes.featFileAnalysis) featFileAnalysis = changes.featFileAnalysis.newValue;
      if (changes.featImageSend) featImageSend = changes.featImageSend.newValue;
      console.log('[ZaloExt] Đã cập nhật toggles:', { featTextScan, featFileAnalysis, featImageSend });
    }
  });

  // ========== LẮNG NGHE MESSAGE TỪ POPUP (giữ nguyên) ==========
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'start') {
      apiUrl = request.apiUrl || apiUrl;
      interval = Number(request.interval) || interval;
      chrome.storage.sync.set({ apiUrl, interval, enabled: true });
      stopTimer();
      startTimer();
      safeScan();
      sendResponse({ status: 'started', apiUrl, interval });
    } else if (request.action === 'stop') {
      stopTimer();
      chrome.storage.sync.set({ enabled: false });
      sendResponse({ status: 'stopped' });
    } else if (request.action === 'getStatus') {
      sendResponse({ running: !!timer, apiUrl, interval });
    }
    return true;
  });

  // ========== KHỞI ĐỘNG (giữ nguyên) ==========
  (async () => {
    await loadProcessedMsgs();
    await loadConfig();
  })();
})();

// ============================================================================
// GHI CHÚ TRIỂN KHAI (giữ nguyên như cũ)
// (…)
// ============================================================================