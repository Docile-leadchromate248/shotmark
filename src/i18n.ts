/**
 * 轻量国际化预埋(当前仅覆盖内置消息文案)
 */

export type Locale = 'zh-CN' | 'en-US';

export type MessageKey = 'copySuccess' | 'copyError' | 'downloadSuccess' | 'downloadError';
export type UiTextKey = 'size' | 'fontSize' | 'softness' | 'opacity';

export interface LocaleTextOverrides {
  messages?: Partial<Record<Locale, Partial<Record<MessageKey, string>>>>;
  uiText?: Partial<Record<Locale, Partial<Record<UiTextKey, string>>>>;
}

const MESSAGES: Record<Locale, Record<MessageKey, string>> = {
  'zh-CN': {
    copySuccess: '已复制到剪贴板',
    copyError: '复制失败，请检查剪贴板权限',
    downloadSuccess: '下载成功',
    downloadError: '下载失败，请稍后重试',
  },
  'en-US': {
    copySuccess: 'Copied to clipboard',
    copyError: 'Copy failed. Please check clipboard permission',
    downloadSuccess: 'Download succeeded',
    downloadError: 'Download failed. Please try again later',
  },
};

let currentLocale: Locale = 'zh-CN';
let localeOverrides: LocaleTextOverrides = {};

const UI_TEXT: Record<Locale, Record<UiTextKey, string>> = {
  'zh-CN': {
    size: '大小',
    fontSize: '字号',
    softness: '柔化',
    opacity: '透明度',
  },
  'en-US': {
    size: 'Size',
    fontSize: 'Font',
    softness: 'Softness',
    opacity: 'Opacity',
  },
};

export const setLocale = (locale: Locale = 'zh-CN'): void => {
  currentLocale = locale;
};

export const setLocaleOverrides = (overrides?: LocaleTextOverrides): void => {
  localeOverrides = overrides || {};
};

export const t = (key: MessageKey): string => {
  const custom = localeOverrides.messages?.[currentLocale]?.[key];
  if (custom) return custom;
  return MESSAGES[currentLocale][key] || MESSAGES['zh-CN'][key];
};

export const uiText = (key: UiTextKey): string => {
  const custom = localeOverrides.uiText?.[currentLocale]?.[key];
  if (custom) return custom;
  return UI_TEXT[currentLocale][key] || UI_TEXT['zh-CN'][key];
};

export const getLocale = (): Locale => currentLocale;
