export interface ProbeInfo {
  width: number
  height: number
  fps: number
  frames: number
  durationMs: number
  bytes: number
}

export interface EncodePlan {
  width: number
  height: number
  fps: number
  crf: number
  longSide: number
  note: 'base' | 'budget-adapted' | 'budget-exceeded'
}

export const LONG_SIDE = 480
export const FALLBACK_LONG_SIDE = 400
export const FPS_CAP = 30
export const BASE_CRF = 26
export const MAX_CRF = 30
export const BUDGET_BYTES = 250 * 1024

const round3 = (value: number): number => Math.round(value * 1000) / 1000
const even = (value: number): number => Math.max(2, Math.round(value / 2) * 2)

export function targetBox(
  width: number,
  height: number,
  longSide: number = LONG_SIDE,
): { width: number; height: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new RangeError(`targetBox: bad dimensions ${width}x${height}`)
  }
  if (!Number.isFinite(longSide) || longSide <= 0) throw new RangeError(`targetBox: bad long side ${longSide}`)
  const factor = Math.min(1, longSide / Math.max(width, height))
  return { width: even(width * factor), height: even(height * factor) }
}

export function initialPlan(info: ProbeInfo): EncodePlan {
  return {
    ...targetBox(info.width, info.height),
    fps: Math.min(round3(info.fps), FPS_CAP),
    crf: BASE_CRF,
    longSide: LONG_SIDE,
    note: 'base',
  }
}

/** Next rung of the budget ladder, or null when the ladder is spent. */
export function escalate(plan: EncodePlan, info: ProbeInfo): EncodePlan | null {
  if (plan.crf < MAX_CRF) return { ...plan, crf: plan.crf + 1, note: 'budget-adapted' }
  if (plan.longSide > FALLBACK_LONG_SIDE) {
    return {
      ...plan,
      ...targetBox(info.width, info.height, FALLBACK_LONG_SIDE),
      longSide: FALLBACK_LONG_SIDE,
      note: 'budget-adapted',
    }
  }
  return null
}

export function encodeArgs(plan: EncodePlan, input: string, output: string): string[] {
  return [
    '-v',
    'error',
    '-y',
    '-i',
    input,
    '-vf',
    `scale=${plan.width}:${plan.height},fps=${plan.fps}`,
    '-c:v',
    'libx264',
    '-crf',
    String(plan.crf),
    '-preset',
    'slow',
    '-profile:v',
    'main',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    '-threads',
    '1',
    '-an',
    '-map_metadata',
    '-1',
    output,
  ]
}
