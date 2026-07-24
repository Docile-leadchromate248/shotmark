/**
 * 绘图事件分发中枢:鼠标按下分「绘制新图形 / 选中已有图形 / 拖调整点」三态,
 * 管理图形数组、撤销栈、智能选中、改色改大小、键盘快捷键、截图区域原点变化补偿。
 *
 * 保留 class 组件:内部大量命令式状态(this.ctx / this.stack / document 级监听)与
 * 异步回写链路,转 hooks 反而臃肿且易引入回归。
 */
import React, { Component } from 'react';

import type {
  Dot,
  DrawConfig,
  GraphPath,
  GraphType,
  MosaicExportRect,
  MosaicPath,
  SelectedInfo,
} from './types';

import Graphics from './components/graphics';
import {
  BORDER_CLASS,
  CLICK_THRESHOLD,
  DOT_CURSOR,
  FONT_MAX,
  FONT_MIN,
  ROOT_CLASS,
  STROKE_MAX,
  STROKE_MIN,
  SVG_NS,
  clampMosaicSoftness,
  WHEEL_SIZE_DEBOUNCE_MS,
  WHEEL_SIZE_STEP,
  clampMosaicSize,
} from './const';
import {
  draw,
  getKeys,
  initDefaultConfig,
  setConfig as setDrawConfig,
  registerGraphPlugins,
  discardActiveText,
  restyleActiveText,
} from './graphs';
import { applyMosaicToCanvas, getRectInCanvas } from './mosaic-renderer';
import Stack from './stack';
import { createDots, createId } from './utils';
import { captureHtml } from './generate-image';
import { drawHTML } from './rasterizer';

// 注册全部图形插件并灌入默认配置(注册中心在 graphs/index,避免此处重复罗列)
registerGraphPlugins();
initDefaultConfig();

const keys = getKeys();

/** draw-board 暴露给父层的命令接口 */
export interface DrawBoardApi {
  clear: () => void;
  goto: (step: number) => void;
  getImage: () => { draw: string; width: number; height: number; mosaics: MosaicExportRect[] };
  setConfig: (type: GraphType | 'move', value: DrawConfig | boolean) => void;
  updateSelected: (patch: DrawConfig) => void;
}

export type { SelectedInfo };

interface DrawBoardProps {
  /** 当前绘制工具类型 */
  type: string;
  /** 挂载完成回调:向父层注册命令接口 */
  onMount: (api: DrawBoardApi) => void;
  /** 选中图形变化回调 */
  onSelect?: (selected: SelectedInfo | null) => void;
  /** 选区四顶点 [sx, sy, ex, ey];变化时反向补偿已有标注 */
  pointer?: number[];
  /** 标注数据变更回调 */
  onGraphChange?: (graph: GraphPath[]) => void;
}

interface DrawBoardState {
  dots: Dot[];
  graph: GraphPath[];
  isAdjust: boolean;
  dragCursor: string;
  mosaicPreviewReady: boolean;
  /** hover 到边缘的马赛克 id(马赛克工具选中时生效) */
  hoveredMosaicId: string | null;
}

/** 本次操作上下文 */
interface OpContext {
  modalType?: 'draw' | 'adjust' | 'selected' | '';
  type?: GraphType | null;
  targetId?: string | null;
  dotId?: string;
  shiftKey?: boolean;
  start?: number[];
  move?: boolean;
}

export { keys };

class DrawBoard extends Component<DrawBoardProps, DrawBoardState> {
  private stack = new Stack();

  private borderDom!: HTMLElement;

  // 当前选中的已有图形(持久保存,供面板改色/大小;不放 ctx 因 mouseUp 会清空 ctx)
  private selectedId: string | null = null;

  private selectedType: GraphType | null = null;

  private ctx: OpContext = {
    modalType: '',
    type: null,
    targetId: null,
    start: [],
    move: false,
  };

  private dom!: SVGSVGElement;

  private mosaicCanvasRef = React.createRef<HTMLCanvasElement>();

  private mosaicBaseCanvas: HTMLCanvasElement | null = null;

  private previewCaptureToken = 0;

  /** wheel 事件防抖计时器 */
  private wheelDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  state: DrawBoardState = {
    dots: [],
    graph: [],
    isAdjust: false,
    dragCursor: '',
    mosaicPreviewReady: false,
    hoveredMosaicId: null,
  };

