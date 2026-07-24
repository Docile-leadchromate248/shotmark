/**
 * 绘图配置面板:颜色 / 线条粗细 / 字号。
 */
import React, { Component } from 'react';

import type { DrawConfig, GraphType, RectPath, SelectedInfo, SvgPath } from '../types';

import {
  FONT_MAX,
  FONT_MIN,
  DEFAULT_GRAPH_COLOR,
  GAP,
  HIGHLIGHT_OPACITY_MAX,
  HIGHLIGHT_OPACITY_MIN,
  MOSAIC_SOFTNESS_MAX,
  MOSAIC_SOFTNESS_MIN,
  MOSAIC_SIZE_MAX,
  MOSAIC_SIZE_MIN,
  PRESET_COLORS,
  STROKE_MAX,
  STROKE_MIN,
  clampHighlightOpacity,
  clampMosaicSoftness,
  clampMosaicSize,
} from '../const';
import { draw } from '../graphs/registry';
import { uiText } from '../i18n';
import { restyleActiveText } from '../graphs/text';

const colorKeyOf = (type?: string): 'fill' | 'stroke' =>
  type === 'text' || type === 'number' || type === 'mosaic' || type === 'highlight'
    ? 'fill'
    : 'stroke';

interface ConfigPanelProps {
  type: GraphType;
  setConfig: (type: GraphType, value: DrawConfig) => void;
  selected?: SelectedInfo | null;
  updateSelected?: (patch: DrawConfig) => void;
}

const panelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  whiteSpace: 'nowrap',
  borderRadius: 8,
  border: '1px solid var(--shotmark-panel-border)',
  backgroundColor: 'var(--shotmark-panel-bg)',
  padding: '7px 12px',
  fontSize: 12,
  boxShadow: 'var(--shotmark-panel-shadow)',
  color: 'var(--shotmark-panel-text)',
};

const colorDotBase: React.CSSProperties = {
  width: 16,
  height: 16,
  borderRadius: '50%',
  cursor: 'pointer',
  display: 'inline-block',
};

const rangeContainerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 12,
  color: 'var(--shotmark-panel-text)',
};

class ConfigPanel extends Component<ConfigPanelProps> {
  private rootRef: HTMLDivElement | null = null;

  get effType(): GraphType {
    const { selected, type } = this.props;
    return selected ? selected.type : type;
  }

  cfg<T>(key: keyof DrawConfig, fallback: T): T {
    const { selected, type } = this.props;
    if (selected && selected.path) {
      const v = (selected.path as DrawConfig)[key];
      return v === undefined ? fallback : (v as unknown as T);
    }
    const c = draw.config[type] || {};
    const v = c[key];
    return v === undefined ? fallback : (v as unknown as T);
  }

  get color(): string {
    return this.cfg(colorKeyOf(this.effType), DEFAULT_GRAPH_COLOR);
  }

  get strokeWidthValue(): number {
    const { selected, type } = this.props;
    if (selected && selected.path) {
      const p = selected.path as SvgPath;
      const v = selected.type === 'arrow' ? p._w : p.strokeWidth;
      return v === undefined ? 4 : v;
    }
    const c = draw.config[type] || {};
    return c.strokeWidth === undefined ? 4 : c.strokeWidth;
  }

  applyConfig = (cfgType: GraphType, patch: DrawConfig): void => {
    const { setConfig, selected, updateSelected } = this.props;
    setConfig(cfgType, patch);
    if (selected && updateSelected) updateSelected(patch);
    if (cfgType === 'text') restyleActiveText(patch);
    this.forceUpdate();
  };

  setColor = (color: string): void => {
    this.applyConfig(this.effType, { [colorKeyOf(this.effType)]: color });
  };

  setStrokeWidth = (strokeWidth: number): void => {
    this.applyConfig(this.effType, { strokeWidth });
  };

  setFontSize = (fontSize: number): void => {
    this.applyConfig(this.effType, { fontSize });
  };

  setMosaicSize = (mosaicSize: number): void => {
    this.applyConfig(this.effType, { mosaicSize: clampMosaicSize(mosaicSize) });
  };

  setMosaicSoftness = (mosaicSoftness: number): void => {
    this.applyConfig(this.effType, { mosaicSoftness: clampMosaicSoftness(mosaicSoftness) });
  };

  setHighlightOpacity = (highlightOpacity: number): void => {
    this.applyConfig(this.effType, { highlightOpacity: clampHighlightOpacity(highlightOpacity) });
  };

  get highlightOpacityValue(): number {
    const { selected } = this.props;
    if (selected && selected.path && selected.type === 'highlight') {
      const p = selected.path as RectPath;
      if (Number.isFinite(p.opacity)) return clampHighlightOpacity((p.opacity as number) * 100);
    }
    return clampHighlightOpacity(this.cfg('highlightOpacity', 28));
  }

  componentDidMount(): void {
    this.clampToViewport();
  }

  componentDidUpdate(): void {
    this.clampToViewport();
  }

  clampToViewport = (): void => {
    const el = this.rootRef;
    if (!el) return;
    el.style.transform = 'translateX(0px)';
    const rect = el.getBoundingClientRect();
    let shift = 0;
    if (rect.left < GAP) {
      shift = GAP - rect.left;
    } else if (rect.right > window.innerWidth - GAP) {
      shift = window.innerWidth - GAP - rect.right;
    }
    el.style.transform = `translateX(${shift}px)`;
  };

