#!/usr/bin/env node
// Fails when a relative link in the tracked Markdown points at a path that does not
// exist. The epic, the runbook and the story files cross-reference each other heavily,
// and a renamed file breaks navigation silently — nothing else in the pipeline reads
// those links.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
// Root-level documents that carry relative links. `CHANGELOG.md` was missing from the first
// version of this list, which meant the one root document most likely to link a new policy
// file was the one document the check never read. `ACCESSIBILITY.md` is listed before it
// exists so that adding it (E3.3) cannot silently escape the check; `markdownFiles` returns
// nothing for a path that is absent, so listing a not-yet-created file is safe.
// `CODE_OF_CONDUCT.md` is absent because this project does not publish one — the owner's
// decision, 2026-10-09, recorded as D-31 in `docs/epic/PROGRESS.md`.
const entries = [
  'README.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'SUPPORT.md',
  'GOVERNANCE.md',
  'CHANGELOG.md',
  'ACCESSIBILITY.md',
  'docs',
]
const LINK = /\]\(([^)#\s]+)(?:#[^)]*)?\)/g

function* markdownFiles(entry) {
  const full = join(root, entry)
  if (!existsSync(full)) return
  if (statSync(full).isFile()) {
    yield full
    return
  }
  for (const name of readdirSync(full)) {
    const child = join(full, name)
    if (statSync(child).isDirectory()) yield* markdownFiles(join(entry, name))
    else if (name.endsWith('.md')) yield child
  }
}

const problems = []

for (const entry of entries) {
  for (const file of markdownFiles(entry)) {
    const text = readFileSync(file, 'utf8')
    for (const match of text.matchAll(LINK)) {
      const target = match[1]
      if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue
      if (!existsSync(resolve(dirname(file), target))) {
        problems.push(`${file.replace(root, '.')} → ${target}`)
      }
    }
  }
}

if (problems.length > 0) {
  console.error(`broken relative links:\n- ${problems.join('\n- ')}`)
  process.exit(1)
}

console.log('relative links ok')
