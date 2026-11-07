// 配色色卡 · 主程序：路由与各页面
import {
  normHex, parseColor, textOn, formats, contrast, wcag, hexToOklch, mix, family, FAMILIES, hexToHsv, hsvToHex, hexToRgb, rng,
} from './color.js';
import { state, load, persist, change, subscribe, undo, redo, canUndo, canRedo, hexes, setPalette, uid } from './store.js';
import { createPicker } from './picker.js';
import { createWheel } from './wheel.js';
import { SCHEMES, MOODS, SMART, modeName, generate, runScheme, paletteFor, randomBase, adjust, nearestName, autoName, scale, tints, shades, tones, fitTo, sortByLight } from './harmony.js';
import { PREVIEW_TABS, render as renderPreview } from './preview.js';
import { extract, drawScaled, EXTRACT_MODES } from './extract.js';
import { TEXT_FORMATS, toText, toASE, drawCard, download } from './export.js';
import { CN, JP, PALETTES, YEARLY, FAMOUS, FILAMENTS } from './data.js';
import { loadFile, pixels, detectLevels, buildMap, paint, recolorSvg } from './recolor.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const view = $('#view');

// ---------- 图标 ----------
const I = p => `<svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
const ICON = {
  dice: I('<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="8.5" cy="8.5" r="1.2" class="f"/><circle cx="15.5" cy="15.5" r="1.2" class="f"/><circle cx="15.5" cy="8.5" r="1.2" class="f"/><circle cx="8.5" cy="15.5" r="1.2" class="f"/><circle cx="12" cy="12" r="1.2" class="f"/>'),
  undo: I('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'),
  redo: I('<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>'),
  lock: I('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
  unlock: I('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>'),
  copy: I('<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>'),
  layers: I('<path d="m12 3 9 5-9 5-9-5 9-5z"/><path d="m3 13 9 5 9-5"/>'),
  x: I('<path d="M6 6l12 12M18 6 6 18"/>'),
  heart: I('<path d="M12 20s-7-4.4-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.6-9 9-9 9z"/>'),
  download: I('<path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M4 19h16"/>'),
  upload: I('<path d="M12 16V5m0 0L7.5 9.5M12 5l4.5 4.5M4 19h16"/>'),
  link: I('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
  sun: I('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  moon: I('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'),
  auto: I('<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17a8.5 8.5 0 0 0 0-17z" class="f"/>'),
  image: I('<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>'),
  edit: I('<path d="M4 20h4L19 9l-4-4L4 16v4z"/>'),
  trash: I('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>'),
  sort: I('<path d="M7 4v16m0 0-3-3m3 3 3-3M17 20V4m0 0-3 3m3-3 3 3"/>'),
  sliders: I('<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>'),
  grid: I('<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>'),
  down: I('<path d="m7 10 5 5 5-5"/>'),
  wand: I('<path d="m4 20 11-11M14 4v2M19 9h2M17.5 5.5 19 4M17.5 12.5 19 14M10 5.5 8.5 4"/>'),
};

// ---------- 通用小工具 ----------
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 1800);
}
async function copy(text, label) {
  try { await navigator.clipboard.writeText(text); }
  catch { const ta = document.createElement('textarea'); ta.value = text; document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
  toast(`已复制 ${label || text}`);
}
function openDialog(html, cls = '') {
  const d = $('#dlg');
  d.className = cls;
  d.innerHTML = `<div class="dlg-in">${html}</div>`;
  if (!d.open) d.showModal();
  d.onclick = e => { if (e.target === d) d.close(); };
  $$('[data-close]', d).forEach(b => (b.onclick = () => d.close()));
  return d;
}
const nameOf = c => c.name || autoName(c.hex);
const exportColors = () => state.palette.map(c => ({ hex: c.hex, name: nameOf(c) }));
const stripHtml = (list, cls = '') => `<div class="mini-strip ${cls}">${list.map(h => `<span style="background:${h}" title="${h}" data-hex="${h}"></span>`).join('')}</div>`;
const isTyping = () => { const a = document.activeElement; return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable); };
let rafId = 0;
const nextFrame = fn => { cancelAnimationFrame(rafId); rafId = requestAnimationFrame(fn); };

// ---------- 主题 ----------
function applyTheme() {
  const t = state.theme;
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  $('#theme').innerHTML = ICON[t === 'auto' ? 'auto' : t === 'dark' ? 'moon' : 'sun'];
  $('#theme').title = { auto: '主题：跟随系统', light: '主题：浅色', dark: '主题：深色' }[t];
}
$('#theme').addEventListener('click', () => {
  state.theme = { auto: 'light', light: 'dark', dark: 'auto' }[state.theme];
  persist(); applyTheme();
});

// ---------- 路由 ----------
let current = null;
const ROUTES = { '': workspace, harmony, image: imageView, recolor: recolorView, library, saved: savedView };
function route() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, query] = raw.split('?');
  const q = new URLSearchParams(query || '');
  if (q.get('c')) {
    const list = q.get('c').split('-').map(normHex).filter(Boolean);
    if (list.length) { setPalette(list.slice(0, 10)); toast('已载入分享的配色'); }
    history.replaceState(null, '', '#/' + path);
  }
  current?.destroy?.();
  current = null;
  const fn = ROUTES[path] || workspace;
  $$('.nav a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#/' + (ROUTES[path] ? path : '')));
  view.scrollTop = 0;
  window.scrollTo(0, 0);
  current = fn() || {};
}
subscribe(info => current?.onChange?.(info));
window.addEventListener('hashchange', route);

// =====================================================================
// 工作台
// =====================================================================
function workspace() {
  let shadesFor = -1;
  let fabricSeed = 1;
  view.innerHTML = `
  <section class="ws">
    <div class="toolbar">
      <div class="grp">
        <button class="btn primary" id="gen" title="快捷键：空格">${ICON.dice}<span>生成配色</span></button>
        <button class="btn mode-btn" id="modeBtn" title="浏览所有配色方式的效果（快捷键 M）">${ICON.grid}<span id="modeName"></span>${ICON.down}</button>
        <label class="toggle" title="打开时：选中的颜色保持不变，其它颜色按配色方式围绕它生成"><input type="checkbox" id="anchor"><span>以选中色为基准</span></label>
        <label class="toggle" title="让互补、分裂互补等色彩理论配色的搭配色和基准色一深一浅，对比更明显"><input type="checkbox" id="contrastT"><span>拉开明暗</span></label>
      </div>
      <div class="grp">
        <button class="btn icon" id="undo" title="撤销（⌘/Ctrl+Z）">${ICON.undo}</button>
        <button class="btn icon" id="redo" title="重做（⇧+⌘/Ctrl+Z）">${ICON.redo}</button>
        <span class="sep"></span>
        <div class="stepper" title="颜色数量">
          <button class="btn icon" id="minus" aria-label="减少一个颜色">−</button><span id="count"></span><button class="btn icon" id="plus" aria-label="增加一个颜色">+</button>
        </div>
        <button class="btn" id="sort" title="按从浅到深排序">${ICON.sort}<span>排序</span></button>
        <button class="btn" id="adjust" title="同时调整所有颜色">${ICON.sliders}<span>整体调色</span></button>
      </div>
      <div class="grp">
        <button class="btn" id="save">${ICON.heart}<span>保存</span></button>
        <button class="btn" id="export">${ICON.download}<span>导出</span></button>
        <button class="btn" id="share">${ICON.link}<span>分享</span></button>
      </div>
    </div>
    <div class="strip" id="strip"></div>
    <p class="tip"><kbd>空格</kbd> 换一组 · <kbd>M</kbd> 看所有配色方式 · <kbd>←</kbd><kbd>→</kbd> 切换颜色 · <kbd>L</kbd> 锁定 · 拖动色块可调换顺序 · 两色之间的 <b>+</b> 插入中间色</p>
    <div class="ws-bottom">
      <div class="panel" id="editor">
        <div class="panel-h"><h3>编辑颜色 <span class="muted" id="edIdx"></span></h3>
          <input class="input ed-name" id="edName" placeholder="颜色名称" maxlength="24" title="自定义名称，留空则自动取最接近的传统色名"></div>
        <div class="ed-grid">
          <div id="picker"></div>
          <div class="ed-info" id="edInfo"></div>
        </div>
      </div>
      <div class="panel" id="preview">
        <div class="panel-h wrap">
          <div class="tabs" id="pvTabs">${PREVIEW_TABS.map(([id, n]) => `<button data-t="${id}">${n}</button>`).join('')}</div>
          <div class="grp"><button class="btn sm" id="pvShift" title="换一种颜色分配">${ICON.dice}<span>换一种</span></button>
            <label class="check"><input type="checkbox" id="pvDark"> 深色</label></div>
        </div>
        <div id="pvBody" class="pv-body"></div>
      </div>
    </div>
  </section>`;

  const strip = $('#strip');
  const picker = createPicker($('#picker'), {
    mode: state.pickerMode,
    onInput: hex => change(s => { s.palette[s.sel].hex = hex; }, { merge: true, source: 'picker' }),
    onMode: m => { state.pickerMode = m; persist(); },
  });

  function renderStrip() {
    const n = state.palette.length;
    strip.style.setProperty('--n', n);
    strip.innerHTML = state.palette.map((c, i) => {
      const fg = textOn(c.hex);
      const sh = shadesFor === i ? `<div class="col-shades">${scale(c.hex, 11).map(h => `<button data-act="pickshade" data-hex="${h}" style="background:${h};color:${textOn(h)}" class="${h === c.hex ? 'cur' : ''}">${h.slice(1)}</button>`).join('')}</div>` : '';
      return `<div class="col ${i === state.sel ? 'sel' : ''} ${c.locked ? 'locked' : ''}" data-i="${i}" style="background:${c.hex};color:${fg}" draggable="true">
        <div class="col-tools">
          ${n > 2 ? `<button class="ct" data-act="del" title="删除">${ICON.x}</button>` : ''}
          <button class="ct" data-act="shades" title="明暗变化">${ICON.layers}</button>
          <button class="ct" data-act="copy" title="复制 HEX">${ICON.copy}</button>
          <button class="ct lock" data-act="lock" title="${c.locked ? '解锁' : '锁定（生成时保留）'}">${c.locked ? ICON.lock : ICON.unlock}</button>
        </div>
        <div class="col-label">${state.anchor && i === state.sel ? '<span class="col-base">基准色</span>' : ''}<div class="col-hex" data-act="copy" title="点击复制">${c.hex.slice(1)}</div><div class="col-name">${esc(nameOf(c))}</div></div>
        ${i < n - 1 && n < 10 ? `<button class="ins" data-act="ins" title="在这里插入一个中间色">${ICON.plus}</button>` : ''}
        ${sh}
      </div>`;
    }).join('');
    $('#count').textContent = n;
    $('#modeName').textContent = modeName(state.genMode);
    $('#anchor').checked = state.anchor;
    $('#contrastT').checked = state.contrast;
    $('#minus').disabled = n <= 2;
    $('#plus').disabled = n >= 10;
    $('#undo').disabled = !canUndo();
    $('#redo').disabled = !canRedo();
  }

  function renderEditor() {
    const c = state.palette[state.sel];
    picker.set(c.hex);
    $('#edIdx').textContent = `第 ${state.sel + 1} / ${state.palette.length} 个`;
    const nameIn = $('#edName');
    if (document.activeElement !== nameIn) { nameIn.value = c.name; nameIn.placeholder = autoName(c.hex); }
    const f = formats(c.hex);
    const nn = nearestName(c.hex);
    const cw = contrast(c.hex, '#FFFFFF'), cb = contrast(c.hex, '#000000');
    $('#edInfo').innerHTML = `
      <div class="near">最接近 <button class="link" data-hex="${nn.hex}" data-act="setnear" title="换成这个传统色"><span class="dot" style="background:${nn.hex}"></span>${nn.name}</button><small>${nn.src} · 色差 ${nn.d.toFixed(1)}</small></div>
      <div class="vals">${Object.entries(f).map(([k, v]) => `<button class="val" data-copy="${esc(v)}" title="点击复制"><span>${k}</span><code>${esc(v)}</code></button>`).join('')}</div>
      <div class="sub">色阶 <small>点击替换</small></div>
      <div class="scale">${scale(c.hex, 9).map((h, i) => `<button data-act="setscale" data-hex="${h}" style="background:${h}" title="${(i + 1) * 100}：${h}"></button>`).join('')}</div>
      <div class="sub">文字可读性</div>
      <div class="ctr">
        <div style="background:${c.hex};color:#fff"><b>Aa</b> 白字 ${cw.toFixed(1)} <span class="badge ${cw >= 4.5 ? 'ok' : cw >= 3 ? 'mid' : 'far'}">${wcag(cw)}</span></div>
        <div style="background:${c.hex};color:#000"><b>Aa</b> 黑字 ${cb.toFixed(1)} <span class="badge ${cb >= 4.5 ? 'ok' : cb >= 3 ? 'mid' : 'far'}">${wcag(cb)}</span></div>
      </div>
      <div class="row gap"><a class="btn sm" href="#/harmony" id="toHarmony">${ICON.wand}<span>用它自动配色</span></a><span class="muted small">色系：${family(c.hex)}</span></div>`;
  }

  function renderPv() {
    $$('#pvTabs button').forEach(b => b.classList.toggle('on', b.dataset.t === state.previewTab));
    $('#pvDark').checked = state.previewDark;
    const showOpts = ['ui', 'poster', 'outfit', 'fabric'].includes(state.previewTab);
    $('#pvShift').style.visibility = showOpts ? '' : 'hidden';
    $('#pvDark').parentElement.style.visibility = ['ui', 'poster'].includes(state.previewTab) ? '' : 'hidden';
    $('#pvBody').innerHTML = renderPreview(state.previewTab, hexes(), { dark: state.previewDark, shift: state.roleShift, seed: fabricSeed });
  }

  function renderAll() { renderStrip(); renderEditor(); renderPv(); }

  // --- 事件：色条 ---
  strip.addEventListener('click', e => {
    const col = e.target.closest('.col');
    if (!col) return;
    const i = +col.dataset.i;
    const act = e.target.closest('[data-act]')?.dataset.act;
    const c = state.palette[i];
    if (act === 'lock') change(s => { s.palette[i].locked = !s.palette[i].locked; });
    else if (act === 'copy') copy(c.hex);
    else if (act === 'del') change(s => { s.palette.splice(i, 1); s.sel = Math.min(s.sel, s.palette.length - 1); });
    else if (act === 'ins') change(s => { s.palette.splice(i + 1, 0, { hex: mix(c.hex, s.palette[i + 1].hex, 0.5), locked: false, name: '' }); s.sel = i + 1; });
    else if (act === 'shades') { shadesFor = shadesFor === i ? -1 : i; state.sel = i; renderAll(); }
    else if (act === 'pickshade') { shadesFor = -1; const h = e.target.dataset.hex; change(s => { s.palette[i].hex = h; s.palette[i].name = ''; }); }
    else if (state.sel !== i || shadesFor !== -1) { shadesFor = -1; state.sel = i; persist(); renderAll(); }
  });
  let dragFrom = -1;
  strip.addEventListener('dragstart', e => { const col = e.target.closest('.col'); if (!col) return; dragFrom = +col.dataset.i; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', state.palette[dragFrom].hex); col.classList.add('dragging'); });
  strip.addEventListener('dragover', e => { if (dragFrom < 0) return; e.preventDefault(); const col = e.target.closest('.col'); $$('.col', strip).forEach(c => c.classList.toggle('over', c === col && +col.dataset.i !== dragFrom)); });
  strip.addEventListener('dragend', () => { dragFrom = -1; $$('.col', strip).forEach(c => c.classList.remove('dragging', 'over')); });
  strip.addEventListener('drop', e => {
    e.preventDefault();
    const col = e.target.closest('.col');
    if (!col || dragFrom < 0) return;
    const to = +col.dataset.i, from = dragFrom;
    dragFrom = -1;
    if (to === from) return renderStrip();
    change(s => { const [m] = s.palette.splice(from, 1); s.palette.splice(to, 0, m); s.sel = to; });
  });

  // --- 事件：编辑器 ---
  $('#edName').addEventListener('input', e => change(s => { s.palette[s.sel].name = e.target.value.trim(); }, { merge: true, source: 'name' }));
  $('#edInfo').addEventListener('click', e => {
    const cp = e.target.closest('[data-copy]');
    if (cp) return copy(cp.dataset.copy);
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'setscale') change(s => { s.palette[s.sel].hex = b.dataset.hex; });
    if (b.dataset.act === 'setnear') change(s => { s.palette[s.sel].hex = b.dataset.hex; s.palette[s.sel].name = nearestName(b.dataset.hex).name; });
    if (b.id === 'toHarmony') { state.harmonyBase = state.palette[state.sel].hex; persist(); }
  });

  // --- 事件：工具栏 ---
  const gen = () => applyGen(generate(state.palette, state.genMode, state.wheel, Date.now(), state.anchor ? state.sel : -1, state.contrast));
  $('#gen').onclick = gen;
  $('#modeBtn').onclick = () => openModes(renderStrip);
  $('#anchor').onchange = e => { state.anchor = e.target.checked; persist(); renderStrip(); };
  $('#contrastT').onchange = e => { state.contrast = e.target.checked; persist(); };
  $('#undo').onclick = () => undo();
  $('#redo').onclick = () => redo();
  $('#minus').onclick = () => change(s => {
    if (s.palette.length <= 2) return;
    let i = s.palette.findLastIndex(c => !c.locked);
    if (i < 0) i = s.palette.length - 1;
    s.palette.splice(i, 1); s.sel = Math.min(s.sel, s.palette.length - 1);
  });
  $('#plus').onclick = () => change(s => {
    if (s.palette.length >= 10) return;
    const list = s.palette.map(c => c.hex);
    const next = fitTo(list, list.length + 1);
    // 找出新插入的那个
    let at = next.findIndex((h, i) => h !== list[i]);
    if (at < 0) at = next.length - 1;
    s.palette.splice(at, 0, { hex: next[at], locked: false, name: '' });
    s.sel = at;
  });
  $('#sort').onclick = () => change(s => { const sel = s.palette[s.sel]; s.palette.sort((a, b) => hexToOklch(b.hex).L - hexToOklch(a.hex).L); s.sel = s.palette.indexOf(sel); });
  $('#adjust').onclick = openAdjust;
  $('#save').onclick = openSave;
  $('#export').onclick = () => openExport(exportColors(), currentTitle());
  $('#share').onclick = () => copy(shareUrl(hexes()), '分享链接');

  // --- 事件：预览 ---
  $('#pvTabs').addEventListener('click', e => { const t = e.target.closest('button')?.dataset.t; if (t) { state.previewTab = t; persist(); renderPv(); } });
  $('#pvShift').onclick = () => { state.roleShift++; fabricSeed++; renderPv(); };
  $('#pvDark').onchange = e => { state.previewDark = e.target.checked; persist(); renderPv(); };
  $('#pvBody').addEventListener('click', e => { const b = e.target.closest('[data-copy]'); if (b) copy(decodeURIComponent(b.dataset.copy), 'CSS'); const h = e.target.closest('[data-hex]'); if (h && !b) copy(h.dataset.hex); });

  // --- 键盘 ---
  const onKey = e => {
    if ($('#dlg').open) return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'z' && !isTyping()) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod && e.key.toLowerCase() === 'y' && !isTyping()) { e.preventDefault(); redo(); return; }
    if (isTyping() || mod || e.altKey) return;
    if (e.code === 'Space') { e.preventDefault(); gen(); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      if (document.activeElement?.closest('.pk')) return;
      e.preventDefault(); state.sel = (state.sel + (e.key === 'ArrowRight' ? 1 : -1) + state.palette.length) % state.palette.length; shadesFor = -1; renderAll();
    } else if (e.key.toLowerCase() === 'l') change(s => { s.palette[s.sel].locked = !s.palette[s.sel].locked; });
    else if (e.key.toLowerCase() === 'c') copy(state.palette[state.sel].hex);
    else if (e.key.toLowerCase() === 'm') openModes(renderStrip);
  };
  document.addEventListener('keydown', onKey);

  renderAll();
  return {
    onChange(info) {
      if (info.source === 'picker' || info.source === 'name') { renderStrip(); if (info.source === 'name') return; nextFrame(() => { renderEditor(); renderPv(); }); }
      else renderAll();
    },
    destroy() { document.removeEventListener('keydown', onKey); },
  };
}

/** 把生成结果写进色卡（锁定和基准色不变） */
function applyGen(out) {
  const keepIdx = state.anchor ? state.sel : -1;
  change(s => {
    s.palette = s.palette.map((c, i) => (c.locked || i === keepIdx || c.hex === out[i] ? c : { hex: out[i], locked: false, name: '' }));
    s.currentSavedId = null;
  });
  if (state.genMode === 'smart' && out.mode) toast(`这次用了：${modeName(out.mode)}`);
}

// ---------- 配色方式总览 ----------
function openModes(onDone) {
  const seeds = {};
  const all = [['理论', SMART], ...SCHEMES.map(s => ['理论', s]), ...MOODS.map(m => ['风格', m])];
  all.forEach(([, m], i) => (seeds[m.id] = Date.now() + i * 7919));
  const anchor = () => (state.anchor ? state.sel : -1);
  const results = {};
  const base = state.palette[state.sel];
  const d = openDialog(`
    <div class="dlg-h modes-h">
      <div><h3>选择配色方式</h3>
        <p class="muted small">${state.anchor ? `以 <span class="dot" style="background:${base.hex}"></span> <b class="mono">${base.hex}</b> 为基准` : '随机基准色'} · ${state.palette.length} 色${state.palette.some(c => c.locked) ? ' · 锁定的颜色保持不变' : ''} · 点卡片直接使用</p></div>
      <div class="grp"><label class="toggle" title="让互补、分裂互补等色彩理论配色的搭配色和基准色一深一浅，对比更明显"><input type="checkbox" id="mdContrast" ${state.contrast ? 'checked' : ''}><span>拉开明暗</span></label><button class="btn sm" id="mdRoll">${ICON.dice}<span>全部换一组</span></button><button class="btn icon" data-close aria-label="关闭">${ICON.x}</button></div>
    </div>
    <div id="mdBody"></div>`, 'xl');
  const body = $('#mdBody', d);
  const card = m => {
    const out = (results[m.id] = generate(state.palette, m.id, state.wheel, seeds[m.id], anchor(), state.contrast));
    return `<div class="card mode-card ${state.genMode === m.id ? 'focus' : ''}" data-id="${m.id}" tabindex="0">
      ${stripHtml(out, 'card-strip')}
      <div class="card-b"><div><b>${m.name}${m.id === 'smart' && out.mode ? ` <small class="muted">· ${modeName(out.mode)}</small>` : ''}</b><p>${m.desc}</p></div>
        <button class="btn icon sm" data-act="roll" title="换一组">${ICON.dice}</button></div></div>`;
  };
  const paint = () => {
    body.innerHTML = `
      <h4 class="sub">色彩理论 <small>按色轮关系计算，基准色不变</small></h4>
      <div class="cards">${all.filter(a => a[0] === '理论').map(a => card(a[1])).join('')}</div>
      <h4 class="sub">风格 <small>按风格规则生成，会参考基准色的色相</small></h4>
      <div class="cards">${all.filter(a => a[0] === '风格').map(a => card(a[1])).join('')}</div>`;
  };
  body.addEventListener('click', e => {
    const c = e.target.closest('.mode-card');
    if (!c) return;
    const id = c.dataset.id;
    if (e.target.closest('[data-act=roll]')) { seeds[id] += 104729; c.outerHTML = card(all.find(a => a[1].id === id)[1]); return; }
    state.genMode = id; persist();
    applyGen(results[id]);
    d.close();
    onDone && onDone();
  });
  body.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.classList.contains('mode-card')) e.target.click(); });
  $('#mdContrast', d).onchange = e => { state.contrast = e.target.checked; persist(); paint(); };
  $('#mdRoll', d).onclick = () => { Object.keys(seeds).forEach(k => (seeds[k] += 104729)); paint(); };
  paint();
}

function currentTitle() {
  const s = state.saved.find(x => x.id === state.currentSavedId);
  return s ? s.name : '我的配色';
}
function shareUrl(list) {
  return `${location.origin}${location.pathname}#/?c=${list.map(h => h.slice(1)).join('-')}`;
}

