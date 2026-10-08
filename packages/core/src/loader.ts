import { LoopedLoaderError, isLoopedLoaderError, type ErrorCode } from './errors.js'
import { buildPool, parseManifest, resolveSrc } from './manifest.js'
import { pickClip, type Clip, type Manifest } from './pool.js'

export type State = 'idle' | 'resolving' | 'loading' | 'playing' | 'error'

/** The DOM surface the core actually uses, so tests need no jsdom. */
export interface VideoLike {
  src: string
  muted: boolean
  /** Present on a real HTMLMediaElement; `code === 3` is MEDIA_ERR_DECODE. */
  error?: { code?: number } | null
  pause(): void
  play(): Promise<void> | void
  load?(): void
  removeAttribute(name: string): void
  addEventListener(type: string, listener: () => void): void
  removeEventListener(type: string, listener: () => void): void
}

export interface LoopedLoaderOptions {
  baseUrl: string
  manifest?: unknown
  manifestUrl?: string
  seed?: string | number
  clip?: string
  clips?: string[]
  delayMs?: number
  respectReducedMotion?: boolean
  onState?: (state: State) => void
  onError?: (error: LoopedLoaderError) => void
  onSelect?: (clip: Clip) => void
}

export interface LoopedLoader {
  readonly state: State
  readonly clip: Clip | null
  readonly src: string | null
  readonly error: LoopedLoaderError | null
  start(): void
  attach(video: VideoLike): void
  observeRoot(root: Element): void
  destroy(): void
}

const DEFAULT_DELAY_MS = 120
const MAX_ATTEMPTS = 3

