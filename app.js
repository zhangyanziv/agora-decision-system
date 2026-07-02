/* ===== Agora Decision Review System ===== */

// ===== State =====
const state = {
  sidebarCollapsed: false,
  uploadedFiles: [],
  selectedKBs: ['公开资料库'],
  activeSeats: new Set(['chief', 'evidence', 'opposition', 'risk', 'assumption', 'record']),
  isReviewing: false,
  intensity: 'deep',
};

const CORE_SEATS = ['chief', 'evidence', 'opposition', 'risk', 'assumption', 'record'];
const AUTO_GROUP_EXTRA = ['market', 'finance', 'tech', 'team', 'reverse'];

const EXPERT_SEATS = [
  { id: 'market',      name: '市场分析师',     role: '市场席 · 市场与竞争分析' },
  { id: 'finance',     name: '财务专家',       role: '财务席 · 财务建模与估值' },
  { id: 'team',        name: '团队评估师',     role: '团队席 · 团队与治理' },
  { id: 'risk_expert', name: '风险评估师',     role: '风险席 · 风险管理', seatId: 'risk' },
  { id: 'tech',        name: '技术专家',       role: '技术席 · 技术与产品' },
  { id: 'legal',       name: '法律顾问',       role: '法律席 · 合规与法律' },
  { id: 'quant',       name: '量化分析师',     role: '量化席 · 技术面与量化分析' },
  { id: 'macro',       name: '宏观经济分析师', role: '宏观席 · 宏观与政策' },
  { id: 'esg',         name: 'ESG分析师',      role: 'ESG席 · ESG评估' },
  { id: 'emotion',     name: '情绪分析师',     role: '情绪席 · 市场情绪' },
  { id: 'deal',        name: '交易结构师',     role: '交易结构席 · 交易结构' },
  { id: 'ma',          name: '并购顾问',       role: '并购席 · 并购咨询' },
  { id: 'chain',       name: '链上分析师',     role: '链上席 · 链上分析' },
  { id: 'reverse',     name: '逆向分析师',     role: '逆向席 · 逆向分析 / 反方挑战' },
  { id: 'opportunity', name: '机会发现者',     role: '机会席 · 机会识别' },
  { id: 'host',        name: '讨论主持人',     role: '主持席 · 议程控制与结论收敛' },
];

// ===== Helpers =====
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  initInput();
  positionSeats();
  drawConnections();
  initActionButtons();
  initDrawer();
  initModals();
  initNavItems();
  buildExpertList();
  window.addEventListener('resize', () => {
    positionSeats();
    setTimeout(drawConnections, 50);
  });
});

// ===== Sidebar =====
function initSidebar() {
  $('sidebarToggle').addEventListener('click', () => {
    state.sidebarCollapsed = !state.sidebarCollapsed;
    $('sidebar').classList.toggle('collapsed', state.sidebarCollapsed);
    setTimeout(drawConnections, 300);
  });
}

// ===== Nav =====
function initNavItems() {
  $$('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      $$('.nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
    });
  });
}

// ===== Input Sync =====
function initInput() {
  const input = $('judgmentInput');
  const charCount = $('charCount');
  const centerContent = $('centerContent');
  const centerNode = $('centerNode');
  const centerSublabel = $('centerSublabel');

  function sync() {
    const val = input.value.trim();
    charCount.textContent = input.value.length;
    if (val) {
      centerContent.textContent = val;
      centerSublabel.textContent = '问题核心';
      centerNode.classList.add('glowing');
      input.classList.add('glowing');
    } else {
      centerContent.textContent = '等待输入';
      centerSublabel.textContent = '待审判断';
      centerNode.classList.remove('glowing');
      input.classList.remove('glowing');
    }
  }

  input.addEventListener('input', sync);
  sync();
}

// ===== Seat Positioning =====
function positionSeats() {
  const canvas = $('councilCanvas');
  if (!canvas) return;
  const W = canvas.offsetWidth;
  const H = canvas.offsetHeight;
  const cx = W / 2;
  const cy = H / 2;

  $$('.seat').forEach(seat => {
    const angleDeg = parseFloat(seat.dataset.angle || 0);
    const r = parseFloat(seat.dataset.r || 170);
    // Standard math: 0=right, 90=up, 270=down in screen coords
    // We want 270deg = top of screen, so angle 270 => y decreases
    const rad = (angleDeg * Math.PI) / 180;
    const x = cx + Math.cos(rad) * r;
    const y = cy - Math.sin(rad) * r; // flip y for screen
    seat.style.left = x + 'px';
    seat.style.top = y + 'px';
    seat.style.transform = 'translate(-50%, -50%)';
  });
}

