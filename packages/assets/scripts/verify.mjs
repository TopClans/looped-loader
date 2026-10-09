import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'))

let total = 0
const problems = []

for (const clip of manifest.clips) {
  for (const source of clip.sources) {
    const file = join(root, source.src)
    let bytes
    try {
      bytes = statSync(file).size
    } catch {
      problems.push(`${clip.id}: missing file ${source.src}`)
      continue
    }
    total += bytes
    const declared = clip.bytes?.mp4
    if (declared !== undefined && declared !== bytes)
      problems.push(`${clip.id}: manifest says ${declared} bytes, file is ${bytes}`)
    const digest = createHash('sha256').update(readFileSync(file)).digest('hex')
    const expected = clip.sha256?.mp4
    if (expected && expected !== digest) problems.push(`${clip.id}: sha256 mismatch`)
  }
}

const expectedTotal = manifest.corpus?.totalBytes
if (expectedTotal !== undefined && expectedTotal !== total) {
  problems.push(`corpus total: manifest says ${expectedTotal}, files are ${total}`)
}

if (problems.length > 0) {
  console.error(`assets verification failed:\n- ${problems.join('\n- ')}`)
  process.exit(1)
}
console.log(`assets verified: ${manifest.clips.length} clips, ${(total / 1024 / 1024).toFixed(2)} MB`)
