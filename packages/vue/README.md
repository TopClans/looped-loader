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
</script>

<template>
  <LoopedLoader base-url="/looped-clips" />
</template>
```

`base-url` points at the directory that serves the asset package's
`manifest.json` and `clips/`. The full story — both hosting recipes with the
copy commands, the props and events tables, the `#fallback` slot, theming
custom properties, `useSmoothPending`, accessibility, localisation and the
licensing boundary — lives in the [root README](../../README.md), which is the
single source of truth for all of it.
