import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';

const external = (id) =>
  /^@constellation-network\/|^zod/.test(id);

const plugins = [
  resolve(),
  typescript({ tsconfig: './tsconfig.json' }),
];

const entries = [
  { input: 'src/index.ts', cjs: 'dist/cjs/core/index.js', esm: 'dist/esm/core/index.js' },
  { input: 'src/network/index.ts', cjs: 'dist/cjs/network/index.js', esm: 'dist/esm/network/index.js' },
];

export default entries.map(({ input, cjs, esm }) => ({
  input,
  output: [
    { file: cjs, format: 'cjs', sourcemap: true, exports: 'named', interop: 'auto' },
    { file: esm, format: 'es', sourcemap: true },
  ],
  external,
  plugins,
}));
