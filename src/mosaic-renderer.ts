/**
 * 马赛克预览渲染:纯图像处理逻辑(不依赖组件实例状态),供 draw-board 预览层调用。
 *
 * 与 generate-image 的导出路径分离:预览在 1x 画布上实时合成,导出需按 PIXEL_RATIO 放大,
 * 两者坐标系与采样倍率不同,故各自维护,避免强行合并引入回归。
 */
import { clampMosaicSize, clampMosaicSoftness, resolveMosaicBlockSize } from './const';
import type { MosaicExportRect, MosaicPath } from './types';

/**
 * 把马赛克路径裁剪为画布内的合法矩形(防越界),并携带块大小/柔化强度。
 *
 * @param path 马赛克路径
 * @param canvas 目标画布(用于夹取边界)
 * @returns 画布坐标系内的导出矩形
 */
export function getRectInCanvas(path: MosaicPath, canvas: HTMLCanvasElement): MosaicExportRect {
  const x = Math.max(0, Math.floor(path.x));
  const y = Math.max(0, Math.floor(path.y));
  const maxW = Math.max(0, canvas.width - x);
  const maxH = Math.max(0, canvas.height - y);
  const w = Math.max(0, Math.min(maxW, Math.floor(path.w)));
  const h = Math.max(0, Math.min(maxH, Math.floor(path.h)));
  return { x, y, w, h, blockSize: path.mosaicSize, blurStrength: path.mosaicSoftness };
}

/**
 * 计算马赛克附加高斯模糊半径。块越小、柔化越强,叠加的模糊越明显;
 * 小块额外加权(smallLevelBoost)避免细块过硬。
 *
 * @param blockSize 块大小档位
 * @param blurStrength 柔化强度(0~100)
 * @returns 模糊半径(px,保留两位小数)
 */
export function getMosaicBlurRadius(blockSize?: number, blurStrength?: number): number {
  const level = clampMosaicSize(blockSize);
  const block = resolveMosaicBlockSize(level);
  const softness = clampMosaicSoftness(blurStrength);
  const baseSoft = (softness / 100) * Math.min(3.8, Math.max(0.3, block * 0.16));
  const smallLevelBoost = Math.max(0, (3 - level) * 0.42);
  return Number((baseSoft + smallLevelBoost).toFixed(2));
}

/**
 * 在画布指定矩形区域上绘制马赛克:先下采样成块,再按柔化强度叠加一层高斯模糊。
 *
 * @param ctx 目标绘制上下文
 * @param canvas 源画布(取样来源)
 * @param rect 待马赛克的矩形区域
 */
export function applyMosaicToCanvas(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  rect: MosaicExportRect,
): void {
  const x = Math.max(0, Math.floor(rect.x));
  const y = Math.max(0, Math.floor(rect.y));
  const w = Math.max(0, Math.floor(rect.w));
  const h = Math.max(0, Math.floor(rect.h));
  if (!w || !h) return;

  const block = resolveMosaicBlockSize(rect.blockSize);
  const sampleW = Math.max(1, Math.floor(w / block));
  const sampleH = Math.max(1, Math.floor(h / block));

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
  // 下采样保留平滑用于颜色平均,避免出现随机黑白跳点
  tinyCtx.imageSmoothingEnabled = true;
  tinyCtx.drawImage(region, 0, 0, w, h, 0, 0, sampleW, sampleH);

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tiny, 0, 0, sampleW, sampleH, x, y, w, h);
  ctx.imageSmoothingEnabled = true;

  const blurRadius = getMosaicBlurRadius(rect.blockSize, rect.blurStrength);
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
