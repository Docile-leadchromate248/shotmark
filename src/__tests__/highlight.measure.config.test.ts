import { describe, expect, it } from 'vitest';

import highlight from '../graphs/highlight';
import measure from '../graphs/measure';
import type { DrawContext, MeasurePath, RectPath } from '../types';

describe('highlight and measure tools', () => {
  it('highlight uses translucent rect style', () => {
    const ctx = {
      config: { fill: '#00ff88', highlightOpacity: 60 },
      start: [10, 20],
    } as DrawContext;
    const down = highlight.down?.call({ ctx }, [10, 20]) as [RectPath];
    const path = down[0];
    expect(path.type).toBe('rect');
    expect(path.isHighlight).toBe(true);
    expect(path.fill).toBe('#00ff88');
    expect(path.opacity).toBe(0.6);

    const moved = highlight.move?.call({ ctx: { ...ctx, path } }, [120, 90]) as [RectPath];
    expect(moved[0].w).toBe(110);
    expect(moved[0].h).toBe(70);

    const restyled = highlight.restyle?.(path, { highlightOpacity: 34 }) as RectPath;
    expect(restyled.opacity).toBe(0.34);
  });

  it('measure computes label text from endpoint distance', () => {
    const ctx = { config: { stroke: '#ff0000', strokeWidth: 2 }, start: [10, 20] } as DrawContext;
    const down = measure.down?.call({ ctx }, [10, 20]) as [MeasurePath];
    const path = down[0];

    const moved = measure.move?.call({ ctx: { ...ctx, path } }, [40, 60]) as [MeasurePath];
    expect(moved[0].label).toBe('50 px');

    const restyled = measure.restyle?.(moved[0], { strokeWidth: 6 }) as MeasurePath;
    expect(restyled.strokeWidth).toBe(6);
    expect(restyled.label).toBe('50 px');
  });

  it('measure snaps to horizontal or vertical near axis', () => {
    const ctx = { config: { stroke: '#ff0000', strokeWidth: 2 }, start: [100, 100] } as DrawContext;
    const down = measure.down?.call({ ctx }, [100, 100]) as [MeasurePath];
    const path = down[0];

    const horizontal = measure.move?.call({ ctx: { ...ctx, path } }, [200, 104]) as [MeasurePath];
    expect(horizontal[0].ey).toBe(100);

    const vertical = measure.move?.call({ ctx: { ...ctx, path } }, [103, 220]) as [MeasurePath];
    expect(vertical[0].ex).toBe(100);
  });

  it('measure forces axis snap when shift is pressed', () => {
    const ctx = {
      config: { stroke: '#ff0000', strokeWidth: 2 },
      start: [100, 100],
      shiftKey: true,
    } as DrawContext;
    const down = measure.down?.call({ ctx }, [100, 100]) as [MeasurePath];
    const path = down[0];

    // dx > dy 时强制水平
    const horizontal = measure.move?.call({ ctx: { ...ctx, path } }, [220, 170]) as [MeasurePath];
    expect(horizontal[0].ey).toBe(100);

    // dy > dx 时强制垂直
    const vertical = measure.move?.call({ ctx: { ...ctx, path } }, [140, 260]) as [MeasurePath];
    expect(vertical[0].ex).toBe(100);
  });
});
