import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';

const external = (id) =>
  /^@constellation-network\/|^ethers/.test(id);

const plugins = [
  resolve(),
  typescript({ tsconfig: './tsconfig.json' }),
];

export default {
  input: 'src/index.ts',
  output: [
    { file: 'dist/cjs/index.js', format: 'cjs', sourcemap: true, exports: 'named', interop: 'auto' },
    { file: 'dist/esm/index.js', format: 'es', sourcemap: true },
  ],
  external,
  plugins,
};
