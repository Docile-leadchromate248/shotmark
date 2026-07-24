# shotmark

[English](./README.md)

轻量网页截图标注组件（React），支持框选、绘制、复制、下载与主题切换。一行启动，零 UI 库依赖。

## 亮点 / 为什么选 shotmark

- **开箱即用的"截图 + 标注"闭环**：纯截图库（如 html2canvas）只把 DOM 转成图，工具栏、标注、撤销重做、复制下载都要自己做；shotmark 一行启动即拥有完整标注体验。
- **零 UI 库依赖**：不绑定任何组件库，包体小（发布包约 113 kB），可嵌入任意技术栈页面。
- **隐私友好**：截图与导出全程浏览器本地完成，不上传服务器。
- **可扩展**：图形插件化，新增标注类型改动面极小。
- **细节到位**：per-tool 配置记忆、light/dark 主题、i18n、尺寸吸附、马赛克实时预览、层级不错乱。

## 文档

- 使用手册（全部功能 / 快捷键 / 场景）：[docs/guide.md](docs/guide.md)
- 架构与原理（目录 / 原理 / 亮点 / 难点）：[docs/architecture.md](docs/architecture.md)
- 更新记录：[CHANGELOG.md](CHANGELOG.md)

## 安装

```bash
pnpm add shotmark
# 或 npm i shotmark / yarn add shotmark
```

> `react` 与 `react-dom` 为 peer 依赖（要求 >=17），需由宿主项目自行安装。

## 快速开始

```ts
import Shotmark from 'shotmark';

Shotmark.start({
  region: document.querySelector('#capture-area') as HTMLElement,
  autoAnnotate: true,
  onShot: (res) => {
    console.log(res.image, res.width, res.height);
  },
});
```

## 对外 API

### Shotmark.start(options)

`options` 类型：`ShotmarkOptions`

| 字段               | 类型                | 默认值                                 | 说明                                         |
| ------------------ | ------------------- | -------------------------------------- | -------------------------------------------- |
| region             | HTMLElement \| Rect | -                                      | 指定截图区域，传入后直接进入区域截图         |
| regionPadding      | number              | 0                                      | region 模式下区域外扩像素                    |
| autoAnnotate       | boolean             | true                                   | region 模式下是否直接进入标注态              |
| trigger            | HTMLElement         | -                                      | 截图时临时隐藏的触发元素                     |
| actions            | ActionType[]        | ['cancel','copy','download','confirm'] | 工具栏动作按钮子集与顺序                     |
| tools              | GraphType[]         | 全部工具                               | 工具栏工具子集与顺序（含 highlight/measure） |
| defaultTool        | GraphType           | tools 第一项                           | 仅用于工具栏默认候选，不会自动进入绘制       |
| defaultColor       | string              | #FF3B30                                | 默认主色                                     |
| defaultLineWidth   | number              | -                                      | 默认线宽                                     |
| zIndex             | number              | 9998                                   | 遮罩层级                                     |
| onShot             | (res) => void       | -                                      | 点击勾后的回调                               |
| fileName           | string              | shotmark_YYYY-MM-DD_HH.mm.ss           | 下载文件名（不含后缀）                       |
| format             | 'png' \| 'jpeg'     | 'png'                                  | 下载格式                                     |
| onShotStart        | () => void          | -                                      | 开始导出时回调                               |
| onCancel           | () => void          | -                                      | 取消截图回调                                 |
| onCopy             | (blob) => void      | -                                      | 复制成功回调                                 |
| onCopyError        | (error) => void     | -                                      | 复制失败回调                                 |
| onDownload         | (fullName) => void  | -                                      | 下载成功回调                                 |
| onDownloadError    | (error) => void     | -                                      | 下载失败回调                                 |
| onAnnotationChange | (graph) => void     | -                                      | 标注数据变化回调                             |
| locale             | 'zh-CN' \| 'en-US'  | 'zh-CN'                                | 内置消息文案语言                             |
| localeText         | LocaleTextOverrides | -                                      | 覆盖内置消息与 UI 文案                       |
| theme              | 'light' \| 'dark'   | 'light'                                | 主题模式                                     |
| numberStart        | number              | 1                                      | number 工具起始序号                          |
| mosaicSize         | number              | 2                                      | 马赛克默认大小                               |
| mosaicSoftness     | number              | 36                                     | 马赛克默认柔化强度                           |

`onShot` 参数类型：`ShotmarkResult`

`Rect` 结构：

```ts
type Rect = {
  left: number;
  top: number;
  width: number;
  height: number;
};
```

### Shotmark.close()

主动关闭截图层。

