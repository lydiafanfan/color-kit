// 取色器组件：饱和度 / 明度方块 + 色相条 + 多种色彩模式滑杆
import {
  clamp, normHex, parseColor, hexToRgb, rgbToHex, rgbToHsv, hsvToRgb, rgbToHsl, hslToRgb,
  hexToOklch, oklchToHex, rgbToCmyk, cmykToRgb,
} from './color.js';

const MODES = {
  HSB: {
    ch: [['H', '色相', 0, 360, 1], ['S', '饱和度', 0, 100, 1], ['B', '明度', 0, 100, 1]],
    read: (hex, hint) => { const o = rgbToHsv(hexToRgb(hex)); return [o.s < 0.5 || o.v < 0.5 ? hint.h : o.h, o.s, o.v]; },
    write: v => rgbToHex(hsvToRgb({ h: v[0], s: v[1], v: v[2] })),
  },
  HSL: {
    ch: [['H', '色相', 0, 360, 1], ['S', '饱和度', 0, 100, 1], ['L', '亮度', 0, 100, 1]],
    read: (hex, hint) => { const o = rgbToHsl(hexToRgb(hex)); return [o.s < 0.5 ? hint.h : o.h, o.s, o.l]; },
    write: v => rgbToHex(hslToRgb({ h: v[0], s: v[1], l: v[2] })),
  },
  RGB: {
    ch: [['R', '红', 0, 255, 1], ['G', '绿', 0, 255, 1], ['B', '蓝', 0, 255, 1]],
    read: hex => { const o = hexToRgb(hex); return [o.r, o.g, o.b]; },
    write: v => rgbToHex({ r: v[0], g: v[1], b: v[2] }),
  },
  OKLCH: {
    ch: [['L', '感知亮度', 0, 100, 0.5], ['C', '彩度', 0, 37, 0.1], ['H', '色相', 0, 360, 1]],
    read: (hex, hint) => { const o = hexToOklch(hex); return [o.L * 100, o.C * 100, o.C < 0.004 ? hint.lh : o.h]; },
    write: v => oklchToHex({ L: v[0] / 100, C: v[1] / 100, h: v[2] }),
  },
  CMYK: {
    ch: [['C', '青', 0, 100, 1], ['M', '品红', 0, 100, 1], ['Y', '黄', 0, 100, 1], ['K', '黑', 0, 100, 1]],
    read: hex => { const o = rgbToCmyk(hexToRgb(hex)); return [o.c, o.m, o.y, o.k]; },
    write: v => rgbToHex(cmykToRgb({ c: v[0], m: v[1], y: v[2], k: v[3] })),
  },
};
export const PICKER_MODES = Object.keys(MODES);

const fmtNum = (v, step) => (step < 1 ? (+v).toFixed(1) : Math.round(v));

/**
 * createPicker(el, { mode, onInput(hex), onMode(mode), compact })
 * onInput 在拖动时连续触发
 */
