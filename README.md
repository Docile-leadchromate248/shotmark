# shotmark

[![npm version](https://img.shields.io/npm/v/shotmark)](https://www.npmjs.com/package/shotmark)
[![license](https://img.shields.io/npm/l/shotmark)](./LICENSE)
[![bundle size](https://img.shields.io/bundlephobia/minzip/shotmark)](https://bundlephobia.com/package/shotmark)

Lightweight React screenshot annotation library — capture, draw, copy & download in one line.

[中文文档](./README.zh-CN.md)

## Why shotmark?

- **Complete capture + annotate workflow**: Unlike capture-only libraries (e.g. html2canvas), shotmark gives you a full toolbar, undo/redo, copy/download — all out of the box.
- **Zero UI dependency**: No component library required. ~113 kB bundle, embeddable in any stack.
- **Privacy-first**: Everything runs client-side — no server upload.
- **Extensible**: Plugin-based shapes; adding a new annotation type requires minimal code.
- **Polished details**: Per-tool config memory, light/dark theme, i18n, snap-to-axis, real-time mosaic preview, correct z-ordering.

## Install

```bash
pnpm add shotmark
# or: npm i shotmark / yarn add shotmark
```

> `react` and `react-dom` are peer dependencies (>=17). Install them in your host project.

## Quick Start

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

## API

### Shotmark.start(options)

`options` type: `ShotmarkOptions`

| Field              | Type                | Default                                | Description                                               |
| ------------------ | ------------------- | -------------------------------------- | --------------------------------------------------------- |
| region             | HTMLElement \| Rect | -                                      | Target capture area; entering region mode directly        |
| regionPadding      | number              | 0                                      | Extra padding (px) around the region                      |
| autoAnnotate       | boolean             | true                                   | Enter annotation mode immediately in region mode          |
| trigger            | HTMLElement         | -                                      | Element to temporarily hide during capture                |
| actions            | ActionType[]        | ['cancel','copy','download','confirm'] | Action buttons subset & order                             |
| tools              | GraphType[]         | all tools                              | Drawing tools subset & order (includes highlight/measure) |
| defaultTool        | GraphType           | first in tools                         | Pre-selected tool (does not auto-enter draw mode)         |
| defaultColor       | string              | #FF3B30                                | Default primary color                                     |
| defaultLineWidth   | number              | -                                      | Default line width                                        |
| zIndex             | number              | 9998                                   | Overlay z-index                                           |
| onShot             | (res) => void       | -                                      | Callback after confirm                                    |
| fileName           | string              | shotmark_YYYY-MM-DD_HH.mm.ss           | Download file name (no extension)                         |
| format             | 'png' \| 'jpeg'     | 'png'                                  | Export format                                             |
| onShotStart        | () => void          | -                                      | Export started callback                                   |
| onCancel           | () => void          | -                                      | Cancel callback                                           |
| onCopy             | (blob) => void      | -                                      | Copy success callback                                     |
| onCopyError        | (error) => void     | -                                      | Copy failure callback                                     |
| onDownload         | (fullName) => void  | -                                      | Download success callback                                 |
| onDownloadError    | (error) => void     | -                                      | Download failure callback                                 |
| onAnnotationChange | (graph) => void     | -                                      | Annotation data change callback                           |
| locale             | 'zh-CN' \| 'en-US'  | 'zh-CN'                                | Built-in locale                                           |
| localeText         | LocaleTextOverrides | -                                      | Override built-in text                                    |
| theme              | 'light' \| 'dark'   | 'light'                                | Theme mode                                                |
| numberStart        | number              | 1                                      | Starting number for the number tool                       |
| mosaicSize         | number              | 2                                      | Default mosaic block size                                 |
| mosaicSoftness     | number              | 36                                     | Default mosaic softness                                   |

### Shotmark.close()

Programmatically close the screenshot overlay.

## Built-in Tools

`rectangle` · `ellipse` · `arrow` · `line` · `measure` · `brush` · `highlight` · `mosaic` · `text` · `number`

## Keyboard Shortcuts

| Key                              | Action                             |
| -------------------------------- | ---------------------------------- |
| `1`–`9` / `0`                    | Switch to Nth tool                 |
| `Esc`                            | Close screenshot                   |
| `Delete` / `Backspace`           | Delete selected shape              |
| `Ctrl/Cmd + Z`                   | Undo                               |
| `Ctrl/Cmd + Shift + Z`           | Redo                               |
| `Enter`                          | Confirm (enter annotate or export) |
| `Shift` (while dragging measure) | Lock to axis                       |

## Docs

- [User Guide](docs/guide.md) — full feature walkthrough & scenarios
- [Architecture](docs/architecture.md) — internals, design decisions, highlights
- [Changelog](CHANGELOG.md)

## Development

```bash
pnpm storybook        # dev server
pnpm test             # unit tests
pnpm build            # production build
pnpm format           # format code
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](./LICENSE)
