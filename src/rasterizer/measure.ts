/**
 * DOM 尺寸测量
 *
 * 将 HTML 元素写入隐藏 iframe，测量其内容尺寸。
 * iframe 使用 sandbox='allow-same-origin' 禁止 JS 执行。
 */

import type { ContentSize, RasterizeOptions } from './types';

/** 创建隐藏的沙盒 iframe（不执行 JS） */
function createSandboxedIframe(width: number, height: number, zoom: number): HTMLIFrameElement {
  const scaledW = Math.floor(width / zoom);
  const scaledH = Math.floor(height / zoom);

  const iframe = document.createElement('iframe');
  iframe.style.width = `${scaledW}px`;
  iframe.style.height = `${scaledH}px`;
  iframe.style.visibility = 'hidden';
  iframe.style.position = 'absolute';
  iframe.style.top = `${-10000 - scaledH}px`;
  iframe.style.left = `${-10000 - scaledW}px`;
  iframe.style.borderWidth = '0';
  iframe.sandbox.add('allow-same-origin');
  iframe.scrolling = 'no';
  return iframe;
}

/** 将元素包装为完整 HTML 文档字符串 */
function elementToFullHtml(element: Element): string {
  const tag = element.tagName.toLowerCase();
  if (tag === 'html' || tag === 'body') {
    return element.outerHTML;
  }
  return `<body style="margin: 0;">${element.outerHTML}</body>`;
}

/** 在 iframe 中找到对应元素 */
function findCorrelatingElement(element: Element, doc: Document): Element {
  const tag = element.tagName;
  return doc.querySelector(tag) ?? doc.documentElement;
}

/**
 * 计算元素的内容尺寸（在 iframe 内测量）
 *
 * 先把 element 写入隐藏 iframe，iframe 加载完成后读取
 * scrollWidth/scrollHeight 作为真实内容尺寸。
 */
export function calculateDocumentContentSize(
  element: Element,
  options: RasterizeOptions,
): Promise<ContentSize> {
  return new Promise((resolve, reject) => {
    const zoom = options.zoom ?? 1;
    const iframe = createSandboxedIframe(options.width, options.height, zoom);

    document.body.appendChild(iframe);

    iframe.onload = () => {
      try {
        const doc = iframe.contentDocument!;
        const root = findCorrelatingElement(element, doc);

        const actualW = Math.max(root.scrollWidth, root.clientWidth);
        const actualH = Math.max(root.scrollHeight, root.clientHeight);

        const contentWidth = Math.max(actualW * zoom, options.width);
        const contentHeight = Math.max(actualH * zoom, options.height);

        const rootFontSize = window.getComputedStyle(doc.documentElement).fontSize;

        resolve({
          left: 0,
          top: 0,
          width: contentWidth,
          height: contentHeight,
          viewportWidth: actualW,
          viewportHeight: actualH,
          rootFontSize,
        });
      } catch (e) {
        reject(e);
      } finally {
        document.body.removeChild(iframe);
      }
    };

    // srcdoc 兼容性好于 write，但为兼容 PhantomJS 保留 write 方式
    const iframeDoc = iframe.contentDocument!;
    iframeDoc.open();
    iframeDoc.write('<!DOCTYPE html>');
    iframeDoc.write(elementToFullHtml(element));
    iframeDoc.close();
  });
}
