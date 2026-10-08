import { spawnSync } from 'node:child_process'
import { closeSync, openSync, readFileSync, statSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { encodeArgs, type EncodePlan, type ProbeInfo } from './plan.js'

export class FfmpegError extends Error {}

export function hasFfmpeg(): boolean {
  const result = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' })
  return !result.error && result.status === 0
}

/** The version string recorded in the manifest, so a rebuild can be explained. */
export function ffmpegVersion(): string {
  const result = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' })
  return /ffmpeg version (\S+)/.exec(result.stdout ?? '')?.[1] ?? 'unknown'
}

interface ProbeStream {
  width?: number
  height?: number
  avg_frame_rate?: string
  nb_frames?: string
}
interface ProbeJson {
  streams?: ProbeStream[]
  format?: { duration?: string }
}

function parseFps(rate: string | undefined): number {
  if (!rate) return 25
  const [num, den] = rate.split('/')
  const numerator = Number(num)
  const denominator = Number(den ?? 1)
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return 25
  return numerator / denominator
}

export function parseProbe(json: ProbeJson, bytes: number): ProbeInfo {
  const video = (json.streams ?? []).find((stream) => (stream.width ?? 0) > 0)
  if (!video?.width || !video.height) throw new FfmpegError('ffprobe reported no video stream')
  const fps = parseFps(video.avg_frame_rate)
  const durationMs = Math.round(Number(json.format?.duration ?? 0) * 1000)
  const declared = Number(video.nb_frames)
  const frames = Number.isFinite(declared) && declared > 0 ? declared : Math.max(1, Math.round((durationMs / 1000) * fps))
  return { width: video.width, height: video.height, fps, frames, durationMs, bytes }
}

/** Runs ffprobe and returns parsed info. Falls back to a temp file if stdout cannot be piped. */
export function probeClip(file: string): ProbeInfo {
  const args = [
    '-v', 'error',
    '-show_entries', 'stream=width,height,avg_frame_rate,nb_frames',
    '-show_entries', 'format=duration',
    '-of', 'json',
    file,
  ]
  const result = spawnSync('ffprobe', args, { encoding: 'utf8' })

  if (result.error) {
    // The harness's confined shells can refuse piped stdio; a file descriptor avoids it.
    const tempFile = join(tmpdir(), `looped-probe-${process.pid}-${Math.random().toString(36).slice(2)}.json`)
    const fd = openSync(tempFile, 'w')
    const retry = spawnSync('ffprobe', args, { stdio: ['ignore', fd, 'inherit'] })
    closeSync(fd)
    try {
      if (retry.status !== 0) throw new FfmpegError(`ffprobe failed for ${file}`)
      return parseProbe(JSON.parse(readFileSync(tempFile, 'utf8')) as ProbeJson, statSync(file).size)
    } finally {
      unlinkSync(tempFile)
    }
  }

  if (result.status !== 0) throw new FfmpegError(`ffprobe failed for ${file}: ${result.stderr}`)
  return parseProbe(JSON.parse(result.stdout) as ProbeJson, statSync(file).size)
}

export function runFfmpeg(args: string[]): void {
  const result = spawnSync('ffmpeg', args, { encoding: 'utf8' })
  if (result.error) throw new FfmpegError(`could not run ffmpeg: ${result.error.message}`)
  if (result.status !== 0) throw new FfmpegError(`ffmpeg exited with ${result.status}: ${result.stderr}`)
}

export function runEncode(plan: EncodePlan, input: string, output: string): void {
  runFfmpeg(encodeArgs(plan, input, output))
}

/** Lossless reference at the plan's box and frame rate, for SSIM comparison. */
export function runLosslessReference(plan: EncodePlan, input: string, output: string): void {
  runFfmpeg([
    '-v', 'error',
    '-y',
    '-i', input,
    '-vf', `scale=${plan.width}:${plan.height},fps=${plan.fps}`,
    '-c:v', 'libx264',
    '-qp', '0',
    '-preset', 'ultrafast',
    '-threads', '1',
    '-an',
    output,
  ])
}

/** FFmpeg reports SSIM on stderr; the "All:" figure is the average over all planes. */
export function ssimOf(encoded: string, reference: string): number {
  const result = spawnSync('ffmpeg', ['-v', 'info', '-y', '-i', encoded, '-i', reference, '-lavfi', 'ssim', '-f', 'null', '-'], {
    encoding: 'utf8',
  })
  const match = /All:([0-9.]+|inf)/.exec(`${result.stderr ?? ''}`)
  if (!match?.[1]) throw new FfmpegError(`could not read SSIM for ${encoded}`)
  return match[1] === 'inf' ? 1 : Number(match[1])
}

/** Every frame as a 32x32 grayscale plane, concatenated, for the loop-seam metric. */
export function grayFrames(file: string, size = 32): Uint8Array {
  const tempFile = join(tmpdir(), `looped-gray-${process.pid}-${Math.random().toString(36).slice(2)}.raw`)
  const fd = openSync(tempFile, 'w')
  const result = spawnSync(
    'ffmpeg',
    ['-v', 'error', '-y', '-i', file, '-vf', `scale=${size}:${size},format=gray`, '-f', 'rawvideo', '-'],
    { stdio: ['ignore', fd, 'inherit'] },
  )
  closeSync(fd)
  try {
    if (result.status !== 0) throw new FfmpegError(`could not dump frames for ${file}`)
    return new Uint8Array(readFileSync(tempFile))
  } finally {
    unlinkSync(tempFile)
  }
}
