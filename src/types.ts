/**
 * shotmark 类型定义
 *
 * 截图标注器的全部类型基石:图形数据(可辨识联合)、绘制上下文、图形插件接口、对外 API。
 */

import type { Locale, LocaleTextOverrides } from './i18n';
import type { ThemeMode } from './theme-mode';

/** 支持的标注图形类型 */
export type GraphType =
  | 'rectangle'
  | 'ellipse'
  | 'arrow'
  | 'line'
  | 'brush'
  | 'text'
  | 'mosaic'
  | 'number'
  | 'highlight'
  | 'measure';

/** 工具栏动作类型 */
export type ActionType = 'confirm' | 'copy' | 'download' | 'cancel';

/** 调整点方位(8 方位 + 箭头/直线端点 S/E/M/L) */
export type DotId =
  | 'top left'
  | 'top center'
  | 'top right'
  | 'mid left'
  | 'mid right'
  | 'bottom left'
  | 'bottom center'
  | 'bottom right'
  | 'S'
  | 'E'
  | 'M'
  | 'L';

/** 调整点坐标 */
export interface Dot {
  id: DotId;
  x: number;
  y: number;
  /** 所属图形 id,reDraw 时回填 */
  target?: string;
}

/** 绘制配置:颜色/线宽/字号(各工具的「下一个新图形」默认值,持久记忆) */
export interface DrawConfig {
  stroke?: string;
  strokeWidth?: number;
  fill?: string;
  fontSize?: number;
  /** 高亮透明度(0~100) */
  highlightOpacity?: number;
  mosaicSize?: number;
  mosaicSoftness?: number;
}

/** 图形 path 公共字段 */
interface BasePath {
  /** 图形唯一 id(形如 `type-xxx`) */
  id?: string;
  /** 描边色 */
  stroke?: string;
  /** 描边宽度 */
  strokeWidth?: number;
  /** 填充色 */
  fill?: string;
}

/** 矩形 */
export interface RectPath extends BasePath {
  type: 'rect';
  x: number;
  y: number;
  w: number;
  h: number;
  /** highlight 工具使用半透明填充矩形 */
  isHighlight?: boolean;
  /** highlight 透明度 */
  opacity?: number;
}