  render(): React.ReactElement {
    const isTextLike = this.effType === 'text' || this.effType === 'number';
    const showStrokeWidth = ['rectangle', 'ellipse', 'line', 'brush', 'arrow'].includes(
      this.effType,
    );
    const isMosaic = this.effType === 'mosaic';
    const isHighlight = this.effType === 'highlight';
    const showHighlightOpacity = isHighlight;
    const showColor = !isMosaic;
    const hasTrailingControl = showStrokeWidth || isTextLike || isMosaic || showHighlightOpacity;
    const { color } = this;
    const presetActive = PRESET_COLORS.includes(color);

    return (
      <div
        ref={(el) => {
          this.rootRef = el;
        }}
        style={panelStyle}
      >
        {showColor && (
          <>
            {/* 颜色:预设 + 自定义 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {PRESET_COLORS.map((c) => (
                <span
                  key={c}
                  onClick={() => this.setColor(c)}
                  style={{
                    ...colorDotBase,
                    backgroundColor: c,
                    boxShadow:
                      color.toLowerCase() === c.toLowerCase()
                        ? '0 0 0 2px var(--shotmark-panel-dot-ring-offset), 0 0 0 4px var(--shotmark-panel-dot-ring)'
                        : '0 0 0 1px var(--shotmark-panel-dot-border)',
                  }}
                />
              ))}
              <span
                title="自定义颜色"
                style={{
                  ...colorDotBase,
                  position: 'relative',
                  overflow: 'hidden',
                  background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
                  boxShadow: !presetActive
                    ? '0 0 0 2px var(--shotmark-panel-dot-ring-offset), 0 0 0 4px var(--shotmark-panel-dot-ring)'
                    : '0 0 0 1px var(--shotmark-panel-dot-border)',
                }}
              >
                <input
                  type="color"
                  value={presetActive ? DEFAULT_GRAPH_COLOR : color}
                  onChange={(e) => this.setColor(e.target.value)}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    cursor: 'pointer',
                    border: 'none',
                    padding: 0,
                    opacity: 0,
                  }}
                />
              </span>
            </div>

            {hasTrailingControl && (
              <span
                style={{ width: 1, height: 18, backgroundColor: 'var(--shotmark-panel-divider)' }}
              />
            )}
          </>
        )}

        {showStrokeWidth && (
          <div style={rangeContainerStyle}>
            <span>{uiText('size')}</span>
            <input
              type="range"
              className="cp-range"
              min={STROKE_MIN}
              max={STROKE_MAX}
              step={1}
              value={this.strokeWidthValue}
              onChange={(e) => this.setStrokeWidth(Number(e.target.value))}
            />
            <span style={{ minWidth: 16, textAlign: 'left' }}>{this.strokeWidthValue}</span>
          </div>
        )}

        {isTextLike && (
          <div style={rangeContainerStyle}>
            <span>{uiText('fontSize')}</span>
            <input
              type="range"
              className="cp-range"
              min={FONT_MIN}
              max={FONT_MAX}
              step={1}
              value={this.cfg('fontSize', 18)}
              onChange={(e) => this.setFontSize(Number(e.target.value))}
            />
            <span style={{ minWidth: 16, textAlign: 'left' }}>{this.cfg('fontSize', 18)}</span>
          </div>
        )}

        {isMosaic && (
          <div style={rangeContainerStyle}>
            <span>{uiText('size')}</span>
            <input
              type="range"
              className="cp-range"
              min={MOSAIC_SIZE_MIN}
              max={MOSAIC_SIZE_MAX}
              step={1}
              value={clampMosaicSize(this.cfg('mosaicSize', 2))}
              onChange={(e) => this.setMosaicSize(Number(e.target.value))}
            />
            <span style={{ minWidth: 16, textAlign: 'left' }}>
              {clampMosaicSize(this.cfg('mosaicSize', 2))}
            </span>
          </div>
        )}

        {isMosaic && (
          <div style={rangeContainerStyle}>
            <span>{uiText('softness')}</span>
            <input
              type="range"
              className="cp-range"
              min={MOSAIC_SOFTNESS_MIN}
              max={MOSAIC_SOFTNESS_MAX}
              step={1}
              value={clampMosaicSoftness(this.cfg('mosaicSoftness', 36))}
              onChange={(e) => this.setMosaicSoftness(Number(e.target.value))}
            />
            <span style={{ minWidth: 22, textAlign: 'left' }}>
              {clampMosaicSoftness(this.cfg('mosaicSoftness', 36))}
            </span>
          </div>
        )}

        {showHighlightOpacity && (
          <div style={rangeContainerStyle}>
            <span>{uiText('opacity')}</span>
            <input
              type="range"
              className="cp-range"
              min={HIGHLIGHT_OPACITY_MIN}
              max={HIGHLIGHT_OPACITY_MAX}
              step={1}
              value={this.highlightOpacityValue}
              onChange={(e) => this.setHighlightOpacity(Number(e.target.value))}
            />
            <span style={{ minWidth: 28, textAlign: 'left' }}>{this.highlightOpacityValue}%</span>
          </div>
        )}
      </div>
    );
  }
}

export default ConfigPanel;
