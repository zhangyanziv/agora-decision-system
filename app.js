/* ============================================================
   Agora · app.js
   Agent 社会网络 · 审议中枢 · 五状态交互系统
   ============================================================ */

'use strict';

// ── State ──────────────────────────────────────────────────
const state = {
  mode: 'auto',           // 'auto' | 'manual'
  depth: 'deep',          // 'quick' | 'deep'
  pageState: 'idle',      // 'idle' | 'typing' | 'recommended' | 'manual' | 'launching'
  selectedAgents: new Set(),
  recommendedAgents: new Set(),
  sidebarCollapsed: false,
  idlePulseTimer: null,
  flowAnimTimers: [],
};

// ── Expert Data ────────────────────────────────────────────
const EXPERTS = [
  { id: 'industry',   name: '行业研究员',   role: 'Industry Analyst',     primary: true  },
  { id: 'valuation',  name: '估值分析师',   role: 'Valuation Expert',     primary: true  },
  { id: 'risk',       name: '风险控制官',   role: 'Risk Officer',         primary: true  },
  { id: 'opposition', name: '反方挑战者',   role: "Devil's Advocate",     primary: true  },
  { id: 'macro',      name: '宏观策略师',   role: 'Macro Strategist',     primary: true  },
  { id: 'finance',    name: '财务尽调专家', role: 'Financial Due Diligence', primary: true },
  { id: 'legal',      name: '法律合规顾问', role: 'Legal Compliance',     primary: true  },
  { id: 'sentiment',  name: '市场情绪观察员', role: 'Sentiment Analyst',  primary: true  },
  { id: 'tech',       name: '技术趋势专家', role: 'Tech Trends',          primary: false },
  { id: 'chair',      name: '投委会主席',   role: 'IC Chairman',          primary: false },
  { id: 'supply',     name: '供应链专家',   role: 'Supply Chain',         primary: false },
  { id: 'policy',     name: '政策研究员',   role: 'Policy Researcher',    primary: false },
];

// Auto-recommend mapping (keyword → agent ids)
const AUTO_RECOMMEND_MAP = [
  { keywords: ['投资', '融资', '估值', '股权', '上市', 'ipo'],
    agents: ['valuation', 'finance', 'risk', 'opposition', 'macro', 'legal'] },
  { keywords: ['技术', '产品', '研发', 'ai', '算法', '模型'],
    agents: ['tech', 'industry', 'risk', 'opposition', 'finance'] },
  { keywords: ['市场', '竞争', '用户', '增长', '营销'],
    agents: ['industry', 'sentiment', 'macro', 'opposition', 'valuation'] },
  { keywords: ['风险', '合规', '法律', '监管', '政策'],
    agents: ['legal', 'risk', 'policy', 'macro', 'opposition'] },
  { keywords: ['供应链', '制造', '物流', '采购'],
    agents: ['supply', 'risk', 'macro', 'finance', 'industry'] },
];

// ── Helpers ────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);
const svgNS = 'http://www.w3.org/2000/svg';
const makeSVG = tag => document.createElementNS(svgNS, tag);

function showToast(msg, duration = 2200) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

// ── Init ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  initNavItems();
  positionAgents();
  drawBaseLines();
  initChamber();
  initModeToggle();
  initDepthDropdown();
  initModals();
  initStartBtn();
  startIdleAnimation();

  window.addEventListener('resize', debounce(() => {
    positionAgents();
    drawBaseLines();
    if (state.pageState === 'recommended') drawRecommendLines();
    if (state.pageState === 'manual') drawSelectedLines();
  }, 120));
});

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ── Sidebar ────────────────────────────────────────────────
function initSidebar() {
  $('sidebarToggle').addEventListener('click', () => {
    state.sidebarCollapsed = !state.sidebarCollapsed;
    $('sidebar').classList.toggle('collapsed', state.sidebarCollapsed);
    setTimeout(() => {
      positionAgents();
      drawBaseLines();
    }, 310);
  });
}

