import { fileURLToPath } from 'node:url'
import base from '../../vite.config.js'
export default {
  ...base,
  cacheDir: fileURLToPath(new URL('./vite-cache', import.meta.url)),
  test: { ...base.test, cache: false, maxWorkers: 1, fileParallelism: false },
}
