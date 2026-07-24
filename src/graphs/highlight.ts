/**
 * 高亮(荧光笔):半透明矩形覆盖
 */
import type { GraphPlugin, RectPath } from '../types';

import { DEFAULT_HIGHLIGHT_COLOR, clampHighlightOpacity } from '../const';
import { createDots, sort, sortCoo } from '../utils';

let t: number[] = [];
let m: number[] = [];

const highlight: GraphPlugin = {
  type: 'highlight',
  down([x, y]) {
    const { config = {} } = this.ctx;
    const path: RectPath = {
      type: 'rect',
      x,
      y,
      w: 0,
      h: 0,
      fill: config.fill || DEFAULT_HIGHLIGHT_COLOR,
      isHighlight: true,
      opacity: clampHighlightOpacity(config.highlightOpacity) / 100,
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
    const next = Object.assign({}, path) as RectPath;
    if (patch.fill !== undefined) next.fill = patch.fill;
    if (patch.highlightOpacity !== undefined) {
      next.opacity = clampHighlightOpacity(patch.highlightOpacity) / 100;
    }
    return next;
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
      [sy, ey] = [row === 'top' ? tey : tsy, clientY].sort(sort);
    } else if (row === 'mid') {
      [sx, ex] = [span === 'left' ? tex : tsx, clientX].sort(sort);
    } else {
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

export default highlight;
