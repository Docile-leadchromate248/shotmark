/**
 * 标注画布容器:选区确定后展示,组合工具栏 + 配置面板 + 尺寸提示 + 绘图 SVG 画板。
 */
import React, { Component } from 'react';
import { flushSync } from 'react-dom';

import type { DrawBoardApi, SelectedInfo } from './draw-board';
import type { ActionType, DrawConfig, GraphPath, GraphType, MosaicExportRect } from './types';

import Toolbar from './components/toolbar';
import {
  BORDER_CLASS,
  CANVAS_CLASS,
  DRAW_ORDER,
  DRAW_TYPES,
  Z_CANVAS_STEP3,
  Z_OVERLAY,
} from './const';
import DrawBoard, { keys } from './draw-board';
import { flushActiveText } from './graphs/text';
import { computeLayout } from './utils';

const CTRL = ['prev', 'next', 'trash'];
const DEFAULT_ACTIONS: ActionType[] = ['cancel', 'copy', 'download', 'confirm'];
const ACTION_TO_BUTTON: Record<ActionType, 'submit' | 'copy' | 'download' | 'close'> = {
  confirm: 'submit',
  copy: 'copy',
  download: 'download',
  cancel: 'close',
};

const NON_TEXT_INPUT_TYPES = new Set(['range', 'color', 'checkbox', 'radio', 'button', 'submit']);

function isTextEditingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;

  const tag = el.tagName;
  const inputType = ((el as HTMLInputElement).type || '').toLowerCase();
  return (
    el.isContentEditable ||
    tag === 'TEXTAREA' ||
    (tag === 'INPUT' && !NON_TEXT_INPUT_TYPES.has(inputType))
  );
}

function parseToolHotkeyIndex(ev: KeyboardEvent): number {
  if (ev.metaKey || ev.ctrlKey || ev.altKey) return -1;

  // 数字 d → 工具索引:1~9 对应第 1~9 个工具,0 对应第 10 个工具。
  const digitToIndex = (d: number): number => (d === 0 ? 9 : d - 1);

  // 优先用物理键码,避免输入法改写 key。
  const byCode = /^Digit([0-9])$/.exec(ev.code) || /^Numpad([0-9])$/.exec(ev.code);
  if (byCode) return digitToIndex(Number(byCode[1]));

  if (!ev.isComposing && /^[0-9]$/.test(ev.key)) return digitToIndex(Number(ev.key));

  const keyCode = ev.keyCode || ev.which;
  if (keyCode === 229) return -1;
  if (!ev.isComposing) {
    if (keyCode >= 48 && keyCode <= 57) return digitToIndex(keyCode - 48);
    if (keyCode >= 96 && keyCode <= 105) return digitToIndex(keyCode - 96);
  }

  return -1;
}

interface AnnotationCanvasProps {
  step: number;
  pointer: number[];
  actions?: ActionType[];
  tools?: GraphType[];
  defaultTool?: GraphType;
  onAnnotationChange?: (graph: GraphPath[]) => void;
  onEdit: (step: number) => void;
  onClose: () => void;
  onSubmit: (data: {
    draw?: string;
    width?: number;
    height?: number;
    mosaics?: MosaicExportRect[];
  }) => void;
  onCopy: (data: {
    draw?: string;
    width?: number;
    height?: number;
    mosaics?: MosaicExportRect[];
  }) => void;
  onDownload: (data: {
    draw?: string;
    width?: number;
    height?: number;
    mosaics?: MosaicExportRect[];
  }) => void;
}

interface AnnotationCanvasState {
  type: string;
  selected: SelectedInfo | null;
}

class AnnotationCanvas extends Component<AnnotationCanvasProps, AnnotationCanvasState> {
  private clear?: DrawBoardApi['clear'];
  private goto?: DrawBoardApi['goto'];
  private getImage?: DrawBoardApi['getImage'];
  private setConfig?: DrawBoardApi['setConfig'];
  private updateSelected?: DrawBoardApi['updateSelected'];

  private rootRef = React.createRef<HTMLDivElement>();

  private keydownListener: EventListener = (event: Event) => {
    if (event instanceof KeyboardEvent) this.handleKeyDown(event);
  };

  constructor(props: AnnotationCanvasProps) {
    super(props);
    this.state = {
      type: props.defaultTool || '',
      selected: null,
    };
  }

  enabledTools(tools?: GraphType[]): GraphType[] {
    const whitelist = Array.isArray(tools) && tools.length ? tools : DRAW_ORDER;
    const enabled = DRAW_ORDER.filter((tool) => whitelist.includes(tool) && keys.includes(tool));
    return enabled.length ? enabled : DRAW_ORDER.filter((tool) => keys.includes(tool));
  }

  componentDidMount(): void {
    // 仅监听自身文档的 window(捕获阶段):任何元素的按键都会经此传播,
    // 不再 reach window.top,避免跨帧/跨域的静默失效与重复触发。
    window.addEventListener('keydown', this.keydownListener, true);
    // 主动把焦点落到画布容器,保证键盘事件进入正确的文档上下文
    // (如 Storybook 中焦点可能停留在 iframe 之外)。
    this.rootRef.current?.focus({ preventScroll: true });
  }

  componentWillUnmount(): void {
    window.removeEventListener('keydown', this.keydownListener, true);
  }

  switchToolByIndex = (hotkeyIndex: number, ev: KeyboardEvent): boolean => {
    const enabled = this.enabledTools(this.props.tools);
    const nextTool = hotkeyIndex >= 0 ? enabled[hotkeyIndex] : undefined;
    if (!nextTool) return false;

    ev.preventDefault();
    this.props.onEdit(3);
    this.setState({ type: nextTool, selected: null });
    return true;
  };

