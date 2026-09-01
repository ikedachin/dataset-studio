import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
export default defineConfig({
    plugins: [react()],
    server: { proxy: { '/api': 'http://127.0.0.1:8765' } },
    build: { outDir: resolve(__dirname, '../src/dataset_studio/static'), emptyOutDir: true },
    test: { environment: 'jsdom', setupFiles: './src/test/setup.ts' },
});
