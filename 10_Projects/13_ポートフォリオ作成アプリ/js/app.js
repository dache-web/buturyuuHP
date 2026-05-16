/**
 * 🌟 ポートフォリオ・アプリ制御 (最終パーフェクト版・メール修正込)
 */

let isEditMode = false;
const chatArea = document.getElementById('chatArea');

// --- 🌟 永続化（LocalStorage）処理 ---

(function initStorage() {
  const savedData = localStorage.getItem('portfolioData_saved');
  if (savedData) {
    try {
      const parsed = JSON.parse(savedData);
      Object.assign(portfolioData, parsed);
    } catch (e) { console.error('❌ データ読込失敗:', e); }
  }
})();

function saveToStorage() { localStorage.setItem('portfolioData_saved', JSON.stringify(portfolioData)); }
function onDataChanged() { saveToStorage(); }

function resetPortfolioData() {
  if (confirm('全ての編集内容をリセットして初期状態に戻しますか？')) {
    localStorage.removeItem('portfolioData_saved');
    location.reload();
  }
}

// --- 🌟 アプリ初期化 ---

function initApp() {
  const w = portfolioData.welcome;
  const html = `
    <div class="msg-row msg-bot fade-in-up">
      <div class="avatar" style="align-self: flex-start; margin-top: 5px;">✨</div>
      <div style="max-width: 85%;">
        <div class="bubble bot-bubble carousel-bubble" style="overflow:hidden; border:1px solid #eee; background:#fff !important; box-shadow:0 2px 6px rgba(0,0,0,0.1) !important; max-width:100%; border-radius:16px;">
          <div class="image-edit-box" style="position:relative; cursor:pointer;" onclick="handleImageClick(this, '${w.img}')" ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event, portfolioData.welcome, 'img')">
            <img src="${w.img}" style="width:100%; display:block; border-bottom:2px solid #5EA39C;" onerror="handleImageError(this)">
            <div class="edit-only" style="position:absolute; top:0; left:0; width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:white; background:rgba(0,0,0,0.3); pointer-events:none; font-size:12px;">📷 写真変更</div>
            <input type="file" style="display:none;" onchange="handleImageChange(this, portfolioData.welcome, 'img')">
          </div>
          <div style="padding:12px; font-weight:bold; color:#333; font-size:13px; text-align:left;" data-editable="true" onclick="handleTextClick(this)" onblur="updateTextData(portfolioData.welcome, 'title', this.innerText)">
            ${w.title}
          </div>
        </div>
        <div class="bubble bot-bubble" style="margin-top:10px;" data-editable="true" onclick="handleTextClick(this)" onblur="updateTextData(portfolioData.welcome, 'text', this.innerHTML)">
          ${w.text}
        </div>
      </div>
    </div>
  `;
  chatArea.innerHTML = html;
  if (isEditMode) document.querySelectorAll('[data-editable]').forEach(el => el.contentEditable = true);
}

// --- 🌟 エラーハンドリング ---

function handleImageError(img) {
  const fileName = img.src.split('/').pop() || '画像';
  img.src = `https://placehold.jp/24/62A49B/ffffff/400x400.png?text=📸 写真不足：\n「${fileName}」を\nimagesフォルダにコピーして！`;
}

// --- 🌟 モード・挙動制御 ---

function toggleEditMode() {
  isEditMode = !isEditMode;
  const container = document.querySelector('.app-container');
  const controls = document.getElementById('editControls');
  const toggleBtn = document.getElementById('editToggleBtn');

  if (isEditMode) {
    container.classList.add('editing');
    controls.style.display = 'block';
    toggleBtn.innerHTML = '❌';
    document.querySelectorAll('[data-editable]').forEach(el => el.contentEditable = true);
    alert('【完結版：管理モード】\nQRコードやメールアドレスもすべて直接書き換えられます。');
  } else {
    container.classList.remove('editing');
    controls.style.display = 'none';
    toggleBtn.innerHTML = '⚙';
    document.querySelectorAll('[data-editable]').forEach(el => el.contentEditable = false);
  }
}

