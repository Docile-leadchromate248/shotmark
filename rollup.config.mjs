import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';

import pkg from './package.json' with { type: 'json' };

// 运行时依赖与 peer 依赖一律外置:由使用方 npm 安装,不打进产物,
// 避免依赖被重复打包(此前 @emotion/css、clsx 被内联到 dist/node_modules 下)。
const externalDeps = [
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
  'react/jsx-runtime',
];
const isExternal = (id) => externalDeps.some((dep) => id === dep || id.startsWith(`${dep}/`));

/** @type {import('rollup').RollupOptions} */
export default {
  input: 'src/index.ts',
  output: [
    {
      dir: 'dist/esm',
      format: 'esm',
      sourcemap: false,
      preserveModules: true,
      preserveModulesRoot: 'src',
      exports: 'named',
    },
    {
      dir: 'dist/cjs',
      format: 'cjs',
      sourcemap: false,
      preserveModules: true,
      preserveModulesRoot: 'src',
      exports: 'named',
    },
  ],
  plugins: [
    peerDepsExternal(),
    resolve(),
    commonjs(),
    typescript({
      tsconfig: './tsconfig.json',
      declaration: false,
      exclude: ['stories/**', '**/*.stories.tsx'],
    }),
  ],
  external: isExternal,
};
