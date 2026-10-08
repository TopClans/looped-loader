import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { effectScope, ref } from 'vue'
import { useSmoothPending } from '../src/useSmoothPending.js'

describe('useSmoothPending', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('stays hidden for a pending state shorter than the delay', async () => {
    const scope = effectScope()
    const pending = ref(false)
    const visible = scope.run(() => useSmoothPending(pending, { delay: 120, minVisible: 300 }))!
    pending.value = true
    await vi.advanceTimersByTimeAsync(80)
    pending.value = false
    await vi.advanceTimersByTimeAsync(500)
    expect(visible.value).toBe(false)
    scope.stop()
  })

  it('shows after the delay and holds for minVisible afterwards', async () => {
    const scope = effectScope()
    const pending = ref(false)
    const visible = scope.run(() => useSmoothPending(pending, { delay: 120, minVisible: 300 }))!
    pending.value = true
    await vi.advanceTimersByTimeAsync(119)
    expect(visible.value).toBe(false)
    await vi.advanceTimersByTimeAsync(2)
    expect(visible.value).toBe(true)
    pending.value = false
    await vi.advanceTimersByTimeAsync(200)
    expect(visible.value).toBe(true)
    await vi.advanceTimersByTimeAsync(200)
    expect(visible.value).toBe(false)
    scope.stop()
  })

  it('clears its timers when the scope is disposed', async () => {
    const scope = effectScope()
    const pending = ref(true)
    scope.run(() => useSmoothPending(pending, { delay: 50 }))
    await vi.advanceTimersByTimeAsync(10)
    scope.stop()
    await vi.advanceTimersByTimeAsync(1000)
    expect(vi.getTimerCount()).toBe(0)
  })
})
