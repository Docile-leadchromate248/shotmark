/**
 * shotmark 对外出口。
 *
 * 网页截图标注器:全屏自由框选 + 矩形/椭圆/箭头/直线/画笔/文字标注 + 撤销重做 + 导出 base64。
 * 命令式用法,详见 README。
 */
import ShotmarkController from './controller';

export type { Rect, ShotmarkOptions, ShotmarkResult } from './types';

export default ShotmarkController;
