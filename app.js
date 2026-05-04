// ═══════════════════════════════════════════════════════════════
// Rage Bait Stylometry Analyzer
// Chinese EmoBank (CVAW + CVAP) - Browser-based analysis
// ═══════════════════════════════════════════════════════════════

const STORAGE_KEY = 'ragebait_posts_v1';

const STATE = {
  lexicon: null,      // { word: {v, a, r} }
  sortedKeys: [],     // sorted by length desc for greedy match
  posts: [],          // user data
};

// ── INIT ───────────────────────────────────────────────────────
async function init() {
  setTodayDate();
  await loadLexicon();
  loadPosts();
  bindEvents();
  refreshUI();
  document.getElementById('loadingScreen').classList.add('hide');
  setTimeout(() => document.getElementById('loadingScreen').remove(), 400);
}

function setTodayDate() {
  const d = new Date();
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  document.getElementById('todayDate').textContent =
    `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

async function loadLexicon() {
  try {
    const res = await fetch('emobank.json');
    if (!res.ok) throw new Error('Lexicon not found');
    STATE.lexicon = await res.json();
    STATE.sortedKeys = Object.keys(STATE.lexicon).sort((a,b) => b.length - a.length);
    document.getElementById('dictCount').textContent =
      Object.keys(STATE.lexicon).length.toLocaleString();
  } catch (e) {
    alert('無法載入詞典 emobank.json — 請確認檔案存在於同一目錄');
    throw e;
  }
}

function loadPosts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    STATE.posts = raw ? JSON.parse(raw) : [];
  } catch { STATE.posts = []; }
}

function savePosts() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(STATE.posts));
}

// ── EVENTS ─────────────────────────────────────────────────────
function bindEvents() {
  // Tab switching
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('view-' + tab.dataset.tab).classList.add('active');
      if (tab.dataset.tab === 'analysis') renderAnalysis();
      if (tab.dataset.tab === 'lexicon') renderLexiconResults('');
    });
  });

  // Form submission
  document.getElementById('postForm').addEventListener('submit', e => {
    e.preventDefault();
    addPost();
  });

  // Export/import buttons
  document.getElementById('btnExportCsv').addEventListener('click', exportCSV);
  document.getElementById('btnExportJson').addEventListener('click', exportJSON);
  document.getElementById('btnImport').addEventListener('click', () =>
    document.getElementById('fileImport').click());
  document.getElementById('fileImport').addEventListener('change', importCSV);
  document.getElementById('btnClear').addEventListener('click', clearAll);

  // Lexicon search
  document.getElementById('lexSearch').addEventListener('input', e => {
    renderLexiconResults(e.target.value.trim());
  });

  // Modal
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target.id === 'modalOverlay') closeModal();
  });
}

// ── ANALYSIS CORE ──────────────────────────────────────────────
function analyzePost(text) {
  if (!text) return null;
  const matched = [];          // [{word, v, a, r, start, end}]
  const segments = [];         // [{type:'plain'|'matched', text, ...}]
  const lex = STATE.lexicon;

  let i = 0;
  let buffer = '';
  while (i < text.length) {
    let found = null;
    // Try longest match first (cap at 6 chars to bound iteration)
    for (let len = Math.min(6, text.length - i); len >= 1; len--) {
      const sub = text.slice(i, i + len);
      if (lex[sub]) {
        found = { word: sub, ...lex[sub], start: i, end: i + len };
        break;
      }
    }
    if (found) {  // allow single-char matches (e.g., 幹、死、賤、操) — trade-off: more false positives
      if (buffer) { segments.push({ type:'plain', text: buffer }); buffer = ''; }
      segments.push({ type:'matched', text: found.word, v: found.v, a: found.a, r: found.r });
      matched.push(found);
      i = found.end;
    } else {
      buffer += text[i];
      i++;
    }
  }
  if (buffer) segments.push({ type:'plain', text: buffer });

  // Aggregate
  const n = matched.length;
  const meanV = n ? matched.reduce((s,m)=>s+m.v,0)/n : null;
  const meanA = n ? matched.reduce((s,m)=>s+m.a,0)/n : null;
  const minV = n ? Math.min(...matched.map(m=>m.v)) : null;
  const maxA = n ? Math.max(...matched.map(m=>m.a)) : null;
  const rageCount = matched.filter(m=>m.r).length;

  // Approx coverage: matched chars / total Chinese chars
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const matchedChars = matched.reduce((s,m)=>s + m.word.length, 0);
  const coverage = chineseChars ? matchedChars / chineseChars : 0;

  // Pronoun counts
  const firstP = (text.match(/我們|我/g) || []).length;
  const secondP = (text.match(/你們|妳們|你|妳/g) || []).length;
  const questionMark = /[?？]/.test(text) ? 1 : 0;
  const exclamationMark = (text.match(/[!！]/g) || []).length;

  return {
    matched, segments, meanV, meanA, minV, maxA,
    rageCount, coverage, charCount: text.length,
    chineseChars, firstP, secondP, questionMark, exclamationMark,
  };
}

// ── ADD POST ───────────────────────────────────────────────────
function addPost() {
  const content = document.getElementById('f_content').value.trim();
  if (!content) return;
  const post = {
    id: Date.now(),
    content,
    likes: parseInt(document.getElementById('f_likes').value) || 0,
    comments: parseInt(document.getElementById('f_comments').value) || 0,
    shares: parseInt(document.getElementById('f_shares').value) || 0,
    date: document.getElementById('f_date').value || '',
    account: document.getElementById('f_account').value.trim() || '',
    topic: document.getElementById('f_topic').value || '',
    url: document.getElementById('f_url').value.trim() || '',
    createdAt: new Date().toISOString(),
  };
  STATE.posts.unshift(post);
  savePosts();
  document.getElementById('postForm').reset();
  refreshUI();
  toast(`已新增第 ${STATE.posts.length} 篇貼文`);
  document.getElementById('f_content').focus();
}

function deletePost(id) {
  if (!confirm('確定要刪除這篇貼文？')) return;
  STATE.posts = STATE.posts.filter(p => p.id !== id);
  savePosts();
  refreshUI();
  toast('已刪除');
}

// ── UI REFRESH ─────────────────────────────────────────────────
function refreshUI() {
  const n = STATE.posts.length;
  document.getElementById('postCount').textContent = n;
  document.getElementById('statTotalPosts').textContent = n;

  let totalLikes = 0, covSum = 0, covN = 0;
  STATE.posts.forEach(p => {
    totalLikes += p.likes || 0;
    const a = analyzePost(p.content);
    if (a) { covSum += a.coverage; covN++; }
  });
  document.getElementById('statTotalLikes').textContent = totalLikes.toLocaleString();
  document.getElementById('statCoverage').textContent =
    covN ? (covSum/covN*100).toFixed(0)+'%' : '—';
  document.getElementById('corpusMeta').textContent = `CORPUS · ${n} 篇貼文`;

  renderPostsList();
}

function renderPostsList() {
  const wrap = document.getElementById('postsList');
  if (!STATE.posts.length) {
    wrap.innerHTML = `
      <div class="empty-state">
        <div class="glyph">∅</div>
        <div class="empty-state-title">尚未新增任何貼文</div>
        <div>從上方表單開始填寫，或匯入既有的 CSV</div>
      </div>`;
    return;
  }

  wrap.innerHTML = STATE.posts.map((p, idx) => {
    const a = analyzePost(p.content);
    const num = String(STATE.posts.length - idx).padStart(3, '0');
    const segHtml = a.segments.map(s => {
      if (s.type === 'plain') return escapeHtml(s.text);
      const cls = s.r ? 'matched rage' : 'matched';
      return `<span class="${cls}" data-tip="V=${s.v} A=${s.a}${s.r?' · RAGE':''}">${escapeHtml(s.text)}</span>`;
    }).join('');

    const vaText = a.meanV !== null
      ? `V <strong>${a.meanV.toFixed(2)}</strong> · A <strong>${a.meanA.toFixed(2)}</strong>`
      : 'V — · A —';

    return `
      <div class="post-item" data-id="${p.id}">
        <div class="post-num">${num}</div>
        <div class="post-content">
          <div class="post-text">${segHtml}</div>
          <div class="post-meta">
            <span class="post-meta-item va">${vaText}</span>
            <span class="post-meta-item">RAGE <strong>${a.rageCount}</strong></span>
            <span class="post-meta-item">字數 <strong>${a.charCount}</strong></span>
            <span class="post-meta-item">覆蓋 <strong>${(a.coverage*100).toFixed(0)}%</strong></span>
            ${p.date ? `<span class="post-meta-item">📅 ${p.date}</span>` : ''}
            ${p.account ? `<span class="post-meta-item">${escapeHtml(p.account)}</span>` : ''}
            ${p.topic ? `<span class="post-meta-item">#${p.topic}</span>` : ''}
          </div>
        </div>
        <div class="post-actions">
          <div class="engagement">
            <div class="engagement-stat"><span class="num">${(p.likes||0).toLocaleString()}</span><span class="lbl">LIKE</span></div>
            <div class="engagement-stat"><span class="num">${(p.comments||0).toLocaleString()}</span><span class="lbl">CMT</span></div>
            <div class="engagement-stat"><span class="num">${(p.shares||0).toLocaleString()}</span><span class="lbl">SHR</span></div>
          </div>
          <div style="display:flex;gap:6px;">
            <button class="btn-icon" data-act="view" data-id="${p.id}" title="檢視詳細">→</button>
            <button class="btn-icon" data-act="del" data-id="${p.id}" title="刪除">×</button>
          </div>
        </div>
      </div>`;
  }).join('');

  // Bind hover tooltips
  wrap.querySelectorAll('.matched').forEach(el => {
    el.addEventListener('mouseenter', e => showTip(e, el.dataset.tip));
    el.addEventListener('mouseleave', hideTip);
  });
  // Bind action buttons
  wrap.querySelectorAll('[data-act]').forEach(btn => {
    btn.addEventListener('click', e => {
      const id = parseInt(btn.dataset.id);
      if (btn.dataset.act === 'del') deletePost(id);
      else if (btn.dataset.act === 'view') showPostDetail(id);
    });
  });
}

// ── TOOLTIP ────────────────────────────────────────────────────
function showTip(e, text) {
  const t = document.getElementById('tooltip');
  t.textContent = text;
  t.classList.add('show');
  const rect = e.target.getBoundingClientRect();
  t.style.left = (rect.left + rect.width/2) + 'px';
  t.style.top = (rect.top + window.scrollY) + 'px';
}
function hideTip() { document.getElementById('tooltip').classList.remove('show'); }

// ── DETAIL MODAL ──────────────────────────────────────────────
function showPostDetail(id) {
  const p = STATE.posts.find(x => x.id === id);
  if (!p) return;
  const a = analyzePost(p.content);

  const wordsByQuad = { Q1:[], Q2:[], Q3:[], Q4:[] };
  a.matched.forEach(m => {
    const q = m.v < 5 && m.a >= 5 ? 'Q2'
            : m.v >= 5 && m.a >= 5 ? 'Q1'
            : m.v < 5 && m.a < 5 ? 'Q3' : 'Q4';
    wordsByQuad[q].push(m);
  });

  document.getElementById('modalTitle').textContent =
    `貼文 #${String(STATE.posts.findIndex(x=>x.id===id)+1).padStart(3,'0')} 詳細分析`;

  document.getElementById('modalBody').innerHTML = `
    <div style="margin-bottom:24px;padding:16px;background:var(--paper-dark);border-left:3px solid var(--accent);">
      <div style="font-family:'Noto Serif TC',serif;line-height:1.7;font-size:15px;">
        ${a.segments.map(s => s.type==='plain' ? escapeHtml(s.text) :
          `<span class="${s.r?'matched rage':'matched'}">${escapeHtml(s.text)}</span>`).join('')}
      </div>
    </div>

    <h4 style="font-family:'Noto Serif TC',serif;font-weight:700;margin-bottom:12px;font-size:14px;">情感量化指標</h4>
    <table style="width:100%;font-size:12px;margin-bottom:24px;border-collapse:collapse;">
      <tr><td style="padding:6px 0;color:var(--ink-fade);">平均 Valence</td><td style="font-family:monospace;text-align:right;font-weight:500;">${a.meanV?a.meanV.toFixed(3):'—'}</td></tr>
      <tr><td style="padding:6px 0;color:var(--ink-fade);">平均 Arousal</td><td style="font-family:monospace;text-align:right;font-weight:500;">${a.meanA?a.meanA.toFixed(3):'—'}</td></tr>
      <tr><td style="padding:6px 0;color:var(--ink-fade);">最低 Valence（最負面詞）</td><td style="font-family:monospace;text-align:right;">${a.minV?a.minV.toFixed(2):'—'}</td></tr>
      <tr><td style="padding:6px 0;color:var(--ink-fade);">最高 Arousal（最激動詞）</td><td style="font-family:monospace;text-align:right;">${a.maxA?a.maxA.toFixed(2):'—'}</td></tr>
      <tr><td style="padding:6px 0;color:var(--ink-fade);">Rage 詞數量</td><td style="font-family:monospace;text-align:right;font-weight:700;color:var(--accent);">${a.rageCount}</td></tr>
      <tr><td style="padding:6px 0;color:var(--ink-fade);">第一人稱（我/我們）</td><td style="font-family:monospace;text-align:right;">${a.firstP}</td></tr>
      <tr><td style="padding:6px 0;color:var(--ink-fade);">第二人稱（你/你們）</td><td style="font-family:monospace;text-align:right;">${a.secondP}</td></tr>
      <tr><td style="padding:6px 0;color:var(--ink-fade);">驚嘆號數</td><td style="font-family:monospace;text-align:right;">${a.exclamationMark}</td></tr>
      <tr><td style="padding:6px 0;color:var(--ink-fade);">含問號</td><td style="font-family:monospace;text-align:right;">${a.questionMark?'是':'否'}</td></tr>
    </table>

    <h4 style="font-family:'Noto Serif TC',serif;font-weight:700;margin-bottom:12px;font-size:14px;">對應詞彙（依四象限）</h4>
    ${['Q2_憤怒激動','Q1_興奮正向','Q3_悲傷低落','Q4_平靜滿足'].map(q => {
      const code = q.split('_')[0];
      const words = wordsByQuad[code];
      if (!words.length) return '';
      return `
        <div style="margin-bottom:14px;">
          <div style="font-size:11px;color:var(--ink-fade);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:6px;">
            ${q.replace('_', ' · ')} （${words.length}）
          </div>
          <div class="matched-words-list">
            ${words.map(w => `<span class="matched-word-chip${w.r?' rage':''}">${w.word}<span class="va">${w.v}/${w.a}</span></span>`).join('')}
          </div>
        </div>`;
    }).join('')}
  `;
  document.getElementById('modalOverlay').classList.add('show');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('show');
}

