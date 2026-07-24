/**
 * 箭头(头宽尾窄的锥形实心箭头)
 *
 * 整支箭头是一个闭合多边形 path,fill 同色填充:尾窄 → 颈宽 → 头三角 → 头尖。
 * 粗细(config.strokeWidth)作为整体尺度系数,存在 path._w(strokeWidth 恒为 1)。
 * 端点存 path.sx/sy/ex/ey,供 selected/adjust 复用。
 */
import type { Dot, GraphPlugin, SvgPath } from '../types';

/** 由两端点 + 粗细系数生成闭合锥形箭头的 path d */
const buildArrow = (sx: number, sy: number, ex: number, ey: number, w: number): string => {
  const dx = ex - sx;
  const dy = ey - sy;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  // 单位主轴向量与法向量
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;

  // 各部位尺寸(随粗细缩放,对极短箭头做长度兜底);锥度加大区别于等宽直线箭头
  const tailHalf = Math.max(w * 0.18, 0.6); // 尾部半宽(细尖)
  const neckHalf = Math.max(w * 1.05, 1.8); // 颈部半宽(箭身渐宽)
  const headHalf = Math.max(w * 2.8, 7); // 头部三角半宽
  const headLen = Math.min(Math.max(w * 4.2, 14), len * 0.92); // 头部长度(不超过箭身)

  // 颈点(箭身与头部三角交界)
  const nxp = ex - ux * headLen;
  const nyp = ey - uy * headLen;

  const p = (px: number, py: number): string => `${px.toFixed(2)} ${py.toFixed(2)}`;
  const tailL = p(sx + nx * tailHalf, sy + ny * tailHalf);
  const neckL = p(nxp + nx * neckHalf, nyp + ny * neckHalf);
  const wingL = p(nxp + nx * headHalf, nyp + ny * headHalf);
  const tip = p(ex, ey);
  const wingR = p(nxp - nx * headHalf, nyp - ny * headHalf);
  const neckR = p(nxp - nx * neckHalf, nyp - ny * neckHalf);
  const tailR = p(sx - nx * tailHalf, sy - ny * tailHalf);

  return `M${tailL} L${neckL} L${wingL} L${tip} L${wingR} L${neckR} L${tailR} Z`;
};

/** 选中本体整体平移的基准 [sx, sy, ex, ey] */
let m: number[] = [];

const arrow: GraphPlugin = {
  type: 'arrow',
  down([x, y]) {
    const { config = {} } = this.ctx;
    const color = config.stroke || 'red';
    const w = config.strokeWidth || 2;
    const path: SvgPath = {
      type: 'path',
      fill: color,
      stroke: color,
      strokeWidth: 1,
      _w: w,
      sx: x,
      sy: y,
      ex: x,
      ey: y,
      d: `M${x} ${y}`,
    };
    return [path];
  },
  move([x, y]) {
    const { start, path } = this.ctx;
    const arr = path as SvgPath;
    const [sx, sy] = start as number[];
    let dots: Dot[] = [];
    if (sx !== x || sy !== y) {
      arr.sx = sx;
      arr.sy = sy;
      arr.ex = x;
      arr.ey = y;
      arr.d = buildArrow(sx, sy, x, y, arr._w || 2);
      dots = [
        { id: 'S', x: sx, y: sy },
        { id: 'E', x, y },
      ];
    }
    return [arr, dots];
  },
  selected() {
    const arr = this.ctx.path as SvgPath;
    m = [arr.sx!, arr.sy!, arr.ex!, arr.ey!];
    return [
      undefined,
      [
        { id: 'S', x: arr.sx!, y: arr.sy! },
        { id: 'E', x: arr.ex!, y: arr.ey! },
      ],
    ];
  },
  // 必须存在(即便空):否则 draw-board 的 dotDown[type] 取不到 → 整个调整流程被跳过
  dotDown() {},
  restyle(path, patch) {
    const next = Object.assign({}, path) as SvgPath;
    if (patch.stroke !== undefined) {
      next.fill = patch.stroke;
      next.stroke = patch.stroke;
    }
    if (patch.strokeWidth !== undefined) {
      next._w = patch.strokeWidth;
    }
    next.d = buildArrow(next.sx!, next.sy!, next.ex!, next.ey!, next._w || 2);
    return next;
  },
  translate(path, dx, dy) {
    const arr = path as SvgPath;
    const next = Object.assign({}, arr, {
      sx: arr.sx! + dx,
      sy: arr.sy! + dy,
      ex: arr.ex! + dx,
      ey: arr.ey! + dy,
    });
    next.d = buildArrow(next.sx!, next.sy!, next.ex!, next.ey!, next._w || 2);
    return next;
  },
  adjust([x, y]) {
    const { path, dots, target, start } = this.ctx;
    const arr = path as SvgPath;
    const w = arr._w || 2;

    // 无 target = 选中本体拖拽 → 整体平移(两端点同时移动)
    if (!target) {
      const [msx, msy, mex, mey] = m;
      const [sx, sy] = start || [x, y];
      const dx = x - sx;
      const dy = y - sy;
      arr.sx = msx + dx;
      arr.sy = msy + dy;
      arr.ex = mex + dx;
      arr.ey = mey + dy;
      arr.d = buildArrow(arr.sx, arr.sy, arr.ex, arr.ey, w);
      return [
        arr,
        [
          { id: 'S', x: arr.sx, y: arr.sy },
          { id: 'E', x: arr.ex, y: arr.ey },
        ],
      ];
    }

    const nextDots = dots ? [...dots] : [];
    if (target === 'S') {
      arr.sx = x;
      arr.sy = y;
      nextDots[0] = { id: 'S', x, y };
    } else if (target === 'E') {
      arr.ex = x;
      arr.ey = y;
      nextDots[1] = { id: 'E', x, y };
    }
    arr.d = buildArrow(arr.sx!, arr.sy!, arr.ex!, arr.ey!, w);
    return [arr, nextDots];
  },
  up() {
    m = [];
  },
};

export default arrow;
