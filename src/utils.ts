/**
 * 几何辅助函数:调整点坐标计算、顶点排序、生成 8 调整点
 */
import type { Dot, DotId } from './types';

import { GAP, PANEL_H, QUICK_PHRASE_GAP, SIZE_LABEL_H, TOOLBAR_H } from './const';

/** 浮层相对选区的竖直落位:选区上方外侧 / 下方外侧 / 选区内部(上下都不够时兜底) */
export type FloatPlacement = 'up' | 'down' | 'inside';

/**
 * 统一判定浮层(工具栏 / 尺寸标签)相对选区的竖直落位,保证多个浮层落位协同、互不重叠。
 *
 * 工具栏与尺寸标签原先各自独立判断「放上方还是下方」,窄选区时双双挤在同一带导致重叠。
 * 由本函数统一裁决:按 prefer 指定的首选方向尝试外侧,放不下则尝试反向外侧,上下都不够则判定为选区内部。
 *
 * @param pointer 选区四顶点 [sx, sy, ex, ey]
 * @param floatH 浮层自身高度(工具栏含其配置面板的纵向开销)
 * @param prefer 首选外侧方向。工具栏默认底部('down',对齐 CleanShot/Snipaste);其余按需
 * @returns 'up' | 'down' | 'inside'
 */
export const decideFloatPlacement = (
  [, startY, , endY]: number[],
  floatH: number,
  prefer: 'up' | 'down' = 'up',
): FloatPlacement => {
  const vh = window.innerHeight;
  const fitsUp = startY - GAP - floatH >= GAP;
  const fitsDown = endY + GAP + floatH <= vh - GAP;
  if (prefer === 'down') {
    if (fitsDown) return 'down';
    if (fitsUp) return 'up';
  } else {
    if (fitsUp) return 'up';
    if (fitsDown) return 'down';
  }
  return 'inside';
};

/**
 * 估算工具栏像素宽度(用于横向 clamp 与「标签能否与工具栏同侧并排不重叠」判定,两处共用)。
 * 按钮 30px、分隔符约 9px,加左右容器内边距 px-1.5(共 12px)。
 *
 * @param list 工具项列表(含 'dividing-x' 分隔符)
 */
export const estimateToolbarWidth = (list: string[]): number =>
  list.reduce((w, name) => w + (name.includes('dividing') ? 9 : 30), 12);

/** 尺寸标签落位:三种选区外侧方位 + 内部左上焊边兜底 */
export type LabelPlacement = 'top-outside' | 'left-outside' | 'right-outside' | 'inside';

/** 工具栏(含配置栏)落位结果 */
export interface ToolbarLayout {
  /** 工具栏自身视口 top(不含配置面板) */
  vpTop: number;
  /** 工具栏视口 left */
  vpLeft: number;
  /** 配置面板是否朝上(影响其挂载侧;朝上=弹在按钮上方) */
  panelUp: boolean;
}

/** 尺寸标签落位结果(视口绝对坐标,与工具栏同套 clamp,保证不脱节、不重叠) */
export interface LabelLayout {
  /** 落位方位(仅用于焊边圆角等视觉判定) */
  placement: LabelPlacement;
  /** 标签视口 top */
  vpTop: number;
  /** 标签视口 left */
  vpLeft: number;
}

/** 三浮层(尺寸标签 / 工具栏 / 配置栏)统一落位结果 */
export interface AnnotatorLayout {
  toolbar: ToolbarLayout;
  label: LabelLayout;
}

/**
 * 估算尺寸标签像素宽度(用于左/右外侧能否容纳的判定)。
 * 文本形如 `463 × 193`:数字位数 + 「 × 」3 字符,按 12px 字宽约 8px/字 估;再加 px-2.5 左右内边距 20px。
 *
 * @param w 选区宽度(显示数字)
 * @param h 选区高度(显示数字)
 */
export const estimateLabelWidth = (w: number, h: number): number =>
  (`${w}`.length + `${h}`.length + 3) * 8 + 20;

