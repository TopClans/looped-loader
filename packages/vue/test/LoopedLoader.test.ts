import { flushPromises, mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import LoopedLoader from '../src/LoopedLoader.vue'

const manifest = {
  schemaVersion: 1,
  clips: [
    {
      id: 'a',
      sources: [{ src: 'clips/a.mp4', type: 'video/mp4' }],
      width: 480,
      height: 360,
      durationMs: 2000,
      fps: 30,
    },
  ],
}

const matchMedia = (matches: boolean) => {
  const listeners = new Set<(event: MediaQueryListEvent) => void>()
  const mql = {
    matches,
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener),
    dispatchEvent: () => true,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
  }
  return { mql: mql as unknown as MediaQueryList, emit: (value: boolean) => {
    Object.defineProperty(mql, 'matches', { value, configurable: true })
    for (const listener of listeners) listener({ matches: value } as MediaQueryListEvent)
  } }
}

describe('LoopedLoader', () => {
  beforeEach(() => {
    HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve())
    HTMLMediaElement.prototype.pause = vi.fn()
    HTMLMediaElement.prototype.load = vi.fn()
    // jsdom does not implement matchMedia, so the spies below would have
    // nothing to hook. A default that never matches is the browser default.
    window.matchMedia ??= ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
      addListener: () => {},
      removeListener: () => {},
    })) as unknown as typeof window.matchMedia
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('shows a spinner and a video element, then hides the spinner once playing', async () => {
    const wrapper = mount(LoopedLoader, {
      props: { baseUrl: '/clips', manifest, seed: 'x', delayMs: 0 },
    })
    expect(wrapper.find('.ll-spinner').exists()).toBe(true)
    await flushPromises()
    const video = wrapper.find('video')
    expect(video.exists()).toBe(true)
    expect(video.attributes('src')).toBe('/clips/clips/a.mp4')
    expect(video.attributes('aria-hidden')).toBe('true')
    await video.trigger('playing')
    await nextTick()
    expect(wrapper.find('.ll-spinner').exists()).toBe(false)
    wrapper.unmount()
  })

  it('is a polite live region with an accessible label', () => {
    const wrapper = mount(LoopedLoader, { props: { baseUrl: '/clips', manifest, label: 'Загрузка' } })
    const root = wrapper.find('.ll-root')
    expect(root.attributes('role')).toBe('status')
    expect(root.attributes('aria-live')).toBe('polite')
    expect(root.attributes('aria-busy')).toBe('true')
    expect(wrapper.find('.ll-label').text()).toBe('Загрузка')
    wrapper.unmount()
  })

  it('creates no video and fetches nothing under reduced motion', async () => {
    const { mql } = matchMedia(true)
    vi.spyOn(window, 'matchMedia').mockReturnValue(mql)
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const wrapper = mount(LoopedLoader, { props: { baseUrl: '/clips', delayMs: 0 } })
    await flushPromises()
    expect(wrapper.find('video').exists()).toBe(false)
    expect(wrapper.find('.ll-spinner').exists()).toBe(true)
    expect(fetchSpy).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('does not create a video when reduced motion is switched on after mount', async () => {
    const { mql, emit } = matchMedia(false)
    vi.spyOn(window, 'matchMedia').mockReturnValue(mql)
    const wrapper = mount(LoopedLoader, {
      props: { baseUrl: '/clips', manifest, seed: 'x', delayMs: 0 },
    })
    await flushPromises()
    expect(wrapper.find('video').exists()).toBe(true)
    emit(true)
    await nextTick()
    expect(wrapper.find('video').exists()).toBe(false)
    wrapper.unmount()
  })

  it('never lets a rejected play() reach the host and retries on first interaction', async () => {
    HTMLMediaElement.prototype.play = vi.fn(() => Promise.reject(new DOMException('denied', 'NotAllowedError')))
    const events: string[] = []
    const wrapper = mount(LoopedLoader, {
      props: {
        baseUrl: '/clips',
        manifest,
        seed: 'x',
        delayMs: 0,
        onError: (error: { code?: string }) => events.push(error.code ?? 'unknown'),
      },
    })
    await flushPromises()
    expect(wrapper.find('.ll-spinner').exists()).toBe(true)
    expect(events).toContain('autoplay-blocked')
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1)
    document.dispatchEvent(new Event('pointerdown'))
    await flushPromises()
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('renders the fallback slot when the manifest cannot be resolved', async () => {
    const wrapper = mount(LoopedLoader, {
      props: { baseUrl: '/clips', manifest: { clips: [] }, delayMs: 0 },
      slots: { fallback: '<p class="mine">ищу иначе</p>' },
    })
    await flushPromises()
    expect(wrapper.find('.mine').exists()).toBe(true)
    wrapper.unmount()
  })

  it('releases the video element on unmount', async () => {
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause')
    const wrapper = mount(LoopedLoader, { props: { baseUrl: '/clips', manifest, seed: 'x', delayMs: 0 } })
    await flushPromises()
    wrapper.unmount()
    expect(pause).toHaveBeenCalled()
  })

  it('drops the ll-rounded class when rounded is false', () => {
    const wrapper = mount(LoopedLoader, { props: { baseUrl: '/clips', manifest, rounded: false } })
    expect(wrapper.find('.ll-root').classes()).not.toContain('ll-rounded')
    wrapper.unmount()
    const rounded = mount(LoopedLoader, { props: { baseUrl: '/clips', manifest } })
    expect(rounded.find('.ll-root').classes()).toContain('ll-rounded')
    rounded.unmount()
  })

  it('rules the video corner radius by the ll-rounded class, not unconditionally', () => {
    // Vitest does not inject SFC styles (css: false), so the scoped stylesheet
    // itself is pinned at its source: with the class absent the video must have
    // no border-radius at all, which is only true when no unconditional rule sets one.
    const source = readFileSync(resolve(import.meta.dirname, '../src/LoopedLoader.vue'), 'utf8')
    const style = /<style scoped>([\s\S]*?)<\/style>/.exec(source)?.[1] ?? ''
    const plainVideo = /(^|})\s*\.ll-video\s*{([^}]*)}/.exec(style)?.[2] ?? ''
    expect(plainVideo).not.toContain('border-radius')
    expect(style).toMatch(/\.ll-rounded\s+\.ll-video\s*{[^}]*border-radius:/)
  })
})