function initNavItems() {
  $$('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      $$('.nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
    });
  });
}

// ── Agent Positioning ──────────────────────────────────────
function getStageRect() {
  return $('networkStage').getBoundingClientRect();
}

function positionAgents() {
  const stage = $('networkStage');
  const W = stage.offsetWidth;
  const H = stage.offsetHeight;
  const cx = W / 2;
  const cy = H / 2;

  // Semi-structured offsets for organic social distribution feel
  const LAYOUT_OFFSETS = {
    industry:   { dr: 18,   da: 3   },
    valuation:  { dr: -10,  da: -6  },
    risk:       { dr: 14,   da: 5   },
    opposition: { dr: -8,   da: -8  },
    macro:      { dr: 20,   da: 4   },
    finance:    { dr: -14,  da: 6   },
    legal:      { dr: 10,   da: -4  },
    sentiment:  { dr: -12,  da: 7   },
    tech:       { dr: 16,   da: -3  },
    chair:      { dr: -18,  da: 5   },
    supply:     { dr: 12,   da: -6  },
    policy:     { dr: -8,   da: 4   },
  };

  $$('.agent-node').forEach(node => {
    const id = node.dataset.id;
    const angleDeg = parseFloat(node.dataset.angle || 0);
    const rRatio = parseFloat(node.dataset.rRatio || 0.32);
    const offset = LAYOUT_OFFSETS[id] || { dr: 0, da: 0 };

    const baseR = Math.min(W, H) * rRatio;
    const r = baseR + offset.dr;
    const rad = ((angleDeg + offset.da) * Math.PI) / 180;

    const x = cx + Math.cos(rad) * r;
    const y = cy - Math.sin(rad) * r;

    node.style.left = x + 'px';
    node.style.top  = y + 'px';
  });
}

// ── SVG Line Drawing ───────────────────────────────────────
function clearSVG() {
  const svg = $('flowLinesSvg');
  // Keep defs
  while (svg.lastChild && svg.lastChild.tagName !== 'defs') {
    svg.removeChild(svg.lastChild);
  }
}

function getAgentCenter(id) {
  const node = $('agent-' + id);
  if (!node) return null;
  const stage = $('networkStage');
  const sr = stage.getBoundingClientRect();
  const nr = node.getBoundingClientRect();
  return {
    x: nr.left - sr.left + nr.width / 2,
    y: nr.top  - sr.top  + nr.height / 2,
  };
}

function getChamberCenter() {
  const chamber = $('inquiryChamber');
  const stage   = $('networkStage');
  const cr = chamber.getBoundingClientRect();
  const sr = stage.getBoundingClientRect();
  return {
    x: cr.left - sr.left + cr.width / 2,
    y: cr.top  - sr.top  + cr.height / 2,
  };
}

// Draw base structural lines (very faint, always present)
function drawBaseLines() {
  const svg = $('flowLinesSvg');
  clearSVG();

  const pairs = [
    ['industry', 'valuation'],
    ['valuation', 'risk'],
    ['risk', 'opposition'],
    ['opposition', 'macro'],
    ['macro', 'finance'],
    ['finance', 'legal'],
    ['legal', 'sentiment'],
    ['sentiment', 'industry'],
    ['industry', 'risk'],
    ['valuation', 'opposition'],
    ['macro', 'risk'],
    ['finance', 'valuation'],
    ['legal', 'risk'],
    ['tech', 'industry'],
    ['chair', 'valuation'],
    ['supply', 'macro'],
    ['policy', 'legal'],
  ];

  pairs.forEach(([a, b]) => {
    const pa = getAgentCenter(a);
    const pb = getAgentCenter(b);
    if (!pa || !pb) return;

    const line = makeSVG('line');
    line.setAttribute('x1', pa.x);
    line.setAttribute('y1', pa.y);
    line.setAttribute('x2', pb.x);
    line.setAttribute('y2', pb.y);
    line.setAttribute('stroke', 'rgba(148,163,184,0.2)');
    line.setAttribute('stroke-width', '1');
    svg.appendChild(line);
  });
}

