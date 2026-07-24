# 更新记录 / Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/) 规范，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Added（新增）

- 数字键 `0` 映射到工具栏第 10 个工具（此前仅 `1~9` 覆盖前 9 个）。

### Changed（变更）

- 重构数字键快捷键：仅监听自身 `window` 的 `keydown`，挂载时主动聚焦画布容器，
  移除 `keyup` 兜底与去重集合，物理键码（`ev.code`）优先，不受输入法组合态影响。
- 构建产物将 `@emotion/css`、`clsx` 等运行时依赖外置，不再内联进 `dist`。
- 关闭生产构建 sourcemap 输出，发布包体积由 329 kB 降至约 113 kB。
- 抽离马赛克预览的纯渲染逻辑到 `mosaic-renderer.ts`，`draw-board` 体积下降。

### Fixed（修复）

- 修复关闭截图层时 React “在渲染期间同步卸载 root” 告警：卸载延到微任务执行。

## [0.1.0] - 2026-07-22

### Added（新增）

- 命令式 API：`Shotmark.start(options)` / `Shotmark.close()`，一行启动、零 UI 库依赖。
- 全屏自由框选 + region 定点截图（支持 `HTMLElement` 与 `Rect` 入参）。
- 标注工具：矩形、椭圆、箭头、直线、尺寸测量、画笔、高亮、马赛克、文字、序号。
- 撤销/重做、复制到剪贴板、下载（png/jpeg）、导出 base64。
- 主题（light/dark）、国际化（zh-CN/en-US）与文案覆盖（`localeText`）。
- 快捷键：工具切换、`Esc` 关闭、`Delete/Backspace` 删除、`Ctrl/Cmd+Z` 撤销重做。

[Unreleased]: https://github.com/riverdone/shotmark/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/riverdone/shotmark/releases/tag/v0.1.0
