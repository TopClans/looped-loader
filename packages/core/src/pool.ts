import { LoopedLoaderError } from './errors.js'
import { seededIndex } from './prng.js'

export interface ClipSource {
  src: string
  type: string
}

export interface LoopSeam {
  stepMean: number
  stepP90: number
  seam: number
  flag?: 'review'
}

export interface EncodeInfo {
  codec: string
  crf: number
  longSide: number
  fpsCap: number
  note: 'base' | 'budget-adapted' | 'budget-exceeded'
}

export interface Clip {
  id: string
  sources: ClipSource[]
  width: number
  height: number
  durationMs: number
  fps: number
  bytes?: Record<string, number>
  sha256?: Record<string, string>
  sourceSha256?: string
  encode?: EncodeInfo
  loopSeam?: LoopSeam
}

export interface Manifest {
  schemaVersion: number
  generatedBy?: string
  corpus?: { clips: number; totalBytes: number }
  clips: Clip[]
}

const RECENT_LIMIT = 3
let recent: string[] = []

/** Test seam: the "do not repeat" ring is module-level and shared by all instances. */
export function resetRecent(): void {
  recent = []
}

const take = (pool: Clip[], index: number): Clip => {
  const clip = pool[index]
  if (!clip) throw new LoopedLoaderError('no-clips', `index ${index} is outside a pool of ${pool.length}`)
  return clip
}

export function pickClip(pool: Clip[], seed?: string | number): Clip {
  if (pool.length === 0) throw new LoopedLoaderError('no-clips', 'clip pool is empty')

  if (seed !== undefined && seed !== null && seed !== '') {
    return take(pool, seededIndex(seed, pool.length))
  }

  const fresh = pool.length > RECENT_LIMIT ? pool.filter((candidate) => !recent.includes(candidate.id)) : pool
  const from = fresh.length > 0 ? fresh : pool
  const clip = take(from, Math.floor(Math.random() * from.length))
  recent.push(clip.id)
  if (recent.length > RECENT_LIMIT) recent.shift()
  return clip
}
