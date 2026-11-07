// 图片主色提取：在 OKLab 空间做 k-means，再按不同偏好挑选
import { rgbToOklab, oklabToHex, rng } from './color.js';

export const EXTRACT_MODES = [
  ['dominant', '主色', '面积最大的颜色'],
  ['vivid', '鲜艳', '优先挑饱和、亮眼的颜色'],
  ['soft', '柔和', '优先挑浅淡、低饱和的颜色'],
  ['deep', '深沉', '优先挑深色'],
  ['diverse', '多样', '尽量互不相同'],
];

/**
 * imageData: 已缩小的 ImageData；返回 [{hex, x, y, weight}]，x/y 为 0~1 的相对位置
 */
export function extract(imageData, k = 5, mode = 'dominant', seed = 7) {
  const { data, width, height } = imageData;
  const pts = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 128) continue;
      const lab = rgbToOklab({ r: data[i], g: data[i + 1], b: data[i + 2] });
      pts.push({ L: lab.L, a: lab.a, b: lab.b, x: (x + 0.5) / width, y: (y + 0.5) / height });
    }
  }
  if (!pts.length) return [];
  const kk = mode === 'dominant' ? k : Math.min(pts.length, k * 3 + 4);
  const clusters = kmeans(pts, Math.min(kk, pts.length), rng(seed));
  const total = pts.length;
  clusters.forEach(c => {
    c.C = Math.hypot(c.a, c.b);
    c.weight = c.count / total;
  });

  const score = {
    dominant: c => c.weight,
    vivid: c => Math.pow(c.weight, 0.25) * (c.C + 0.01) * (1 - Math.abs(c.L - 0.68)),
    soft: c => Math.pow(c.weight, 0.3) * (c.L > 0.6 ? c.L : c.L * 0.3) * (0.2 - Math.min(c.C, 0.2) + 0.03),
    deep: c => Math.pow(c.weight, 0.3) * (1.05 - c.L),
    diverse: c => c.weight,
  }[mode];
  const ranked = clusters.filter(c => c.count > 0).sort((a, b) => score(b) - score(a));

  let picked;
  if (mode === 'diverse') {
    // 最远点：先取最大的，再每次挑离已选颜色最远（按面积加权）的
    picked = [ranked[0]];
    while (picked.length < k && picked.length < ranked.length) {
      let best = null, bd = -1;
      for (const c of ranked) {
        if (picked.includes(c)) continue;
        const d = Math.min(...picked.map(p => dist(p, c))) * Math.pow(c.weight, 0.15);
        if (d > bd) { bd = d; best = c; }
      }
      picked.push(best);
    }
  } else {
    picked = [];
    for (let th = 0.09; picked.length < k && th >= 0; th -= 0.03) {
      for (const c of ranked) {
        if (picked.length >= k) break;
        if (picked.includes(c)) continue;
        if (picked.every(p => dist(p, c) > th)) picked.push(c);
      }
    }
  }
  return picked.map(c => ({ hex: oklabToHex(c), x: c.px, y: c.py, weight: c.weight }));
}

function dist(p, q) { return Math.hypot(p.L - q.L, p.a - q.a, p.b - q.b); }

function kmeans(pts, k, r) {
  // k-means++ 初始化
  const cents = [pick(pts, r)];
  const d2 = new Float64Array(pts.length).fill(Infinity);
  while (cents.length < k) {
    let sum = 0;
    const last = cents[cents.length - 1];
    for (let i = 0; i < pts.length; i++) { const d = dist(pts[i], last) ** 2; if (d < d2[i]) d2[i] = d; sum += d2[i]; }
    if (sum === 0) break;
    let t = r() * sum, i = 0;
    for (; i < pts.length - 1; i++) { t -= d2[i]; if (t <= 0) break; }
    cents.push({ ...pts[i] });
  }
  const assign = new Int32Array(pts.length);
  for (let it = 0; it < 14; it++) {
    for (let i = 0; i < pts.length; i++) {
      let bi = 0, bd = Infinity;
      for (let j = 0; j < cents.length; j++) { const d = dist(pts[i], cents[j]); if (d < bd) { bd = d; bi = j; } }
      assign[i] = bi;
    }
    const acc = cents.map(() => ({ L: 0, a: 0, b: 0, n: 0 }));
    for (let i = 0; i < pts.length; i++) { const a = acc[assign[i]]; a.L += pts[i].L; a.a += pts[i].a; a.b += pts[i].b; a.n++; }
    acc.forEach((a, j) => { if (a.n) cents[j] = { L: a.L / a.n, a: a.a / a.n, b: a.b / a.n }; });
  }
  // 统计数量，并找出离中心最近的像素位置（用于在图上标记）
  const out = cents.map(c => ({ ...c, count: 0, bd: Infinity, px: 0.5, py: 0.5 }));
  for (let i = 0; i < pts.length; i++) {
    const c = out[assign[i]];
    c.count++;
    const d = dist(pts[i], c);
    if (d < c.bd) { c.bd = d; c.px = pts[i].x; c.py = pts[i].y; }
  }
  return out;
}
function pick(arr, r) { return { ...arr[Math.floor(r() * arr.length)] }; }

/** 把图片画到不超过 max 像素的画布上 */
export function drawScaled(img, max) {
  const w0 = img.naturalWidth || img.width, h0 = img.naturalHeight || img.height;
  const s = Math.min(1, max / Math.max(w0, h0));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w0 * s));
  c.height = Math.max(1, Math.round(h0 * s));
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}
