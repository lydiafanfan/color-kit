// 状态、撤销 / 重做、本地保存
import { normHex } from './color.js';

const KEY = 'colorkit:v1';
const DEFAULT = ['#264653', '#2A9D8F', '#E9C46A', '#F4A261', '#E76F51'];

export const state = {
  palette: DEFAULT.map(hex => ({ hex, locked: false, name: '' })),
  sel: 0,
  saved: [],          // [{id, name, colors:[{hex,name}], created, updated}]
  theme: 'auto',      // auto | light | dark
  wheel: 'ryb',       // ryb | rgb
  pickerMode: 'HSB',
  previewTab: 'ui',
  previewDark: false,
  roleShift: 0,
  genMode: 'smart',
  anchor: true,
  contrast: true,     // 色彩理论配色时拉开明暗       // 生成时以选中的颜色为基准
  harmonyBase: '#2A9D8F',
  spread: 30,
  currentSavedId: null,
};

const PERSIST = ['palette', 'sel', 'saved', 'theme', 'wheel', 'pickerMode', 'previewTab', 'previewDark', 'genMode', 'anchor', 'contrast', 'harmonyBase', 'spread', 'currentSavedId'];

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      for (const k of PERSIST) if (d[k] !== undefined) state[k] = d[k];
      state.palette = (state.palette || []).map(c => ({ hex: normHex(c.hex) || '#888888', locked: !!c.locked, name: c.name || '' }));
      if (!state.palette.length) state.palette = DEFAULT.map(hex => ({ hex, locked: false, name: '' }));
    }
  } catch { /* 浏览器禁用存储时照常使用 */ }
  state.sel = Math.min(state.sel, state.palette.length - 1);
}

let saveTimer = 0;
export function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const d = {};
      for (const k of PERSIST) d[k] = state[k];
      localStorage.setItem(KEY, JSON.stringify(d));
    } catch { /* 忽略 */ }
  }, 150);
}

// ---------- 撤销 / 重做（只记录色卡本身） ----------
const past = [], future = [];
let lastAt = 0;
const snap = () => JSON.stringify(state.palette);
const listeners = new Set();
export const subscribe = fn => (listeners.add(fn), () => listeners.delete(fn));
export function emit(info = {}) { for (const fn of listeners) fn(info); }

/**
 * 修改色卡。merge=true 时，连续拖动（间隔 < 700ms）合并成一步撤销。
 */
export function change(fn, { merge = false, source = '' } = {}) {
  const before = snap();
  fn(state);
  const after = snap();
  if (after !== before) {
    const now = Date.now();
    if (!merge || now - lastAt > 700) {
      past.push(before);
      if (past.length > 200) past.shift();
      future.length = 0;
    }
    lastAt = now;
  }
  persist();
  emit({ source });
}
function restore(s) {
  state.palette = JSON.parse(s);
  state.sel = Math.min(state.sel, state.palette.length - 1);
}
export function undo() {
  if (!past.length) return false;
  future.push(snap()); restore(past.pop()); lastAt = 0; persist(); emit({ source: 'history' }); return true;
}
export function redo() {
  if (!future.length) return false;
  past.push(snap()); restore(future.pop()); lastAt = 0; persist(); emit({ source: 'history' }); return true;
}
export const canUndo = () => past.length > 0;
export const canRedo = () => future.length > 0;

export const hexes = () => state.palette.map(c => c.hex);
export function setPalette(list, opts) {
  change(s => {
    s.palette = list.map(h => (typeof h === 'string' ? { hex: h, locked: false, name: '' } : { hex: h.hex, locked: false, name: h.name || '' }));
    s.sel = Math.min(s.sel, s.palette.length - 1);
    s.currentSavedId = null;
  }, opts);
}

export const uid = () => Math.random().toString(36).slice(2, 10);
