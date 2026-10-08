<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import {
  createLoopedLoader,
  type Clip,
  type LoopedLoader as LoopedLoaderHandle,
  type LoopedLoaderError,
  type State,
} from '@topclans/looped-loader-core'

const props = withDefaults(
  defineProps<{
    baseUrl: string
    manifest?: unknown
    manifestUrl?: string
    seed?: string | number
    clip?: string
    clips?: string[]
    delayMs?: number
    size?: 'sm' | 'md' | 'lg' | 'full'
    mode?: 'inline' | 'overlay'
    objectFit?: 'contain' | 'cover'
    rounded?: boolean
    respectReducedMotion?: boolean
    label?: string
  }>(),
  {
    delayMs: 120,
    size: 'md',
    mode: 'inline',
    objectFit: 'contain',
    rounded: true,
    respectReducedMotion: true,
    label: 'Loading',
  },
)

const emit = defineEmits<{
  select: [clip: Clip]
  ready: [clip: Clip]
  error: [error: LoopedLoaderError]
}>()

const query =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null

const root = ref<HTMLElement | null>(null)
const videoEl = ref<HTMLVideoElement | null>(null)
const state = ref<State>('idle')
const clip = shallowRef<Clip | null>(null)
const reducedMotion = ref(props.respectReducedMotion && (query?.matches ?? false))

let loader: LoopedLoaderHandle | null = null

/** False until onMounted: the server render and the client's first render agree (spinner only). */
const mounted = ref(false)

const showVideo = computed(() => mounted.value && !reducedMotion.value && state.value !== 'error')
const aspect = computed(() => (clip.value ? `${clip.value.width} / ${clip.value.height}` : '16 / 9'))

function onMotionChange(event: MediaQueryListEvent): void {
  reducedMotion.value = props.respectReducedMotion && event.matches
}

// The <video> is created only after mount, so the template ref is the single
// attach point: it fires when the element first appears and again if it is
// recreated (e.g. reduced motion switched back off). attach() is idempotent.
watch(videoEl, (element) => {
  if (element && loader) loader.attach(element)
})

onMounted(() => {
  mounted.value = true
  loader = createLoopedLoader({
    baseUrl: props.baseUrl,
    ...(props.manifest !== undefined ? { manifest: props.manifest } : {}),
    ...(props.manifestUrl ? { manifestUrl: props.manifestUrl } : {}),
    ...(props.seed !== undefined ? { seed: props.seed } : {}),
    ...(props.clip ? { clip: props.clip } : {}),
    ...(props.clips ? { clips: props.clips } : {}),
    delayMs: props.delayMs,
    respectReducedMotion: props.respectReducedMotion,
    onState: (next) => {
      state.value = next
      if (next === 'playing' && clip.value) emit('ready', clip.value)
    },
    onSelect: (next) => {
      clip.value = next
      emit('select', next)
    },
    onError: (failure) => emit('error', failure),
  })

  if (root.value) loader.observeRoot(root.value)
  loader.start()
  query?.addEventListener('change', onMotionChange)
})

onBeforeUnmount(() => {
  query?.removeEventListener('change', onMotionChange)
  loader?.destroy()
  loader = null
})
</script>

<template>
  <div
    ref="root"
    class="ll-root"
    :class="[`ll-size-${size}`, `ll-mode-${mode}`, { 'll-rounded': rounded }]"
    :data-state="state"
    role="status"
    aria-live="polite"
    :aria-busy="state !== 'playing'"
  >
    <video
      v-if="showVideo"
      ref="videoEl"
      class="ll-video"
      :style="{ aspectRatio: aspect, objectFit }"
      muted
      playsinline
      autoplay
      loop
      aria-hidden="true"
    />
    <div v-if="state !== 'playing'" class="ll-spinner" aria-hidden="true" />
    <span class="ll-label">{{ label }}</span>
    <slot v-if="state === 'error' || reducedMotion" name="fallback" />
  </div>
</template>

<style scoped>
.ll-root {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--ll-bg, transparent);
}
.ll-size-sm { --ll-size: 40px; }
.ll-size-md { --ll-size: 96px; }
.ll-size-lg { --ll-size: 200px; }
.ll-size-full { --ll-size: 100%; }
.ll-mode-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--ll-z, 9999);
  background: var(--ll-overlay-bg, rgb(0 0 0 / 0.72));
}
.ll-video {
  display: block;
  width: var(--ll-size, 96px);
  max-width: 100%;
  height: auto;
  border-radius: var(--ll-radius, 12px);
}
.ll-spinner {
  position: absolute;
  width: var(--ll-spinner-size, 32px);
  height: var(--ll-spinner-size, 32px);
  border: var(--ll-spinner-width, 3px) solid var(--ll-spinner-track, rgb(127 127 127 / 0.25));
  border-top-color: var(--ll-spinner-color, currentColor);
  border-radius: 50%;
  animation: ll-spin 800ms linear infinite;
}
.ll-label {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
@keyframes ll-spin {
  to { transform: rotate(360deg); }
}
@media (prefers-reduced-motion: reduce) {
  .ll-spinner { animation: none; }
}
</style>