// ---------- 整体调色 ----------
function openAdjust() {
  const orig = state.palette.map(c => ({ ...c }));
  const o = { hue: 0, sat: 0, light: 0, temp: 0, contrast: 0 };
  let keepLocked = true;
  const S = [['hue', '色相旋转', -180, 180, '°'], ['sat', '饱和度', -100, 100, ''], ['light', '明暗', -100, 100, ''], ['contrast', '对比', -100, 100, ''], ['temp', '冷 ↔ 暖', -100, 100, '']];
  const d = openDialog(`
    <div class="dlg-h"><h3>整体调色</h3><button class="btn icon" data-close aria-label="关闭">${ICON.x}</button></div>
    <div class="adj-cmp"><small>调整前</small>${stripHtml(orig.map(c => c.hex), 'big')}<small>调整后</small><div id="adjAfter"></div></div>
    <div class="adj-sl">${S.map(([k, n, min, max, u]) => `<label><span>${n}</span><input type="range" min="${min}" max="${max}" value="0" data-k="${k}"><output id="o-${k}">0${u}</output></label>`).join('')}</div>
    <label class="check"><input type="checkbox" id="adjLock" checked> 锁定的颜色保持不变</label>
    <div class="dlg-f"><button class="btn" id="adjReset">重置</button><span class="flex"></span><button class="btn" data-close>取消</button><button class="btn primary" id="adjOk">应用</button></div>`, 'sm');
  const out = () => orig.map(c => (keepLocked && c.locked ? c.hex : adjust(c.hex, o)));
  const paint = () => { $('#adjAfter', d).innerHTML = stripHtml(out(), 'big'); S.forEach(([k, , , , u]) => { $(`#o-${k}`, d).textContent = o[k] + u; }); };
  $('.adj-sl', d).addEventListener('input', e => { o[e.target.dataset.k] = +e.target.value; paint(); });
  $('#adjLock', d).onchange = e => { keepLocked = e.target.checked; paint(); };
  $('#adjReset', d).onclick = () => { Object.keys(o).forEach(k => (o[k] = 0)); $$('.adj-sl input', d).forEach(i => (i.value = 0)); paint(); };
  $('#adjOk', d).onclick = () => { const list = out(); change(s => { s.palette.forEach((c, i) => { if (c.hex !== list[i]) { c.hex = list[i]; c.name = ''; } }); }); d.close(); toast('已应用调色'); };
  paint();
}

