/**
 * 主状态机:挂载全屏遮罩,管理 step(0-未开始 / 1-截图中 / 2-调整中 / 3-绘图中),
 * 协调选区交互层与标注画布层,提交时调用 generate-image 导出。
 */
import React, { Component } from 'react';

import AnnotationCanvas from './annotation-canvas';
import { copyBlobToClipboard, dataUrlToBlob } from './clipboard';
import { CLICK_THRESHOLD, ROOT_CLASS } from './const';
import generateImage, { captureHtml } from './generate-image';
import { resetActiveText } from './graphs/text';
import { t } from './i18n';
import { showMessage } from './message';
import SelectionLayer from './selection-layer';
import { injectGlobalStyles } from './styles/theme';
import type { ThemeMode } from './theme-mode';
import type { ActionType, GraphPath, GraphType, MosaicExportRect, ShotmarkResult } from './types';
import { sortCoo } from './utils';

interface SubmitPayload {
  start: number[];
  end: number[];
  getImage: () => Promise<ShotmarkResult>;
}

interface StageProps {
  trigger?: HTMLElement;
  regionRect?: { left: number; top: number; right: number; bottom: number };
  autoAnnotate?: boolean;
  fileName?: string;
  format?: 'png' | 'jpeg';
  theme?: ThemeMode;
  actions?: ActionType[];
  tools?: GraphType[];
  defaultTool?: GraphType;
  zIndex?: number;
  onCopy?: (blob: Blob) => void;
  onCopyError?: (error: unknown) => void;
  onDownload?: (fileName: string) => void;
  onDownloadError?: (error: unknown) => void;
  onAnnotationChange?: (graph: GraphPath[]) => void;
  close: () => void;
  submit: (payload: SubmitPayload) => void;
}

interface StageState {
  step: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

const setOverflow = (value: string): void => {
  (document.querySelector('html') as HTMLElement).style.overflow = value;
};

const DEFAULT_DOWNLOAD_FILE_PREFIX = 'shotmark';

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function formatDownloadFileStamp(date = new Date()): string {
  return (
    [date.getFullYear(), pad2(date.getMonth() + 1), pad2(date.getDate())].join('-') +
    `_${pad2(date.getHours())}.${pad2(date.getMinutes())}.${pad2(date.getSeconds())}`
  );
}

export function resolveDownloadFileName(
  fileName: string | undefined,
  format: 'png' | 'jpeg',
  now = new Date(),
): string {
  const normalized = (fileName || '').trim();
  if (normalized) return `${normalized}.${format}`;
  return `${DEFAULT_DOWNLOAD_FILE_PREFIX}_${formatDownloadFileStamp(now)}.${format}`;
}

const downloadBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

class Stage extends Component<StageProps, StageState> {
  private dom!: HTMLElement;

  private client = {
    height: window.innerHeight,
    width: window.innerWidth,
  };

  state: StageState = {
    step: 0,
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
  };

  componentDidMount(): void {
    injectGlobalStyles();
    this.dom = document.querySelector(`.${ROOT_CLASS}`) as HTMLElement;
    this.dom.tabIndex = -1;
    this.dom.style.cursor = 'crosshair';
    setOverflow('hidden');
    resetActiveText();
    this.dom.focus({ preventScroll: true });
    if (this.props.regionRect) this.setAutoRegion();
  }

  componentWillUnmount(): void {
    resetActiveText();
  }

  setAutoRegion = (): void => {
    const { trigger, regionRect, autoAnnotate = false, defaultTool } = this.props;
    const rect = regionRect;
    if (rect) {
      if (trigger) trigger.style.opacity = '0';
      const { innerWidth: iw, innerHeight: ih } = window;
      const startX = Math.round(Math.max(0, rect.left));
      const startY = Math.round(Math.max(0, rect.top));
      const endX = Math.round(Math.min(iw, rect.right));
      const endY = Math.round(Math.min(ih, rect.bottom));
      // 有 defaultTool 时即使 autoAnnotate=false 也直接进绘图态
      const step = autoAnnotate !== false || defaultTool ? 3 : 2;
      this.setState({ step, startX, startY, endX, endY });
    }
  };

  touchMove = (startPt: number[], endPt: number[], step = 1): void => {
    const [startX, startY] = startPt;
    const [endX, endY] = endPt;
    this.setState({ startX, startY, endX, endY, step });
  };

