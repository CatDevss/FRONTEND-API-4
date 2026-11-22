import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import axios from 'axios'
import History from '@/components/workspace/EnvironmentalHistory.vue'
import Reports from '@/components/workspace/EnvironmentalReports.vue'
vi.mock('axios', () => ({ default: { get: vi.fn(), post: vi.fn(), isAxiosError: () => false } }))
const box = { template: '<div><slot /></div>' }
const button = { props: ['disabled'], template: '<button :disabled="disabled"><slot /></button>' }
const entry = {
  id: 21,
  featureId: 270,
  name: 'Adrianópolis',
  indicator: 'icv',
  calculatedAt: '2026-11-15 16:11:50',
  rule: 'GEORURAL-1.2',
}
beforeEach(() => vi.clearAllMocks())
function setup() {
  return mount(History, {
    global: {
      stubs: {
        EnvironmentalHistoryReport: true,
        EnvironmentalHistoryFilters: true,
        VBtn: button,
        VTextField: { props: ['modelValue', 'label'], template: '<div />' },
        VSelect: {
          name: 'VSelect',
          props: ['modelValue', 'items', 'menu'],
          emits: ['update:modelValue', 'update:menu'],
          template: '<div />',
        },
        VAlert: box,
        VList: box,
        VListItem: {
          props: ['title', 'subtitle'],
          template: '<div>{{title}} {{subtitle}}<slot name="append" /></div>',
        },
        EnvironmentalResultActions: {
          props: ['snapshot'],
          template: '<div class="export-snapshot">{{snapshot.result.calculoId}}</div>',
        },
      },
    },
  })
}
describe('histórico ambiental', () => {
  it('abre o resultado salvo e volta à lista sem recalcular', async () => {
    vi.mocked(axios.get).mockImplementation(async (url) => ({
      data: String(url).endsWith('/21')
        ? {
            calculation: entry,
            parameters: { vegetacao: [2] },
            result: {
              ICV: { areaHa: 0, percentual: null },
              areaImovelHa: 100,
              calculoId: 21,
              fontes: [],
            },
          }
        : { items: [entry], total: 1, page: 0, size: 20 },
    }))
    const panel = setup()
    await flushPromises()
    expect(panel.text()).toContain('Adrianópolis')
    await panel
      .findAll('button')
      .find((b) => b.text() === 'Abrir')!
      .trigger('click')
    await flushPromises()
    expect(axios.get).toHaveBeenCalledWith('/ambiental/calculos/21')
    expect(panel.text()).toContain('Não disponível')
    expect(panel.find('.export-snapshot').text()).toBe('21')
    expect(axios.post).not.toHaveBeenCalled()
    await panel
      .findAll('button')
      .find((b) => b.text() === 'Voltar ao histórico')!
      .trigger('click')
    expect(panel.text()).toContain('Cálculos salvos')
    panel.unmount()
  })
  it('pagina no servidor, sem baixar todo o histórico', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: { items: [entry], total: 21, page: 0, size: 20 },
    })
    const panel = setup()
    await flushPromises()
    await panel
      .findAll('button')
      .find((b) => b.text() === 'Próxima')!
      .trigger('click')
    await flushPromises()
    expect(axios.get).toHaveBeenLastCalledWith('/ambiental/calculos', {
      params: { busca: '', indicador: '', page: 1, size: 20 },
      timeout: 30000,
      signal: expect.any(AbortSignal),
    })
    panel.unmount()
  })
  it('todos os indicadores remove o filtro e mantém o seletor fechado', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { items: [entry], total: 1 } })
    const panel = setup()
    await flushPromises()
    const select = panel.findComponent({ name: 'VSelect' })
    expect(select.props('items')).toContainEqual({ title: 'Todos os indicadores', value: '' })
    select.vm.$emit('update:modelValue', 'ifc')
    await flushPromises()
    await panel
      .findAll('button')
      .find((button) => button.text() === 'Buscar' && button.isVisible())!
      .trigger('click')
    await flushPromises()
    expect(axios.get).toHaveBeenLastCalledWith(
      '/ambiental/calculos',
      expect.objectContaining({ params: { busca: '', indicador: 'ifc', page: 0, size: 20 } }),
    )
    select.vm.$emit('update:modelValue', '')
    await flushPromises()
    await panel
      .findAll('button')
      .find((button) => button.text() === 'Buscar' && button.isVisible())!
      .trigger('click')
    await flushPromises()
    expect(axios.get).toHaveBeenLastCalledWith(
      '/ambiental/calculos',
      expect.objectContaining({ params: { busca: '', indicador: '', page: 0, size: 20 } }),
    )
    expect(select.props('menu')).toBe(false)
    panel.unmount()
  })
  it('mantém cálculos antigos visíveis quando relatórios estão disponíveis', async () => {
    vi.mocked(axios.get).mockImplementation(async (url) => ({
      data: String(url).endsWith('/recursos') ? { enabled: true } : { items: [entry], total: 1 },
    }))
    const panel = setup()
    await flushPromises()
    expect(panel.text()).toContain('Cálculos salvos')
    expect(panel.text()).toContain('Adrianópolis')
    expect(panel.text()).toContain('Execuções salvas')
    panel.unmount()
  })
  it('exibe aviso e libera nova busca após timeout', async () => {
    vi.mocked(axios.get).mockRejectedValue({ code: 'ECONNABORTED' })
    const panel = setup()
    await flushPromises()
    expect(panel.text()).toContain('A busca demorou mais que o esperado')
    const search = panel.findAll('button').find((button) => button.text() === 'Buscar')!
    expect(search.attributes('disabled')).toBeUndefined()
    panel.unmount()
  })
  it('consulta relatórios agrupados com o mesmo filtro vazio para todos', async () => {
    vi.mocked(axios.get).mockImplementation(async (url) => ({
      data: String(url).endsWith('/recursos') ? { enabled: true } : { items: [], total: 0 },
    }))
    const panel = setup()
    await flushPromises()
    await panel
      .findAll('button')
      .find((button) => button.text() === 'Execuções salvas')!
      .trigger('click')
    await flushPromises()
    expect(panel.text()).toContain('Cada execução reúne as áreas escolhidas')
    const select = panel.findComponent(Reports).findComponent({ name: 'VSelect' })
    select.vm.$emit('update:modelValue', 'ifc')
    await flushPromises()
    await panel
      .findAll('button')
      .find((button) => button.text() === 'Buscar' && button.isVisible())!
      .trigger('click')
    await flushPromises()
    expect(axios.get).toHaveBeenLastCalledWith(
      '/ambiental/relatorios',
      expect.objectContaining({
        params: { busca: '', indicador: 'ifc', page: 0, size: 20 },
        timeout: 30000,
      }),
    )
    select.vm.$emit('update:modelValue', '')
    await flushPromises()
    await panel
      .findAll('button')
      .find((button) => button.text() === 'Buscar' && button.isVisible())!
      .trigger('click')
    await flushPromises()
    expect(axios.get).toHaveBeenLastCalledWith(
      '/ambiental/relatorios',
      expect.objectContaining({ params: { busca: '', indicador: '', page: 0, size: 20 } }),
    )
    expect(select.props('menu')).toBe(false)
    panel.unmount()
  })
  it('preserva listas ao alternar várias vezes sem refazer a busca', async () => {
    const saved = {
      id: 'r',
      name: 'Relatório IFC diário',
      indicator: 'ifc',
      createdAt: '2026-11-21T12:00:00Z',
      completed: 1,
      total: 1,
      failed: 0,
    }
    let reportReads = 0
    vi.mocked(axios.get).mockImplementation(async (url) => {
      if (String(url).endsWith('/recursos')) return { data: { enabled: true } }
      if (String(url) === '/ambiental/relatorios') {
        reportReads++
        if (reportReads > 1) return new Promise(() => {})
        return { data: { items: [saved], total: 1 } }
      }
      return { data: { items: [entry], total: 1 } }
    })
    const panel = setup()
    const tab = (name: string) => panel.findAll('button').find((button) => button.text() === name)!
    await flushPromises()
    for (let i = 0; i < 5; i++) {
      await tab('Execuções salvas').trigger('click')
      await flushPromises()
      expect(panel.findComponent(Reports).text()).toContain(saved.name)
      expect(panel.findComponent(Reports).isVisible()).toBe(true)
      await tab('Todos os cálculos').trigger('click')
      await flushPromises()
      expect(panel.text()).toContain(entry.name)
    }
    expect(reportReads).toBe(1)
    panel.unmount()
  })
  it('preserva a resposta de uma busca lenta durante trocas rápidas de aba', async () => {
    let finish!: (value: unknown) => void
    const pending = new Promise((resolve) => {
      finish = resolve
    })
    vi.mocked(axios.get).mockImplementation(async (url) => {
      if (String(url).endsWith('/recursos')) return { data: { enabled: true } }
      if (String(url) === '/ambiental/relatorios') return pending as Promise<never>
      return { data: { items: [entry], total: 1 } }
    })
    const panel = setup()
    const tab = (name: string) => panel.findAll('button').find((button) => button.text() === name)!
    await flushPromises()
    await tab('Execuções salvas').trigger('click')
    await tab('Todos os cálculos').trigger('click')
    await tab('Execuções salvas').trigger('click')
    finish({
      data: {
        items: [
          {
            id: 'r',
            name: 'Relatório recebido depois',
            createdAt: '2026-11-21T12:00:00Z',
            total: 1,
            completed: 1,
            failed: 0,
          },
        ],
        total: 1,
      },
    })
    await flushPromises()
    expect(panel.findComponent(Reports).text()).toContain('Relatório recebido depois')
    expect(
      vi.mocked(axios.get).mock.calls.filter(([url]) => url === '/ambiental/relatorios'),
    ).toHaveLength(1)
    panel.unmount()
  })
  it('mantém filtros independentes e fecha o menu ao sair da aba', async () => {
    vi.mocked(axios.get).mockImplementation(async (url) => ({
      data: String(url).endsWith('/recursos') ? { enabled: true } : { items: [], total: 0 },
    }))
    const panel = setup()
    const tab = (name: string) => panel.findAll('button').find((button) => button.text() === name)!
    await flushPromises()
    const calculationSelect = panel.findComponent({ name: 'VSelect' })
    calculationSelect.vm.$emit('update:modelValue', 'icv')
    await flushPromises()
    await tab('Execuções salvas').trigger('click')
    await flushPromises()
    const reports = panel.findComponent(Reports)
    const reportSelect = reports.findComponent({ name: 'VSelect' })
    reportSelect.vm.$emit('update:modelValue', 'ifc')
    reportSelect.vm.$emit('update:menu', true)
    await flushPromises()
    await tab('Todos os cálculos').trigger('click')
    await flushPromises()
    expect(reportSelect.props('menu')).toBe(false)
    expect(calculationSelect.props('modelValue')).toBe('icv')
    await tab('Execuções salvas').trigger('click')
    await flushPromises()
    expect(reports.findComponent({ name: 'VSelect' }).props('modelValue')).toBe('ifc')
    panel.unmount()
  })
  it('preserva a lista anterior quando a atualização falha e informa o tipo do erro', async () => {
    vi.mocked(axios.get).mockImplementation(async (url) => ({
      data: String(url).endsWith('/recursos') ? { enabled: true } : { items: [entry], total: 1 },
    }))
    const panel = setup()
    await flushPromises()
    vi.mocked(axios.get).mockRejectedValue({ code: 'ERR_NETWORK' })
    await panel
      .findAll('button')
      .find((button) => button.text() === 'Buscar')!
      .trigger('click')
    await flushPromises()
    expect(panel.text()).toContain('Adrianópolis')
    expect(panel.text()).toContain('Não foi possível obter resposta do backend')
    expect(panel.text()).toContain('Os resultados da última busca concluída foram mantidos')
    expect(panel.text()).not.toContain('Nenhum cálculo salvo encontrado')
    panel.unmount()
  })
  it('não consulta a API ao escolher um filtro e não duplica buscas pendentes', async () => {
    let finish!: (value: unknown) => void
    vi.mocked(axios.get).mockImplementation(async (url) => ({
      data: String(url).endsWith('/recursos') ? { enabled: false } : { items: [entry], total: 1 },
    }))
    const panel = setup()
    await flushPromises()
    const before = vi.mocked(axios.get).mock.calls.length
    panel.findComponent({ name: 'VSelect' }).vm.$emit('update:modelValue', 'ifc')
    await flushPromises()
    expect(axios.get).toHaveBeenCalledTimes(before)
    vi.mocked(axios.get).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const button = panel.findAll('button').find((button) => button.text() === 'Buscar')!
    await button.trigger('click')
    await button.trigger('click')
    expect(axios.get).toHaveBeenCalledTimes(before + 1)
    finish({ data: { items: [entry], total: 1 } })
    await flushPromises()
    expect(panel.text()).toContain(entry.name)
    panel.unmount()
  })
})
