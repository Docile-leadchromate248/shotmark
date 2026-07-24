import { describe, expect, it } from 'vitest';

import { computeMosaicSampleGrid } from '../generate-image';

describe('generateImage mosaic grid', () => {
  it('uses denser sample grid when blockSize is smaller', () => {
    const coarse = computeMosaicSampleGrid(320, 160, 2, 12);
    const fine = computeMosaicSampleGrid(320, 160, 2, 6);

    expect(fine.sampleW).toBeGreaterThan(coarse.sampleW);
    expect(fine.sampleH).toBeGreaterThan(coarse.sampleH);
  });

  it('falls back to default blockSize=2', () => {
    const byDefault = computeMosaicSampleGrid(320, 160, 2);
    const explicit = computeMosaicSampleGrid(320, 160, 2, 2);
    expect(byDefault).toEqual(explicit);
  });
});
