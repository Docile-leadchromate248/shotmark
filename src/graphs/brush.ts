/**
 * 自由画笔(波浪线)
 */
import type { GraphPlugin, SvgPath } from '../types';

/** 选中本体整体平移基准(累计 transform 偏移) */
let tx = 0;
let ty = 0;

/** 从 transform="translate(a, b)" 解析偏移 */
const parseTranslate = (transform?: string): [number, number] => {
  const matched = (transform || '').match(/[^translate()]+(?=\))/g);
  if (matched && matched.length) {
    const [a, b] = matched[0].split(', ').map(Number);
    return [a, b];
  }
  return [0, 0];
};

const brush: GraphPlugin = {
  type: 'brush',
  down([x, y]) {
    const { config = {} } = this.ctx;
    const path: SvgPath = {
      type: 'path',
      d: `M${x} ${y}`,
      stroke: config.stroke,
      strokeWidth: config.strokeWidth,
    };
    return [path];
  },
  move([x, y]) {
    const path = this.ctx.path as SvgPath;
    path.d = `${path.d},L${x} ${y}`;
    return [path];
  },
  selected() {
    const path = this.ctx.path as SvgPath;
    [tx, ty] = parseTranslate(path.transform);
  },
  restyle(path, patch) {
    return Object.assign({}, path, patch);
  },
  // 在现有 transform 上叠加平移,保证画笔线页面位置不变
  translate(path, dx, dy) {
    const p = path as SvgPath;
    const [cx, cy] = parseTranslate(p.transform);
    return Object.assign({}, p, { transform: `translate(${cx + dx}, ${cy + dy})` });
  },
  adjust([x, y]) {
    const { path, start } = this.ctx;
    const p = path as SvgPath;
    const [sx, sy] = start as number[];
    p.transform = `translate(${tx + (x - sx)}, ${ty + (y - sy)})`;
    return [p];
  },
  up() {
    tx = 0;
    ty = 0;
  },
};

export default brush;
