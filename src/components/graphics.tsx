/**
 * SVG 图形渲染:把 graph 数据数组渲染为对应的 svg 元素 + 8 个调整点圆点。
 */
import React from 'react';

import type {
  Dot,
  GraphPath,
  MeasurePath,
  MosaicPath,
  NumberPath,
  RectPath,
  TextPath,
} from '../types';

import {
  DEFAULT_HIGHLIGHT_COLOR,
  DEFAULT_TEXT_COLOR,
  DOT_CURSOR,
  SVG_NS,
  TEXT_LINE_HEIGHT,
  TEXT_PAD,
  clampMosaicSize,
} from '../const';

/** 图形本体 hover 用 grab(可抓取);拖动时由上层切 grabbing */
const BODY_CURSOR = 'grab';

interface GraphicsProps {
  /** 待渲染的图形数据数组 */
  graph: GraphPath[];
  /** 当前选中图形的 8 方位调整点 */
  dots: Dot[];
  /** true=调整态,false=绘制态(影响根 svg 的光标类) */
  isAdjust?: boolean;
  /** 拖拽进行中锁定的光标 */
  dragCursor?: string;
  /** svg 鼠标按下(绘制/选中/拖调整点入口) */
  onMouseDown?: (ev: React.MouseEvent<SVGSVGElement>) => void;
  /** svg 双击(文字二次编辑入口) */
  onDoubleClick?: (ev: React.MouseEvent<SVGSVGElement>) => void;
  /** 是否启用实时像素马赛克预览(启用后 mosaic 仅渲染命中框) */
  mosaicPreviewEnabled?: boolean;
  /** 当前选中的图形 id */
  selectedId?: string | null;
  /** 当前正在绘制中的图形 id */
  drawingGraphId?: string | null;
  /** 当前工具类型 */
  activeToolType?: string;
  /** hover 到边缘的马赛克 id */
  hoveredMosaicId?: string | null;
  /** 马赛克边缘 hover 回调 */
  onMosaicEdgeHover?: (id: string | null) => void;
}

/** 渲染单个图形 */
function renderGraph(
  data: GraphPath,
  mosaicPreviewEnabled?: boolean,
  selectedId?: string | null,
  drawingGraphId?: string | null,
  hoveredMosaicId?: string | null,
  activeToolType?: string,
  onMosaicEdgeHover?: (id: string | null) => void,
): React.ReactNode {
  switch (data.type) {
    case 'path':
      return (
        <path
          id={data.id}
          key={data.id}
          stroke={data.stroke || 'var(--shotmark-graph-default)'}
          strokeWidth={data.strokeWidth || 3}
          strokeLinejoin={data.strokeLinejoin || 'round'}
          d={data.d}
          fill={data.fill || 'none'}
          transform={data.transform}
          style={{ cursor: BODY_CURSOR }}
        />
      );
    case 'rect':
      return renderRect(data, activeToolType);
    case 'ellipse':
      return (
        <ellipse
          id={data.id}
          key={data.id}
          fill={data.fill || 'none'}
          stroke={data.stroke || 'var(--shotmark-graph-default)'}
          strokeWidth={data.strokeWidth || 3}
          cx={data.cx}
          cy={data.cy}
          rx={data.rx}
          ry={data.ry}
          style={{ cursor: BODY_CURSOR }}
        />
      );
    case 'text':
      return renderText(data);
    case 'mosaic':
      return renderMosaic(
        data,
        mosaicPreviewEnabled,
        data.id === selectedId || data.id === drawingGraphId,
        data.id === hoveredMosaicId,
        activeToolType,
        onMosaicEdgeHover,
      );
    case 'number':
      return renderNumber(data);
    case 'measure':
      return renderMeasure(data);
    default:
      return null;
  }
}

function renderRect(data: RectPath, activeToolType?: string): React.ReactNode {
  if (data.isHighlight) {
    const fill = data.fill || DEFAULT_HIGHLIGHT_COLOR;
    const opacity = data.opacity ?? 0.28;
    const cursor =
      activeToolType === 'highlight'
        ? BODY_CURSOR
        : activeToolType === 'text'
          ? 'text'
          : 'crosshair';
    return (
      <rect
        id={data.id}
        key={data.id}
        x={data.x}
        y={data.y}
        width={data.w}
        height={data.h}
        fill={fill}
        fillOpacity={opacity}
        stroke="transparent"
        strokeWidth={0}
        style={{ cursor, pointerEvents: 'all' }}
      />
    );
  }

  return (
    <rect
      id={data.id}
      key={data.id}
      stroke={data.stroke || 'var(--shotmark-graph-default)'}
      strokeWidth={data.strokeWidth || 2}
      x={data.x}
      y={data.y}
      width={data.w}
      height={data.h}
      fillOpacity="0"
      style={{ cursor: BODY_CURSOR }}
    />
  );
}

