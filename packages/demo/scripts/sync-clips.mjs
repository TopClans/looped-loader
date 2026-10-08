import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const here = dirname(fileURLToPath(import.meta.url))
const demoRoot = resolve(here, '..')
const require = createRequire(import.meta.url)
const assetsRoot = dirname(require.resolve('@topclans/looped-loader-assets/manifest.json'))

const target = join(demoRoot, 'public', 'clips')
rmSync(target, { recursive: true, force: true })
mkdirSync(target, { recursive: true })
cpSync(join(assetsRoot, 'clips'), target, { recursive: true })
console.log(`clips synced to ${target}`)