// ---------- 保存 ----------
function openSave() {
  const cur = state.saved.find(x => x.id === state.currentSavedId);
  const d = openDialog(`
    <div class="dlg-h"><h3>保存到我的色卡</h3><button class="btn icon" data-close aria-label="关闭">${ICON.x}</button></div>
    ${stripHtml(hexes(), 'big')}
    <label class="field"><span>名称</span><input class="input" id="svName" maxlength="40" value="${esc(cur ? cur.name : '')}" placeholder="例如：春季拼布、品牌主色"></label>
    <div class="dlg-f"><span class="flex"></span>${cur ? `<button class="btn" id="svNew">另存为新色卡</button><button class="btn primary" id="svUpd">更新「${esc(cur.name)}」</button>` : '<button class="btn primary" id="svNew">保存</button>'}</div>`, 'sm');
  const inp = $('#svName', d);
  inp.focus(); inp.select();
  const colors = () => state.palette.map(c => ({ hex: c.hex, name: c.name }));
  const doNew = () => {
    const item = { id: uid(), name: inp.value.trim() || `配色 ${state.saved.length + 1}`, colors: colors(), created: Date.now(), updated: Date.now() };
    state.saved.unshift(item); state.currentSavedId = item.id; persist(); d.close(); toast(`已保存「${item.name}」`);
  };
  $('#svNew', d).onclick = doNew;
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') (cur ? $('#svUpd', d) : $('#svNew', d)).click(); });
  if (cur) $('#svUpd', d).onclick = () => { cur.name = inp.value.trim() || cur.name; cur.colors = colors(); cur.updated = Date.now(); persist(); d.close(); toast('已更新'); };
}