/**
 * 统一裁决三浮层(尺寸标签 / 工具栏 / 配置栏)的最终视口落位。
 *
 * 收敛为单一纯函数,保证标签与工具栏基于同一份几何协同(竖叠 / 退让),消除多浮层各自判断导致的重叠。
 *
 * 工具栏(含配置栏)回退链:下外·中 → 上外·中 → 内部贴底·中(横向恒居中,clamp 进视口)。
 * 尺寸标签回退链:上外·左 → 左外·顶 → 右外·顶 → 内部左上·焊边(不使用下外侧)。
 * 协同竖叠:仅当「工具栏被迫上外」且「标签也落上外」时,顶部带够装整叠则从选区上边往外依次
 *          标签 → GAP → 工具栏 →(配置栏);装不下整叠则工具栏退内部贴底居中、标签保持上外。
 *
 * @param pointer 选区四顶点 [sx, sy, ex, ey]
 * @param list 工具项列表
 * @param hasPanel 是否展示配置面板(选中绘图工具时)
 */
export const computeLayout = (
  pointer: number[],
  list: string[],
  hasPanel: boolean,
): AnnotatorLayout => {
  const [startX, startY, endX, endY] = pointer;
  const { innerWidth: vw, innerHeight: vh } = window;
  const panelSpace = hasPanel ? PANEL_H + GAP : 0;
  const toolbarFullH = TOOLBAR_H + panelSpace;

  // 标签上外侧能否容纳
  const fitsLabelTopOutside = startY - GAP - SIZE_LABEL_H >= GAP;

  // 标签上外放不下时的回退:左外 → 右外 → 内部左上
  const fallbackLabel = (): LabelPlacement => {
    const labelW = estimateLabelWidth(endX - startX, endY - startY);
    if (startX - GAP - labelW >= GAP) return 'left-outside';
    if (endX + GAP + labelW <= vw - GAP) return 'right-outside';
    return 'inside';
  };

  // 工具栏竖直首版:首选底部外侧(默认布局),不够翻顶部,都不够内部贴底
  const placement = decideFloatPlacement(pointer, toolbarFullH, 'down');
  let panelUp = false;
  let vpTop: number;
  let labelPlacement: LabelPlacement;

  if (placement !== 'up') {
    // 工具栏在下外侧 / 内部贴底:顶部带空闲,标签优先上外
    labelPlacement = fitsLabelTopOutside ? 'top-outside' : fallbackLabel();
    if (placement === 'down') {
      vpTop = endY + GAP;
    } else {
      // inside:上下外侧都不够 → 贴选区底部内侧,面板朝上
      vpTop = endY - GAP - TOOLBAR_H;
      panelUp = true;
    }
  } else {
    // 工具栏被迫上外:与标签争抢顶部带
    panelUp = true;
    const stackH = SIZE_LABEL_H + GAP + toolbarFullH;
    const fitsStack = startY - GAP - stackH >= GAP;
    if (fitsStack) {
      // 顶部带够装整叠:从选区上边往外 标签 → GAP → 工具栏(→ 配置栏)
      labelPlacement = 'top-outside';
      vpTop = startY - 2 * GAP - SIZE_LABEL_H - TOOLBAR_H;
    } else {
      // 装不下整叠:工具栏退内部贴底居中,标签保持在外
      labelPlacement = fitsLabelTopOutside ? 'top-outside' : fallbackLabel();
      vpTop = endY - GAP - TOOLBAR_H;
    }
  }

  // clamp 工具栏竖直落位,保证「工具栏 + 配置面板」整体落在视口内
  const minTop = GAP + (panelUp ? panelSpace : 0);
  const maxTop = vh - GAP - TOOLBAR_H - (panelUp ? 0 : panelSpace);
  vpTop = Math.min(Math.max(vpTop, minTop), maxTop);

  // 横向始终居中于选区(桌面截图软件范式),再 clamp 进视口
  const width = estimateToolbarWidth(list);
  let vpLeft = startX + (endX - startX - width) / 2;
  vpLeft = Math.min(Math.max(vpLeft, GAP), vw - GAP - width);

  // ───────── 尺寸标签:与工具栏同套「先算视口理想位、再 clamp 进视口」,消除两套坐标体系脱节 ─────────
  // 历史 bug:标签曾用纯 CSS 相对选区盒定位(bottom:100%/right:100% + margin),完全不参与 clamp。
  // 视口被压到临界时工具栏被 clamp 拉走、标签仍贴选区边 → 脱节重叠(小屏偶现)。此处统一让标签也走 clamp。
  const labelW = estimateLabelWidth(endX - startX, endY - startY);
  const labelLayout = computeLabelLayout(pointer, labelPlacement, labelW, vw, vh);

  // 最终保险:clamp 后若标签矩形仍与「工具栏(含配置面板)矩形」相交,沿竖直方向把标签推到工具栏外侧。
  // 覆盖既有竖叠分支照顾不到的「clamp 之后才出现的相交」(极端窄/矮视口、选区贴边角)。
  const toolbarRect = {
    top: panelUp ? vpTop - panelSpace : vpTop,
    left: vpLeft,
    right: vpLeft + width,
    bottom: panelUp ? vpTop + TOOLBAR_H : vpTop + toolbarFullH,
  };
  resolveLabelOverlap(labelLayout, labelW, toolbarRect, vh);

  return { toolbar: { vpTop, vpLeft, panelUp }, label: labelLayout };
};