  touchUp = (step = 2): void => {
    const { startX, startY, endX, endY } = this.state;
    if (step === 2) {
      const {
        start: [x0, y0],
        end: [x1, y1],
      } = sortCoo([startX, startY], [endX, endY]);
      if (x1 - x0 <= CLICK_THRESHOLD && y1 - y0 <= CLICK_THRESHOLD) {
        this.setState({ startX: 0, startY: 0, endX: window.innerWidth, endY: window.innerHeight });
      }
    }
    // 有 defaultTool 时,选区完成(step=2)直接跳到绘图态(step=3),
    // 让用户松手即可绘图,无需再手动点工具或按快捷键。
    const resolvedStep = step === 2 && this.props.defaultTool ? 3 : step;
    this.setState({ step: resolvedStep });
    this.dom.style.cursor = '';
  };

  submit = ({ draw, mosaics }: { draw?: string; mosaics?: MosaicExportRect[] }): void => {
    const { submit, trigger } = this.props;
    const { startX, startY, endX, endY } = this.state;
    const html = captureHtml({ startX, startY, endX, endY });
    if (trigger) trigger.style.opacity = '1';
    setOverflow('');
    const getImage = () =>
      generateImage(html, draw, this.client, { startX, startY, endX, endY }, mosaics);
    submit({ start: [startX, startY], end: [endX, endY], getImage });
  };

  copy = async ({
    draw,
    mosaics,
  }: {
    draw?: string;
    mosaics?: MosaicExportRect[];
  }): Promise<void> => {
    const { onCopy, onCopyError } = this.props;
    try {
      const { startX, startY, endX, endY } = this.state;
      const html = captureHtml({ startX, startY, endX, endY });
      const res = await generateImage(
        html,
        draw,
        this.client,
        { startX, startY, endX, endY },
        mosaics,
      );
      // 剪贴板图片兼容性优先 PNG
      const blob = await dataUrlToBlob(res.image, 'image/png');
      await copyBlobToClipboard(blob);
      onCopy?.(blob);
      showMessage({ type: 'success', content: t('copySuccess') });
    } catch (error) {
      onCopyError?.(error);
      showMessage({ type: 'error', content: t('copyError') });
    }
  };

  download = async ({
    draw,
    mosaics,
  }: {
    draw?: string;
    mosaics?: MosaicExportRect[];
  }): Promise<void> => {
    const { fileName, format = 'png', onDownload, onDownloadError } = this.props;
    try {
      const { startX, startY, endX, endY } = this.state;
      const html = captureHtml({ startX, startY, endX, endY });
      const res = await generateImage(
        html,
        draw,
        this.client,
        { startX, startY, endX, endY },
        mosaics,
      );
      const mime = format === 'png' ? 'image/png' : 'image/jpeg';
      const blob = await dataUrlToBlob(res.image, mime);
      const fullName = resolveDownloadFileName(fileName, format);
      downloadBlob(blob, fullName);
      onDownload?.(fullName);
      showMessage({ type: 'success', content: t('downloadSuccess') });
      // 下载后关闭截图层,与主流截图工具交互一致
      this.close();
    } catch (error) {
      onDownloadError?.(error);
      showMessage({ type: 'error', content: t('downloadError') });
    }
  };

  close = (): void => {
    const { close, trigger } = this.props;
    if (trigger) trigger.style.opacity = '1';
    this.setState({ step: 0, startX: 0, startY: 0, endX: 0, endY: 0 }, () => {
      close();
      setOverflow('');
      this.dom.style.cursor = '';
    });
  };

  render(): React.ReactElement {
    const {
      actions,
      theme = 'light',
      tools,
      defaultTool,
      zIndex = 9998,
      onAnnotationChange,
    } = this.props;
    const { step, startX, startY, endX, endY } = this.state;
    const pointer = [startX, startY, endX, endY];
    const rootStyle: React.CSSProperties = {
      position: 'fixed',
      inset: 0,
      width: '100%',
      height: '100%',
      userSelect: 'none',
      zIndex,
    };
    return (
      <div
        className={`${ROOT_CLASS} shotmark-theme-${theme}`}
        style={rootStyle}
        onMouseDownCapture={() => this.dom?.focus({ preventScroll: true })}
      >
        {step > 0 && (
          <AnnotationCanvas
            step={step}
            pointer={pointer}
            actions={actions}
            tools={tools}
            defaultTool={defaultTool}
            onAnnotationChange={onAnnotationChange}
            onEdit={this.touchUp}
            onSubmit={this.submit}
            onCopy={this.copy}
            onDownload={this.download}
            onClose={this.close}
          />
        )}
        <SelectionLayer pointer={pointer} step={step} onMove={this.touchMove} onUp={this.touchUp} />
      </div>
    );
  }
}

export default Stage;
