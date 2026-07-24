# Docs Template

本模板用于发布前快速搭建文档站入口页，覆盖三类内容：

- API 文档入口
- 在线 Demo 入口
- Sandbox 入口（CodeSandbox / StackBlitz）

## 目录结构

```
template/
├─ index.md      文档首页（产品定位 + 快速开始 + 三入口）
├─ api.md        API 参数表与示例
├─ demo.md       Demo 场景索引与回归建议
└─ sandbox.md    在线沙盒链接与使用说明
```

## 使用方式

1. 把 `template` 下 md 文件复制到你的文档站目录（如 VitePress `docs/`）。
2. 将占位链接替换为实际地址：

- `https://your-demo.example.com`
- `https://codesandbox.io/s/...`
- `https://stackblitz.com/...`

3. 在导航栏加入 `API / Demo / Sandbox` 三项。

## 发布建议

- 每个版本发布时同步更新 `api.md` 的变更段落。
- Demo 页面标注当前版本号，避免用户误用旧截图。
- Sandbox 保留一个“最小示例”，一个“高级示例”。
