import { describe, expect, it } from 'vitest';

import { clampMosaicSize } from '../const';
import mosaic from '../graphs/mosaic';
import type { DrawContext, MosaicPath } from '../types';

describe('mosaic config', () => {
  it('uses default mosaicSize=2 when config is missing', () => {
    const ctx = { config: {} } as DrawContext;
    const result = mosaic.down?.call({ ctx }, [10, 20]);
    const path = (result as [MosaicPath])[0];
    expect(path.mosaicSize).toBe(2);
    expect(path.mosaicSoftness).toBe(36);
  });

  it('clamps invalid/overflow size to safe range', () => {
    expect(clampMosaicSize(undefined)).toBe(2);
    expect(clampMosaicSize(1)).toBe(1);
    expect(clampMosaicSize(30)).toBe(24);
  });

  it('restyle keeps clamped mosaicSize', () => {
    const oldPath: MosaicPath = {
      type: 'mosaic',
      x: 10,
      y: 10,
      w: 100,
      h: 80,
      mosaicSize: 8,
    };
    const next = mosaic.restyle?.(oldPath, { mosaicSize: 100 }) as MosaicPath;
    expect(next.mosaicSize).toBe(24);
  });
});
