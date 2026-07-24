/**
 * shotmark 样式
 *
 * 对标历史版本的 styles.less，使用 @emotion/css 实现。
 * 通过 injectGlobalStyles() 注入一次性全局样式（text-edit、shadow、svg 等），
 * 因为这些元素是命令式 DOM 创建，不走 React 渲染树。
 */

import { css, injectGlobal } from '@emotion/css';
import {
  BORDER_CLASS,
  CANVAS_CLASS,
  DEFAULT_GRAPH_COLOR,
  ROOT_CLASS,
  SHADOW_CLASS,
} from '../const';

let injected = false;

/**
 * 注入全局样式（幂等）。
 * 覆盖：shadow 全屏覆盖层、text-edit <p>、SVG 子元素光标、range 滑块美化。
 */
export function injectGlobalStyles(): void {
  if (injected) return;
  injected = true;
  injectGlobal`
    .${ROOT_CLASS}.shotmark-theme-light {
      --shotmark-toolbar-bg: #ffffff;
      --shotmark-toolbar-border: #e4e7ec;
      --shotmark-toolbar-divider: #d0d5dd;
      --shotmark-toolbar-shadow: 0 10px 28px rgba(16, 24, 40, 0.14), 0 2px 6px rgba(16, 24, 40, 0.08);
      --shotmark-toolbar-btn-hover-bg: #f2f4f7;
      --shotmark-toolbar-icon-default: #344054;
      --shotmark-toolbar-icon-active: #17b26a;
      --shotmark-toolbar-icon-success: #17b26a;
      --shotmark-toolbar-icon-danger: #f04438;
      --shotmark-size-bg: #ffffff;
      --shotmark-size-border: #d0d5dd;
      --shotmark-size-text: #344054;
      --shotmark-size-shadow: 0 8px 24px rgba(16, 24, 40, 0.16);
      --shotmark-panel-bg: #ffffff;
      --shotmark-panel-border: #e4e7ec;
      --shotmark-panel-shadow: 0 10px 28px rgba(16, 24, 40, 0.14), 0 2px 6px rgba(16, 24, 40, 0.08);
      --shotmark-panel-text: #344054;
      --shotmark-panel-divider: #d0d5dd;
      --shotmark-panel-dot-ring: #101828;
      --shotmark-panel-dot-ring-offset: #ffffff;
      --shotmark-panel-dot-border: rgba(16, 24, 40, 0.2);
      --shotmark-graph-default: ${DEFAULT_GRAPH_COLOR};
      --shotmark-graph-dot-fill: #ffffff;
      --shotmark-graph-dot-stroke: #53a9ff;
      --shotmark-mosaic-selection-stroke: #98a2b3;
      --shotmark-graph-text-hit-hover: #3b82f6;
      --shotmark-range-track: #98a2b3;
      --shotmark-range-thumb: #ffffff;
      --shotmark-range-thumb-shadow: 0 1px 3px rgba(16, 24, 40, 0.25);
    }

    .${ROOT_CLASS}.shotmark-theme-dark {
      --shotmark-toolbar-bg: #2c2c2e;
      --shotmark-toolbar-border: rgba(255, 255, 255, 0.16);
      --shotmark-toolbar-divider: #777777;
      --shotmark-toolbar-shadow: 0 8px 28px rgba(0, 0, 0, 0.4), 0 2px 6px rgba(0, 0, 0, 0.3);
      --shotmark-toolbar-btn-hover-bg: #444444;
      --shotmark-toolbar-icon-default: #ffffff;
      --shotmark-toolbar-icon-active: #15e645;
      --shotmark-toolbar-icon-success: #aeff2e;
      --shotmark-toolbar-icon-danger: #ff4538;
      --shotmark-size-bg: #2c2c2e;
      --shotmark-size-border: rgba(255, 255, 255, 0.12);
      --shotmark-size-text: #ffffff;
      --shotmark-size-shadow: 0 8px 28px rgba(0, 0, 0, 0.4), 0 2px 6px rgba(0, 0, 0, 0.3);
      --shotmark-panel-bg: #2c2c2e;
      --shotmark-panel-border: rgba(255, 255, 255, 0.16);
      --shotmark-panel-shadow: 0 8px 28px rgba(0, 0, 0, 0.4), 0 2px 6px rgba(0, 0, 0, 0.3);
      --shotmark-panel-text: #ffffff;
      --shotmark-panel-divider: rgba(255, 255, 255, 0.18);
      --shotmark-panel-dot-ring: #ffffff;
      --shotmark-panel-dot-ring-offset: #2c2c2e;
      --shotmark-panel-dot-border: rgba(255, 255, 255, 0.25);
      --shotmark-graph-default: ${DEFAULT_GRAPH_COLOR};
      --shotmark-graph-dot-fill: #2c2c2e;
      --shotmark-graph-dot-stroke: #8ec5ff;
      --shotmark-mosaic-selection-stroke: #c8ccd0;
      --shotmark-graph-text-hit-hover: #6fc3fe;
      --shotmark-range-track: #5a5a5e;
      --shotmark-range-thumb: #ffffff;
      --shotmark-range-thumb-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
    }

    /* 根容器 reset */
    .${ROOT_CLASS} {
      ul, li, p, button {
        margin: 0;
        padding: 0;
      }
      li { list-style: none; }
    }

    /* 选区盒内：文字标注可编辑可选中（覆盖根层 user-select:none） */
    .${BORDER_CLASS} p {
      position: absolute;
      min-width: 20px;
      outline: none;
      font-size: 14px;
      -webkit-user-modify: read-write-plaintext-only;
      user-select: text;
      -webkit-user-select: text;
    }

    /* 绘图层只允许在选区内可见，避免图形越界透出 */
    .${CANVAS_CLASS} {
      position: absolute;
      inset: 0;
      overflow: hidden;
    }

    /* 文字编辑 <p> 外层全屏定位容器（点击空白区域提交文字） */
    .${SHADOW_CLASS} {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    }

    /* SVG 画布 */
    .graphics-draw {
      overflow: visible;
      &.drawing { cursor: crosshair; }
      rect { pointer-events: stroke; }
      .text-hit {
        pointer-events: all;
        fill: transparent;
        stroke: transparent;
        stroke-width: 1;
        &:hover {
          stroke: var(--shotmark-graph-text-hit-hover);
          stroke-dasharray: 4 3;
        }
      }
      .draw-dot {
        filter: drop-shadow(0 1px 2px rgba(16, 24, 40, 0.22));
        stroke-width: 1.8;
      }
      &.dragging, &.dragging * {
        cursor: inherit !important;
      }
    }

    /* 配置面板 range 滑块（对标原始 .cp-range） */
    .cp-range {
      -webkit-appearance: none;
      appearance: none;
      width: 96px;
      height: 16px;
      background: transparent;
      cursor: pointer;
      margin: 0;

      &:focus { outline: none; }

      &::-webkit-slider-runnable-track {
        height: 2px;
        border-radius: 2px;
        background: var(--shotmark-range-track);
      }
      &::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 16px;
        height: 16px;
        margin-top: -7px;
        border-radius: 50%;
        background: var(--shotmark-range-thumb);
        box-shadow: var(--shotmark-range-thumb-shadow);
      }
      &::-moz-range-track {
        height: 2px;
        border-radius: 2px;
        background: var(--shotmark-range-track);
      }
      &::-moz-range-thumb {
        width: 16px;
        height: 16px;
        border: none;
        border-radius: 50%;
        background: var(--shotmark-range-thumb);
        box-shadow: var(--shotmark-range-thumb-shadow);
      }
    }
  `;
}

/** 工具栏按钮通用样式 */
export const toolBtnStyle = css`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  background: none;
  border: none;
  cursor: pointer;
  transition: 0.2s;
  outline: none;

  svg {
    display: block;
    width: 20px;
    height: 20px;
    color: var(--shotmark-toolbar-icon-default);
  }

  &[data-active='true'] svg {
    color: var(--shotmark-toolbar-icon-active);
  }

  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
`;

/** 分割线样式 */
export const dividerStyle = css`
  width: 1px;
  height: 16px;
  background: rgba(255, 255, 255, 0.18);
  margin: 0 4px;
`;
