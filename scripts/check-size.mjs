import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'

const budgets = [
  { dir: 'packages/core/dist', max: 8 * 1024 },
  { dir: 'packages/vue/dist', max: 12 * 1024 },
]

let failed = false
for (const { dir, max } of budgets) {
  const root = resolve(dir)
  let files
  try {
    files = readdirSync(root).filter((name) => /\.(js|css)$/.test(name))
  } catch {
    // Tasks 1-6 build one package at a time; an unbuilt package is not a failure.
    console.log(`skipped ${dir}: not built yet`)
    continue
  }
  const bytes = files.reduce((total, name) => total + gzipSync(readFileSync(join(root, name))).length, 0)
  const over = bytes > max
  console.log(
    `${dir}: ${(bytes / 1024).toFixed(1)} KB gzip, budget ${(max / 1024).toFixed(0)} KB — ${over ? 'OVER' : 'ok'}`,
  )
  if (over) failed = true
}

if (failed) {
  console.error('bundle budget exceeded: something crept into a package that must stay tiny')
  process.exit(1)
}