// ---------- 导出 ----------
function openExport(colors, title = '我的配色') {
  const FMT = [['png', 'PNG 色卡图'], ...TEXT_FORMATS.map(([id, n]) => [id, n]), ['ase', 'Adobe 色板 (.ase)']];
  let fmt = 'png', layout = 'chips';
  const show = { name: true, hex: true, rgb: true, cmyk: true };
  const d = openDialog(`
    <div class="dlg-h"><h3>导出</h3><button class="btn icon" data-close aria-label="关闭">${ICON.x}</button></div>
    <div class="ex">
      <nav class="ex-nav">${FMT.map(([id, n]) => `<button data-f="${id}">${n}</button>`).join('')}</nav>
      <div class="ex-body" id="exBody"></div>
    </div>`, 'lg');
  const body = $('#exBody', d);
  const fileBase = (title || 'palette').replace(/[\\/:*?"<>|]/g, '_');
  function paint() {
    $$('.ex-nav button', d).forEach(b => b.classList.toggle('on', b.dataset.f === fmt));
    if (fmt === 'png') {
      body.innerHTML = `
        <div class="row gap wrap">
          <div class="seg" id="exLayout"><button data-l="chips">色卡卡片</button><button data-l="strip">竖条</button></div>
          ${[['name', '名称'], ['hex', 'HEX'], ['rgb', 'RGB'], ['cmyk', 'CMYK']].map(([k, n]) => `<label class="check"><input type="checkbox" data-s="${k}" ${show[k] ? 'checked' : ''}> ${n}</label>`).join('')}
        </div>
        <label class="field"><span>标题</span><input class="input" id="exTitle" value="${esc(title)}" maxlength="40"></label>
        <div class="ex-img"><img id="exImg" alt="色卡预览"></div>
        <div class="row gap"><button class="btn primary" id="exDl">${ICON.download}<span>下载 PNG</span></button><button class="btn" id="exCp">${ICON.copy}<span>复制图片</span></button></div>`;
      $$('#exLayout button', body).forEach(b => b.classList.toggle('on', b.dataset.l === layout));
      const draw = () => drawCard(colors, { title: $('#exTitle', body).value || title, layout, show });
      const refresh = () => { $('#exImg', body).src = draw().toDataURL('image/png'); };
      refresh();
      $('#exLayout', body).onclick = e => { const l = e.target.closest('button')?.dataset.l; if (l) { layout = l; paint(); } };
      body.querySelectorAll('[data-s]').forEach(i => (i.onchange = () => { show[i.dataset.s] = i.checked; refresh(); }));
      $('#exTitle', body).oninput = refresh;
      $('#exDl', body).onclick = () => draw().toBlob(b => download(`${fileBase}.png`, b));
      $('#exCp', body).onclick = () => draw().toBlob(async b => {
        try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]); toast('已复制图片'); }
        catch { toast('这个浏览器不支持复制图片，请用下载'); }
      });
    } else if (fmt === 'ase') {
      body.innerHTML = `<p>Adobe Swatch Exchange 色板文件，可导入 Photoshop、Illustrator、InDesign，以及 Procreate（色板 → + → 导入）等软件。</p>
        ${stripHtml(colors.map(c => c.hex), 'big')}
        <div class="row gap"><button class="btn primary" id="exDl">${ICON.download}<span>下载 .ase</span></button></div>`;
      $('#exDl', body).onclick = () => download(`${fileBase}.ase`, toASE(colors, title), 'application/octet-stream');
    } else {
      const ext = TEXT_FORMATS.find(f => f[0] === fmt)[2];
      const txt = toText(fmt, colors, title);
      body.innerHTML = `<pre class="code big">${esc(txt)}</pre>
        <div class="row gap"><button class="btn primary" id="exCp">${ICON.copy}<span>复制</span></button><button class="btn" id="exDl">${ICON.download}<span>下载 .${ext}</span></button></div>`;
      $('#exCp', body).onclick = () => copy(txt, '代码');
      $('#exDl', body).onclick = () => download(`${fileBase}.${ext}`, txt, fmt === 'svg' ? 'image/svg+xml' : 'text/plain');
    }
  }
  $('.ex-nav', d).onclick = e => { const f = e.target.closest('button')?.dataset.f; if (f) { fmt = f; paint(); } };
  paint();
}

// ---------- 单色详情（色库等处使用） ----------
function openColor(hex, title = '', sub = '') {
  const f = formats(hex);
  const nn = nearestName(hex);
  const d = openDialog(`
    <div class="cd-top" style="background:${hex};color:${textOn(hex)}"><div><b>${esc(title || nn.name)}</b><small>${esc(sub)}</small></div><button class="btn icon ghost" data-close aria-label="关闭">${ICON.x}</button></div>
    <div class="vals">${Object.entries(f).map(([k, v]) => `<button class="val" data-copy="${esc(v)}"><span>${k}</span><code>${esc(v)}</code></button>`).join('')}</div>
    <div class="sub">色阶</div>
    ${stripHtml(scale(hex, 9))}
    <div class="dlg-f wrap"><button class="btn" id="cdRep">替换当前选中色</button><button class="btn" id="cdAdd">${ICON.plus}<span>加入色卡</span></button><span class="flex"></span><button class="btn primary" id="cdGen">${ICON.wand}<span>用它自动配色</span></button></div>`, 'sm nopad');
  d.querySelector('.dlg-in').addEventListener('click', e => { const c = e.target.closest('[data-copy]'); if (c) copy(c.dataset.copy); const h = e.target.closest('[data-hex]'); if (h) copy(h.dataset.hex); });
  const nm = title && !sub.includes('#') ? title : '';
  $('#cdAdd', d).onclick = () => {
    if (state.palette.length >= 10) return toast('最多 10 个颜色');
    change(s => { s.palette.push({ hex, locked: false, name: nm }); s.sel = s.palette.length - 1; }); d.close(); toast('已加入当前色卡');
  };
  $('#cdRep', d).onclick = () => { change(s => { s.palette[s.sel] = { hex, locked: s.palette[s.sel].locked, name: nm }; }); d.close(); toast(`已替换第 ${state.sel + 1} 个颜色`); };
  $('#cdGen', d).onclick = () => { state.harmonyBase = hex; persist(); d.close(); location.hash = '#/harmony'; };
}

