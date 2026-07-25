import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const githubPagesBase = process.env.GITHUB_PAGES === 'true'
  ? '/NewTone-Home/'
  : '/'

export default defineConfig({
  base: githubPagesBase,
  plugins: [react()],
})
