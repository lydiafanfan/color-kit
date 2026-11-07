// 自动配色：色彩理论配色、风格配色、随机生成、整体调色、颜色命名
import {
  clamp, mod, hexToHsl, hslToHex, hexToOklch, oklchToHex, hexToOklab, mix, deltaE,
  toWheel, fromWheel, rng, family,
} from './color.js';
import { CN, JP } from './data.js';

// ---------- 颜色命名 ----------
let NAMED = null;
function named() {
  if (!NAMED) {
    NAMED = [
      ...CN.map(([n, h]) => ({ n, h, src: '中国传统色', lab: hexToOklab(h) })),
      ...JP.map(([n, r, h]) => ({ n, r, h, src: '日本传统色', lab: hexToOklab(h) })),
    ];
  }
  return NAMED;
}
/** 最接近的传统色名 */
export function nearestName(hex) {
  const lab = hexToOklab(hex);
  let best = null, bd = Infinity;
  for (const c of named()) {
    const d = deltaE(lab, c.lab);
    if (d < bd) { bd = d; best = c; }
  }
  return { name: best.n, hex: best.h, src: best.src, d: bd };
}
export function autoName(hex) {
  const n = nearestName(hex);
  return n.d < 6 ? n.name : `近${n.name}`;
}

// ---------- 色彩理论配色（色相在 RYB 或 RGB 色轮上旋转） ----------
const Lc = l => clamp(l, 8, 96);
function rot(base, deg, mode, { s = null, l = null, ds = 0, dl = 0 } = {}) {
  const hsl = hexToHsl(base);
  const h = fromWheel(toWheel(hsl.h, mode) + deg, mode);
  return hslToHex({ h, s: clamp((s ?? hsl.s) + ds, 0, 100), l: Lc((l ?? hsl.l) + dl) });
}
function tint(hex, t) { return t > 0 ? mix(hex, '#FFFFFF', t) : mix(hex, '#000000', -t); }

export const SCHEMES = [
  { id: 'mono', name: '单色', desc: '同一色相的深浅变化，稳重统一', usesSpread: false,
    gen(b) {
      const { L, C, h } = hexToOklch(b);
      const targets = [0.95, 0.82, 0.66, 0.5, 0.33];
      let near = 0;
      targets.forEach((t, i) => { if (Math.abs(t - L) < Math.abs(targets[near] - L)) near = i; });
      const others = targets.filter((t, i) => i !== near).sort((p, q) => Math.abs(q - L) - Math.abs(p - L));
      return [b, ...others.map(t => oklchToHex({ L: t, C: C * (1 - Math.abs(t - L) * 0.7), h }))];
    } },
  { id: 'analog', name: '类似色', desc: '色轮上相邻的颜色，和谐自然', usesSpread: true,
    gen: (b, m, a) => [b, rot(b, a, m, { dl: -8 }), rot(b, -a, m, { dl: 8 }), rot(b, a / 2, m, { dl: -4 }), rot(b, -a / 2, m, { dl: 4 })] },
  { id: 'comp', name: '互补色', desc: '色轮正对面的颜色，对比强烈、醒目', usesSpread: false,
    gen: (b, m) => [b, rot(b, 180, m), tint(b, 0.55), tint(rot(b, 180, m), 0.5), tint(b, -0.35)] },
  { id: 'split', name: '分裂互补', desc: '补色两侧的颜色，有对比又不刺眼', usesSpread: true,
    gen: (b, m, a) => [b, rot(b, 180 - a, m), rot(b, 180 + a, m), tint(b, 0.6), tint(rot(b, 180 + a, m), -0.35)] },
  { id: 'triad', name: '三角色', desc: '色轮上等距的三色，活泼平衡', usesSpread: false,
    gen: (b, m) => [b, rot(b, 120, m), rot(b, 240, m), tint(b, 0.55), tint(rot(b, 240, m), -0.3)] },
  { id: 'tetrad', name: '矩形四色', desc: '两组互补色，丰富多彩，建议一色为主', usesSpread: true,
    gen: (b, m, a) => [b, rot(b, a * 2, m), rot(b, 180, m), rot(b, 180 + a * 2, m), tint(b, 0.7)] },
  { id: 'square', name: '正方形四色', desc: '色轮上等距的四色，热闹饱满', usesSpread: false,
    gen: (b, m) => [b, rot(b, 90, m), rot(b, 180, m), rot(b, 270, m), tint(b, -0.55)] },
  { id: 'compound', name: '复合色', desc: '类似色 + 互补色，层次丰富', usesSpread: true,
    gen: (b, m, a) => [b, rot(b, 180, m), rot(b, a, m, { dl: -10 }), rot(b, 180 + a, m, { dl: 10 }), tint(b, 0.6)] },
  { id: 'shades', name: '明暗阶梯', desc: '同一颜色从浅到深', usesSpread: false,
    gen: b => [b, tint(b, 0.6), tint(b, -0.45), tint(b, 0.3), tint(b, -0.2)] },
];