## 行为说明

1. 勾按钮行为

- 当传入 `onShot` 时，点击勾仅触发 `onShot`。
- 当未传入 `onShot` 时，勾按钮默认回退为“复制到剪贴板”。

2. 消息提示

- 内置成功/失败提示（复制、下载）。
- 支持 `locale` 与 `theme`。
- 支持 `localeText` 覆盖内置文案（消息提示与配置面板文案）。

3. 主题系统

- 内置 `light`、`dark`。
- 工具栏、配置面板、消息、尺寸标签、图形调节点会随主题切换。

4. 尺寸标注（measure）

- 支持水平/垂直吸附，拖拽时按住 `Shift` 可强制锁定到主方向。
- 当前采用方案A（中置分段）：标签居中，线段在标签两侧分段显示。
- 小距离测量会切换为紧凑布局：标签缩小并偏离中线显示，通过一条连接线指向测距线段；位置会按线段方向自适应选择更合适的一侧。

5. 瞄点层级（主次分明）

- 截图区域 8 个调整点：最大（用于全局裁剪，优先级最高）。
- 图形选中调整点（矩形/椭圆/箭头/直线等）：中等。
- 高亮/马赛克调整点：与图形调整点同层，半径略小。
- 尺寸标注端点：最小，但用描边强化可见性。

6. 工具顺序策略

- 默认顺序采用「先分组、后高频」：
- 几何绘制：`rectangle` → `ellipse` → `arrow` → `line` → `measure`
- 手绘与遮挡：`brush` → `highlight` → `mosaic`
- 语义标注：`text` → `number`
- 若业务有强约束，可通过 `tools` 传入自定义顺序覆盖默认值。

7. 默认选中与绘制模式

- 用户完成截图区域选择后，默认不预选任何绘制工具。
- 此时在截图区域内拖拽会移动截图区域位置。
- 只有用户主动点击某个绘制工具（或按 `1~9`、`0` 快捷键选择工具）后，才进入绘制模式。

8. 进入标注态

- 在选区调整态（step=2）支持双击直接进入标注态（step=3）。
- 在 step=2 按 `Enter` 会进入标注态；在 step=3 按 `Enter` 才触发确认导出。

9. 快捷键

- `1~9`：按当前工具栏顺序快速切换前 9 个工具（支持主键盘数字区与数字小键盘）。
- `0`：切换到第 10 个工具（若存在）。
- `Esc`：关闭截图。
- `Delete/Backspace`：删除选中图形。
- `Ctrl/Cmd+Z`：撤销；`Ctrl/Cmd+Shift+Z`：重做。

## Storybook Demo 覆盖

当前已覆盖：

- `FreeSelect`：基础截图与标注流程。
- `MosaicLab`：马赛克参数与导出效果。
- `ApiOptionsLab`：`tools/defaultTool/color/lineWidth/zIndex/region` 等 API 组合。
- `ThemeAndMessageLab`：主题与文案消息 UI。
- `ThemeActionsErrorStatesLab`：主题 + 动作按钮子集 + 错误回调链路。
- `TooltipEdgeCasesLab`：Tooltip 边界翻转、视口 clamp 与层级回归。
- `KeyboardShortcutsLab`：`1~9` 与 `0`（含数字小键盘）全量工具切换回归。
- `MeasureCompactLayoutLab`：measure 短距离（8~40px）紧凑布局回归。
- `PublicPlayground`：最小接入代码展示 + 一键启动 + 导出预览。

以上可覆盖常见业务与主要边界场景，适合发布前回归与用户上手体验。

## 发布交付建议（GitHub）

- Demo：用 Storybook 作为在线交互演示（建议发布到 GitHub Pages）。
- API：维护 README API 表格，并补充最小可运行示例。
- Sandbox：提供 StackBlitz/CodeSandbox 在线模板，用户可一键 fork 试用。
- 版本说明：每次发布附带变更摘要（新增、修复、破坏性变更）。

## Docs 模板

- 已提供 docs 示例工程模板：`docs/template/`
- 包含 `index.md`、`api.md`、`demo.md`、`sandbox.md` 及使用说明，可直接拷贝到文档站初始化。

## 开发脚本

```bash
pnpm storybook
pnpm storybook:reset
pnpm test
pnpm format
pnpm format:check
```

## 提交前校验

已内置 pre-commit：

1. `pnpm lint-staged`（仅检查暂存文件格式）
2. `pnpm -s tsc --noEmit`（类型校验）

## 贡献规范

- 图标实现规范见 [CONTRIBUTING.md](CONTRIBUTING.md) 的 `Icon Guidelines`。
