/**
 * 文字
 *
 * 交互模型(与主流截图工具一致):
 * - 工具选中后点空白 → 放置可编辑 <p>,输入完点空白处提交为 svg <text>
 * - 单击已提交文字 → 选中并可整体拖拽移动
 * - 双击已提交文字 → 二次编辑(浮出 <p> 预填原文)
 * - hover 已提交文字 → 显示边框(见 graphics 的 text-hit:hover)
 */
import type { DrawConfig, GraphPlugin, TextPath } from '../types';

import {
  BORDER_CLASS,
  DEFAULT_TEXT_COLOR,
  ROOT_CLASS,
  SHADOW_CLASS,
  TEXT_LINE_HEIGHT,
  TEXT_PAD,
} from '../const';

/**
 * 创建可编辑 <p>。(x,y) 为 <p> border-box 左上角(svg 坐标系)。
 * @returns [p 元素, shadow 外层容器]
 */
const createElementP = (
  [x, y]: number[],
  text: string,
  config: DrawConfig,
): [HTMLParagraphElement, HTMLDivElement] => {
  const color = config.fill || DEFAULT_TEXT_COLOR;
  const fontSize = config.fontSize || 14;
  const border = document.querySelector(`.${ROOT_CLASS} .${BORDER_CLASS}`) as HTMLElement;
  const shadow = document.createElement('div');
  const p = document.createElement('p');
  p.contentEditable = 'true';
  p.className = 'text-edit';
  p.style.left = `${x}px`;
  p.style.top = `${y}px`;
  p.style.padding = `${TEXT_PAD}px`;
  p.style.color = color;
  p.style.fontSize = `${fontSize}px`;
  p.style.lineHeight = `${TEXT_LINE_HEIGHT}`;
  p.style.boxShadow = `0 0 1px 1px ${color}`;
  p.innerText = text || '';
  shadow.className = SHADOW_CLASS;
  shadow.appendChild(p);
  border.appendChild(shadow);
  return [p, shadow];
};

/** 测量 <p> 的 border-box 尺寸(含 padding),生成命中框 w/h */
const measure = (p: HTMLElement): { w: number; h: number } => ({
  w: p.offsetWidth,
  h: p.offsetHeight,
});

/**
 * 读取可编辑 <p> 的「视觉折行」结果(所见即所得):
 * innerText 只含硬换行(回车),丢失编辑框受宽度约束产生的软换行,直接落 svg 会渲染成超宽单行溢出边界。
 * 这里逐字符用 Range.getClientRects() 取其视口 top,top 跳变即视为换到新行(软换行);
 * 同时遍历 <br>(硬换行/空行的载体)强制换行,保证空行不被吞掉。软、硬换行统一按视觉行切分。
 * 调用时 <p> 必须仍在 DOM 且可见(提交在 shadow.remove() 之前执行,满足此前提)。
 * @param p 可编辑 <p>
 * @returns 按视觉行切分的文本数组(至少一项)
 */
const readVisualLines = (p: HTMLElement): string[] => {
  const lines: string[] = [];
  const range = document.createRange();
  // SHOW_TEXT | SHOW_ELEMENT:文本节点逐字符判软换行,<br> 元素触发硬换行
  const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let lastTop: number | null = null;
  let current = '';
  let node = walker.nextNode();
  while (node) {
    if (node.nodeName === 'BR') {
      // 硬换行:收束当前行(可能为空行),重置基准
      lines.push(current);
      current = '';
      lastTop = null;
    } else if (node.nodeType === Node.TEXT_NODE) {
      const textNode = node as Text;
      for (let i = 0; i < textNode.data.length; i += 1) {
        range.setStart(textNode, i);
        range.setEnd(textNode, i + 1);
        const rect = range.getClientRects()[0];
        if (rect) {
          // top 跳变(>1px 容差,规避同行亚像素抖动)→ 收束当前行、另起一行(软换行)
          if (lastTop !== null && Math.abs(rect.top - lastTop) > 1) {
            lines.push(current);
            current = '';
          }
          lastTop = rect.top;
        }
        current += textNode.data[i];
      }
    }
    node = walker.nextNode();
  }
  lines.push(current);
  return lines.length ? lines : [''];
};

/** 选中本体整体平移的基准 */
let m: number[] = [];

/**
 * 当前活跃的可编辑 <p>(同一时刻至多一个)。
 *
 * 文字编辑框是脱离 React 的命令式 DOM,默认只在「点选区空白处」时才提交成 svg。
 * 这里把它登记为模块级活跃句柄,让外部能在两个时机介入:
 * - commit():点「勾」/Enter 提交前,强制把未提交的文字落成 svg(否则导出图丢字)。
 * - restyle():改色/字号时,即时同步到正在编辑的 <p>(否则样式要等失焦才生效)。
 */
interface ActiveEditor {
  /** 提交当前编辑框为 svg 文字(幂等:已提交后再调无副作用) */
  commit: () => void;
  /** 丢弃当前编辑框(不提交,直接移除 DOM;幂等) */
  discard: () => void;
  /** 实时改当前编辑框样式(颜色 / 字号) */
  restyle: (patch: DrawConfig) => void;
}
let activeEditor: ActiveEditor | null = null;

/** 提交当前活跃文字编辑框(供 annotation-canvas 在导出前调用,避免丢字) */
export const flushActiveText = (): void => activeEditor?.commit();

/** 强制清空活跃编辑框单例(会话开始/结束时调用,确保不残留陈旧状态) */
export const resetActiveText = (): void => {
  activeEditor = null;
};

