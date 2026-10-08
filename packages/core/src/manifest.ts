import { LoopedLoaderError } from './errors.js'
import type { Clip, ClipSource, Manifest } from './pool.js'

const ABSOLUTE_URL = /^https?:\/\//i

const invalid = (message: string): LoopedLoaderError =>
  new LoopedLoaderError('manifest-invalid', message)

export function resolveSrc(baseUrl: string, src: string): string {
  if (ABSOLUTE_URL.test(src)) return src
  const base = baseUrl.trim().replace(/\/+$/, '')
  if (base === '') {
    throw new LoopedLoaderError('manifest-fetch', 'baseUrl is required and must be a non-empty string')
  }
  return `${base}/${src.replace(/^\/+/, '')}`
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

function parseSource(value: unknown, clipId: string, index: number): ClipSource {
  if (typeof value !== 'object' || value === null) throw invalid(`clip "${clipId}" source ${index} is not an object`)
  const source = value as Record<string, unknown>
  if (typeof source.src !== 'string' || source.src === '') throw invalid(`clip "${clipId}" source ${index} has no src`)
  if (typeof source.type !== 'string' || source.type === '') throw invalid(`clip "${clipId}" source ${index} has no type`)
  return { src: source.src as string, type: source.type as string }
}

function parseClip(value: unknown): Clip {
  if (typeof value !== 'object' || value === null) throw invalid('a clip entry is not an object')
  const raw = value as Record<string, unknown>
  const id = raw.id
  if (typeof id !== 'string' || id === '') throw invalid('a clip entry has no id')
  if (!Array.isArray(raw.sources) || raw.sources.length === 0) throw invalid(`clip "${id}" has no sources`)
  if (!isFiniteNumber(raw.width) || raw.width <= 0) throw invalid(`clip "${id}" has an invalid width`)
  if (!isFiniteNumber(raw.height) || raw.height <= 0) throw invalid(`clip "${id}" has an invalid height`)
  if (!isFiniteNumber(raw.durationMs) || raw.durationMs < 0) throw invalid(`clip "${id}" has an invalid durationMs`)
  if (!isFiniteNumber(raw.fps) || raw.fps <= 0) throw invalid(`clip "${id}" has an invalid fps`)

  const clip: Clip = {
    id,
    sources: (raw.sources as unknown[]).map((source, index) => parseSource(source, id, index)),
    width: raw.width,
    height: raw.height,
    durationMs: raw.durationMs,
    fps: raw.fps,
  }
  if (isRecordOfNumbers(raw.bytes)) clip.bytes = raw.bytes
  if (isRecordOfStrings(raw.sha256)) clip.sha256 = raw.sha256
  if (typeof raw.sourceSha256 === 'string') clip.sourceSha256 = raw.sourceSha256
  if (raw.encode && typeof raw.encode === 'object') clip.encode = raw.encode as NonNullable<Clip['encode']>
  if (raw.loopSeam && typeof raw.loopSeam === 'object') clip.loopSeam = raw.loopSeam as NonNullable<Clip['loopSeam']>
  return clip
}

function isRecordOfNumbers(value: unknown): value is Record<string, number> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.values(value as Record<string, unknown>).every((entry) => isFiniteNumber(entry))
  )
}

function isRecordOfStrings(value: unknown): value is Record<string, string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.values(value as Record<string, unknown>).every((entry) => typeof entry === 'string')
  )
}

/**
 * Validates the parts the runtime depends on and ignores everything else.
 * Unknown fields are how the manifest schema grows without a breaking change.
 */
export function parseManifest(input: unknown): Manifest {
  if (typeof input !== 'object' || input === null) throw invalid('manifest is not an object')
  const raw = input as Record<string, unknown>
  if (!Array.isArray(raw.clips)) throw invalid('manifest.clips must be an array')
  const clips = (raw.clips as unknown[]).map(parseClip)
  if (clips.length === 0) throw invalid('manifest.clips is empty')

  const manifest: Manifest = {
    schemaVersion: isFiniteNumber(raw.schemaVersion) ? raw.schemaVersion : 1,
    clips,
  }
  if (typeof raw.generatedBy === 'string') manifest.generatedBy = raw.generatedBy
  if (raw.corpus && typeof raw.corpus === 'object') manifest.corpus = raw.corpus as NonNullable<Manifest['corpus']>
  return manifest
}

export function buildPool(manifest: Manifest, options: { clip?: string; clips?: string[] } = {}): Clip[] {
  const { clip, clips } = options
  const byId = new Map(manifest.clips.map((entry) => [entry.id, entry]))

  if (clip !== undefined && clip !== '') {
    const found = byId.get(clip)
    if (!found) throw invalid(`clip "${clip}" is not in the manifest`)
    return [found]
  }

  if (clips !== undefined && clips.length > 0) {
    const picked = clips
      .map((id) => byId.get(id))
      .filter((entry): entry is Clip => entry !== undefined)
    if (picked.length === 0) {
      throw new LoopedLoaderError('no-clips', 'none of the requested clip ids exist in the manifest')
    }
    return picked
  }

  return [...manifest.clips]
}
