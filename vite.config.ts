import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // 將 pdfjs-dist 分離為獨立 chunk，避免影響初始載入速度
          'pdfjs': ['pdfjs-dist'],
        },
      },
    },
    chunkSizeWarningLimit: 1300,  // pdfjs worker 約 1.2MB，為正常範圍
  },
})
