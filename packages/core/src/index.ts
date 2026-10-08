export { LoopedLoaderError, isLoopedLoaderError, type ErrorCode } from './errors.js'
export { createLoopedLoader, prefersReducedMotion, type LoopedLoader, type LoopedLoaderOptions, type State, type VideoLike } from './loader.js'
export { buildPool, parseManifest, resolveSrc } from './manifest.js'
export { mulberry32, seededIndex, xmur3 } from './prng.js'
export {
  pickClip,
  resetRecent,
  type Clip,
  type ClipSource,
  type EncodeInfo,
  type LoopSeam,
  type Manifest,
} from './pool.js'