  componentDidMount(): void {
    const { onMount } = this.props;
    this.borderDom = document.querySelector(`.${ROOT_CLASS} .${BORDER_CLASS}`) as HTMLElement;
    const boardSvg = this.borderDom?.querySelector('svg.graphics-draw') as SVGSVGElement | null;
    this.dom = boardSvg || (this.borderDom?.querySelector('svg') as SVGSVGElement);
    onMount({
      clear: this.clear,
      goto: this.goto,
      getImage: this.getImage,
      setConfig: this.setConfig,
      updateSelected: this.updateSelected,
    });
    window.addEventListener('keydown', this.handleKeyDown, true);
    // 监听整个选区盒：svg 图形与文字编辑框都能收到滚轮调大小。
    this.borderDom.addEventListener('wheel', this.handleWheel, { passive: false });
    this.captureMosaicPreviewBase();
  }

  componentWillUnmount(): void {
    window.removeEventListener('keydown', this.handleKeyDown, true);
    document.removeEventListener('mousemove', this.docMove);
    document.removeEventListener('mouseup', this.docUp);
    this.borderDom?.removeEventListener('wheel', this.handleWheel);
    // 清理防抖计时器
    if (this.wheelDebounceTimer) {
      clearTimeout(this.wheelDebounceTimer);
      this.wheelDebounceTimer = null;
    }
    this.previewCaptureToken += 1;
    this.mosaicBaseCanvas = null;
    // 兜底复位拖拽期间锁定的光标:拖拽中途按 Esc 退出会直接卸载组件,handleUp 不触发
    document.body.style.cursor = '';
  }

  // 调整截图区域时 .border 原点变化会让 svg 坐标系整体平移,已有标注会跟着视觉漂移。
  // 检测原点变化量,对所有标注反向补偿,使其页面绝对位置不动。
  componentDidUpdate(prevProps: DrawBoardProps, _prevState: DrawBoardState): void {
    const prev = prevProps.pointer || [];
    const cur = this.props.pointer || [];
    const dx = (prev[0] || 0) - (cur[0] || 0);
    const dy = (prev[1] || 0) - (cur[1] || 0);
    if (dx || dy) {
      const { graph } = this.state;
      if (graph.length) {
        const next = graph.map((p) => {
          const type = (p.id || '').split('-')[0] as GraphType;
          const fn = draw.translate[type];
          return fn ? Object.assign({}, fn(p, dx, dy), { id: p.id }) : p;
        });
        this.setState({ graph: next, dots: [] }, () => this.emitGraphChange(next));
        this.selectedId = null;
        this.selectedType = null;
        this.notifySelect();
      }
    }

    // 工具切换时:若从马赛克/高亮切走,清除对应选中态和 hover 态
    if (prevProps.type !== this.props.type) {
      if (this.props.type !== 'mosaic') {
        if (this.selectedType === 'mosaic') {
          this.selectedId = null;
          this.selectedType = null;
          this.setState({ dots: [], hoveredMosaicId: null });
          this.notifySelect();
        } else {
          this.setState({ hoveredMosaicId: null });
        }
      }

      if (this.props.type !== 'highlight' && this.selectedType === 'highlight') {
        this.selectedId = null;
        this.selectedType = null;
        this.setState({ dots: [] });
        this.notifySelect();
      }
    }

    const pointerChanged = prev.join(',') !== cur.join(',');
    if (pointerChanged) this.captureMosaicPreviewBase();

    this.drawMosaicPreviewLayer();
  }

  emitGraphChange(graph: GraphPath[] = this.state.graph): void {
    this.props.onGraphChange?.([...graph]);
  }

  getMosaicPaths(): MosaicPath[] {
    return this.state.graph.filter((item): item is MosaicPath => item.type === 'mosaic');
  }