function handleImageClick(element, src) {
  if (isEditMode) {
    const input = element.querySelector('input[type="file"]');
    if (input) input.click();
  } else { showImageModal(src); }
}

function handleTextClick(element) { if (isEditMode) element.focus(); }

function showCategoryDetail(catId) {
  if (isEditMode) return;
  const time = getCurrentTime(); const idx = portfolioData.categories.findIndex(c => c.id === catId);
  if (idx !== -1) {
    const category = portfolioData.categories[idx]; appendUserMessage(category.userMessage, time);
    setTimeout(() => appendBotCarousel(generateCarouselHtml(category.slides, `categories[${idx}].slides`, true), time), 700);
  }
}

// 画像反映
function updateImagePreview(file, targetData, key, imgElement) {
  if (file && file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = function(e) {
      if(imgElement) imgElement.src = e.target.result;
      targetData[key] = "images/" + file.name;
      onDataChanged();
    };
    reader.readAsDataURL(file);
  }
}
function handleImageChange(input, targetData, key) {
  if (input.files && input.files[0]) {
    const container = input.closest('.image-edit-box, .profile-img-wrap, .carousel-item');
    const img = container.querySelector('img');
    updateImagePreview(input.files[0], targetData, key, img);
  }
}
function handleDragOver(e) { e.preventDefault(); if (isEditMode) e.currentTarget.style.background = 'rgba(98, 164, 155, 0.4)'; }
function handleDragLeave(e) { if (isEditMode) e.currentTarget.style.background = ''; }
function handleDrop(e, targetData, key) {
  e.preventDefault(); if (!isEditMode) return;
  e.currentTarget.style.background = '';
  const img = e.currentTarget.querySelector('img');
  updateImagePreview(e.dataTransfer.files[0], targetData, key, img);
}
function updateTextData(targetData, key, newValue) {
  targetData[key] = newValue.trim().replace(/<br>/g, "\n");
  onDataChanged();
}

// --- 🌟 項目管理 (CRUD) ---

function addCategory() {
  const newCat = {
    "id": 'cat_' + Date.now(),
    "btnText": "🆕 新カテゴリー",
    "userMessage": "実績が見たい！",
    "slides": [ { "img": "https://placehold.jp/24/62A49B/ffffff/400x400.png?text=タップで写真を入れる", "title": "タイトル", "desc": "説明" } ]
  };
  portfolioData.categories.push(newCat);
  onDataChanged();
  handleMenuClick('category');
}

function deleteCategory(index) {
  if (!confirm('このカテゴリーを削除しますか？')) return;
  portfolioData.categories.splice(index, 1);
  onDataChanged();
  handleMenuClick('category');
}

function addItem(path, type) {
  const list = getRefByPath(path);
  if (!Array.isArray(list)) return;
  let newItem = {};
  if (type === 'slide') newItem = { img: 'https://placehold.jp/24/62A49B/ffffff/400x400.png?text=ここをタップ', title: 'タイトル', desc: '説明' };
  else if (type === 'review') newItem = { name: 'お客様名', text: '感想を入力' };
  else if (type === 'price') newItem = { name: '新プラン', sub: 'サブ', price: '〇〇円', highlight: false };
  list.push(newItem);
  onDataChanged();
  location.reload();
}

function deleteItem(path, index) {
  if (!confirm('削除しますか？')) return;
  const list = getRefByPath(path);
  if (!Array.isArray(list)) return;
  list.splice(index, 1);
  onDataChanged();
  location.reload();
}

function getRefByPath(path) {
  return path.split(/[.\[\]]+/).filter(Boolean).reduce((acc, part) => acc[part], portfolioData);
}

// --- 🌟 HTML生成 ---

