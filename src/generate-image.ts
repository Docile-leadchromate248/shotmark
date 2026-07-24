/**
 * 截图导出:把页面渲染为位图,按选区裁剪,叠加标注 svg,生成 base64 图片。
 */
import type { ShotmarkResult } from './types';
import type { MosaicExportRect } from './types';
import { drawHTML } from './rasterizer';

import {
  PIXEL_RATIO,
  ROOT_CLASS,
  clampMosaicSize,
  clampMosaicSoftness,
  resolveMosaicBlockSize,
} from './const';

interface ViewportSize {
  width: number;
  height: number;
}

interface SelectionRect {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

/** 默认马赛克块大小(单位 CSS 像素) */
const DEFAULT_MOSAIC_BLOCK_SIZE = 2;

/**
 * 计算马赛克采样网格。
 * blockSize 越小,采样网格越密,导出效果越细。
 */
export function computeMosaicSampleGrid(
  pixelWidth: number,
  pixelHeight: number,
  ratio: number,
  blockSize?: number,
): { block: number; sampleW: number; sampleH: number } {
  const safeBlock = clampMosaicSize(blockSize ?? DEFAULT_MOSAIC_BLOCK_SIZE);
  const block = Math.max(2, Math.floor(resolveMosaicBlockSize(safeBlock) * ratio));
  return {
    block,
    sampleW: Math.max(1, Math.floor(pixelWidth / block)),
    sampleH: Math.max(1, Math.floor(pixelHeight / block)),
  };
}

const toArray = <T extends Element>(list: ArrayLike<T>): T[] => Array.from(list);

/** 选区矩形归一化为 [x0,y0,x1,y1](容忍 start>end);视口坐标系 */
function normalizeRect({ startX, startY, endX, endY }: SelectionRect) {
  return {
    x0: Math.min(startX, endX),
    y0: Math.min(startY, endY),
    x1: Math.max(startX, endX),
    y1: Math.max(startY, endY),
  };
}

/** 临时标记属性:测量阶段写到 live img 上,克隆后据此处理,finally 清理(避免污染真实 DOM) */
const IMG_MARK_ATTRS = ['data-shot-w', 'data-shot-h', 'data-shot-inside'];

/**
 * 隐藏元素标记属性:测量阶段写到自身 display:none 的 live 元素上,克隆后整棵子树删除,finally 清理。
 * 删除 display:none 子树不占布局空间,对选区内可见元素的视口位置零影响 → 裁剪不错位,
 * 同时砍掉全屏长页里未展开的 Modal/Drawer/折叠区/离屏虚拟列表项等大量节点,降低 drawHTML 序列化耗时。
 */
const HIDDEN_MARK = 'data-shot-hidden';

/**
 * 非渲染的功能性元素:UA 默认即 display:none,但绝不可当「隐藏内容」删除。
 * 尤其 STYLE / LINK 承载全页 CSS,误删会导致 drawHTML 渲染出无样式的原始 DOM
 * (布局塌陷、图片原始尺寸),截图内容与用户所见完全不符。HEAD 删除会连带剥光其内的 style/link。
 */
const NON_VISUAL_TAGS = new Set([
  'HEAD',
  'STYLE',
  'LINK',
  'META',
  'TITLE',
  'BASE',
  'SCRIPT',
  'NOSCRIPT',
  'TEMPLATE',
]);

/**
 * 克隆当前页面 html 用于栅格化,并处理内部滚动 / fixed / 百分比定位带来的偏移。
 * 临时改动过的真实 DOM 在 finally 中恢复,即使中途抛错也不留脏数据。
 *
 * ⚠️ 时序约束:必须在「loading 遮罩等任何提交后新增的浮层挂载之前」同步调用,
 * 才能拿到不含这些浮层的干净快照。故对外暴露 captureHtml() 供提交瞬间同步抓取,
 * 与耗时的栅格化(generateImage)解耦——见 captureHtml 注释。
 */
function getHtml(location?: SelectionRect): HTMLElement {
  const bodyWidth = document.body.clientWidth;
  const allDom = toArray(document.querySelectorAll<HTMLElement>('*'));

  // 临时改动过的元素集合,无论是否抛错都要在 finally 恢复
  let scrollDom: HTMLElement[] = [];
  // 被标记过临时属性的 live img,finally 统一清理(避免污染真实 DOM)
  let markedImgs: HTMLImageElement[] = [];
  // 被标记为隐藏(自身 display:none)的 live 元素,finally 统一清理
  const markedHidden: HTMLElement[] = [];

  try {
    // 选区感知:量每张 live img 的视口矩形,标记「是否与选区相交」+ 记录渲染宽高。
    // 目的——克隆后把选区外的图剥掉 src(drawHTML 便不会请求它),只保留/内联选区内的图,
    // 从根上消除「整页几十张图(含数 MB 大图)被重复请求」与由此带来的数秒等待。
    if (location) {
      const { x0, y0, x1, y1 } = normalizeRect(location);
      markedImgs = toArray(document.querySelectorAll<HTMLImageElement>('img'));
      markedImgs.forEach((img) => {
        const r = img.getBoundingClientRect();
        // 记录渲染盒尺寸:剥 src 后用它固定宽高,避免布局塌陷导致裁剪错位
        img.setAttribute('data-shot-w', String(Math.round(r.width)));
        img.setAttribute('data-shot-h', String(Math.round(r.height)));
        const inside = !(r.right < x0 || r.left > x1 || r.bottom < y0 || r.top > y1);
        if (inside) img.setAttribute('data-shot-inside', '1');
      });
    }

    // CASE1: 给有滚动的元素打标记,记录滚动距离,原 id 暂存 prevId
    scrollDom = allDom
      .filter(
        (dom) =>
          (dom.scrollTop > 0 || dom.scrollLeft > 0) &&
          dom.nodeName !== 'HTML' &&
          dom.nodeName !== 'NOSCRIPT',
      )
      .map((dom, index) => {
        (dom as HTMLElement & { prevId?: string }).prevId = dom.id;
        dom.setAttribute('scrollTopVal', String(dom.scrollTop));
        dom.setAttribute('scrollLeftVal', String(dom.scrollLeft));
        dom.id = dom.id || `feedback-${index}`;
        return dom;
      });
    // CASE2/3/4 合并为一次全页遍历、每元素一次 getComputedStyle(原先 fixed/percent 各遍历一次):
    // - fixed 元素需根据滚动条位置重新偏移
    // - 百分比/vh 定位元素截图会偏移,需固化为像素
    // - 自身 display:none 元素:克隆后整棵子树删除,削减 drawHTML 序列化的节点总数
    const fixedCls = 'tmp-fixed-cls';
    const percentCls = 'tmp-percent-cls';
    allDom.forEach((dom) => {
      const nodeName = dom.nodeName;
      if (nodeName === 'HTML' || nodeName === 'BODY') return;
      // 非渲染功能性元素(head/style/link/meta 等)UA 默认就是 display:none,
      // 但它们承载 CSS / 元信息,绝不能当隐藏内容删除,否则全页样式被剥光、截图塌陷。
      if (NON_VISUAL_TAGS.has(nodeName)) return;
      // 隐藏裁剪只作用于 HTMLElement:跳过 SVG 命名空间元素。
      // <defs>/<clipPath>/<linearGradient>/<mask> 等的 computed display 也是 'none',
      // 但它们是可见 SVG 图标的渐变/裁剪定义,删除会让图标渲染破裂。
      if (!(dom instanceof HTMLElement)) return;
      const cs = window.getComputedStyle(dom);
      // 隐藏元素:打标记,克隆后删整棵子树(不占布局,删除对可见元素位置零影响)
      if (cs.display === 'none') {
        dom.setAttribute(HIDDEN_MARK, '1');
        markedHidden.push(dom);
        return; // 隐藏元素无需再做 fixed/percent 偏移处理(整棵将被删)
      }
      // fixed
      if (cs.position === 'fixed') {
        dom.setAttribute('fixedTop', String(window.scrollY));
        dom.setAttribute('fixedLeft', String(window.scrollX));
        dom.classList.add(fixedCls);
      }
      // 百分比/vh 定位(static 定位不受影响,跳过)
      if (cs.position !== 'static') {
        const { top, left, right, bottom } = dom.style;
        const per = ['vh', '%'];
        if ([top, left, right, bottom].some((d) => per.some((p) => d.includes(p)))) {
          dom.setAttribute(
            'data-style',
            JSON.stringify({ top: cs.top, left: cs.left, right: cs.right, bottom: cs.bottom }),
          );
          dom.classList.add(percentCls);
        }
      }
    });

    const idList = scrollDom.map((dom) => dom.id);
    const html = document.querySelector('html')!.cloneNode(true) as HTMLElement;
    const fixedDom = toArray(html.querySelectorAll<HTMLElement>(`.${fixedCls}`));
    const percentDom = toArray(html.querySelectorAll<HTMLElement>(`.${percentCls}`));

    idList.forEach((id) => {
      // 用属性选择器 [id="..."] 而非 #id:克隆出的 html 是 Element(无 getElementById),
      // 且 id 可能以数字开头或含特殊字符,走 #id 会抛 SyntaxError 导致整个截图失败
      const dom = html.querySelector<HTMLElement>(`[id="${id}"]`);
      if (!dom) return;
      const top = dom.getAttribute('scrollTopVal');
      const left = dom.getAttribute('scrollLeftVal');
      if (dom.children && dom.children.length) {
        toArray(dom.children).forEach((child) => {
          (child as HTMLElement).style.transform = `translate(-${left}px, -${top}px)`;
        });
      }
    });
    percentDom.forEach((dom) => {
      const dataStyle = dom.getAttribute('data-style');
      const style = dataStyle ? (JSON.parse(dataStyle) as Record<string, string>) : {};
      Object.keys(style).forEach((key) => {
        dom.style.setProperty(key, style[key]);
      });
      dom.removeAttribute('data-style');
      dom.classList.remove(percentCls);
    });
    fixedDom.forEach((dom) => {
      const top = dom.getAttribute('fixedTop');
      const left = dom.getAttribute('fixedLeft');
      dom.removeAttribute('fixedTop');
      dom.removeAttribute('fixedLeft');
      dom.classList.remove(fixedCls);
      dom.style.transform = `translate(${left}px, ${top}px)`;
    });

    // 设置 body 宽度防止截屏宽度失真
    html.querySelector('body')!.style.width = `${bodyWidth}px`;
    toArray(html.querySelectorAll('script, noscript')).forEach((dom) => dom.remove());
    html.querySelector(`.${ROOT_CLASS}`)?.remove();

    // 删除隐藏(display:none)子树:大幅减少 drawHTML 序列化的节点数。
    // 在 img 选区剥离之前执行,顺带减少后续 img 遍历量;删父后子已 detached,无需单独处理后代。
    toArray(html.querySelectorAll(`[${HIDDEN_MARK}]`)).forEach((dom) => dom.remove());

    // 选区外的图:抹掉 src,drawHTML 不再请求;用测得宽高固定盒子,布局不塌、裁剪不错位。
    // 选区内的图:保留 src(后续由 inlineImages 内联为 dataURL)。仅当传入 location 时生效。
    if (location) {
      toArray(html.querySelectorAll<HTMLImageElement>('img[data-shot-w]')).forEach((img) => {
        const w = img.getAttribute('data-shot-w');
        const h = img.getAttribute('data-shot-h');
        const inside = img.getAttribute('data-shot-inside') === '1';
        if (!inside) {
          img.removeAttribute('src');
          img.removeAttribute('srcset');
          if (w) img.style.width = `${w}px`;
          if (h) img.style.height = `${h}px`;
        }
        IMG_MARK_ATTRS.forEach((a) => img.removeAttribute(a));
      });
    }

    return html;
  } finally {
    // 恢复真实页面被临时改动的 scrollDom,即使上面抛错也保证执行
    scrollDom.forEach((dom) => {
      const d = dom as HTMLElement & { prevId?: string };
      dom.id = d.prevId || '';
      dom.removeAttribute('scrollTopVal');
      dom.removeAttribute('scrollLeftVal');
      delete d.prevId;
    });
    // 清理 live img 上的临时标记属性(切勿残留到真实 DOM)
    markedImgs.forEach((img) => IMG_MARK_ATTRS.forEach((a) => img.removeAttribute(a)));
    // 清理 live 元素上的隐藏标记属性
    markedHidden.forEach((dom) => dom.removeAttribute(HIDDEN_MARK));
  }
}

/**
 * 同步抓取当前页面的 HTML 快照(outerHTML 字符串)。
 *
 * 必须在提交瞬间、loading 遮罩等浮层挂载之前调用,保证快照干净。
 * 与 generateImage(耗时栅格化)解耦:抓取很快且必须即时,栅格化可推迟到 loading 绘制后再跑。
 *
 * @param location 选区坐标(视口系);传入后只保留与选区相交的图,选区外的图剥离 src 不再请求
 */
export function captureHtml(location?: SelectionRect): string {
  return getHtml(location).outerHTML;
}

/** 单张图片预取超时(ms):个别慢图超时即降级保留原 src,避免拖垮整张截图导出 */
const IMAGE_INLINE_TIMEOUT = 8000;

/** Blob → dataURL(FileReader 异步读取) */
function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * 把单个远程图片取成 dataURL;失败返回 null,由调用方降级。
 *
 * 取像素策略(按序尝试,任一成功即返回):
 *   1) 原 url + mode:'cors' + cache:'reload' —— 带 CORS 响应头的图(如 OSS 签名图)成功;
 *   2) 若原 url 是 http://(https 页面属 mixed-content,会被强制拦截),升级 https 再试一次。
 *
 * 关键:cache:'reload' 强制绕过 HTTP 缓存走网络。
 *   页面里的 <img> 以 no-cors 加载该图(不带 Origin 头)→ OSS 返回的响应不含 Access-Control-Allow-Origin
 *   并被缓存;若 fetch 命中这条「被污染」的缓存,会因缺 ACAO 判 CORS 失败(即截图里随机空白的真因)。
 *   reload 强制带 Origin 重新请求,OSS 才会回 ACAO,从而稳定取到像素。
 * credentials:'omit':签名 URL 无需 cookie,且避免 ACAO 为具体域名时的凭证校验失败。
 *
 * 仍无法取到的(404 真缺失 / https 也无此资源 / 跨域无 CORS / 超时)返回 null。
 */
