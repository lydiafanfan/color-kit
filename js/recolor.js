// 图案上色：找出图里的灰度（颜色）层，按层换色；边缘抗锯齿按两层之间的比例混合
import { parseColor, hexToRgb, rgbToHex } from './color.js';

const d2 = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;

/** 读文件：SVG 补齐宽高后转成图片；其它图片直接读取 */
export async function loadFile(file) {
  const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
  let url, svgText = null;
  if (isSvg) {
    svgText = await file.text();
    const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
    const svg = doc.documentElement;
    if (!svg || svg.nodeName.toLowerCase() !== 'svg') throw new Error('不是有效的 SVG 文件');
    const vb = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
    let w = parseFloat(svg.getAttribute('width')), h = parseFloat(svg.getAttribute('height'));
    if (!(w > 0 && h > 0)) { if (vb.length === 4 && vb[2] > 0) { w = vb[2]; h = vb[3]; } else { w = h = 1000; } }
    if (vb.length !== 4 && /^\s*[\d.]+\s*(px)?\s*$/.test(svg.getAttribute('width') || '')) svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const s = 2000 / Math.max(w, h);
    svg.setAttribute('width', Math.round(w * s));
    svg.setAttribute('height', Math.round(h * s));
    url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }));
  } else {
    url = URL.createObjectURL(file);
  }
  const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error('图片读取失败')); i.src = url; });
  return { img, svgText };
}

/** 画到不超过 max 像素的画布上，返回 ImageData */
export function pixels(img, max) {
  const w0 = img.naturalWidth || img.width, h0 = img.naturalHeight || img.height;
  const s = Math.min(1, max / Math.max(w0, h0));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w0 * s)); c.height = Math.max(1, Math.round(h0 * s));
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return ctx.getImageData(0, 0, c.width, c.height);
}

/** 找出图里的颜色层（灰度图就是几种灰），按从浅到深排列 */
export function detectLevels(imgData) {
  const { data } = imgData;
  const bins = new Map();
  let opaque = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    opaque++;
    const k = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    let b = bins.get(k);
    if (!b) bins.set(k, (b = { n: 0, r: 0, g: 0, b: 0 }));
    b.n++; b.r += data[i]; b.g += data[i + 1]; b.b += data[i + 2];
  }
  // 抗锯齿边缘的过渡色数量很少，用阈值去掉
  const min = Math.max(20, opaque * 0.004);
  const peaks = [...bins.values()].filter(b => b.n >= min).map(b => ({ n: b.n, rgb: [b.r / b.n, b.g / b.n, b.b / b.n] })).sort((a, b) => b.n - a.n);
  const merged = [];
  for (const p of peaks) {
    const m = merged.find(q => d2(q.rgb, p.rgb) < 28 * 28);
    if (m) { const n = m.n + p.n; m.rgb = m.rgb.map((v, j) => (v * m.n + p.rgb[j] * p.n) / n); m.n = n; }
    else merged.push({ ...p });
  }
  // 去掉抗锯齿过渡色：真正的色块有"内部"（上下左右都是同一层），过渡色只有 1–2 像素宽，几乎没有内部
  const { width: W, height: H } = imgData;
  const lab = new Int16Array(W * H).fill(-1);
  const cnt = new Array(merged.length).fill(0), core = new Array(merged.length).fill(0);
  for (let i = 0, j = 0; i < W * H; i++, j += 4) {
    if (data[j + 3] < 128) continue;
    const p = [data[j], data[j + 1], data[j + 2]];
    let bi = 0, bd = Infinity;
    for (let k = 0; k < merged.length; k++) { const d = d2(p, merged[k].rgb); if (d < bd) { bd = d; bi = k; } }
    lab[i] = bi; cnt[bi]++;
  }
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x, k = lab[i];
    if (k >= 0 && lab[i - 1] === k && lab[i + 1] === k && lab[i - W] === k && lab[i + W] === k) core[k]++;
  }
  const real = merged.filter((m, k) => cnt[k] && (core[k] / cnt[k] >= 0.3 || cnt[k] / opaque >= 0.05));
  const keep = real.length ? real : [...merged];
  merged.length = 0;
  merged.push(...keep);
  const levels = merged.slice(0, 10).map(l => {
    const rgb = l.rgb.map(Math.round);
    return { rgb, hex: rgbToHex({ r: rgb[0], g: rgb[1], b: rgb[2] }), lum: 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2], n: l.n };
  }).sort((a, b) => b.lum - a.lum);
  const gray = levels.every(l => Math.max(...l.rgb) - Math.min(...l.rgb) < 24);
  return { levels, tooMany: merged.length > 10, gray, opaque };
}

/**
 * 为每个像素记录：最近的层 A、第二近的层 B、在 A→B 之间的位置 t、是否背景
 * 背景 = 从图片边缘连通的、和边缘同一层的区域（或透明区域）
 */
