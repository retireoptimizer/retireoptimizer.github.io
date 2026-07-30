import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'

const commitDate = (() => {
  try { return execSync('git log -1 --format=%cd --date=short').toString().trim(); }
  catch { return new Date().toISOString().slice(0, 10); }
})();

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '1.0.0'),
    __BUILD_DATE__: JSON.stringify(commitDate),
  },
})
