/**
 * DOM 辅助工具
 *
 * 处理 CSS 选择器中的伪类模拟和标签名大小写问题。
 * 精简自 documentHelper.js + documentUtil.js。
 */

/** 将类名添加到元素 */
function addClassName(el: Element, cls: string): void {
  el.className += ` ${cls}`;
}

/** 递归向上添加类名（模拟 :hover/:active 冒泡） */
function addClassNameRecursively(el: Element, cls: string): void {
  addClassName(el, cls);
  if (el.parentNode !== el.ownerDocument && el.parentElement) {
    addClassNameRecursively(el.parentElement, cls);
  }
}

/** 替换 style 中的 CSS 选择器 */
function rewriteCssSelector(element: Element, oldSelector: string, newSelector: string): void {
  const styles = element.querySelectorAll('style');
  const escapedOld = oldSelector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`((?:^|[^.#:\\w])|(?=\\W))(${escapedOld})(?=\\W|$)`, 'gi');

  styles.forEach((styleEl) => {
    const sheet = styleEl.sheet;
    if (!sheet) return;

    const rules = Array.from(sheet.cssRules);
    let changed = false;

    rules.forEach((rule) => {
      if (!(rule instanceof CSSStyleRule)) return;
      if (!regex.test(rule.selectorText)) return;

      const newSel = rule.selectorText.replace(regex, (_, prefix) => prefix + newSelector);
      if (newSel !== rule.selectorText) {
        const idx = Array.from(sheet.cssRules).indexOf(rule);
        const defs = rule.cssText.replace(/^[^{]+/, '');
        sheet.insertRule(`${newSel} ${defs}`, idx + 1);
        sheet.deleteRule(idx);
        changed = true;
      }
    });

    if (changed) {
      styleEl.textContent = Array.from(sheet.cssRules)
        .map((r) => r.cssText)
        .join('');
    }
  });
}

const CASCADING_ACTIONS: Record<string, boolean> = {
  active: true,
  hover: true,
  focus: false,
  target: false,
};

/**
 * 模拟用户交互伪类
 * 将 :hover 等伪类替换为 .rasterizehtmlhover 真实类名
 */
export function fakeUserAction(element: Element, selector: string, action: string): void {
  const el = element.querySelector(selector);
  if (!el) return;

  const pseudoClass = `:${action}`;
  const fakeClass = `rasterizehtml${action}`;

  if (CASCADING_ACTIONS[action]) {
    addClassNameRecursively(el, fakeClass);
  } else {
    addClassName(el, fakeClass);
  }
  rewriteCssSelector(element, pseudoClass, `.${fakeClass}`);
}

/**
 * 将 HTML-only 标签名选择器统一为小写
 *
 * HTML 标签名大小写不敏感，但 SVG foreignObject 中需要精确匹配。
 * 此函数找出仅在 HTML 命名空间出现的标签名，将 CSS 中对应的
 * type selector 全部改写为小写。
 */
export function rewriteTagNameSelectorsToLowerCase(element: Element): void {
  const doc = element.ownerDocument;
  const walker = doc.createTreeWalker(element, NodeFilter.SHOW_ELEMENT);
  const htmlNames = new Set<string>();
  const nonHtmlNames = new Set<string>();

  do {
    const node = walker.currentNode as Element;
    const tag = node.tagName.toLowerCase();
    if (node.namespaceURI === 'http://www.w3.org/1999/xhtml') {
      htmlNames.add(tag);
    } else {
      nonHtmlNames.add(tag);
    }
  } while (walker.nextNode());

  // 仅处理 HTML-only 标签名（不与 SVG 标签名冲突的）
  const htmlOnlyTags = Array.from(htmlNames).filter((t) => !nonHtmlNames.has(t));
  if (htmlOnlyTags.length === 0) return;

  const selectorRegex = new RegExp(
    `((?:^|[^.#:\\w])|(?=\\W))(${htmlOnlyTags.join('|')})(?=\\W|$)`,
    'gi',
  );

  element.querySelectorAll('style').forEach((styleEl) => {
    const sheet = styleEl.sheet;
    if (!sheet) return;

    let changed = false;
    Array.from(sheet.cssRules).forEach((rule) => {
      if (!(rule instanceof CSSStyleRule)) return;
      if (!selectorRegex.test(rule.selectorText)) return;

      const newSel = rule.selectorText.replace(selectorRegex, (_, prefix, match) => {
        return prefix + match.toLowerCase();
      });

      if (newSel !== rule.selectorText) {
        const idx = Array.from(sheet.cssRules).indexOf(rule);
        const defs = rule.cssText.replace(/^[^{]+/, '');
        sheet.insertRule(`${newSel} ${defs}`, idx + 1);
        sheet.deleteRule(idx);
        changed = true;
      }
    });

    if (changed) {
      styleEl.textContent = Array.from(sheet.cssRules)
        .map((r) => r.cssText)
        .join('');
    }
  });
}
