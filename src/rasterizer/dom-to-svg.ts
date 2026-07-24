/**
 * DOM → SVG 转换
 *
 * 将 HTML 元素序列化为 SVG foreignObject，
 * 配合 zoom 缩放生成高分辨率 SVG 字符串。
 *
 * 使用原生 XMLSerializer 代替 xmlserializer npm 包。
 */

import type { ContentSize } from './types';
import { rewriteTagNameSelectorsToLowerCase } from './dom-helper';

const serializer = new XMLSerializer();

/** SVG 根属性 */
function svgAttrs(size: ContentSize, zoom: number): string {
  let attrs = `xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}" font-size="${size.rootFontSize}"`;
  if (zoom !== 1) {
    attrs += ` style="transform:scale(${zoom}); transform-origin: 0 0;"`;
  }
  return attrs;
}

/** foreignObject 属性 */
function foreignObjectAttrs(size: ContentSize): string {
  const w = Math.round(size.viewportWidth);
  const h = Math.round(size.viewportHeight);
  const x = -size.left;
  const y = -size.top;
  return `x="${x}" y="${y}" width="${w}" height="${h}" style="float: left;" externalResourcesRequired="true"`;
}

/** Chrome Linux 隐藏滚动条 workaround */
const HIDE_SCROLLBAR = '<style scoped="">html::-webkit-scrollbar { display: none; }</style>';

/**
 * 验证 XHTML 是否可被 XML 解析器正确解析。
 * 如果不合法，后续 SVG foreignObject 会无法渲染。
 */
function validateXHTML(xhtml: string): void {
  const doc = new DOMParser().parseFromString(xhtml, 'application/xml');
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error(`Invalid XHTML: ${parseError.textContent?.slice(0, 200)}`);
  }
}

/**
 * 将 DOM 元素转为 SVG 字符串
 *
 * 流程：
 * 1. 修复 CSS 标签选择器大小写
 * 2. XMLSerializer 序列化为 XHTML
 * 3. 验证 XHTML 合法性
 * 4. 包裹进 SVG foreignObject
 */
export function elementToSvg(element: Element, size: ContentSize, zoom: number): string {
  rewriteTagNameSelectorsToLowerCase(element);

  const xhtml = serializer.serializeToString(element);
  validateXHTML(xhtml);

  return (
    `<svg ${svgAttrs(size, zoom)}>` +
    HIDE_SCROLLBAR +
    `<foreignObject ${foreignObjectAttrs(size)}>` +
    xhtml +
    '</foreignObject>' +
    '</svg>'
  );
}
