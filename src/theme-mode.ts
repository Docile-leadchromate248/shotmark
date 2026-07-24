/**
 * 主题模式状态
 */

export type ThemeMode = 'light' | 'dark';

let currentTheme: ThemeMode = 'light';

export const setThemeMode = (theme: ThemeMode = 'light'): void => {
  currentTheme = theme;
};

export const getThemeMode = (): ThemeMode => currentTheme;

export const getThemeClassName = (): string => `shotmark-theme-${currentTheme}`;
