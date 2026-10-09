import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { hasFfmpeg } from '../src/ffmpeg.js'
import { main } from '../src/index.js'

const available = hasFfmpeg()
const workDir = mkdtempSync(join(tmpdir(), 'looped-cli-'))

afterAll(() => rmSync(workDir, { recursive: true, force: true }))

/** Generates a tiny lavfi testsrc clip exactly like pipeline.test.ts — no binary asset is committed. */
const makeClip = (dir: string, name: string): void => {
  mkdirSync(dir, { recursive: true })
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-f',
    'lavfi',
    '-i',
    'testsrc=size=160x120:rate=10:duration=0.6',
    '-pix_fmt',
    'yuv420p',
    '-c:v',
    'libx264',
    '-threads',
    '1',
    join(dir, `${name}.mp4`),
  ])
}

const clipIds = (manifestPath: string): string[] => {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { clips: Array<{ id: string }> }
  return manifest.clips.map((clip) => clip.id)
}

describe.skipIf(!available)('transcode CLI', () => {
  it('refuses a gifs directory that contains no mp4 files and writes nothing', async () => {
    const gifs = join(workDir, 'empty-gifs', 'gifs')
    const out = join(workDir, 'empty-gifs', 'out')
    mkdirSync(gifs, { recursive: true })
    expect(await main(['--gifs', gifs, '--out', out])).toBe(1)
    expect(existsSync(join(out, 'manifest.json'))).toBe(false)
    expect(existsSync(join(out, 'clips'))).toBe(false)
    expect(existsSync(join(out, '.work'))).toBe(false)
  })

  it('refuses a gifs path that does not exist without throwing', async () => {
    const out = join(workDir, 'missing-gifs', 'out')
    expect(await main(['--gifs', join(workDir, 'missing-gifs', 'gifs'), '--out', out])).toBe(1)
    expect(existsSync(join(out, 'clips'))).toBe(false)
  })

  it('refuses a gifs path that is a file, not a directory', async () => {
    const filePath = join(workDir, 'gifs-as-file.mp4')
    writeFileSync(filePath, 'this is a file, not a directory')
    const out = join(workDir, 'gifs-as-file', 'out')
    expect(await main(['--gifs', filePath, '--out', out])).toBe(1)
    expect(existsSync(join(out, 'clips'))).toBe(false)
  })

  it('refuses --only naming an id that does not exist and writes no manifest', async () => {
    const gifs = join(workDir, 'only-ghost', 'gifs')
    makeClip(gifs, 'real')
    const out = join(workDir, 'only-ghost', 'out')
    expect(await main(['--gifs', gifs, '--out', out, '--only', 'ghost'])).toBe(1)
    expect(existsSync(join(out, 'manifest.json'))).toBe(false)
  })

  it('fails --check --only for a missing id after a successful build and leaves the manifest alone', async () => {
    const gifs = join(workDir, 'check-only-ghost', 'gifs')
    makeClip(gifs, 'real')
    const out = join(workDir, 'check-only-ghost', 'out')
    expect(await main(['--gifs', gifs, '--out', out])).toBe(0)
    const committed = readFileSync(join(out, 'manifest.json'), 'utf8')
    expect(await main(['--gifs', gifs, '--out', out, '--only', 'ghost', '--check'])).toBe(1)
    expect(readFileSync(join(out, 'manifest.json'), 'utf8')).toBe(committed)
  })

  it('prunes orphan clips on a full run into the same out directory', async () => {
    const gifsA = join(workDir, 'prune-orphans', 'gifs-a')
    const gifsB = join(workDir, 'prune-orphans', 'gifs-b')
    makeClip(gifsA, 'aaa')
    makeClip(gifsB, 'bbb')
    const out = join(workDir, 'prune-orphans', 'out')
    expect(await main(['--gifs', gifsA, '--out', out])).toBe(0)
    expect(existsSync(join(out, 'clips', 'aaa.mp4'))).toBe(true)
    expect(await main(['--gifs', gifsB, '--out', out])).toBe(0)
    expect(existsSync(join(out, 'clips', 'aaa.mp4'))).toBe(false)
    expect(existsSync(join(out, 'clips', 'bbb.mp4'))).toBe(true)
    expect(clipIds(join(out, 'manifest.json'))).toEqual(['bbb'])
  })

  it('keeps the rest of the corpus when a partial --only refresh runs', async () => {
    const gifs = join(workDir, 'partial-only', 'gifs')
    makeClip(gifs, 'aaa')
    makeClip(gifs, 'bbb')
    const out = join(workDir, 'partial-only', 'out')
    expect(await main(['--gifs', gifs, '--out', out])).toBe(0)
    expect(await main(['--gifs', gifs, '--out', out, '--only', 'aaa'])).toBe(0)
    expect(existsSync(join(out, 'clips', 'aaa.mp4'))).toBe(true)
    expect(existsSync(join(out, 'clips', 'bbb.mp4'))).toBe(true)
  })

  it('fails --check after a clip has been removed from the source set', async () => {
    const gifs = join(workDir, 'removed-source', 'gifs')
    makeClip(gifs, 'aaa')
    makeClip(gifs, 'bbb')
    const out = join(workDir, 'removed-source', 'out')
    expect(await main(['--gifs', gifs, '--out', out])).toBe(0)
    rmSync(join(gifs, 'bbb.mp4'))
    expect(await main(['--gifs', gifs, '--out', out, '--check'])).toBe(1)
  })

  it('fails --check limited to one clip when the committed manifest holds more', async () => {
    const gifs = join(workDir, 'subset-check', 'gifs')
    makeClip(gifs, 'aaa')
    makeClip(gifs, 'bbb')
    const out = join(workDir, 'subset-check', 'out')
    expect(await main(['--gifs', gifs, '--out', out])).toBe(0)
    expect(await main(['--gifs', gifs, '--out', out, '--only', 'aaa', '--check'])).toBe(1)
  })

  it('passes a clean --check after an unchanged re-run', async () => {
    const gifs = join(workDir, 'clean-check', 'gifs')
    makeClip(gifs, 'aaa')
    const out = join(workDir, 'clean-check', 'out')
    expect(await main(['--gifs', gifs, '--out', out])).toBe(0)
    expect(await main(['--gifs', gifs, '--out', out])).toBe(0)
    expect(await main(['--gifs', gifs, '--out', out, '--check'])).toBe(0)
  })

  it('reports a corrupt input as a typed failure and leaves no scratch behind', async () => {
    const gifs = join(workDir, 'corrupt-input', 'gifs')
    makeClip(gifs, 'good')
    writeFileSync(join(gifs, 'bad.mp4'), 'definitely not an mp4')
    const out = join(workDir, 'corrupt-input', 'out')
    expect(await main(['--gifs', gifs, '--out', out])).toBe(1)
    expect(existsSync(join(out, '.work'))).toBe(false)
    expect(existsSync(join(out, 'manifest.json'))).toBe(false)
  })

  it('fails --check with no committed manifest and removes what the run wrote', async () => {
    const gifs = join(workDir, 'no-committed', 'gifs')
    makeClip(gifs, 'aaa')
    const out = join(workDir, 'no-committed', 'out')
    expect(await main(['--gifs', gifs, '--out', out, '--check'])).toBe(1)
    expect(existsSync(join(out, '.work'))).toBe(false)
    expect(existsSync(join(out, 'clips', 'aaa.mp4'))).toBe(false)
  })
})