// ---------- 风格配色（在 OKLCH 里按规则生成，可"换一组"） ----------
const J = (r, a) => (r() * 2 - 1) * a; // 抖动
const lch = (L, C, h) => oklchToHex({ L, C, h });
/** 让鲜艳色的明度跟着色相走：黄色亮、蓝色暗 */
const vividL = (h, base = 0.72, amp = 0.13) => base + amp * Math.cos(((h - 100) * Math.PI) / 180);

export const MOODS = [
  { id: 'morandi', name: '莫兰迪', desc: '低饱和、带灰调，温柔高级',
    gen(b, r) { const { h } = hexToOklch(b); return [0, 28, -32, 150, 65].map((d, i) => lch(0.6 + r() * 0.25, 0.025 + r() * 0.035, h + d + J(r, 12))).sort(byL); } },
  { id: 'macaron', name: '马卡龙', desc: '浅淡的粉彩色，甜美轻盈',
    gen(b, r) { const { h } = hexToOklch(b); return [0, 1, 2, 3, 4].map(i => lch(0.86 + r() * 0.06, 0.06 + r() * 0.04, h + i * 72 + J(r, 14))); } },
  { id: 'dopamine', name: '多巴胺', desc: '高饱和撞色，明亮快乐',
    gen(b, r) { const { h } = hexToOklch(b); return [0, 1, 2, 3, 4].map(i => { const hh = h + i * 72 + J(r, 16); return lch(vividL(hh), 0.22, hh); }); } },
  { id: 'y2k', name: 'Y2K 千禧', desc: '荧光粉、电光蓝、镭射银',
    gen(b, r) {
      const { h } = hexToOklch(b);
      return [lch(0.68, 0.26, 350 + J(r, 14)), lch(0.62, 0.23, 262 + J(r, 14)), lch(0.9, 0.2, 128 + J(r, 14)),
        lch(0.84, 0.09, 305 + J(r, 18)), lch(0.88, 0.012, h)];
    } },
  { id: 'maillard', name: '美拉德', desc: '焦糖、咖啡、奶茶色的暖棕调',
    gen(b, r) { return [0.3, 0.45, 0.6, 0.75, 0.9].map((L, i) => lch(L + J(r, 0.03), [0.05, 0.08, 0.1, 0.08, 0.035][i] + J(r, 0.012), 55 + J(r, 14))); } },
  { id: 'earth', name: '大地色', desc: '陶土、沙、橄榄，自然质朴',
    gen(b, r) { return [[0.5, 0.11, 40], [0.72, 0.08, 75], [0.55, 0.07, 120], [0.88, 0.035, 85], [0.32, 0.04, 60]].map(([L, C, h]) => lch(L + J(r, 0.04), C + J(r, 0.015), h + J(r, 12))); } },
  { id: 'vintage', name: '复古', desc: '略褪色的暖调，旧照片质感',
    gen(b, r) { const { h } = hexToOklch(b); return [0, 40, 160, 200, 80].map(d => mix(lch(0.55 + r() * 0.3, 0.08 + r() * 0.04, h + d + J(r, 12)), '#C8A97E', 0.2)).sort(byL); } },
  { id: 'cyber', name: '赛博霓虹', desc: '深色底配霓虹亮色',
    gen(b, r) { const { h } = hexToOklch(b); return [lch(0.17, 0.05, h + 20), lch(0.3, 0.12, 295 + J(r, 15)), lch(0.64, 0.27, 340 + J(r, 12)), lch(0.86, 0.15, 195 + J(r, 12)), lch(0.93, 0.18, 108 + J(r, 10))]; } },
  { id: 'fresh', name: '清新', desc: '薄荷、海盐、天空，干净通透',
    gen(b, r) { const h0 = 150 + r() * 80; return [[0.97, 0.015], [0.9, 0.05], [0.8, 0.09], [0.66, 0.1], [0.45, 0.08]].map(([L, C], i) => lch(L, C + J(r, 0.015), h0 + i * 12 + J(r, 8))); } },
  { id: 'minimal', name: '极简', desc: '黑白灰 + 一个点缀色',
    gen(b, r) { const { h } = hexToOklch(b); return [lch(0.97, 0.004, h), lch(0.87, 0.006, h), lch(0.58, 0.008, h), lch(0.22, 0.008, h), lch(0.6 + J(r, 0.05), 0.18, h)]; } },
  { id: 'dark', name: '暗夜高级', desc: '深沉低明度，点缀一抹亮色',
    gen(b, r) { const { h } = hexToOklch(b); return [lch(0.16, 0.015, h), lch(0.25, 0.03, h + J(r, 10)), lch(0.38, 0.05, h + J(r, 15)), lch(0.7, 0.14, h + 160 + J(r, 30)), lch(0.8, 0.11, 85 + J(r, 8))]; } },
  { id: 'chinese', name: '新中式', desc: '从中国传统色里挑选的雅致搭配',
    gen(b, r) {
      const pool = CN.map(([n, hex]) => ({ hex, ...hexToOklch(hex) }));
      const near = pool.reduce((a, c) => (deltaE(c.hex, b) < deltaE(a.hex, b) ? c : a));
      const pick = arr => arr[Math.floor(r() * arr.length)];
      const light = pick(pool.filter(c => c.L > 0.9 && c.C < 0.05));
      const ink = pick(pool.filter(c => c.L < 0.45 && c.C < 0.08));
      const mids = pool.filter(c => c.L > 0.5 && c.L < 0.85 && c.C > 0.04 && c.C < 0.16 && c.hex !== near.hex);
      const far = mids.filter(c => Math.abs(mod(c.h - near.h + 180, 360) - 180) > 40);
      const m1 = pick(far.length ? far : mids);
      const m2 = pick(mids.filter(c => c !== m1));
      return [light.hex, near.hex, m1.hex, m2.hex, ink.hex];
    } },
  { id: 'gradient', name: '渐变', desc: '从基础色平滑过渡到邻近色相',
    gen(b, r) { const { h, C } = hexToOklch(b); const d = (r() > 0.5 ? 1 : -1) * (50 + r() * 50); const c = Math.max(C, 0.1); return [0, 1, 2, 3, 4].map(i => lch(0.9 - i * 0.12, c * (0.6 + i * 0.12), h + (d * i) / 4)); } },
];
const byL = (a, b) => hexToOklch(b).L - hexToOklch(a).L;

