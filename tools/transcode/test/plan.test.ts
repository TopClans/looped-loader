import { describe, expect, it } from 'vitest'
import {
  BASE_CRF,
  BUDGET_BYTES,
  encodeArgs,
  escalate,
  initialPlan,
  targetBox,
  type EncodePlan,
  type ProbeInfo,
} from '../src/plan.js'

const probe = (width: number, height: number, fps = 30, extra: Partial<ProbeInfo> = {}): ProbeInfo => ({
  width,
  height,
  fps,
  frames: Math.round(fps * 2),
  durationMs: 2000,
  bytes: 100_000,
  ...extra,
})

describe('targetBox', () => {
  it.each([
    ['leaves a small clip alone', 240, 168, 240, 168],
    ['portrait 1080x1440', 1080, 1440, 360, 480],
    ['portrait 640x800', 640, 800, 384, 480],
    ['portrait 576x720', 576, 720, 384, 480],
    ['square 1080x1080', 1080, 1080, 480, 480],
    ['landscape 640x360', 640, 360, 480, 270],
    ['odd 501x333 stays even', 501, 333, 480, 320],
    ['already 480 long side', 310, 422, 310, 422],
  ])('%s', (_label, width, height, expectedWidth, expectedHeight) => {
    expect(targetBox(width, height)).toEqual({ width: expectedWidth, height: expectedHeight })
  })

  it('honours an explicit long side and still never upscales', () => {
    expect(targetBox(1080, 1440, 400)).toEqual({ width: 300, height: 400 })
    expect(targetBox(240, 168, 400)).toEqual({ width: 240, height: 168 })
  })

  it('rejects nonsense dimensions instead of emitting odd numbers', () => {
    expect(() => targetBox(0, 100)).toThrow(RangeError)
    expect(() => targetBox(100, -1)).toThrow(RangeError)
  })
})

describe('initialPlan', () => {
  it('caps the frame rate at 30 and keeps a slower source rate', () => {
    expect(initialPlan(probe(1080, 1440, 39.5)).fps).toBe(30)
    expect(initialPlan(probe(1080, 1080, 10)).fps).toBe(10)
    expect(initialPlan(probe(800, 600, 24.166666)).fps).toBe(24.167)
  })

  it('starts at the base CRF with the base long side', () => {
    const plan = initialPlan(probe(640, 800, 30))
    expect(plan).toMatchObject({ crf: BASE_CRF, longSide: 480, note: 'base', width: 384, height: 480 })
  })
})

describe('escalate', () => {
  const info = probe(1080, 1440, 30)

  it('walks CRF from the base to the maximum, one step at a time', () => {
    let plan: EncodePlan | null = initialPlan(info)
    const crfs: number[] = []
    while (plan && plan.crf <= 30 && plan.longSide === 480) {
      crfs.push(plan.crf)
      plan = escalate(plan, info)
      if (plan && plan.crf === 30 && crfs.includes(30)) break
    }
    expect(crfs).toEqual([26, 27, 28, 29, 30])
  })

  it('drops the long side to 400 once CRF is exhausted, recomputing the box', () => {
    const atMax: EncodePlan = { width: 360, height: 480, fps: 30, crf: 30, longSide: 480, note: 'budget-adapted' }
    expect(escalate(atMax, info)).toEqual({
      width: 300,
      height: 400,
      fps: 30,
      crf: 30,
      longSide: 400,
      note: 'budget-adapted',
    })
  })

  it('gives up instead of looping forever', () => {
    const spent: EncodePlan = { width: 300, height: 400, fps: 30, crf: 30, longSide: 400, note: 'budget-adapted' }
    expect(escalate(spent, info)).toBeNull()
  })
})

describe('encodeArgs', () => {
  const args = encodeArgs(initialPlan(probe(640, 800, 30)), 'in.mp4', 'out.mp4')

  it('carries every setting the spec fixes', () => {
    for (const required of [
      'scale=384:480,fps=30',
      'libx264',
      '-preset',
      'slow',
      '-profile:v',
      'main',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      '-an',
      '-map_metadata',
      '-1',
      '-threads',
      '1',
    ]) {
      expect(args).toContain(required)
    }
    expect(args.at(-1)).toBe('out.mp4')
  })

  it('uses the planned CRF', () => {
    expect(args[args.indexOf('-crf') + 1]).toBe(String(BASE_CRF))
  })

  it('keeps the budget constant at 250 KB', () => {
    expect(BUDGET_BYTES).toBe(256_000)
  })
})
