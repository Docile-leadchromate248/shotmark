/**
 * 轻量消息提示(无第三方 UI 依赖)
 */

import { getThemeClassName } from './theme-mode';

type MessageType = 'success' | 'error';

interface ShowMessageOptions {
  type: MessageType;
  content: string;
  duration?: number;
}

const ROOT_ID = 'shotmark-message-root';
let styleInjected = false;

const createMessageIcon = (type: MessageType): SVGElement => {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('shotmark-message-icon-svg');

  const circle = document.createElementNS(ns, 'circle');
  circle.setAttribute('cx', '10');
  circle.setAttribute('cy', '10');
  circle.setAttribute('r', '10');
  circle.setAttribute('fill', 'currentColor');
  svg.appendChild(circle);

  const path = document.createElementNS(ns, 'path');
  if (type === 'success') {
    path.setAttribute('d', 'M5.8 10.2 8.4 12.8 14.2 7');
  } else {
    path.setAttribute('d', 'M6.6 6.6 13.4 13.4 M13.4 6.6 6.6 13.4');
  }
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', '#fff');
  path.setAttribute('stroke-width', '2.1');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(path);
  return svg;
};

const createCloseIcon = (): SVGElement => {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('shotmark-message-close-svg');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', 'M6 6 14 14 M14 6 6 14');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '2');
  path.setAttribute('stroke-linecap', 'round');
  svg.appendChild(path);
  return svg;
};

const ensureStyle = (): void => {
  if (styleInjected) return;
  styleInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    #${ROOT_ID} {
      --shotmark-message-bg: #ffffff;
      --shotmark-message-border: #e8ecf3;
      --shotmark-message-text: #1f2747;
      --shotmark-message-shadow: 0 10px 28px rgba(21, 30, 57, 0.14);
      --shotmark-message-close: #667085;
      --shotmark-message-close-hover: #344054;
      --shotmark-message-success: #17b26a;
      --shotmark-message-error: #f04438;
      position: fixed;
      top: 36px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      flex-direction: column;
      gap: 12px;
      z-index: 2147483647;
      pointer-events: none;
      width: min(680px, calc(100vw - 24px));
      align-items: center;
    }

    #${ROOT_ID}.shotmark-theme-dark {
      --shotmark-message-bg: #2c2c2e;
      --shotmark-message-border: rgba(255, 255, 255, 0.16);
      --shotmark-message-text: #ffffff;
      --shotmark-message-shadow: 0 8px 28px rgba(0, 0, 0, 0.4), 0 2px 6px rgba(0, 0, 0, 0.3);
      --shotmark-message-close: #d0d5dd;
      --shotmark-message-close-hover: #ffffff;
      --shotmark-message-success: #15e645;
      --shotmark-message-error: #ff4538;
    }

    .shotmark-message-item {
      pointer-events: auto;
      width: fit-content;
      max-width: 100%;
      background: var(--shotmark-message-bg);
      border: 1px solid var(--shotmark-message-border);
      border-radius: 10px;
      box-shadow: var(--shotmark-message-shadow);
      color: var(--shotmark-message-text);
      font-size: 15px;
      line-height: 22px;
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 8px 12px;
      box-sizing: border-box;
      opacity: 0;
      transform: translateY(-8px);
      transition: opacity 0.2s ease, transform 0.2s ease;
    }

    .shotmark-message-item.show {
      opacity: 1;
      transform: translateY(0);
    }

    .shotmark-message-icon {
      width: 20px;
      height: 20px;
      flex: 0 0 20px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .shotmark-message-icon.success {
      color: var(--shotmark-message-success);
    }

    .shotmark-message-icon.error {
      color: var(--shotmark-message-error);
    }

    .shotmark-message-icon-svg {
      width: 20px;
      height: 20px;
      display: block;
      flex-shrink: 0;
    }

    .shotmark-message-content {
      display: inline-flex;
      align-items: center;
      min-height: 22px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .shotmark-message-close {
      border: 0;
      background: transparent;
      color: var(--shotmark-message-close);
      cursor: pointer;
      padding: 0;
      margin-left: 2px;
      width: 24px;
      height: 24px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: color 0.18s ease;
    }

    .shotmark-message-close:hover {
      color: var(--shotmark-message-close-hover);
    }

    .shotmark-message-close-svg {
      width: 20px;
      height: 20px;
      display: block;
    }
  `;
  document.head.appendChild(style);
};

const ensureRoot = (): HTMLElement => {
  ensureStyle();
  let root = document.getElementById(ROOT_ID);
  if (!root) {
    root = document.createElement('div');
    root.id = ROOT_ID;
    document.body.appendChild(root);
  }
  root.className = getThemeClassName();
  return root;
};

const removeMessage = (el: HTMLElement): void => {
  el.classList.remove('show');
  window.setTimeout(() => {
    el.remove();
  }, 220);
};

export const showMessage = ({ type, content, duration = 2400 }: ShowMessageOptions): void => {
  const root = ensureRoot();
  const item = document.createElement('div');
  item.className = 'shotmark-message-item';

  const icon = document.createElement('span');
  icon.className = `shotmark-message-icon ${type}`;
  icon.appendChild(createMessageIcon(type));

  const text = document.createElement('span');
  text.className = 'shotmark-message-content';
  text.textContent = content;

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'shotmark-message-close';
  close.setAttribute('aria-label', 'close');
  close.appendChild(createCloseIcon());
  close.onclick = () => removeMessage(item);

  item.appendChild(icon);
  item.appendChild(text);
  item.appendChild(close);
  root.appendChild(item);

  requestAnimationFrame(() => item.classList.add('show'));
  window.setTimeout(() => removeMessage(item), duration);
};
