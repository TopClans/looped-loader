<script setup lang="ts">
import { ref } from 'vue'
import ContactSheet from './ContactSheet.vue'
import ScenarioBoard from './ScenarioBoard.vue'

const tab = ref<'sheet' | 'scenarios'>('sheet')
</script>

<template>
  <main>
    <h1>looped-loader</h1>
    <nav>
      <button type="button" :aria-pressed="tab === 'sheet'" @click="tab = 'sheet'">Contact sheet</button>
      <button type="button" :aria-pressed="tab === 'scenarios'" @click="tab = 'scenarios'">Scenarios</button>
    </nav>
    <ContactSheet v-if="tab === 'sheet'" />
    <ScenarioBoard v-else />
  </main>
</template>

<style>
body { margin: 0; font: 14px/1.4 system-ui, sans-serif; background: #111; color: #eee; }
main { padding: 24px; }
nav { display: flex; gap: 8px; margin-bottom: 24px; }
button { padding: 6px 12px; }
</style>