export function buildMap(imgData, levels) {
  const { data, width: w, height: h } = imgData;
  const N = w * h, L = levels.length;
  const A = new Uint8Array(N), B = new Uint8Array(N), T = new Uint8Array(N), alpha = new Uint8Array(N), bg = new Uint8Array(N);
  const lv = levels.map(l => l.rgb);
  for (let i = 0, j = 0; i < N; i++, j += 4) {
    alpha[i] = data[j + 3];
    if (data[j + 3] < 8 || !L) continue;
    const p = [data[j], data[j + 1], data[j + 2]];
    let a = 0, b = 0, da = Infinity, db = Infinity;
    for (let k = 0; k < L; k++) {
      const d = d2(p, lv[k]);
      if (d < da) { db = da; b = a; da = d; a = k; } else if (d < db) { db = d; b = k; }
    }
    if (L === 1) b = a;
    A[i] = a; B[i] = b;
    if (a !== b) {
      const va = lv[a], vb = lv[b];
      const len = d2(va, vb);
      const t = ((p[0] - va[0]) * (vb[0] - va[0]) + (p[1] - va[1]) * (vb[1] - va[1]) + (p[2] - va[2]) * (vb[2] - va[2])) / len;
      T[i] = Math.round(Math.min(1, Math.max(0, t)) * 255);
    }
  }
  // 边缘多数是什么：透明 / 某一层
  const votes = new Map();
  const vote = i => { const k = alpha[i] < 128 ? -1 : A[i]; votes.set(k, (votes.get(k) || 0) + 1); };
  for (let x = 0; x < w; x++) { vote(x); vote((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { vote(y * w); vote(y * w + w - 1); }
  let bgLevel = -1, best = -1;
  for (const [k, n] of votes) if (n > best) { best = n; bgLevel = k; }
  // 透明像素一律当背景
  for (let i = 0; i < N; i++) if (alpha[i] < 128) bg[i] = 1;
  if (bgLevel >= 0) {
    const q = new Int32Array(N);
    let head = 0, tail = 0;
    const ok = i => !bg[i] && alpha[i] >= 128 && A[i] === bgLevel;
    const push = i => { if (ok(i)) { bg[i] = 1; q[tail++] = i; } };
    for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
    while (head < tail) {
      const i = q[head++], x = i % w;
      if (x > 0) push(i - 1);
      if (x < w - 1) push(i + 1);
      if (i >= w) push(i - w);
      if (i < N - w) push(i + w);
    }
  }
  // 靠近背景 2 像素以内的边缘，过渡色朝背景色混合（避免出现一圈别的颜色）
  const near = new Uint8Array(N);
  let cur = bg;
  for (let r = 0; r < 2; r++) {
    const next = new Uint8Array(cur);
    for (let i = 0; i < N; i++) {
      if (cur[i]) continue;
      const x = i % w;
      if ((x > 0 && cur[i - 1]) || (x < w - 1 && cur[i + 1]) || (i >= w && cur[i - w]) || (i < N - w && cur[i + w])) { next[i] = 1; near[i] = 1; }
    }
    cur = next;
  }
  const inner = new Array(L).fill(0);
  let fg = 0;
  for (let i = 0; i < N; i++) if (!bg[i] && alpha[i] >= 128) { inner[A[i]]++; fg++; }
  return { w, h, A, B, T, alpha, bg, near, bgLevel, inner, fg };
}

/** cols：每层的 [r,g,b]；bgRGB 为 null 时背景透明 */
export function paint(map, cols, bgRGB) {
  const { w, h, A, B, T, alpha, bg, near, bgLevel } = map;
  const img = new ImageData(w, h);
  const d = img.data;
  for (let i = 0, j = 0; i < w * h; i++, j += 4) {
    if (bg[i]) {
      if (bgRGB) { d[j] = bgRGB[0]; d[j + 1] = bgRGB[1]; d[j + 2] = bgRGB[2]; d[j + 3] = 255; }
      continue;
    }
    const ca = cols[A[i]];
    let cb = cols[B[i]], t = T[i] / 255, a = alpha[i];
    if (near[i] && B[i] === bgLevel) {
      if (bgRGB) cb = bgRGB;
      else { a = a * (1 - t); t = 0; }
    }
    let r = ca[0] + (cb[0] - ca[0]) * t, g = ca[1] + (cb[1] - ca[1]) * t, b = ca[2] + (cb[2] - ca[2]) * t;
    if (a < 255 && bgRGB) {
      const f = a / 255;
      r = bgRGB[0] + (r - bgRGB[0]) * f; g = bgRGB[1] + (g - bgRGB[1]) * f; b = bgRGB[2] + (b - bgRGB[2]) * f; a = 255;
    }
    d[j] = r; d[j + 1] = g; d[j + 2] = b; d[j + 3] = a;
  }
  return img;
}

const NAMED = {
  white: '#FFFFFF', black: '#000000', gray: '#808080', grey: '#808080', silver: '#C0C0C0', lightgray: '#D3D3D3', lightgrey: '#D3D3D3',
  darkgray: '#A9A9A9', darkgrey: '#A9A9A9', dimgray: '#696969', dimgrey: '#696969', gainsboro: '#DCDCDC', whitesmoke: '#F5F5F5',
};
/**
 * SVG 换色：把 fill / stroke 等颜色替换成对应层的新颜色，保持矢量
 * out：每层的新 HEX（null 表示不变）；bgHex：给整个画面加背景色
 */
export function recolorSvg(text, levels, out, bgHex) {
  let s = text.replace(/((?:fill|stroke|stop-color|flood-color)\s*(?:=\s*["']\s*|:\s*))(#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|[a-zA-Z]+)/g, (m, pre, val) => {
    let v = val;
    if (/^#[0-9a-f]{8}$/i.test(v)) v = v.slice(0, 7);
    if (/^#[0-9a-f]{4}$/i.test(v)) v = v.slice(0, 4);
    const hex = NAMED[v.toLowerCase()] || parseColor(v);
    if (!hex) return m;
    const { r, g, b } = hexToRgb(hex);
    let bi = 0, bd = Infinity;
    levels.forEach((l, i) => { const d = d2([r, g, b], l.rgb); if (d < bd) { bd = d; bi = i; } });
    return out[bi] ? pre + out[bi] : m;
  });
  if (bgHex) s = s.replace(/<svg\b[^>]*>/i, t => `${t}<rect x="-50%" y="-50%" width="200%" height="200%" fill="${bgHex}"/>`);
  return s;
}