function getCategorySelectionHtml() {
  let buttons = portfolioData.categories.map((cat, idx) => `
    <div style="position:relative;">
      <button class="delete-badge edit-only" onclick="deleteCategory(${idx})" style="width:24px; height:24px; top:-10px; right:-10px; font-size:12px;">🗑️</button>
      <button class="btn-primary" style="margin:0; background:#62A49B; width:100%; height:100%; min-height:54px;" onclick="showCategoryDetail('${cat.id}')">
        <span data-editable="true" onclick="event.stopPropagation(); handleTextClick(this);" onblur="updateTextData(portfolioData.categories[${idx}], 'btnText', this.innerText)">${cat.btnText}</span>
      </button>
    </div>
  `).join('');
  const addBtn = `<div class="edit-only" style="grid-column: span 2;"><button class="btn-primary" style="background:#fffbe6; color:#62A49B; border:2px dashed #62A49B; margin:8px 0; width:100%;" onclick="addCategory()">＋ カテゴリーを追加</button></div>`;
  return `<p style="margin:0 0 10px 0;">実績カテゴリーを選択してください😊</p><div style="display:grid; grid-template-columns:1fr 1fr; gap:18px;">${buttons}${addBtn}</div>`;
}

function generateCarouselHtml(slides, dataList, hideText = false) {
  const dots = slides.map((_, i) => `<div class="dot ${i === 0 ? 'active' : ''}"></div>`).join('');
  let items = slides.map((s, idx) => `
    <div class="carousel-item" style="position:relative;">
      <button onclick="deleteItem('${dataList}', ${idx})" class="delete-badge edit-only">🗑️</button>
      <div class="image-edit-box" style="position:relative; cursor:pointer;" onclick="handleImageClick(this, '${s.img}')" ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event, getRefByPath('${dataList}')[${idx}], 'img')">
        <img src="${s.img}" style="display:block; width:100%; aspect-ratio:1/1; object-fit:cover;" onerror="handleImageError(this)">
        <div class="edit-only" style="position:absolute; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center; color:white; font-size:11px; pointer-events:none; text-align:center;">📷 写真変更</div>
        <input type="file" style="display:none;" onchange="handleImageChange(this, getRefByPath('${dataList}')[${idx}], 'img')">
      </div>
      ${!hideText ? `<div class="carousel-info" style="padding:15px; flex:1;"><h4 data-editable="true" onclick="handleTextClick(this)" onblur="updateTextData(getRefByPath('${dataList}')[${idx}], 'title', this.innerText)">${s.title}</h4><p data-editable="true" onclick="handleTextClick(this)" onblur="updateTextData(getRefByPath('${dataList}')[${idx}], 'desc', this.innerText)" style="margin:5px 0 0 0;">${s.desc}</p></div>` : ''}
    </div>
  `).join('');
  items += `<div class="add-slide-item edit-only" onclick="addItem('${dataList}', 'slide')"><div><div style="font-size:24px;">＋</div><div style="font-size:10px; font-weight:bold;">追加</div></div></div>`;
  return `<div class="carousel-container"><div class="carousel" onscroll="updateDots(this)">${items}<div style="flex:0 0 10%;">&nbsp;</div></div><div class="carousel-pagination">${dots}</div></div>`;
}

