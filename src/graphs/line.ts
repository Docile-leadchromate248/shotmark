/**
 * 直线
 */
import type { GraphPlugin, SvgPath } from '../types';

/** 从 path.d 解析两端点 [sx, sy, ex, ey] */
const coordinate = (d: string): string[] => {
  const [sx, sy] = d.match(/[^M)]+?(?=,)/g)![0].split(' ');
  const [ex, ey] = d.match(/[^L)]+$/g)![0].split(' ');
  return [sx, sy, ex, ey];
};

/** 选中本体整体平移基准(两端点) */
let m: number[] = [];

const line: GraphPlugin = {
  type: 'line',
  down([x, y]) {
    const { config = {} } = this.ctx;
    const path: SvgPath = {
      type: 'path',
      d: `M${x} ${y},`,
      stroke: config.stroke,
      strokeWidth: config.strokeWidth,
    };
    return [path];
  },
  move([x, y]) {
    const path = this.ctx.path as SvgPath;
    const [sx, sy] = coordinate(path.d);
    const dots = [
      { id: 'M' as const, x: Number(sx), y: Number(sy) },
      { id: 'L' as const, x, y },
    ];
    path.d = `M${sx} ${sy},L${x} ${y}`;
    return [path, dots];
  },
  selected() {
    const path = this.ctx.path as SvgPath;
    const [sx, sy, ex, ey] = coordinate(path.d);
    m = [Number(sx), Number(sy), Number(ex), Number(ey)];
    return [
      undefined,
      [
        { id: 'M', x: Number(sx), y: Number(sy) },
        { id: 'L', x: Number(ex), y: Number(ey) },
      ],
    ];
  },
  restyle(path, patch) {
    return Object.assign({}, path, patch);
  },
  // 必须存在:否则 dotDown[type] 取不到 → 调整流程被跳过
  dotDown() {},
  translate(path, dx, dy) {
    const seg = path as SvgPath;
    const [sx, sy, ex, ey] = coordinate(seg.d).map(Number);
    return Object.assign({}, seg, {
      d: `M${sx + dx} ${sy + dy},L${ex + dx} ${ey + dy}`,
    });
  },
  adjust([x, y]) {
    const { path, dots, target, start } = this.ctx;
    const seg = path as SvgPath;
    const [sx, sy, ex, ey] = coordinate(seg.d);

    // 无 target = 选中本体拖拽 → 整体平移(两端点同时移动)
    if (!target) {
      const [msx, msy, mex, mey] = m;
      const [stx, sty] = start || [x, y];
      const dx = x - stx;
      const dy = y - sty;
      const nsx = msx + dx;
      const nsy = msy + dy;
      const nex = mex + dx;
      const ney = mey + dy;
      seg.d = `M${nsx} ${nsy},L${nex} ${ney}`;
      return [
        seg,
        [
          { id: 'M', x: nsx, y: nsy },
          { id: 'L', x: nex, y: ney },
        ],
      ];
    }

    const nextDots = dots ? [...dots] : [];
    if (target === 'M') {
      seg.d = `M${x} ${y},L${ex} ${ey}`;
      nextDots[0] = { id: 'M', x, y };
    } else if (target === 'L') {
      seg.d = `M${sx} ${sy},L${x} ${y}`;
      nextDots[1] = { id: 'L', x, y };
    }
    return [seg, nextDots];
  },
  up() {
    m = [];
  },
};

export default line;
