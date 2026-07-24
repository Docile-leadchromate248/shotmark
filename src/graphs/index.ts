/**
 * 图形插件注册中心
 */
import { registerGraph } from './registry';
import rectangle from './rectangle';
import ellipse from './ellipse';
import arrow from './arrow';
import line from './line';
import brush from './brush';
import highlight from './highlight';
import measure from './measure';
import mosaic from './mosaic';
import number from './number';
import text from './text';

/**
 * 注册所有图形插件
 */
export const registerGraphPlugins = (): void => {
  registerGraph(rectangle);
  registerGraph(ellipse);
  registerGraph(arrow);
  registerGraph(line);
  registerGraph(brush);
  registerGraph(highlight);
  registerGraph(measure);
  registerGraph(mosaic);
  registerGraph(number);
  registerGraph(text);
};

export {
  draw,
  getKeys,
  setConfig,
  initDefaultConfig,
  applyDefaultConfig,
  applyUserMemory,
} from './registry';
export { flushActiveText, discardActiveText, restyleActiveText } from './text';