// =====================================================================
// 自动配色
// =====================================================================
function harmony() {
  const seeds = {};
  MOODS.forEach((m, i) => (seeds[m.id] = 11 + i * 101));
  let focus = 'analog';
  view.innerHTML = `
  <section class="hm">
    <aside class="panel hm-side">
      <div class="panel-h"><h3>基础色</h3>
        <div class="seg sm" id="hmMode" title="RYB 为美术传统色轮（红的补色是绿），RGB 为屏幕光学色轮（红的补色是青）"><button data-m="ryb">美术色轮</button><button data-m="rgb">光学色轮</button></div></div>
      <div id="hmWheel"></div>
      <label class="slider-row"><span>明度</span><input type="range" id="hmV" min="5" max="100"><output id="hmVo"></output></label>
      <div id="hmPicker"></div>
      <div class="sub">从当前色卡选一个</div>
      <div class="chips" id="hmFrom"></div>
      <label class="slider-row" id="hmSpreadRow"><span>角度</span><input type="range" id="hmSpread" min="10" max="60"><output id="hmSpreadO"></output></label>
      <p class="hint">拖动色轮上的大圆点改变基础色；「角度」影响类似色、分裂互补、矩形、复合色。</p>
    </aside>
    <div class="hm-main">
      <div class="hm-count"><span>颜色数量</span><div class="seg" id="hmCount">${[2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<button data-n="${n}">${n}</button>`).join('')}</div><label class="toggle" title="让互补、分裂互补等色彩理论配色的搭配色和基准色一深一浅，对比更明显"><input type="checkbox" id="hmContrast"><span>拉开明暗</span></label><span class="muted small">基础色固定在第一个</span></div>
      <h2 class="sec">色彩理论配色 <small>按色轮关系计算</small></h2>
      <div class="cards" id="hmSchemes"></div>
      <h2 class="sec">风格配色 <small>点 🎲 换一组</small></h2>
      <div class="cards" id="hmMoods"></div>
      <h2 class="sec">色阶与变化 <small>点击复制，或整行使用</small></h2>
      <div class="scales" id="hmScales"></div>
    </div>
  </section>`;

  const wheel = createWheel($('#hmWheel'), { mode: state.wheel, onBase: hex => setBase(hex) });
  const picker = createPicker($('#hmPicker'), { compact: true, onInput: hex => setBase(hex, false) });
  $('#hmSpread').value = state.spread;

  function setBase(hex, updatePicker = true) {
    state.harmonyBase = hex; persist();
    if (updatePicker) picker.set(hex);
    nextFrame(paint);
  }

  const lists = {};
  function card(kind, item, colors) {
    return `<div class="card ${focus === item.id ? 'focus' : ''}" data-id="${item.id}" data-kind="${kind}">
      ${stripHtml(colors, 'card-strip')}
      <div class="card-b"><div><b>${item.name}</b><p>${item.desc}</p></div>
        <div class="card-a">${kind === 'mood' ? `<button class="btn icon sm" data-act="roll" title="换一组">${ICON.dice}</button>` : ''}<button class="btn sm" data-act="use">使用</button></div></div>
    </div>`;
  }
  function paint() {
    const b = state.harmonyBase;
    $$('#hmMode button').forEach(x => x.classList.toggle('on', x.dataset.m === state.wheel));
    const v = Math.round(hexToHsv(b).v);
    $('#hmV').value = v; $('#hmVo').textContent = v;
    $('#hmSpreadO').textContent = state.spread + '°';
    $('#hmFrom').innerHTML = state.palette.map(c => `<button class="chip-c ${c.hex === b ? 'on' : ''}" style="background:${c.hex}" data-hex="${c.hex}" title="${c.hex}"></button>`).join('');
    const N = state.harmonyCount;
    $$('#hmCount button').forEach(x => x.classList.toggle('on', +x.dataset.n === N));
    SCHEMES.forEach(s => { const l = paletteFor(b, s.id, N, { wheel: state.wheel, spread: state.spread, contrast: state.contrast }); lists[s.id] = ['mono', 'shades'].includes(s.id) ? sortByLight(l) : l; });
    MOODS.forEach(m => { lists[m.id] = paletteFor(b, m.id, N, { seed: seeds[m.id] }); });
    $('#hmSchemes').innerHTML = SCHEMES.map(s => card('scheme', s, lists[s.id])).join('');
    $('#hmMoods').innerHTML = MOODS.map(m => card('mood', m, lists[m.id])).join('');
    const rows = [['色阶 50–900', scale(b, 10)], ['加白（浅色）', tints(b, 10)], ['加黑（深色）', shades(b, 10)], ['加灰（降饱和）', tones(b, 10)]];
    $('#hmScales').innerHTML = rows.map(([n, l], i) => `<div class="scale-row"><span>${n}</span>${stripHtml(l)}<button class="btn sm" data-row="${i}">使用</button></div>`).join('');
    lists._rows = rows.map(r => r[1]);
    wheel.update(b, lists[focus] || [b], state.wheel);
  }

  const use = list => { setPalette(list.slice(0, 10)); location.hash = '#/'; toast('已放入工作台，可以继续调整'); };
  const onCards = e => {
    const cardEl = e.target.closest('.card');
    if (!cardEl) return;
    const id = cardEl.dataset.id;
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'use') return use(lists[id]);
    if (act === 'roll') { seeds[id] = (seeds[id] * 7 + 13) % 100000; focus = id; return paint(); }
    const sw = e.target.closest('[data-hex]');
    if (sw) copy(sw.dataset.hex);
    if (focus !== id) { focus = id; $$('.card', view).forEach(c => c.classList.toggle('focus', c.dataset.id === id)); wheel.update(state.harmonyBase, lists[id], state.wheel); }
  };
  $('#hmSchemes').addEventListener('click', onCards);
  $('#hmMoods').addEventListener('click', onCards);
  $('#hmScales').addEventListener('click', e => { const r = e.target.closest('[data-row]'); if (r) return use(lists._rows[+r.dataset.row]); const h = e.target.closest('[data-hex]'); if (h) copy(h.dataset.hex); });
  $('#hmMode').onclick = e => { const m = e.target.closest('button')?.dataset.m; if (m) { state.wheel = m; persist(); paint(); } };
  $('#hmV').oninput = e => { const o = hexToHsv(state.harmonyBase); setBase(hsvToHex({ ...o, v: +e.target.value })); };
  $('#hmCount').onclick = e => { const n = +e.target.closest('button')?.dataset.n; if (n) { state.harmonyCount = n; persist(); paint(); } };
  $('#hmContrast').checked = state.contrast;
  $('#hmContrast').onchange = e => { state.contrast = e.target.checked; persist(); paint(); };
  $('#hmSpread').oninput = e => { state.spread = +e.target.value; persist(); nextFrame(paint); };
  $('#hmFrom').onclick = e => { const h = e.target.closest('[data-hex]')?.dataset.hex; if (h) setBase(h); };

  picker.set(state.harmonyBase);
  paint();
  return { destroy: () => wheel.destroy(), onChange: () => {} };
}

// =====================================================================
// 图片取色
// =====================================================================
const imgState = { img: null, name: '', k: 5, mode: 'dominant', result: [], picked: [] };
function imageView() {
  view.innerHTML = `
  <section class="ix">
    <div class="panel ix-stage" id="ixStage"></div>
    <aside class="panel ix-side">
      <div class="panel-h"><h3>提取配色</h3><button class="btn sm" id="ixPick">${ICON.image}<span>换图片</span></button></div>
      <label class="slider-row"><span>数量</span><input type="range" id="ixK" min="2" max="10"><output id="ixKo"></output></label>
      <div class="seg wide" id="ixMode">${EXTRACT_MODES.map(([id, n, d]) => `<button data-m="${id}" title="${d}">${n}</button>`).join('')}</div>
      <div id="ixRes"></div>
      <div class="row gap"><button class="btn primary" id="ixUse">使用这组配色</button><button class="btn" id="ixAdd">${ICON.plus}<span>加到当前色卡</span></button></div>
      <h4 class="sub">吸管取色</h4>
      <p class="hint">在图片上点一下就能取色；拖动图上的圆点可以微调提取的颜色。</p>
      <div class="picked" id="ixPicked"></div>
      <div class="row gap"><button class="btn sm" id="ixPUse">用吸取的颜色</button><button class="btn sm" id="ixPClr">清空</button></div>
    </aside>
    <input type="file" id="ixFile" accept="image/*" hidden>
  </section>`;
  const stage = $('#ixStage');
  let cv = null, ctx = null;

  function sample(x, y) {
    const px = Math.round(x * (cv.width - 1)), py = Math.round(y * (cv.height - 1));
    const r = 1, x0 = Math.max(0, px - r), y0 = Math.max(0, py - r);
    const d = ctx.getImageData(x0, y0, Math.min(cv.width - x0, r * 2 + 1), Math.min(cv.height - y0, r * 2 + 1)).data;
    let R = 0, G = 0, B = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) { R += d[i]; G += d[i + 1]; B += d[i + 2]; n++; }
    return '#' + [R / n, G / n, B / n].map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
  }

  function paintStage() {
    if (!imgState.img) {
      stage.innerHTML = `<button class="drop" id="ixDrop">${ICON.image}<b>拖入图片、点击选择，或直接粘贴（⌘/Ctrl + V）</b><small>照片、布料、插画、截图都可以。图片只在你的浏览器里处理，不会上传。</small></button>`;
      $('#ixDrop').onclick = () => $('#ixFile').click();
      return;
    }
    stage.innerHTML = `<div class="ix-img"><canvas id="ixCv"></canvas><div class="ix-marks" id="ixMarks"></div><div class="loupe" id="loupe"><canvas width="132" height="132"></canvas><span></span></div></div>`;
    cv = $('#ixCv'); cv.width = 0;
    const big = drawScaled(imgState.img, 1600);
    cv.width = big.width; cv.height = big.height;
    ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(big, 0, 0);
    bindStage();
  }

  function run() {
    if (!imgState.img) return;
    const small = drawScaled(imgState.img, 140);
    const data = small.getContext('2d').getImageData(0, 0, small.width, small.height);
    imgState.result = extract(data, imgState.k, imgState.mode);
    paintResult();
  }

  function paintMarks() {
    const m = $('#ixMarks');
    if (!m) return;
    m.innerHTML = imgState.result.map((c, i) => `<span class="mk" data-i="${i}" style="left:${c.x * 100}%;top:${c.y * 100}%;background:${c.hex}"></span>`).join('');
  }
  function paintResult() {
    $('#ixK').value = imgState.k; $('#ixKo').textContent = imgState.k;
    $$('#ixMode button').forEach(b => b.classList.toggle('on', b.dataset.m === imgState.mode));
    $('#ixRes').innerHTML = imgState.result.length
      ? `<div class="ix-res">${imgState.result.map(c => `<button data-hex="${c.hex}" style="background:${c.hex};color:${textOn(c.hex)}" title="点击复制"><span>${c.hex}</span><small>${Math.round(c.weight * 100) || '<1'}%</small></button>`).join('')}</div>`
      : '<p class="hint">还没有图片。</p>';
    $('#ixPicked').innerHTML = imgState.picked.length
      ? imgState.picked.map((h, i) => `<button class="chip-c" data-hex="${h}" data-i="${i}" style="background:${h}" title="${h}（点击复制，右键删除）"></button>`).join('')
      : '<span class="muted small">还没有吸取颜色</span>';
    ['ixUse', 'ixAdd'].forEach(id => ($('#' + id).disabled = !imgState.result.length));
    ['ixPUse', 'ixPClr'].forEach(id => ($('#' + id).disabled = !imgState.picked.length));
    paintMarks();
  }

  function bindStage() {
    const wrap = $('.ix-img'), loupe = $('#loupe'), lc = loupe.querySelector('canvas'), lctx = lc.getContext('2d'), lt = loupe.querySelector('span');
    lctx.imageSmoothingEnabled = false;
    let dragI = -1, downAt = null;
    const rel = e => { const r = cv.getBoundingClientRect(); return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)), r }; };
    function showLoupe(e) {
      const { x, y, r } = rel(e);
      const px = Math.round(x * cv.width), py = Math.round(y * cv.height), N = 11;
      lctx.clearRect(0, 0, 132, 132);
      lctx.drawImage(cv, px - (N >> 1), py - (N >> 1), N, N, 0, 0, 132, 132);
      lctx.strokeStyle = '#fff'; lctx.lineWidth = 2; lctx.strokeRect(60, 60, 12, 12);
      const hex = sample(x, y);
      lt.textContent = hex;
      loupe.style.left = x * r.width + 'px';
      loupe.style.top = y * r.height + 'px';
      loupe.classList.add('show');
      loupe.classList.toggle('flip', y < 0.3);
      return hex;
    }
    wrap.addEventListener('pointerdown', e => {
      const mk = e.target.closest('.mk');
      wrap.setPointerCapture(e.pointerId);
      if (mk) { dragI = +mk.dataset.i; e.preventDefault(); }
      else downAt = { x: e.clientX, y: e.clientY };
    });
    wrap.addEventListener('pointermove', e => {
      const hex = showLoupe(e);
      if (dragI >= 0) {
        const { x, y } = rel(e);
        Object.assign(imgState.result[dragI], { x, y, hex });
        const mk = $(`.mk[data-i="${dragI}"]`, wrap);
        mk.style.left = x * 100 + '%'; mk.style.top = y * 100 + '%'; mk.style.background = hex;
        nextFrame(paintResult);
      }
    });
    wrap.addEventListener('pointerup', e => {
      if (dragI < 0 && downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 5) {
        const { x, y } = rel(e);
        const hex = sample(x, y);
        imgState.picked.push(hex);
        if (imgState.picked.length > 20) imgState.picked.shift();
        paintResult(); toast(`吸取 ${hex}`);
      }
      dragI = -1; downAt = null;
    });
    wrap.addEventListener('pointerleave', () => loupe.classList.remove('show'));
  }

  function loadFile(file) {
    if (!file || !file.type.startsWith('image/')) return toast('请选择图片文件');
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { imgState.img = img; imgState.name = file.name; imgState.picked = []; paintStage(); run(); };
    img.onerror = () => toast('图片读取失败');
    img.src = url;
  }

  $('#ixFile').onchange = e => loadFile(e.target.files[0]);
  $('#ixPick').onclick = () => $('#ixFile').click();
  stage.addEventListener('dragover', e => { e.preventDefault(); stage.classList.add('over'); });
  stage.addEventListener('dragleave', () => stage.classList.remove('over'));
  stage.addEventListener('drop', e => { e.preventDefault(); stage.classList.remove('over'); loadFile(e.dataTransfer.files[0]); });
  const onPaste = e => { const f = [...(e.clipboardData?.files || [])].find(f => f.type.startsWith('image/')); if (f) { e.preventDefault(); loadFile(f); } };
  document.addEventListener('paste', onPaste);

  $('#ixK').oninput = e => { imgState.k = +e.target.value; $('#ixKo').textContent = imgState.k; nextFrame(run); };
  $('#ixMode').onclick = e => { const m = e.target.closest('button')?.dataset.m; if (m) { imgState.mode = m; run(); } };
  $('#ixRes').onclick = e => { const h = e.target.closest('[data-hex]'); if (h) copy(h.dataset.hex); };
  $('#ixPicked').onclick = e => { const h = e.target.closest('[data-hex]'); if (h) copy(h.dataset.hex); };
  $('#ixPicked').oncontextmenu = e => { const h = e.target.closest('[data-i]'); if (h) { e.preventDefault(); imgState.picked.splice(+h.dataset.i, 1); paintResult(); } };
  const sorted = () => imgState.result.map(c => c.hex);
  $('#ixUse').onclick = () => { setPalette(sorted()); location.hash = '#/'; toast('已放入工作台'); };
  $('#ixAdd').onclick = () => addColors(sorted());
  $('#ixPUse').onclick = () => { setPalette(imgState.picked.slice(-10).length >= 2 ? imgState.picked.slice(-10) : [...imgState.picked, ...hexes()].slice(0, 5)); location.hash = '#/'; };
  $('#ixPClr').onclick = () => { imgState.picked = []; paintResult(); };

  paintStage();
  if (imgState.img) paintResult(); else paintResult();
  return { destroy: () => document.removeEventListener('paste', onPaste) };
}
function addColors(list) {
  const room = 10 - state.palette.length;
  if (room <= 0) return toast('当前色卡已满 10 个颜色');
  change(s => { list.slice(0, room).forEach(h => s.palette.push({ hex: h, locked: false, name: '' })); });
  toast(list.length > room ? `只加入了 ${room} 个（最多 10 个）` : `已加入 ${list.length} 个颜色`);
}

// =====================================================================
// 色库
// =====================================================================
const libState = { tab: 'cn', q: '', fam: '', sort: 'default', tag: '' };
function library() {
  const TABS = [['cn', '中国传统色', CN.length], ['jp', '日本传统色', JP.length], ['pal', '流行配色', PALETTES.length], ['year', '年度流行色', YEARLY.length], ['famous', '网红名色', FAMOUS.length], ['fil', '3D 打印耗材', FILAMENTS.length]];
  view.innerHTML = `
  <section class="lib">
    <div class="lib-h">
      <div class="tabs big" id="libTabs">${TABS.map(([id, n, c]) => `<button data-t="${id}">${n}<small>${c}</small></button>`).join('')}</div>
      <div class="lib-f" id="libF"></div>
    </div>
    <div id="libBody"></div>
  </section>`;

  function items() {
    switch (libState.tab) {
      case 'cn': return CN.map(([n, h]) => ({ n, h, s: '' }));
      case 'jp': return JP.map(([n, r, h]) => ({ n, h, s: r }));
      case 'year': return YEARLY.map(([y, en, cn, h]) => ({ n: cn, h, s: `${y} · ${en}` }));
      case 'famous': return FAMOUS.map(([n, h, s]) => ({ n, h, s }));
      case 'fil': return FILAMENTS.map(([en, cn, h]) => ({ n: cn, h, s: `PLA Basic · ${en}` }));
    }
    return [];
  }

  function paintFilters() {
    $$('#libTabs button').forEach(b => b.classList.toggle('on', b.dataset.t === libState.tab));
    if (libState.tab === 'pal') {
      const tags = [...new Set(PALETTES.flatMap(p => p.tags))];
      $('#libF').innerHTML = `<div class="chips">${['', ...tags].map(t => `<button class="chip ${libState.tag === t ? 'on' : ''}" data-tag="${t}">${t || '全部'}</button>`).join('')}</div>`;
    } else {
      $('#libF').innerHTML = `
        <input class="input search" id="libQ" placeholder="搜索名称或色值" value="${esc(libState.q)}">
        <div class="chips">${['', ...FAMILIES].map(f => `<button class="chip ${libState.fam === f ? 'on' : ''}" data-fam="${f}">${f ? `<i style="background:${famColor(f)}"></i>${f}` : '全部'}</button>`).join('')}</div>
        <select class="select" id="libSort"><option value="default">默认顺序</option><option value="hue">按色相</option><option value="light">由浅到深</option></select>`;
      $('#libSort').value = libState.sort;
    }
  }

  function paintBody() {
    const body = $('#libBody');
    if (libState.tab === 'pal') {
      const list = PALETTES.filter(p => !libState.tag || p.tags.includes(libState.tag));
      body.innerHTML = `<div class="cards">${list.map(p => `<div class="card" data-name="${esc(p.name)}">
        ${stripHtml(p.colors, 'card-strip')}
        <div class="card-b"><div><b>${esc(p.name)}</b><p>${p.tags.map(t => `<span class="tag">${t}</span>`).join('')}</p></div>
          <div class="card-a"><button class="btn icon sm" data-act="fav" title="收藏到我的色卡">${ICON.heart}</button><button class="btn sm" data-act="use">使用</button></div></div></div>`).join('')}</div>
        <p class="hint center">这些是按当下流行风格整理的示例配色，可以直接使用或继续调整。</p>`;
      return;
    }
    let list = items();
    const q = libState.q.trim().toLowerCase();
    if (q) list = list.filter(x => x.n.toLowerCase().includes(q) || x.h.toLowerCase().includes(q.replace('#', '')) || (x.s || '').toLowerCase().includes(q));
    if (libState.fam) list = list.filter(x => family(x.h) === libState.fam);
    if (libState.sort === 'hue') list = [...list].sort((a, b) => hueKey(a.h) - hueKey(b.h));
    if (libState.sort === 'light') list = [...list].sort((a, b) => hexToOklch(b.h).L - hexToOklch(a.h).L);
    const note = { cn: '数值采用常见流传版本，不同书籍和网站略有差异。', jp: '数值采用常见流传版本，仅供参考。', year: 'Pantone 年度代表色的屏幕近似值，印刷请以官方色卡为准。', famous: '屏幕近似值。', fil: '拓竹 PLA Basic 常见颜色的屏幕近似值，以实物色卡为准。' }[libState.tab];
    body.innerHTML = list.length ? `<div class="swatches">${list.map(x => `
      <button class="sw" data-hex="${x.h}" data-n="${esc(x.n)}" data-s="${esc(x.s)}">
        <span class="sw-c" style="background:${x.h}"></span>
        <span class="sw-t"><b>${esc(x.n)}</b><small>${esc(x.s || x.h)}</small>${x.s ? `<small class="mono">${x.h}</small>` : ''}</span>
      </button>`).join('')}</div><p class="hint center">${list.length} 个颜色 · ${note}</p>` : '<p class="empty">没有找到匹配的颜色</p>';
  }

  $('#libTabs').onclick = e => { const t = e.target.closest('button')?.dataset.t; if (t) { libState.tab = t; libState.fam = ''; paintFilters(); paintBody(); } };
  $('#libF').addEventListener('input', e => { if (e.target.id === 'libQ') { libState.q = e.target.value; paintBody(); } });
  $('#libF').addEventListener('change', e => { if (e.target.id === 'libSort') { libState.sort = e.target.value; paintBody(); } });
  $('#libF').addEventListener('click', e => {
    const b = e.target.closest('.chip');
    if (!b) return;
    if ('fam' in b.dataset) libState.fam = b.dataset.fam;
    if ('tag' in b.dataset) libState.tag = b.dataset.tag;
    $$('.chip', $('#libF')).forEach(c => c.classList.toggle('on', c === b));
    paintBody();
  });
  $('#libBody').addEventListener('click', e => {
    const card = e.target.closest('.card');
    if (card) {
      const p = PALETTES.find(x => x.name === card.dataset.name);
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'use') { setPalette(p.colors); location.hash = '#/'; toast(`已使用「${p.name}」`); }
      else if (act === 'fav') { state.saved.unshift({ id: uid(), name: p.name, colors: p.colors.map(hex => ({ hex, name: '' })), created: Date.now(), updated: Date.now() }); persist(); toast(`已收藏「${p.name}」`); }
      else { const h = e.target.closest('[data-hex]'); if (h) copy(h.dataset.hex); }
      return;
    }
    const sw = e.target.closest('.sw');
    if (sw) openColor(sw.dataset.hex, sw.dataset.n, sw.dataset.s);
  });

  paintFilters(); paintBody();
  return {};
}
function hueKey(h) { const o = hexToOklch(h); return o.C < 0.03 ? 1000 + (1 - o.L) : (o.h + 340) % 360; }
function famColor(f) { return { 红: '#D93A3A', 粉: '#F4A7B9', 橙: '#F28C28', 棕: '#8B5A3C', 黄: '#F4D03F', 绿: '#4CAF50', 青: '#26A69A', 蓝: '#2F6FD6', 紫: '#8E5CC4', 白: '#F5F5F5', 灰: '#9E9E9E', 黑: '#222222' }[f]; }

// =====================================================================
// 我的色卡
// =====================================================================
function savedView() {
  view.innerHTML = `
  <section class="saved">
    <div class="saved-h"><h2>我的色卡 <small id="svCount"></small></h2>
      <div class="grp"><button class="btn" id="svImp">${ICON.upload}<span>导入</span></button><button class="btn" id="svBak">${ICON.download}<span>备份全部</span></button></div>
    </div>
    <div id="svBody"></div>
    <input type="file" id="svFile" accept=".json,application/json" hidden>
  </section>`;

  function paint() {
    $('#svCount').textContent = state.saved.length ? `${state.saved.length} 个` : '';
    $('#svBak').disabled = !state.saved.length;
    $('#svBody').innerHTML = state.saved.length ? `<div class="cards">${state.saved.map(p => `
      <div class="card ${p.id === state.currentSavedId ? 'focus' : ''}" data-id="${p.id}">
        ${stripHtml(p.colors.map(c => c.hex), 'card-strip tall')}
        <div class="card-b"><div><b>${esc(p.name)}</b><p>${p.colors.length} 色 · ${new Date(p.updated || p.created).toLocaleDateString('zh-CN')}</p></div>
          <div class="card-a">
            <button class="btn icon sm" data-act="rename" title="重命名">${ICON.edit}</button>
            <button class="btn icon sm" data-act="export" title="导出">${ICON.download}</button>
            <button class="btn icon sm" data-act="del" title="删除">${ICON.trash}</button>
            <button class="btn sm" data-act="open">打开</button>
          </div></div></div>`).join('')}</div>`
      : `<div class="empty-big">${ICON.heart}<b>还没有保存的色卡</b><p>在工作台点「保存」，或在色库里收藏喜欢的配色。</p><a class="btn primary" href="#/">去工作台</a></div>`;
  }
  $('#svBody').addEventListener('click', e => {
    const card = e.target.closest('.card');
    if (!card) return;
    const p = state.saved.find(x => x.id === card.dataset.id);
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'open') {
      change(s => { s.palette = p.colors.map(c => ({ hex: c.hex, name: c.name || '', locked: false })); s.sel = 0; s.currentSavedId = p.id; });
      location.hash = '#/';
    } else if (act === 'rename') {
      const n = prompt('新名称', p.name);
      if (n && n.trim()) { p.name = n.trim(); p.updated = Date.now(); persist(); paint(); }
    } else if (act === 'export') openExport(p.colors.map(c => ({ hex: c.hex, name: c.name || autoName(c.hex) })), p.name);
    else if (act === 'del') {
      if (confirm(`删除「${p.name}」？删除后无法恢复。`)) { state.saved = state.saved.filter(x => x !== p); if (state.currentSavedId === p.id) state.currentSavedId = null; persist(); paint(); }
    } else { const h = e.target.closest('[data-hex]'); if (h) copy(h.dataset.hex); }
  });
  $('#svBak').onclick = () => download(`配色色卡备份-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ app: 'colorkit', version: 1, saved: state.saved }, null, 2), 'application/json');
  $('#svImp').onclick = () => $('#svFile').click();
  $('#svFile').onchange = async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      const toItem = (x, i) => {
        const cols = (x.colors || x).map(c => (typeof c === 'string' ? { hex: normHex(c) || parseColor(c), name: '' } : { hex: normHex(c.hex) || parseColor(c.hex), name: c.name || '' })).filter(c => c.hex);
        return cols.length ? { id: uid(), name: x.name || `导入 ${i + 1}`, colors: cols.slice(0, 10), created: Date.now(), updated: Date.now() } : null;
      };
      const src = d.saved || (Array.isArray(d) && typeof d[0] === 'string' ? [d] : Array.isArray(d) ? d : [d]);
      const list = src.map(toItem).filter(Boolean);
      if (!list.length) throw new Error();
      state.saved = [...list, ...state.saved]; persist(); paint(); toast(`已导入 ${list.length} 个色卡`);
    } catch { toast('无法识别这个文件'); }
  };
  paint();
  return {};
}