/** 椭圆 */
export interface EllipsePath extends BasePath {
  type: 'ellipse';
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

/** 直线/画笔/箭头统一用 path(d 描述) */
export interface SvgPath extends BasePath {
  type: 'path';
  /** SVG 路径描述(d 属性) */
  d: string;
  /** SVG transform(画笔平移等) */
  transform?: string;
  /** 折线拐角样式(直接透传 svg,故收敛为 svg 合法枚举值) */
  strokeLinejoin?: 'inherit' | 'round' | 'miter' | 'bevel';
  /** 箭头专用:真实粗细系数(strokeWidth 恒为 1,真实宽度存这里) */
  _w?: number;
  /** 箭头专用:两端点 */
  sx?: number;
  sy?: number;
  ex?: number;
  ey?: number;
}

/** 文字 */
export interface TextPath extends BasePath {
  type: 'text';
  /** 多行文本,每个元素一行 */
  content: string[];
  /** 编辑 <p> border-box 左上角(svg 坐标系) */
  x: number;
  y: number;
  /** 命中框宽高 */
  w?: number;
  h?: number;
  fontSize?: number;
}

/** 马赛克(基础版本:遮罩块) */
export interface MosaicPath extends BasePath {
  type: 'mosaic';
  x: number;
  y: number;
  w: number;
  h: number;
  opacity?: number;
  mosaicSize?: number;
  mosaicSoftness?: number;
}

/** 序号标注 */
export interface NumberPath extends BasePath {
  type: 'number';
  x: number;
  y: number;
  value: number;
  radius?: number;
  textColor?: string;
  fontSize?: number;
}

/** 尺寸标注 */
export interface MeasurePath extends BasePath {
  type: 'measure';
  sx: number;
  sy: number;
  ex: number;
  ey: number;
  label: string;
  fontSize?: number;
}

/** 导出阶段用于真实马赛克处理的区域定义(相对选区坐标,单位 CSS 像素) */
export interface MosaicExportRect {
  x: number;
  y: number;
  w: number;
  h: number;
  blockSize?: number;
  blurStrength?: number;
}

/** 图形数据可辨识联合 */
export type GraphPath =
  RectPath | EllipsePath | SvgPath | TextPath | MosaicPath | NumberPath | MeasurePath;

/** 当前选中的已有图形信息(draw-board 通知,工具栏/配置面板据此读取真实属性) */
export interface SelectedInfo {
  id: string;
  type: GraphType;
  path: GraphPath;
}

/** 绘制上下文:每次鼠标操作期间传给图形插件方法的 this.ctx */
export interface DrawContext {
  offsetX?: number;
  offsetY?: number;
  /** 当前鼠标事件是否按下 Shift(用于约束绘制方向) */
  shiftKey?: boolean;
  /** 绘制起点 / 平移起点 */
  start?: number[];
  /** 当前操作的图形数据 */
  path?: GraphPath;
  /** 当前生效配置 */
  config?: DrawConfig;
  /** 当前调整点集合 */
  dots?: Dot[];
  /** 当前拖动的调整点方位(adjust 时存在) */
  target?: string;
  /** 异步回写 path(文字 contenteditable 链路用) */
  setPath?: (paths: [GraphPath]) => void;
}

/** 图形插件方法返回:[新 path, 新调整点]。两者皆可选 */
export type GraphResult = [GraphPath | undefined, Dot[]?] | [GraphPath] | undefined | void;

/** 插件方法 this 绑定 */
interface PluginThis {
  ctx: DrawContext;
}

/**
 * 图形插件接口:统一多种图形的行为。
 * 方法以 `fn.call({ ctx }, [x, y])` 调用,故 this 为 { ctx };持久状态(平移基准)用模块级变量。
 */
export interface GraphPlugin {
  /** 注册类型名 */
  type: GraphType;
  /** 鼠标按下:创建图形初始 path */
  down?: (this: PluginThis, point: number[]) => GraphResult;
  /** 鼠标拖动:绘制 */
  move?: (this: PluginThis, point: number[]) => GraphResult;
  /** 鼠标松开:收尾(清平移基准等) */
  up?: (this: PluginThis, point?: number[]) => GraphResult;
  /** 选中已有图形:返回调整点 + 记录平移基准 */
  selected?: (this: PluginThis, point?: number[]) => GraphResult;
  /** 按下调整点:记录调整基准 */
  dotDown?: (this: PluginThis, point?: number[]) => GraphResult;
  /** 拖动调整点 / 拖本体平移 */
  adjust?: (this: PluginThis, point: number[]) => GraphResult;
  /** 改颜色/大小作用到已有图形 */
  restyle?: (path: GraphPath, patch: DrawConfig) => GraphPath;
  /** 整体平移(调整截图区域原点时补偿) */
  translate?: (path: GraphPath, dx: number, dy: number) => GraphPath;
  /** 二次编辑(目前仅文字) */
  edit?: (this: PluginThis, point?: number[]) => GraphResult;
}

/* ============================== 对外 API 类型 ============================== */

/** 区域矩形(视口坐标) */
export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** onShot 回传的截图结果 */
export interface ShotmarkResult {
  /** 标注后图片的 base64 dataURL(image/jpeg) */
  image: string;
  /** 选区宽度(CSS 像素) */
  width: number;
  /** 选区高度(CSS 像素) */
  height: number;
  /** 实际像素宽度(含 2 倍清晰度) */
  pixWidth: number;
  /** 实际像素高度 */
  pixHeight: number;
}

/** Shotmark.start 配置项 */
export interface ShotmarkOptions {
  /** 更通用的区域入口:传入元素或坐标矩形自动进入区域截图模式 */
  region?: HTMLElement | Rect;
  /** region 模式下选区外扩像素 */
  regionPadding?: number;
  /** region 模式下是否自动进入标注模式(默认 true) */
  autoAnnotate?: boolean;
  /** 截图时临时隐藏的触发元素 */
  trigger?: HTMLElement;
  /** 动作按钮子集与顺序,默认 ['cancel', 'copy', 'download', 'confirm'] */
  actions?: ActionType[];
  /** 工具栏工具子集与顺序(默认全部工具) */
  tools?: GraphType[];
  /** 工具栏默认候选工具(传入后选区完成直接进入绘图态;未传则不自动选中工具) */
  defaultTool?: GraphType;
  /** 默认主色(作用于各工具颜色配置) */
  defaultColor?: string;
  /** 默认线宽(作用于线性工具) */
  defaultLineWidth?: number;
  /** 根遮罩层级(默认 9998) */
  zIndex?: number;
  /** 截图完成(点「勾」)回调 */
  onShot?: (res: ShotmarkResult) => void;
  /** 下载文件名(不含后缀),默认 shotmark_YYYY-MM-DD_HH.mm.ss */
  fileName?: string;
  /** 导出格式(用于 download 后缀),默认 png */
  format?: 'png' | 'jpeg';
  /** 开始绘制图形回调(可在此设 loading) */
  onShotStart?: () => void;
  /** 取消截图(点「叉」或 Esc)回调 */
  onCancel?: () => void;
  /** 复制到剪贴板成功回调 */
  onCopy?: (blob: Blob) => void;
  /** 复制到剪贴板失败回调 */
  onCopyError?: (error: unknown) => void;
  /** 下载成功回调 */
  onDownload?: (fileName: string) => void;
  /** 下载失败回调 */
  onDownloadError?: (error: unknown) => void;
  /** 标注数据变更回调(新增/调整/删除/撤销/重做时触发) */
  onAnnotationChange?: (graph: GraphPath[]) => void;
  /** 预埋字段:locale(当前用于内置消息文案),默认 zh-CN */
  locale?: Locale;
  /** 可选的内置文案覆盖(消息提示与配置面板文案) */
  localeText?: LocaleTextOverrides;
  /** 主题模式:light | dark,默认 light */
  theme?: ThemeMode;
  /** number 工具起始序号(新会话默认 1) */
  numberStart?: number;
  /** mosaic 默认方格大小(越大遮挡越强,默认 2) */
  mosaicSize?: number;
  /** mosaic 默认柔化强度(0~100,默认 36) */
  mosaicSoftness?: number;
}
