/**
 * 尺寸标注:两点连线 + 距离标签
 */
import type { GraphPlugin, MeasurePath } from '../types';

import { DEFAULT_GRAPH_COLOR, MEASURE_SNAP_THRESHOLD } from '../const';

let m: number[] = [];

const toLabel = (sx: number, sy: number, ex: number, ey: number): string =>
  `${Math.round(Math.hypot(ex - sx, ey - sy))} px`;

const snapAxis = (
  anchorX: number,
  anchorY: number,
  x: number,
  y: number,
  forceAxis = false,
): [number, number] => {
  const dx = x - anchorX;
  const dy = y - anchorY;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  if (forceAxis) {
    // Shift 模式:强制约束到主方向(偏移量更大的那一轴)。
    return absDx >= absDy ? [x, anchorY] : [anchorX, y];
  }

  const nearVertical = absDx <= MEASURE_SNAP_THRESHOLD;
  const nearHorizontal = absDy <= MEASURE_SNAP_THRESHOLD;

  if (nearVertical && nearHorizontal) {
    // 两轴都接近时优先吸附偏移更小的那一轴，避免突然吸到起点。
    return absDx <= absDy ? [anchorX, y] : [x, anchorY];
  }
  if (nearVertical) return [anchorX, y];
  if (nearHorizontal) return [x, anchorY];
  return [x, y];
};

const measure: GraphPlugin = {
  type: 'measure',
  down([x, y]) {
    const { config = {} } = this.ctx;
    const path: MeasurePath = {
      type: 'measure',
      sx: x,
      sy: y,
      ex: x,
      ey: y,
      stroke: config.stroke || DEFAULT_GRAPH_COLOR,
      strokeWidth: config.strokeWidth || 2,
      fontSize: config.fontSize || 12,
      label: '0 px',
    };
    return [path];
  },
  move([x, y]) {
    const { path, start } = this.ctx;
    const p = path as MeasurePath;
    const [sx, sy] = start as number[];
    const [snappedX, snappedY] = snapAxis(sx, sy, x, y, !!this.ctx.shiftKey);
    p.sx = sx;
    p.sy = sy;
    p.ex = snappedX;
    p.ey = snappedY;
    p.label = toLabel(sx, sy, snappedX, snappedY);
    return [
      p,
      [
        { id: 'S', x: sx, y: sy },
        { id: 'E', x: snappedX, y: snappedY },
      ],
    ];
  },
  selected() {
    const p = this.ctx.path as MeasurePath;
    m = [p.sx, p.sy, p.ex, p.ey];
    return [
      undefined,
      [
        { id: 'S', x: p.sx, y: p.sy },
        { id: 'E', x: p.ex, y: p.ey },
      ],
    ];
  },
  dotDown() {
    // no-op: keep endpoint manipulation in adjust
  },
  restyle(path, patch) {
    const p = path as MeasurePath;
    return Object.assign({}, p, patch, {
      label: toLabel(p.sx, p.sy, p.ex, p.ey),
    });
  },
  translate(path, dx, dy) {
    const p = path as MeasurePath;
    const next = Object.assign({}, p, {
      sx: p.sx + dx,
      sy: p.sy + dy,
      ex: p.ex + dx,
      ey: p.ey + dy,
    });
    next.label = toLabel(next.sx, next.sy, next.ex, next.ey);
    return next;
  },
  adjust([x, y]) {
    const { path, dots, target, start } = this.ctx;
    const p = path as MeasurePath;

    if (!target) {
      const [msx, msy, mex, mey] = m;
      const [stx, sty] = start || [x, y];
      const dx = x - stx;
      const dy = y - sty;
      p.sx = msx + dx;
      p.sy = msy + dy;
      p.ex = mex + dx;
      p.ey = mey + dy;
      p.label = toLabel(p.sx, p.sy, p.ex, p.ey);
      return [
        p,
        [
          { id: 'S', x: p.sx, y: p.sy },
          { id: 'E', x: p.ex, y: p.ey },
        ],
      ];
    }

    const nextDots = dots ? [...dots] : [];
    if (target === 'S') {
      const [snappedX, snappedY] = snapAxis(p.ex, p.ey, x, y, !!this.ctx.shiftKey);
      p.sx = snappedX;
      p.sy = snappedY;
      nextDots[0] = { id: 'S', x: snappedX, y: snappedY };
    } else if (target === 'E') {
      const [snappedX, snappedY] = snapAxis(p.sx, p.sy, x, y, !!this.ctx.shiftKey);
      p.ex = snappedX;
      p.ey = snappedY;
      nextDots[1] = { id: 'E', x: snappedX, y: snappedY };
    }
    p.label = toLabel(p.sx, p.sy, p.ex, p.ey);
    return [p, nextDots];
  },
  up() {
    m = [];
  },
};

export default measure;
