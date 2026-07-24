/**
 * 矩形
 */
import type { GraphPlugin, RectPath } from '../types';

import { createDots, sort, sortCoo } from '../utils';

/** 调整大小时的基准顶点 [sx, sy, ex, ey] */
let t: number[] = [];
/** 选中本体整体平移的起点(模块级:绘制事件 this 为 {ctx}) */
let m: number[] = [];

const rectangle: GraphPlugin = {
  type: 'rectangle',
  down([x, y]) {
    // 从 ctx.config 读颜色/粗细写入 path
    const { config = {} } = this.ctx;
    const path: RectPath = {
      type: 'rect',
      x,
      y,
      w: 0,
      h: 0,
      stroke: config.stroke,
      strokeWidth: config.strokeWidth,
    };
    return [path];
  },
  move([x, y]) {
    const { path, start } = this.ctx;
    const rect = path as RectPath;
    const {
      start: [sx, sy],
      end: [ex, ey],
    } = sortCoo(start as number[], [x, y]);
    rect.x = sx;
    rect.y = sy;
    rect.w = ex - sx;
    rect.h = ey - sy;
    return [rect, createDots(start as number[], [x, y])];
  },
  selected() {
    const { x, y, w, h } = this.ctx.path as RectPath;
    m = [x, y];
    return [undefined, createDots([x, y], [x + w, y + h])];
  },
  restyle(path, patch) {
    return Object.assign({}, path, patch);
  },
  translate(path, dx, dy) {
    const rect = path as RectPath;
    return Object.assign({}, rect, { x: rect.x + dx, y: rect.y + dy });
  },
  dotDown() {
    const { x, y, w, h } = this.ctx.path as RectPath;
    t = [x, y, x + w, y + h];
  },
  adjust([clientX, clientY]) {
    const { target, path, start } = this.ctx;
    const rect = path as RectPath;
    // 无 target = 选中本体拖拽 → 整体平移
    if (!target) {
      const [mx, my] = m;
      const [sx, sy] = start || [clientX, clientY];
      rect.x = mx + (clientX - sx);
      rect.y = my + (clientY - sy);
      return [rect, createDots([rect.x, rect.y], [rect.x + rect.w, rect.y + rect.h])];
    }
    const { x, y, w, h } = rect;
    const [row, span] = target.split(' ');
    const [tsx, tsy, tex, tey] = t;
    let [sx, sy, ex, ey] = [x, y, x + w, y + h];
    if (span === 'center') {
      // 两个纵向中间点
      [sy, ey] = [row === 'top' ? tey : tsy, clientY].sort(sort);
    } else if (row === 'mid') {
      // 两个横向中间点
      [sx, ex] = [span === 'left' ? tex : tsx, clientX].sort(sort);
    } else {
      // 四个顶点
      const { start: st, end } = sortCoo(
        [span === 'left' ? tex : tsx, row === 'top' ? tey : tsy],
        [clientX, clientY],
      );
      [sx, sy] = st;
      [ex, ey] = end;
    }
    rect.x = sx;
    rect.y = sy;
    rect.w = ex - sx;
    rect.h = ey - sy;
    return [rect, createDots([sx, sy], [ex, ey])];
  },
  up() {
    t = [];
    m = [];
  },
};

export default rectangle;
