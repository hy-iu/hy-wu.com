import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { collectEntries } from './scripts/lib.ts'

// MPA：入口由 scripts/build-content.ts 生成（content/ 是唯一源），
// 这里只负责枚举现有 index.html + 404.html，输出目录结构与 URL 一致。
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: Object.fromEntries(
        collectEntries().map((p) => [p.replace(/\/index\.html$|\.html$/, ''), p]),
      ),
    },
  },
})