  captureMosaicPreviewBase = async (): Promise<void> => {
    const [startX = 0, startY = 0, endX = 0, endY = 0] = this.props.pointer || [];
    const width = Math.max(0, endX - startX);
    const height = Math.max(0, endY - startY);

    if (!width || !height) {
      this.mosaicBaseCanvas = null;
      if (this.state.mosaicPreviewReady) this.setState({ mosaicPreviewReady: false });
      return;
    }

    const token = ++this.previewCaptureToken;
    try {
      const html = captureHtml({ startX, startY, endX, endY });
      const { image } = await drawHTML(html, {
        width: window.innerWidth,
        height: window.innerHeight,
        zoom: 1,
      });
      if (token !== this.previewCaptureToken) return;

      const base = document.createElement('canvas');
      base.width = width;
      base.height = height;
      const baseCtx = base.getContext('2d');
      if (!baseCtx) return;
      baseCtx.drawImage(
        image,
        window.scrollX + startX,
        window.scrollY + startY,
        width,
        height,
        0,
        0,
        width,
        height,
      );

      this.mosaicBaseCanvas = base;
      if (!this.state.mosaicPreviewReady) {
        this.setState({ mosaicPreviewReady: true }, this.drawMosaicPreviewLayer);
      } else {
        this.drawMosaicPreviewLayer();
      }
    } catch {
      if (token !== this.previewCaptureToken) return;
      this.mosaicBaseCanvas = null;
      if (this.state.mosaicPreviewReady) this.setState({ mosaicPreviewReady: false });
      this.drawMosaicPreviewLayer();
    }
  };

  drawMosaicPreviewLayer = (): void => {
    const canvas = this.mosaicCanvasRef.current;
    if (!canvas || !this.dom) return;

    const width = this.dom.clientWidth;
    const height = this.dom.clientHeight;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);

    const mosaics = this.getMosaicPaths();
    const base = this.mosaicBaseCanvas;
    if (!base || !mosaics.length) return;

    const composite = document.createElement('canvas');
    composite.width = width;
    composite.height = height;
    const compCtx = composite.getContext('2d');
    if (!compCtx) return;
    compCtx.drawImage(base, 0, 0, width, height);

    const rects = mosaics.map((path) => getRectInCanvas(path, composite));
    rects.forEach((rect) => applyMosaicToCanvas(compCtx, composite, rect));

