import { describe, expect, it } from 'vitest'
import { mulberry32, seededIndex, xmur3 } from '../src/prng.js'

describe('seededIndex', () => {
  it('is stable for the same seed across 100 calls', () => {
    const first = seededIndex('route:/orders', 32)
    for (let i = 0; i < 100; i++) expect(seededIndex('route:/orders', 32)).toBe(first)
  })

  it('stays inside the pool for every seed shape', () => {
    for (const seed of ['', 'a', 'route:/orders', 0, 42, 'длинный ключ']) {
      const index = seededIndex(seed, 32)
      expect(index).toBeGreaterThanOrEqual(0)
      expect(index).toBeLessThan(32)
    }
  })

  it('spreads 200 different seeds over more than 20 of 32 slots', () => {
    const seen = new Set<number>()
    for (let i = 0; i < 200; i++) seen.add(seededIndex(`seed-${i}`, 32))
    expect(seen.size).toBeGreaterThan(20)
  })

  it('rejects an empty pool instead of returning NaN', () => {
    expect(() => seededIndex('x', 0)).toThrow(RangeError)
  })

  it('mulberry32 stays in [0,1)', () => {
    const rand = mulberry32(xmur3('seed')())
    for (let i = 0; i < 50; i++) {
      const value = rand()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})
