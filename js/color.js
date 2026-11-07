// 颜色换算：HEX / RGB / HSL / HSV / OKLab / OKLCH / CMYK，对比度、色盲模拟、色系判断
export const clamp = (x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
export const mod = (a, n) => ((a % n) + n) % n;

export function normHex(s) {
  if (s == null) return null;
  s = String(s).trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(s)) s = s.split('').map(c => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(s)) return null;
  return '#' + s.toUpperCase();
}

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
export function rgbToHex({ r, g, b }) {
  return '#' + [r, g, b].map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function rgbToHsv({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  return { h: hueOf(r, g, b, max, d), s: max ? (d / max) * 100 : 0, v: max * 100 };
}
export function hsvToRgb({ h, s, v }) {
  s /= 100; v /= 100; h = mod(h, 360);
  const f = n => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return { r: f(5) * 255, g: f(3) * 255, b: f(1) * 255 };
}
export function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, l = (max + min) / 2;
  const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  return { h: hueOf(r, g, b, max, d), s: s * 100, l: l * 100 };
}
export function hslToRgb({ h, s, l }) {
  s /= 100; l /= 100; h = mod(h, 360);
  const a = s * Math.min(l, 1 - l);
  const f = n => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return { r: f(0) * 255, g: f(8) * 255, b: f(4) * 255 };
}
function hueOf(r, g, b, max, d) {
  if (!d) return 0;
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

const toLin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const fromLin = c => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const linToHex = ({ r, g, b }) => rgbToHex({ r: fromLin(clamp(r)), g: fromLin(clamp(g)), b: fromLin(clamp(b)) });

export function rgbToOklab({ r, g, b }) {
  r = toLin(r); g = toLin(g); b = toLin(b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    L: 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  };
}
function oklabToLin({ L, a, b }) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  };
}
export const hexToOklab = hex => rgbToOklab(hexToRgb(hex));
export const oklabToHex = lab => linToHex(oklabToLin(lab));

export function hexToOklch(hex) {
  const { L, a, b } = hexToOklab(hex);
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { L, C: Math.hypot(a, b), h };
}
const lchLin = (L, C, h) => { const r = (h * Math.PI) / 180; return oklabToLin({ L, a: C * Math.cos(r), b: C * Math.sin(r) }); };
const inGamut = (c, e = 1e-4) => c.r >= -e && c.r <= 1 + e && c.g >= -e && c.g <= 1 + e && c.b >= -e && c.b <= 1 + e;
/** OKLCH → HEX，超出 sRGB 时保持明度和色相、降低彩度 */
export function oklchToHex({ L, C, h }) {
  L = clamp(L); C = Math.max(0, C); h = mod(h, 360);
  let lin = lchLin(L, C, h);
  if (!inGamut(lin)) {
    let lo = 0, hi = C;
    for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (inGamut(lchLin(L, mid, h))) lo = mid; else hi = mid; }
    lin = lchLin(L, lo, h);
  }
  return linToHex(lin);
}

