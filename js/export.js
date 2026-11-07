// 导出：PNG 色卡、CSS / SCSS / Tailwind / JSON / 文本 / SVG / Adobe ASE
import { hexToRgb, rgbToCmyk, formats, textOn } from './color.js';

const slug = (s, i) => (s && /^[\w-]+$/.test(s) ? s.toLowerCase() : `color-${i + 1}`);
const r0 = Math.round;

/** colors: [{hex, name}] */
export const TEXT_FORMATS = [
  ['css', 'CSS 变量', 'css'],
  ['scss', 'SCSS', 'scss'],
  ['tailwind', 'Tailwind', 'js'],
  ['json', 'JSON', 'json'],
  ['txt', '文本列表', 'txt'],
  ['svg', 'SVG 色卡', 'svg'],
];

export function toText(kind, colors, title = '我的配色') {
  switch (kind) {
    case 'css':
      return `/* ${title} */\n:root {\n${colors.map((c, i) => `  --${slug('', i)}: ${c.hex};${c.name ? ` /* ${c.name} */` : ''}`).join('\n')}\n}\n`;
    case 'scss':
      return `// ${title}\n${colors.map((c, i) => `$${slug('', i)}: ${c.hex};${c.name ? ` // ${c.name}` : ''}`).join('\n')}\n`;
    case 'tailwind':
      return `// tailwind.config.js — ${title}\nmodule.exports = {\n  theme: {\n    extend: {\n      colors: {\n        palette: {\n${colors.map((c, i) => `          ${i + 1}: '${c.hex}',${c.name ? ` // ${c.name}` : ''}`).join('\n')}\n        },\n      },\n    },\n  },\n};\n`;
    case 'json':
      return JSON.stringify({
        name: title,
        colors: colors.map(c => {
          const f = formats(c.hex);
          return { name: c.name || '', hex: c.hex, rgb: f.RGB, hsl: f.HSL, cmyk: f.CMYK, oklch: f.OKLCH };
        }),
      }, null, 2);
    case 'txt':
      return `${title}\n\n${colors.map(c => { const f = formats(c.hex); return `${c.hex}\t${c.name || ''}\t${f.RGB}\t${f.CMYK}`; }).join('\n')}\n`;
    case 'svg': {
      const w = 160, h = 220;
      const items = colors.map((c, i) => `  <g transform="translate(${i * (w + 16)},0)">\n    <rect width="${w}" height="${h}" rx="10" fill="#fff" stroke="#ddd"/>\n    <rect width="${w}" height="150" rx="10" fill="${c.hex}"/>\n    <rect y="140" width="${w}" height="10" fill="${c.hex}"/>\n    <text x="12" y="178" font-family="sans-serif" font-size="15" font-weight="700" fill="#222">${esc(c.name || '')}</text>\n    <text x="12" y="202" font-family="monospace" font-size="14" fill="#555">${c.hex}</text>\n  </g>`).join('\n');
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${colors.length * (w + 16) - 16}" height="${h}" viewBox="0 0 ${colors.length * (w + 16) - 16} ${h}">\n${items}\n</svg>\n`;
    }
  }
  return '';
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Adobe Swatch Exchange（Photoshop / Illustrator / Procreate 可导入） */
export function toASE(colors, title = 'Palette') {
  const enc = s => { const a = []; for (const ch of s) { const c = ch.charCodeAt(0); a.push(c >> 8, c & 255); } a.push(0, 0); return a; };
  const bytes = [];
  const u16 = v => bytes.push((v >> 8) & 255, v & 255);
  const u32 = v => bytes.push((v >>> 24) & 255, (v >> 16) & 255, (v >> 8) & 255, v & 255);
  const f32 = v => { const b = new DataView(new ArrayBuffer(4)); b.setFloat32(0, v); for (let i = 0; i < 4; i++) bytes.push(b.getUint8(i)); };
  bytes.push(65, 83, 69, 70); u16(1); u16(0);
  u32(colors.length + 2);
  const tName = enc(title.slice(0, 60));
  u16(0xc001); u32(2 + tName.length); u16(tName.length / 2); bytes.push(...tName);
  colors.forEach((c, i) => {
    const nm = enc((c.name || c.hex).slice(0, 60) || `Color ${i + 1}`);
    const { r, g, b } = hexToRgb(c.hex);
    u16(0x0001); u32(2 + nm.length + 4 + 12 + 2);
    u16(nm.length / 2); bytes.push(...nm);
    bytes.push(82, 71, 66, 32); f32(r / 255); f32(g / 255); f32(b / 255); u16(2);
  });
  u16(0xc002); u32(0);
  return new Uint8Array(bytes);
}

/** PNG 色卡 */
export function drawCard(colors, { title = '我的配色', layout = 'chips', show = { name: true, hex: true, rgb: true, cmyk: true } } = {}) {
  const font = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",system-ui,sans-serif';
  const n = colors.length;
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const lines = c2 => {
    const out = [];
    const { r, g, b } = hexToRgb(c2.hex);
    const k = rgbToCmyk({ r, g, b });
    if (show.hex) out.push(['hex', c2.hex]);
    if (show.rgb) out.push(['', `RGB ${r} ${g} ${b}`]);
    if (show.cmyk) out.push(['', `CMYK ${r0(k.c)} ${r0(k.m)} ${r0(k.y)} ${r0(k.k)}`]);
    return out;
  };
  const date = new Date().toLocaleDateString('zh-CN');

  if (layout === 'chips') {
    const cols = Math.min(n, n > 6 ? Math.ceil(n / 2) : n);
    const rows = Math.ceil(n / cols);
    const cw = 300, ch = 420, gap = 36, pad = 80, top = 170;
    c.width = pad * 2 + cols * cw + (cols - 1) * gap;
    c.height = top + rows * ch + (rows - 1) * gap + pad;
    ctx.fillStyle = '#F4F3F0'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#1B1B1B'; ctx.font = `700 48px ${font}`; ctx.fillText(title, pad, 100);
    ctx.fillStyle = '#8A8A8A'; ctx.font = `400 22px ${font}`; ctx.fillText(`${n} 色 · ${date}`, pad, 138);
    colors.forEach((col, i) => {
      const x = pad + (i % cols) * (cw + gap), y = top + Math.floor(i / cols) * (ch + gap);
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.10)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
      roundRect(ctx, x, y, cw, ch, 14); ctx.fillStyle = '#FFFFFF'; ctx.fill();
      ctx.restore();
      ctx.save(); roundRect(ctx, x, y, cw, ch, 14); ctx.clip();
      ctx.fillStyle = col.hex; ctx.fillRect(x, y, cw, 260); ctx.restore();
      let ty = y + 304;
      if (show.name && col.name) { ctx.fillStyle = '#1B1B1B'; ctx.font = `700 28px ${font}`; ctx.fillText(col.name, x + 22, ty); ty += 38; }
      lines(col).forEach(([k, t]) => {
        ctx.fillStyle = k === 'hex' ? '#1B1B1B' : '#777';
        ctx.font = k === 'hex' ? `700 24px ui-monospace,Menlo,monospace` : `400 19px ui-monospace,Menlo,monospace`;
        ctx.fillText(t, x + 22, ty); ty += k === 'hex' ? 32 : 27;
      });
    });
  } else {
    // 竖条：大色块 + 下方说明
    const colW = Math.max(220, Math.min(320, 1800 / n)), pad = 0, H = 900, infoH = 230;
    c.width = colW * n; c.height = H + infoH;
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, c.width, c.height);
    colors.forEach((col, i) => {
      const x = pad + i * colW;
      ctx.fillStyle = col.hex; ctx.fillRect(x, 0, colW, H);
      ctx.fillStyle = textOn(col.hex); ctx.globalAlpha = 0.9; ctx.font = `700 30px ${font}`;
      if (show.name && col.name) ctx.fillText(col.name, x + 24, H - 36);
      ctx.globalAlpha = 1;
      let ty = H + 56;
      lines(col).forEach(([k, t]) => {
        ctx.fillStyle = k === 'hex' ? '#1B1B1B' : '#777';
        ctx.font = k === 'hex' ? `700 30px ui-monospace,Menlo,monospace` : `400 20px ui-monospace,Menlo,monospace`;
        ctx.fillText(t, x + 24, ty); ty += k === 'hex' ? 42 : 30;
      });
    });
    ctx.fillStyle = '#9A9A9A'; ctx.font = `400 20px ${font}`;
    ctx.textAlign = 'right'; ctx.fillText(`${title} · ${date}`, c.width - 24, c.height - 24); ctx.textAlign = 'left';
  }
  return c;
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

export function download(name, data, type = 'text/plain') {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
