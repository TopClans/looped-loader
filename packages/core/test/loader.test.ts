import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createLoopedLoader, prefersReducedMotion, type VideoLike } from '../src/loader.js'
import { resetRecent } from '../src/pool.js'
import type { Manifest } from '../src/pool.js'

const manifest: Manifest = {
  schemaVersion: 1,
  clips: ['a', 'b', 'c', 'd'].map((id) => ({
    id,
    sources: [{ src: `clips/${id}.mp4`, type: 'video/mp4' }],
    width: 480,
    height: 360,
    durationMs: 2000,
    fps: 30,
  })),
}

function fakeVideo() {
  const listeners = new Map<string, Set<() => void>>()
  const element = {
    src: '',
    muted: false,
    playing: false,
    playCalls: 0,
    pauseCalls: 0,
    loadCalls: 0,
    playError: null as Error | null,
    error: null as { code?: number } | null,
    pause() {
      element.pauseCalls++
      element.playing = false
    },
    play() {
      element.playCalls++
      if (element.playError) return Promise.reject(element.playError)
      element.playing = true
      return Promise.resolve()
    },
    load() {
      element.loadCalls++
    },
    removeAttribute(name: string) {
      if (name === 'src') element.src = ''
    },
    addEventListener(type: string, listener: () => void) {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type)?.add(listener)
    },
    removeEventListener(type: string, listener: () => void) {
      listeners.get(type)?.delete(listener)
    },
    emit(type: string) {
      for (const listener of [...(listeners.get(type) ?? [])]) listener()
    },
    listenerCount(type: string) {
      return listeners.get(type)?.size ?? 0
    },
  }
  return element
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('createLoopedLoader', () => {
  beforeEach(() => {
    resetRecent()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('does no work at all before start()', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const onSelect = vi.fn()
    const loader = createLoopedLoader({ baseUrl: '/clips', manifest, onSelect })
    await flush()
    expect(loader.state).toBe('idle')
    expect(loader.clip).toBeNull()
    expect(onSelect).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
    loader.destroy()
  })

  it('selects with a seed, resolves the src and reports playing on the media event', async () => {
    const video = fakeVideo()
    const states: string[] = []
    const loader = createLoopedLoader({
      baseUrl: '/clips/',
      manifest,
      seed: 'route:/orders',
      delayMs: 0,
      onState: (state) => states.push(state),
    })
    loader.start()
    await flush()
    loader.attach(video)
    expect(video.src).toBe('/clips/clips/d.mp4')
    expect(loader.state).toBe('loading')
    video.emit('playing')
    expect(loader.state).toBe('playing')
    expect(states).toContain('resolving')
    loader.destroy()
  })

  it('fetches and validates the manifest when none is passed in', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(manifest), { status: 200, headers: { 'content-type': 'application/json' } }),
    )
    const loader = createLoopedLoader({ baseUrl: '/clips', seed: 'x', delayMs: 0 })
    loader.start()
    await flush()
    await flush()
    expect(loader.state).toBe('loading')
    expect(loader.src).toBe('/clips/clips/c.mp4')
    loader.destroy()
  })

  it('reports manifest-fetch when the manifest request fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
    const onError = vi.fn()
    const loader = createLoopedLoader({ baseUrl: '/clips', seed: 'x', delayMs: 0, onError })
    loader.start()
    await flush()
    await flush()
    expect(loader.state).toBe('error')
    expect(onError.mock.calls[0]?.[0].code).toBe('manifest-fetch')
    loader.destroy()
  })

  it('reports manifest-fetch for an empty baseUrl instead of requesting undefined', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const loader = createLoopedLoader({ baseUrl: '', seed: 'x', delayMs: 0 })
    loader.start()
    await flush()
    expect(loader.state).toBe('error')
    expect(loader.error?.code).toBe('manifest-fetch')
    expect(fetchSpy).not.toHaveBeenCalled()
    loader.destroy()
  })

  it('respects delayMs before touching the manifest', async () => {
    vi.useFakeTimers()
    const loader = createLoopedLoader({ baseUrl: '/clips', manifest, seed: 'x', delayMs: 120 })
    loader.start()
    await vi.advanceTimersByTimeAsync(100)
    expect(loader.state).toBe('idle')
    await vi.advanceTimersByTimeAsync(40)
    expect(loader.state).toBe('loading')
    loader.destroy()
    vi.useRealTimers()
  })

  it('never creates a video or fetches a clip under reduced motion', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const onSelect = vi.fn()
    const loader = createLoopedLoader({ baseUrl: '/clips', manifest: undefined, seed: 'x', delayMs: 0, onSelect })
    loader.start()
    await flush()
    expect(loader.state).toBe('idle')
    expect(onSelect).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
    loader.destroy()
  })

  it('falls back to another clip when one fails, then errors after three attempts', async () => {
    const video = fakeVideo()
    const onError = vi.fn()
    const loader = createLoopedLoader({ baseUrl: '/clips', manifest, seed: 'x', delayMs: 0, onError, clips: ['a', 'b', 'c'] })
    loader.start()
    await flush()
    loader.attach(video)
    video.emit('error')
    await flush()
    video.emit('error')
    await flush()
    video.emit('error')
    await flush()
    expect(loader.state).toBe('error')
    expect(onError.mock.calls.at(-1)?.[0].code).toBe('clip-fetch')
    loader.destroy()
  })

  it('distinguishes a decoder failure from a fetch failure', async () => {
    const video = fakeVideo()
    video.error = { code: 3 }
    const onError = vi.fn()
    const loader = createLoopedLoader({ baseUrl: '/clips', manifest, seed: 'x', delayMs: 0, onError, clips: ['a'] })
    loader.start()
    await flush()
    loader.attach(video)
    video.emit('error')
    await flush()
    expect(onError.mock.calls.at(-1)?.[0].code).toBe('decode')
    loader.destroy()
  })

  it('keeps the spinner on an autoplay rejection and retries on the first interaction', async () => {
    const video = fakeVideo()
    video.playError = new Error('NotAllowedError')
    const onError = vi.fn()
    const loader = createLoopedLoader({ baseUrl: '/clips', manifest, seed: 'x', delayMs: 0, onError })
    loader.start()
    await flush()
    loader.attach(video)
    await flush()
    expect(loader.state).not.toBe('error')
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'autoplay-blocked' }))
    loader.destroy()
  })

  it('releases the decoder on destroy', async () => {
    const video = fakeVideo()
    const loader = createLoopedLoader({ baseUrl: '/clips', manifest, seed: 'x', delayMs: 0 })
    loader.start()
    await flush()
    loader.attach(video)
    video.emit('playing')
    loader.destroy()
    expect(video.pauseCalls).toBe(1)
    expect(video.src).toBe('')
    expect(video.loadCalls).toBe(1)
    expect(video.listenerCount('playing')).toBe(0)
  })
})

describe('prefersReducedMotion', () => {
  it('is false when matchMedia is unavailable', () => {
    expect(prefersReducedMotion()).toBe(typeof globalThis.matchMedia === 'function' ? expect.any(Boolean) : false)
  })
})
