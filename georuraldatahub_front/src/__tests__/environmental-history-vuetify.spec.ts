import { beforeAll, beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import axios from 'axios'
import History from '@/components/workspace/EnvironmentalHistory.vue'
import Reports from '@/components/workspace/EnvironmentalReports.vue'
import { setSessionUser } from '@/access/session'
vi.mock('axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn(), isAxiosError: () => false },
}))
beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return true
    },
  }))
  window.visualViewport ??= {
    width: 1280,
    height: 900,
    addEventListener() {},
    removeEventListener() {},
  } as unknown as VisualViewport
})
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(axios.get).mockImplementation(async (url) => {
    if (url === '/ambiental/camadas') return { data: { items: [], total: 0 } }
    if (String(url).endsWith('/recursos')) return { data: { enabled: true } }
    if (String(url) === '/ambiental/calculos/21')
      return {
        data: {
          calculation: {
            id: 21,
            featureId: 270,
            name: 'Adrianópolis',
            indicator: 'icv',
            calculatedAt: '2026-11-21 12:00:00',
          },
          parameters: {},
          result: { ICV: { areaHa: 0, percentual: null }, calculoId: 21 },
        },
      }
    if (url === '/ambiental/relatorios')
      return {
        data: {
          items: [
            {
              id: 'r',
              name: 'Relatório diário',
              indicator: 'ifc',
              createdAt: '2026-11-21T12:00:00Z',
              completed: 1,
              total: 1,
              failed: 0,
            },
          ],
          total: 1,
        },
      }
    return {
      data: {
        items: [
          {
            id: 21,
            featureId: 270,
            name: 'Adrianópolis',
            indicator: 'icv',
            calculatedAt: '2026-11-21 12:00:00',
            rule: 'TESTE',
          },
        ],
        total: 1,
      },
    }
  })
})
afterEach(() => {
  document.body.innerHTML = ''
  setSessionUser(null)
})
describe('Histórico com componentes reais do Vuetify', () => {
  it('mantém registros visíveis ao alternar repetidamente entre as abas', async () => {
    const errors: unknown[] = []
    const root = defineComponent({
      setup: () => () => h(components.VApp, null, { default: () => h(History) }),
    })
    const wrapper = mount(root, {
      attachTo: document.body,
      global: {
        plugins: [createVuetify({ components, directives })],
        config: {
          errorHandler: (error) => {
            errors.push(error)
          },
        },
      },
    })
    await flushPromises()
    const click = async (label: string) => {
      const button = wrapper.findAll('button').find((button) => button.text() === label)
      expect(button, label).toBeDefined()
      await button!.trigger('click')
      await flushPromises()
      await nextTick()
    }
    expect(wrapper.text()).toContain('Adrianópolis')
    const choose = async (scope: typeof wrapper, label: string) => {
      await scope.find('.v-select .v-field').trigger('mousedown')
      await flushPromises()
      const option = [...document.querySelectorAll('[role="option"]')].find(
        (element) => element.textContent?.trim() === label,
      )
      expect(option, `Opção ${label}`).toBeDefined()
      ;(option as HTMLElement).click()
      await flushPromises()
    }
    const calculationView = wrapper.findComponent(History)
    await choose(calculationView as typeof wrapper, 'IFC · Focos de calor')
    for (let i = 0; i < 5; i++) {
      await click('Execuções salvas')
      expect(
        wrapper
          .findAll('.v-list-item-title')
          .some((item) => item.isVisible() && item.text() === 'Relatório diário'),
      ).toBe(true)
      const reportView = wrapper.findComponent({ name: 'EnvironmentalReports' })
      await choose(
        reportView as typeof wrapper,
        i % 2 ? 'IFC · Focos de calor' : 'Todos os indicadores',
      )
      const search = reportView.findAll('button').find((button) => button.text() === 'Buscar')!
      await search.trigger('click')
      await flushPromises()
      expect(reportView.text()).toContain('Relatório diário')
      await click('Todos os cálculos')
      expect(
        wrapper
          .findAll('.v-list-item-title')
          .some((item) => item.isVisible() && item.text() === 'Adrianópolis'),
      ).toBe(true)
    }
    expect(errors.map((error) => String(error))).toEqual([])
    wrapper.unmount()
  })
  it.skipIf(!process.env.GEORURAL_LIVE_HISTORY)(
    'consulta a API local por XHR com os componentes reais',
    async () => {
      const realAxios = (await vi.importActual<typeof import('axios')>('axios')).default
      vi.mocked(axios.get).mockImplementation((url, config) =>
        realAxios.get(`http://localhost:8080${url}`, { ...config, timeout: 8000 }),
      )
      const errors: unknown[] = []
      const root = defineComponent({
        setup: () => () => h(components.VApp, null, { default: () => h(History) }),
      })
      const wrapper = mount(root, {
        attachTo: document.body,
        global: {
          plugins: [createVuetify({ components, directives })],
          config: {
            errorHandler: (error) => {
              errors.push(error)
            },
          },
        },
      })
      await vi.waitFor(
        () => {
          expect(wrapper.find('.history-calculations').text()).not.toContain('Buscando cálculos')
          expect(wrapper.findAll('.history-tabs button')).toHaveLength(3)
        },
        { timeout: 10000 },
      )
      const titles = () =>
        wrapper
          .findAll('.history-calculations .v-list-item-title')
          .filter((item) => item.isVisible())
          .map((item) => item.text())
      const original = titles()
      expect(original.length).toBeGreaterThan(0)
      for (let i = 0; i < 5; i++) {
        await wrapper.findAll('.history-tabs button')[2]!.trigger('click')
        await flushPromises()
        await wrapper.findAll('.history-tabs button')[0]!.trigger('click')
        await flushPromises()
        const scope = wrapper.find('.history-calculations')
        await scope.find('.v-select .v-field').trigger('mousedown')
        await flushPromises()
        const label = i % 2 ? 'Todos os indicadores' : 'IFC · Focos de calor'
        const option = [...document.querySelectorAll('[role="option"]')].find(
          (element) => element.textContent?.trim() === label,
        )
        expect(option).toBeDefined()
        ;(option as HTMLElement).click()
        await vi.waitFor(() => expect(scope.text()).not.toContain('Buscando cálculos'), {
          timeout: 10000,
        })
        const search = scope.findAll('button').find((button) => button.text() === 'Buscar')!
        await search.trigger('click')
        await vi.waitFor(() => expect(scope.text()).not.toContain('Buscando cálculos'), {
          timeout: 10000,
        })
        expect(scope.find('.v-alert').exists()).toBe(false)
        expect(titles()).toEqual(original)
      }
      expect(errors.map(String)).toEqual([])
      wrapper.unmount()
    },
  )
  it('confirma a exclusão com o diálogo real nas duas listas', async () => {
    setSessionUser({ id: 4, name: 'Operador', userType: 'OPERADOR', userStatus: 1 })
    vi.mocked(axios.delete).mockResolvedValue({ status: 204 })
    vi.mocked(axios.get).mockImplementation(async (url) => ({
      data: String(url).endsWith('/recursos')
        ? { enabled: true, deletionEnabled: true, calculationDeletionEnabled: true }
        : {
            items: String(url).includes('/calculos')
              ? [
                  {
                    id: 21,
                    name: 'Área teste',
                    indicator: 'ifc',
                    calculatedAt: '2026-11-21 12:00:00',
                  },
                ]
              : [
                  {
                    id: 'r',
                    name: 'Relatório teste',
                    indicator: 'ifc',
                    createdAt: '2026-11-21T12:00:00Z',
                    total: 1,
                    completed: 1,
                    failed: 0,
                  },
                ],
            total: 1,
          },
    }))
    for (const kind of ['report', 'calculation']) {
      const errors: unknown[] = []
      const root = defineComponent({
        setup: () => () =>
          h(components.VApp, null, {
            default: () => (kind === 'report' ? h(Reports) : h(History)),
          }),
      })
      const panel = mount(root, {
        attachTo: document.body,
        global: {
          plugins: [createVuetify({ components, directives })],
          config: { errorHandler: (error) => errors.push(error) },
        },
      })
      await flushPromises()
      await panel
        .findAll('button')
        .find((button) => button.text() === 'Excluir')!
        .trigger('click')
      await flushPromises()
      const confirm = [...document.querySelectorAll('button')].find(
        (button) => button.textContent?.trim() === 'Confirmar',
      )!
      expect(confirm).toBeDefined()
      confirm.click()
      await flushPromises()
      expect(axios.delete).toHaveBeenLastCalledWith(
        kind === 'report' ? '/ambiental/relatorios/r' : '/ambiental/calculos/21',
        { params: { usuarioId: 4 }, timeout: 30000 },
      )
      expect(panel.text()).toContain('auditoria')
      expect(errors.map(String)).toEqual([])
      panel.unmount()
    }
  })
  it('exibe os 23 cálculos IFC antigos mesmo sem grupos cadastrados', async () => {
    const records = Array.from({ length: 23 }, (_, index) => ({
      id: index + 1,
      featureId: 90 + index,
      name: `Área antiga ${index + 1}`,
      indicator: 'ifc',
      calculatedAt: '2026-11-21 12:00:00',
    }))
    vi.mocked(axios.get).mockImplementation(async (url, config) => {
      if (url === '/ambiental/camadas') return { data: { items: [], total: 0 } }
      if (String(url).endsWith('/recursos')) return { data: { enabled: true } }
      if (url === '/ambiental/relatorios') return { data: { items: [], total: 0 } }
      if (url === '/ambiental/calculos') {
        const page = Number((config?.params as { page?: number } | undefined)?.page ?? 0)
        return { data: { items: records.slice(page * 20, page * 20 + 20), total: 23 } }
      }
      const id = Number(String(url).split('/').pop())
      return {
        data: {
          calculation: records[id - 1],
          parameters: { focos: [43], inicio: '2026-10-20', fim: '2026-10-20' },
          result: { IFC: { quantidade: id, porMilHa: null }, regra: 'ORACLE' },
        },
      }
    })
    const errors: unknown[] = []
    const root = defineComponent({
      setup: () => () =>
        h(components.VApp, null, { default: () => h(Reports, { view: 'history' }) }),
    })
    const panel = mount(root, {
      attachTo: document.body,
      global: {
        plugins: [createVuetify({ components, directives })],
        config: { errorHandler: (error) => errors.push(error) },
      },
    })
    await flushPromises()
    await panel.find('.v-select .v-field').trigger('mousedown')
    await flushPromises()
    const option = [...document.querySelectorAll('[role="option"]')].find(
      (element) => element.textContent?.trim() === 'IFC · Focos de calor',
    )!
    ;(option as HTMLElement).click()
    await flushPromises()
    await panel
      .findAll('button')
      .find((button) => button.text() === 'Buscar')!
      .trigger('click')
    await flushPromises()
    expect(panel.text()).toContain('IFC · Focos de calor · 23 cálculo(s)')
    expect(panel.findAll('tbody tr')).toHaveLength(20)
    expect(panel.text()).toContain('2026-10-20 a 2026-10-20')
    expect(panel.text()).toContain('CSV de todas as áreas')
    await panel
      .findAll('.batch-pages button')
      .find((button) => button.text() === 'Próxima')!
      .trigger('click')
    await flushPromises()
    expect(panel.findAll('tbody tr')).toHaveLength(3)
    await panel
      .findAll('button')
      .find((button) => button.text() === 'Buscar')!
      .trigger('click')
    await flushPromises()
    expect(panel.findAll('tbody tr')).toHaveLength(20)
    expect(panel.find('.batch-pages').text()).toContain('Página 1')
    expect(axios.post).not.toHaveBeenCalled()
    expect(errors.map(String)).toEqual([])
    panel.unmount()
  })
  it.skipIf(!process.env.GEORURAL_LIVE_HISTORY)(
    'agrupa o histórico IFC real sem exigir grupos salvos',
    async () => {
      const realAxios = (await vi.importActual<typeof import('axios')>('axios')).default
      const baseline = (
        await realAxios.get('http://localhost:8080/ambiental/calculos', {
          params: { indicador: 'ifc', page: 0, size: 20 },
          timeout: 10000,
        })
      ).data
      expect(baseline.total).toBeGreaterThan(0)
      vi.mocked(axios.get).mockImplementation((url, config) =>
        realAxios.get(`http://localhost:8080${url}`, { ...config, timeout: 30000 }),
      )
      const errors: unknown[] = []
      const root = defineComponent({
        setup: () => () =>
          h(components.VApp, null, { default: () => h(Reports, { view: 'history' }) }),
      })
      const panel = mount(root, {
        attachTo: document.body,
        global: {
          plugins: [createVuetify({ components, directives })],
          config: { errorHandler: (error) => errors.push(error) },
        },
      })
      await flushPromises()
      await vi.waitFor(
        () => {
          expect(panel.text()).not.toContain('Buscando relatórios')
          expect(
            panel
              .findAll('button')
              .find((button) => button.text() === 'Buscar')!
              .attributes('disabled'),
          ).toBeUndefined()
        },
        { timeout: 10000 },
      )
      await panel.find('.v-select .v-field').trigger('mousedown')
      await flushPromises()
      const option = await vi.waitFor(() => {
        const item = [...document.querySelectorAll('[role="option"]')].find(
          (element) => element.textContent?.trim() === 'IFC · Focos de calor',
        )
        expect(item).toBeDefined()
        return item!
      })
      ;(option as HTMLElement).click()
      await flushPromises()
      await panel
        .findAll('button')
        .find((button) => button.text() === 'Buscar')!
        .trigger('click')
      await vi.waitFor(
        () =>
          expect(panel.find('[aria-label="Relatório dos cálculos existentes"]').text()).toContain(
            `IFC · Focos de calor · ${baseline.total} cálculo(s)`,
          ),
        { timeout: 30000 },
      )
      expect(panel.findAll('tbody tr')).toHaveLength(Math.min(20, baseline.total))
      const dates = panel.findAll('input[type="date"]')
      await dates[0]!.setValue('2099-01-01')
      await dates[1]!.setValue('2099-01-01')
      await panel
        .findAll('button')
        .find((button) => button.text() === 'Buscar')!
        .trigger('click')
      await vi.waitFor(
        () => expect(panel.text()).toContain('Nenhum cálculo salvo corresponde aos filtros'),
        { timeout: 30000 },
      )
      expect(panel.findAll('tbody tr')).toHaveLength(0)
      await dates[0]!.setValue('')
      await dates[1]!.setValue('')
      await panel
        .findAll('button')
        .find((button) => button.text() === 'Buscar')!
        .trigger('click')
      await vi.waitFor(
        () => expect(panel.findAll('tbody tr')).toHaveLength(Math.min(20, baseline.total)),
        { timeout: 30000 },
      )
      expect(axios.post).not.toHaveBeenCalled()
      expect(errors.map(String)).toEqual([])
      panel.unmount()
    },
  )
})
