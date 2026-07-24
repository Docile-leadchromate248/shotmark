/**
 * 截图框周围用于调整尺寸的 8 个拖拽点
 */
import React from 'react';

import { DOT_CURSOR, Z_OVERLAY } from '../const';
import { getCooByPos } from '../utils';

/** 位置校正:让圆点中心对齐边沿 */
const DOT_SIZE = 10;
const ADJUST = DOT_SIZE / 2;

interface ResizeDotProps {
  /** 选区四顶点 [sx, sy, ex, ey] */
  position: number[];
  /** 方位名,如 'top left' */
  local: string;
}

/** 单个调整点(button:name 承载方位,供 selection-layer 命中判定) */
function ResizeDot({ position, local }: ResizeDotProps): React.ReactElement {
  const { top, left } = getCooByPos(position, local);
  const style: React.CSSProperties = {
    position: 'absolute',
    top: top - ADJUST,
    left: left - ADJUST,
    cursor: DOT_CURSOR[local] || 'pointer',
    zIndex: Z_OVERLAY,
    display: 'block',
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: '50%',
    backgroundColor: '#ffffff',
    padding: 0,
    border: 'none',
    boxShadow: '0 0 0 2.5px #6fc3fe, 0 3px 10px rgba(16, 24, 40, 0.24)',
  };

  return <button type="button" name={local} style={style} />;
}

export default ResizeDot;