// ── ANALYSIS DASHBOARD ─────────────────────────────────────────
function renderAnalysis() {
  const n = STATE.posts.length;
  document.getElementById('analysisN').textContent = `N = ${n}`;

  if (n < 5) {
    document.getElementById('analysisContent').innerHTML = `
      <div class="empty-state">
        <div class="glyph">N</div>
        <div class="empty-state-title">尚無足夠資料進行分析</div>
        <div>請先於「資料蒐集」分頁輸入至少 5 篇貼文（目前 ${n} 篇）</div>
      </div>`;
    return;
  }

  // Compute features for all posts
  const data = STATE.posts.map(p => {
    const a = analyzePost(p.content);
    return {
      ...p,
      total: (p.likes||0) + (p.comments||0) + (p.shares||0),
      meanV: a.meanV, meanA: a.meanA,
      minV: a.minV, maxA: a.maxA,
      rageCount: a.rageCount,
      rageRatio: a.chineseChars ? a.rageCount/a.chineseChars*100 : 0,
      charCount: a.charCount,
      firstP: a.firstP, secondP: a.secondP,
      exclamation: a.exclamationMark, question: a.questionMark,
    };
  });

  const avg = (arr, key) => {
    const vals = arr.map(x => x[key]).filter(v => v !== null && !isNaN(v));
    return vals.length ? vals.reduce((s,v)=>s+v,0)/vals.length : null;
  };

  const totalLikes = data.reduce((s,d)=>s+(d.likes||0),0);
  const totalCmts = data.reduce((s,d)=>s+(d.comments||0),0);
  const totalShrs = data.reduce((s,d)=>s+(d.shares||0),0);

  const html = `
    <!-- KPI ROW -->
    <div class="analysis-grid">
      <div class="kpi"><div class="kpi-label">語料數</div><div class="kpi-value">${n}<span class="unit">posts</span></div></div>
      <div class="kpi"><div class="kpi-label">總互動</div><div class="kpi-value">${(totalLikes+totalCmts+totalShrs).toLocaleString()}</div></div>
      <div class="kpi"><div class="kpi-label">平均 Valence</div><div class="kpi-value">${(avg(data,'meanV')||0).toFixed(2)}<span class="unit">/9</span></div><div class="kpi-sub">中位 5.0 為中性</div></div>
      <div class="kpi"><div class="kpi-label">平均 Arousal</div><div class="kpi-value">${(avg(data,'meanA')||0).toFixed(2)}<span class="unit">/9</span></div><div class="kpi-sub">中位 5.0 為中等</div></div>
    </div>

    <!-- CORRELATION TABLE -->
    <div class="corr-section">
      <div class="section-head">
        <div>
          <div class="section-num">§ III·1</div>
          <div class="section-title">相關係數矩陣</div>
        </div>
        <div class="section-meta">SPEARMAN ρ · 風格特徵 × 流量指標</div>
      </div>
      ${renderCorrelationTable(data)}
    </div>

    <!-- VA SCATTER -->
    <div class="va-section">
      <div class="section-head">
        <div>
          <div class="section-num">§ III·2</div>
          <div class="section-title">Valence-Arousal 分布圖</div>
        </div>
        <div class="section-meta">SCATTER · 點大小代表互動量</div>
      </div>
      <div class="va-plot-wrap">
        <div class="va-plot">${renderVAScatter(data)}</div>
        <div class="va-legend">
          <div class="legend-section">
            <h4>四象限解讀</h4>
            <div class="quadrant-list">
              <div class="quad-item"><span class="quad-swatch" style="background:#C9A227;"></span>Q1 · 興奮正向 (V↑ A↑)</div>
              <div class="quad-item"><span class="quad-swatch" style="background:#8B1A1A;"></span>Q2 · 憤怒激動 (V↓ A↑) ★</div>
              <div class="quad-item"><span class="quad-swatch" style="background:#4A6B82;"></span>Q3 · 悲傷低落 (V↓ A↓)</div>
              <div class="quad-item"><span class="quad-swatch" style="background:#5C7752;"></span>Q4 · 平靜滿足 (V↑ A↓)</div>
            </div>
          </div>
          <div class="legend-section" style="border-color:var(--gold);">
            <h4>解讀提示</h4>
            <p>Rage bait 預期集中於 Q2 象限。若 Q2 貼文的點較大（互動量高），代表用詞與流量呈現預期關聯。</p>
          </div>
        </div>
      </div>
    </div>

    <!-- HIGH vs LOW COMPARISON -->
    <div class="compare-section">
      <div class="section-head">
        <div>
          <div class="section-num">§ III·3</div>
          <div class="section-title">高/低流量組對照</div>
        </div>
        <div class="section-meta">以總互動數中位數切分</div>
      </div>
      ${renderComparisonTable(data)}
    </div>

    <div class="notice">
      <strong>方法論註記：</strong>本系統採用 Spearman 等級相關，對極端值較不敏感，適用於小樣本（N &lt; 100）的非常態分布資料。p &lt; 0.05 為統計顯著（標 *），p &lt; 0.01 為高度顯著（**）。
    </div>
  `;
  document.getElementById('analysisContent').innerHTML = html;
}