  handleKeyDown = (ev: KeyboardEvent): void => {
    if (isTextEditingTarget(ev.target)) return;

    // 选区未确认(step < 2)时不响应快捷键
    if (this.props.step < 2) return;

    // 数字键切换工具:parseToolHotkeyIndex 以物理键码(ev.code)为主,
    // 不受输入法/组合态影响,故放在 isComposing 早退之前,避免 IME 激活时被误拦截。
    const hotkeyIndex = parseToolHotkeyIndex(ev);
    if (hotkeyIndex >= 0) {
      this.switchToolByIndex(hotkeyIndex, ev);
      return;
    }

    // 组合态下不处理动作键(Enter/Escape 等会用于确认/取消候选词)
    if (ev.isComposing) return;

    const actions = this.props.actions?.length ? this.props.actions : DEFAULT_ACTIONS;
    const allowCopy = actions.includes('copy');
    const allowConfirm = actions.includes('confirm');

    const isCopy = (ev.metaKey || ev.ctrlKey) && (ev.key === 'c' || ev.key === 'C');
    if (isCopy && allowCopy) {
      ev.preventDefault();
      this.btnHandler('copy');
    } else if (ev.key === 'Escape') {
      ev.preventDefault();
      this.btnHandler('close');
    } else if (ev.key === 'Enter' && allowConfirm) {
      ev.preventDefault();
      if (this.props.step < 3) {
        this.props.onEdit(3);
      } else {
        this.btnHandler('submit');
      }
    }
  };

  onMount = (api: DrawBoardApi): void => {
    this.clear = api.clear;
    this.goto = api.goto;
    this.getImage = api.getImage;
    this.setConfig = api.setConfig;
    this.updateSelected = api.updateSelected;
  };

  onSelect = (selected: SelectedInfo | null): void => {
    this.setState({ selected });
  };

  btnHandler = (name: string): void => {
    const { onClose, onSubmit, onCopy, onDownload, onEdit, step, tools } = this.props;
    const enabled = this.enabledTools(tools);

    if (name === 'close') onClose();
    if (name === 'submit') {
      flushSync(() => flushActiveText());
      onSubmit(this.getImage ? this.getImage() : {});
    }
    if (name === 'copy') {
      flushSync(() => flushActiveText());
      onCopy(this.getImage ? this.getImage() : {});
    }
    if (name === 'download') {
      flushSync(() => flushActiveText());
      onDownload(this.getImage ? this.getImage() : {});
    }
    if (step >= 3) {
      if (name === 'trash') this.clear?.();
      if (name === 'prev') this.goto?.(-1);
      if (name === 'next') this.goto?.(1);
    }
    if (enabled.includes(name as GraphType)) {
      onEdit(3);
      this.setState({ type: name, selected: null });
    }
  };

  render(): React.ReactElement {
    const { type, selected } = this.state;
    const { step, pointer, actions, tools: enabledToolsFromProps, onAnnotationChange } = this.props;
    const [startX, startY, endX, endY] = pointer;
    const width = endX - startX;
    const height = endY - startY;
    const style: React.CSSProperties = {
      position: 'absolute',
      top: startY,
      left: startX,
      width,
      height,
      zIndex: step === 3 ? Z_CANVAS_STEP3 : 'initial',
      boxShadow: `0 0 0 2px #6fc3fe, 0 0 0 ${Math.max(window.innerWidth, window.innerHeight)}px rgba(51,51,51,.5)`,
      // 容器 tabIndex=-1 用于承接键盘焦点,隐藏聚焦时的默认描边
      outline: 'none',
    };
    const drawKeys = this.enabledTools(enabledToolsFromProps);
    const activeType = drawKeys.includes(type as GraphType) ? type : '';
    const actionButtons = (actions?.length ? actions : DEFAULT_ACTIONS).map(
      (a) => ACTION_TO_BUTTON[a],
    );
    const toolbarItems = [...drawKeys, 'dividing-2', ...CTRL, 'dividing-3', ...actionButtons];

    const hasPanel = DRAW_TYPES.includes(activeType as GraphType);
    const { label } = computeLayout(pointer, toolbarItems, hasPanel);
    const sizeStyle: React.CSSProperties = {
      position: 'absolute',
      top: label.vpTop - startY,
      left: label.vpLeft - startX,
      zIndex: Z_OVERLAY,
      userSelect: 'none',
      whiteSpace: 'nowrap',
      borderRadius: 8,
      border: '1px solid var(--shotmark-size-border)',
      backgroundColor: 'var(--shotmark-size-bg)',
      padding: '4px 10px',
      textAlign: 'center',
      fontSize: 12,
      fontVariantNumeric: 'tabular-nums',
      color: 'var(--shotmark-size-text)',
      boxShadow: 'var(--shotmark-size-shadow)',
    };

    return (
      <div ref={this.rootRef} tabIndex={-1} style={style} className={BORDER_CLASS}>
        <div style={sizeStyle}>{`${width} × ${height}`}</div>
        {step >= 2 && (
          <Toolbar
            list={toolbarItems}
            type={activeType}
            btnHandler={this.btnHandler}
            pointer={pointer}
            setConfig={(t: GraphType, v: DrawConfig) => this.setConfig?.(t, v)}
            selected={selected}
            updateSelected={(patch: DrawConfig) => this.updateSelected?.(patch)}
          />
        )}
        {step >= 2 && (
          <div className={CANVAS_CLASS}>
            <DrawBoard
              type={activeType}
              pointer={pointer}
              onMount={this.onMount}
              onSelect={this.onSelect}
              onGraphChange={onAnnotationChange}
            />
          </div>
        )}
      </div>
    );
  }
}

export default AnnotationCanvas;
