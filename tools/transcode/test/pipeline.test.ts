import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { grayFrames, hasFfmpeg, probeClip, runEncode, runLosslessReference, ssimOf } from '../src/ffmpeg.js'
import { initialPlan } from '../src/plan.js'
import { main } from '../src/index.js'

const available = hasFfmpeg()
const workDir = mkdtempSync(join(tmpdir(), 'looped-pipeline-'))

afterAll(() => rmSync(workDir, { recursive: true, force: true }))

describe.skipIf(!available)('transcode pipeline', () => {
  const gifs = join(workDir, 'gifs')
  const out = join(workDir, 'assets')

  it('probes a generated fixture', () => {
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
      join(workDir, 'fixture.mp4'),
    ])
    const info = probeClip(join(workDir, 'fixture.mp4'))
    expect(info.width).toBe(160)
    expect(info.height).toBe(120)
    expect(info.fps).toBeCloseTo(10, 3)
    expect(info.frames).toBeGreaterThanOrEqual(5)
  })

  it('encodes at the planned box and scores the result', () => {
    const source = join(workDir, 'fixture.mp4')
    const plan = initialPlan(probeClip(source))
    expect(plan).toMatchObject({ width: 160, height: 120, fps: 10, crf: 26 })
    const encoded = join(workDir, 'encoded.mp4')
    const reference = join(workDir, 'reference.mp4')
    runEncode(plan, source, encoded)
    runLosslessReference(plan, source, reference)
    expect(ssimOf(encoded, reference)).toBeGreaterThan(0.9)
    expect(grayFrames(encoded).length).toBe(32 * 32 * probeClip(encoded).frames)
  })

  it('writes a manifest, a QC report and an assets tree', async () => {
    mkdirSync(gifs, { recursive: true })
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
      join(gifs, 'fixture.mp4'),
    ])
    const code = await main(['--gifs', gifs, '--out', out])
    expect(code).toBe(0)
    const manifest = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8'))
    expect(manifest.clips).toHaveLength(1)
    expect(manifest.clips[0].sources[0].src).toBe('clips/fixture.mp4')
    expect(readFileSync(join(out, 'qc-report.md'), 'utf8')).toContain('Transcode QC report')
  })
})