function fetchImageAsDataURL(url: string): Promise<string | null> {
  const tryFetch = (target: string): Promise<string | null> => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), IMAGE_INLINE_TIMEOUT);
    return fetch(target, {
      mode: 'cors',
      credentials: 'omit',
      cache: 'reload',
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => (blob ? blobToDataURL(blob) : null))
      .catch(() => null)
      .finally(() => window.clearTimeout(timer));
  };

  return tryFetch(url).then((dataUrl) => {
    if (dataUrl) return dataUrl;
    // mixed-content 兜底:http 图升级 https 再试(同名资源常同时存在于 https)
    if (url.startsWith('http://')) return tryFetch(url.replace(/^http:\/\//, 'https://'));
    return null;
  });
}

/**
 * 把 HTML 快照里仍带远程 src 的 <img> 预取成 dataURL 再写回。
 *
 * 配合 getHtml(location):选区外的图已被剥掉 src,这里只会处理「选区内」尚存 src 的图,
 * 因此 fetch 数量 = 选区内图片数(通常 1~2 张),而非整页几十张。
 *
 * 为什么需要:drawHTML 栅格化时会对每个 <img> 按 src 重新发起请求再 inline,
 * 而非读取屏幕已渲染的像素。提前用 fetch 取成 dataURL 内联后,drawHTML 拿到的全是 dataURL,
 * 不再临场请求 → 既消除「等齐才合成」前的空白竞态,也避免重复网络请求。
 *
 * 降级:取像素失败的图(404 / 跨域无 CORS / 超时)保留原 src,不阻断其余图与整张导出。
 *
 * @param html 页面 HTML 快照字符串(captureHtml 产出)
 * @returns 远程 img 已尽量内联为 dataURL 的 HTML 字符串
 */
async function inlineImages(html: string): Promise<string> {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const imgs = toArray(doc.querySelectorAll<HTMLImageElement>('img[src]'));

  // 收集需要内联的远程 url(已是 data:/blob: 的跳过),按 url 去重 → 同一张图只取一次
  const urls = Array.from(
    new Set(
      imgs
        .map((img) => img.getAttribute('src') || '')
        .filter((src) => src && !src.startsWith('data:') && !src.startsWith('blob:')),
    ),
  );
  if (urls.length === 0) return html;

  const urlToDataUrl = new Map<string, string>();
  await Promise.all(
    urls.map((url) =>
      fetchImageAsDataURL(url).then((dataUrl) => {
        if (dataUrl) urlToDataUrl.set(url, dataUrl);
      }),
    ),
  );

  // 取成功的替换为 dataURL;失败的保留原 src(降级)
  imgs.forEach((img) => {
    const src = img.getAttribute('src') || '';
    const dataUrl = urlToDataUrl.get(src);
    if (dataUrl) img.setAttribute('src', dataUrl);
  });

  return doc.documentElement.outerHTML;
}

/**
 * 生成截图:页面位图 + 标注 svg 合成,按选区裁剪,2 倍清晰度。
 * @param html 页面 HTML 快照(由 captureHtml 在提交瞬间同步抓取,确保不含 loading 等后挂载浮层)
 * @param svg 标注层 svg 的 dataURL(可空)
 * @param client 视口尺寸
 * @param location 选区坐标
 */
async function generateImage(
  html: string,
  svg: string | undefined,
  client: ViewportSize,
  location: SelectionRect,
  mosaics: MosaicExportRect[] = [],
): Promise<ShotmarkResult> {
  const { width, height } = client;
  const { startX, startY, endX, endY } = location;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  // 关键:先把快照里的远程 img 预内联为 dataURL(去重 + 失败降级 + 超时),
  // 让 drawHTML 不再临场重拉图片 → 消除「多图空白」竞态与重复请求。
  const inlinedHtml = await inlineImages(html);

  // 真清晰:让 drawHTML 以 PIXEL_RATIO 倍真实分辨率渲染底图,而非「1x 渲染后插值放大」。
  // drawHTML 的 zoom 语义:内部 iframe 尺寸 = 传入 width / zoom。故 width/height 必须同步 ×zoom,
  // 才能让 iframe 还原为原视口宽度((width×zoom)/zoom = width)、布局/响应式断点不失真,
  // 同时输出位图 = 内容尺寸 × zoom → 像素信息真正翻倍。
  // zoom 取 PIXEL_RATIO:使下方源选区像素(imgW×zoom)恰等于目标画布像素(imgW×PIXEL_RATIO),
  // drawImage 1:1 映射零插值,清晰度拉满且两个倍率收敛为同一常量。
  const zoom = PIXEL_RATIO;
  const { image } = await drawHTML(inlinedHtml, {
    width: width * zoom,
    height: height * zoom,
    zoom,
  });

  const imgW = endX - startX;
  const imgH = endY - startY;
  const pixWidth = imgW * PIXEL_RATIO;
  const pixHeight = imgH * PIXEL_RATIO;

  canvas.width = pixWidth;
  canvas.height = pixHeight;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // 底图已按 zoom 倍渲染,故源起点与源宽高同步 ×zoom 取选区那块,再 1:1 落到 pixWidth×pixHeight 目标。
  ctx.drawImage(
    image,
    (window.scrollX + startX) * zoom,
    (window.scrollY + startY) * zoom,
    imgW * zoom,
    imgH * zoom,
    0,
    0,
    pixWidth,
    pixHeight,
  );

  if (mosaics.length > 0) {
    mosaics.forEach((rect) => {
      applyMosaic(ctx, canvas, rect, PIXEL_RATIO);
    });
  }

  if (svg) {
    const img = new Image();
    // onerror 兜底:SVG 加载失败时也 resolve,降级为「只有底图、无标注层」,
    // 避免缺少 onerror 时 Promise 永久 pending 导致整个截图导出挂起。
    const loaded = new Promise<boolean>((res) => {
      img.onload = () => res(true);
      img.onerror = () => res(false);
    });
    img.src = svg;
    const ok = await loaded;
    if (ok) {
      ctx.drawImage(img, 0, 0, imgW, imgH, 0, 0, pixWidth, pixHeight);
    }
  }

  return {
    image: canvas.toDataURL('image/jpeg'),
    width: imgW,
    height: imgH,
    pixWidth,
    pixHeight,
  };
}

/**
 * 对导出图指定区域执行真实像素马赛克。
 * 算法:裁剪区域 -> 缩小采样 -> 关闭平滑放大回填。
 */
function applyMosaic(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  rect: MosaicExportRect,
  ratio: number,
): void {
  const x = Math.max(0, Math.floor(rect.x * ratio));
  const y = Math.max(0, Math.floor(rect.y * ratio));
  const w = Math.max(0, Math.floor(rect.w * ratio));
  const h = Math.max(0, Math.floor(rect.h * ratio));
  if (!w || !h) return;

  const { sampleW, sampleH } = computeMosaicSampleGrid(w, h, ratio, rect.blockSize);

  const region = document.createElement('canvas');
  region.width = w;
  region.height = h;
  const regionCtx = region.getContext('2d');
  if (!regionCtx) return;
  regionCtx.drawImage(canvas, x, y, w, h, 0, 0, w, h);

  const tiny = document.createElement('canvas');
  tiny.width = sampleW;
  tiny.height = sampleH;
  const tinyCtx = tiny.getContext('2d');
  if (!tinyCtx) return;
  // 下采样阶段开启平滑做颜色平均;上采样再关闭平滑保持方块边缘
  tinyCtx.imageSmoothingEnabled = true;
  tinyCtx.drawImage(region, 0, 0, w, h, 0, 0, sampleW, sampleH);

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tiny, 0, 0, sampleW, sampleH, x, y, w, h);
  ctx.imageSmoothingEnabled = true;

  const blurRadius = computeMosaicBlurRadius(rect.blockSize, rect.blurStrength, ratio);
  if (blurRadius > 0) {
    const softness = clampMosaicSoftness(rect.blurStrength);
    const blend = Math.min(0.92, Math.max(0.2, softness / 100));
    const mosaicPatch = document.createElement('canvas');
    mosaicPatch.width = w;
    mosaicPatch.height = h;
    const mosaicPatchCtx = mosaicPatch.getContext('2d');
    if (!mosaicPatchCtx) return;
    mosaicPatchCtx.drawImage(ctx.canvas, x, y, w, h, 0, 0, w, h);

    const smooth = document.createElement('canvas');
    smooth.width = w;
    smooth.height = h;
    const smoothCtx = smooth.getContext('2d');
    if (!smoothCtx) return;
    smoothCtx.filter = `blur(${blurRadius}px)`;
    smoothCtx.drawImage(mosaicPatch, 0, 0, w, h);
    smoothCtx.filter = 'none';
    ctx.save();
    ctx.globalAlpha = blend;
    ctx.drawImage(smooth, 0, 0, w, h, x, y, w, h);
    ctx.restore();
  }
}

function computeMosaicBlurRadius(blockSize?: number, blurStrength?: number, ratio = 1): number {
  const level = clampMosaicSize(blockSize);
  const block = resolveMosaicBlockSize(level);
  const softness = clampMosaicSoftness(blurStrength);
  const baseSoft = (softness / 100) * Math.min(3.8, Math.max(0.3, block * 0.16));
  // 小档位默认补一点柔化,弱化方块边缘,更接近竞品 size=1 的视觉
  const smallLevelBoost = Math.max(0, (3 - level) * 0.42);
  const radius = (baseSoft + smallLevelBoost) * Math.max(1, ratio * 0.72);
  return Number(radius.toFixed(2));
}

export default generateImage;
