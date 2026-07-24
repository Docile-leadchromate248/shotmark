import { describe, expect, it } from 'vitest';

import { resolveDownloadFileName } from '../stage';

describe('resolveDownloadFileName', () => {
  it('uses package prefix + timestamp when fileName is empty', () => {
    const date = new Date(2026, 6, 22, 14, 59, 2);
    expect(resolveDownloadFileName('', 'png', date)).toBe('shotmark_2026-07-22_14.59.02.png');
  });

  it('uses trimmed custom fileName when provided', () => {
    const date = new Date(2026, 6, 22, 14, 59, 2);
    expect(resolveDownloadFileName('  custom-name  ', 'jpeg', date)).toBe('custom-name.jpeg');
  });
});
