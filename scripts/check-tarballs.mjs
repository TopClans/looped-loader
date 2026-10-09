#!/usr/bin/env node
// Fails the release when a package would ship incomplete or ship what it must not.
//
// Run it after the root `pnpm build`: scripts/sync-legal.mjs is what writes
// packages/*/LICENSE and packages/assets/NOTICE, and both are gitignored, so in a
// fresh clone they exist only because the build created them.
//
// Usage: node scripts/check-tarballs.mjs [--out <file>]
//   --out writes the full inventory as JSON (the release workflow uploads it as an
//   artifact, so a reviewer can read the file list of what was actually published).
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
// On Windows `npm` is a `.cmd` shim, and Node refuses to spawn one without a shell
// (`ENOENT` without the extension, `EINVAL` with it). The arguments are static, so
// the shell adds no injection surface.
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const npmOptions = { encoding: 'utf8', shell: process.platform === 'win32' }
const packages = ['packages/core', 'packages/vue', 'packages/assets']
const forbidden = [/^gifs\//, /^src\//, /^test\//, /\.probe\//]
const problems = []
const inventory = []

const outIndex = process.argv.indexOf('--out')
const outFile = outIndex === -1 ? null : process.argv[outIndex + 1]
if (outIndex !== -1 && !outFile) {
  console.error('--out needs a file path')
  process.exit(2)
}

for (const dir of packages) {
  const cwd = join(root, dir)
  const output = execFileSync(npm, ['pack', '--dry-run', '--json'], { cwd, ...npmOptions })
  const [{ files, filename, size }] = JSON.parse(output)
  const paths = files.map((file) => file.path)

  inventory.push({ package: dir, filename, size, files: paths })

  if (!paths.includes('LICENSE')) {
    problems.push(`${filename}: no LICENSE in the tarball — did scripts/sync-legal.mjs run?`)
  }
  if (dir.endsWith('assets') && !paths.includes('NOTICE')) {
    problems.push(`${filename}: no NOTICE in the tarball`)
  }
  for (const path of paths) {
    if (forbidden.some((pattern) => pattern.test(path))) {
      problems.push(`${filename}: ships ${path}`)
    }
  }
  console.log(`${filename}: ${paths.length} files, ${size} bytes`)
}

if (outFile) {
  writeFileSync(join(root, outFile), `${JSON.stringify(inventory, null, 2)}\n`)
}

if (problems.length > 0) {
  console.error(`tarball check failed:\n- ${problems.join('\n- ')}`)
  process.exit(1)
}
console.log('tarballs ok')
