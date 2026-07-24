import { beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_CONFIG } from '../const';
import {
  applyDefaultConfig,
  applyUserMemory,
  draw,
  initDefaultConfig,
  setConfig,
} from '../graphs/registry';

/**
 * 工具配置记忆(localStorage)与优先级回归。
 * 优先级约定:用户记忆值 > start 选项默认 > 内置默认。
 */
describe('draw config memory', () => {
  beforeEach(() => {
    localStorage.clear();
    initDefaultConfig();
  });

  it('序号工具默认字号为 12,文字工具仍为 18', () => {
    expect(draw.config.number?.fontSize).toBe(12);
    expect(draw.config.text?.fontSize).toBe(DEFAULT_CONFIG.fontSize);
  });

  it('无记忆时 start 选项默认生效', () => {
    applyDefaultConfig('rectangle', { stroke: '#ff0000' });
    applyUserMemory();
    expect(draw.config.rectangle?.stroke).toBe('#ff0000');
  });

  it('用户记忆值优先级高于 start 选项默认', () => {
    // 用户上次把矩形改成蓝色
    setConfig('rectangle', { stroke: '#0000ff' });
    // 新一次 start:重置内置 → 应用选项红色 → 记忆覆盖
    initDefaultConfig();
    applyDefaultConfig('rectangle', { stroke: '#ff0000' });
    applyUserMemory();
    expect(draw.config.rectangle?.stroke).toBe('#0000ff');
  });

  it('记忆跨会话持久化(重新加载后仍生效)', () => {
    setConfig('ellipse', { strokeWidth: 9 });
    // 模拟刷新:重新初始化并应用记忆
    initDefaultConfig();
    applyUserMemory();
    expect(draw.config.ellipse?.strokeWidth).toBe(9);
  });
});