function getVoiceHtml() {
  const v = portfolioData.reviews;
  const listHtml = v.items.map((item, idx) => `<li style="margin-bottom:8px; list-style:none; background:#f9f9f9; padding:8px; border-radius:6px; border-left:3px solid #62A49B; position:relative;"><button onclick="deleteItem('reviews.items', ${idx})" class="delete-badge edit-only" style="width:20px; height:20px; font-size:10px;">×</button><div data-editable="true" onclick="handleTextClick(this)" onblur="updateTextData(portfolioData.reviews.items[${idx}], 'text', this.innerText)">${item.text}</div><div data-editable="true" onclick="handleTextClick(this)" onblur="updateTextData(portfolioData.reviews.items[${idx}], 'name', this.innerText)" style="text-align:right; font-size:10px; color:#666;"><b>${item.name}</b></div></li>`).join('');
  return `<div style="text-align:center;"><div class="profile-img-wrap" style="position:relative; cursor:pointer;" onclick="handleImageClick(this, '${v.img}')" ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event, portfolioData.reviews, 'img')"><img src="${v.img}" style="width:100%; display:block; margin-bottom:10px;" onerror="handleImageError(this)"><div class="edit-only" style="position:absolute; top:0; left:0; width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:white; background:rgba(0,0,0,0.4); pointer-events:none; font-size:12px;">📷 写真変更</div><input type="file" style="display:none;" onchange="handleImageChange(this, portfolioData.reviews, 'img')"></div><h3 data-editable="true" onclick="handleTextClick(this)" onblur="updateTextData(portfolioData.reviews, 'title', this.innerText)" style="margin:5px 0; color:#62A49B; font-size:16px;">${v.title}</h3><p data-editable="true" onclick="handleTextClick(this)" onblur="updateTextData(portfolioData.reviews, 'desc', this.innerText)" style="font-size:12px; margin:0 0 10px 0; text-align:left; color:#666;">${v.desc}</p><button onclick="addItem('reviews.items', 'review')" class="edit-only" style="width:100%; padding:8px; background:#fffbe6; border:1px dashed #62A49B; color:#62A49B; cursor:pointer; margin-bottom:10px; border-radius:4px;">＋ 感想を追加</button><div style="font-size:12px; text-align:left;">${listHtml}</div></div>`;
}
function getPriceHtml() {
  const pr = portfolioData.pricing;
  const plansHtml = pr.plans.map((p, idx) => `<div style="background:${p.highlight ? '#f5fdfa' : '#f9f9f9'}; border:${p.highlight ? '1px solid #62A49B' : 'none'}; padding:12px; border-radius:8px; text-align:left; margin-bottom:10px; position:relative;"><button onclick="deleteItem('pricing.plans', ${idx})" class="delete-badge edit-only" style="width:20px; height:20px; font-size:10px;">×</button><b data-editable="true" onclick="handleTextClick(this)" onblur="updateTextData(portfolioData.pricing.plans[${idx}], 'name', this.innerText)">${p.name}</b><br><span data-editable="true" onclick="handleTextClick(this)" onblur="updateTextData(portfolioData.pricing.plans[${idx}], 'sub', this.innerText)" style="font-size:12px; color:#666;">${p.sub}</span><br><span data-editable="true" onclick="handleTextClick(this)" onblur="updateTextData(portfolioData.pricing.plans[${idx}], 'price', this.innerText)" style="font-size:14px; font-weight:bold; color:#62A49B;">${p.price}</span><div class="edit-only" style="font-size:9px; margin-top:5px; color:#999;"><input type="checkbox" ${p.highlight ? 'checked' : ''} onchange="portfolioData.pricing.plans[${idx}].highlight=this.checked; onDataChanged();"> おすすめ</div></div>`).join('');
  return `<div style="text-align:center;"><div class="profile-img-wrap" style="position:relative; cursor:pointer;" onclick="handleImageClick(this, '${pr.img}')" ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event, portfolioData.pricing, 'img')"><img src="${pr.img}" style="width:100%; display:block; margin-bottom:10px;" onerror="handleImageError(this)"><div class="edit-only" style="position:absolute; top:0; left:0; width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:white; background:rgba(0,0,0,0.4); pointer-events:none; font-size:12px;">📷 写真変更</div><input type="file" style="display:none;" onchange="handleImageChange(this, portfolioData.pricing, 'img')"></div><h3 data-editable="true" onclick="handleTextClick(this)" onblur="updateTextData(portfolioData.pricing, 'title', this.innerText)" style="margin:5px 15px; color:#62A49B; font-size:16px;">${pr.title}</h3><button onclick="addItem('pricing.plans', 'price')" class="edit-only" style="width:100%; padding:8px; background:#fffbe6; border:1px dashed #62A49B; color:#62A49B; cursor:pointer; margin-bottom:10px; border-radius:4px;">＋ 新規プラン追加</button>${plansHtml}<p data-editable="true" onclick="handleTextClick(this)" onblur="updateTextData(portfolioData.pricing, 'note', this.innerText)" style="font-size:11px; margin-top:10px; color:#999;">${pr.note}</p></div>`;
}
function getProfileHtml() {
  const p = portfolioData.profile;
  return `<div style="text-align:center;"><div class="profile-img-wrap" style="position:relative; cursor:pointer;" onclick="handleImageClick(this, '${p.img}')" ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event, portfolioData.profile, 'img')"><img src="${p.img}" style="width:100%; display:block;" onerror="handleImageError(this)"><div class="edit-only" style="position:absolute; top:0; left:0; width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:white; background:rgba(0,0,0,0.3); pointer-events:none; font-size:12px;">📷 変更</div><input type="file" style="display:none;" onchange="handleImageChange(this, portfolioData.profile, 'img')"></div><h3 data-editable="true" onclick="handleTextClick(this)" onblur="updateTextData(portfolioData.profile, 'title', this.innerText)" style="margin:5px 0; color:#62A49B; font-size:16px;">${p.title}</h3><p data-editable="true" onclick="handleTextClick(this)" onblur="updateTextData(portfolioData.profile, 'desc', this.innerText)" style="font-size:13px; text-align:left; color:#333;">${p.desc}</p></div>`;
}

