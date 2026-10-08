import { describe, expect, it } from 'vitest'
import { checkClip, seamMetrics, type QcInput } from '../src/qc.js'

/** Builds N frames of 2x2 pixels; each frame is a flat gray level. */
const flatFrames = (levels: number[]): Uint8Array => {
  const frameSize = 4
  const out = new Uint8Array(frameSize * levels.length)
  levels.forEach((level, index) => out.fill(level, index * frameSize, (index + 1) * frameSize))
  return out
}

describe('seamMetrics', () => {
  it('measures an identical first and last frame as a perfect loop', () => {
    const metrics = seamMetrics(flatFrames([0, 10, 20, 10, 0]), 4)
    expect(metrics.seam).toBe(0)
    expect(metrics.stepMean).toBeCloseTo(10, 5)
  })

  it('separates a jump at the seam from ordinary motion', () => {
    const smooth = seamMetrics(flatFrames([0, 10, 20, 30, 40]), 4)
    const jumped = seamMetrics(flatFrames([0, 10, 20, 30, 250]), 4)
    expect(jumped.seam).toBeGreaterThan(smooth.seam * 5)
    expect(jumped.seam).toBeGreaterThan(jumped.stepP90)
  })

  it('refuses a single frame instead of dividing by zero', () => {
    expect(() => seamMetrics(flatFrames([0]), 4)).toThrow(RangeError)
  })
})

const base: QcInput = {
  id: 'a',
  expectedFrames: 100,
  actualFrames: 100,
  expectedDurationMs: 4000,
  actualDurationMs: 4000,
  bytes: 100_000,
  budgetBytes: 256_000,
  budgetExhausted: false,
  ssim: 0.97,
  seamInput: { stepMean: 12, stepP90: 20, seam: 18 },
  seamOutput: { stepMean: 12, stepP90: 20, seam: 18 },
}

describe('checkClip', () => {
  it('passes a clean clip', () => {
    expect(checkClip(base)).toEqual([])
  })

  it('allows a one-frame drift', () => {
    expect(checkClip({ ...base, actualFrames: 99 })).toEqual([])
    expect(checkClip({ ...base, actualFrames: 101 })).toEqual([])
  })

  it('fails a two-frame drift', () => {
    expect(checkClip({ ...base, actualFrames: 98 })[0]).toMatchObject({ code: 'frame-count', level: 'error' })
  })

  it('fails a duration that wandered past one frame', () => {
    expect(checkClip({ ...base, actualDurationMs: 4100 })[0]).toMatchObject({ code: 'duration', level: 'error' })
  })

  it('fails quality below the SSIM floor', () => {
    expect(checkClip({ ...base, ssim: 0.92 })[0]).toMatchObject({ code: 'ssim', level: 'error' })
  })

  it('fails a seam regression worse than 10 percent', () => {
    const findings = checkClip({ ...base, seamOutput: { ...base.seamOutput, seam: 19.9 } })
    expect(findings[0]).toMatchObject({ code: 'seam-regression', level: 'error' })
  })

  it('tolerates a seam within 10 percent', () => {
    expect(checkClip({ ...base, seamOutput: { ...base.seamOutput, seam: 19.7 } })).toEqual([])
  })

  it('flags a visible loop jump for human review without failing the build', () => {
    const findings = checkClip({
      ...base,
      seamInput: { stepMean: 5, stepP90: 8, seam: 9 },
      seamOutput: { stepMean: 5, stepP90: 8, seam: 30 },
    })
    expect(findings).toContainEqual(expect.objectContaining({ code: 'loop-seam-review', level: 'review' }))
  })

  it('reports an over-budget clip as an error while the ladder still has rungs', () => {
    expect(checkClip({ ...base, bytes: 300_000 })[0]).toMatchObject({ code: 'budget', level: 'error' })
  })

  it('downgrades an over-budget clip to review once the ladder is spent', () => {
    expect(checkClip({ ...base, bytes: 300_000, budgetExhausted: true })[0]).toMatchObject({
      code: 'budget-exceeded',
      level: 'review',
    })
  })
})
