/**
 * 椭圆
 */
import type { EllipsePath, GraphPlugin } from '../types';

import { createDots, sort, sortCoo } from '../utils';

/** 由椭圆求外接矩形两顶点 */
const getCoo = ({ cx, cy, rx, ry }: EllipsePath): number[] => [cx - rx, cy - ry, cx + rx, cy + ry];

/** 调整大小基准 [sx, sy, ex, ey] */
let t: number[] = [];
/** 选中本体整体平移的起点(圆心) */
let m: number[] = [];

const ellipse: GraphPlugin = {
  type: 'ellipse',
  down([x, y]) {
    const { config = {} } = this.ctx;
    const path: EllipsePath = {
      type: 'ellipse',
      cx: x,
      cy: y,
      rx: 0,
      ry: 0,
      stroke: config.stroke,
      strokeWidth: config.strokeWidth,
    };
    return [path];
  },
  move([x, y]) {
    const { path, start } = this.ctx;
    const el = path as EllipsePath;
    const [sx, sy] = start as number[];
    const dots = createDots([sx, sy], [x, y]);
    el.cx = (sx + x) / 2;
    el.cy = (sy + y) / 2;
    el.rx = Math.abs(sx - x) / 2;
    el.ry = Math.abs(sy - y) / 2;
    return [el, dots];
  },
  selected() {
    const el = this.ctx.path as EllipsePath;
    const [sx, sy, ex, ey] = getCoo(el);
    m = [el.cx, el.cy];
    return [undefined, createDots([sx, sy], [ex, ey])];
  },
  restyle(path, patch) {
    return Object.assign({}, path, patch);
  },
  translate(path, dx, dy) {
    const el = path as EllipsePath;
    return Object.assign({}, el, { cx: el.cx + dx, cy: el.cy + dy });
  },
  dotDown() {
    t = getCoo(this.ctx.path as EllipsePath);
  },
  adjust([x, y]) {
    const { path, target, start } = this.ctx;
    const el = path as EllipsePath;
    // 无 target = 选中本体拖拽 → 整体平移
    if (!target) {
      const [mcx, mcy] = m;
      const [sx, sy] = start || [x, y];
      el.cx = mcx + (x - sx);
      el.cy = mcy + (y - sy);
      const [csx, csy, cex, cey] = getCoo(el);
      return [el, createDots([csx, csy], [cex, cey])];
    }
    const [row, span] = target.split(' ');
    const [tsx, tsy, tex, tey] = t;
    let [sx, sy, ex, ey] = getCoo(el);
    if (span === 'center') {
      [sy, ey] = [row === 'top' ? tey : tsy, y].sort(sort);
    } else if (row === 'mid') {
      [sx, ex] = [span === 'left' ? tex : tsx, x].sort(sort);
    } else {
      const { start: st, end } = sortCoo(
        [span === 'left' ? tex : tsx, row === 'top' ? tey : tsy],
        [x, y],
      );
      [sx, sy] = st;
      [ex, ey] = end;
    }
    el.cx = (sx + ex) / 2;
    el.cy = (sy + ey) / 2;
    el.rx = Math.abs(sx - ex) / 2;
    el.ry = Math.abs(sy - ey) / 2;
    return [el, createDots([sx, sy], [ex, ey])];
  },
  up() {
    t = [];
    m = [];
  },
};

export default ellipse;
