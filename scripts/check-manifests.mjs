import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// Case-sensitive on purpose: trusted publishing and provenance both compare this against
// the GitHub repository, and a mismatch surfaces only at publish time as ENEEDAUTH.
const EXPECTED_REPOSITORY = 'git+https://github.com/TopClans/looped-loader.git'
const packages = ['packages/core', 'packages/vue', 'packages/assets']
const required = ['name', 'version', 'license', 'repository', 'homepage', 'bugs', 'keywords', 'engines', 'author']

const problems = []

for (const dir of packages) {
  const manifest = JSON.parse(readFileSync(join(root, dir, 'package.json'), 'utf8'))
  const name = manifest.name ?? dir

  for (const field of required) {
    if (manifest[field] === undefined) problems.push(`${name}: missing "${field}"`)
  }
  if (manifest.repository?.url && manifest.repository.url !== EXPECTED_REPOSITORY) {
    problems.push(`${name}: repository.url is "${manifest.repository.url}", expected "${EXPECTED_REPOSITORY}"`)
  }
  if (manifest.private === true) problems.push(`${name}: marked private but meant to be published`)
  if (!Array.isArray(manifest.keywords) || manifest.keywords.length < 3) {
    problems.push(`${name}: needs at least three keywords`)
  }
  if (manifest.engines?.node === undefined) problems.push(`${name}: missing engines.node`)
}

if (problems.length > 0) {
  console.error(`package metadata check failed:\n- ${problems.join('\n- ')}`)
  process.exit(1)
}

console.log(`package metadata ok: ${packages.length} packages`)
