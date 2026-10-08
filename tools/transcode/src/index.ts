import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { ffmpegVersion, grayFrames, hasFfmpeg, probeClip, runEncode, runLosslessReference, ssimOf } from './ffmpeg.js'
import { buildManifest, sha256File, type ClipEntry } from './manifest.js'
import { escalate, initialPlan, BUDGET_BYTES, type EncodePlan, type ProbeInfo } from './plan.js'
import { checkClip, seamMetrics, type QcFinding } from './qc.js'

interface Options {
  gifs: string
  out: string
  only: string[]
  check: boolean
}

export function parseArgs(argv: string[]): Options {
  const options: Options = { gifs: 'gifs', out: 'packages/assets', only: [], check: false }
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    if (arg === '--gifs') options.gifs = argv[++index] ?? options.gifs
    else if (arg === '--out') options.out = argv[++index] ?? options.out
    else if (arg === '--only') options.only = (argv[++index] ?? '').split(',').filter(Boolean)
    else if (arg === '--check') options.check = true
    else throw new Error(`unknown argument: ${arg}`)
  }
  return options
}

/** Encodes, then walks the budget ladder until the clip fits or the ladder is spent. */
function encodeToBudget(
  id: string,
  source: string,
  clipsDir: string,
  info: ProbeInfo,
): { plan: EncodePlan; output: string; exhausted: boolean } {
  let plan: EncodePlan = initialPlan(info)
  const output = join(clipsDir, `${id}.mp4`)
  let exhausted = false
  for (;;) {
    runEncode(plan, source, output)
    if (readFileSync(output).length <= BUDGET_BYTES) break
    const next = escalate(plan, info)
    if (!next) {
      exhausted = true
      plan = { ...plan, note: 'budget-exceeded' }
      break
    }
    plan = next
  }
  return { plan, output, exhausted }
}

export async function main(argv: string[]): Promise<number> {
  if (!hasFfmpeg()) {
    console.error('ffmpeg is required and was not found in PATH')
    return 2
  }
  const options = parseArgs(argv)
  const gifsDir = resolve(options.gifs)
  const outDir = resolve(options.out)
  const clipsDir = join(outDir, 'clips')
  const workDir = join(outDir, '.work')
  mkdirSync(clipsDir, { recursive: true })
  mkdirSync(workDir, { recursive: true })

  const generators = readdirSync(gifsDir).filter((name) => name.endsWith('.mp4'))
  const selected = options.only.length > 0 ? generators.filter((name) => options.only.includes(basename(name, '.mp4'))) : generators

  const entries: ClipEntry[] = []
  const seams = new Map<string, ReturnType<typeof seamMetrics>>()
  const findings: QcFinding[] = []
  const notes: string[] = []

  for (const name of selected.sort()) {
    const id = basename(name, '.mp4')
    const source = join(gifsDir, name)
    const info = probeClip(source)
    const { plan, output, exhausted } = encodeToBudget(id, source, clipsDir, info)

    const reference = join(workDir, `${id}.ref.mp4`)
    runLosslessReference(plan, source, reference)
    const encodedInfo = probeClip(output)
    const ssim = ssimOf(output, reference)
    const seamInput = seamMetrics(grayFrames(source), 32 * 32)
    const seamOutput = seamMetrics(grayFrames(output), 32 * 32)
    const expectedFrames = Math.round((info.durationMs / 1000) * plan.fps)

    const clipFindings = checkClip({
      id,
      expectedFrames,
      actualFrames: encodedInfo.frames,
      expectedDurationMs: info.durationMs,
      actualDurationMs: encodedInfo.durationMs,
      bytes: readFileSync(output).length,
      budgetBytes: BUDGET_BYTES,
      budgetExhausted: exhausted,
      ssim,
      seamInput,
      seamOutput,
    })
    findings.push(...clipFindings)
    seams.set(id, seamOutput)
    if (plan.note !== 'base') notes.push(`${id}: ${plan.note} (crf ${plan.crf}, long side ${plan.longSide})`)

    entries.push({
      id,
      sourcePath: source,
      outputPath: output,
      plan,
      width: plan.width,
      height: plan.height,
      durationMs: info.durationMs,
      fps: plan.fps,
      frames: encodedInfo.frames,
      bytes: readFileSync(output).length,
    })
  }

  const generatedBy = `looped-loader-tools/0.1.0 ffmpeg ${ffmpegVersion()}`
  const manifest = buildManifest(entries, generatedBy, seams)
  const manifestPath = join(outDir, 'manifest.json')
  const checksumsPath = join(outDir, 'checksums.json')

  if (options.check) {
    const previous = JSON.parse(readFileSync(manifestPath, 'utf8')) as typeof manifest
    const differences = manifest.clips.filter((clip, index) => {
      const before = previous.clips[index]
      return !before || before.sha256.mp4 !== clip.sha256.mp4 || before.bytes.mp4 !== clip.bytes.mp4
    })
    writeFileSync(checksumsPath, `${JSON.stringify(entries.map((entry) => ({ path: `clips/${entry.id}.mp4`, sha256: sha256File(entry.outputPath) })), null, 2)}\n`)
    rmSync(workDir, { recursive: true, force: true })
    if (differences.length > 0) {
      console.error(`--check failed: ${differences.length} clip(s) differ from the committed manifest`)
      return 1
    }
    console.log(`--check passed: ${manifest.clips.length} clips are byte-identical`)
    return 0
  }

  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  writeFileSync(checksumsPath, `${JSON.stringify(entries.map((entry) => ({ path: `clips/${entry.id}.mp4`, sha256: sha256File(entry.outputPath) })), null, 2)}\n`)
  writeFileSync(join(outDir, 'qc-report.json'), `${JSON.stringify({ findings, notes, totalBytes: manifest.corpus.totalBytes }, null, 2)}\n`)

  const errors = findings.filter((finding) => finding.level === 'error')
  const reviews = findings.filter((finding) => finding.level === 'review')
  const lines = [
    '# Transcode QC report',
    '',
    `Clips: ${entries.length}  Total: ${(manifest.corpus.totalBytes / 1024 / 1024).toFixed(2)} MB`,
    '',
    '## Errors',
    ...(errors.length === 0 ? ['none'] : errors.map((finding) => `- ${finding.id}: ${finding.code} — ${finding.message}`)),
    '',
    '## Review',
    ...(reviews.length === 0 ? ['none'] : reviews.map((finding) => `- ${finding.id}: ${finding.code} — ${finding.message}`)),
    '',
    '## Budget adaptations',
    ...(notes.length === 0 ? ['none'] : notes.map((note) => `- ${note}`)),
    '',
  ]
  writeFileSync(join(outDir, 'qc-report.md'), lines.join('\n'))
  rmSync(workDir, { recursive: true, force: true })

  console.log(`wrote ${entries.length} clips, ${(manifest.corpus.totalBytes / 1024 / 1024).toFixed(2)} MB, ${errors.length} error(s), ${reviews.length} review(s)`)
  return errors.length > 0 ? 1 : 0
}

const invokedDirectly = process.argv[1]?.endsWith('index.js') ?? false
if (invokedDirectly) {
  main(process.argv.slice(2)).then((code) => process.exit(code))
}
