/**
 * 马赛克(基础版本:遮罩块)
 */
import type { GraphPlugin, MosaicPath } from '../types';

import { DEFAULT_MOSAIC_COLOR, clampMosaicSize, clampMosaicSoftness } from '../const';
import { createDots, sort, sortCoo } from '../utils';

let t: number[] = [];
let m: number[] = [];

const mosaic: GraphPlugin = {
  type: 'mosaic',
  down([x, y]) {
    const { config = {} } = this.ctx;
    const path: MosaicPath = {
      type: 'mosaic',
      x,
      y,
      w: 0,
      h: 0,
      fill: config.fill || DEFAULT_MOSAIC_COLOR,
      opacity: 0.36,
      mosaicSize: clampMosaicSize(config.mosaicSize),
      mosaicSoftness: clampMosaicSoftness(config.mosaicSoftness),
    };
    return [path];
  },
  move([x, y]) {
    const { path, start } = this.ctx;
    const p = path as MosaicPath;
    const {
      start: [sx, sy],
      end: [ex, ey],
    } = sortCoo(start as number[], [x, y]);
    p.x = sx;
    p.y = sy;
    p.w = ex - sx;
    p.h = ey - sy;
    return [p, createDots([sx, sy], [ex, ey])];
  },
  selected() {
    const { x, y, w, h } = this.ctx.path as MosaicPath;
    m = [x, y];
    return [undefined, createDots([x, y], [x + w, y + h])];
  },
  restyle(path, patch) {
    const next = Object.assign({}, path, patch) as MosaicPath;
    if (patch.mosaicSize !== undefined) {
      next.mosaicSize = clampMosaicSize(patch.mosaicSize);
    }
    if (patch.mosaicSoftness !== undefined) {
      next.mosaicSoftness = clampMosaicSoftness(patch.mosaicSoftness);
    }
    return next;
  },
  translate(path, dx, dy) {
    const p = path as MosaicPath;
    return Object.assign({}, p, { x: p.x + dx, y: p.y + dy });
  },
  dotDown() {
    const { x, y, w, h } = this.ctx.path as MosaicPath;
    t = [x, y, x + w, y + h];
  },
  adjust([clientX, clientY]) {
    const { target, path, start } = this.ctx;
    const p = path as MosaicPath;
    if (!target) {
      const [mx, my] = m;
      const [sx, sy] = start || [clientX, clientY];
      p.x = mx + (clientX - sx);
      p.y = my + (clientY - sy);
      return [p, createDots([p.x, p.y], [p.x + p.w, p.y + p.h])];
    }

    const { x, y, w, h } = p;
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

    p.x = sx;
    p.y = sy;
    p.w = ex - sx;
    p.h = ey - sy;
    return [p, createDots([sx, sy], [ex, ey])];
  },
  up() {
    t = [];
    m = [];
  },
};

export default mosaic;
