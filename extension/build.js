const esbuild = require('esbuild')
const path = require('path')

const entries = [
  'src/background.ts',
  'src/offscreen.ts',
  'src/content-auth.ts',
  'src/popup.ts',
]

for (const entry of entries) {
  esbuild.buildSync({
    entryPoints: [path.join(__dirname, entry)],
    bundle: true,
    outdir: path.join(__dirname, 'dist'),
    format: 'esm',
    platform: 'browser',
    target: ['chrome112'],
    external: [],
    define: { 'process.env.NODE_ENV': '"production"' },
  })
}

console.log('Extension built to extension/dist/')