/**
 * 按落位方位算尺寸标签的视口理想坐标,并 clamp 进视口(留 GAP 边距)。
 *
 * @param pointer 选区四顶点 [sx, sy, ex, ey]
 * @param placement 落位方位(由 computeLayout 的回退链裁定)
 * @param labelW 标签估算宽度
 * @param vw 视口宽
 * @param vh 视口高
 */
const computeLabelLayout = (
  [startX, startY, endX]: number[],
  placement: LabelPlacement,
  labelW: number,
  vw: number,
  vh: number,
): LabelLayout => {
  let vpTop: number;
  let vpLeft: number;
  switch (placement) {
    case 'top-outside': // 上边外侧、左对齐选区左边
      vpTop = startY - GAP - SIZE_LABEL_H;
      vpLeft = startX;
      break;
    case 'left-outside': // 左边外侧、顶对齐选区上边
      vpTop = startY;
      vpLeft = startX - GAP - labelW;
      break;
    case 'right-outside': // 右边外侧、顶对齐选区上边
      vpTop = startY;
      vpLeft = endX + GAP;
      break;
    default: // inside:内部左上焊边(贴选区左上角,不留 gap)
      vpTop = startY;
      vpLeft = startX;
      break;
  }
  // clamp 进视口,保证标签整体可见
  vpTop = Math.min(Math.max(vpTop, GAP), vh - GAP - SIZE_LABEL_H);
  vpLeft = Math.min(Math.max(vpLeft, GAP), vw - GAP - labelW);
  return { placement, vpTop, vpLeft };
};

