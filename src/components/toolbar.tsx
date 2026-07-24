/**
 * 工具栏:绘制工具按钮 + 控制按钮,自适应定位在选区上方/下方/居中,并 clamp 进视口。
 */
import React from 'react';
import { createPortal } from 'react-dom';

import type { DrawConfig, GraphType, SelectedInfo } from '../types';

import { DRAW_TYPES, GAP, TOOLBAR_H, Z_TOOLBAR } from '../const';
import { getLocale, type Locale } from '../i18n';
import { computeLayout } from '../utils';
import ConfigPanel from './config-panel';
import ToolbarIcon from './toolbar-icon';

interface ToolbarProps {
  list: string[];
  type: string;
  pointer: number[];
  btnHandler: (name: string) => void;
  setConfig: (type: GraphType, value: DrawConfig) => void;
  selected?: SelectedInfo | null;
  updateSelected?: (patch: DrawConfig) => void;
}

interface HintContent {
  title: string;
  description: string;
}

const TOOL_HINTS: Record<Locale, Record<string, HintContent>> = {
  'zh-CN': {
    rectangle: { title: '矩形', description: '框出一块区域，适合强调模块、卡片和区块。' },
    ellipse: { title: '椭圆', description: '用圆形或椭圆圈选目标，适合聚焦单个元素。' },
    arrow: { title: '箭头', description: '指出重点位置，适合说明操作入口或流程方向。' },
    line: { title: '直线', description: '绘制简单线段，适合连接关系或辅助标识。' },
    brush: { title: '画笔', description: '自由手绘标记，适合圈画、批注和快速勾勒。' },
    highlight: { title: '高亮', description: '用半透明色块强调区域，不遮挡底图内容。' },
    measure: { title: '尺寸标注', description: '标注两点之间的像素距离，适合说明间距和尺寸。' },
    mosaic: { title: '马赛克', description: '遮挡敏感信息，适合头像、手机号、订单号等内容。' },
    number: { title: '序号', description: '自动添加步骤编号，适合流程讲解和操作说明。' },
    text: { title: '文字', description: '直接输入说明文字，补充业务解释或备注。' },
    prev: { title: '撤销', description: '回退上一步标注操作。' },
    next: { title: '重做', description: '恢复刚刚撤销的标注操作。' },
    trash: { title: '清空', description: '删除当前全部标注内容。' },
    close: { title: '关闭', description: '退出当前截图和标注流程。' },
    copy: { title: '复制', description: '复制当前截图到剪贴板，便于直接粘贴。' },
    download: { title: '下载', description: '下载当前截图文件到本地。' },
    submit: { title: '完成', description: '确认当前标注并导出截图结果。' },
  },
  'en-US': {
    rectangle: {
      title: 'Rectangle',
      description: 'Frame an area to emphasize cards, modules, and sections.',
    },
    ellipse: { title: 'Ellipse', description: 'Circle a target to focus on a single element.' },
    arrow: {
      title: 'Arrow',
      description: 'Point to a key place to explain entry points or flow direction.',
    },
    line: { title: 'Line', description: 'Draw a simple line for relation or auxiliary marking.' },
    brush: {
      title: 'Brush',
      description: 'Freehand drawing for quick circling and sketch annotations.',
    },
    highlight: {
      title: 'Highlight',
      description: 'Emphasize an area with a translucent overlay without blocking content.',
    },
    measure: {
      title: 'Measure',
      description: 'Show pixel distance between two points for spacing and sizing.',
    },
    mosaic: {
      title: 'Mosaic',
      description: 'Hide sensitive information such as avatars, phones, or order ids.',
    },
    number: {
      title: 'Number',
      description: 'Add incremental step numbers for process walkthroughs.',
    },
    text: {
      title: 'Text',
      description: 'Enter explanatory text or notes directly on the screenshot.',
    },
    prev: { title: 'Undo', description: 'Revert the previous annotation action.' },
    next: { title: 'Redo', description: 'Restore the annotation you just undid.' },
    trash: { title: 'Clear', description: 'Remove all current annotations.' },
    close: { title: 'Close', description: 'Exit the current screenshot session.' },
    copy: { title: 'Copy', description: 'Copy the current shot to the clipboard.' },
    download: { title: 'Download', description: 'Download the current shot as a local file.' },
    submit: { title: 'Confirm', description: 'Finish annotation and export the result.' },
  },
};

const toolbarStyle: React.CSSProperties = {
  position: 'absolute',
  display: 'flex',
  alignItems: 'center',
  borderRadius: 8,
  border: '1px solid var(--shotmark-toolbar-border)',
  backgroundColor: 'var(--shotmark-toolbar-bg)',
  padding: '0 6px',
  boxShadow: 'var(--shotmark-toolbar-shadow)',
  listStyle: 'none',
  margin: 0,
};

const dividerStyle: React.CSSProperties = {
  display: 'block',
  width: 1,
  height: 22,
  backgroundColor: 'var(--shotmark-toolbar-divider)',
  margin: '0 2px',
};

const btnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 30,
  height: 30,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  padding: 0,
  borderRadius: 4,
};

const svgStyle: React.CSSProperties = {
  width: 20,
  height: 20,
  color: 'var(--shotmark-toolbar-icon-default)',
};

const selectedSvgStyle: React.CSSProperties = {
  ...svgStyle,
  color: 'var(--shotmark-toolbar-icon-active)',
};

const closeSvgStyle: React.CSSProperties = {
  ...svgStyle,
  color: 'var(--shotmark-toolbar-icon-danger)',
};

const submitSvgStyle: React.CSSProperties = {
  ...svgStyle,
  color: 'var(--shotmark-toolbar-icon-success)',
};