// ── SPEARMAN CORRELATION ───────────────────────────────────────
function spearman(x, y) {
  const pairs = x.map((v,i) => ({x: v, y: y[i]}))
                 .filter(p => p.x !== null && p.y !== null && !isNaN(p.x) && !isNaN(p.y));
  if (pairs.length < 3) return { r: null, p: null, n: pairs.length };

  const rank = arr => {
    const sorted = arr.map((v,i)=>({v,i})).sort((a,b) => a.v - b.v);
    const ranks = new Array(arr.length);
    let i = 0;
    while (i < sorted.length) {
      let j = i;
      while (j+1 < sorted.length && sorted[j+1].v === sorted[i].v) j++;
      const avg = (i + j + 2) / 2;
      for (let k = i; k <= j; k++) ranks[sorted[k].i] = avg;
      i = j + 1;
    }
    return ranks;
  };

  const rx = rank(pairs.map(p=>p.x));
  const ry = rank(pairs.map(p=>p.y));
  const n = pairs.length;
  const meanX = rx.reduce((s,v)=>s+v,0)/n;
  const meanY = ry.reduce((s,v)=>s+v,0)/n;
  let num=0, dx=0, dy=0;
  for (let i=0; i<n; i++) {
    const ex = rx[i]-meanX, ey = ry[i]-meanY;
    num += ex*ey; dx += ex*ex; dy += ey*ey;
  }
  const r = num / Math.sqrt(dx*dy);
  // Approximate p-value via t-distribution
  const t = r * Math.sqrt((n-2)/(1-r*r));
  const p = approxPValue(t, n-2);
  return { r, p, n };
}