// ---------- 色阶 ----------
/** 浅→深 n 级（类似 Tailwind 50~900） */
export function scale(hex, n = 9) {
  const { C, h } = hexToOklch(hex);
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    const L = 0.97 - t * 0.75;
    return oklchToHex({ L, C: C * (0.35 + 0.65 * Math.sin(Math.PI * clamp(0.15 + t * 0.85, 0, 1))), h });
  });
}
export function tints(hex, n = 9) { return Array.from({ length: n }, (_, i) => mix(hex, '#FFFFFF', (i / n) * 0.95)).reverse(); }
export function shades(hex, n = 9) { return Array.from({ length: n }, (_, i) => mix(hex, '#000000', (i / n) * 0.95)); }
export function tones(hex, n = 9) {
  const { L } = hexToOklch(hex);
  const gray = oklchToHex({ L, C: 0, h: 0 });
  return Array.from({ length: n }, (_, i) => mix(hex, gray, (i / (n - 1))));
}

// ---------- 数量适配 ----------
/** 把一组颜色扩展 / 缩减到 n 个 */
export function fitTo(hexes, n) {
  let out = [...hexes];
  if (out.length > n) {
    const step = (out.length - 1) / (n - 1 || 1);
    out = Array.from({ length: n }, (_, i) => hexes[Math.round(i * step)]);
  }
  while (out.length < n) {
    // 在色差最大的相邻两色之间插一个中间色
    let bi = 0, bd = -1;
    for (let i = 0; i < out.length - 1; i++) { const d = deltaE(out[i], out[i + 1]); if (d > bd) { bd = d; bi = i; } }
    if (out.length < 2) { out.push(mix(out[0], '#FFFFFF', 0.5)); continue; }
    out.splice(bi + 1, 0, mix(out[bi], out[bi + 1], 0.5));
  }
  return out;
}