function getContactHtml() {
  const c = portfolioData.contact;
  return `
    <h3 data-editable="true" onclick="handleTextClick(this)" onblur="updateTextData(portfolioData.contact, 'title', this.innerText)" style="margin:0 0 10px 0; color:#06C755; font-size:16px;">${c.title}</h3>
    <p data-editable="true" onclick="handleTextClick(this)" onblur="updateTextData(portfolioData.contact, 'desc', this.innerText)" style="margin:0 0 15px 0;">${c.desc}</p>
    <div style="background:#f5f5f5; padding:15px; border-radius:12px; text-align:center;">
      <p data-editable="true" onclick="handleTextClick(this)" onblur="updateTextData(portfolioData.contact, 'qrLabel', this.innerText)" style="margin:0 0 10px 0; font-weight:bold; font-size:14px;">${c.qrLabel}</p>
      <div class="image-edit-box" style="position:relative; display:inline-block; border-radius:12px; overflow:hidden; background:white; padding:10px; border:1px solid #ddd; cursor:pointer;" onclick="handleImageClick(this, '${c.qrImg}')" ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event, portfolioData.contact, 'qrImg')">
        <img src="${c.qrImg}" style="width:140px; display:block;" onerror="handleImageError(this)">
        <div class="edit-only" style="position:absolute; top:0; left:0; width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:white; background:rgba(0,0,0,0.5); font-size:11px; pointer-events:none;">📷 写真変更</div>
        <input type="file" style="display:none;" onchange="handleImageChange(this, portfolioData.contact, 'qrImg')">
      </div>
      <p data-editable="true" onclick="handleTextClick(this)" onblur="updateTextData(portfolioData.contact, 'qrSubLabel', this.innerText)" style="font-size: 11px; color: #666; margin:10px 0 0 0;">${c.qrSubLabel}</p>
    </div>
    <div style="margin-top:15px;">
      <a href="mailto:${c.email}" id="contactMailLink" class="btn-primary" style="display:block; text-align:center; text-decoration:none;">✉️ メールでお問い合わせ</a>
      <div class="edit-only" style="margin-top:5px; font-size:11px; color:#666; background:#f0f0f0; padding:10px; border-radius:8px;">
        宛先メールアドレス：<br>
        <span data-editable="true" style="color:#0078d4; font-weight:bold; word-break:break-all;" onclick="handleTextClick(this)" onblur="const val=this.innerText.trim(); portfolioData.contact.email=val; document.getElementById('contactMailLink').href='mailto:'+val; onDataChanged();">${c.email}</span>
      </div>
    </div>`;
}

