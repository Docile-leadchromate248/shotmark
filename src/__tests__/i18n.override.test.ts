import { describe, expect, it } from 'vitest';

import { getLocale, setLocale, setLocaleOverrides, t, uiText } from '../i18n';

describe('i18n locale overrides', () => {
  it('uses localeText overrides when provided', () => {
    setLocale('zh-CN');
    setLocaleOverrides({
      messages: {
        'zh-CN': {
          copySuccess: '复制成功(自定义)',
        },
      },
      uiText: {
        'zh-CN': {
          size: '粗细',
        },
      },
    });

    expect(getLocale()).toBe('zh-CN');
    expect(t('copySuccess')).toBe('复制成功(自定义)');
    expect(uiText('size')).toBe('粗细');
  });

  it('falls back to built-in text when overrides are reset', () => {
    setLocale('en-US');
    setLocaleOverrides(undefined);

    expect(t('downloadSuccess')).toBe('Download succeeded');
    expect(uiText('opacity')).toBe('Opacity');
  });
});