export function rgbToCmyk({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const k = 1 - Math.max(r, g, b);
  if (k >= 0.9999) return { c: 0, m: 0, y: 0, k: 100 };
  return { c: ((1 - r - k) / (1 - k)) * 100, m: ((1 - g - k) / (1 - k)) * 100, y: ((1 - b - k) / (1 - k)) * 100, k: k * 100 };
}
export function cmykToRgb({ c, m, y, k }) {
  c /= 100; m /= 100; y /= 100; k /= 100;
  return { r: 255 * (1 - c) * (1 - k), g: 255 * (1 - m) * (1 - k), b: 255 * (1 - y) * (1 - k) };
}

export const hexToHsv = h => rgbToHsv(hexToRgb(h));
export const hexToHsl = h => rgbToHsl(hexToRgb(h));
export const hsvToHex = o => rgbToHex(hsvToRgb(o));
export const hslToHex = o => rgbToHex(hslToRgb(o));

/** 解析各种写法：#abc、#aabbcc、rgb()、hsl()、oklch()、"r,g,b" */
export function parseColor(input) {
  if (!input) return null;
  const s = String(input).trim();
  const h = normHex(s);
  if (h) return h;
  let m = s.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (m) return rgbToHex({ r: +m[1], g: +m[2], b: +m[3] });
  m = s.match(/^hsla?\(\s*([\d.]+)(?:deg)?[,\s]+([\d.]+)%?[,\s]+([\d.]+)%?/i);
  if (m) return hslToHex({ h: +m[1], s: +m[2], l: +m[3] });
  m = s.match(/^oklch\(\s*([\d.]+)(%?)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (m) { let L = +m[1]; if (m[2] || L > 1) L /= 100; return oklchToHex({ L, C: +m[3], h: +m[4] }); }
  m = s.match(/^(\d{1,3})[,\s]+(\d{1,3})[,\s]+(\d{1,3})$/);
  if (m) return rgbToHex({ r: +m[1], g: +m[2], b: +m[3] });
  return null;
}

/** 在 OKLab 里混合，过渡更自然 */
export function mix(h1, h2, t) {
  const a = hexToOklab(h1), b = hexToOklab(h2);
  return oklabToHex({ L: a.L + (b.L - a.L) * t, a: a.a + (b.a - a.a) * t, b: a.b + (b.b - a.b) * t });
}

/** 感知色差（OKLab 欧氏距离 ×100，约 2 以下肉眼难分） */
export function deltaE(h1, h2) {
  const a = typeof h1 === 'string' ? hexToOklab(h1) : h1;
  const b = typeof h2 === 'string' ? hexToOklab(h2) : h2;
  return Math.hypot(a.L - b.L, a.a - b.a, a.b - b.b) * 100;
}

export function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}
export function contrast(h1, h2) {
  const a = luminance(h1), b = luminance(h2);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
/** 放在这个颜色上的文字用黑还是白 */
export function textOn(hex) {
  return contrast(hex, '#FFFFFF') >= contrast(hex, '#161616') * 0.82 ? '#FFFFFF' : '#161616';
}
export function wcag(ratio) {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA 大字';
  return '不合格';
}

// 色盲模拟（Machado 2009，严重度 100%）
const CVD = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
};
export const CVD_TYPES = [
  ['protan', '红色盲', '约 1% 男性'],
  ['deutan', '绿色盲', '约 1% 男性，最常见的一类'],
  ['tritan', '蓝色盲', '很少见'],
  ['achroma', '全色盲 / 黑白打印', '只看明暗'],
];
export function simulateCVD(hex, type) {
  const { r, g, b } = hexToRgb(hex);
  const v = [toLin(r), toLin(g), toLin(b)];
  if (type === 'achroma') { const y = 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; return linToHex({ r: y, g: y, b: y }); }
  const M = CVD[type];
  const row = i => M[i][0] * v[0] + M[i][1] * v[1] + M[i][2] * v[2];
  return linToHex({ r: row(0), g: row(1), b: row(2) });
}

// 美术用 RYB 色轮 ↔ 光学 RGB 色相（[RYB 角度, RGB 角度]）
const RYB = [[0, 0], [60, 35], [120, 60], [180, 120], [240, 225], [300, 280], [360, 360]];
function pw(h, from, to) {
  h = mod(h, 360);
  for (let i = 0; i < RYB.length - 1; i++) {
    const a = RYB[i][from], b = RYB[i + 1][from];
    if (h >= a && h <= b) return RYB[i][to] + ((h - a) / (b - a)) * (RYB[i + 1][to] - RYB[i][to]);
  }
  return h;
}
export const rybToRgbHue = h => pw(h, 0, 1);
export const rgbToRybHue = h => pw(h, 1, 0);
export const toWheel = (h, mode) => (mode === 'ryb' ? rgbToRybHue(h) : mod(h, 360));
export const fromWheel = (h, mode) => (mode === 'ryb' ? rybToRgbHue(h) : mod(h, 360));

/** 色系：用于色库筛选 */
export const FAMILIES = ['红', '粉', '橙', '棕', '黄', '绿', '青', '蓝', '紫', '白', '灰', '黑'];
export function family(hex) {
  const { L, C, h } = hexToOklch(hex);
  if (C < 0.035) return L > 0.9 ? '白' : L < 0.3 ? '黑' : '灰';
  if (L > 0.94 && C < 0.06) return '白';
  if (L < 0.22) return '黑';
  if (h >= 350 || h < 40) return L > 0.78 ? '粉' : L < 0.5 && C < 0.12 ? '棕' : '红';
  if (h < 75) return L < 0.62 ? '棕' : L > 0.85 && h < 55 ? '粉' : '橙';
  if (h < 115) return L < 0.6 ? '棕' : '黄';
  if (h < 170) return '绿';
  if (h < 225) return '青';
  if (h < 285) return '蓝';
  if (h < 330) return L > 0.8 ? '粉' : '紫';
  return L > 0.7 ? '粉' : '红';
}

const r0 = n => Math.round(n);
export function formats(hex) {
  const rgb = hexToRgb(hex), hsl = rgbToHsl(rgb), hsv = rgbToHsv(rgb), cmyk = rgbToCmyk(rgb), lch = hexToOklch(hex);
  return {
    HEX: hex,
    RGB: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
    HSL: `hsl(${r0(hsl.h)}, ${r0(hsl.s)}%, ${r0(hsl.l)}%)`,
    HSB: `hsb(${r0(hsv.h)}, ${r0(hsv.s)}%, ${r0(hsv.v)}%)`,
    CMYK: `cmyk(${r0(cmyk.c)}, ${r0(cmyk.m)}, ${r0(cmyk.y)}, ${r0(cmyk.k)})`,
    OKLCH: `oklch(${(lch.L * 100).toFixed(1)}% ${lch.C.toFixed(3)} ${lch.C < 0.002 ? 0 : r0(lch.h)})`,
  };
}

/** 可复现的随机数 */
export function rng(seed = Date.now()) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e9) / 1e9; };
}
