/**
 * 命令式控制器:在 body 上挂载/卸载全屏标注层。
 *
 * 用法:
 *   ShotmarkController.start({ region, onShot, onCancel })
 *   ShotmarkController.close()
 *
 * 注:原库的 `Box`(组件式入口)依赖 Shineout 且业务从未使用,迁移后移除,保持组件零 UI 库依赖。
 */
import { createRoot, type Root } from 'react-dom/client';

import { copyBlobToClipboard, dataUrlToBlob } from './clipboard';
import { clampMosaicSize, clampMosaicSoftness, DRAW_ORDER, STROKE_MAX, STROKE_MIN } from './const';
import { setNumberSeed } from './graphs/number';
import { applyDefaultConfig, applyUserMemory, initDefaultConfig } from './graphs/registry';
import { setLocale, setLocaleOverrides, t } from './i18n';
import { showMessage } from './message';
import { setThemeMode } from './theme-mode';
import type { GraphType, Rect, ShotmarkOptions, ShotmarkResult } from './types';

import Stage from './stage';

let shotting = false;
let screenDom: HTMLDivElement | null = null;
let screenRoot: Root | null = null;

const STROKE_TOOLS: GraphType[] = ['rectangle', 'ellipse', 'line', 'brush', 'arrow', 'measure'];

const clampLineWidth = (value?: number): number | undefined => {
  if (!Number.isFinite(value)) return undefined;
  return Math.max(STROKE_MIN, Math.min(STROKE_MAX, Math.round(value as number)));
};

const normalizeTools = (tools?: GraphType[]): GraphType[] => {
  const source = Array.isArray(tools) && tools.length ? tools : DRAW_ORDER;
  const enabled = source.filter((tool) => DRAW_ORDER.includes(tool));
  if (!enabled.length) return [...DRAW_ORDER];
  return [...new Set(enabled)];
};

const isRect = (value: unknown): value is Rect => {
  if (!value || typeof value !== 'object') return false;
  const v = value as Rect;
  return [v.left, v.top, v.width, v.height].every((n) => Number.isFinite(n));
};

const toBoxRect = (
  region: HTMLElement | Rect,
  padding = 0,
): { left: number; top: number; right: number; bottom: number } => {
  if (region instanceof HTMLElement) {
    const r = region.getBoundingClientRect();
    return {
      left: r.left - padding,
      top: r.top - padding,
      right: r.right + padding,
      bottom: r.bottom + padding,
    };
  }
  return {
    left: region.left - padding,
    top: region.top - padding,
    right: region.left + region.width + padding,
    bottom: region.top + region.height + padding,
  };
};

/**
 * 等「下一帧真正绘制完成」后再执行回调。
 *
 * 双 rAF 而非单 rAF:第一帧 React 才刚提交 DOM,浏览器尚未绘制;第二帧浏览器已完成绘制
 * 并把 CSS 动画提交到合成线程。此后再跑耗时任务,即便占满主线程也不影响已在合成线程
 * 独立运行的动画(如 loading 圆环),从而消除首帧卡顿。
 *
 * @param cb 下一帧绘制后执行的回调
 */
function afterNextPaint(cb: () => void): void {
  requestAnimationFrame(() => requestAnimationFrame(cb));
}

/** 停止截图:先卸载 root 再移除挂载节点(顺序不能反) */
function close(): void {
  if (!shotting) return;
  // close 常在 Stage 的 React 事件链内被调用(如点取消/按 Esc/提交后);
  // 若此处同步 root.unmount() 会触发 React "在渲染期间卸载" 告警。
  // 用 queueMicrotask 延到当前渲染/提交完成后再卸载,规避该竞态。
  const rootToUnmount = screenRoot;
  const domToRemove = screenDom;
  screenRoot = null;
  screenDom = null;
  shotting = false;
  queueMicrotask(() => {
    rootToUnmount?.unmount();
    domToRemove?.remove();
  });
}