// =====================================================================
// 图案上色：按灰度图的层数自动配色
// =====================================================================
const RC_MODES = [SMART, ...SCHEMES, ...MOODS];
const rc = { img: null, name: '', svgText: null, levels: [], map: null, thumbMap: null, use: [], bgMode: 'orig', mode: 'split', base: null, seeds: {}, assign: {}, realId: '', keepValue: true, tooMany: false };
const rgbArr = hex => { const o = hexToRgb(hex); return [o.r, o.g, o.b]; };

/** 改色弹窗（取色器 + 当前色卡） */
function editColorDialog(hex, title, onOk) {
  const d = openDialog(`
    <div class="dlg-h"><h3>${esc(title)}</h3><button class="btn icon" data-close aria-label="关闭">${ICON.x}</button></div>
    <div id="ecPk"></div>
    <div class="sub">从当前色卡选</div>
    <div class="chips" id="ecChips">${state.palette.map(c => `<button class="chip-c" data-hex="${c.hex}" style="background:${c.hex}" title="${c.hex}"></button>`).join('')}</div>
    <div class="dlg-f"><span class="flex"></span><button class="btn" data-close>取消</button><button class="btn primary" id="ecOk">确定</button></div>`, 'sm');
  let cur = hex;
  const pk = createPicker($('#ecPk', d), { mode: state.pickerMode, onInput: h => (cur = h), onMode: m => { state.pickerMode = m; persist(); } });
  pk.set(hex);
  $('#ecChips', d).onclick = e => { const h = e.target.closest('[data-hex]')?.dataset.hex; if (h) { cur = h; pk.set(h); } };
  $('#ecOk', d).onclick = () => { d.close(); onOk(cur); };
}