export function createPicker(el, opts = {}) {
  let mode = MODES[opts.mode] ? opts.mode : 'HSB';
  let hex = '#888888';
  let hsv = { h: 0, s: 0, v: 50 };
  let lh = 0; // OKLCH 色相记忆
  let vals = [];

  el.classList.add('pk');
  el.innerHTML = `
    <div class="pk-sv" tabindex="0" aria-label="饱和度与明度"><div class="pk-sv-knob"></div></div>
    <div class="pk-hue" tabindex="0" aria-label="色相"><div class="pk-knob"></div></div>
    <div class="pk-row">
      <span class="pk-chip"></span>
      <input class="pk-hex input mono" spellcheck="false" aria-label="颜色值（可粘贴 HEX / RGB / HSL）">
      ${'EyeDropper' in window ? '<button class="btn icon pk-drop" title="从屏幕任意位置吸取颜色"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.4 4.6a2.1 2.1 0 0 0-3 0l-2.2 2.2-1.1-1.1-1.4 1.4 1.1 1.1-7.3 7.3V19h3.5l7.3-7.3 1.1 1.1 1.4-1.4-1.1-1.1 2.2-2.2a2.1 2.1 0 0 0 0-3z"/></svg></button>' : ''}
    </div>
    ${opts.compact ? '' : `<div class="seg pk-modes">${PICKER_MODES.map(m => `<button data-m="${m}">${m}</button>`).join('')}</div>
    <div class="pk-sliders"></div>`}
  `;
  const sv = el.querySelector('.pk-sv'), svKnob = el.querySelector('.pk-sv-knob');
  const hue = el.querySelector('.pk-hue'), hueKnob = hue.querySelector('.pk-knob');
  const chip = el.querySelector('.pk-chip'), hexIn = el.querySelector('.pk-hex');
  const sliders = el.querySelector('.pk-sliders');

  function emit() { opts.onInput && opts.onInput(hex); }

  function paintSV() {
    sv.style.setProperty('--hue', `hsl(${hsv.h} 100% 50%)`);
    svKnob.style.left = hsv.s + '%';
    svKnob.style.top = 100 - hsv.v + '%';
    svKnob.style.background = hex;
    hueKnob.style.left = (hsv.h / 360) * 100 + '%';
    hueKnob.style.background = `hsl(${hsv.h} 100% 50%)`;
    chip.style.background = hex;
    if (document.activeElement !== hexIn) hexIn.value = hex;
  }

  function buildSliders() {
    if (!sliders) return;
    const M = MODES[mode];
    sliders.innerHTML = M.ch.map(([k, label, min, max, step], i) => `
      <label class="pk-sl" title="${label}">
        <span class="pk-k">${k}</span>
        <input type="range" min="${min}" max="${max}" step="${step}" data-i="${i}">
        <input class="input mono pk-n" type="number" min="${min}" max="${max}" step="${step}" data-i="${i}">
      </label>`).join('');
    el.querySelectorAll('.pk-modes button').forEach(b => b.classList.toggle('on', b.dataset.m === mode));
  }

  function paintSliders() {
    if (!sliders) return;
    const M = MODES[mode];
    vals = M.read(hex, { h: hsv.h, lh });
    M.ch.forEach(([, , min, max, step], i) => {
      const r = sliders.querySelector(`input[type=range][data-i="${i}"]`);
      const n = sliders.querySelector(`input.pk-n[data-i="${i}"]`);
      r.value = vals[i];
      if (document.activeElement !== n) n.value = fmtNum(vals[i], step);
      const stops = [];
      for (let j = 0; j <= 10; j++) { const v = [...vals]; v[i] = min + ((max - min) * j) / 10; stops.push(M.write(v)); }
      r.style.background = `linear-gradient(90deg, ${stops.join(',')})`;
    });
  }

  function fromHex(h, keepHue = true) {
    hex = h;
    const o = rgbToHsv(hexToRgb(h));
    hsv = { h: keepHue && (o.s < 0.5 || o.v < 0.5) ? hsv.h : o.h, s: o.s, v: o.v };
    const l = hexToOklch(h);
    if (l.C > 0.004) lh = l.h;
  }

  function setFromHsv(emitIt = true) {
    hex = rgbToHex(hsvToRgb(hsv));
    const l = hexToOklch(hex);
    if (l.C > 0.004) lh = l.h;
    paintSV(); paintSliders();
    if (emitIt) emit();
  }

  function drag(target, onMove) {
    target.addEventListener('pointerdown', e => {
      e.preventDefault();
      target.setPointerCapture(e.pointerId);
      target.focus({ preventScroll: true });
      const move = ev => { const r = target.getBoundingClientRect(); onMove(clamp((ev.clientX - r.left) / r.width), clamp((ev.clientY - r.top) / r.height)); };
      move(e);
      const up = () => { target.removeEventListener('pointermove', move); target.removeEventListener('pointerup', up); target.removeEventListener('pointercancel', up); };
      target.addEventListener('pointermove', move);
      target.addEventListener('pointerup', up);
      target.addEventListener('pointercancel', up);
    });
  }
  drag(sv, (x, y) => { hsv.s = x * 100; hsv.v = (1 - y) * 100; setFromHsv(); });
  drag(hue, x => { hsv.h = x * 360; setFromHsv(); });

  sv.addEventListener('keydown', e => {
    const d = e.shiftKey ? 10 : 1;
    const k = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, d], ArrowDown: [0, -d] }[e.key];
    if (!k) return;
    e.preventDefault(); hsv.s = clamp(hsv.s + k[0], 0, 100); hsv.v = clamp(hsv.v + k[1], 0, 100); setFromHsv();
  });
  hue.addEventListener('keydown', e => {
    const d = (e.shiftKey ? 10 : 1) * ({ ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key] || 0);
    if (!d) return;
    e.preventDefault(); hsv.h = (hsv.h + d + 360) % 360; setFromHsv();
  });

  hexIn.addEventListener('input', () => {
    const h = parseColor(hexIn.value);
    if (h && h !== hex) { fromHex(h); paintSV(); paintSliders(); emit(); }
  });
  hexIn.addEventListener('blur', () => { hexIn.value = hex; });
  hexIn.addEventListener('keydown', e => { if (e.key === 'Enter') hexIn.blur(); });

  const dropBtn = el.querySelector('.pk-drop');
  if (dropBtn) dropBtn.addEventListener('click', async () => {
    try { const r = await new window.EyeDropper().open(); const h = normHex(r.sRGBHex) || parseColor(r.sRGBHex); if (h) { fromHex(h, false); paintSV(); paintSliders(); emit(); } } catch { /* 用户取消 */ }
  });

  if (sliders) {
    el.querySelector('.pk-modes').addEventListener('click', e => {
      const m = e.target.closest('button')?.dataset.m;
      if (!m) return;
      mode = m; buildSliders(); paintSliders(); opts.onMode && opts.onMode(m);
    });
    sliders.addEventListener('input', e => {
      const i = +e.target.dataset.i;
      if (Number.isNaN(i)) return;
      const M = MODES[mode];
      const [, , min, max] = M.ch[i];
      const v = parseFloat(e.target.value);
      if (Number.isNaN(v)) return;
      vals[i] = clamp(v, min, max);
      const h = M.write(vals);
      // 保持 HSB/HSL 色相，避免灰色时色相跳回 0
      if (mode === 'HSB') hsv = { h: vals[0], s: vals[1], v: vals[2] };
      else fromHex(h);
      if (mode === 'HSL' || mode === 'HSB') hsv.h = vals[0];
      if (mode === 'OKLCH') lh = vals[2];
      hex = h;
      paintSV();
      // 只更新其它滑杆，避免正在拖的那个跳动
      const keep = vals.slice();
      paintSliders();
      vals = keep;
      emit();
    });
  }

  buildSliders();

  return {
    set(h) {
      h = normHex(h);
      if (!h || h === hex) return;
      fromHex(h); paintSV(); paintSliders();
    },
    get: () => hex,
  };
}
