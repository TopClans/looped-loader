# @topclans/looped-loader-vue

A Vue 3 component that plays a short, perfectly-looping video clip while your
content loads — a loader people don't mind waiting through. Thin adapter over
[`@topclans/looped-loader-core`](../core/README.md); peer dependency `vue ^3.4`.

## Install

```sh
pnpm add @topclans/looped-loader-vue @topclans/looped-loader-assets
```

## Use

```vue
<script setup>
import { LoopedLoader } from '@topclans/looped-loader-vue'
// In 0.1.0 the stylesheet is a separate import, not inlined in the JS.
import '@topclans/looped-loader-vue/style.css'
</script>

<template>
  <LoopedLoader base-url="/looped-clips" />
</template>
```

In `0.1.0` the stylesheet ships as a separate import through the package's
`exports` map — the `import '@topclans/looped-loader-vue/style.css'` line
above. Without it the loader still plays clips, but renders unstyled: no
spinner, no sizing, no fade.

`base-url` points at the directory that serves the asset package's
`manifest.json` and `clips/`. The full story — both hosting recipes with the
copy commands, the props and events tables, the `#fallback` slot, theming
custom properties, `useSmoothPending`, accessibility, localisation and the
licensing boundary — lives in the [root README](../../README.md), which is the
single source of truth for all of it.