export function prefersReducedMotion(): boolean {
  if (typeof globalThis.matchMedia !== 'function') return false
  return globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function createLoopedLoader(options: LoopedLoaderOptions): LoopedLoader {
  const baseUrl = (options.baseUrl ?? '').trim()
  const delayMs = options.delayMs ?? DEFAULT_DELAY_MS
  const respectReducedMotion = options.respectReducedMotion ?? true

  let state: State = 'idle'
  let clip: Clip | null = null
  let src: string | null = null
  let error: LoopedLoaderError | null = null
  let pool: Clip[] = []
  let attempts = 0
  let video: VideoLike | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let abort: AbortController | null = null
  let destroyed = false
  let started = false
  let resolving = false
  let visibilityBound = false
  let interactionRetryUsed = false
  let observed: Element | null = null
  let observer: IntersectionObserver | null = null
  const failed = new Set<string>()

  const setState = (next: State): void => {
    if (state === next) return
    state = next
    options.onState?.(next)
  }

  const emitError = (failure: LoopedLoaderError): void => {
    error = failure
    options.onError?.(failure)
  }

  const fail = (failure: LoopedLoaderError): void => {
    emitError(failure)
    setState('error')
  }

  const asLoaderError = (value: unknown, fallback: ErrorCode, message: string): LoopedLoaderError =>
    isLoopedLoaderError(value) ? value : new LoopedLoaderError(fallback, message, value)

  const manifestUrl = (): string => {
    if (options.manifestUrl) return options.manifestUrl
    if (baseUrl === '') {
      throw new LoopedLoaderError('manifest-fetch', 'baseUrl is required and must be a non-empty string')
    }
    return `${baseUrl.replace(/\/+$/, '')}/manifest.json`
  }

  async function loadManifest(): Promise<Manifest> {
    if (options.manifest !== undefined && options.manifest !== null) return parseManifest(options.manifest)

    const url = manifestUrl()
    abort = new AbortController()
    let response: Response
    try {
      response = await fetch(url, { signal: abort.signal })
    } catch (cause) {
      throw new LoopedLoaderError('manifest-fetch', `could not fetch ${url}`, cause)
    }
    if (!response.ok) throw new LoopedLoaderError('manifest-fetch', `${url} responded with ${response.status}`)

    let body: unknown
    try {
      body = await response.json()
    } catch (cause) {
      throw new LoopedLoaderError('manifest-invalid', `${url} is not valid JSON`, cause)
    }
    return parseManifest(body)
  }

  async function resolve(): Promise<void> {
    if (resolving || destroyed) return
    resolving = true
    try {
      setState('resolving')
      const manifest = await loadManifest()
      if (destroyed) return
      const poolOptions: { clip?: string; clips?: string[] } = {}
      if (options.clip !== undefined) poolOptions.clip = options.clip
      if (options.clips !== undefined) poolOptions.clips = options.clips
      pool = buildPool(manifest, poolOptions)
      selectNext()
    } catch (cause) {
      if (destroyed) return
      fail(asLoaderError(cause, 'manifest-invalid', 'failed to resolve the manifest'))
    } finally {
      resolving = false
    }
  }

  /** Picks the next clip and resolves its URL *before* announcing the loading state. */
  function selectNext(): void {
    if (clip) failed.add(clip.id)
    const remaining = pool.filter((entry) => !failed.has(entry.id))
    if (remaining.length === 0) {
      fail(new LoopedLoaderError('no-clips', 'every clip in the pool failed to load'))
      return
    }

    const candidate = pickClip(remaining, options.seed)
    const source = candidate.sources[0]
    if (!source) {
      failed.add(candidate.id)
      selectNext()
      return
    }

    let nextSrc: string
    try {
      nextSrc = resolveSrc(baseUrl, source.src)
    } catch (cause) {
      fail(asLoaderError(cause, 'clip-fetch', 'failed to resolve the clip URL'))
      return
    }

    clip = candidate
    src = nextSrc
    options.onSelect?.(candidate)
    setState('loading')
    bindToElement()
  }

  function bindToElement(): void {
    if (!video || !src) return
    video.muted = true
    video.src = src
    requestPlay()
  }

  const onPlaying = (): void => setState('playing')
  const onMediaFailure = (): void => {
    // MediaError code 3 is MEDIA_ERR_DECODE; anything else is a fetch or container problem.
    const code: ErrorCode = video?.error?.code === 3 ? 'decode' : 'clip-fetch'
    attempts++
    if (attempts < MAX_ATTEMPTS && pool.filter((entry) => !failed.has(entry.id)).length > 1) {
      selectNext()
      return
    }
    fail(new LoopedLoaderError(code, `clip "${clip?.id ?? 'unknown'}" failed to load`))
  }

  function requestPlay(): void {
    if (!video) return
    try {
      const result = video.play()
      if (result && typeof result.then === 'function') {
        result.then(undefined, (cause: unknown) => onAutoplayBlocked(cause))
      }
    } catch (cause) {
      onAutoplayBlocked(cause)
    }
  }

  function onAutoplayBlocked(cause: unknown): void {
    if (destroyed) return
    emitError(new LoopedLoaderError('autoplay-blocked', 'the browser refused to start playback', cause))
    if (typeof document === 'undefined') return
    if (interactionRetryUsed) return
    interactionRetryUsed = true
    // Exactly one interaction-triggered retry per loader: the first rejection arms
    // the { once: true } pointerdown handler, later rejections only report. The
    // handler is removed in destroy() so a destroyed loader cannot be resumed by a
    // stray gesture later.
    document.removeEventListener('pointerdown', retryOnInteraction)
    document.addEventListener('pointerdown', retryOnInteraction, { once: true })
  }

  const retryOnInteraction = (): void => {
    document.removeEventListener('pointerdown', retryOnInteraction)
    requestPlay()
  }

  const onVisibilityChange = (): void => {
    if (!video) return
    if (document.hidden) video.pause()
    else requestPlay()
  }

  function bindVisibility(): void {
    if (typeof document === 'undefined' || visibilityBound) return
    document.addEventListener('visibilitychange', onVisibilityChange)
    visibilityBound = true
  }

  return {
    get state() {
      return state
    },
    get clip() {
      return clip
    },
    get src() {
      return src
    },
    get error() {
      return error
    },

    start() {
      if (started || destroyed) return
      started = true
      if (respectReducedMotion && prefersReducedMotion()) return
      if (delayMs > 0) timer = setTimeout(() => void resolve(), delayMs)
      else void resolve()
    },

    attach(element: VideoLike) {
      if (element === video) return
      if (video) {
        video.removeEventListener('playing', onPlaying)
        video.removeEventListener('error', onMediaFailure)
        video.pause()
      }
      video = element
      element.addEventListener('playing', onPlaying)
      element.addEventListener('error', onMediaFailure)
      bindVisibility()
      if (src) {
        element.muted = true
        element.src = src
        requestPlay()
      } else if (started && !destroyed && state !== 'error') {
        void resolve()
      }
    },

    observeRoot(root: Element) {
      observed = root
      if (typeof IntersectionObserver === 'undefined') return
      observer = new IntersectionObserver((entries) => {
        const entry = entries[0]
        if (!entry || !video) return
        if (entry.isIntersecting) requestPlay()
        else video.pause()
      })
      observer.observe(root)
    },

    destroy() {
      destroyed = true
      if (timer) clearTimeout(timer)
      abort?.abort()
      observer?.disconnect()
      observer = null
      observed = null
      if (video) {
        video.removeEventListener('playing', onPlaying)
        video.removeEventListener('error', onMediaFailure)
        video.pause()
        video.removeAttribute('src')
        video.load?.()
      }
      video = null
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange)
        document.removeEventListener('pointerdown', retryOnInteraction)
      }
    },
  }
}
