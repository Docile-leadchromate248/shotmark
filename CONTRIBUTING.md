# Contributing

## Icon Guidelines

为保证工具栏图标在视觉与技术实现上的一致性，新增/修改图标请遵循以下规则。

1. Must use BaseIcon

- 所有图标组件必须基于 `BaseIcon` 实现。
- 统一从 `src/icons/base.tsx` 引入 `BaseIcon` 与 `SvgIconProps`。

2. ViewBox and coordinate system

- 统一使用 `viewBox="0 0 1024 1024"`（由 `BaseIcon` 提供）。
- 不在单个图标内覆写不同 viewBox，避免尺寸缩放与对齐偏差。

3. Stroke / fill baseline

- 纯轮廓图标：优先 `stroke="currentColor"`，线宽建议以 48~72 为基线。
- 实心图标：使用 `fill="currentColor"`。
- 禁止硬编码业务色值（如 `#1677ff`），颜色一律跟随工具栏主题色。

4. Optical balance

- 图形应居中于 1024 画布，左右留白尽量对称。
- 避免通过非等比缩放（例如只压缩 x 轴）修正比例，这会导致“歪斜感”。
- 需要“缩短/加粗/变细”时，优先重绘 path，而非 transform 拉伸。

5. Naming and export

- 文件命名：`Icon<Name>.tsx`。
- 在 `src/icons/index.ts` 中补齐导出。
- 在 `src/components/toolbar-icon.tsx` 的映射表中注册。

6. Regression checklist

- Light/Dark 主题下视觉对比。
- 20x20 工具栏尺寸下可辨识度。
- 与相邻图标的视觉重量一致（不抢、不虚）。
- Storybook 中检查 hover/active 态颜色表现。