function recolorView() {
  view.innerHTML = `
  <section class="rc">
    <div class="rc-grid">
      <div class="panel rc-stage" id="rcStage"></div>
      <aside class="panel rc-side" id="rcSide"></aside>
    </div>
    <div id="rcModes"></div>
    <input type="file" id="rcFile" accept="image/*,.svg" hidden>
  </section>`;
  const stage = $('#rcStage'), side = $('#rcSide'), modesEl = $('#rcModes');
  if (!rc.base) rc.base = state.palette[state.sel].hex;
  RC_MODES.forEach((m, i) => { if (rc.seeds[m.id] == null) rc.seeds[m.id] = 1000 + i * 7919; });

  const visible = () => rc.levels.map((l, i) => i).filter(i => rc.map && rc.map.inner[i] / Math.max(1, rc.map.fg) >= 0.002);
  const active = () => visible().filter(i => rc.use[i]);
  const bgOrig = () => (rc.map && rc.map.bgLevel >= 0 ? rc.levels[rc.map.bgLevel].rgb : null);
  /** 需要上色的对象：开启的层 + （可选）背景，带原图明度 */
  function targets() {
    const t = active().map(i => ({ key: i, lum: rc.levels[i].lum }));
    if (rc.bgMode === 'color') t.push({ key: 'bg', lum: rc.map.bgLevel >= 0 ? rc.levels[rc.map.bgLevel].lum + 0.5 : 256 });
    return t;
  }
  function paletteForMode(id, seed) {
    const tg = targets();
    if (!tg.length) return { assign: {}, list: [], realId: id };
    let realId = id;
    if (id === 'smart') { const pool = [...SCHEMES, ...MOODS].map(m => m.id); realId = pool[Math.floor(rng(seed)() * pool.length)]; }
    const list = paletteFor(rc.base, realId, tg.length, { wheel: state.wheel, spread: state.spread, contrast: state.contrast, seed });
    const assign = {};
    if (rc.keepValue) {
      const cs = sortByLight(list);
      [...tg].sort((a, b) => b.lum - a.lum).forEach((t, j) => (assign[t.key] = cs[j]));
    } else tg.forEach((t, j) => (assign[t.key] = list[j]));
    return { assign, list: rc.keepValue ? sortByLight(list) : list, realId };
  }
  const colsFrom = assign => rc.levels.map((l, i) => (rc.use[i] && assign[i] ? rgbArr(assign[i]) : l.rgb));
  const bgFrom = assign => (rc.bgMode === 'clear' ? null : rc.bgMode === 'color' ? rgbArr(assign.bg || '#FFFFFF') : bgOrig());
  function apply(id) { rc.mode = id; const r = paletteForMode(id, rc.seeds[id]); rc.assign = r.assign; rc.realId = r.realId; }
  /** 当前用到的颜色（从浅到深） */
  const usedColors = () => sortByLight(targets().map(t => rc.assign[t.key]).filter(Boolean));

  function paintStage() {
    if (!rc.img) {
      stage.innerHTML = `<button class="drop" id="rcDrop">${ICON.image}<b>上传灰度图案：拖进来、点击选择，或直接粘贴（⌘/Ctrl + V）</b>
        <small>支持 SVG / PNG / JPG。程序会识别图里有几种灰度，自动配同样数量的颜色，浅灰配浅色、深灰配深色。<br>图片只在你的浏览器里处理，不会上传。</small></button>`;
      $('#rcDrop').onclick = () => $('#rcFile').click();
      side.innerHTML = `<h3>图案上色</h3>
        <p class="hint">适合剪纸、贴纸、3D 打印分色、刺绣、拼布图样这类由几种纯色组成的图案。</p>
        <ol class="rc-steps"><li>上传用不同灰度区分各部分的图</li><li>自动识别有几层，配同样数量的颜色</li><li>下方一页看完所有配色方式的效果，点一下使用</li><li>点图上的区域可以单独改色，最后下载 PNG / SVG</li></ol>`;
      modesEl.innerHTML = '';
      return;
    }
    stage.innerHTML = `<div class="rc-cv checker"><canvas id="rcCv" title="点击图上的区域可以修改这一层的颜色"></canvas></div>
      <div class="row gap"><span class="muted small rc-name">${esc(rc.name)} · 点图上的区域可以单独改色</span><span class="flex"></span><button class="btn sm" id="rcPick">${ICON.image}<span>换图片</span></button></div>`;
    $('#rcPick').onclick = () => $('#rcFile').click();
    $('#rcCv').onclick = e => {
      const cv = e.currentTarget, r = cv.getBoundingClientRect();
      const x = Math.min(rc.map.w - 1, Math.floor(((e.clientX - r.left) / r.width) * rc.map.w));
      const y = Math.min(rc.map.h - 1, Math.floor(((e.clientY - r.top) / r.height) * rc.map.h));
      const i = y * rc.map.w + x;
      if (rc.map.bg[i]) return rc.bgMode === 'color' ? edit('bg') : toast('这是外部背景：在右侧把背景设为「也上色」就能改色');
      const lv = rc.map.A[i];
      if (!rc.use[lv]) return toast('这一层没有开启上色');
      edit(lv);
    };
  }

  function paintMain() {
    const cv = $('#rcCv');
    if (!cv) return;
    cv.width = rc.map.w; cv.height = rc.map.h;
    cv.getContext('2d').putImageData(paint(rc.map, colsFrom(rc.assign), bgFrom(rc.assign)), 0, 0);
  }

  function paintSide() {
    const vis = visible();
    const k = targets().length;
    side.innerHTML = `
      <div class="panel-h"><h3>识别到 ${vis.length} 层</h3><span class="badge ok">配 ${k} 色</span></div>
      ${rc.tooMany ? '<p class="hint warn">这张图颜色很多，可能不是纯色图案，只取了面积最大的 10 种。</p>' : ''}
      <div class="rc-levels">${vis.map((i, n) => {
        const l = rc.levels[i];
        const now = rc.use[i] && rc.assign[i] ? rc.assign[i] : l.hex;
        const pct = Math.max(1, Math.round((rc.map.inner[i] / rc.map.fg) * 100));
        const tag = i === rc.map.bgLevel ? '和背景同色的内部区域' : n === 0 ? '最浅' : n === vis.length - 1 ? '最深' : '';
        return `<div class="rc-lv ${rc.use[i] ? '' : 'off'}">
          <label class="toggle bare" title="是否给这一层上色"><input type="checkbox" data-use="${i}" ${rc.use[i] ? 'checked' : ''}></label>
          <span class="rc-sw" style="background:${l.hex}" title="原来的颜色 ${l.hex}"></span>
          <span class="muted">→</span>
          <button class="rc-sw big" data-edit="${i}" style="background:${now}" title="点击修改这一层的颜色" ${rc.use[i] ? '' : 'disabled'}></button>
          <div class="rc-lv-t"><b>${now}</b><small>原 ${l.hex} · 占 ${pct}%${tag ? ' · ' + tag : ''}</small></div>
        </div>`;
      }).join('')}</div>
      <div class="sub">外部背景</div>
      <div class="row gap wrap"><div class="seg" id="rcBg"><button data-b="orig">原样</button><button data-b="clear">透明</button><button data-b="color">也上色</button></div>
        ${rc.bgMode === 'color' && rc.assign.bg ? `<button class="rc-sw big" data-edit="bg" style="background:${rc.assign.bg}" title="点击修改背景色"></button>` : ''}</div>
      <div class="sub">配色设置</div>
      <div class="row gap wrap"><span class="small muted">基础色</span><button class="rc-sw big" id="rcBase" style="background:${rc.base}" title="点击修改基础色"></button><code class="small">${rc.base}</code>
        <button class="btn icon sm" id="rcBaseRand" title="随机换一个基础色">${ICON.dice}</button><button class="btn sm" id="rcBaseWs">用工作台选中色</button></div>
      <div class="row gap wrap rc-opts">
        <label class="toggle" title="让互补、分裂互补等色彩理论配色的搭配色和基础色一深一浅"><input type="checkbox" id="rcContrast" ${state.contrast ? 'checked' : ''}><span>拉开明暗</span></label>
        <label class="toggle" title="原图浅的部分配浅色，深的部分配深色"><input type="checkbox" id="rcKeep" ${rc.keepValue ? 'checked' : ''}><span>保持原图明暗</span></label>
      </div>
      <div class="sub">当前配色 <small>${esc(modeName(rc.mode))}${rc.mode === 'smart' && rc.realId ? ' · ' + esc(modeName(rc.realId)) : ''}</small></div>
      ${stripHtml(usedColors())}
      <div class="row gap wrap rc-ex">
        <button class="btn primary" id="rcPng">${ICON.download}<span>下载 PNG</span></button>
        ${rc.svgText ? `<button class="btn" id="rcSvg" title="保持矢量，只替换颜色">${ICON.download}<span>下载 SVG</span></button>` : ''}
        <button class="btn" id="rcWs">放进工作台</button>
        <button class="btn" id="rcSave">${ICON.heart}<span>保存色卡</span></button>
      </div>`;
    $$('#rcBg button', side).forEach(b => b.classList.toggle('on', b.dataset.b === rc.bgMode));
  }

  function drawThumb(id) {
    const el = modesEl.querySelector(`.rc-th[data-id="${id}"]`);
    if (!el) return;
    const r = paletteForMode(id, rc.seeds[id]);
    const assign = id === rc.mode ? rc.assign : r.assign;
    const cv = el.querySelector('canvas');
    cv.width = rc.thumbMap.w; cv.height = rc.thumbMap.h;
    cv.getContext('2d').putImageData(paint(rc.thumbMap, colsFrom(assign), bgFrom(assign)), 0, 0);
    el.querySelector('.rc-th-s').innerHTML = r.list.map(h => `<span style="background:${h}"></span>`).join('');
    if (id === 'smart') el.querySelector('b').innerHTML = `智能随机 <small class="muted">· ${esc(modeName(r.realId))}</small>`;
  }
  function paintThumbs() {
    modesEl.innerHTML = `
      <div class="rc-modes-h"><h2 class="sec">选择配色方式 <small>每种方式套在你的图案上的效果，点一下使用</small></h2>
        <button class="btn sm" id="rcRollAll">${ICON.dice}<span>全部换一组</span></button></div>
      <div class="rc-thumbs">${RC_MODES.map(m => `
        <div class="rc-th ${rc.mode === m.id ? 'on' : ''}" data-id="${m.id}" tabindex="0" title="${esc(m.desc)}">
          <div class="rc-th-img checker"><canvas></canvas></div>
          <div class="rc-th-b"><b>${m.name}</b><button class="btn icon sm" data-roll title="换一组">${ICON.dice}</button></div>
          <div class="rc-th-s"></div>
        </div>`).join('')}</div>`;
    RC_MODES.forEach(m => drawThumb(m.id));
  }

  const refreshAll = () => { apply(rc.mode); paintSide(); paintMain(); paintThumbs(); };
  const refreshMain = () => { paintSide(); paintMain(); drawThumb(rc.mode); };
  function edit(key) {
    const cur = key === 'bg' ? rc.assign.bg : rc.assign[key];
    editColorDialog(cur, key === 'bg' ? '修改背景色' : '修改这一层的颜色', hex => { rc.assign[key] = hex; refreshMain(); });
  }

  async function load(file) {
    if (!file) return;
    try {
      const { img, svgText } = await loadFile(file);
      const data = pixels(img, 900);
      const det = detectLevels(data);
      if (!det.levels.length) throw new Error('没有识别到颜色，图片可能是全透明的');
      Object.assign(rc, { img, name: file.name, svgText, levels: det.levels, tooMany: det.tooMany });
      rc.map = buildMap(data, det.levels);
      rc.thumbMap = buildMap(pixels(img, 240), det.levels);
      rc.use = det.levels.map(() => true);
      paintStage();
      refreshAll();
      toast(`识别到 ${visible().length} 层，已配 ${targets().length} 色`);
    } catch (err) { toast(err.message || '读取失败'); }
  }

  // --- 事件 ---
  $('#rcFile').onchange = e => { load(e.target.files[0]); e.target.value = ''; };
  stage.addEventListener('dragover', e => { e.preventDefault(); stage.classList.add('over'); });
  stage.addEventListener('dragleave', () => stage.classList.remove('over'));
  stage.addEventListener('drop', e => { e.preventDefault(); stage.classList.remove('over'); load(e.dataTransfer.files[0]); });
  const onPaste = e => { const f = [...(e.clipboardData?.files || [])].find(f => f.type.startsWith('image/')); if (f) { e.preventDefault(); load(f); } };
  document.addEventListener('paste', onPaste);

  side.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.use != null) { rc.use[+t.dataset.use] = t.checked; refreshAll(); }
    else if (t.id === 'rcContrast') { state.contrast = t.checked; persist(); refreshAll(); }
    else if (t.id === 'rcKeep') { rc.keepValue = t.checked; refreshAll(); }
  });
  side.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) { const h = e.target.closest('[data-hex]'); if (h) copy(h.dataset.hex); return; }
    if (b.dataset.edit != null) return edit(b.dataset.edit === 'bg' ? 'bg' : +b.dataset.edit);
    if (b.dataset.b) { rc.bgMode = b.dataset.b; return refreshAll(); }
    switch (b.id) {
      case 'rcBase': return editColorDialog(rc.base, '修改基础色', h => { rc.base = h; refreshAll(); });
      case 'rcBaseRand': rc.base = randomBase(rng(Date.now())); return refreshAll();
      case 'rcBaseWs': rc.base = state.palette[state.sel].hex; return refreshAll();
      case 'rcPng': {
        const map = buildMap(pixels(rc.img, 2400), rc.levels);
        const c = document.createElement('canvas');
        c.width = map.w; c.height = map.h;
        c.getContext('2d').putImageData(paint(map, colsFrom(rc.assign), bgFrom(rc.assign)), 0, 0);
        return c.toBlob(bl => download(rc.name.replace(/\.[^.]+$/, '') + '-上色.png', bl));
      }
      case 'rcSvg': {
        const vis = visible();
        const out = rc.levels.map((l, i) => (vis.includes(i) && rc.use[i] && rc.assign[i] ? rc.assign[i] : null));
        // 背景本身就是 SVG 里的一个色块（比如白色底）：按背景设置处理
        const bl = rc.map.bgLevel;
        if (bl >= 0 && !out[bl]) out[bl] = rc.bgMode === 'color' ? rc.assign.bg : rc.bgMode === 'clear' ? 'none' : null;
        const txt = recolorSvg(rc.svgText, rc.levels, out, rc.bgMode === 'color' && bl < 0 ? rc.assign.bg : null);
        return download(rc.name.replace(/\.[^.]+$/, '') + '-上色.svg', txt, 'image/svg+xml');
      }
      case 'rcWs': { const l = usedColors(); if (l.length < 2) return toast('至少要有 2 个颜色才能放进工作台'); setPalette(l.slice(0, 10)); location.hash = '#/'; return toast('已放进工作台'); }
      case 'rcSave': {
        const l = usedColors();
        if (!l.length) return;
        const name = rc.name.replace(/\.[^.]+$/, '') + ' 配色';
        state.saved.unshift({ id: uid(), name, colors: l.map(hex => ({ hex, name: '' })), created: Date.now(), updated: Date.now() });
        persist(); return toast(`已保存「${name}」`);
      }
    }
  });
  modesEl.addEventListener('click', e => {
    if (e.target.closest('#rcRollAll')) { Object.keys(rc.seeds).forEach(k => (rc.seeds[k] += 104729)); return refreshAll(); }
    const th = e.target.closest('.rc-th');
    if (!th) return;
    const id = th.dataset.id;
    if (e.target.closest('[data-roll]')) {
      rc.seeds[id] += 104729;
      if (id === rc.mode) { apply(id); refreshMain(); } else drawThumb(id);
      return;
    }
    apply(id);
    $$('.rc-th', modesEl).forEach(x => x.classList.toggle('on', x === th));
    paintSide(); paintMain(); drawThumb(id);
    stage.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  modesEl.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.classList.contains('rc-th')) e.target.click(); });

  paintStage();
  if (rc.img) refreshAll();
  return { destroy: () => document.removeEventListener('paste', onPaste) };
}

// ---------- 启动 ----------
load();
applyTheme();
route();