// Draw lines from recommended agents to chamber center
function drawRecommendLines() {
  const svg = $('flowLinesSvg');
  clearSVG();
  drawBaseLines();

  const cc = getChamberCenter();

  state.recommendedAgents.forEach(id => {
    const pa = getAgentCenter(id);
    if (!pa) return;

    // Glow line
    const lineGlow = makeSVG('line');
    lineGlow.setAttribute('x1', pa.x); lineGlow.setAttribute('y1', pa.y);
    lineGlow.setAttribute('x2', cc.x); lineGlow.setAttribute('y2', cc.y);
    lineGlow.setAttribute('stroke', 'rgba(59,130,246,0.12)');
    lineGlow.setAttribute('stroke-width', '4');
    svg.appendChild(lineGlow);

    // Main line
    const line = makeSVG('line');
    line.setAttribute('x1', pa.x); line.setAttribute('y1', pa.y);
    line.setAttribute('x2', cc.x); line.setAttribute('y2', cc.y);
    line.setAttribute('stroke', 'rgba(59,130,246,0.45)');
    line.setAttribute('stroke-width', '1.2');
    line.setAttribute('stroke-dasharray', '4 4');
    line.style.animation = 'dashFlow 2s linear infinite';
    svg.appendChild(line);
  });

  // Lines between recommended agents
  const recArr = [...state.recommendedAgents];
  for (let i = 0; i < recArr.length; i++) {
    for (let j = i + 1; j < recArr.length; j++) {
      const pa = getAgentCenter(recArr[i]);
      const pb = getAgentCenter(recArr[j]);
      if (!pa || !pb) continue;
      const dist = Math.hypot(pa.x - pb.x, pa.y - pb.y);
      if (dist > 400) continue; // skip very distant pairs

      const line = makeSVG('line');
      line.setAttribute('x1', pa.x); line.setAttribute('y1', pa.y);
      line.setAttribute('x2', pb.x); line.setAttribute('y2', pb.y);
      line.setAttribute('stroke', 'rgba(59,130,246,0.18)');
      line.setAttribute('stroke-width', '1');
      svg.appendChild(line);
    }
  }

  // Inject dash animation
  injectDashAnimation(svg);
  spawnPulses(svg, [...state.recommendedAgents], cc);
}

function drawSelectedLines() {
  const svg = $('flowLinesSvg');
  clearSVG();
  drawBaseLines();

  const cc = getChamberCenter();

  state.selectedAgents.forEach(id => {
    const pa = getAgentCenter(id);
    if (!pa) return;

    const lineGlow = makeSVG('line');
    lineGlow.setAttribute('x1', pa.x); lineGlow.setAttribute('y1', pa.y);
    lineGlow.setAttribute('x2', cc.x); lineGlow.setAttribute('y2', cc.y);
    lineGlow.setAttribute('stroke', 'rgba(59,130,246,0.15)');
    lineGlow.setAttribute('stroke-width', '5');
    svg.appendChild(lineGlow);

    const line = makeSVG('line');
    line.setAttribute('x1', pa.x); line.setAttribute('y1', pa.y);
    line.setAttribute('x2', cc.x); line.setAttribute('y2', cc.y);
    line.setAttribute('stroke', 'rgba(59,130,246,0.65)');
    line.setAttribute('stroke-width', '1.5');
    line.setAttribute('stroke-dasharray', '5 3');
    line.style.animation = 'dashFlow 1.8s linear infinite';
    svg.appendChild(line);
  });

  const selArr = [...state.selectedAgents];
  for (let i = 0; i < selArr.length; i++) {
    for (let j = i + 1; j < selArr.length; j++) {
      const pa = getAgentCenter(selArr[i]);
      const pb = getAgentCenter(selArr[j]);
      if (!pa || !pb) continue;
      const dist = Math.hypot(pa.x - pb.x, pa.y - pb.y);
      if (dist > 350) continue;

      const line = makeSVG('line');
      line.setAttribute('x1', pa.x); line.setAttribute('y1', pa.y);
      line.setAttribute('x2', pb.x); line.setAttribute('y2', pb.y);
      line.setAttribute('stroke', 'rgba(59,130,246,0.22)');
      line.setAttribute('stroke-width', '1');
      svg.appendChild(line);
    }
  }

  injectDashAnimation(svg);
  spawnPulses(svg, [...state.selectedAgents], cc);
}

