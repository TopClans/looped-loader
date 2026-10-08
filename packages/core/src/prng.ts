/** xmur3: string → 32-bit seed sequence. */
export function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return h >>> 0
  }
}

/** mulberry32: 32-bit seed → deterministic [0,1) generator. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Stable index in [0, length) for a string or number seed. */
export function seededIndex(seed: string | number, length: number): number {
  if (!Number.isInteger(length) || length <= 0) {
    throw new RangeError(`seededIndex: length must be a positive integer, got ${length}`)
  }
  const rand = mulberry32(xmur3(String(seed))())
  return Math.floor(rand() * length) % length
}