// Two-tailed p approximation from t (Abramowitz formula)
function approxPValue(t, df) {
  if (!isFinite(t)) return 0;
  const x = df / (df + t*t);
  // Beta function approximation - use series
  const ibeta = (x, a, b) => {
    // Continued fraction for incomplete beta
    if (x === 0 || x === 1) return x === 0 ? 0 : 1;
    const lbeta = lgamma(a) + lgamma(b) - lgamma(a+b);
    const front = Math.exp(Math.log(x)*a + Math.log(1-x)*b - lbeta) / a;
    let cf = 1, c = 1, d = 0;
    for (let i = 0; i < 200; i++) {
      const m = Math.floor(i/2);
      const num = (i % 2 === 0)
        ? (m * (b - m) * x) / ((a + 2*m - 1) * (a + 2*m))
        : -((a + m) * (a + b + m) * x) / ((a + 2*m) * (a + 2*m + 1));
      d = 1 + num*d; if (Math.abs(d) < 1e-30) d = 1e-30;
      c = 1 + num/c; if (Math.abs(c) < 1e-30) c = 1e-30;
      d = 1/d;
      cf *= d*c;
      if (Math.abs(d*c - 1) < 1e-8) break;
    }
    return front * (cf - 1);
  };
  const p = ibeta(x, df/2, 0.5);
  return Math.min(1, Math.max(0, p));
}

