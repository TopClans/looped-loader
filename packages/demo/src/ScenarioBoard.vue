<script setup lang="ts">
import { ref } from 'vue'
import { LoopedLoader, useSmoothPending } from '@topclans/looped-loader-vue'

const delayMs = ref(120)
const pending = ref(false)
const visible = useSmoothPending(pending, { delay: 120, minVisible: 300 })
const lastError = ref<string | null>(null)

function simulate(ms: number): void {
  pending.value = true
  lastError.value = null
  setTimeout(() => {
    pending.value = false
  }, ms)
}
</script>

<template>
  <section class="scenarios">
    <article>
      <h2>Instant (0 ms) — nothing should be fetched</h2>
      <button type="button" @click="simulate(0)">run</button>
      <LoopedLoader v-if="visible" base-url="/clips" :delay-ms="120" />
    </article>

    <article>
      <h2>300 ms</h2>
      <button type="button" @click="simulate(300)">run</button>
      <LoopedLoader v-if="visible" base-url="/clips" :delay-ms="120" seed="scenario-300" />
    </article>

    <article>
      <h2>3 s</h2>
      <button type="button" @click="simulate(3000)">run</button>
      <LoopedLoader v-if="visible" base-url="/clips" :delay-ms="120" seed="scenario-3s" />
    </article>

    <article>
      <h2>Broken manifest (404)</h2>
      <LoopedLoader base-url="/does-not-exist" @error="lastError = 'manifest-fetch'" />
      <p>{{ lastError }}</p>
    </article>

    <article>
      <h2>Clip missing from the manifest</h2>
      <LoopedLoader base-url="/clips" clip="no-such-clip" @error="lastError = 'manifest-invalid'" />
      <p>{{ lastError }}</p>
    </article>

    <article>
      <h2>Overlay mode</h2>
      <LoopedLoader base-url="/clips" mode="overlay" seed="overlay" />
    </article>

    <article>
      <h2>Reduced motion</h2>
      <p>Toggle it in the OS or emulate it in DevTools; no video request should appear in the network panel.</p>
      <LoopedLoader base-url="/clips" seed="reduced" />
    </article>
  </section>
</template>

<style scoped>
.scenarios { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
article { background: #1b1b1b; padding: 12px; border-radius: 8px; min-height: 160px; }
h2 { font-size: 13px; margin: 0 0 8px; color: #bbb; }
</style>
