import { defineConfig, mergeConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import baseConfig from './vite.config'

function inlineFavicon(): import('vite').Plugin {
  return {
    name: 'inline-favicon',
    transformIndexHtml(html) {
      const svg = readFileSync(resolve(__dirname, 'public/favicon.svg'), 'utf-8')
      const dataUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
      return html.replace(/href="\.?\/favicon\.svg"/, `href="${dataUri}"`)
    },
  }
}

export default mergeConfig(baseConfig, defineConfig({
  plugins: [inlineFavicon(), viteSingleFile()],
  build: {
    outDir: 'dist-singlefile',
    copyPublicDir: false,
  },
}))
