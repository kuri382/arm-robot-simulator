import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    commonjsOptions: {
      include: [/urdf-loader/, /node_modules/]
    }
  },
  optimizeDeps: {
    include: ['urdf-loader']
  },
  publicDir: 'public'
});