// Lanczos approximation for log-gamma
function lgamma(x) {
  const g = 7;
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028,
             771.32342877765313, -176.61502916214059, 12.507343278686905,
             -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI/Math.sin(Math.PI*x)) - lgamma(1-x);
  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g+2; i++) a += c[i]/(x+i);
  return 0.5*Math.log(2*Math.PI) + (x+0.5)*Math.log(t) - t + Math.log(a);
}

function renderCorrelationTable(data) {
  const features = [
    { key:'meanV',     label:'平均 Valence',     desc:'貼文情感極性（負面→正面）' },
    { key:'meanA',     label:'平均 Arousal',     desc:'整體情感激動程度' },
    { key:'minV',      label:'最低 Valence',     desc:'最負面詞的強度' },
    { key:'maxA',      label:'最高 Arousal',     desc:'最激動詞的強度' },
    { key:'rageCount', label:'Rage 詞絕對數',     desc:'V<3.5 ∧ A>6.5 的詞數' },
    { key:'rageRatio', label:'Rage 詞比例（%）',  desc:'每百中文字 Rage 詞數' },
    { key:'charCount', label:'總字數',           desc:'貼文長度' },
    { key:'firstP',    label:'第一人稱',         desc:'我/我們 出現次數' },
    { key:'secondP',   label:'第二人稱',         desc:'你/妳/你們 出現次數' },
    { key:'exclamation', label:'驚嘆號數',       desc:'!/！ 數量' },
  ];
  const metrics = [
    { key:'likes',    label:'❤️ Likes' },
    { key:'comments', label:'💬 Comments' },
    { key:'shares',   label:'🔁 Shares' },
    { key:'total',    label:'∑ Total' },
  ];

  let html = `<table class="corr-table"><thead><tr>
    <th class="feat">風格特徵</th>
    ${metrics.map(m => `<th>${m.label}</th>`).join('')}
  </tr></thead><tbody>`;

  features.forEach(f => {
    html += `<tr><td class="feat" title="${f.desc}">${f.label}</td>`;
    metrics.forEach(m => {
      const x = data.map(d => d[f.key]);
      const y = data.map(d => d[m.key]);
      const { r, p, n } = spearman(x, y);
      if (r === null) {
        html += `<td class="r-cell"><span class="corr-cell-content" style="color:var(--ink-fade);">—</span></td>`;
      } else {
        const widthPct = Math.min(100, Math.abs(r)*100);
        const barCls = r < 0 ? 'corr-cell-bar neg' : 'corr-cell-bar';
        const sig = p < 0.001 ? '***' : p < 0.01 ? '**' : p < 0.05 ? '*' : 'ns';
        const sigCls = sig === 'ns' ? 'sig-badge ns' : 'sig-badge';
        const align = r < 0 ? 'right' : 'left';
        html += `
          <td class="r-cell">
            <div class="${barCls}" style="${align}:50%;width:${widthPct/2}%;"></div>
            <span class="corr-cell-content">
              ${r >= 0 ? '+' : ''}${r.toFixed(2)}
              <span class="${sigCls}">${sig}</span>
            </span>
          </td>`;
      }
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  return html;
}

function renderVAScatter(data) {
  // SVG, 0-9 V on x, 0-9 A on y (inverted SVG)
  const W = 500, H = 500, pad = 40;
  const xScale = v => pad + (v / 9) * (W - 2*pad);
  const yScale = a => H - pad - (a / 9) * (H - 2*pad);

  const totals = data.map(d => d.total).filter(v => v > 0);
  const maxT = Math.max(...totals, 1);
  const rScale = t => 4 + Math.sqrt(t/maxT) * 18;

  const quadColor = (v, a) => {
    if (v < 5 && a >= 5) return 'var(--quad-q2)';
    if (v >= 5 && a >= 5) return 'var(--quad-q1)';
    if (v < 5 && a < 5) return 'var(--quad-q3)';
    return 'var(--quad-q4)';
  };

  const points = data.filter(d => d.meanV !== null).map(d => {
    const cx = xScale(d.meanV), cy = yScale(d.meanA);
    const r = rScale(d.total);
    const color = quadColor(d.meanV, d.meanA);
    const idx = STATE.posts.findIndex(p => p.id === d.id);
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" fill-opacity="0.65" stroke="${color}" stroke-width="1.5">
      <title>#${idx+1} · V=${d.meanV.toFixed(2)} A=${d.meanA.toFixed(2)} · ${d.total} 互動</title>
    </circle>`;
  }).join('');

  return `
    <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      <!-- Quadrant backgrounds -->
      <rect x="${pad}" y="${pad}" width="${(W-2*pad)/2}" height="${(H-2*pad)/2}" fill="#8B1A1A" fill-opacity="0.04"/>
      <rect x="${W/2}" y="${pad}" width="${(W-2*pad)/2}" height="${(H-2*pad)/2}" fill="#C9A227" fill-opacity="0.04"/>
      <rect x="${pad}" y="${H/2}" width="${(W-2*pad)/2}" height="${(H-2*pad)/2}" fill="#4A6B82" fill-opacity="0.04"/>
      <rect x="${W/2}" y="${H/2}" width="${(W-2*pad)/2}" height="${(H-2*pad)/2}" fill="#5C7752" fill-opacity="0.04"/>

      <!-- Quadrant labels -->
      <text x="${pad+12}" y="${pad+18}" font-size="9" font-family="JetBrains Mono" fill="#8B1A1A" font-weight="700">Q2 · 憤怒激動</text>
      <text x="${W-pad-12}" y="${pad+18}" font-size="9" font-family="JetBrains Mono" fill="#C9A227" text-anchor="end" font-weight="700">Q1 · 興奮正向</text>
      <text x="${pad+12}" y="${H-pad-8}" font-size="9" font-family="JetBrains Mono" fill="#4A6B82" font-weight="700">Q3 · 悲傷低落</text>
      <text x="${W-pad-12}" y="${H-pad-8}" font-size="9" font-family="JetBrains Mono" fill="#5C7752" text-anchor="end" font-weight="700">Q4 · 平靜滿足</text>

      <!-- Axes -->
      <line x1="${pad}" y1="${H/2}" x2="${W-pad}" y2="${H/2}" stroke="#2C2C2C" stroke-width="1" stroke-dasharray="2,3"/>
      <line x1="${W/2}" y1="${pad}" x2="${W/2}" y2="${H-pad}" stroke="#2C2C2C" stroke-width="1" stroke-dasharray="2,3"/>
      <rect x="${pad}" y="${pad}" width="${W-2*pad}" height="${H-2*pad}" fill="none" stroke="#2C2C2C" stroke-width="1.5"/>

      <!-- Tick marks -->
      ${[1,3,5,7,9].map(v => `
        <text x="${xScale(v)}" y="${H-pad+18}" font-size="9" font-family="JetBrains Mono" text-anchor="middle" fill="#4A4A4A">${v}</text>
        <text x="${pad-8}" y="${yScale(v)+3}" font-size="9" font-family="JetBrains Mono" text-anchor="end" fill="#4A4A4A">${v}</text>
      `).join('')}

      <!-- Axis titles -->
      <text x="${W/2}" y="${H-6}" font-size="11" font-family="Noto Serif TC" text-anchor="middle" font-style="italic" fill="#1A1A1A">Valence →</text>
      <text x="14" y="${H/2}" font-size="11" font-family="Noto Serif TC" text-anchor="middle" font-style="italic" fill="#1A1A1A" transform="rotate(-90, 14, ${H/2})">Arousal →</text>

      <!-- Data points -->
      ${points}
    </svg>`;
}

function renderComparisonTable(data) {
  const sorted = [...data].sort((a,b) => a.total - b.total);
  const median = sorted[Math.floor(sorted.length/2)].total;
  const high = data.filter(d => d.total >= median);
  const low = data.filter(d => d.total < median);

  const features = [
    { key:'meanV', label:'平均 Valence', dp:2 },
    { key:'meanA', label:'平均 Arousal', dp:2 },
    { key:'rageCount', label:'Rage 詞數', dp:1 },
    { key:'rageRatio', label:'Rage 比例（%）', dp:2 },
    { key:'charCount', label:'字數', dp:0 },
    { key:'firstP', label:'第一人稱', dp:1 },
    { key:'secondP', label:'第二人稱', dp:1 },
    { key:'exclamation', label:'驚嘆號', dp:1 },
  ];

  const avg = (arr, key) => {
    const v = arr.map(x=>x[key]).filter(x=>x!==null && !isNaN(x));
    return v.length ? v.reduce((s,x)=>s+x,0)/v.length : null;
  };

  let html = `<table class="compare-table">
    <thead><tr>
      <th>特徵</th>
      <th>低流量組 (n=${low.length})</th>
      <th>高流量組 (n=${high.length})</th>
      <th>差異</th>
    </tr></thead><tbody>`;
  features.forEach(f => {
    const lo = avg(low, f.key), hi = avg(high, f.key);
    if (lo === null || hi === null) return;
    const diff = hi - lo;
    const cls = diff > 0 ? 'pos' : diff < 0 ? 'neg' : '';
    const arrow = diff > 0 ? '▲' : diff < 0 ? '▼' : '—';
    html += `<tr>
      <td class="feat-name">${f.label}</td>
      <td class="num">${lo.toFixed(f.dp)}</td>
      <td class="num">${hi.toFixed(f.dp)}</td>
      <td class="diff ${cls}">${arrow} ${Math.abs(diff).toFixed(f.dp)}</td>
    </tr>`;
  });
  html += '</tbody></table>';
  return html;
}

// ── LEXICON SEARCH ─────────────────────────────────────────────
function renderLexiconResults(query) {
  const wrap = document.getElementById('lexResults');
  const lex = STATE.lexicon;
  let entries;
  if (!query) {
    // Show top rage words by default
    entries = Object.entries(lex)
      .filter(([w,d]) => d.r === 1)
      .sort((a,b) => b[1].a - a[1].a)
      .slice(0, 60);
  } else {
    entries = Object.entries(lex)
      .filter(([w]) => w.includes(query))
      .slice(0, 100);
  }

  if (!entries.length) {
    wrap.innerHTML = `<div class="empty-state"><div class="glyph">∅</div><div class="empty-state-title">查無此詞</div></div>`;
    return;
  }

  const title = query ? `「${query}」相關詞彙` : '預設顯示：60 個最強烈 Rage 詞（依 Arousal 排序）';
  wrap.innerHTML = `
    <div style="font-size:11px;color:var(--ink-fade);margin-bottom:12px;font-family:'JetBrains Mono',monospace;letter-spacing:0.05em;">${title} · ${entries.length} 筆</div>
    <div class="matched-words-list">
      ${entries.map(([w, d]) => {
        const q = d.v < 5 && d.a >= 5 ? 'Q2'
                : d.v >= 5 && d.a >= 5 ? 'Q1'
                : d.v < 5 && d.a < 5 ? 'Q3' : 'Q4';
        const colors = { Q1:'#C9A227', Q2:'#8B1A1A', Q3:'#4A6B82', Q4:'#5C7752' };
        return `<span class="matched-word-chip${d.r?' rage':''}" style="border-color:${colors[q]};${d.r?'':`color:${colors[q]};`}">
          ${escapeHtml(w)}
          <span class="va">V${d.v} A${d.a}</span>
        </span>`;
      }).join('')}
    </div>`;
}

// ── EXPORT / IMPORT ────────────────────────────────────────────
function exportCSV() {
  if (!STATE.posts.length) { toast('沒有資料可匯出'); return; }
  const rows = STATE.posts.map(p => {
    const a = analyzePost(p.content);
    return {
      id: p.id, date: p.date, account: p.account, topic: p.topic,
      content: p.content, url: p.url,
      likes: p.likes, comments: p.comments, shares: p.shares,
      total_engagement: (p.likes||0)+(p.comments||0)+(p.shares||0),
      char_count: a.charCount,
      mean_valence: a.meanV !== null ? a.meanV.toFixed(3) : '',
      mean_arousal: a.meanA !== null ? a.meanA.toFixed(3) : '',
      min_valence: a.minV !== null ? a.minV.toFixed(2) : '',
      max_arousal: a.maxA !== null ? a.maxA.toFixed(2) : '',
      rage_count: a.rageCount,
      rage_ratio: a.chineseChars ? (a.rageCount/a.chineseChars).toFixed(4) : '',
      coverage: a.coverage.toFixed(3),
      first_person: a.firstP,
      second_person: a.secondP,
      exclamation_count: a.exclamationMark,
      has_question: a.questionMark,
      matched_words: a.matched.map(m=>m.word).join('|'),
    };
  });
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(',')].concat(
    rows.map(r => headers.map(h => csvEscape(r[h])).join(','))
  ).join('\n');
  download('rage_bait_analysis_' + Date.now() + '.csv', '\ufeff' + csv, 'text/csv');
  toast('已匯出 CSV（含完整分析欄位）');
}

function exportJSON() {
  if (!STATE.posts.length) { toast('沒有資料可匯出'); return; }
  download('rage_bait_data_' + Date.now() + '.json',
    JSON.stringify(STATE.posts, null, 2), 'application/json');
  toast('已匯出 JSON（原始資料）');
}

function importCSV(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const text = ev.target.result.replace(/^\ufeff/, '');
    try {
      const rows = parseCSV(text);
      if (rows.length < 2) throw new Error('CSV 格式錯誤或無資料');
      const headers = rows[0].map(h => h.toLowerCase());
      const idx = name => headers.findIndex(h => h.includes(name));
      // Try multiple key candidates
      const findIdx = (...keys) => {
        for (const k of keys) {
          const i = idx(k.toLowerCase());
          if (i !== -1) return i;
        }
        return -1;
      };
      const iContent = findIdx('content', '貼文');
      const iLikes   = findIdx('like', '讚');
      const iCmts    = findIdx('comment', '留言');
      const iShrs    = findIdx('share', '分享', 'repost', '轉發');
      const iDate    = findIdx('date', '日期');
      const iAcct    = findIdx('account', '帳號');
      const iTopic   = findIdx('topic', '議題');
      const iUrl     = findIdx('url', '連結');

      if (iContent === -1) throw new Error('找不到貼文內容欄位');

      const newPosts = [];
      for (let r = 1; r < rows.length; r++) {
        const cols = rows[r];
        const content = (cols[iContent] || '').trim();
        if (!content) continue;
        newPosts.push({
          id: Date.now() + r,
          content,
          likes:    iLikes !== -1 ? (parseInt(cols[iLikes]) || 0) : 0,
          comments: iCmts  !== -1 ? (parseInt(cols[iCmts])  || 0) : 0,
          shares:   iShrs  !== -1 ? (parseInt(cols[iShrs])  || 0) : 0,
          date:    iDate  !== -1 ? (cols[iDate]  || '').trim() : '',
          account: iAcct  !== -1 ? (cols[iAcct]  || '').trim() : '',
          topic:   iTopic !== -1 ? (cols[iTopic] || '').trim() : '',
          url:     iUrl   !== -1 ? (cols[iUrl]   || '').trim() : '',
          createdAt: new Date().toISOString(),
        });
      }
      if (!newPosts.length) throw new Error('無法解析任何貼文');
      STATE.posts = newPosts.concat(STATE.posts);
      savePosts();
      refreshUI();
      toast(`已匯入 ${newPosts.length} 筆貼文`);
    } catch (err) {
      alert('匯入失敗：' + err.message);
    }
  };
  reader.readAsText(file, 'utf-8');
  e.target.value = '';
}

// Full CSV parser — handles quoted fields containing commas AND newlines
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i+1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else {
        cur += c;
      }
    } else {
      if (c === '"') {
        inQ = true;
      } else if (c === ',') {
        row.push(cur); cur = '';
      } else if (c === '\n' || c === '\r') {
        // End of row (handle \r\n)
        if (c === '\r' && text[i+1] === '\n') i++;
        row.push(cur); cur = '';
        if (row.some(v => v !== '')) rows.push(row);
        row = [];
      } else {
        cur += c;
      }
    }
  }
  // Flush final field/row
  if (cur !== '' || row.length > 0) {
    row.push(cur);
    if (row.some(v => v !== '')) rows.push(row);
  }
  return rows;
}

function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function download(filename, data, mime) {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

function clearAll() {
  if (!STATE.posts.length) return;
  if (!confirm(`確定要清空全部 ${STATE.posts.length} 筆資料？此動作無法復原。`)) return;
  STATE.posts = [];
  savePosts();
  refreshUI();
  toast('已清空全部資料');
}

// ── UTILITIES ──────────────────────────────────────────────────
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ── BOOT ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