function injectDashAnimation(svg) {
  // dashFlow is defined in style.css — no runtime injection needed
}

// Spawn animated pulse dots along lines
function spawnPulses(svg, agentIds, cc) {
  state.flowAnimTimers.forEach(clearInterval);
  state.flowAnimTimers = [];

  agentIds.forEach((id, idx) => {
    const timer = setInterval(() => {
      const pa = getAgentCenter(id);
      if (!pa) return;
      animatePulse(svg, pa, cc);
    }, 1800 + idx * 400);
    state.flowAnimTimers.push(timer);
  });
}

function animatePulse(svg, from, to) {
  const dot = makeSVG('circle');
  dot.setAttribute('r', '3');
  dot.setAttribute('fill', 'rgba(59,130,246,0.85)');
  dot.setAttribute('filter', 'url(#pulse-filter)');
  svg.appendChild(dot);

  const duration = 1200;
  const start = performance.now();

  function step(now) {
    const t = Math.min((now - start) / duration, 1);
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    const x = from.x + (to.x - from.x) * ease;
    const y = from.y + (to.y - from.y) * ease;
    const opacity = t < 0.1 ? t / 0.1 : t > 0.85 ? (1 - t) / 0.15 : 1;
    dot.setAttribute('cx', x);
    dot.setAttribute('cy', y);
    dot.setAttribute('opacity', opacity);
    if (t < 1) requestAnimationFrame(step);
    else dot.remove();
  }

  requestAnimationFrame(step);
}

// ── Idle Animation ─────────────────────────────────────────
function startIdleAnimation() {
  const primaryNodes = EXPERTS.filter(e => e.primary).map(e => e.id);
  let idx = 0;

  function pulse() {
    // Remove previous pulse
    $$('.agent-node.idle-pulse').forEach(n => n.classList.remove('idle-pulse'));

    // Pulse 1-2 random nodes
    const count = Math.random() > 0.5 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const id = primaryNodes[Math.floor(Math.random() * primaryNodes.length)];
      const node = $('agent-' + id);
      if (node) node.classList.add('idle-pulse');
    }

    // Occasional idle flow line
    if (Math.random() > 0.6) {
      spawnIdleFlow();
    }
  }

  state.idlePulseTimer = setInterval(pulse, 2800);
  pulse();
}

function stopIdleAnimation() {
  clearInterval(state.idlePulseTimer);
  $$('.agent-node.idle-pulse').forEach(n => n.classList.remove('idle-pulse'));
  state.flowAnimTimers.forEach(clearInterval);
  state.flowAnimTimers = [];
}

function spawnIdleFlow() {
  if (state.pageState !== 'idle') return;
  const svg = $('flowLinesSvg');
  const primaries = EXPERTS.filter(e => e.primary).map(e => e.id);
  const a = primaries[Math.floor(Math.random() * primaries.length)];
  let b;
  do { b = primaries[Math.floor(Math.random() * primaries.length)]; } while (b === a);

  const pa = getAgentCenter(a);
  const pb = getAgentCenter(b);
  if (!pa || !pb) return;

  animatePulse(svg, pa, pb);
}

