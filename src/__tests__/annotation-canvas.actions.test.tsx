import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { describe, expect, it, vi } from 'vitest';

let capturedList: string[] = [];
let capturedTypes: string[] = [];

vi.mock('../components/toolbar', async () => {
  const ReactModule = await import('react');
  return {
    default: ({ list }: { list: string[] }) => {
      capturedList = list;
      return ReactModule.createElement('div', null);
    },
  };
});

vi.mock('../draw-board', async () => {
  const ReactModule = await import('react');
  return {
    keys: [
      'rectangle',
      'ellipse',
      'arrow',
      'line',
      'measure',
      'brush',
      'highlight',
      'mosaic',
      'text',
      'number',
    ],
    default: ({ type }: { type: string }) => {
      capturedTypes.push(type);
      return ReactModule.createElement('div', null);
    },
  };
});

import AnnotationCanvas from '../annotation-canvas';

describe('AnnotationCanvas actions order', () => {
  it('supports first hotkey from empty default tool', () => {
    capturedTypes = [];

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <AnnotationCanvas
          step={2}
          pointer={[10, 10, 220, 180]}
          onEdit={() => {}}
          onClose={() => {}}
          onSubmit={() => {}}
          onCopy={() => {}}
          onDownload={() => {}}
        />,
      );
    });

    expect(capturedTypes[capturedTypes.length - 1]).toBe('');

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: '1',
          code: 'Digit1',
          bubbles: true,
        }),
      );
    });

    expect(capturedTypes[capturedTypes.length - 1]).toBe('rectangle');

    act(() => root.unmount());
    container.remove();
  });

  it('switches active tool with 1~9 shortcut keys', () => {
    capturedTypes = [];

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <AnnotationCanvas
          step={2}
          pointer={[10, 10, 220, 180]}
          defaultTool="rectangle"
          onEdit={() => {}}
          onClose={() => {}}
          onSubmit={() => {}}
          onCopy={() => {}}
          onDownload={() => {}}
        />,
      );
    });

    expect(capturedTypes[capturedTypes.length - 1]).toBe('rectangle');

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: '2',
          code: 'Digit2',
          bubbles: true,
        }),
      );
    });

    expect(capturedTypes[capturedTypes.length - 1]).toBe('ellipse');

    act(() => root.unmount());
    container.remove();
  });

  it('maps digit 0 to the 10th tool', () => {
    capturedTypes = [];

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <AnnotationCanvas
          step={2}
          pointer={[10, 10, 220, 180]}
          defaultTool="rectangle"
          onEdit={() => {}}
          onClose={() => {}}
          onSubmit={() => {}}
          onCopy={() => {}}
          onDownload={() => {}}
        />,
      );
    });

    expect(capturedTypes[capturedTypes.length - 1]).toBe('rectangle');

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: '0',
          code: 'Digit0',
          bubbles: true,
        }),
      );
    });

    // DRAW_ORDER 第 10 个工具为 number
    expect(capturedTypes[capturedTypes.length - 1]).toBe('number');

    act(() => root.unmount());
    container.remove();
  });

  it('switches exactly once for a real event dispatched from a nested target', () => {
    // 真实场景:按键事件从获得焦点的深层元素派发并冒泡,
    // 仅由 window 捕获监听处理一次,不会因多 target 叠加而重复切换。
    capturedTypes = [];

    const container = document.createElement('div');
    document.body.appendChild(container);
    const inner = document.createElement('button');
    document.body.appendChild(inner);
    const root = createRoot(container);

    act(() => {
      root.render(
        <AnnotationCanvas
          step={2}
          pointer={[10, 10, 220, 180]}
          defaultTool="rectangle"
          onEdit={() => {}}
          onClose={() => {}}
          onSubmit={() => {}}
          onCopy={() => {}}
          onDownload={() => {}}
        />,
      );
    });

    const before = capturedTypes.length;

    act(() => {
      inner.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: '3',
          code: 'Digit3',
          bubbles: true,
        }),
      );
    });

    const switches = capturedTypes.slice(before);
    // 只应产生一次工具切换(arrow),不得重复
    expect(switches).toEqual(['arrow']);

    act(() => root.unmount());
    container.remove();
    inner.remove();
  });

  it('uses default action order: cancel -> copy -> download -> confirm', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <AnnotationCanvas
          step={2}
          pointer={[10, 10, 220, 180]}
          onEdit={() => {}}
          onClose={() => {}}
          onSubmit={() => {}}
          onCopy={() => {}}
          onDownload={() => {}}
        />,
      );
    });

    expect(capturedList.slice(-4)).toEqual(['close', 'copy', 'download', 'submit']);

    act(() => root.unmount());
    container.remove();
  });
});