/**
 * 丢弃当前活跃文字编辑框(供「删除/清空」时调用):
 * 正在编辑的 <p contenteditable> 是脱离 React 的命令式 DOM,尚未 commit 成 svg、不在 graph 数组里,
 * 故 clear 清空 graph 时清不到它。这里直接移除其 DOM 并解除登记,避免删除后残留未提交文字。
 */
export const discardActiveText = (): void => activeEditor?.discard();

/** 实时同步当前活跃文字编辑框的样式(供 config-panel 改色/字号时调用) */
export const restyleActiveText = (patch: DrawConfig): void => activeEditor?.restyle(patch);

/**
 * 登记活跃编辑框,统一三种提交入口与实时改样式:
 * - 点选区空白(shadow 背景)、点「勾」导出(flushActiveText)都走同一 commit(幂等,只落一次)。
 * - restyle 把颜色/字号即时写到 <p> 的 DOM 样式,让编辑中就能看到变化(否则要等失焦才生效)。
 * @param p 可编辑 <p>
 * @param shadow <p> 外层容器(点其背景即提交)
 * @param commit 落成 svg 文字的回调(读最新 config)
 * @param config 初始样式(down 为工具记忆配置 / edit 为原文字属性,均为 draw.config 的活引用)
 */
function registerActiveEditor(
  p: HTMLParagraphElement,
  shadow: HTMLDivElement,
  commit: () => void,
  config: DrawConfig,
): void {
  let committed = false;
  const doCommit = (): void => {
    if (committed) return;
    committed = true;
    activeEditor = null;
    // 空内容(从未输入或全空白)不落 svg,避免点「勾」时残留不可见的空文字命中框
    if (p.innerText.trim()) commit();
    shadow.remove();
  };
  // 丢弃:不提交内容,直接移除编辑框 DOM;与 doCommit 共用 committed 门闩保证幂等且互斥
  const doDiscard = (): void => {
    if (committed) return;
    committed = true;
    activeEditor = null;
    shadow.remove();
  };
  shadow.onclick = (ev) => {
    ev.stopPropagation();
    if ((ev.target as HTMLElement).className === SHADOW_CLASS) doCommit();
  };
  activeEditor = {
    commit: doCommit,
    discard: doDiscard,
    restyle: (patch) => {
      if (patch.fill) {
        p.style.color = patch.fill;
        p.style.boxShadow = `0 0 1px 1px ${patch.fill}`;
        config.fill = patch.fill;
      }
      if (patch.fontSize) {
        p.style.fontSize = `${patch.fontSize}px`;
        config.fontSize = patch.fontSize;
      }
    },
  };
}

const text: GraphPlugin = {
  type: 'text',
  // 初次绘制:点击即放可编辑 <p>,聚焦输入;点空白处或点「勾」导出时落成 svg 文字
  down([x, y]) {
    const { setPath, config = {} } = this.ctx;
    const [p, shadow] = createElementP([x, y], '', config);
    // mousedown 默认行为会抢焦点,下一帧再 focus 最稳
    setTimeout(() => p.focus(), 0);
    registerActiveEditor(
      p,
      shadow,
      () => {
        const { w, h } = measure(p);
        setPath?.([
          {
            type: 'text',
            content: readVisualLines(p),
            x,
            y,
            w,
            h,
            fill: config.fill,
            fontSize: config.fontSize,
          },
        ]);
      },
      config,
    );
  },
  // 单击选中:记录平移基准、开启整体拖拽(不返回调整点,字号由配置面板调整)
  selected() {
    const { x, y } = this.ctx.path as TextPath;
    m = [x, y];
    return [undefined, []];
  },
  // 双击二次编辑:临时清空 content 隐藏底层 svg 文字,浮出 <p> 预填原文
  edit() {
    const { path, setPath, config = {} } = this.ctx;
    const tp = path as TextPath;
    const content = (tp.content || []).join('\n');
    const [p, shadow] = createElementP([tp.x, tp.y], content, tp);
    // 隐藏底层 svg 文字,避免与编辑框文字重叠
    tp.content = [];
    setPath?.([tp]);
    setTimeout(() => p.focus(), 0);
    registerActiveEditor(
      p,
      shadow,
      () => {
        const { w, h } = measure(p);
        setPath?.([
          Object.assign({}, tp, {
            content: readVisualLines(p),
            w,
            h,
            fill: config.fill,
            fontSize: config.fontSize,
          }),
        ]);
      },
      config,
    );
  },
  // 改颜色/字号作用到已有文字;字号变化时按比例缩放命中框,保持 hover 边框贴合
  restyle(path, patch) {
    const tp = path as TextPath;
    const next = Object.assign({}, tp, patch) as TextPath;
    if (patch.fontSize && tp.fontSize) {
      const ratio = patch.fontSize / tp.fontSize;
      if (tp.w) next.w = tp.w * ratio;
      if (tp.h) next.h = tp.h * ratio;
    }
    return next;
  },
  translate(path, dx, dy) {
    const tp = path as TextPath;
    return Object.assign({}, tp, { x: tp.x + dx, y: tp.y + dy });
  },
  // 选中后拖拽本体 → 整体平移
  adjust([x, y]) {
    const { path, start } = this.ctx;
    const tp = path as TextPath;
    const [mx, my] = m;
    const [sx, sy] = start || [x, y];
    tp.x = mx + (x - sx);
    tp.y = my + (y - sy);
    return [tp];
  },
  up() {
    m = [];
  },
};

export default text;
