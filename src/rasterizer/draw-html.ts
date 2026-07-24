/**
 * drawHTML — 栅格化引擎核心入口
 *
 * 将 HTML 字符串渲染为 Image 对象。
 *
 * 流程：
 *   1. HTML string → DOM (DOMParser)
 *   2. DOM → iframe 测量内容尺寸 (measure.ts)
 *   3. DOM → SVG foreignObject (dom-to-svg.ts)
 *   4. SVG → Image (svg-to-image.ts)
 *
 * 不含资源内联（调用方需自行预处理图片等资源为 dataURL）。
 */

import type { RasterizeOptions, RasterizeResult } from './types';
import { calculateDocumentContentSize } from './measure';
import { elementToSvg } from './dom-to-svg';
import { svgToImage } from './svg-to-image';

/** 解析 HTML 字符串为 Document */
function parseHTML(html: string): Document {
  const doc = document.implementation.createHTMLDocument('');
  doc.documentElement.innerHTML = html;

  // 保留 <html> 标签上的属性（如 lang、class 等）
  const attrMatch = /<html((?:\s+[^>]*)?)>/im.exec(html);
  if (attrMatch) {
    const helperDoc = document.implementation.createHTMLDocument('');
    helperDoc.documentElement.innerHTML = `<div${attrMatch[1]}></div>`;
    const div = helperDoc.querySelector('div');
    if (div) {
      for (let i = 0; i < div.attributes.length; i++) {
        const attr = div.attributes[i];
        doc.documentElement.setAttribute(attr.name, attr.value);
      }
    }
  }

  return doc;
}

/**
 * 将 HTML 字符串栅格化为 Image
 *
 * @param html - 完整的 HTML 文档字符串
 * @param options - 栅格化选项（width/height/zoom）
 * @returns 渲染结果（image + svg 字符串）
 *
 * @example
 * ```ts
 * import { drawHTML } from 'shotmark/rasterizer';
 *
 * const { image } = await drawHTML(htmlString, {
 *   width: window.innerWidth * 2,
 *   height: window.innerHeight * 2,
 *   zoom: 2,
 * });
 *
 * ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
 * ```
 */
export async function drawHTML(html: string, options: RasterizeOptions): Promise<RasterizeResult> {
  const doc = parseHTML(html);
  const element = doc.documentElement;
  const zoom = options.zoom ?? 1;

  // 1. 测量尺寸
  const size = await calculateDocumentContentSize(element, options);

  // 2. DOM → SVG
  const svg = elementToSvg(element, size, zoom);

  // 3. SVG → Image
  const image = await svgToImage(svg);

  return { image, svg };
}
