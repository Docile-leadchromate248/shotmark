import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

/**
 * 克制的 flat config:只开高价值规则,noisy 规则降级为 warn 或关闭,
 * 目标是挡住真实隐患(未用变量、hooks 依赖、误用),而非制造大量存量告警。
 */
export default tseslint.config(
  {
    ignores: ['dist/**', 'storybook-static/**', 'node_modules/**', '*.config.mjs', '*.config.js'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // 画布/注册器等命令式桥接处有意使用 any,统一关闭而非逐处 disable 注释
      '@typescript-eslint/no-explicit-any': 'off',
      // 未用变量降级为告警,允许 _ 前缀刻意忽略
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-non-null-assertion': 'off',
      // emotion 的 injectGlobal 等 tagged template 靠副作用生效,不算无用表达式
      '@typescript-eslint/no-unused-expressions': ['error', { allowTaggedTemplates: true }],
      // 该规则对「先默认初始化再分支覆盖」误报较多,关闭
      'no-useless-assignment': 'off',
    },
  },
  {
    // Storybook 的 render:(args)=>{...} 是 demo 渲染函数,非发布组件,豁免 hooks 规则
    files: ['stories/**'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
    },
  },
  {
    // 测试文件放宽:允许 any、空函数等
    files: ['src/__tests__/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-function': 'off',
    },
  },
);
