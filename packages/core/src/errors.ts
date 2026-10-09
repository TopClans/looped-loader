export type ErrorCode =
  'manifest-fetch' | 'manifest-invalid' | 'clip-fetch' | 'decode' | 'autoplay-blocked' | 'no-clips'

export class LoopedLoaderError extends Error {
  readonly code: ErrorCode
  override readonly cause?: unknown

  constructor(code: ErrorCode, message: string, cause?: unknown) {
    super(`[looped-loader:${code}] ${message}`)
    this.name = 'LoopedLoaderError'
    this.code = code
    this.cause = cause
  }
}

export function isLoopedLoaderError(value: unknown): value is LoopedLoaderError {
  return value instanceof LoopedLoaderError
}
