// 效果预览：网页、海报、拼布 / 布料、穿搭、3D 打印、渐变、对比度、色盲模拟
import { hexToOklch, contrast, textOn, mix, deltaE, simulateCVD, CVD_TYPES, wcag, rng } from './color.js';
import { FILAMENTS } from './data.js';

export const PREVIEW_TABS = [
  ['ui', '网页'], ['poster', '海报'], ['fabric', '拼布 / 布料'], ['outfit', '穿搭'],
  ['print3d', '3D 打印'], ['gradient', '渐变'], ['contrast', '对比度'], ['cvd', '色盲模拟'],
];

/** 自动分配角色：背景 / 文字 / 主色 / 强调色 */
export function roles(hexes, dark = false, shift = 0) {
  const info = hexes.map(h => ({ ...hexToOklch(h), h }));
  if (!info.length) return null;
  const byL = [...info].sort((a, b) => b.L - a.L);
  const bg = dark ? byL[byL.length - 1] : byL[0];
  let rest = info.filter(x => x !== bg);
  if (!rest.length) rest = [bg];
  const text = rest.reduce((best, x) => (contrast(x.h, bg.h) > contrast(best.h, bg.h) ? x : best), rest[0]);
  const textHex = contrast(text.h, bg.h) >= 4.5 ? text.h : textOn(bg.h);
  let acc = rest.filter(x => x !== text).sort((a, b) => b.C - a.C);
  if (!acc.length) acc = [text];
  const s = ((shift % acc.length) + acc.length) % acc.length;
  acc = [...acc.slice(s), ...acc.slice(0, s)];
  const primary = acc[0].h, accent = (acc[1] || acc[0]).h, third = (acc[2] || acc[1] || acc[0]).h;
  return {
    bg: bg.h, surface: mix(bg.h, dark ? '#FFFFFF' : primary, dark ? 0.06 : 0.07), text: textHex,
    muted: mix(textHex, bg.h, 0.4), line: mix(textHex, bg.h, 0.82),
    primary, onPrimary: textOn(primary), accent, onAccent: textOn(accent), third, onThird: textOn(third),
  };
}

const vars = r => `--bg:${r.bg};--sf:${r.surface};--tx:${r.text};--mu:${r.muted};--ln:${r.line};--pr:${r.primary};--onpr:${r.onPrimary};--ac:${r.accent};--onac:${r.onAccent};--t3:${r.third};--ont3:${r.onThird}`;

export function render(tab, hexes, o = {}) {
  const r = roles(hexes, o.dark, o.shift);
  switch (tab) {
    case 'ui': return ui(r);
    case 'poster': return poster(r, hexes);
    case 'fabric': return fabric(hexes, o.seed);
    case 'outfit': return outfit(r, hexes, o.shift);
    case 'print3d': return print3d(hexes, r);
    case 'gradient': return gradient(hexes);
    case 'contrast': return contrastTable(hexes);
    case 'cvd': return cvd(hexes);
  }
  return '';
}

function ui(r) {
  return `<div class="pv-ui" style="${vars(r)}">
    <div class="pv-nav"><b><i></i>色彩工作室</b><span>首页</span><span>作品</span><span>关于</span><button class="pv-btn pr sm">免费试用</button></div>
    <div class="pv-hero">
      <div>
        <span class="pv-tag">新品上市</span>
        <h2>用颜色讲好<br>你的故事</h2>
        <p>这是一段示例正文，用来检查正文文字在背景上是否清楚易读。</p>
        <div class="pv-row"><button class="pv-btn pr">开始使用</button><button class="pv-btn gh">了解更多</button></div>
      </div>
      <div class="pv-art"><span class="a1"></span><span class="a2"></span><span class="a3"></span></div>
    </div>
    <div class="pv-cards">
      ${[['pr', '灵感', '收集喜欢的颜色'], ['ac', '搭配', '一键生成方案'], ['t3', '导出', '色卡与代码']].map(([k, t, d], i) => `
        <div class="pv-card"><i class="dot ${k}"></i><b>${t}</b><p>${d}</p><div class="pv-bar"><span style="width:${[72, 48, 86][i]}%;background:var(--${k})"></span></div></div>`).join('')}
    </div>
  </div>`;
}