/** 矩形(视口坐标) */
interface Rect {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

/**
 * 标签与工具栏 AABB 相交检测;相交则把标签沿竖直方向推到工具栏外侧 + GAP(优先上方,放不下则下方),
 * 推后再 clamp 进视口。原地修改 labelLayout。
 *
 * @param label 标签落位(将被原地修正 vpTop)
 * @param labelW 标签宽度
 * @param toolbar 工具栏(含配置面板)的视口矩形
 * @param vh 视口高
 */
const resolveLabelOverlap = (
  label: LabelLayout,
  labelW: number,
  toolbar: Rect,
  vh: number,
): void => {
  const labelRect: Rect = {
    top: label.vpTop,
    left: label.vpLeft,
    right: label.vpLeft + labelW,
    bottom: label.vpTop + SIZE_LABEL_H,
  };
  const intersects =
    labelRect.left < toolbar.right &&
    labelRect.right > toolbar.left &&
    labelRect.top < toolbar.bottom &&
    labelRect.bottom > toolbar.top;
  if (!intersects) return;

  // 优先推到工具栏上方外侧
  const aboveTop = toolbar.top - GAP - SIZE_LABEL_H;
  if (aboveTop >= GAP) {
    label.vpTop = aboveTop;
    return;
  }
  // 上方放不下 → 推到工具栏下方外侧
  const belowTop = toolbar.bottom + GAP;
  if (belowTop + SIZE_LABEL_H <= vh - GAP) {
    label.vpTop = belowTop;
    return;
  }
  // 上下都不够(极端):取能露出最多的一侧,clamp 进视口(退化为尽量不重叠)
  label.vpTop =
    aboveTop >= GAP - SIZE_LABEL_H
      ? Math.max(aboveTop, GAP)
      : Math.min(belowTop, vh - GAP - SIZE_LABEL_H);
};

/** 升序比较器 */
export const sort = (a: number, b: number): number => a - b;

/** 视口矩形(快捷描述弹窗避让判定用) */
export interface ViewportRect {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

/** 快捷描述弹窗落位结果(视口坐标) */
export interface QuickPhrasePosition {
  top: number;
  left: number;
  /** true=翻转到锚点上方(进场上滑方向随之反向) */
  flipUp: boolean;
}

/** 两矩形相交面积(不相交为 0);用于全方向都放不下时挑「压得最少」的兜底 */
const overlapArea = (a: ViewportRect, b: ViewportRect): number => {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return w > 0 && h > 0 ? w * h : 0;
};

/**
 * 计算快捷描述弹窗的自适应落位。
 *
 * 障碍 = 编辑框(anchor)+ 工具栏 + 配置面板:弹窗须避开全部,尤其不能压住编辑框本身。
 * 候选按优先级排布 8 个方位变体(下方左/右对齐 → 上方左/右对齐 → 右侧顶/底对齐 → 左侧顶/底对齐),
 * 每个候选先 clamp 进视口,再与全部障碍做 AABB 相交检测,取第一个「在视口内且与任何障碍都不相交」的位置。
 * 关键修复:clamp 之后必须复检相交(旧实现 clamp 后直接采用,导致编辑框在视口下半部时弹窗被上移压住它)。
 * 全部候选都相交(极端小视口)时,退化为「与所有障碍总重叠面积最小」的候选,保证至少露出编辑框大部分。
 *
 * @param anchor 锚点(编辑框)视口矩形——同时作为定位基准与首要避让障碍
 * @param panelW 弹窗宽度
 * @param panelH 弹窗当前高度(已挂载后的真实高度)
 * @param obstacles 其它需避让的障碍矩形(工具栏、配置面板等,不含 anchor)
 * @returns 弹窗左上角视口坐标 + 是否翻转到上方(仅影响进场动画方向)
 */
export const computeQuickPhrasePosition = (
  anchor: ViewportRect,
  panelW: number,
  panelH: number,
  obstacles: ViewportRect[],
): QuickPhrasePosition => {
  const { innerWidth: vw, innerHeight: vh } = window;
  // 编辑框自身也是障碍:弹窗绝不能压住它
  const blockers = [anchor, ...obstacles];
  // clamp 一对 (top,left) 进视口(留 GAP 边距)
  const clamp = (top: number, left: number): { top: number; left: number } => ({
    top: Math.max(GAP, Math.min(top, vh - GAP - panelH)),
    left: Math.max(GAP, Math.min(left, vw - GAP - panelW)),
  });
  // 候选方位:下/上 各含左对齐+右对齐(右对齐 = 弹窗右缘贴锚点右缘),右/左侧各含顶对齐+底对齐。
  // flipUp 仅上方方向为 true(进场从上往下收拢),其余从下/侧向收拢。
  const rightAlignLeft = anchor.right - panelW; // 右对齐时的 left
  const bottomAlignTop = anchor.bottom - panelH; // 底对齐时的 top
  const candidates: { top: number; left: number; flipUp: boolean }[] = [
    { top: anchor.bottom + QUICK_PHRASE_GAP, left: anchor.left, flipUp: false }, // 下方·左对齐
    { top: anchor.bottom + QUICK_PHRASE_GAP, left: rightAlignLeft, flipUp: false }, // 下方·右对齐
    { top: anchor.top - QUICK_PHRASE_GAP - panelH, left: anchor.left, flipUp: true }, // 上方·左对齐
    { top: anchor.top - QUICK_PHRASE_GAP - panelH, left: rightAlignLeft, flipUp: true }, // 上方·右对齐
    { top: anchor.top, left: anchor.right + QUICK_PHRASE_GAP, flipUp: false }, // 右侧·顶对齐
    { top: bottomAlignTop, left: anchor.right + QUICK_PHRASE_GAP, flipUp: false }, // 右侧·底对齐
    { top: anchor.top, left: anchor.left - QUICK_PHRASE_GAP - panelW, flipUp: false }, // 左侧·顶对齐
    { top: bottomAlignTop, left: anchor.left - QUICK_PHRASE_GAP - panelW, flipUp: false }, // 左侧·底对齐
  ];

  let best: { top: number; left: number; flipUp: boolean; area: number } | null = null;
  for (const c of candidates) {
    const { top, left } = clamp(c.top, c.left);
    const rect: ViewportRect = { top, left, right: left + panelW, bottom: top + panelH };
    const area = blockers.reduce((sum, b) => sum + overlapArea(rect, b), 0);
    if (area === 0) return { top, left, flipUp: c.flipUp }; // 完全不压任何障碍 → 直接采用
    if (!best || area < best.area) best = { top, left, flipUp: c.flipUp, area };
  }
  // 全部候选都与障碍相交(极端):取总重叠面积最小者,至少露出编辑框大部分
  return best
    ? { top: best.top, left: best.left, flipUp: best.flipUp }
    : { ...clamp(candidates[0].top, candidates[0].left), flipUp: false };
};

/**
 * 生成短随机 id(图形实例标识,拼在 `${type}-` 后)。
 * @param len id 长度,默认 6
 */
export const createId = (len = 6): string =>
  Math.random()
    .toString(36)
    .slice(3, 3 + len);

/** 8 个调整点的方位 id */
export const DOTS: DotId[] = [
  'top left',
  'top center',
  'top right',
  'mid left',
  'mid right',
  'bottom left',
  'bottom center',
  'bottom right',
];

/**
 * 根据矩形两顶点(左上、右下)与方位名,算出该方位调整点坐标。
 * @param pos [sx, sy, ex, ey] 左上顶点 + 右下顶点
 * @param local 方位名,如 'top left'
 */
export const getCooByPos = (
  [sx, sy, ex, ey]: number[],
  local: string,
): { top: number; left: number } => {
  const [row, span] = local.split(' ');
  const s: Record<string, number> = { left: sx, center: (sx + ex) / 2, right: ex };
  const r: Record<string, number> = { top: sy, mid: (sy + ey) / 2, bottom: ey };
  return { top: r[row], left: s[span] };
};

/**
 * 根据任意两顶点,归一化为「左上顶点 + 右下顶点」。
 */
export const sortCoo = (
  [sx, sy]: number[],
  [ex, ey]: number[],
): { start: number[]; end: number[] } => {
  const s = [sx, ex].sort(sort);
  const e = [sy, ey].sort(sort);
  return { start: [s[0], e[0]], end: [s[1], e[1]] };
};

/**
 * 由两顶点生成 8 个调整点。
 */
export const createDots = (s: number[], e: number[]): Dot[] => {
  const { start, end } = sortCoo(s, e);
  return DOTS.map((id) => {
    const { top, left } = getCooByPos([...start, ...end], id);
    return { id, x: left, y: top };
  });
};