/** 开始截图标注 */
function start(props: ShotmarkOptions = {}): void {
  const {
    onShot,
    onShotStart,
    onCancel,
    onCopy,
    onCopyError,
    onDownload,
    onDownloadError,
    region,
    regionPadding = 0,
    autoAnnotate,
    trigger,
    fileName,
    format,
    actions,
    tools,
    defaultTool,
    defaultColor,
    defaultLineWidth,
    zIndex = 9998,
    locale,
    localeText,
    theme = 'light',
    onAnnotationChange,
    numberStart = 1,
    mosaicSize = 2,
    mosaicSoftness = 36,
  } = props;

  if (shotting) return;

  const hasValidRegion = region instanceof HTMLElement || isRect(region);
  const resolvedRegionRect =
    hasValidRegion && region ? toBoxRect(region as HTMLElement | Rect, regionPadding) : undefined;
  const resolvedAutoAnnotate = hasValidRegion ? autoAnnotate !== false : false;

  setLocale(locale);
  setLocaleOverrides(localeText);
  setThemeMode(theme);
  setNumberSeed(numberStart);

  const enabledTools = normalizeTools(tools);
  const resolvedDefaultTool =
    defaultTool && enabledTools.includes(defaultTool) ? defaultTool : undefined;

  // 配置应用顺序保证优先级「用户记忆 > start 选项 > 内置默认」:
  // 1) 重置为内置默认 2) 覆盖本次 start 选项 3) 最后用用户记忆覆盖
  initDefaultConfig();

  if (defaultColor) {
    STROKE_TOOLS.forEach((tool) => applyDefaultConfig(tool, { stroke: defaultColor }));
    applyDefaultConfig('text', { fill: defaultColor });
    applyDefaultConfig('number', { fill: defaultColor });
    applyDefaultConfig('highlight', { fill: defaultColor });
  }

  const lineWidth = clampLineWidth(defaultLineWidth);
  if (lineWidth !== undefined) {
    STROKE_TOOLS.forEach((tool) => applyDefaultConfig(tool, { strokeWidth: lineWidth }));
  }

  applyDefaultConfig('mosaic', {
    mosaicSize: clampMosaicSize(mosaicSize),
    mosaicSoftness: clampMosaicSoftness(mosaicSoftness),
  });

  applyUserMemory();

  const submit = (data: { getImage: () => Promise<ShotmarkResult> }): void => {
    // 1) 立即开 loading(业务在 onShotStart 里 setUploading) 2) 卸载标注层,让 loading 可见
    if (onShotStart) onShotStart();
    close();
    // 3) 把耗时栅格化推迟到 loading 遮罩完成首帧绘制之后再跑,避免重活与 loading 挂载抢同一帧主线程导致首帧卡顿。
    afterNextPaint(() => {
      data.getImage().then(({ image, width, height, pixWidth, pixHeight }) => {
        if (onShot) {
          onShot({ image, width, height, pixWidth, pixHeight });
          return;
        }
        // 默认行为:未传 onShot 时,与 copy 一致,自动复制到剪贴板
        dataUrlToBlob(image, 'image/png')
          .then((blob) => copyBlobToClipboard(blob).then(() => blob))
          .then((blob) => {
            onCopy?.(blob);
            showMessage({ type: 'success', content: t('copySuccess') });
          })
          .catch((error) => {
            onCopyError?.(error);
            showMessage({ type: 'error', content: t('copyError') });
          });
      });
    });
  };

  screenDom = document.createElement('div');
  document.body.appendChild(screenDom);
  screenRoot = createRoot(screenDom);
  screenRoot.render(
    <Stage
      trigger={trigger}
      regionRect={resolvedRegionRect}
      autoAnnotate={resolvedAutoAnnotate}
      fileName={fileName}
      format={format}
      actions={actions}
      tools={enabledTools}
      defaultTool={resolvedDefaultTool}
      zIndex={zIndex}
      onAnnotationChange={onAnnotationChange}
      theme={theme}
      onCopy={onCopy}
      onCopyError={onCopyError}
      onDownload={onDownload}
      onDownloadError={onDownloadError}
      close={() => {
        onCancel?.();
        close();
      }}
      submit={submit as never}
    />,
  );
  shotting = true;
}

const ShotmarkController = { start, close };

export default ShotmarkController;
