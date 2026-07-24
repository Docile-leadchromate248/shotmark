/**
 * shotmark 常量
 */
import type { DrawConfig, GraphType } from './types';

/**
 * 遮罩根容器类名(承载 position:fixed + z-index)。
 * 字面值必须稳定:generate-image 的 getHtml 会用 `.${ROOT_CLASS}` 选择器把标注层从克隆
 * DOM 里排除;text.ts 用它定位 .border 容器。
 */
export const ROOT_CLASS = 'shot-annotator-root';

/** 选区盒容器类名(承载文字标注的可编辑 <p>) */
export const BORDER_CLASS = 'shot-annotator-border';

/** 画布容器类名 */
export const CANVAS_CLASS = 'shot-annotator-canvas';

/** 工具栏容器类名 */
export const TOOLBAR_CLASS = 'shot-annotator-toolbar';

/** 文字编辑 <p> 外层 shadow 容器类名(text.ts 点击提交判定用) */
export const SHADOW_CLASS = 'shot-annotator-shadow';

/** 遮罩根层级(全局) */
export const ROOT_Z_INDEX = 9998;

/** 选区盒内部浮层的相对层级(局部上下文小值) */
export const Z_CANVAS = 1;
export const Z_TOOLBAR = 2;
export const Z_OVERLAY = 3;

/** 选区盒自身在绘图态(step=3)的层级 */
export const Z_CANVAS_STEP3 = 2;

/** 默认主色(与预设色第一项保持一致) */
export const DEFAULT_GRAPH_COLOR = '#FF3B30';

/** 高亮工具默认填充色 */
export const DEFAULT_HIGHLIGHT_COLOR = '#FAAD14';

/** 马赛克工具默认填充色 */
export const DEFAULT_MOSAIC_COLOR = '#9ca3af';

/** 文字工具默认填充色 */
export const DEFAULT_TEXT_COLOR = '#ff0000';

/** 单击判定阈值(px):拖拽距离 ≤ 此值视为单击 → 全屏截图 */
export const CLICK_THRESHOLD = 5;

/** 导出图清晰度倍数 */
export const PIXEL_RATIO = 2;

/** SVG 命名空间 */
export const SVG_NS = 'http://www.w3.org/2000/svg';

/** 浮层与选区/视口边缘的统一留白 */
export const GAP = 8;

/** 快捷描述弹窗与锚点的留白 */
export const QUICK_PHRASE_GAP = 10;

/** 工具栏高度 */
export const TOOLBAR_H = 31;

/** 配置面板高度 */
export const PANEL_H = 31;

/** 尺寸标签高度 */
export const SIZE_LABEL_H = 28;

/** 撤销栈容量 */
export const STACK_LIMIT = 10;

/** 默认绘制配置 */
export const DEFAULT_CONFIG: Required<DrawConfig> = {
  stroke: DEFAULT_GRAPH_COLOR,
  strokeWidth: 4,
  fill: DEFAULT_GRAPH_COLOR,
  fontSize: 18,
  highlightOpacity: 28,
  mosaicSize: 2,
  mosaicSoftness: 36,
};

/**
 * 按工具类型的默认配置覆盖(优先级高于 DEFAULT_CONFIG,低于用户记忆值)。
 * 例:序号默认字号比文字更小,避免序号圆点过大。
 */
export const DEFAULT_CONFIG_BY_TYPE: Partial<Record<GraphType, Partial<DrawConfig>>> = {
  number: { fontSize: 12 },
};

/** 可绘制的图形工具类型 */
export const DRAW_TYPES: GraphType[] = [
  'rectangle',
  'ellipse',
  'arrow',
  'line',
  'brush',
  'mosaic',
  'number',
  'text',
  'highlight',
  'measure',
];

/** 工具栏绘制工具顺序(先按功能分组,组内按高频) */
export const DRAW_ORDER: GraphType[] = [
  'rectangle',
  'ellipse',
  'arrow',
  'line',
  'measure',
  'brush',
  'highlight',
  'mosaic',
  'text',
  'number',
];

/** 8 方位调整点 → resize 光标 */
export const DOT_CURSOR: Record<string, string> = {
  'top left': 'nwse-resize',
  'top center': 'ns-resize',
  'top right': 'nesw-resize',
  'mid left': 'ew-resize',
  'mid right': 'ew-resize',
  'bottom left': 'nesw-resize',
  'bottom center': 'ns-resize',
  'bottom right': 'nwse-resize',
};

/** 配置面板预设色 */
export const PRESET_COLORS = [
  '#FF3B30',
  '#0A84FF',
  '#34C759',
  '#FF9F0A',
  '#BF5AF2',
  '#30B0C7',
  '#FFD60A',
  '#1C1C1E',
];

/** 线宽档位范围 */
export const STROKE_MIN = 1;
export const STROKE_MAX = 20;

/** 字号档位范围 */
export const FONT_MIN = 10;
export const FONT_MAX = 64;

/** 高亮透明度档位范围(百分比) */
export const HIGHLIGHT_OPACITY_MIN = 0;
export const HIGHLIGHT_OPACITY_MAX = 100;

/** 尺寸标注水平/垂直吸附阈值(px) */
export const MEASURE_SNAP_THRESHOLD = 12;

/** 马赛克大小档位范围:数值越大,遮挡越强 */
export const MOSAIC_SIZE_MIN = 1;
export const MOSAIC_SIZE_MAX = 24;

/** 马赛克柔化强度范围(0=无柔化,100=最柔) */
export const MOSAIC_SOFTNESS_MIN = 0;
export const MOSAIC_SOFTNESS_MAX = 100;

/** 统一收敛马赛克大小档位(非法值回退默认 2) */
export const clampMosaicSize = (value?: number): number => {
  if (!Number.isFinite(value)) return DEFAULT_CONFIG.mosaicSize;
  return Math.max(MOSAIC_SIZE_MIN, Math.min(MOSAIC_SIZE_MAX, Math.round(value as number)));
};

/**
 * 把 UI 档位换算成真实像素块大小。
 * 小档位尽量细腻(1 档接近轻糊化),档位越高方块感越明显。
 */
export const resolveMosaicBlockSize = (value?: number): number => {
  const level = clampMosaicSize(value);
  return Math.max(2, Math.round(level * 1.15 + 0.9));
};

/** 统一收敛马赛克柔化强度(非法值回退默认 36) */
export const clampMosaicSoftness = (value?: number): number => {
  if (!Number.isFinite(value)) return DEFAULT_CONFIG.mosaicSoftness;
  return Math.max(MOSAIC_SOFTNESS_MIN, Math.min(MOSAIC_SOFTNESS_MAX, Math.round(value as number)));
};

/** 统一收敛高亮透明度档位(非法值回退默认 28) */
export const clampHighlightOpacity = (value?: number): number => {
  if (!Number.isFinite(value)) return DEFAULT_CONFIG.highlightOpacity;
  return Math.max(
    HIGHLIGHT_OPACITY_MIN,
    Math.min(HIGHLIGHT_OPACITY_MAX, Math.round(value as number)),
  );
};

/** 鼠标滚轮调整大小步进(px) */
export const WHEEL_SIZE_STEP = 2;
/** 防抖延迟(ms):把一串连续滚轮合并成一次撤销记录 */
export const WHEEL_SIZE_DEBOUNCE_MS = 300;

/** 文字编辑 <p> 内边距与行高系数 */
export const TEXT_PAD = 3;
export const TEXT_LINE_HEIGHT = 1.3;