// ===== SVG Connections =====
function drawConnections() {
  const svg = $('connectionsSvg');
  const canvas = $('councilCanvas');
  const centerEl = $('centerNode');
  if (!svg || !canvas || !centerEl) return;

  const cRect = canvas.getBoundingClientRect();
  const nRect = centerEl.getBoundingClientRect();
  const cx = nRect.left - cRect.left + nRect.width / 2;
  const cy = nRect.top - cRect.top + nRect.height / 2;

  // Clear
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  // Defs
  const defs = makeSVGEl('defs');
  // Animated dash style
  const style = makeSVGEl('style');
  style.textContent = `
    .conn-line { stroke-dasharray: 5 5; animation: dashAnim 2s linear infinite; }
    @keyframes dashAnim { to { stroke-dashoffset: -20; } }
    .conn-line-active { stroke-dasharray: 5 5; animation: dashAnim 1.5s linear infinite; }
  `;
  defs.appendChild(style);
  svg.appendChild(defs);

  $$('.seat').forEach(seat => {
    const seatId = seat.dataset.seat;
    const isActive = state.activeSeats.has(seatId);
    if (!isActive) return;

    const sRect = seat.getBoundingClientRect();
    const sx = sRect.left - cRect.left + sRect.width / 2;
    const sy = sRect.top - cRect.top + sRect.height / 2;

    const isCore = seat.classList.contains('core-seat');
    const line = makeSVGEl('line');
    line.setAttribute('x1', cx);
    line.setAttribute('y1', cy);
    line.setAttribute('x2', sx);
    line.setAttribute('y2', sy);
    line.setAttribute('stroke', isCore ? 'rgba(59,130,246,0.3)' : 'rgba(59,130,246,0.2)');
    line.setAttribute('stroke-width', isCore ? '1.5' : '1');
    line.setAttribute('class', isCore ? 'conn-line-active' : 'conn-line');
    svg.appendChild(line);
  });
}

function makeSVGEl(tag) {
  return document.createElementNS('http://www.w3.org/2000/svg', tag);
}

// ===== Action Buttons =====
function initActionButtons() {
  $('autoGroupBtn').addEventListener('click', handleAutoGroup);
  $('manualSelectBtn').addEventListener('click', openDrawer);
  $('uploadBtn').addEventListener('click', () => openModal('upload'));
  $('knowledgeBtn').addEventListener('click', () => openModal('knowledge'));
  $('submitBtn').addEventListener('click', handleSubmit);

  // Intensity dropdown
  $('intensityBtn').addEventListener('click', e => {
    e.stopPropagation();
    $('intensityDropdown').classList.toggle('show');
  });

  $$('.intensity-option').forEach(opt => {
    opt.addEventListener('click', () => {
      $$('.intensity-option').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      state.intensity = opt.dataset.value;
      $('intensityLabel').textContent = '审议强度：' + opt.querySelector('.intensity-name').textContent;
      $('intensityDropdown').classList.remove('show');
    });
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.intensity-wrapper')) {
      $('intensityDropdown').classList.remove('show');
    }
  });
}

// ===== Auto Group =====
function handleAutoGroup() {
  if (state.isReviewing) return;

  // Reset expert seats
  $$('.expert-seat').forEach(s => {
    s.classList.remove('active');
    s.classList.add('inactive');
  });
  state.activeSeats = new Set(CORE_SEATS);
  drawConnections();

  $('autoGroupBtn').classList.add('active');
  $('manualSelectBtn').classList.remove('active');

  // Sequentially activate
  AUTO_GROUP_EXTRA.forEach((seatId, i) => {
    setTimeout(() => {
      activateSeat(seatId);
      if (i === AUTO_GROUP_EXTRA.length - 1) {
        showGroupHint();
        updateLedgerAfterGroup();
        showToast('已自动编组 11 个审议席位', 'blue');
      }
    }, (i + 1) * 280);
  });
}

function activateSeat(seatId) {
  const seat = $('seat-' + seatId);
  if (!seat) return;
  state.activeSeats.add(seatId);
  seat.classList.remove('inactive');
  seat.classList.add('active');
  // Pop animation
  const origTransform = seat.style.transform;
  seat.style.transition = 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease';
  seat.style.opacity = '0';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      seat.style.opacity = '1';
    });
  });
  setTimeout(() => {
    seat.style.transition = '';
    drawConnections();
  }, 450);
}