// ── Chamber / Input ────────────────────────────────────────
function initChamber() {
  const textarea = $('chamberInput');

  textarea.addEventListener('focus', () => {
    if (state.pageState === 'idle') {
      setPageState('typing');
    }
  });

  textarea.addEventListener('blur', () => {
    if (state.pageState === 'typing' && !textarea.value.trim()) {
      setPageState('idle');
    }
  });

  let inputTimer = null;
  textarea.addEventListener('input', () => {
    const val = textarea.value.trim();
    if (val && state.mode === 'auto') {
      clearTimeout(inputTimer);
      inputTimer = setTimeout(() => autoRecommend(val), 600);
    } else if (!val && state.pageState !== 'idle') {
      clearTimeout(inputTimer);
      setPageState('typing');
    }
  });
}

function setPageState(newState) {
  const prev = state.pageState;
  state.pageState = newState;

  const chamber = $('inquiryChamber');

  switch (newState) {
    case 'idle':
      chamber.classList.remove('typing');
      startIdleAnimation();
      clearAllHighlights();
      drawBaseLines();
      break;

    case 'typing':
      chamber.classList.add('typing');
      stopIdleAnimation();
      clearAllHighlights();
      drawBaseLines();
      break;

    case 'recommended':
      chamber.classList.add('typing');
      stopIdleAnimation();
      drawRecommendLines();
      break;

    case 'manual':
      chamber.classList.add('typing');
      stopIdleAnimation();
      drawSelectedLines();
      break;

    case 'launching':
      triggerLaunch();
      break;
  }
}

function clearAllHighlights() {
  $$('.agent-node').forEach(n => {
    n.classList.remove('selected', 'recommended');
  });
  state.selectedAgents.clear();
  state.recommendedAgents.clear();
  updateSelectedCount();
}

// ── Auto Recommend ─────────────────────────────────────────
function autoRecommend(text) {
  if (state.mode !== 'auto') return;

  const lower = text.toLowerCase();
  let matched = new Set();

  AUTO_RECOMMEND_MAP.forEach(rule => {
    if (rule.keywords.some(kw => lower.includes(kw))) {
      rule.agents.forEach(id => matched.add(id));
    }
  });

  // Default: recommend core experts if no keyword match
  if (matched.size === 0) {
    ['industry', 'valuation', 'risk', 'opposition', 'finance', 'macro'].forEach(id => matched.add(id));
  }

  // Limit to 6
  const arr = [...matched].slice(0, 6);
  state.recommendedAgents = new Set(arr);

  // Update visual
  $$('.agent-node').forEach(n => n.classList.remove('recommended'));
  arr.forEach(id => {
    const node = $('agent-' + id);
    if (node) node.classList.add('recommended');
  });

  setPageState('recommended');
}

// ── Mode Toggle ────────────────────────────────────────────
function initModeToggle() {
  $$('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      if (mode === state.mode) return;

      state.mode = mode;
      $$('.mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (mode === 'auto') {
        // Switch to auto: clear manual selections
        state.selectedAgents.clear();
        $$('.agent-node').forEach(n => n.classList.remove('selected'));
        $('selectedCount').style.display = 'none';
        updateSelectedCount();

        const val = $('chamberInput').value.trim();
        if (val) {
          autoRecommend(val);
        } else {
          setPageState('typing');
        }

        // Remove manual click handlers
        $$('.agent-node').forEach(n => {
          n.removeEventListener('click', handleManualNodeClick);
        });

      } else {
        // Switch to manual
        state.recommendedAgents.clear();
        $$('.agent-node').forEach(n => n.classList.remove('recommended'));
        $('selectedCount').style.display = 'flex';
        updateSelectedCount();
        setPageState('manual');

        // Add manual click handlers
        $$('.agent-node').forEach(n => {
          n.addEventListener('click', handleManualNodeClick);
        });

        showToast('手动模式：点击专家节点选择参与审议的专家');
      }
    });
  });
}

function handleManualNodeClick(e) {
  if (state.mode !== 'manual') return;
  e.stopPropagation();

  const node = e.currentTarget;
  const id = node.dataset.id;

  if (state.selectedAgents.has(id)) {
    state.selectedAgents.delete(id);
    node.classList.remove('selected');
  } else {
    state.selectedAgents.add(id);
    node.classList.add('selected');
  }

  updateSelectedCount();
  drawSelectedLines();
}

