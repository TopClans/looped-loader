import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const here = dirname(fileURLToPath(import.meta.url))
const demoRoot = resolve(here, '..')
const require = createRequire(import.meta.url)
const assetsRoot = dirname(require.resolve('@topclans/looped-loader-assets/manifest.json'))

// The manifest and the clips it references must be served from one directory:
// the manifest's sources[].src are relative to it ("clips/<id>.mp4"), so the
// demo points base-url at public/looped-clips as a whole.
const target = join(demoRoot, 'public', 'looped-clips')
rmSync(target, { recursive: true, force: true })
mkdirSync(target, { recursive: true })
cpSync(join(assetsRoot, 'manifest.json'), join(target, 'manifest.json'))
cpSync(join(assetsRoot, 'clips'), join(target, 'clips'), { recursive: true })
console.log(`clips synced to ${target}`)
