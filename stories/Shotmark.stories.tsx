import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import Shotmark from '../src';
import { t } from '../src/i18n';
import { DEFAULT_GRAPH_COLOR } from '../src/const';
import { showMessage } from '../src/message';
import { setThemeMode, type ThemeMode } from '../src/theme-mode';
import type { ActionType, GraphType, Rect, ShotmarkResult } from '../src/types';

interface DemoArgs {
  theme: ThemeMode;
  locale: 'zh-CN' | 'en-US';
  actions: ActionType[];
  format: 'png' | 'jpeg';
  fileName: string;
  tools: GraphType[];
  defaultTool: GraphType;
  defaultColor: string;
  defaultLineWidth: number;
  zIndex: number;
  numberStart: number;
  mosaicSize: number;
  mosaicSoftness: number;
  onShot?: (res: ShotmarkResult) => void;
  onAnnotationChange?: (graph: unknown[]) => void;
  onCancel?: () => void;
  onCopy?: () => void;
  onCopyError?: (err: string) => void;
  onDownload?: (name: string) => void;
  onDownloadError?: (err: string) => void;
}

const meta: Meta<DemoArgs> = {
  title: 'Shotmark',
  parameters: { layout: 'fullscreen' },
  args: {
    theme: 'light',
    locale: 'zh-CN',
    actions: ['cancel', 'copy', 'download', 'confirm'],
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
    defaultColor: DEFAULT_GRAPH_COLOR,
    defaultLineWidth: 4,
    zIndex: 9998,
    format: 'png',
    fileName: '',
    numberStart: 1,
    mosaicSize: 2,
    mosaicSoftness: 36,
  },
  argTypes: {
    theme: { control: 'inline-radio', options: ['light', 'dark'] },
    locale: { control: 'inline-radio', options: ['zh-CN', 'en-US'] },
    actions: {
      control: 'check',
      options: ['cancel', 'copy', 'download', 'confirm'],
      description: '工具栏动作按钮子集与顺序',
    },
    tools: {
      control: 'check',
      options: [
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
      description: '工具栏工具子集与顺序',
    },
    defaultTool: {
      control: 'select',
      options: [
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
    },
    defaultColor: { control: 'color' },
    defaultLineWidth: { control: { type: 'range', min: 1, max: 20, step: 1 } },
    zIndex: { control: { type: 'number', min: 1, step: 1 } },
    format: { control: 'inline-radio', options: ['png', 'jpeg'] },
    fileName: { control: 'text' },
    numberStart: { control: { type: 'number', min: 1, max: 999, step: 1 } },
    mosaicSize: { control: { type: 'range', min: 1, max: 24, step: 1 } },
    mosaicSoftness: { control: { type: 'range', min: 0, max: 100, step: 1 } },
    onShot: { action: 'onShot' },
    onAnnotationChange: { action: 'onAnnotationChange' },
    onCancel: { action: 'onCancel' },
    onCopy: { action: 'onCopy' },
    onCopyError: { action: 'onCopyError' },
    onDownload: { action: 'onDownload' },
    onDownloadError: { action: 'onDownloadError' },
  },
};

export default meta;

type Story = StoryObj<DemoArgs>;

const pageStyle = (theme: ThemeMode): React.CSSProperties => ({
  padding: 32,
  minHeight: '100vh',
  background: theme === 'light' ? '#f3f4f6' : '#111827',
  color: theme === 'light' ? '#1f2937' : '#f9fafb',
  transition: 'all .2s ease',
});

const rowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  marginBottom: 14,
  flexWrap: 'wrap',
};

const ghostBtnStyle = (theme: ThemeMode): React.CSSProperties => ({
  padding: '8px 14px',
  borderRadius: 8,
  border: theme === 'light' ? '1px solid #d1d5db' : '1px solid #4b5563',
  background: theme === 'light' ? '#ffffff' : '#1f2937',
  color: theme === 'light' ? '#111827' : '#f9fafb',
  cursor: 'pointer',
  fontSize: 14,
});

const primaryBtnStyle = (theme: ThemeMode): React.CSSProperties => ({
  padding: '10px 20px',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  fontSize: 14,
  background: theme === 'light' ? '#111827' : '#f3f4f6',
  color: theme === 'light' ? '#ffffff' : '#111827',
});

const startWithArgs = (args: DemoArgs, onShot?: (res: ShotmarkResult) => void): void => {
  Shotmark.start({
    theme: args.theme,
    locale: args.locale,
    actions: args.actions,
    tools: args.tools,
    defaultTool: args.defaultTool,
    defaultColor: args.defaultColor,
    defaultLineWidth: args.defaultLineWidth,
    zIndex: args.zIndex,
    fileName: args.fileName.trim() ? args.fileName : undefined,
    format: args.format,
    numberStart: args.numberStart,
    mosaicSize: args.mosaicSize,
    mosaicSoftness: args.mosaicSoftness,
    onAnnotationChange: (graph) => args.onAnnotationChange?.(graph),
    onShot: (res) => {
      args.onShot?.(res);
      onShot?.(res);
    },
    onCancel: () => args.onCancel?.(),
    onCopy: () => args.onCopy?.(),
    onCopyError: (err) => args.onCopyError?.(String(err)),
    onDownload: (name) => args.onDownload?.(name),
    onDownloadError: (err) => args.onDownloadError?.(String(err)),
  });
};

/** 自由框选模式（含 Controls + Actions） */
export const FreeSelect: Story = {
  render: (args) => {
    const [result, setResult] = useState<string>('');
    return (
      <div style={{ padding: 40, minHeight: '100vh', background: '#f0f2f5' }}>
        <h1 style={{ marginBottom: 16 }}>Shotmark 截图标注演示</h1>
        <p style={{ marginBottom: 24, color: '#666' }}>
          点击下方按钮开始截图，自由框选区域后可使用工具栏标注。
        </p>
        <button
          onClick={() => {
            startWithArgs(args, (res) => setResult(res.image));
          }}
          style={{
            padding: '8px 24px',
            fontSize: 14,
            background: '#1677ff',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          开始截图
        </button>

        {result && (
          <div style={{ marginTop: 24 }}>
            <h3>截图结果:</h3>
            <img
              src={result}
              alt="shotmark-result"
              style={{ maxWidth: '100%', border: '1px solid #ddd', borderRadius: 4 }}
            />
          </div>
        )}

        <div style={{ marginTop: 40, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div
            style={{
              padding: 20,
              background: '#fff',
              borderRadius: 8,
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            }}
          >
            <h3>卡片 A</h3>
            <p>这是一段示例文本内容，用于验证截图效果。</p>
          </div>
          <div
            style={{
              padding: 20,
              background: '#fff',
              borderRadius: 8,
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            }}
          >
            <h3>卡片 B</h3>
            <p>包含不同元素：链接、图标、颜色等。</p>
            <span style={{ color: '#1677ff' }}>蓝色链接文本</span>
          </div>
        </div>
      </div>
    );
  },
};

/** 马赛克参数实验室：验证大小默认值与可调性 */
export const MosaicLab: Story = {
  args: {
    mosaicSize: 2,
    mosaicSoftness: 36,
  },
  render: (args) => (
    <div style={pageStyle(args.theme)}>
      <h2 style={{ marginBottom: 12 }}>马赛克参数实验室</h2>
      <p style={{ marginBottom: 16, opacity: 0.88 }}>
        在 Controls 面板调整 mosaicSize（1~24）和
        mosaicSoftness（0~100），点击按钮后对比框选马赛克与导出效果。
      </p>
      <div style={rowStyle}>
        <button onClick={() => startWithArgs(args)} style={primaryBtnStyle(args.theme)}>
          启动截图（size: {args.mosaicSize}，softness: {args.mosaicSoftness}）
        </button>
      </div>
      <div
        style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            style={{
              height: 72,
              borderRadius: 10,
              background:
                i % 2
                  ? 'linear-gradient(135deg, #ffd8d8 0%, #fff5f5 100%)'
                  : 'linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%)',
              border: '1px solid rgba(0,0,0,0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 600,
            }}
          >
            示例块 {i + 1}
          </div>
        ))}
      </div>
    </div>
  ),
};

/** P0 API 参数实验室：验证 tools/defaultTool/defaultColor/defaultLineWidth/zIndex/region */
export const ApiOptionsLab: Story = {
  render: (args) => {
    const [count, setCount] = useState(0);

    const launchByRegion = (): void => {
      const target = document.getElementById('api-options-region-card');
      if (!target) return;
      const r = target.getBoundingClientRect();
      const region: Rect = { left: r.left, top: r.top, width: r.width, height: r.height };
      Shotmark.start({
        region,
        regionPadding: 6,
        autoAnnotate: true,
        theme: args.theme,
        locale: args.locale,
        actions: args.actions,
        tools: args.tools,
        defaultTool: args.defaultTool,
        defaultColor: args.defaultColor,
        defaultLineWidth: args.defaultLineWidth,
        zIndex: args.zIndex,
        numberStart: args.numberStart,
        mosaicSize: args.mosaicSize,
        mosaicSoftness: args.mosaicSoftness,
        onAnnotationChange: (graph) => {
          setCount(graph.length);
          args.onAnnotationChange?.(graph);
        },
      });
    };

    return (
      <div style={pageStyle(args.theme)}>
        <h2 style={{ marginBottom: 12 }}>P0 API 参数实验室</h2>
        <p style={{ marginBottom: 16, opacity: 0.88 }}>
          验证 tools/defaultTool/defaultColor/defaultLineWidth/zIndex 与 region/autoAnnotate。
        </p>
        <div style={rowStyle}>
          <button onClick={launchByRegion} style={primaryBtnStyle(args.theme)}>
            region 启动（默认工具: {args.defaultTool}）
          </button>
          <span style={{ alignSelf: 'center', opacity: 0.86 }}>当前标注数量: {count}</span>
        </div>
        <div
          id="api-options-region-card"
          style={{
            marginTop: 12,
            padding: 20,
            borderRadius: 12,
            border: '1px dashed rgba(0,0,0,0.2)',
            background: args.theme === 'light' ? '#ffffff' : '#1f2937',
          }}
        >
          <h3 style={{ margin: 0, marginBottom: 8 }}>Region Target Card</h3>
          <p style={{ margin: 0, opacity: 0.8 }}>使用 region 直接启动到该区域。</p>
        </div>
      </div>
    );
  },
};

/** 主题消息预览：只做 Light/Dark 与消息 UI 验证 */
export const ThemeAndMessageLab: Story = {
  render: () => {
    const [theme, setTheme] = useState<ThemeMode>('light');
    const [locale, setLocale] = useState<'zh-CN' | 'en-US'>('zh-CN');

    const applyTheme = (next: ThemeMode): void => {
      setTheme(next);
      setThemeMode(next);
    };

    const msg = {
      copySuccess: locale === 'zh-CN' ? '已复制到剪贴板' : 'Copied to clipboard',
      copyError:
        locale === 'zh-CN'
          ? '复制失败，请检查剪贴板权限'
          : 'Copy failed. Please check clipboard permission',
      downloadSuccess: locale === 'zh-CN' ? '下载成功' : 'Download succeeded',
      downloadError:
        locale === 'zh-CN' ? '下载失败，请稍后重试' : 'Download failed. Please try again later',
    };

    return (
      <div style={pageStyle(theme)}>
        <h2 style={{ marginBottom: 12 }}>主题与消息验证面板</h2>
        <p style={{ marginBottom: 20, opacity: 0.86 }}>
          本场景仅验证消息 UI 在 Light/Dark、中英文下的视觉与文案，不覆盖截图业务流程。
        </p>

        <div style={rowStyle}>
          <button onClick={() => applyTheme('light')} style={ghostBtnStyle(theme)}>
            切换 Light
          </button>
          <button onClick={() => applyTheme('dark')} style={ghostBtnStyle(theme)}>
            切换 Dark
          </button>
          <button onClick={() => setLocale('zh-CN')} style={ghostBtnStyle(theme)}>
            文案：中文
          </button>
          <button onClick={() => setLocale('en-US')} style={ghostBtnStyle(theme)}>
            文案：英文
          </button>
        </div>

        <div style={rowStyle}>
          <button
            onClick={() => showMessage({ type: 'success', content: msg.copySuccess })}
            style={ghostBtnStyle(theme)}
          >
            预览复制成功
          </button>
          <button
            onClick={() => showMessage({ type: 'error', content: msg.copyError })}
            style={ghostBtnStyle(theme)}
          >
            预览复制失败
          </button>
          <button
            onClick={() => showMessage({ type: 'success', content: msg.downloadSuccess })}
            style={ghostBtnStyle(theme)}
          >
            预览下载成功
          </button>
          <button
            onClick={() => showMessage({ type: 'error', content: msg.downloadError })}
            style={ghostBtnStyle(theme)}
          >
            预览下载失败
          </button>
        </div>
      </div>
    );
  },
};

/** 业务组合回归：Theme + Actions + Locale + Shotmark Flow */
export const ThemeActionsErrorStatesLab: Story = {
  render: () => {
    const [theme, setTheme] = useState<ThemeMode>('light');
    const [locale, setLocale] = useState<'zh-CN' | 'en-US'>('zh-CN');
    const [actions, setActions] = useState<ActionType[]>(['cancel', 'copy', 'download', 'confirm']);

    const toggle = (value: ActionType): void => {
      setActions((prev) =>
        prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
      );
    };

    return (
      <div style={pageStyle(theme)}>
        <h2 style={{ marginBottom: 12 }}>组合回归实验室</h2>
        <p style={{ marginBottom: 16, opacity: 0.88 }}>
          本场景只验证业务组合：主题、动作按钮子集/顺序、locale、截图流程与错误回调链路。
        </p>

        <div style={rowStyle}>
          <button
            onClick={() => {
              setTheme('light');
              setThemeMode('light');
            }}
            style={ghostBtnStyle(theme)}
          >
            Light
          </button>
          <button
            onClick={() => {
              setTheme('dark');
              setThemeMode('dark');
            }}
            style={ghostBtnStyle(theme)}
          >
            Dark
          </button>
          <button onClick={() => setLocale('zh-CN')} style={ghostBtnStyle(theme)}>
            locale: zh-CN
          </button>
          <button onClick={() => setLocale('en-US')} style={ghostBtnStyle(theme)}>
            locale: en-US
          </button>
        </div>

        <div style={{ ...rowStyle, marginBottom: 20 }}>
          {(['cancel', 'copy', 'download', 'confirm'] as const).map((a) => (
            <label key={a} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={actions.includes(a)} onChange={() => toggle(a)} />
              {a}
            </label>
          ))}
        </div>

        <button
          onClick={() => {
            Shotmark.start({
              theme,
              actions,
              locale,
              onCopyError: () => showMessage({ type: 'error', content: t('copyError') }),
              onDownloadError: () => showMessage({ type: 'error', content: t('downloadError') }),
            });
          }}
          style={primaryBtnStyle(theme)}
        >
          启动截图（Theme: {theme}，Locale: {locale}，Actions: {actions.join(' > ') || 'none'}）
        </button>
      </div>
    );
  },
};

/** Tooltip 边界回归：验证四角/窄区域下提示框不越界且不被遮挡 */
export const TooltipEdgeCasesLab: Story = {
  render: (args) => {
    const launchAtCorner = (corner: 'tl' | 'tr' | 'bl' | 'br'): void => {
      const pad = 6;
      const width = 240;
      const height = 132;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const left = corner.includes('r') ? vw - width - pad : pad;
      const top = corner.includes('b') ? vh - height - pad : pad;

      Shotmark.start({
        theme: args.theme,
        locale: args.locale,
        actions: args.actions,
        tools: args.tools,
        defaultTool: 'measure',
        defaultColor: args.defaultColor,
        defaultLineWidth: args.defaultLineWidth,
        zIndex: args.zIndex,
        region: { left, top, width, height },
        autoAnnotate: true,
      });
    };

    return (
      <div style={pageStyle(args.theme)}>
        <h2 style={{ marginBottom: 12 }}>Tooltip 边界回归实验室</h2>
        <p style={{ marginBottom: 16, opacity: 0.86 }}>
          点击四角按钮后，将自动在视口边缘进入标注态。把鼠标悬停在工具栏任意图标 1 秒，检查 Tooltip
          是否完整显示且位于最上层。
        </p>
        <div style={rowStyle}>
          <button onClick={() => launchAtCorner('tl')} style={ghostBtnStyle(args.theme)}>
            左上角区域
          </button>
          <button onClick={() => launchAtCorner('tr')} style={ghostBtnStyle(args.theme)}>
            右上角区域
          </button>
          <button onClick={() => launchAtCorner('bl')} style={ghostBtnStyle(args.theme)}>
            左下角区域
          </button>
          <button onClick={() => launchAtCorner('br')} style={ghostBtnStyle(args.theme)}>
            右下角区域
          </button>
        </div>
        <div
          style={{
            marginTop: 18,
            padding: 16,
            borderRadius: 12,
            border: '1px dashed rgba(0, 0, 0, 0.2)',
            background: args.theme === 'light' ? '#fff' : '#1f2937',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 6 }}>回归要点</div>
          <div style={{ opacity: 0.82, lineHeight: '22px' }}>
            1. Tooltip 不应超出屏幕边界。
            <br />
            2. 顶部放不下时应自动翻转到底部。
            <br />
            3. Tooltip 层级应高于选区瞄点与工具栏元素。
          </div>
        </div>
      </div>
    );
  },
};

/** 快捷键回归：验证 1~9 + 0 能按工具栏顺序切换全部工具（含数字小键盘） */
export const KeyboardShortcutsLab: Story = {
  args: {
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
  },
  render: (args) => {
    const hotkeyMap = args.tools
      .slice(0, 10)
      // 1~9 对应前 9 个工具,第 10 个工具用数字键 0 切换
      .map((tool, index) => `${index === 9 ? 0 : index + 1} -> ${tool}`)
      .join('  |  ');

    return (
      <div style={pageStyle(args.theme)}>
        <h2 style={{ marginBottom: 12 }}>快捷键回归实验室</h2>
        <p style={{ marginBottom: 14, opacity: 0.86 }}>
          启动后直接按 1~9 切换前 9 个工具，按 0 切换第 10
          个工具（主键盘数字区或数字小键盘均可），检查高亮工具是否与工具栏顺序一致。
        </p>
        <div style={rowStyle}>
          <button
            onClick={() => {
              Shotmark.start({
                theme: args.theme,
                locale: args.locale,
                actions: args.actions,
                tools: args.tools,
                defaultTool: args.defaultTool,
                defaultColor: args.defaultColor,
                defaultLineWidth: args.defaultLineWidth,
                zIndex: args.zIndex,
              });
            }}
            style={primaryBtnStyle(args.theme)}
          >
            启动截图（快捷键回归）
          </button>
        </div>
        <div
          style={{
            marginTop: 14,
            padding: 14,
            borderRadius: 10,
            border: '1px dashed rgba(0,0,0,0.2)',
            background: args.theme === 'light' ? '#fff' : '#1f2937',
            fontSize: 13,
            lineHeight: '22px',
            opacity: 0.9,
          }}
        >
          当前映射：{hotkeyMap}
        </div>
      </div>
    );
  },
};

/** 小距离 measure 回归：验证短线段时标签偏离中线，避免视觉拥挤 */
export const MeasureCompactLayoutLab: Story = {
  args: {
    defaultTool: 'measure',
  },
  render: (args) => {
    const launchByRegion = (): void => {
      const target = document.getElementById('measure-compact-target');
      if (!target) return;
      const r = target.getBoundingClientRect();
      const region: Rect = { left: r.left, top: r.top, width: r.width, height: r.height };
      Shotmark.start({
        region,
        regionPadding: 6,
        autoAnnotate: true,
        theme: args.theme,
        locale: args.locale,
        actions: args.actions,
        tools: args.tools,
        defaultTool: 'measure',
        defaultColor: args.defaultColor,
        defaultLineWidth: args.defaultLineWidth,
        zIndex: args.zIndex,
      });
    };

    return (
      <div style={pageStyle(args.theme)}>
        <h2 style={{ marginBottom: 12 }}>小距离 Measure 回归实验室</h2>
        <p style={{ marginBottom: 14, opacity: 0.86 }}>
          进入后优先绘制 8~40px 的短距离线段，检查标签是否偏离中线、线段本体是否清晰。
        </p>
        <div style={rowStyle}>
          <button onClick={launchByRegion} style={primaryBtnStyle(args.theme)}>
            region 启动（measure 短距离回归）
          </button>
        </div>
        <div
          id="measure-compact-target"
          style={{
            marginTop: 12,
            padding: 20,
            borderRadius: 14,
            border: '1px dashed rgba(0,0,0,0.18)',
            background:
              args.theme === 'light'
                ? 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)'
                : 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 8 }}>建议回归点</div>
          <div style={{ opacity: 0.82, lineHeight: '22px' }}>
            1. 10~20px：标签不压在线段中间。
            <br />
            2. 30~60px：标签与端点关系清晰。
            <br />
            3. 斜向线段：标签偏移方向稳定。
          </div>
        </div>
      </div>
    );
  },
};

/** Public Playground：最小接入代码 + 一键启动 */
export const PublicPlayground: Story = {
  render: (args) => {
    const [result, setResult] = useState<ShotmarkResult | null>(null);
    const snippet = `import Shotmark from 'shotmark';\n\nShotmark.start({\n  tools: ['rectangle', 'ellipse', 'arrow', 'line', 'measure', 'brush', 'highlight', 'mosaic', 'text', 'number'],\n  defaultTool: 'rectangle',\n  onShot: (res) => console.log(res.image),\n});`;

    return (
      <div style={pageStyle(args.theme)}>
        <h2 style={{ marginBottom: 12 }}>Public Playground</h2>
        <p style={{ marginBottom: 16, opacity: 0.88 }}>
          这是给 GitHub 用户的最小上手页：先看接入代码，再一键启动截图。
        </p>
        <div style={rowStyle}>
          <button
            onClick={() => {
              Shotmark.start({
                theme: args.theme,
                locale: args.locale,
                actions: args.actions,
                tools: args.tools,
                defaultTool: args.defaultTool,
                defaultColor: args.defaultColor,
                defaultLineWidth: args.defaultLineWidth,
                zIndex: args.zIndex,
                onShot: (res) => {
                  args.onShot?.(res);
                  setResult(res);
                },
              });
            }}
            style={primaryBtnStyle(args.theme)}
          >
            一键启动截图
          </button>
          <button onClick={() => setResult(null)} style={ghostBtnStyle(args.theme)}>
            清空结果
          </button>
        </div>
        <div
          style={{
            marginTop: 14,
            borderRadius: 12,
            border: '1px solid rgba(0, 0, 0, 0.12)',
            background: args.theme === 'light' ? '#0f172a' : '#020617',
            color: '#e2e8f0',
            padding: 14,
            overflowX: 'auto',
          }}
        >
          <pre style={{ margin: 0, fontSize: 12, lineHeight: '20px' }}>{snippet}</pre>
        </div>
        {result?.image && (
          <div style={{ marginTop: 18 }}>
            <div style={{ marginBottom: 8, fontWeight: 600 }}>截图结果预览</div>
            <img
              src={result.image}
              alt="public-playground-result"
              style={{
                maxWidth: '100%',
                borderRadius: 10,
                border: '1px solid rgba(0, 0, 0, 0.15)',
              }}
            />
          </div>
        )}
      </div>
    );
  },
};