function getServiceHtml() { return generateCarouselHtml(portfolioData.services, 'services'); }

// 共通機能
function downloadDataJs() {
  const dataString = `/**\n * 🌟 ポートフォリオ・データ管理ファイル\n */\n\nconst portfolioData = ${JSON.stringify(portfolioData, null, 2)};`;
  const blob = new Blob([dataString], { type: 'application/javascript' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'data.js'; a.click();
}
function showImageModal(src) { const modal = document.getElementById('imageModal'); modal.querySelector('img').src = src; modal.classList.add('show'); }
function closeImageModal() { document.getElementById('imageModal').classList.remove('show'); }
function updateDots(carousel) { const dots = carousel.parentElement.querySelectorAll('.dot'); const index = Math.round(carousel.scrollLeft / (carousel.offsetWidth * 0.85)); dots.forEach((dot, i) => dot.classList.toggle('active', i === index)); }
function scrollCarousel(buttonElement, direction) { const carousel = buttonElement.parentElement.querySelector('.carousel'); carousel.scrollBy({ left: carousel.clientWidth * 0.85 * direction, behavior: 'smooth' }); }
function getCurrentTime() { const now = new Date(); return `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`; }
function scrollToBottom() { setTimeout(() => { chatArea.scrollTop = chatArea.scrollHeight; }, 50); }
function toggleRichMenu() { const menu = document.getElementById('richMenu'); const btn = document.getElementById('menuTriggerBtn'); if (menu.classList.contains('closed')) { menu.classList.remove('closed'); btn.innerHTML = 'メニュー ▼'; } else { menu.classList.add('closed'); btn.innerHTML = 'メニュー ▲'; } }
function handleMenuClick(type) {
  const time = getCurrentTime();
  if (type === 'category') { appendUserMessage('カテゴリー別実績が見たい！', time); setTimeout(() => appendBotBubble(getCategorySelectionHtml(), time), 700); }
  else if (type === 'service') { appendUserMessage('サービス内容別の実績が見たい！', time); setTimeout(() => appendBotCarousel(getServiceHtml(), time), 700); }
  else if (type === 'contact') { appendUserMessage('どうやってお問い合わせしたら良い？', time); setTimeout(() => appendBotBubble(getContactHtml(), time), 700); }
  else if (type === 'profile') { appendUserMessage('プロフィールを教えて！', time); setTimeout(() => appendBotBubble(getProfileHtml(), time), 700); }
  else if (type === 'voice') { appendUserMessage('他のお客様の感想は？', time); setTimeout(() => appendBotBubble(getVoiceHtml(), time), 700); }
  else if (type === 'price') { appendUserMessage('料金プランを教えて！', time); setTimeout(() => appendBotBubble(getPriceHtml(), time), 700); }
}
function appendUserMessage(text, time) { chatArea.insertAdjacentHTML('beforeend', `<div class="msg-row msg-user fade-in-up"><div class="msg-time">既読<br>${time}</div><div class="bubble user-bubble">${text}</div></div>`); scrollToBottom(); }
function appendBotBubble(htmlContent, time) { chatArea.insertAdjacentHTML('beforeend', `<div class="msg-row msg-bot fade-in-up"><div class="avatar">✨</div><div class="bubble bot-bubble">${htmlContent}</div><div class="msg-time">${time}</div></div>`); scrollToBottom(); }
function appendBotCarousel(htmlContent, time) { chatArea.insertAdjacentHTML('beforeend', `<div class="msg-row msg-bot fade-in-up"><div class="avatar">✨</div><div class="bubble bot-bubble carousel-bubble"><div class="carousel-wrapper"><button class="scroll-btn prev-btn" onclick="scrollCarousel(this, -1)">◀</button><button class="scroll-btn next-btn" onclick="scrollCarousel(this, 1)">▶</button>${htmlContent}</div></div><div class="msg-time">${time}</div></div>`); scrollToBottom(); }