const TOOLTIP_GAP = 10;
const TOOLTIP_EDGE_GAP = 8;
const TOOLTIP_Z_INDEX = 2147483646;

function Toolbar({
  list,
  type,
  pointer,
  btnHandler,
  setConfig,
  selected,
  updateSelected,
}: ToolbarProps): React.ReactElement {
  const [hoveredName, setHoveredName] = React.useState<string>('');
  const [showHint, setShowHint] = React.useState(false);
  const [hintPos, setHintPos] = React.useState<{ top: number; left: number }>({
    top: -9999,
    left: -9999,
  });
  const hoverTimerRef = React.useRef<number | null>(null);
  const itemRefs = React.useRef<Record<string, HTMLLIElement | null>>({});
  const hintRef = React.useRef<HTMLDivElement | null>(null);
  const locale = getLocale();
  const [startX, startY] = pointer;
  const hasPanel = DRAW_TYPES.includes(type as GraphType);
  const { vpTop, vpLeft, panelUp } = computeLayout(pointer, list, hasPanel).toolbar;
  const posStyle: React.CSSProperties = {
    ...toolbarStyle,
    top: vpTop - startY,
    left: vpLeft - startX,
    zIndex: Z_TOOLBAR,
  };

  const clearHoverTimer = (): void => {
    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  React.useEffect(() => () => clearHoverTimer(), []);

  const openHint = (name: string): void => {
    if (name.includes('dividing')) return;
    clearHoverTimer();
    setShowHint(false);
    setHoveredName(name);
    hoverTimerRef.current = window.setTimeout(() => {
      setHoveredName(name);
      setShowHint(true);
      hoverTimerRef.current = null;
    }, 1000);
  };

  const closeHint = (): void => {
    clearHoverTimer();
    setShowHint(false);
  };

  const hint = TOOL_HINTS[locale][hoveredName];

  const updateHintPosition = React.useCallback(() => {
    if (!showHint || !hint) return;
    const anchor = itemRefs.current[hoveredName];
    const bubble = hintRef.current;
    if (!anchor || !bubble) return;

    const ar = anchor.getBoundingClientRect();
    const br = bubble.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top = ar.top - TOOLTIP_GAP - br.height;
    if (top < TOOLTIP_EDGE_GAP) {
      top = ar.bottom + TOOLTIP_GAP;
    }
    if (top + br.height > vh - TOOLTIP_EDGE_GAP) {
      top = Math.max(TOOLTIP_EDGE_GAP, vh - TOOLTIP_EDGE_GAP - br.height);
    }

    let left = ar.left + ar.width / 2 - br.width / 2;
    if (left < TOOLTIP_EDGE_GAP) left = TOOLTIP_EDGE_GAP;
    if (left + br.width > vw - TOOLTIP_EDGE_GAP) {
      left = Math.max(TOOLTIP_EDGE_GAP, vw - TOOLTIP_EDGE_GAP - br.width);
    }

    setHintPos({ top, left });
  }, [hint, hoveredName, showHint]);

  React.useLayoutEffect(() => {
    updateHintPosition();
  }, [updateHintPosition]);

  React.useEffect(() => {
    if (!showHint) return;
    const handler = (): void => updateHintPosition();
    window.addEventListener('resize', handler);
    window.addEventListener('scroll', handler, true);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('scroll', handler, true);
    };
  }, [showHint, updateHintPosition]);

  return (
    <>
      <ul style={posStyle}>
        {list.map((name) => (
          <li
            key={name}
            style={{ position: 'relative', listStyle: 'none' }}
            ref={(el) => {
              itemRefs.current[name] = el;
            }}
          >
            {DRAW_TYPES.includes(name as GraphType) && type === name && (
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  color: 'var(--shotmark-toolbar-icon-default)',
                  ...(panelUp ? { bottom: TOOLBAR_H + GAP } : { top: TOOLBAR_H + GAP }),
                }}
              >
                <ConfigPanel
                  type={type as GraphType}
                  setConfig={setConfig}
                  selected={selected}
                  updateSelected={updateSelected}
                />
              </div>
            )}
            {!name.includes('dividing') ? (
              <button
                type="button"
                onClick={() => btnHandler(name)}
                style={btnStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--shotmark-toolbar-btn-hover-bg)';
                  openHint(name);
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  closeHint();
                }}
              >
                <span
                  style={
                    type === name
                      ? selectedSvgStyle
                      : name === 'close'
                        ? closeSvgStyle
                        : name === 'submit'
                          ? submitSvgStyle
                          : svgStyle
                  }
                >
                  <ToolbarIcon name={name} />
                </span>
              </button>
            ) : (
              <span style={dividerStyle} />
            )}
          </li>
        ))}
      </ul>
      {showHint &&
        hint &&
        createPortal(
          <div
            ref={hintRef}
            style={{
              position: 'fixed',
              top: hintPos.top,
              left: hintPos.left,
              minWidth: 180,
              maxWidth: 220,
              padding: '10px 12px',
              borderRadius: 10,
              background: 'rgba(27, 31, 39, 0.94)',
              color: '#fff',
              boxShadow: '0 10px 24px rgba(0, 0, 0, 0.28)',
              pointerEvents: 'none',
              zIndex: TOOLTIP_Z_INDEX,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, lineHeight: '18px', marginBottom: 4 }}>
              {hint.title}
            </div>
            <div style={{ fontSize: 12, lineHeight: '17px', opacity: 0.9 }}>{hint.description}</div>
          </div>,
          document.body,
        )}
    </>
  );
}

export default Toolbar;
