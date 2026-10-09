import { defineConfig } from 'vite';

// 公开 H5 必须能托管在任意静态路径下，因此 base 用相对路径。
// 合规红线：本应用为纯静态站点，不包含任何服务端逻辑，也不发起任何 MCP 调用。
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    target: 'es2020',
    sourcemap: false,
  },
  server: { port: 5180, host: '127.0.0.1' },
});