function updateSelectedCount() {
  const num = state.selectedAgents.size;
  $('selectedNum').textContent = num;
}

// ── Depth Dropdown ─────────────────────────────────────────
function initDepthDropdown() {
  $('depthBtn').addEventListener('click', e => {
    e.stopPropagation();
    $('depthDropdown').classList.toggle('show');
  });

  $$('.depth-option').forEach(opt => {
    opt.addEventListener('click', () => {
      $$('.depth-option').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      state.depth = opt.dataset.value;
      $('depthLabel').textContent = opt.querySelector('.depth-name').textContent;
      $('depthDropdown').classList.remove('show');
    });
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.depth-wrapper')) {
      $('depthDropdown').classList.remove('show');
    }
  });
}

// ── Start Button ───────────────────────────────────────────
function initStartBtn() {
  $('startBtn').addEventListener('click', () => {
    const val = $('chamberInput').value.trim();
    if (!val) {
      showToast('请先输入你的问题');
      $('chamberInput').focus();
      return;
    }

    const activeExperts = state.mode === 'auto'
      ? [...state.recommendedAgents]
      : [...state.selectedAgents];

    if (activeExperts.length === 0) {
      showToast('请先选择参与审议的专家');
      return;
    }

    setPageState('launching');
  });
}

function triggerLaunch() {
  const btn = $('startBtn');
  btn.classList.add('launching');
  btn.innerHTML = `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
    审议中…
  `;

  // Converge animation: all active nodes pulse toward center
  const activeIds = state.mode === 'auto'
    ? [...state.recommendedAgents]
    : [...state.selectedAgents];

  const svg = $('flowLinesSvg');
  const cc = getChamberCenter();

  activeIds.forEach((id, i) => {
    setTimeout(() => {
      const pa = getAgentCenter(id);
      if (!pa) return;
      // Multiple pulses converging
      for (let k = 0; k < 3; k++) {
        setTimeout(() => animatePulse(svg, pa, cc), k * 200);
      }
    }, i * 150);
  });

  // After animation, show toast and reset
  setTimeout(() => {
    showToast('审议已启动，正在召集专家…', 3000);
    setTimeout(() => {
      btn.classList.remove('launching');
      btn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
        开始审议
      `;
      // Reset to idle
      $('chamberInput').value = '';
      clearAllHighlights();
      setPageState('idle');
    }, 3200);
  }, activeIds.length * 150 + 800);
}

// ── Modals ─────────────────────────────────────────────────
function initModals() {
  // Knowledge
  $('knowledgeBtn').addEventListener('click', () => openModal('knowledge'));
  $('knowledgeClose').addEventListener('click', () => closeModal('knowledge'));
  $('knowledgeOverlay').addEventListener('click', () => closeModal('knowledge'));
  $('confirmKbBtn').addEventListener('click', () => {
    const selected = [...$$('.kb-checkbox:checked')].map(c => c.value);
    showToast(`已选择知识库：${selected.join('、') || '无'}`);
    closeModal('knowledge');
  });

  // Upload
  $('uploadBtn').addEventListener('click', () => openModal('upload'));
  $('uploadClose').addEventListener('click', () => closeModal('upload'));
  $('uploadOverlay').addEventListener('click', () => closeModal('upload'));

  $$('.file-add-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.closest('.file-item').querySelector('.file-info span').textContent;
      showToast(`已添加材料：${name}`);
      btn.textContent = '已添加';
      btn.style.color = 'var(--accent-blue)';
      btn.style.borderColor = 'rgba(59,130,246,0.3)';
    });
  });
}

function openModal(type) {
  $(`${type}Overlay`).classList.add('show');
  $(`${type}Panel`).classList.add('show');
}

function closeModal(type) {
  $(`${type}Overlay`).classList.remove('show');
  $(`${type}Panel`).classList.remove('show');
}
