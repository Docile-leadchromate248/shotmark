/**
 * 选区交互层:全屏 fixed 接收鼠标拖动,实现初次框选、拖动整个选区、拖 8 个调整点改尺寸。
 */
import React, { useEffect, useRef } from 'react';

import ResizeDot from './components/resize-dot';
import { DOT_CURSOR } from './const';
import { flushActiveText } from './graphs/text';
import { DOTS, sortCoo } from './utils';

/** 当前正在移动的目标:'touch'-框选 'view'-拖整框 方位名-拖调整点 */
let target = '';
let start: number[] = [];
const sort = (a: number, b: number): number => a - b;

interface SelectionLayerProps {
  step: number;
  pointer: number[];
  onMove: (start: number[], end: number[], step?: number) => void;
  onUp: (step?: number) => void;
}

function SelectionLayer({ step, onMove, onUp, pointer }: SelectionLayerProps): React.ReactElement {
  const dragRef = useRef<{ moving: ((e: MouseEvent) => void) | null; upping: (() => void) | null }>(
    {
      moving: null,
      upping: null,
    },
  );

  const detach = (): void => {
    const { moving, upping } = dragRef.current;
    if (moving) document.removeEventListener('mousemove', moving);
    if (upping) document.removeEventListener('mouseup', upping);
    dragRef.current.moving = null;
    dragRef.current.upping = null;
  };

  useEffect(
    () => () => {
      detach();
      document.body.style.cursor = '';
    },
    [],
  );

  const handleMove = (rawX: number, rawY: number): void => {
    const { innerWidth: iw, innerHeight: ih } = window;
    const clientX = Math.max(0, Math.min(rawX, iw));
    const clientY = Math.max(0, Math.min(rawY, ih));
    if (target === 'touch') {
      const { start: startNew, end } = sortCoo(start, [clientX, clientY]);
      onMove(startNew, end);
    } else if (target === 'view') {
      const [sx, sy, ex, ey, ofx, ofy] = start;
      const w = ex - sx;
      const h = ey - sy;
      const nsx = Math.max(0, Math.min(sx + (clientX - ofx), iw - w));
      const nsy = Math.max(0, Math.min(sy + (clientY - ofy), ih - h));
      onMove([nsx, nsy], [nsx + w, nsy + h], 2);
    } else if (target) {
      let [x, y] = [0, 0];
      const [sx, sy, ex, ey] = start;
      const [row, span] = target.split(' ');
      const nextStep = step >= 3 ? 3 : 2;
      if (span === 'center') {
        y = row === 'top' ? ey : sy;
        const [startY, endY] = [y, clientY].sort(sort);
        onMove([sx, startY], [ex, endY], nextStep);
      } else if (row === 'mid') {
        x = span === 'left' ? ex : sx;
        const [startX, endX] = [x, clientX].sort(sort);
        onMove([startX, sy], [endX, ey], nextStep);
      } else {
        x = span === 'left' ? ex : sx;
        y = row === 'top' ? ey : sy;
        const { start: startNew, end } = sortCoo([x, y], [clientX, clientY]);
        onMove(startNew, end, nextStep);
      }
    }
  };

  const handleUp = (): void => {
    detach();
    document.body.style.cursor = '';
    if (step < 3) {
      onUp();
    }
    start = [];
    target = '';
  };

  const down = (ev: React.MouseEvent<HTMLDivElement>): void => {
    target = '';
    start = [];
    ev.stopPropagation();
    const { clientX, clientY } = ev.nativeEvent;

    if (!step) {
      start = [clientX, clientY];
      target = 'touch';
    } else if (step === 2) {
      const dotName = (ev.target as HTMLButtonElement).name;
      const [startX, startY, endX, endY] = pointer;
      if (dotName) {
        target = dotName;
        start = pointer;
        document.body.style.cursor = DOT_CURSOR[target] || 'default';
      } else if (clientX > startX && clientX < endX && clientY > startY && clientY < endY) {
        target = 'view';
        start = [...pointer, clientX, clientY];
        document.body.style.cursor = 'grabbing';
      }
    } else if (step >= 3) {
      target = (ev.target as HTMLButtonElement).name || '';
      if (target) {
        start = pointer;
        document.body.style.cursor = DOT_CURSOR[target] || 'default';
      }
    }

    if (target) {
      if (target !== 'touch' && target !== 'view') flushActiveText();
      const moving = (e: MouseEvent): void => {
        e.preventDefault();
        handleMove(e.clientX, e.clientY);
      };
      const upping = (): void => handleUp();
      dragRef.current.moving = moving;
      dragRef.current.upping = upping;
      document.addEventListener('mousemove', moving);
      document.addEventListener('mouseup', upping);
    }
  };

  const layerStyle: React.CSSProperties = {
    position: 'absolute',
    width: '100%',
    height: '100%',
  };

  const handleDoubleClick = (): void => {
    if (step === 2) {
      onUp(3);
    }
  };

  return (
    <div onMouseDown={down} onDoubleClick={handleDoubleClick} style={layerStyle}>
      {step >= 1 && DOTS.map((name) => <ResizeDot position={pointer} local={name} key={name} />)}
    </div>
  );
}

export default SelectionLayer;
