# shotmark 架构说明

面向贡献者与深度使用者，介绍目录结构、核心原理、设计亮点与难点。使用手册见 [guide.md](./guide.md)。

## 一、目录结构

```
src/
├─ index.ts               对外唯一出口（默认导出 ShotmarkController + 类型）
├─ controller.tsx         命令式控制器：在 body 挂载/卸载全屏标注层，应用 start 选项
├─ stage.tsx              主状态机：step（0 未开始 / 1 截图中 / 2 调整中 / 3 绘图中）
├─ selection-layer.tsx    选区交互层：框选、拖整框、拖 8 个裁剪调整点
├─ annotation-canvas.tsx  标注画布容器：工具栏 + 配置面板 + 尺寸提示 + 快捷键
├─ draw-board.tsx         绘图事件分发中枢：三态（绘制/选中/调整）、撤销栈、原点补偿
├─ mosaic-renderer.ts     马赛克预览的纯图像处理（下采样 + 模糊）
├─ generate-image.ts      导出栅格化：DOM→SVG→图片，叠加标注与真实马赛克
├─ stack.ts               撤销/重做栈（容量上限）
├─ const.ts               全局常量与默认配置
├─ types.ts               对外类型定义
├─ utils.ts               通用工具函数
├─ i18n.ts                内置多语言文案
├─ message.ts             轻量消息提示
├─ theme-mode.ts          主题模式解析
├─ graphs/                图形插件：每种图形一个文件 + registry 注册中心
├─ components/            toolbar / config-panel / graphics（SVG 渲染）/ resize-dot
├─ rasterizer/            DOM→SVG→Image 的栅格化实现
└─ styles/                主题 CSS 变量注入
```

## 二、运行时数据流

```
Shotmark.start(options)
    │
    ▼
Controller               创建独立 React 树，挂载到 document.body
    │
    ▼
Stage                    主状态机，step 0→1→2→3 驱动全流程
    │
    ├─ step 0-2  SelectionLayer      框选 / 8 方位调整点 / 整体拖动
    │
    └─ step 3    AnnotationCanvas    进入标注模式
        │
        ├─ DrawBoard     事件分发中枢：新建 / 选中 / 调整 / 文字编辑
        │   └─ GraphicsLayer         SVG 渲染标注
        │
        ├─ Toolbar       工具按钮 / 撤销重做 / 动作按钮
        │   └─ ConfigPanel           颜色 + 线宽/字号
        │
        └─ 导出流程       captureHtml → drawHTML → generateImage → base64/Blob
```

## 三、核心原理

1. **命令式零 UI 依赖**：对外只暴露 `Shotmark.start()/close()`，内部用 `createRoot` 把全屏遮罩挂到
   `document.body`，不依赖任何 UI 组件库，可嵌入任意 React/非 React 页面。
2. **step 状态机**：`stage.tsx` 用 `step` 驱动"截图→框选→标注"全流程，各层按 step 决定渲染与交互。
3. **图形插件化**：每种图形实现统一的 `GraphPlugin` 接口(down/move/selected/adjust/…)，经
   `registry` 注册到 `draw[event][type]` 分桶表；`draw-board` 在鼠标事件时按当前工具动态取方法调用。
   新增一种图形 = 加一个插件文件 + 在 `graphs/index.ts` 注册，**无需改动分发中枢**。
4. **截图栅格化**：`rasterizer` 把选区 DOM 克隆为 SVG(`foreignObject`)再转 `Image` 绘到 canvas，
   叠加 SVG 标注层与真实马赛克，最终 `toDataURL` 导出，全程在浏览器本地完成，**不上传服务器**。
5. **配置记忆**：`registry` 只把"用户改动过的配置"持久化到 localStorage，优先级
   `用户记忆 > start 选项默认 > 内置默认`，跨会话记住每个工具最后一次的颜色/尺寸等。

## 五、设计亮点

- **零 UI 依赖 + 一行接入**：`Shotmark.start({ onShot })` 即可，落地成本低。
- **插件式可扩展**：图形与分发解耦，新增标注类型改动面极小。
- **本地栅格化、隐私友好**：截图与导出全在前端完成。
- **记忆与主题**：per-tool 记忆、light/dark 主题、i18n 文案覆盖开箱即用。
- **交互指示层级统一**：瞄点/选中框/Tooltip/消息恒在内容之上，Tooltip 与消息经 portal escape 到
  全局顶层，避免被局部层叠上下文遮盖。

## 六、难点与权衡

- **马赛克实时预览 vs 导出**：预览在 1x 画布实时合成，导出按 `PIXEL_RATIO` 放大做高质量处理，
  两套坐标系与采样倍率不同，故 `mosaic-renderer`(预览) 与 `generate-image`(导出) 分离维护——
  强行合并会危及最终导出图质量，属有意的重复。
- **尺寸标注(measure)紧凑布局**：短线段时标签需偏离中线并用引线指向，避免视觉拥挤。
- **截图区域原点补偿**：调整选区时对已有标注反向平移，保证其页面绝对位置不动。
- **draw-board 保留 class 组件**：内部大量命令式状态(ctx/stack/document 级监听)与异步回写，
  转 hooks 反而臃肿易回归,故刻意保留 class。

## 七、构建与发布

- Rollup 双格式产物(esm/cjs) + `preserveModules` 利于 tree-shaking；`dependencies`/`peerDeps`
  一律 external，不内联进产物。
- 类型声明由 `tsc --emitDeclarationOnly` 输出到 `dist/types`。
- 回归：`pnpm typecheck && pnpm test && pnpm lint`。
