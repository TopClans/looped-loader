import { copyFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const copies = [
  ['LICENSE', 'packages/core/LICENSE'],
  ['LICENSE', 'packages/vue/LICENSE'],
  ['LICENSE', 'packages/assets/LICENSE'],
  ['NOTICE', 'packages/assets/NOTICE'],
]

for (const [from, to] of copies) {
  const target = join(root, to)
  const packageDir = dirname(target)
  if (!existsSync(packageDir)) {
    // Tasks 1-5 run before the assets package exists; skipping is correct, failing is not.
    console.log(`skipped ${to}: ${packageDir} does not exist yet`)
    continue
  }
  const source = join(root, from)
  if (!existsSync(source)) throw new Error(`missing ${from} at the repository root`)
  copyFileSync(source, target)
}
console.log('licence files synced')