/** 边缘检测阈值(px):鼠标距离马赛克边缘多近时触发 hover */
const MOSAIC_EDGE_THRESHOLD = 12;

/** 渲染马赛克块(基础版本:半透明遮罩 + 网格感) */
function renderMosaic(
  data: MosaicPath,
  mosaicPreviewEnabled?: boolean,
  selected?: boolean,
  hovered?: boolean,
  activeToolType?: string,
  onMosaicEdgeHover?: (id: string | null) => void,
): React.ReactNode {
  const isMosaicTool = activeToolType === 'mosaic';

  const handleMouseMove =
    isMosaicTool && !selected
      ? (ev: React.MouseEvent) => {
          const { x, y, w, h } = data;
          const svgEl = (ev.target as SVGElement).ownerSVGElement;
          if (!svgEl) return;
          const rect = svgEl.getBoundingClientRect();
          const mx = ev.clientX - rect.left;
          const my = ev.clientY - rect.top;
          // 判断是否在边缘区域(距离四边 MOSAIC_EDGE_THRESHOLD 以内)
          const nearLeft = Math.abs(mx - x) <= MOSAIC_EDGE_THRESHOLD;
          const nearRight = Math.abs(mx - (x + w)) <= MOSAIC_EDGE_THRESHOLD;
          const nearTop = Math.abs(my - y) <= MOSAIC_EDGE_THRESHOLD;
          const nearBottom = Math.abs(my - (y + h)) <= MOSAIC_EDGE_THRESHOLD;
          const inVertRange =
            my >= y - MOSAIC_EDGE_THRESHOLD && my <= y + h + MOSAIC_EDGE_THRESHOLD;
          const inHorizRange =
            mx >= x - MOSAIC_EDGE_THRESHOLD && mx <= x + w + MOSAIC_EDGE_THRESHOLD;
          const isOnEdge =
            (nearLeft && inVertRange) ||
            (nearRight && inVertRange) ||
            (nearTop && inHorizRange) ||
            (nearBottom && inHorizRange);
          onMosaicEdgeHover?.(isOnEdge ? data.id! : null);
        }
      : undefined;

  const handleMouseLeave = isMosaicTool && !selected ? () => onMosaicEdgeHover?.(null) : undefined;

  if (mosaicPreviewEnabled) {
    // 是否处于可交互态(选中或 hover 边缘):此时整个区域可交互
    const interactive = selected || (hovered && isMosaicTool);
    return (
      <g id={data.id} key={data.id}>
        {/* 边缘环命中区:只有边框附近有碰撞面积,内部完全穿透(可在内部绘制新马赛克) */}
        {isMosaicTool && !interactive && (
          <rect
            id={data.id}
            x={data.x}
            y={data.y}
            width={data.w}
            height={data.h}
            fill="none"
            stroke="transparent"
            strokeWidth={MOSAIC_EDGE_THRESHOLD * 2}
            style={{ cursor: BODY_CURSOR, pointerEvents: 'stroke' }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          />
        )}
        {/* 选中/hover 态:整个区域可拖拽移动 */}
        {interactive && (
          <rect
            id={data.id}
            x={data.x}
            y={data.y}
            width={data.w}
            height={data.h}
            fill="transparent"
            stroke="transparent"
            strokeWidth={MOSAIC_EDGE_THRESHOLD * 2}
            style={{ cursor: BODY_CURSOR, pointerEvents: 'all' }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          />
        )}
        {/* 选中框(虚线)不在此渲染:统一移到顶层(图形之上、瞄点之下),
            避免被后绘制的高亮/矩形等非马赛克图形遮盖(见 Graphics 的顶层帧层) */}
      </g>
    );
  }

  const patternId = `shotmark-mosaic-pattern-${data.id || `${data.x}-${data.y}`}`;
  const fill = data.fill || 'var(--shotmark-graph-default)';
  const opacity = data.opacity ?? 0.36;
  const size = clampMosaicSize(data.mosaicSize);
  const unit = Math.max(2, Math.floor(size / 2));
  const patternSize = unit * 2;
  return (
    <g id={data.id} key={data.id} style={{ cursor: BODY_CURSOR }}>
      <defs>
        <pattern
          id={patternId}
          width={patternSize}
          height={patternSize}
          patternUnits="userSpaceOnUse"
        >
          <rect x="0" y="0" width={unit} height={unit} fill="rgba(255,255,255,0.46)" />
          <rect x={unit} y={unit} width={unit} height={unit} fill="rgba(255,255,255,0.46)" />
        </pattern>
      </defs>
      <rect
        id={data.id}
        x={data.x}
        y={data.y}
        width={data.w}
        height={data.h}
        fill={fill}
        fillOpacity={Math.min(0.34, opacity)}
        stroke={fill}
        strokeOpacity={0.42}
        strokeWidth={1}
      />
      <rect
        id={data.id}
        x={data.x}
        y={data.y}
        width={data.w}
        height={data.h}
        fill={`url(#${patternId})`}
        fillOpacity={0.78}
      />
    </g>
  );
}

/** 渲染文字(含透明命中框 + 多行 tspan) */
function renderText(data: TextPath): React.ReactNode {
  const fs = data.fontSize || 14;
  const tx = data.x + TEXT_PAD;
  const baseline = data.y + TEXT_PAD + fs * (TEXT_LINE_HEIGHT / 2 + 0.35);
  const lineH = fs * TEXT_LINE_HEIGHT;
  return (
    <g id={data.id} key={data.id}>
      <rect
        id={data.id}
        className="text-hit"
        x={data.x}
        y={data.y}
        width={data.w || 20}
        height={data.h || fs * TEXT_LINE_HEIGHT + TEXT_PAD * 2}
        fill="transparent"
        style={{ cursor: BODY_CURSOR }}
      />
      <text
        id={data.id}
        fill={data.fill || DEFAULT_TEXT_COLOR}
        x={tx}
        y={baseline}
        style={{ fontSize: `${fs}px`, userSelect: 'none', cursor: BODY_CURSOR }}
      >
        {data.content.map((txt, i) => (
          <tspan id={data.id} x={tx} y={baseline + i * lineH} key={i}>
            {txt}
          </tspan>
        ))}
      </text>
    </g>
  );
}

/** 渲染序号标注 */
function renderNumber(data: NumberPath): React.ReactNode {
  const radius = data.radius ?? 12;
  const fill = data.fill || 'var(--shotmark-graph-default)';
  const textColor = data.textColor || '#ffffff';
  const fontSize = data.fontSize || 13;
  return (
    <g id={data.id} key={data.id} style={{ cursor: BODY_CURSOR }}>
      <circle id={data.id} cx={data.x} cy={data.y} r={radius} fill={fill} />
      <text
        id={data.id}
        x={data.x}
        y={data.y}
        textAnchor="middle"
        dominantBaseline="central"
        fill={textColor}
        style={{
          fontSize: `${fontSize}px`,
          userSelect: 'none',
          cursor: BODY_CURSOR,
          fontWeight: 600,
        }}
      >
        {data.value}
      </text>
    </g>
  );
}

/** 渲染尺寸标注 */
function renderMeasure(data: MeasurePath): React.ReactNode {
  const stroke = data.stroke || 'var(--shotmark-graph-default)';
  const strokeWidth = data.strokeWidth || 2;
  const dx = data.ex - data.sx;
  const dy = data.ey - data.sy;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const midX = (data.sx + data.ex) / 2;
  const midY = (data.sy + data.ey) / 2;
  const text = data.label || '0 px';

  // ── 缩小 40% 的标签尺寸 ──
  const baseFontSize = 8;
  const padX = 5;
  const padY = 3;
  const tagW = Math.max(32, text.length * (baseFontSize * 0.62) + padX * 2);
  const tagH = baseFontSize + padY * 2;

  // compact 阈值：标签沿线段方向的投影 + 安全间距。
  // 斜线额外加大阈值——斜线上 inline 标签视觉上更拥挤,compact 更清爽。
  const labelProjection = Math.abs(ux) * tagW + Math.abs(uy) * tagH;
  const diagonalFactor = Math.min(Math.abs(ux), Math.abs(uy)); // 0=轴对齐, ~0.707=45度
  const compactThreshold = Math.max(28, labelProjection + 16 + diagonalFactor * 60);
  const useCompactLayout = len <= compactThreshold;

  const fontSize = useCompactLayout ? Math.max(7, baseFontSize - 1) : baseFontSize;
  const compactTagW = Math.max(28, text.length * (fontSize * 0.62) + padX * 2);
  const compactTagH = fontSize + padY * 2;
  const finalTagW = useCompactLayout ? compactTagW : tagW;
  const finalTagH = useCompactLayout ? compactTagH : tagH;

  let labelCx = midX;
  let labelCy = midY;

  if (useCompactLayout) {
    // 法线方向两个候选
    const normalA = { x: -uy, y: ux };
    const normalB = { x: uy, y: -ux };

    // 评分：选择空间更充裕、阅读更自然的一侧
    const score = (n: { x: number; y: number }): number => {
      const testOffset = finalTagH / 2 + 8;
      const testCx = midX + n.x * testOffset;
      const testCy = midY + n.y * testOffset;
      const marginLeft = testCx - finalTagW / 2;
      const marginTop = testCy - finalTagH / 2;
      const marginRight = 9999 - (testCx + finalTagW / 2);
      const marginBottom = 9999 - (testCy + finalTagH / 2);
      const minMargin = Math.min(marginLeft, marginTop, marginRight, marginBottom);
      // 水平线优先往上; 垂直线优先往右; 斜线综合评分
      const dirBias = -n.y * 0.5 + n.x * 0.3;
      return minMargin + dirBias * 10;
    };
    const normal = score(normalA) >= score(normalB) ? normalA : normalB;
    const normalLen = Math.hypot(normal.x, normal.y) || 1;
    const compactNx = normal.x / normalLen;
    const compactNy = normal.y / normalLen;

    // 偏移：标签中心到线段中点的距离
    const compactOffset = finalTagH / 2 + 8;
    labelCx = midX + compactNx * compactOffset;
    labelCy = midY + compactNy * compactOffset;
  }

  const tagX = labelCx - finalTagW / 2;
  const tagY = labelCy - finalTagH / 2;

  // 中置分段：标签在线段中间时,线段分成两段留出标签空白
  const labelHalfAlongAxis = (Math.abs(ux) * finalTagW + Math.abs(uy) * finalTagH) / 2;
  const maxGapHalf = Math.max(len / 2 - 8, 0);
  const gapHalf =
    useCompactLayout || maxGapHalf <= 0 ? 0 : Math.min(labelHalfAlongAxis + 4, maxGapHalf);
  const leftStopX = midX - ux * gapHalf;
  const leftStopY = midY - uy * gapHalf;
  const rightStartX = midX + ux * gapHalf;
  const rightStartY = midY + uy * gapHalf;

  const endpointRadius = 2.5;

  // ── 引导线：从测量线中点 → 标签最近边缘中心 ──
  let leaderStartX = midX;
  let leaderStartY = midY;
  let leaderEndX = midX;
  let leaderEndY = midY;

  if (useCompactLayout) {
    leaderStartX = midX;
    leaderStartY = midY;
    // 计算标签 rect 四条边中心,选离 midX/midY 最近的
    const edgeCenters = [
      { x: labelCx, y: tagY }, // top edge center
      { x: labelCx, y: tagY + finalTagH }, // bottom edge center
      { x: tagX, y: labelCy }, // left edge center
      { x: tagX + finalTagW, y: labelCy }, // right edge center
    ];
    let minDist = Infinity;
    for (const ec of edgeCenters) {
      const d = Math.hypot(ec.x - midX, ec.y - midY);
      if (d < minDist) {
        minDist = d;
        leaderEndX = ec.x;
        leaderEndY = ec.y;
      }
    }
  }

  return (
    <g id={data.id} key={data.id} style={{ cursor: BODY_CURSOR }}>
      {gapHalf > 0 && (
        <>
          <line
            id={data.id}
            x1={data.sx}
            y1={data.sy}
            x2={leftStopX}
            y2={leftStopY}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <line
            id={data.id}
            x1={rightStartX}
            y1={rightStartY}
            x2={data.ex}
            y2={data.ey}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        </>
      )}
      {!gapHalf && (
        <line
          id={data.id}
          x1={data.sx}
          y1={data.sy}
          x2={data.ex}
          y2={data.ey}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
      )}
      {useCompactLayout && (
        <line
          id={data.id}
          x1={leaderStartX}
          y1={leaderStartY}
          x2={leaderEndX}
          y2={leaderEndY}
          stroke={stroke}
          strokeWidth={Math.max(0.8, strokeWidth - 0.8)}
          strokeLinecap="round"
          strokeDasharray="2 1.5"
        />
      )}
      <circle
        id={data.id}
        cx={data.sx}
        cy={data.sy}
        r={endpointRadius}
        fill="#FFFFFF"
        stroke={stroke}
        strokeWidth={1.5}
      />
      <circle
        id={data.id}
        cx={data.ex}
        cy={data.ey}
        r={endpointRadius}
        fill="#FFFFFF"
        stroke={stroke}
        strokeWidth={1.5}
      />
      <rect
        id={data.id}
        x={tagX}
        y={tagY}
        rx={4}
        ry={4}
        width={finalTagW}
        height={finalTagH}
        fill="#FFFFFF"
        stroke={stroke}
        strokeWidth={0.8}
        style={{ filter: 'drop-shadow(0 1px 3px rgba(16, 24, 40, 0.1))' }}
      />
      <text
        id={data.id}
        x={labelCx}
        y={labelCy}
        textAnchor="middle"
        dominantBaseline="central"
        fill={stroke}
        style={{
          fontSize: `${fontSize}px`,
          userSelect: 'none',
          cursor: BODY_CURSOR,
          fontWeight: 600,
        }}
      >
        {text}
      </text>
    </g>
  );
}

/** SVG 画布:绘制全部图形 + 调整点 */
function Graphics({
  graph,
  dots,
  onMouseDown,
  onDoubleClick,
  dragCursor,
  mosaicPreviewEnabled,
  selectedId,
  drawingGraphId,
  activeToolType,
  hoveredMosaicId,
  onMosaicEdgeHover,
}: GraphicsProps): React.ReactElement {
  return (
    <svg
      className={`graphics-draw ${dragCursor ? 'dragging' : 'drawing'}`}
      version="1.1"
      width="100%"
      height="100%"
      xmlns={SVG_NS}
      style={dragCursor ? { cursor: dragCursor, position: 'relative' } : { position: 'relative' }}
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      onDragStart={(ev) => ev.preventDefault()}
    >
      {/* 马赛克始终先渲染(SVG 中先绘制 = 底层),确保箭头/矩形等标注不被遮挡 */}
      {graph
        .filter((item) => item.type === 'mosaic')
        .map((item) =>
          renderGraph(
            item,
            mosaicPreviewEnabled,
            selectedId,
            drawingGraphId,
            hoveredMosaicId,
            activeToolType,
            onMosaicEdgeHover,
          ),
        )}
      {graph
        .filter((item) => item.type !== 'mosaic')
        .map((item) =>
          renderGraph(
            item,
            mosaicPreviewEnabled,
            selectedId,
            drawingGraphId,
            hoveredMosaicId,
            activeToolType,
            onMosaicEdgeHover,
          ),
        )}
      {/* 马赛克选中/hover 虚线框:顶层渲染(图形之上、瞄点之下),避免被非马赛克图形遮盖 */}
      {mosaicPreviewEnabled &&
        graph
          .filter((item): item is MosaicPath => item.type === 'mosaic')
          .map((item) => {
            const showFrame =
              item.id === selectedId ||
              item.id === drawingGraphId ||
              (item.id === hoveredMosaicId && activeToolType === 'mosaic');
            if (!showFrame) return null;
            return (
              <rect
                key={`mosaic-frame-${item.id}`}
                className="mosaic-selection-frame"
                x={item.x}
                y={item.y}
                width={item.w}
                height={item.h}
                rx={2}
                ry={2}
                fill="none"
                stroke="var(--shotmark-mosaic-selection-stroke)"
                strokeWidth={1.5}
                strokeDasharray="7 5"
                style={{ pointerEvents: 'none' }}
              />
            );
          })}
      {dots.map((dot) => {
        const targetType = (dot.target || '').split('-')[0];
        const isMosaicDot = targetType === 'mosaic';
        const isHighlightDot = targetType === 'highlight';
        const isMeasureDot = targetType === 'measure';
        const radius = isMeasureDot ? 3.8 : isMosaicDot || isHighlightDot ? 4.1 : 4.4;
        const strokeWidth = isMeasureDot ? 2.2 : 2;
        return (
          <circle
            id={`adjust-${dot.id}`}
            className="draw-dot"
            fill="var(--shotmark-graph-dot-fill)"
            stroke="var(--shotmark-graph-dot-stroke)"
            strokeWidth={strokeWidth}
            r={radius}
            cx={dot.x}
            cy={dot.y}
            key={dot.id}
            style={{
              cursor: DOT_CURSOR[dot.id] || 'move',
              vectorEffect: 'non-scaling-stroke',
              paintOrder: 'stroke',
            }}
          />
        );
      })}
    </svg>
  );
}

export default Graphics;
