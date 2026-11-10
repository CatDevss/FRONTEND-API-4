import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { defineComponent, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { AxiosResponse } from 'axios'
import axios from 'axios'
import PageOutlet from '@/components/PageOutlet.vue'
import { setSessionUser } from '@/access/session'
import { trackDataMutation, usePageRefresh } from '@/composables/pageData'
import { useQuarantine } from '@/composables/useQuarantine'

enableAutoUnmount(afterEach)
vi.mock('axios', () => ({ default: { get: vi.fn(), isAxiosError: () => true } }))
const assume = (id = 7, role = 'OPERADOR') =>
  setSessionUser({ id, name: 'Pessoa', userType: role, userStatus: 1 })
function response(method: string, url: string, status = 200) {
  return { config: { method, url }, status } as AxiosResponse
}
beforeEach(() => {
  vi.clearAllMocks()
  assume()
  vi.mocked(axios.get).mockResolvedValue({
    data: { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 },
  })
})
afterEach(() => setSessionUser(null))
async function setup() {
  const mounted = vi.fn(),
    destroyed = vi.fn(),
    refresh = vi.fn()
  const page = (name: string) =>
    defineComponent({
      name,
      setup() {
        const search = ref('')
        onMounted(() => mounted(name))
        onUnmounted(() => destroyed(name))
        usePageRefresh(() => refresh(name))
        return { search }
      },
      template: '<section><input aria-label="Filtro" v-model="search" /></section>',
    })
  const Quarantine = defineComponent({
    name: 'QuarantineView',
    setup: () => useQuarantine(),
    template: '<p>Arquivo: {{ fileId }}</p>',
  })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: page('LoginView') },
      { path: '/sources', component: page('SourcesView'), meta: { permission: 'sources.read' } },
      { path: '/datasets', component: page('DatasetsView'), meta: { permission: 'datasets.read' } },
      { path: '/quarantine', component: Quarantine },
    ],
  })
  await router.push('/sources')
  const root = mount(
    defineComponent({
      components: { PageOutlet },
      template:
        '<nav><router-link to="/sources">Fontes</router-link><router-link to="/datasets">Conjuntos</router-link></nav><PageOutlet />',
    }),
    { global: { plugins: [router] } },
  )
  await flushPromises()
  return { root, router, mounted, destroyed, refresh }
}
describe('page navigation and cached data', () => {
  it('navigates through internal links and returns to the same page and filter without remounting', async () => {
    const { root, router, mounted, destroyed, refresh } = await setup()
    const field = root.find('input').element
    await root.find('input').setValue('IBGE')
    await root.find('a[href="/datasets"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/datasets')
    await root.find('input').setValue('Paraná')
    await root.find('a[href="/sources"]').trigger('click')
    await flushPromises()
    expect(root.find('input').element).toBe(field)
    expect(root.find('input').element).toHaveProperty('value', 'IBGE')
    expect(mounted.mock.calls).toEqual([['SourcesView'], ['DatasetsView']])
    expect(destroyed).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
  })
  it('reuses pages for query changes and browser back navigation', async () => {
    const { root, router, mounted } = await setup()
    await root.find('input').setValue('filtro')
    await router.push('/sources?source=2')
    await flushPromises()
    await router.push('/datasets')
    await flushPromises()
    router.back()
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/sources?source=2')
    expect(root.find('input').element).toHaveProperty('value', 'filtro')
    expect(mounted.mock.calls.filter(([name]) => name === 'SourcesView')).toHaveLength(1)
  })
  it('refreshes on return after successful writes without losing the page state', async () => {
    const { root, router, mounted, refresh } = await setup()
    await root.find('input').setValue('IBGE')
    await router.push('/datasets')
    await flushPromises()
    const saved = response('post', '/fontes', 201)
    expect(trackDataMutation(saved)).toBe(saved)
    await router.push('/sources')
    await flushPromises()
    expect(refresh).toHaveBeenCalledWith('SourcesView')
    expect(root.find('input').element).toHaveProperty('value', 'IBGE')
    await router.push('/datasets')
    await router.push('/sources')
    await flushPromises()
    expect(refresh.mock.calls.filter(([name]) => name === 'SourcesView')).toHaveLength(1)
    expect(mounted.mock.calls.filter(([name]) => name === 'SourcesView')).toHaveLength(1)
  })
  it('does not refresh for normal reads, verification downloads or failed writes', async () => {
    const { router, refresh } = await setup()
    await router.push('/datasets')
    await flushPromises()
    trackDataMutation(response('get', '/fontes'))
    trackDataMutation(response('post', '/fontes/conectores/MMA/verificacao'))
    trackDataMutation(response('put', '/fontes/2', 409))
    await router.push('/sources')
    await flushPromises()
    expect(refresh).not.toHaveBeenCalled()
  })
  it.each(['user', 'role', 'logout'])(
    'clears all cached instances on %s change',
    async (change) => {
      const { root, router, mounted, destroyed } = await setup()
      await root.find('input').setValue('privado')
      await router.push('/datasets')
      await flushPromises()
      if (change === 'user') assume(9)
      else if (change === 'role') assume(7, 'GESTOR')
      else setSessionUser(null)
      await nextTick()
      await flushPromises()
      expect(destroyed).toHaveBeenCalledWith('SourcesView')
      expect(destroyed).toHaveBeenCalledWith('DatasetsView')
      await router.push('/sources')
      await flushPromises()
      if (change === 'logout') {
        expect(root.find('input').exists()).toBe(false)
        expect(mounted.mock.calls.filter(([name]) => name === 'SourcesView')).toHaveLength(1)
      } else {
        expect(root.find('input').element).toHaveProperty('value', '')
        expect(mounted.mock.calls.filter(([name]) => name === 'SourcesView')).toHaveLength(2)
      }
    },
  )
  it('keeps quarantine filters while inactive and handles an explicit file link on return', async () => {
    const { router, root } = await setup()
    await router.push('/quarantine?fileId=99')
    await flushPromises()
    expect(root.text()).toContain('Arquivo: 99')
    const calls = vi.mocked(axios.get).mock.calls.length
    await router.push('/sources?fileId=100')
    await flushPromises()
    expect(axios.get).toHaveBeenCalledTimes(calls)
    await router.push('/quarantine?fileId=99')
    await flushPromises()
    expect(axios.get).toHaveBeenCalledTimes(calls)
    await router.push('/sources')
    await router.push('/quarantine?fileId=101')
    await flushPromises()
    expect(root.text()).toContain('Arquivo: 101')
    expect(axios.get).toHaveBeenLastCalledWith('/quarentenas', {
      params: { page: 0, size: 20, fileId: 101 },
    })
  })
})
