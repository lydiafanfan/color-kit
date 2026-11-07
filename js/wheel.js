// 色轮：画布绘制 + 可拖动的基础色标记
// 色轮始终按全亮度绘制（只表示色相和饱和度），标记点显示每个颜色的真实颜色。
import { clamp, hexToHsv, hsvToHex, toWheel, fromWheel, hsvToRgb } from './color.js';

const cache = {};
function wheelImage(size, mode) {
  const key = size + mode;
  if (cache[key]) return cache[key];
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const R = size / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = x + 0.5 - R, dy = y + 0.5 - R, d = Math.hypot(dx, dy);
    if (d > R) continue;
    const i = (y * size + x) * 4;
    const ang = (Math.atan2(dx, -dy) * 180) / Math.PI;
    const { r, g, b } = hsvToRgb({ h: fromWheel(ang, mode), s: Math.min(1, d / R) * 100, v: 100 });
    img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b;
    img.data[i + 3] = d > R - 1 ? 255 * (R - d) : 255;
  }
  ctx.putImageData(img, 0, 0);
  return (cache[key] = c);
}

/**
 * createWheel(el, { mode, onBase(hex) })
 * update(base, colors, mode)
 */
export function createWheel(el, opts) {
  el.classList.add('wheel');
  el.innerHTML = `<div class="wheel-in"><canvas></canvas><svg class="wheel-lines"></svg><div class="wheel-marks"></div></div>`;
  const inner = el.querySelector('.wheel-in');
  const cv = el.querySelector('canvas'), svg = el.querySelector('svg'), marks = el.querySelector('.wheel-marks');
  let mode = opts.mode || 'ryb', base = '#888888', colors = [];
  let baseV = 100;

  const pos = hex => {
    const { h, s } = hexToHsv(hex);
    const a = (toWheel(h, mode) * Math.PI) / 180, r = (s / 100) * 0.5;
    return { x: 0.5 + Math.sin(a) * r, y: 0.5 - Math.cos(a) * r };
  };

  function draw() {
    const size = Math.round(inner.clientWidth * (window.devicePixelRatio || 1)) || 560;
    const img = wheelImage(Math.min(size, 900), mode);
    if (cv.width !== img.width) { cv.width = img.width; cv.height = img.height; }
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(img, 0, 0);
    const pts = colors.map(pos);
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.innerHTML = pts.map(p => `<line class="sh" x1="50" y1="50" x2="${p.x * 100}" y2="${p.y * 100}"/><line x1="50" y1="50" x2="${p.x * 100}" y2="${p.y * 100}"/>`).join('');
    marks.innerHTML = colors.map((c, i) => {
      const p = pts[i];
      return `<span class="mk ${c === base ? 'base' : ''}" style="left:${p.x * 100}%;top:${p.y * 100}%;background:${c}" title="${c}"></span>`;
    }).join('');
  }

  el.addEventListener('pointerdown', e => {
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    const move = ev => {
      const r = inner.getBoundingClientRect();
      const dx = ev.clientX - r.left - r.width / 2, dy = ev.clientY - r.top - r.height / 2;
      const s = clamp(Math.hypot(dx, dy) / (r.width / 2)) * 100;
      const ang = (Math.atan2(dx, -dy) * 180) / Math.PI;
      opts.onBase && opts.onBase(hsvToHex({ h: fromWheel(ang, mode), s, v: baseV }));
    };
    move(e);
    const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  });

  const ro = new ResizeObserver(() => draw());
  ro.observe(inner);

  return {
    update(b, list, m) {
      base = b; colors = list; mode = m || mode;
      baseV = Math.max(5, hexToHsv(b).v);
      draw();
    },
    destroy() { ro.disconnect(); },
  };
}