function poster(r, hexes) {
  const c = i => hexes[i % hexes.length];
  return `<div class="pv-center"><svg class="pv-poster" viewBox="0 0 300 400" role="img" aria-label="海报预览">
    <rect width="300" height="400" fill="${r.bg}"/>
    <circle cx="210" cy="120" r="92" fill="${r.primary}"/>
    <circle cx="120" cy="180" r="60" fill="${r.accent}" opacity=".92"/>
    <path d="M0 300 Q 80 240 150 290 T 300 270 V400 H0Z" fill="${r.third}"/>
    <rect x="34" y="40" width="44" height="8" rx="4" fill="${r.text}"/>
    ${hexes.map((h, i) => `<rect x="${34 + i * 18}" y="58" width="14" height="14" rx="3" fill="${h}" stroke="${r.text}" stroke-opacity=".15"/>`).join('')}
    <text x="32" y="330" font-size="34" font-weight="800" fill="${textOn(r.third)}" font-family="system-ui,sans-serif">SUMMER</text>
    <text x="34" y="358" font-size="15" fill="${textOn(r.third)}" opacity=".85" font-family="system-ui,sans-serif">夏日限定 · 2026</text>
    <circle cx="258" cy="350" r="16" fill="${c(4)}" stroke="${r.bg}" stroke-width="3"/>
  </svg></div>`;
}

function fabric(hexes, seed = 1) {
  const r = rng(seed * 9973 + hexes.length);
  const pick = () => hexes[Math.floor(r() * hexes.length)];
  const N = 6, S = 40;
  let quilt = '';
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const a = pick(), b = pick(), X = x * S, Y = y * S, t = r();
    if (t < 0.45) quilt += `<rect x="${X}" y="${Y}" width="${S}" height="${S}" fill="${a}"/><path d="${r() < 0.5 ? `M${X} ${Y}h${S}L${X} ${Y + S}z` : `M${X + S} ${Y}v${S}h-${S}z`}" fill="${b}"/>`;
    else if (t < 0.7) quilt += `<rect x="${X}" y="${Y}" width="${S}" height="${S}" fill="${a}"/><rect x="${X + 10}" y="${Y + 10}" width="${S - 20}" height="${S - 20}" fill="${b}"/>`;
    else quilt += `<rect x="${X}" y="${Y}" width="${S}" height="${S}" fill="${a}"/>`;
  }
  const [c0, c1, c2] = [hexes[0], hexes[1 % hexes.length], hexes[2 % hexes.length]];
  const light = [...hexes].sort((a, b) => hexToOklch(b).L - hexToOklch(a).L)[0];
  const stripes = hexes.map((h, i) => `<rect x="${i * 14}" y="0" width="14" height="120" fill="${h}"/>`).join('');
  return `<div class="pv-fabric">
    <figure><svg viewBox="0 0 ${N * S} ${N * S}" class="pv-quilt" aria-label="拼布">${quilt}<g stroke="#000" stroke-opacity=".08">${Array.from({ length: N + 1 }, (_, i) => `<path d="M${i * S} 0V${N * S}M0 ${i * S}H${N * S}"/>`).join('')}</g></svg><figcaption>拼布（点「换一种」重新排）</figcaption></figure>
    <div class="pv-swatches">
      <figure><svg viewBox="0 0 120 120"><defs><pattern id="st" width="${hexes.length * 14}" height="120" patternUnits="userSpaceOnUse">${stripes}</pattern></defs><rect width="120" height="120" fill="url(#st)"/></svg><figcaption>条纹</figcaption></figure>
      <figure><svg viewBox="0 0 120 120"><defs><pattern id="gh" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill="${light}"/><rect width="12" height="24" fill="${c0}" opacity=".55"/><rect width="24" height="12" fill="${c0}" opacity=".55"/></pattern></defs><rect width="120" height="120" fill="url(#gh)"/></svg><figcaption>格纹</figcaption></figure>
      <figure><svg viewBox="0 0 120 120"><defs><pattern id="pd" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill="${c1}"/><circle cx="6" cy="6" r="4" fill="${light}"/><circle cx="18" cy="18" r="4" fill="${c2}"/></pattern></defs><rect width="120" height="120" fill="url(#pd)"/></svg><figcaption>波点</figcaption></figure>
      <figure><svg viewBox="0 0 120 120"><rect width="120" height="120" fill="${light}"/>${hexes.map((h, i) => `<path d="M${-20 + i * 10} 120 Q ${30 + i * 10} ${40 - i * 6} ${140} ${20 + i * 14}" stroke="${h}" stroke-width="7" fill="none"/>`).join('')}</svg><figcaption>线条印花</figcaption></figure>
    </div>
  </div>`;
}

