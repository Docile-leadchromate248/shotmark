/**
 * 图形注册器:把各图形插件的事件方法分发挂载到统一的 draw 对象上。
 *
 * draw-board 在 mouseDown/Move/Up 时根据当前 type 从 draw[event][type] 取对应方法调用。
 */
import type { DrawConfig, GraphPlugin, GraphType } from '../types';

import { DEFAULT_CONFIG, DEFAULT_CONFIG_BY_TYPE, DRAW_TYPES } from '../const';

// v2:仅持久化「用户改动过的配置」,不再把内置默认值一起写入(避免默认值黏滞、无法迭代)。
const CONFIG_STORAGE_KEY = 'shotmark:draw-config:v2';

const canUseStorage = (): boolean => typeof window !== 'undefined' && !!window.localStorage;

/** 用户改动过的配置(每个工具最后一次改动的值),跨会话记忆 */
let userConfig: Partial<Record<GraphType, DrawConfig>> = {};

const saveUserConfig = (): void => {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(userConfig));
  } catch {
    // 忽略存储异常(隐私模式/配额不足),不影响主流程
  }
};

const loadUserConfig = (): Partial<Record<GraphType, DrawConfig>> => {
  if (!canUseStorage()) return {};
  try {
    const raw = window.localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<Record<GraphType, DrawConfig>>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

/** 按事件分桶的图形方法表 */
interface DrawRegistry {
  down: Partial<Record<GraphType, NonNullable<GraphPlugin['down']>>>;
  move: Partial<Record<GraphType, NonNullable<GraphPlugin['move']>>>;
  up: Partial<Record<GraphType, NonNullable<GraphPlugin['up']>>>;
  selected: Partial<Record<GraphType, NonNullable<GraphPlugin['selected']>>>;
  dotDown: Partial<Record<GraphType, NonNullable<GraphPlugin['dotDown']>>>;
  adjust: Partial<Record<GraphType, NonNullable<GraphPlugin['adjust']>>>;
  restyle: Partial<Record<GraphType, NonNullable<GraphPlugin['restyle']>>>;
  translate: Partial<Record<GraphType, NonNullable<GraphPlugin['translate']>>>;
  edit: Partial<Record<GraphType, NonNullable<GraphPlugin['edit']>>>;
  config: Partial<Record<GraphType, DrawConfig>>;
}

export const draw: DrawRegistry = {
  down: {},
  move: {},
  up: {},
  selected: {},
  dotDown: {},
  adjust: {},
  restyle: {},
  translate: {},
  edit: {},
  config: {},
};

/** 可注册的事件名(不含 config) */
const EVENTS: (keyof Omit<DrawRegistry, 'config'>)[] = [
  'down',
  'move',
  'up',
  'selected',
  'dotDown',
  'adjust',
  'restyle',
  'translate',
  'edit',
];

/** 注册一个图形插件:把它实现了的事件方法挂到 draw 对应桶 */
export const registerGraph = (plugin: GraphPlugin): void => {
  const { type } = plugin;
  EVENTS.forEach((ev) => {
    const fn = plugin[ev];
    if (fn) {
      // 各桶 value 类型由 ev 决定,此处按 ev 动态赋值,用 any 桥接
      (draw[ev] as Record<string, unknown>)[type] = fn;
    }
  });
};

/** 已注册的图形类型集合 */
export const getKeys = (): GraphType[] => {
  const set = new Set<GraphType>();
  EVENTS.forEach((ev) => {
    Object.keys(draw[ev]).forEach((k) => set.add(k as GraphType));
  });
  return [...set];
};

/**
 * 用户主动改动配置(配置面板触发):写入运行时 + 记忆并持久化。
 * 作用于「下一个新图形」,并跨会话记住该工具最后一次改动的值。
 */
export const setConfig = (type: GraphType, config: DrawConfig): void => {
  draw.config[type] = Object.assign(draw.config[type] || {}, config);
  userConfig[type] = Object.assign(userConfig[type] || {}, config);
  saveUserConfig();
};

/**
 * 应用 start 选项默认值(如 defaultColor/defaultLineWidth):仅写运行时,不计入用户记忆。
 * 需在 initDefaultConfig 之后、applyUserMemory 之前调用,保证「记忆 > start 选项」。
 */
export const applyDefaultConfig = (type: GraphType, config: DrawConfig): void => {
  draw.config[type] = Object.assign(draw.config[type] || {}, config);
};

/** 把用户记忆值覆盖到运行时(记忆优先级最高,须在应用完 start 选项后调用) */
export const applyUserMemory = (): void => {
  DRAW_TYPES.forEach((t) => {
    if (userConfig[t]) draw.config[t] = Object.assign(draw.config[t] || {}, userConfig[t]);
  });
};

/** 给所有绘图工具灌内置默认配置(不含用户记忆,记忆由 applyUserMemory 后置覆盖) */
export const initDefaultConfig = (): void => {
  userConfig = loadUserConfig();
  // 内置基线:按类型默认 > 通用内置默认;用户记忆稍后由 applyUserMemory 覆盖。
  for (const t of DRAW_TYPES) {
    draw.config[t] = Object.assign({}, DEFAULT_CONFIG, DEFAULT_CONFIG_BY_TYPE[t] || {});
  }
};