function deactivateSeat(seatId) {
  if (CORE_SEATS.includes(seatId)) return;
  const seat = $('seat-' + seatId);
  if (!seat) return;
  state.activeSeats.delete(seatId);
  seat.classList.remove('active');
  seat.classList.add('inactive');
  drawConnections();
}

function showGroupHint() {
  const hint = $('groupHint');
  hint.style.display = 'flex';
}

// ===== Submit Review =====
function handleSubmit() {
  if (state.isReviewing) return;
  const val = $('judgmentInput').value.trim();
  if (!val) {
    showToast('请先输入需要审议的判断');
    return;
  }

  state.isReviewing = true;
  const btn = $('submitBtn');
  btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> 审议进行中...`;
  btn.classList.add('reviewing');
  $('headerStatus').textContent = '审议进行中';

  // Show center status
  const cs = $('centerStatus');
  cs.style.display = 'block';
  cs.textContent = '审议中';

  // Seat status updates
  const updates = [
    { id: 'chief',      text: '统筹中',   cls: 's-analyzing', delay: 350 },
    { id: 'evidence',   text: '检索中',   cls: 's-searching', delay: 650 },
    { id: 'opposition', text: '发现冲突', cls: 's-conflict',  delay: 950 },
    { id: 'risk',       text: '分析中',   cls: 's-analyzing', delay: 1250 },
    { id: 'assumption', text: '拆解中',   cls: 's-analyzing', delay: 1550 },
    { id: 'record',     text: '记录中',   cls: 's-recording', delay: 1850 },
  ];

  updates.forEach(({ id, text, cls, delay }) => {
    setTimeout(() => {
      const el = $('status-' + id);
      if (el) { el.textContent = text; el.className = 'seat-status ' + cls; }
      const seat = $('seat-' + id);
      if (seat) seat.classList.add('working');
    }, delay);
  });

  setTimeout(updateLedgerDuring, 900);
  setTimeout(updateLedgerAfter, 2800);

  setTimeout(() => {
    state.isReviewing = false;
    btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> 审议完成`;
    btn.classList.remove('reviewing');
    btn.classList.add('done');
    cs.textContent = '已形成初步审议结果';
    $('headerStatus').textContent = '13 正在审议';
    showToast('已形成初步审议结果', 'green');
  }, 3600);
}

// ===== Ledger =====
function setLedger(key, tagText, tagColor, html) {
  const tag = $('tag-' + key);
  const body = $('body-' + key);
  if (tag) { tag.textContent = tagText; tag.className = 'ledger-tag ' + tagColor; }
  if (body) body.innerHTML = html;
}

function updateLedgerAfterGroup() {
  setLedger('opposition', '待质询', 'red', '<span class="ledger-placeholder">席位已就绪，等待审议启动</span>');
  setLedger('condition', '待生成', 'orange', '<span class="ledger-placeholder">推翻条件将在审议中生成</span>');
  setLedger('evidence', '准备建立', 'blue', '<span class="ledger-placeholder">证据席已激活，准备检索</span>');
  setLedger('source', '公开资料', 'green', '公开资料 + 内部资料');
  setLedger('decision', '待归档', 'purple', '<span class="ledger-placeholder">审议完成后自动归档</span>');
}

function updateLedgerDuring() {
  setLedger('evidence', '收集中', 'blue',
    `公开资料 12 条｜内部材料 4 条｜待验证 5 项
    <div class="evidence-bar"><div class="evidence-bar-fill" id="evidenceBarFill"></div></div>
    <div class="evidence-counts">
      <span class="evidence-count-item"><span class="count-dot blue"></span>公开 12</span>
      <span class="evidence-count-item"><span class="count-dot orange"></span>内部 4</span>
      <span class="evidence-count-item"><span class="count-dot red"></span>待验证 5</span>
    </div>`
  );
  setTimeout(() => {
    const f = $('evidenceBarFill');
    if (f) f.style.width = '72%';
  }, 100);
}

function updateLedgerAfter() {
  const src = buildSourceText();
  setLedger('opposition', '冲突发现', 'red',
    'HKGAI 可能更像政府资助型研发平台，而非可规模化商业公司。'
  );
  setLedger('condition', '待确认', 'orange',
    '若 6–12 个月内无法证明付费客户、续约率与标准化交付能力，则推翻「值得投资」的判断。'
  );
  setLedger('source', '完整', 'green', src || '公开资料 + HKGAI BP.pdf + 融资材料库');
  setLedger('decision', '记录中', 'purple', '本次审议将生成可归档记录');
}

function buildSourceText() {
  const parts = ['公开资料'];
  state.uploadedFiles.forEach(f => parts.push(f));
  state.selectedKBs.filter(k => k !== '公开资料库').forEach(k => parts.push(k));
  return parts.length > 1 ? parts.join(' + ') : '';
}