function outfit(r, hexes, shift = 0) {
  const n = hexes.length;
  const at = i => hexes[(((i + shift) % n) + n) % n];
  const sorted = [...hexes].sort((a, b) => hexToOklch(b).L - hexToOklch(a).L);
  const top = at(0), bottom = at(1), shoes = sorted[sorted.length - 1], bag = at(2), hat = at(3), bg = sorted[0];
  return `<div class="pv-center"><svg class="pv-outfit" viewBox="0 0 300 380" aria-label="穿搭预览">
    <rect width="300" height="380" rx="14" fill="${mix(bg, '#FFFFFF', 0.4)}"/>
    <ellipse cx="150" cy="360" rx="80" ry="8" fill="#000" opacity=".08"/>
    <path d="M118 46 q32 -26 64 0 l8 10 h-80z" fill="${hat}"/><rect x="100" y="54" width="100" height="7" rx="3.5" fill="${hat}"/>
    <circle cx="150" cy="80" r="22" fill="#E9C9AE"/>
    <rect x="142" y="98" width="16" height="12" fill="#E9C9AE"/>
    <path d="M108 112 Q150 100 192 112 L222 170 L202 182 L190 158 L190 220 L110 220 L110 158 L98 182 L78 170Z" fill="${top}"/>
    <path d="M110 218 H190 L214 318 H164 L150 246 L136 318 H86Z" fill="${bottom}"/>
    <path d="M86 318 h46 v12 q0 8 -8 8 h-42 q-6 0 -4 -8z" fill="${shoes}"/><path d="M168 318 h46 l2 12 q2 8 -6 8 h-42 z" fill="${shoes}"/>
    <path d="M214 170 q14 -24 28 0" stroke="${bag}" stroke-width="4" fill="none"/>
    <rect x="206" y="172" width="44" height="40" rx="7" fill="${bag}"/>
  </svg></div>`;
}

