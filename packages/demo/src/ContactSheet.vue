<script setup lang="ts">
import { LoopedLoader } from '@topclans/looped-loader-vue'
import manifest from '@topclans/looped-loader-assets/manifest.json'

const clips = manifest.clips
const kb = (bytes: number | undefined) => `${Math.round((bytes ?? 0) / 1024)} KB`
</script>

<template>
  <section>
    <p>{{ clips.length }} clips · {{ kb(manifest.corpus.totalBytes) }} total · base-url <code>/looped-clips</code></p>
    <ul class="grid">
      <li v-for="clip in clips" :key="clip.id">
        <LoopedLoader base-url="/looped-clips" :clip="clip.id" size="lg" label="Loading" />
        <dl>
          <dt>{{ clip.id }}</dt>
          <dd>{{ clip.width }}×{{ clip.height }} · {{ kb(clip.bytes?.mp4) }} · CRF {{ clip.encode?.crf }}</dd>
          <dd>
            seam {{ clip.loopSeam?.seam.toFixed(2) }} / p90 {{ clip.loopSeam?.stepP90.toFixed(2) }}
            <strong v-if="clip.loopSeam?.flag === 'review'">· review</strong>
          </dd>
        </dl>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; padding: 0; list-style: none; }
li { background: #1b1b1b; padding: 12px; border-radius: 8px; }
dl { margin: 8px 0 0; font-size: 12px; }
dt { font-family: ui-monospace, monospace; overflow-wrap: anywhere; }
dd { margin: 2px 0; color: #aaa; }
strong { color: #ffb454; }
</style>
