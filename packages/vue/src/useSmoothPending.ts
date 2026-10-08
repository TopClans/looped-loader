import { onScopeDispose, ref, watch, type Ref } from 'vue'

export interface SmoothPendingOptions {
  /** How long pending must stay true before anything is shown. */
  delay?: number
  /** Once shown, how long it stays shown at minimum. */
  minVisible?: number
}

/**
 * A loader cannot guarantee its own minimum visible time, because mounting and
 * unmounting belong to the parent. This returns the ref the parent should render
 * from: it flips true only after `delay`, and once true it stays true for at
 * least `minVisible`.
 */
export function useSmoothPending(pending: Ref<boolean>, options: SmoothPendingOptions = {}): Ref<boolean> {
  const delay = options.delay ?? 120
  const minVisible = options.minVisible ?? 300
  const visible = ref(false)

  let showTimer: ReturnType<typeof setTimeout> | null = null
  let hideTimer: ReturnType<typeof setTimeout> | null = null
  let shownAt = 0

  watch(
    pending,
    (isPending) => {
      if (isPending) {
        if (hideTimer) {
          clearTimeout(hideTimer)
          hideTimer = null
        }
        if (visible.value || showTimer) return
        showTimer = setTimeout(() => {
          showTimer = null
          shownAt = Date.now()
          visible.value = true
        }, delay)
        return
      }

      if (showTimer) {
        clearTimeout(showTimer)
        showTimer = null
        return
      }
      if (!visible.value) return

      const remaining = Math.max(0, minVisible - (Date.now() - shownAt))
      hideTimer = setTimeout(() => {
        hideTimer = null
        visible.value = false
      }, remaining)
    },
    { immediate: true },
  )

  onScopeDispose(() => {
    if (showTimer) clearTimeout(showTimer)
    if (hideTimer) clearTimeout(hideTimer)
  })

  return visible
}