function nearestFilament(hex) {
  let best = FILAMENTS[0], bd = Infinity;
  for (const f of FILAMENTS) { const d = deltaE(hex, f[2]); if (d < bd) { bd = d; best = f; } }
  return { f: best, d: bd };
}
function print3d(hexes, r) {
  const rows = hexes.map(h => {
    const { f, d } = nearestFilament(h);
    const lvl = d < 5 ? ['很接近', 'ok'] : d < 12 ? ['相近', 'mid'] : ['差别较大', 'far'];
    return `<div class="pv-fil">
      <span class="spool" style="--c:${h}"></span><span class="mono">${h}</span>
      <span class="arrow">→</span>
      <span class="spool" style="--c:${f[2]}"></span><span><b>${f[1]}</b> <small>${f[0]}</small></span>
      <span class="badge ${lvl[1]}">${lvl[0]} ΔE ${d.toFixed(1)}</span>
    </div>`;
  }).join('');
  const s = [...hexes].sort((a, b) => hexToOklch(b).L - hexToOklch(a).L);
  const L = i => s[Math.min(i, s.length - 1)];
  return `<div class="pv-print">
    <svg viewBox="0 0 200 200" class="pv-tag3d" aria-label="多色钥匙扣">
      <circle cx="100" cy="106" r="80" fill="${mix(L(s.length - 1), '#000', 0.25)}"/>
      <circle cx="100" cy="100" r="80" fill="${L(s.length - 1)}"/>
      <circle cx="100" cy="100" r="66" fill="${L(0)}"/>
      <circle cx="100" cy="30" r="9" fill="${mix(L(0), '#000', 0.2)}"/>
      ${[0, 1, 2, 3, 4].map(i => { const a = (i * 72 - 90) * Math.PI / 180; return `<ellipse cx="${100 + Math.cos(a) * 26}" cy="${104 + Math.sin(a) * 26}" rx="18" ry="24" transform="rotate(${i * 72} ${100 + Math.cos(a) * 26} ${104 + Math.sin(a) * 26})" fill="${L(1)}"/>`; }).join('')}
      <circle cx="100" cy="104" r="14" fill="${L(2)}"/>
      <text x="100" y="166" text-anchor="middle" font-size="16" font-weight="800" fill="${L(Math.max(3, s.length - 2))}" font-family="system-ui">AMS</text>
    </svg>
    <div class="pv-fils"><p class="hint">每个颜色最接近的拓竹 PLA Basic 耗材（屏幕近似色，以实物色卡为准）</p>${rows}</div>
  </div>`;
}

function gradient(hexes) {
  const list = hexes.join(', ');
  const lin = `linear-gradient(90deg in oklab, ${list})`;
  const css = `background: linear-gradient(90deg, ${list});\n/* 更平滑（新浏览器）*/\nbackground: ${lin};`;
  return `<div class="pv-grad">
    <div class="g" style="background:linear-gradient(90deg, ${list});background:${lin}"></div>
    <div class="g2">
      <div style="background:radial-gradient(circle at 30% 30% in oklab, ${list})"></div>
      <div style="background:conic-gradient(from 0deg in oklab, ${list}, ${hexes[0]})"></div>
      <div style="background:linear-gradient(135deg in oklab, ${list})"></div>
    </div>
    <pre class="code">${css}</pre>
    <button class="btn sm" data-copy="${encodeURIComponent(css)}">复制 CSS</button>
  </div>`;
}

function contrastTable(hexes) {
  const head = hexes.map(h => `<th><span class="cell" style="background:${h}"></span></th>`).join('');
  const body = hexes.map(fg => `<tr><th><span class="cell" style="background:${fg}"></span></th>${hexes.map(bg => {
    if (fg === bg) return '<td class="na">—</td>';
    const c = contrast(fg, bg), g = wcag(c);
    return `<td style="background:${bg};color:${fg}" title="${fg} 文字放在 ${bg} 上"><b>${c.toFixed(1)}</b><small class="${g === '不合格' ? 'bad' : ''}">${g}</small></td>`;
  }).join('')}</tr>`).join('');
  return `<div class="pv-contrast">
    <p class="hint">行 = 文字颜色，列 = 背景颜色。正文至少 4.5（AA），大字 / 图标至少 3。</p>
    <div class="scroll-x"><table><thead><tr><th></th>${head}</tr></thead><tbody>${body}</tbody></table></div>
  </div>`;
}

function cvd(hexes) {
  const strip = list => `<div class="mini-strip">${list.map(h => `<span style="background:${h}"></span>`).join('')}</div>`;
  const warn = list => {
    let min = Infinity;
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) min = Math.min(min, deltaE(list[i], list[j]));
    return min < 6 ? `<span class="badge far">有颜色难以区分</span>` : min < 11 ? `<span class="badge mid">个别颜色较接近</span>` : `<span class="badge ok">都能区分</span>`;
  };
  return `<div class="pv-cvd">
    <div class="row"><b>正常视觉</b>${strip(hexes)}</div>
    ${CVD_TYPES.map(([id, name, note]) => { const l = hexes.map(h => simulateCVD(h, id)); return `<div class="row"><b>${name}<small>${note}</small></b>${strip(l)}${warn(l)}</div>`; }).join('')}
  </div>`;
}
