import { describe, expect, it } from 'vitest'
import { buildPool, parseManifest, resolveSrc } from '../src/manifest.js'

const valid = {
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

const codeOf = (fn: () => unknown): string => {
  try {
    fn()
  } catch (error) {
    return (error as { code?: string }).code ?? 'no-code'
  }
  return 'did-not-throw'
}

describe('resolveSrc', () => {
  it('joins exactly one slash for every baseUrl shape a consumer types', () => {
    const expected = 'https://cdn.example.com/clips/a.mp4'
    expect(resolveSrc('https://cdn.example.com', 'clips/a.mp4')).toBe(expected)
    expect(resolveSrc('https://cdn.example.com/', 'clips/a.mp4')).toBe(expected)
    expect(resolveSrc('https://cdn.example.com///', 'clips/a.mp4')).toBe(expected)
    expect(resolveSrc('https://cdn.example.com', '/clips/a.mp4')).toBe(expected)
    expect(resolveSrc('https://cdn.example.com/deep/sub/path/', 'clips/a.mp4')).toBe(
      'https://cdn.example.com/deep/sub/path/clips/a.mp4',
    )
    expect(resolveSrc('/looped-clips', 'clips/a.mp4')).toBe('/looped-clips/clips/a.mp4')
  })

  it('lets an absolute source win over the base', () => {
    expect(resolveSrc('/looped-clips', 'https://other.example.com/x.mp4')).toBe('https://other.example.com/x.mp4')
  })

  it('refuses to build a URL out of an empty base', () => {
    expect(codeOf(() => resolveSrc('', 'clips/a.mp4'))).toBe('manifest-fetch')
    expect(codeOf(() => resolveSrc('   ', 'clips/a.mp4'))).toBe('manifest-fetch')
  })
})

describe('parseManifest', () => {
  it('accepts a valid manifest and ignores unknown fields', () => {
    const manifest = parseManifest({
      ...valid,
      futureField: { anything: true },
      clips: [{ ...valid.clips[0], extra: 1 }],
    })
    expect(manifest.clips[0]?.id).toBe('a')
    expect(manifest.schemaVersion).toBe(1)
  })

  it('defaults a missing schemaVersion to 1', () => {
    expect(parseManifest({ clips: valid.clips }).schemaVersion).toBe(1)
  })

  it.each([
    ['not an object', 'nope'],
    ['null', null],
    ['clips missing', {}],
    ['clips not an array', { clips: {} }],
    ['clips empty', { clips: [] }],
    ['id missing', { clips: [{ ...valid.clips[0], id: '' }] }],
    ['sources missing', { clips: [{ ...valid.clips[0], sources: undefined }] }],
    ['sources empty', { clips: [{ ...valid.clips[0], sources: [] }] }],
    ['source src not a string', { clips: [{ ...valid.clips[0], sources: [{ src: 1, type: 'video/mp4' }] }] }],
    ['width is a string', { clips: [{ ...valid.clips[0], width: '480' }] }],
    ['durationMs negative', { clips: [{ ...valid.clips[0], durationMs: -1 }] }],
    ['fps zero', { clips: [{ ...valid.clips[0], fps: 0 }] }],
  ])('rejects %s with manifest-invalid', (_label, input) => {
    expect(codeOf(() => parseManifest(input))).toBe('manifest-invalid')
  })
})

describe('buildPool', () => {
  const manifest = parseManifest({
    clips: [valid.clips[0], { ...valid.clips[0], id: 'b' }, { ...valid.clips[0], id: 'c' }],
  })

  it('returns every clip by default', () => {
    expect(buildPool(manifest).map((c) => c.id)).toEqual(['a', 'b', 'c'])
  })

  it('narrows to one id with clip', () => {
    expect(buildPool(manifest, { clip: 'b' }).map((c) => c.id)).toEqual(['b'])
  })

  it('narrows to a subset with clips, silently dropping unknown ids', () => {
    expect(buildPool(manifest, { clips: ['a', 'zzz', 'c'] }).map((c) => c.id)).toEqual(['a', 'c'])
  })

  it('reports an unknown clip id as manifest-invalid', () => {
    expect(codeOf(() => buildPool(manifest, { clip: 'zzz' }))).toBe('manifest-invalid')
  })

  it('reports a subset with no surviving id as no-clips', () => {
    expect(codeOf(() => buildPool(manifest, { clips: ['zzz'] }))).toBe('no-clips')
  })
})