// ===== Drawer =====
function buildExpertList() {
  const list = $('expertList');
  list.innerHTML = '';
  EXPERT_SEATS.forEach(expert => {
    const seatId = expert.seatId || expert.id;
    const item = document.createElement('label');
    item.className = 'expert-item';
    item.innerHTML = `
      <input type="checkbox" class="expert-checkbox" data-seat="${seatId}">
      <div class="expert-info">
        <div class="expert-name">${expert.name}</div>
        <div class="expert-role">${expert.role}</div>
      </div>
    `;
    const cb = item.querySelector('input');
    cb.addEventListener('change', () => {
      item.classList.toggle('checked', cb.checked);
      if (cb.checked) activateSeat(seatId);
      else deactivateSeat(seatId);
      updateDrawerCount();
    });
    list.appendChild(item);
  });
  updateDrawerCount();
}

function updateDrawerCount() {
  const n = $$('.expert-checkbox:checked').length;
  $('drawerCount').textContent = n + CORE_SEATS.length;
}

function openDrawer() {
  $('drawerOverlay').classList.add('show');
  $('manualDrawer').classList.add('open');
}

function closeDrawer() {
  $('drawerOverlay').classList.remove('show');
  $('manualDrawer').classList.remove('open');
}

function initDrawer() {
  $('drawerOverlay').addEventListener('click', closeDrawer);
  $('drawerClose').addEventListener('click', closeDrawer);
  $('confirmGroupBtn').addEventListener('click', () => {
    const n = $$('.expert-checkbox:checked').length + CORE_SEATS.length;
    closeDrawer();
    showToast(`已确认编组 ${n} 个审议席位`, 'blue');
    drawConnections();
  });
}

// ===== Modals =====
function openModal(type) {
  $(`${type}Overlay`).classList.add('show');
  $(`${type}Panel`).classList.add('show');
}

function closeModal(type) {
  $(`${type}Overlay`).classList.remove('show');
  $(`${type}Panel`).classList.remove('show');
}

function initModals() {
  // Upload
  $('uploadOverlay').addEventListener('click', () => closeModal('upload'));
  $('uploadClose').addEventListener('click', () => closeModal('upload'));

  $$('.file-add-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const file = btn.dataset.file;
      if (!state.uploadedFiles.includes(file)) {
        state.uploadedFiles.push(file);
        btn.textContent = '已添加';
        btn.classList.add('added');
        updateSourceDisplay();
        syncLedgerSource();
        showToast(`已添加：${file}`);
      }
    });
  });

  // Knowledge
  $('knowledgeOverlay').addEventListener('click', () => closeModal('knowledge'));
  $('knowledgeClose').addEventListener('click', () => closeModal('knowledge'));

  $('confirmKbBtn').addEventListener('click', () => {
    state.selectedKBs = Array.from($$('.kb-checkbox:checked')).map(c => c.value);
    updateSourceDisplay();
    syncLedgerSource();
    closeModal('knowledge');
    showToast(`已指定 ${state.selectedKBs.length} 个知识库`);
  });
}

function updateSourceDisplay() {
  const parts = [];
  if (state.uploadedFiles.length > 0) {
    parts.push('公开资料 + ' + state.uploadedFiles.join(' + '));
  }
  const kbs = state.selectedKBs.filter(k => k !== '公开资料库');
  if (kbs.length > 0) {
    if (!parts.length) parts.push('公开资料');
    parts.push('指定知识库：' + kbs.join(' / '));
  }

  const si = $('sourceInfo');
  if (parts.length) {
    $('sourceContent').textContent = parts.join(' · ');
    si.style.display = 'flex';
  } else {
    si.style.display = 'none';
  }
}

function syncLedgerSource() {
  const txt = buildSourceText();
  if (txt) setLedger('source', '完整', 'green', txt);
}

// ===== Toast =====
function showToast(msg, type = '') {
  const t = $('toast');
  t.className = 'toast' + (type ? ' ' + type : '');
  t.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>${msg}`;
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 3000);
}

// ===== Seat click info =====
document.addEventListener('DOMContentLoaded', () => {
  $$('.seat').forEach(seat => {
    seat.addEventListener('click', e => {
      const name = seat.querySelector('.seat-name')?.textContent;
      const desc = seat.querySelector('.seat-desc')?.textContent;
      const isInactive = seat.classList.contains('inactive');
      if (isInactive) {
        showToast(`${name}：${desc}（未激活）`);
      }
    });
  });
});
