import { onBeforeUnmount, onMounted, ref, shallowRef, type Ref } from 'vue'
import {
  createLoopedLoader,
  type Clip,
  type LoopedLoader,
  type LoopedLoaderError,
  type LoopedLoaderOptions,
  type State,
} from '@topclans/looped-loader-core'

export interface UseLoopedLoaderResult {
  state: Ref<State>
  clip: Ref<Clip | null>
  error: Ref<LoopedLoaderError | null>
  loader: Ref<LoopedLoader | null>
}

/** For consumers who want the loader's state without its markup. */
export function useLoopedLoader(options: LoopedLoaderOptions): UseLoopedLoaderResult {
  const state = ref<State>('idle')
  const clip = shallowRef<Clip | null>(null)
  const error = ref<LoopedLoaderError | null>(null)
  const loader = shallowRef<LoopedLoader | null>(null)

  onMounted(() => {
    loader.value = createLoopedLoader({
      ...options,
      onState: (next) => {
        state.value = next
        options.onState?.(next)
      },
      onSelect: (next) => {
        clip.value = next
        options.onSelect?.(next)
      },
      onError: (failure) => {
        error.value = failure
        options.onError?.(failure)
      },
    })
    loader.value.start()
  })

  onBeforeUnmount(() => {
    loader.value?.destroy()
    loader.value = null
  })

  return { state, clip, error, loader }
}
