export interface SeamMetrics {
  stepMean: number
  stepP90: number
  seam: number
}

export interface QcInput {
  id: string
  expectedFrames: number
  actualFrames: number
  expectedDurationMs: number
  actualDurationMs: number
  bytes: number
  budgetBytes: number
  /** True when the CRF and long-side ladder is spent, so weight can no longer be reduced. */
  budgetExhausted: boolean
  ssim: number
  seamInput: SeamMetrics
  seamOutput: SeamMetrics
}

export interface QcFinding {
  id: string
  level: 'error' | 'review'
  code: string
  message: string
}

export const SSIM_FLOOR = 0.93
export const SEAM_REGRESSION = 1.1
/** Below this absolute MAE the 10 % rule measures encoder noise, not a visible loop jump. */
export const SEAM_NOISE_FLOOR = 2

function mae(frames: Uint8Array, aOffset: number, bOffset: number, frameSize: number): number {
  let sum = 0
  for (let i = 0; i < frameSize; i++) {
    sum += Math.abs((frames[aOffset + i] ?? 0) - (frames[bOffset + i] ?? 0))
  }
  return sum / frameSize
}

export function seamMetrics(frames: Uint8Array, frameSize: number): SeamMetrics {
  const frameCount = Math.floor(frames.length / frameSize)
  if (frameCount < 2) throw new RangeError(`seamMetrics: need at least 2 frames, got ${frameCount}`)

  const steps: number[] = []
  for (let index = 0; index < frameCount - 1; index++) {
    steps.push(mae(frames, index * frameSize, (index + 1) * frameSize, frameSize))
  }
  const seam = mae(frames, (frameCount - 1) * frameSize, 0, frameSize)
  const sorted = [...steps].sort((a, b) => a - b)
  const p90 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))] ?? 0
  const stepMean = steps.reduce((total, value) => total + value, 0) / steps.length
  return { stepMean, stepP90: p90, seam }
}

export function checkClip(input: QcInput): QcFinding[] {
  const findings: QcFinding[] = []
  const add = (level: QcFinding['level'], code: string, message: string): void => {
    findings.push({ id: input.id, level, code, message })
  }

  if (Math.abs(input.actualFrames - input.expectedFrames) > 1) {
    add('error', 'frame-count', `expected ${input.expectedFrames} frames, got ${input.actualFrames}`)
  }
  if (Math.abs(input.actualDurationMs - input.expectedDurationMs) >= 100) {
    add('error', 'duration', `expected ${input.expectedDurationMs} ms, got ${input.actualDurationMs} ms`)
  }
  if (input.ssim < SSIM_FLOOR) {
    add('error', 'ssim', `SSIM ${input.ssim.toFixed(4)} is below the ${SSIM_FLOOR} floor`)
  }
  if (input.seamOutput.seam > input.seamInput.seam * SEAM_REGRESSION && input.seamInput.seam > 0.5) {
    if (input.seamInput.seam >= SEAM_NOISE_FLOOR) {
      add(
        'error',
        'seam-regression',
        `seam grew from ${input.seamInput.seam.toFixed(2)} to ${input.seamOutput.seam.toFixed(2)}`,
      )
    } else {
      add(
        'review',
        'seam-regression-noise',
        `seam grew from ${input.seamInput.seam.toFixed(2)} to ${input.seamOutput.seam.toFixed(2)}, below the ${SEAM_NOISE_FLOOR.toFixed(1)} noise floor — recorded, not a failure`,
      )
    }
  }
  if (input.seamOutput.seam > input.seamOutput.stepP90) {
    add(
      'review',
      'loop-seam-review',
      `seam ${input.seamOutput.seam.toFixed(2)} exceeds the p90 step ${input.seamOutput.stepP90.toFixed(2)}`,
    )
  }
  if (input.bytes > input.budgetBytes) {
    const kib = (value: number): string => `${Math.round(value / 1024)} KB`
    if (input.budgetExhausted) {
      add(
        'review',
        'budget-exceeded',
        `${kib(input.bytes)} is over the ${kib(input.budgetBytes)} budget and the ladder is spent`,
      )
    } else {
      add(
        'error',
        'budget',
        `${kib(input.bytes)} is over the ${kib(input.budgetBytes)} budget while escalation is still possible`,
      )
    }
  }
  return findings
}
