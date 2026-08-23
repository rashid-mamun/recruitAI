import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    envDir: path.resolve(__dirname, '../..'),
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (!id.includes('node_modules')) return undefined;
                    if (id.includes('@tanstack')) return 'vendor-query';
                    if (id.includes('react') || id.includes('scheduler')) return 'vendor-react';
                    if (id.includes('axios')) return 'vendor-http';
                    if (id.includes('lucide')) return 'vendor-icons';
                    return 'vendor';
                },
            },
        },
    },
    server: {
        host: '0.0.0.0',
        port: 5173,
        proxy: {
            '/api': {
                target: process.env.VITE_API_URL ?? 'http://localhost:5000',
                changeOrigin: true,
            },
            '/health': {
                target: process.env.VITE_API_URL ?? 'http://localhost:5000',
                changeOrigin: true,
            },
        },
    },
});
