/**
 * 序号标注
 */
import type { GraphPlugin, NumberPath } from '../types';

import { DEFAULT_GRAPH_COLOR } from '../const';

let seed = 1;
let m: number[] = [];

const radiusByFontSize = (fontSize: number): number => Math.max(8, Math.round(fontSize * 0.9));

/** 新会话重置序号起点(默认 1) */
export const setNumberSeed = (start = 1): void => {
  seed = Number.isFinite(start) && start > 0 ? Math.floor(start) : 1;
};

const number: GraphPlugin = {
  type: 'number',
  down([x, y]) {
    const { config = {} } = this.ctx;
    const fontSize = config.fontSize || 13;
    const path: NumberPath = {
      type: 'number',
      x,
      y,
      value: seed,
      radius: radiusByFontSize(fontSize),
      fill: config.fill || DEFAULT_GRAPH_COLOR,
      fontSize,
      textColor: '#ffffff',
    };
    seed += 1;
    return [path];
  },
  selected() {
    const { x, y } = this.ctx.path as NumberPath;
    m = [x, y];
    return [undefined, []];
  },
  restyle(path, patch) {
    const p = path as NumberPath;
    const next = Object.assign({}, p, patch);
    if (patch.fontSize !== undefined) {
      next.radius = radiusByFontSize(patch.fontSize);
    }
    return next;
  },
  translate(path, dx, dy) {
    const p = path as NumberPath;
    return Object.assign({}, p, { x: p.x + dx, y: p.y + dy });
  },
  adjust([x, y]) {
    const { path, start } = this.ctx;
    const p = path as NumberPath;
    const [mx, my] = m;
    const [sx, sy] = start || [x, y];
    p.x = mx + (x - sx);
    p.y = my + (y - sy);
    return [p, []];
  },
  up() {
    m = [];
  },
};

export default number;