// ---------- 随机生成（尊重锁定） ----------
export const GEN_MODES = [
  ['smart', '智能随机'],
  ...SCHEMES.map(s => [s.id, s.name]),
  ...MOODS.map(m => [m.id, m.name]),
];
export function randomBase(r) {
  const h = r() * 360;
  return oklchToHex({ L: 0.45 + r() * 0.4, C: 0.06 + r() * 0.14, h });
}
export const SMART = { id: 'smart', name: '智能随机', desc: '每次随机挑一种配色方式' };
const SMART_POOL = ['analog', 'comp', 'split', 'triad', 'mono', 'compound', 'morandi', 'macaron', 'dopamine', 'maillard', 'earth', 'vintage', 'fresh', 'minimal', 'chinese', 'gradient', 'tetrad'];
export const modeName = id => (id === 'smart' ? SMART.name : (SCHEMES.find(s => s.id === id) || MOODS.find(m => m.id === id) || {}).name || id);

/**
 * palette: [{hex, locked}]；anchor：作为基准的颜色序号（-1 表示不指定）
 * 基准色和锁定的颜色保持不动，其余位置按配色方式填入。
 * 返回 hex 数组，数组的 .mode 为实际使用的配色方式（智能随机时有用）
 */
export function generate(palette, modeId = 'smart', wheel = 'ryb', seed = Date.now(), anchor = -1) {
  const r = rng(seed);
  const n = palette.length;
  const fixed = palette.map((c, i) => c.locked || i === anchor);
  const keep = palette.filter((c, i) => fixed[i]).map(c => c.hex);
  let id = modeId === 'smart' ? SMART_POOL[Math.floor(r() * SMART_POOL.length)] : modeId;
  if (keep.length === n) return Object.assign(palette.map(c => c.hex), { mode: id });
  const base = anchor >= 0 && palette[anchor] ? palette[anchor].hex : keep[0] || randomBase(r);
  const scheme = SCHEMES.find(s => s.id === id);
  const mood = MOODS.find(m => m.id === id);
  const cols = scheme ? scheme.gen(base, wheel, 20 + r() * 20) : mood.gen(base, r);
  // 去掉与保留颜色最接近的那些（基准色自己），剩下的按重要程度依次填入
  const pool = [...cols];
  for (const k of keep) {
    if (!pool.length) break;
    let bi = 0;
    pool.forEach((c, i) => { if (deltaE(c, k) < deltaE(pool[bi], k)) bi = i; });
    pool.splice(bi, 1);
  }
  const fill = extend(pool, n - keep.length, [base, ...keep]);
  let k = 0;
  return Object.assign(palette.map((c, i) => (fixed[i] ? c.hex : fill[k++])), { mode: id });
}
/** 颜色不够时，用已有颜色的深浅变化补足，避免重复 */
function extend(pool, need, refs) {
  const out = pool.slice(0, need);
  const src = [...pool, ...refs];
  const steps = [0.55, -0.4, 0.8, -0.65, 0.3, -0.2];
  for (let i = 0; out.length < need && i < src.length * steps.length; i++) {
    const x = src[i % src.length], t = steps[Math.floor(i / src.length)];
    const c = t > 0 ? mix(x, '#FFFFFF', t) : mix(x, '#000000', -t);
    if ([...out, ...refs].every(o => deltaE(o, c) > 5)) out.push(c);
  }
  while (out.length < need) out.push(mix(refs[0], out.length % 2 ? '#000000' : '#FFFFFF', 0.25 + 0.08 * out.length));
  return out;
}

// ---------- 整体调色 ----------
/** o: {hue, sat, light, temp, contrast}（-100~100，hue 为 -180~180） */
export function adjust(hex, o) {
  let { L, C, h } = hexToOklch(hex);
  h += o.hue || 0;
  C *= 1 + (o.sat || 0) / 100;
  L += ((o.light || 0) / 100) * 0.35;
  L = 0.55 + (L - 0.55) * (1 + (o.contrast || 0) / 100);
  let out = oklchToHex({ L: clamp(L), C: Math.max(0, C), h });
  if (o.temp) out = mix(out, o.temp > 0 ? '#FF9A3C' : '#3C8CFF', Math.abs(o.temp) / 300);
  return out;
}

/** 按明度排序 */
export function sortByLight(hexes, desc = true) {
  return [...hexes].sort((a, b) => (desc ? 1 : -1) * (hexToOklch(b).L - hexToOklch(a).L));
}
export { family };
