/** 栅格化引擎类型定义 */

export interface RasterizeOptions {
  /** 输出画布宽度（px） */
  width: number;
  /** 输出画布高度（px） */
  height: number;
  /** 缩放倍率（默认 1）；>1 时输出高分辨率位图 */
  zoom?: number;
  /** baseUrl 用于解析相对路径资源 */
  baseUrl?: string;
}

export interface RasterizeResult {
  /** 渲染完成的 Image 对象 */
  image: HTMLImageElement;
  /** 中间 SVG 字符串 */
  svg: string;
}

/** iframe 尺寸测量结果 */
export interface ContentSize {
  left: number;
  top: number;
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
  rootFontSize: string;
}