    rects.forEach((rect) => {
      if (!rect.w || !rect.h) return;
      ctx.drawImage(composite, rect.x, rect.y, rect.w, rect.h, rect.x, rect.y, rect.w, rect.h);
    });
  };

  // 键盘快捷键;文字输入态不拦截。range/color 等非文本 input 不算编辑态。
  handleKeyDown = (ev: KeyboardEvent): void => {
    // IME 组合输入中不拦截
    if (ev.isComposing) return;

    const el = ev.target as HTMLElement;
    const tag = el && el.tagName;
    const inputType = el && ((el as HTMLInputElement).type || '').toLowerCase();
    const isNonTextInput = ['range', 'color', 'checkbox', 'radio', 'button', 'submit'].includes(
      inputType,
    );
    const isEditing =
      el && (el.isContentEditable || tag === 'TEXTAREA' || (tag === 'INPUT' && !isNonTextInput));
    if (isEditing) return;

    const meta = ev.metaKey || ev.ctrlKey;
    if (meta && (ev.key === 'z' || ev.key === 'Z')) {
      ev.preventDefault();
      this.goto(ev.shiftKey ? 1 : -1);
    } else if (ev.key === 'Delete' || ev.key === 'Backspace') {
      if (this.selectedId) {
        ev.preventDefault();
        this.deleteSelected();
      }
    }
  };

  getGraphById(id: string | null | undefined): GraphPath | undefined {
    if (!id) return undefined;
    return this.state.graph.find((data) => data.id === id);
  }

  getGraphTypeById(id: string | null | undefined): GraphType | null {
    if (!id) return null;
    const [type] = id.split('-') as [GraphType];
    return type || null;
  }

  getWheelTarget(
    target: EventTarget | null,
  ):
    | { mode: 'active-text' }
    | { mode: 'graph'; id: string; type: GraphType; path: GraphPath }
    | null {
    if (!(target instanceof Element)) return null;

    const textEditor = target.closest('.text-edit');
    if (textEditor) return { mode: 'active-text' };

    const el = target.closest('[id]') as Element | null;
    if (!el) return null;

    const { id } = el;
    if (id.startsWith('adjust-')) return this.getSelectedWheelTarget();

    const path = this.getGraphById(id);
    const type = this.getGraphTypeById(id);
    if (!path || !type) return null;
    return { mode: 'graph', id, type, path };
  }

  getSelectedWheelTarget(): { mode: 'graph'; id: string; type: GraphType; path: GraphPath } | null {
    const id = this.selectedId;
    const type = this.selectedType;
    const path = this.getGraphById(id);
    if (!id || !type || !path) return null;
    return { mode: 'graph', id, type, path };
  }

  getSizePatch(type: GraphType, path: GraphPath | null, deltaY: number): DrawConfig | null {
    const direction = Math.sign(deltaY) * -1;
    if (!direction) return null;

    if (type === 'text' || type === 'number') {
      const current = (path as DrawConfig | null)?.fontSize ?? draw.config[type]?.fontSize ?? 18;
      const next = Math.max(FONT_MIN, Math.min(FONT_MAX, current + direction * WHEEL_SIZE_STEP));
      return next === current ? null : { fontSize: next };
    }

    const graphPath = path as GraphPath & { _w?: number; strokeWidth?: number };
    const current =
      type === 'arrow'
        ? (graphPath._w ?? 4)
        : (graphPath.strokeWidth ?? draw.config[type]?.strokeWidth ?? 4);
    const next = Math.max(STROKE_MIN, Math.min(STROKE_MAX, current + direction * WHEEL_SIZE_STEP));
    return next === current ? null : { strokeWidth: next };
  }

  queueWheelSnapshot(): void {
    if (this.wheelDebounceTimer) clearTimeout(this.wheelDebounceTimer);
    this.wheelDebounceTimer = setTimeout(() => {
      this.snapshot();
      this.wheelDebounceTimer = null;
    }, WHEEL_SIZE_DEBOUNCE_MS);
  }

  /**
   * 滚轮改大小遵循「hover 命中优先，当前选中兜底」：
   * - 已提交图形：hover 到哪个图形就改哪个，并同步成为当前选中项；
   * - 文字编辑态：hover 在 contenteditable 上直接改编辑中的字号，无需先失焦；
   * - 连续滚轮合并为一次撤销记录，避免把撤销栈打满。
   */
  handleWheel = (ev: WheelEvent): void => {
    if (
      this.ctx.modalType === 'draw' ||
      this.ctx.modalType === 'adjust' ||
      this.ctx.modalType === 'selected'
    )
      return;

    const target = this.getWheelTarget(ev.target);
    if (!target) return;
    ev.preventDefault();

    if (target.mode === 'active-text') {
      const patch = this.getSizePatch('text', null, ev.deltaY);
      if (!patch) return;
      setDrawConfig('text', patch);
      restyleActiveText(patch);
      this.notifySelect();
      return;
    }

    const { id, type, path } = target;
    const patch = this.getSizePatch(type, path, ev.deltaY);
    if (!patch) return;
    setDrawConfig(type, patch);
    if (this.selectedId !== id || this.selectedType !== type) this.autoSelect(id, type);
    this.applySelectedPatch(id, type, patch, false);
    this.queueWheelSnapshot();
  };

  // 删除当前选中图形并记快照
  deleteSelected(): void {
    const { graph } = this.state;
    const next = graph.filter((d) => d.id !== this.selectedId);
    this.selectedId = null;
    this.selectedType = null;
    this.setState({ graph: next, dots: [] }, () => this.emitGraphChange(next));
    this.stack.insert([...next]);
    this.notifySelect();
  }

  get targetGraph(): GraphPath {
    const { graph } = this.state;
    const path = graph.find((data) => data.id === this.ctx.targetId);
    return Object.assign({}, path) as GraphPath;
  }

  get targetIndex(): number {
    const { graph } = this.state;
    return graph.findIndex((data) => data.id === this.ctx.targetId);
  }

  bringGraphToFront(id: string): void {
    const { graph } = this.state;
    const index = graph.findIndex((item) => item.id === id);
    if (index < 0 || index === graph.length - 1) return;
    const [target] = graph.splice(index, 1);
    graph.push(target);
    this.setState({ graph: [...graph] });
  }

  setConfig = (type: GraphType | 'move', value: DrawConfig | boolean): void => {
    if (type === 'move') {
      this.setState({ isAdjust: value as boolean });
    } else {
      setDrawConfig(type, value as DrawConfig);
    }
  };

  // 通知外层「当前选中了哪个图形」,供 ConfigPanel 读取真实属性
  notifySelect(): void {
    const { onSelect } = this.props;
    if (!onSelect) return;
    const { graph } = this.state;
    const path = graph.find((d) => d.id === this.selectedId);
    onSelect(path && this.selectedType ? { id: path.id!, type: this.selectedType, path } : null);
  }

  applySelectedPatch(
    id: string,
    type: GraphType,
    patch: DrawConfig,
    shouldSnapshot: boolean,
  ): void {
    const { graph } = this.state;
    const index = graph.findIndex((d) => d.id === id);
    if (index < 0) return;
    const old = graph[index];
    const fn = draw.restyle[type];
    const next = fn ? fn(old, patch) : (Object.assign({}, old, patch) as GraphPath);
    graph.splice(index, 1, Object.assign({}, next, { id }));
    this.selectedId = id;
    this.selectedType = type;
    this.setState({ graph: [...graph] }, () => this.emitGraphChange(graph));
    if (shouldSnapshot) this.snapshot();
    this.notifySelect();
  }

  // 选中图形后改颜色/大小:把面板的值作用到当前选中的已有图形
  updateSelected = (patch: DrawConfig): void => {
    if (!this.selectedId || !this.selectedType) return;
    this.applySelectedPatch(this.selectedId, this.selectedType, patch, true);
  };

  // 异步返回 path(文字 contenteditable 链路)
  setPath = (id: string, [pathNew]: [GraphPath], type: GraphType): void => {
    const { graph } = this.state;
    const index = graph.findIndex((data) => data.id === id);
    if (pathNew && typeof pathNew === 'object') {
      if (index > -1) {
        graph.splice(index, 1, Object.assign({}, pathNew, { id }));
      } else {
        graph.push(Object.assign({}, pathNew, { id: `${type}-${createId()}` }));
      }
      this.setState({ graph: [...graph] }, () => this.emitGraphChange(graph));
      this.snapshot();
    }
  };

  getImage = (): { draw: string; width: number; height: number; mosaics: MosaicExportRect[] } => {
    const svg = this.dom.cloneNode(true) as SVGSVGElement;
    const { clientWidth, clientHeight } = this.dom;
    const mosaics = this.getMosaicPaths().map((item) => ({
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
      blockSize: clampMosaicSize(item.mosaicSize),
      blurStrength: clampMosaicSoftness(item.mosaicSoftness),
    }));

    // 删除可能存在的调整点
    svg.querySelectorAll('circle.draw-dot').forEach((d) => d.remove());
    // 真实马赛克在导出链路做像素处理,叠加 SVG 中剔除 mosaic 遮罩图层避免二次覆盖
    svg.querySelectorAll('[id^="mosaic-"]').forEach((d) => d.remove());
    const dom = `<svg version="1.1" xmlns="${SVG_NS}">${svg.innerHTML}</svg>`;
    // btoa 不支持汉字,采用 utf-8 不用 base64
    return {
      draw: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(dom)}`,
      width: clientWidth,
      height: clientHeight,
      mosaics,
    };
  };

  // 把 document 事件 clientX/Y 换算为相对绘制 svg 原点的坐标(支持移出选区自由延伸)
  toOffset(ev: { clientX: number; clientY: number }): number[] {
    const rect = this.dom.getBoundingClientRect();
    return [ev.clientX - rect.left, ev.clientY - rect.top];
  }

  // 智能选中:按点击目标判断绘制 / 选中已有图形 / 拖调整点,不再依赖「move 按钮」
  mouseDown = (ev: React.MouseEvent<SVGSVGElement>): void => {
    const { target, clientX, clientY } = ev.nativeEvent;
    // 统一用 svg 相对坐标(与 docMove 的 toOffset 同源),避免点在图形上时 offsetX/Y 跳变
    const [offsetX, offsetY] = this.toOffset({ clientX, clientY });
    const { dots, graph } = this.state;

    const ctx: {
      offsetX: number;
      offsetY: number;
      path?: GraphPath;
      config?: DrawConfig;
      setPath?: (p: [GraphPath]) => void;
    } = {
      offsetX,
      offsetY,
    };
    const { tagName, id } = target as SVGElement;
    let drawing: ((this: { ctx: unknown }, point: number[]) => any) | null = null;
    this.ctx.start = [offsetX, offsetY];
    this.ctx.shiftKey = !!ev.nativeEvent.shiftKey;
    this.ctx.move = false;

    const isAdjustDot = /adjust/g.test(id);
    // id 命中某个已有图形 → 选中已有图形
    const hitGraph = !isAdjustDot && id && graph.some((d) => d.id === id);
    // 马赛克工具下,命中 mosaic 但未处于 hover 边缘态 → 视为未命中(允许在内部绘制新马赛克)
    const isMosaicHitIgnored =
      hitGraph &&
      id.startsWith('mosaic-') &&
      this.props.type === 'mosaic' &&
      this.selectedId !== id &&
      !this.state.hoveredMosaicId;
    const isHighlightHitIgnored =
      hitGraph && id.startsWith('highlight-') && this.props.type !== 'highlight';

    if (isAdjustDot) {
      // 拖动选中图形的调整点(改大小)
      // 优先从 state.dots 取 target;hover 态下 state.dots 为空,从 hoveredMosaicId 兜底
      let targetId = dots[0]?.target;
      if (!targetId && this.state.hoveredMosaicId) {
        targetId = this.state.hoveredMosaicId;
        // hover 态点击调整点 → 进入选中态
        this.selectedId = targetId;
        this.selectedType = 'mosaic';
        this.notifySelect();
      }
      this.ctx.modalType = 'adjust';
      this.ctx.targetId = targetId;
      this.ctx.dotId = id;
      [this.ctx.type] = (targetId || '').split('-') as [GraphType];
      drawing = draw.dotDown[this.ctx.type!] as any;
    } else if (hitGraph && !isMosaicHitIgnored && !isHighlightHitIgnored) {
      // 选中已有图形(整体平移 / 显示调整点)
      this.bringGraphToFront(id);
      this.ctx.modalType = 'selected';
      this.ctx.targetId = id;
      [this.ctx.type] = id.split('-') as [GraphType];
      this.selectedId = id;
      [this.selectedType] = id.split('-') as [GraphType];
      this.notifySelect();
      drawing = draw.selected[this.ctx.type!] as any;
    } else if (tagName === 'svg' || isMosaicHitIgnored || isHighlightHitIgnored) {
      // 点空白(或马赛克/高亮穿透区):取消选中并开始绘制当前工具
      this.setState({ dots: [], hoveredMosaicId: null });
      this.selectedId = null;
      this.selectedType = null;
      this.notifySelect();
      const { type } = this.props;
      this.ctx.type = type as GraphType;
      this.ctx.modalType = 'draw';
      this.ctx.targetId = `${type}-${createId()}`;
      drawing = draw.down[type as GraphType] as any;
    }

    if (drawing) {
      ctx.path = this.targetGraph;
      ctx.config = draw.config[this.ctx.type!] || {};
      // 固化 targetId/type 进闭包:文字 setPath 在 contenteditable 失焦后异步触发,
      // 此时 handleUp 已清空 this.ctx,读 this.ctx.targetId 会得到 undefined
      const fixedId = this.ctx.targetId!;
      const fixedType = this.ctx.type!;
      ctx.setPath = (pathNew: [GraphPath]) => this.setPath(fixedId, pathNew, fixedType);
      const data = drawing.call({ ctx }, [offsetX, offsetY]) || [];
      this.reDraw(data);
      // 锁定拖拽期间光标(svg 内联 + document.body),避免在描边/空隙、图形/背景间移动时闪烁
      const lockCursor = this.lockCursorFor();
      this.setState({ dragCursor: lockCursor });
      document.body.style.cursor = lockCursor;
      // 拖拽期间用 document 级监听:鼠标移出选区也能继续绘制,任意位置松手都能结束
      document.addEventListener('mousemove', this.docMove);
      document.addEventListener('mouseup', this.docUp);
    }
  };

  // 双击已有文字 → 二次编辑;其余图形双击忽略
  handleDoubleClick = (ev: React.MouseEvent<SVGSVGElement>): void => {
    const { id } = ev.target as SVGElement;
    if (!id) return;
    const { graph } = this.state;
    const path = graph.find((d) => d.id === id);
    if (!path) return;
    const [type] = id.split('-') as [GraphType];
    const fn = draw.edit[type];
    if (!fn) return;
    // 双击文字会先触发一次 mouseDown(选中态 + document 监听),先清理避免拖拽残留
    document.removeEventListener('mousemove', this.docMove);
    document.removeEventListener('mouseup', this.docUp);
    this.setState({ dragCursor: '', dots: [] });
    document.body.style.cursor = '';
    this.selectedId = null;
    this.selectedType = null;
    this.notifySelect();
    const fixedId = id;
    const ctx = {
      path,
      config: draw.config[type] || {},
      setPath: (pathNew: [GraphPath]) => this.setPath(fixedId, pathNew, type),
    };
    fn.call({ ctx } as any, []);
  };

  // 计算本次拖拽应锁定的光标
  lockCursorFor(): string {
    const { modalType, dotId } = this.ctx;
    if (modalType === 'adjust') {
      const dotName = (dotId || '').split('-').slice(1).join(' ');
      return DOT_CURSOR[dotName] || 'move';
    }
    if (modalType === 'selected') return 'grabbing';
    return 'crosshair';
  }

  docMove = (ev: MouseEvent): void => {
    this.ctx.shiftKey = !!ev.shiftKey;
    const [offsetX, offsetY] = this.toOffset(ev);
    this.handleMove(offsetX, offsetY);
  };

  docUp = (ev: MouseEvent): void => {
    document.removeEventListener('mousemove', this.docMove);
    document.removeEventListener('mouseup', this.docUp);
    const [offsetX, offsetY] = this.toOffset(ev);
    this.handleUp(offsetX, offsetY);
  };

  handleMove(offsetX: number, offsetY: number): void {
    let drawing: ((this: { ctx: unknown }, point: number[]) => any) | null = null;
    const { modalType, type, dotId, targetId } = this.ctx;
    const { dots } = this.state;
    const ctx: Record<string, unknown> = {
      start: this.ctx.start,
      shiftKey: this.ctx.shiftKey,
      dots,
      offsetX,
      offsetY,
      path: this.targetGraph,
      config: draw.config[type!] || {},
      setPath: (path: [GraphPath]) => this.setPath(targetId!, path, type!),
    };
    this.ctx.move = true;

    if (modalType === 'draw') {
      drawing = draw.move[type!] as any;
    } else if (modalType === 'adjust') {
      drawing = draw.adjust[type!] as any;
      ctx.target = dotId!.split('-')[1];
    } else if (modalType === 'selected') {
      drawing = draw.adjust[type!] as any;
    }

    if (drawing) {
      ctx.config = draw.config[this.ctx.type!] || {};
      const [path, dotsNew] = drawing.call({ ctx }, [offsetX, offsetY]) || [];
      // 绘制态也实时显示调整点(与选中态一致):各图形 move 已产出对应 dots,
      // 自由手绘(brush)不产出 dots 故自然不显示,符合预期。
      this.reDraw([path, dotsNew]);
    }
  }

  handleUp(offsetX: number, offsetY: number): void {
    const { targetId, type, modalType, start = [] } = this.ctx;
    // 解除拖拽光标锁定
    this.setState({ dragCursor: '' });
    document.body.style.cursor = '';

    /**
     * 防误触:形状类工具(矩形/椭圆/箭头/直线)必须按住拖拽出有效尺寸才落笔。
     * 单击或微移(位移 ≤ CLICK_THRESHOLD)只会留下退化图形(0 尺寸/孤立点),直接丢弃。
     * 画笔(brush)是自由路径,首尾可相连(一笔画闭合),不能用起点到终点的直线距离判定,
     * 否则闭合图形会被误删——改用"绘制过程中是否发生移动"(this.ctx.move)判定。
     * 文字走单击弹输入框的独立链路,不在此限制。
     */
    if (modalType === 'draw' && type !== 'text' && type !== 'number') {
      const [sx = 0, sy = 0] = start;
      const moved = Math.hypot(offsetX - sx, offsetY - sy);
      const invalid = type === 'brush' ? !this.ctx.move : moved <= CLICK_THRESHOLD;
      if (invalid) {
        // 移除 mouseDown 阶段已 push 进画板的初始图形,并复位图形模块级状态
        const { graph } = this.state;
        const next = graph.filter((d) => d.id !== targetId);
        this.setState({ graph: next, dots: [] }, () => this.emitGraphChange(next));
        draw.up[type!]?.call({ ctx: {} } as any, [offsetX, offsetY]);
        this.ctx = {};
        return;
      }
    }

    // 只点击没绘图则不计入历史
    if (this.ctx.move) this.snapshot();
    const ctx = {
      offsetX,
      offsetY,
      path: this.targetGraph,
      config: draw.config[type!] || {},
      setPath: (path: [GraphPath]) => this.setPath(targetId!, path, type!),
    };
    const drawing = draw.up[type!];
    if (drawing) {
      this.reDraw((drawing.call({ ctx } as any, [offsetX, offsetY]) as any) || []);
    }
    // 画完即选中:刚绘制完成的图形自动进入选中态(文字走异步链路,不在此自动选中)
    if (modalType === 'draw' && (this.ctx.move || type === 'number') && type !== 'text') {
      this.autoSelect(targetId!, type!);
    }
    this.ctx = {};
  }

  // 把指定图形设为选中态:记录 selectedId/Type、生成调整点、通知面板
  autoSelect(id: string, type: GraphType): void {
    const { graph } = this.state;
    const path = graph.find((d) => d.id === id);
    if (!path) return;
    this.selectedId = id;
    this.selectedType = type;
    const fn = draw.selected[type];
    if (fn) {
      this.ctx.targetId = id;
      const [, dotsNew] = fn.call({ ctx: { path } } as any, []) || [];
      if (dotsNew) this.reDraw([undefined, dotsNew]);
    }
    this.notifySelect();
  }

  // 记录画板快照
  snapshot(): void {
    const { graph } = this.state;
    this.stack.insert([...graph]);
  }

  // 前进后退
  goto = (step: number): void => {
    if (step > 0) this.stack.next();
    else this.stack.prev();
    const graph = this.stack.item || [];
    this.selectedId = null;
    this.selectedType = null;
    this.setState({ graph: [...graph], dots: [] }, () => this.emitGraphChange(graph));
    this.notifySelect();
  };

  clear = (): void => {
    // 先丢弃正在编辑的未提交文字(命令式 <p>,不在 graph 数组里,否则清空后会残留)
    discardActiveText();
    this.stack.reset();
    this.selectedId = null;
    this.selectedType = null;
    this.notifySelect();
    this.setState({ graph: [], dots: [] }, () => this.emitGraphChange([]));
  };

  // 绘制或重绘路径 + 调整点
  reDraw([path, dots]: [GraphPath?, Dot[]?]): void {
    const { graph } = this.state;
    if (path && typeof path === 'object') {
      const p = Object.assign({}, path, { id: this.ctx.targetId });
      if (this.targetIndex > -1) {
        graph.splice(this.targetIndex, 1, p);
      } else {
        graph.push(p);
      }
      this.setState({ graph: [...graph] }, () => this.emitGraphChange(graph));
    }
    if (dots && Array.isArray(dots)) {
      this.setState({
        dots: dots.map((dot) => Object.assign(dot, { target: this.ctx.targetId })),
      });
    }
  }

  /** 马赛克边缘 hover 回调:仅当没有马赛克在编辑中时生效 */
  handleMosaicEdgeHover = (id: string | null): void => {
    // 有马赛克选中或正在绘制时,抑制其他马赛克的 hover 态
    if (this.selectedId || (this.ctx.modalType === 'draw' && this.ctx.type === 'mosaic')) {
      if (this.state.hoveredMosaicId) this.setState({ hoveredMosaicId: null });
      return;
    }
    if (this.state.hoveredMosaicId !== id) {
      this.setState({ hoveredMosaicId: id });
    }
  };

  render(): React.ReactElement {
    const { dots, graph, isAdjust, dragCursor, mosaicPreviewReady, hoveredMosaicId } = this.state;
    const { type } = this.props;
    const drawingGraphId = this.ctx.modalType === 'draw' ? this.ctx.targetId || null : null;

    // 当有马赛克在编辑/绘制中时,不显示其他马赛克的 hover 态
    const hasActiveMosaic = !!(this.selectedId || drawingGraphId);
    const effectiveHoveredMosaicId = hasActiveMosaic ? null : hoveredMosaicId;

    // 当马赛克工具 hover 到边缘时显示对应马赛克的调整点
    let effectiveDots = dots;
    if (type === 'mosaic' && effectiveHoveredMosaicId && !this.selectedId && dots.length === 0) {
      const hoveredPath = graph.find((d) => d.id === effectiveHoveredMosaicId) as
        MosaicPath | undefined;
      if (hoveredPath) {
        const { x, y, w, h } = hoveredPath;
        effectiveDots = createDots([x, y], [x + w, y + h]).map((dot: Dot) =>
          Object.assign(dot, { target: effectiveHoveredMosaicId }),
        );
      }
    }

    return (
      <>
        <canvas
          ref={this.mosaicCanvasRef}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
        />
        <Graphics
          dots={effectiveDots}
          graph={graph}
          isAdjust={isAdjust}
          dragCursor={dragCursor}
          onMouseDown={this.mouseDown}
          onDoubleClick={this.handleDoubleClick}
          mosaicPreviewEnabled={mosaicPreviewReady}
          selectedId={this.selectedId}
          drawingGraphId={drawingGraphId}
          activeToolType={type}
          hoveredMosaicId={effectiveHoveredMosaicId}
          onMosaicEdgeHover={this.handleMosaicEdgeHover}
        />
      </>
    );
  }
}

export default DrawBoard;
