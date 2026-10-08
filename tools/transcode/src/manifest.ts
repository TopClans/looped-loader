import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import type { EncodePlan } from './plan.js'
import type { SeamMetrics } from './qc.js'

export interface ClipEntry {
  id: string
  sourcePath: string
  outputPath: string
  plan: EncodePlan
  width: number
  height: number
  durationMs: number
  fps: number
  frames: number
  bytes: number
}

export function sha256File(file: string): string {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

export function buildManifest(entries: ClipEntry[], generatedBy: string, seams: Map<string, SeamMetrics>) {
  return {
    schemaVersion: 1,
    generatedBy,
    corpus: {
      clips: entries.length,
      totalBytes: entries.reduce((total, entry) => total + statSync(entry.outputPath).size, 0),
    },
    clips: entries.map((entry) => {
      const seam = seams.get(entry.id)
      return {
        id: entry.id,
        sources: [{ src: `clips/${entry.id}.mp4`, type: 'video/mp4; codecs=avc1.4d401e' }],
        width: entry.width,
        height: entry.height,
        durationMs: entry.durationMs,
        fps: entry.fps,
        bytes: { mp4: entry.bytes },
        sha256: { mp4: sha256File(entry.outputPath) },
        sourceSha256: sha256File(entry.sourcePath),
        encode: {
          codec: 'x264',
          crf: entry.plan.crf,
          longSide: entry.plan.longSide,
          fpsCap: entry.plan.fps,
          note: entry.plan.note,
        },
        ...(seam ? { loopSeam: { ...seam, ...(seam.seam > seam.stepP90 ? { flag: 'review' } : {}) } } : {}),
      }
    }),
  }
}
