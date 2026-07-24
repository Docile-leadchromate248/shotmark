# API

## Shotmark.start(options)

| 字段               | 类型                 | 说明                         |
| ------------------ | -------------------- | ---------------------------- |
| `tools`            | `GraphType[]`        | 工具栏工具子集与顺序         |
| `defaultTool`      | `GraphType`          | 仅默认候选，不会自动进入绘制 |
| `defaultColor`     | `string`             | `#FF3B30`                    |
| `defaultLineWidth` | `number`             | 默认线宽                     |
| `theme`            | `'light' \| 'dark'`  | 主题                         |
| `locale`           | `'zh-CN' \| 'en-US'` | 语言                         |
| `onShot`           | `(res) => void`      | 导出回调                     |

## 最小示例

```ts
Shotmark.start({
  tools: [
    'rectangle',
    'ellipse',
    'arrow',
    'line',
    'measure',
    'brush',
    'highlight',
    'mosaic',
    'text',
    'number',
  ],
  defaultTool: 'rectangle',
  onShot: (res) => {
    console.log(res.image);
  },
});
```

## 版本变更记录（模板）

- `vX.Y.Z`
- 新增：
- 修复：
- 兼容性：
