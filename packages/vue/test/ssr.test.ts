import { renderToString } from 'vue/server-renderer'
import { createSSRApp } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import LoopedLoader from '../src/LoopedLoader.vue'

describe('server rendering', () => {
  it('renders the spinner and the label without picking or fetching anything', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const app = createSSRApp(LoopedLoader, { baseUrl: '/clips', label: 'Загрузка' })
    const html = await renderToString(app)
    expect(html).toContain('role="status"')
    expect(html).toContain('Загрузка')
    expect(html).not.toContain('<video')
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
