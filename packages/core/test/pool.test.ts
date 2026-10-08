import { beforeEach, describe, expect, it } from 'vitest'
import { pickClip, resetRecent, type Clip } from '../src/pool.js'

const clip = (id: string): Clip => ({
  id,
  sources: [{ src: `clips/${id}.mp4`, type: 'video/mp4' }],
  width: 480,
  height: 360,
  durationMs: 2000,
  fps: 30,
})

const pool = [clip('a'), clip('b'), clip('c'), clip('d'), clip('e')]

describe('pickClip', () => {
  beforeEach(() => resetRecent())

  it('returns the same clip for the same seed, whatever the recent history', () => {
    const first = pickClip(pool, 'route:/orders').id
    pickClip(pool)
    pickClip(pool)
    expect(pickClip(pool, 'route:/orders').id).toBe(first)
  })

  it('never repeats any of the previous three picks', () => {
    const picks: string[] = []
    for (let i = 0; i < 60; i++) picks.push(pickClip(pool).id)
    for (let i = 3; i < picks.length; i++) {
      expect(picks.slice(i - 3, i)).not.toContain(picks[i])
    }
  })

  it('still works when the pool is smaller than the recent window', () => {
    const small = [clip('x'), clip('y')]
    for (let i = 0; i < 20; i++) expect(small.map((c) => c.id)).toContain(pickClip(small).id)
  })

  it('treats an empty string seed as "no seed"', () => {
    const picks = new Set<string>()
    for (let i = 0; i < 30; i++) picks.add(pickClip(pool, '').id)
    expect(picks.size).toBeGreaterThan(1)
  })

  it('throws a coded error on an empty pool', () => {
    expect(() => pickClip([])).toThrowError(/looped-loader:no-clips/)
  })
})
