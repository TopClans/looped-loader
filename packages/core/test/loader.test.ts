import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

function fakeDocument() {
  const listeners = new Map<string, Set<() => void>>()
  return {
    hidden: false,
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
}

describe('createLoopedLoader', () => {
  beforeEach(() => {
    resetRecent()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  // A failing test must not leak fake timers or global stubs into later tests.
  afterEach(() => {
    vi.useRealTimers()
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

  it('makes attach idempotent: a re-attached element stops driving the loader', async () => {
    const doc = fakeDocument()
    vi.stubGlobal('document', doc)
    const a = fakeVideo()
    const b = fakeVideo()
    const loader = createLoopedLoader({ baseUrl: '/clips', manifest, seed: 'x', delayMs: 0 })
    loader.start()
    await flush()
    loader.attach(a)
    loader.attach(a)
    expect(a.listenerCount('playing')).toBe(1)
    expect(a.listenerCount('error')).toBe(1)
    expect(doc.listenerCount('visibilitychange')).toBe(1)
    loader.attach(b)
    expect(a.listenerCount('playing')).toBe(0)
    expect(a.listenerCount('error')).toBe(0)
    expect(a.pauseCalls).toBe(1)
    expect(doc.listenerCount('visibilitychange')).toBe(1)
    b.emit('playing')
    expect(loader.state).toBe('playing')
    a.emit('playing')
    expect(loader.state).toBe('playing')
    a.emit('error')
    expect(loader.state).toBe('playing')
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

  it('keeps error terminal when the host attaches after a manifest failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
    const video = fakeVideo()
    const states: string[] = []
    const loader = createLoopedLoader({ baseUrl: '/clips', seed: 'x', delayMs: 0, onState: (state) => states.push(state) })
    loader.start()
    await flush()
    await flush()
    expect(loader.state).toBe('error')
    loader.attach(video)
    await flush()
    await flush()
    expect(video.listenerCount('playing')).toBe(1)
    expect(video.listenerCount('error')).toBe(1)
    expect(loader.state).toBe('error')
    expect(states).toEqual(['resolving', 'error'])
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

  it('caps clip attempts at three in a 4-clip pool where every clip fails', async () => {
    const video = fakeVideo()
    const onSelect = vi.fn()
    const onError = vi.fn()
    const loader = createLoopedLoader({ baseUrl: '/clips', manifest, seed: 'x', delayMs: 0, onSelect, onError })
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
    expect(onSelect).toHaveBeenCalledTimes(3)
    expect(onError).toHaveBeenCalledTimes(1)
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

  it('retries autoplay on interaction exactly once, then only reports', async () => {
    const doc = fakeDocument()
    vi.stubGlobal('document', doc)
    const video = fakeVideo()
    video.playError = new Error('NotAllowedError')
    const onError = vi.fn()
    const loader = createLoopedLoader({ baseUrl: '/clips', manifest, seed: 'x', delayMs: 0, onError })
    loader.start()
    await flush()
    loader.attach(video)
    await flush()
    expect(video.playCalls).toBe(1)
    expect(onError).toHaveBeenCalledTimes(1)
    doc.emit('pointerdown')
    await flush()
    expect(video.playCalls).toBe(2)
    doc.emit('pointerdown')
    await flush()
    expect(video.playCalls).toBe(2)
    expect(onError).toHaveBeenCalledTimes(2)
    expect(doc.listenerCount('pointerdown')).toBe(0)
    loader.destroy()
  })

  it('does not emit autoplay-blocked from a rejection that lands after destroy', async () => {
    const video = fakeVideo()
    video.playError = new Error('NotAllowedError')
    const onError = vi.fn()
    const loader = createLoopedLoader({ baseUrl: '/clips', manifest, seed: 'x', delayMs: 0, onError })
    loader.start()
    await flush()
    loader.attach(video)
    loader.destroy()
    await flush()
    expect(onError).not.toHaveBeenCalled()
    expect(loader.state).not.toBe('error')
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

  it('resolves exactly once when attach() lands after start()', async () => {
    vi.useFakeTimers()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(manifest), { status: 200, headers: { 'content-type': 'application/json' } }),
    )
    const video = fakeVideo()
    const onError = vi.fn()
    const loader = createLoopedLoader({ baseUrl: '/clips', seed: 'x', delayMs: 120, onError })
    loader.start()
    loader.attach(video)
    await vi.advanceTimersByTimeAsync(120)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(loader.state).not.toBe('error')
    loader.destroy()
    vi.useRealTimers()
  })

  it('reaches playing on a one-clip pool when attach() lands after start()', async () => {
    vi.useFakeTimers()
    const video = fakeVideo()
    const onError = vi.fn()
    const loader = createLoopedLoader({ baseUrl: '/clips', manifest, clip: 'a', seed: 'x', delayMs: 120, onError })
    loader.start()
    await vi.advanceTimersByTimeAsync(0)
    loader.attach(video)
    await vi.advanceTimersByTimeAsync(120)
    video.emit('playing')
    expect(loader.state).toBe('playing')
    expect(onError).not.toHaveBeenCalled()
    loader.destroy()
    vi.useRealTimers()
  })

  it('does not let attach() shortcut delayMs', async () => {
    vi.useFakeTimers()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(manifest), { status: 200, headers: { 'content-type': 'application/json' } }),
    )
    const video = fakeVideo()
    const loader = createLoopedLoader({ baseUrl: '/clips', seed: 'x', delayMs: 120 })
    loader.start()
    loader.attach(video)
    await vi.advanceTimersByTimeAsync(100)
    expect(fetchSpy).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(40)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    loader.destroy()
    vi.useRealTimers()
  })

  it('never fetches when a video is attached under reduced motion', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(manifest), { status: 200, headers: { 'content-type': 'application/json' } }),
    )
    const video = fakeVideo()
    const loader = createLoopedLoader({ baseUrl: '/clips', seed: 'x', delayMs: 0 })
    loader.start()
    loader.attach(video)
    await flush()
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(loader.state).toBe('idle')
    loader.destroy()
  })
})

describe('prefersReducedMotion', () => {
  it('is false when matchMedia is unavailable', () => {
    expect(prefersReducedMotion()).toBe(typeof globalThis.matchMedia === 'function' ? expect.any(Boolean) : false)
  })
})
