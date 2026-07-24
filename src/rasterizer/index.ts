/**
 * shotmark 内置栅格化引擎
 *
 * 精简自 rasterizeHTML.js (MIT license)，仅保留 drawHTML 路径：
 *   HTML string → DOM → iframe 测量尺寸 → SVG foreignObject 包裹 → Image → Canvas
 *
 * 删除了：drawURL、JS 执行、XHR 代理、inlineresources（外部预处理）
 * 替换了：xmlserializer → 原生 XMLSerializer
 *
 * @see https://github.com/cburgmer/rasterizeHTML.js
 */

export { drawHTML } from './draw-html';
export type { RasterizeOptions, RasterizeResult } from './types';
