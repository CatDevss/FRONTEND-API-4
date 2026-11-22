import { beforeEach, describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import axios from 'axios'
import History from '@/components/workspace/EnvironmentalHistory.vue'
import Reports from '@/components/workspace/EnvironmentalReports.vue'
import Filters from '@/components/workspace/EnvironmentalHistoryFilters.vue'
import { historyFilterError } from '@/services/environmentalHistoryFilters'
import { historicalReport } from '@/services/environmentalHistoryReport'

vi.mock('axios', () => ({ default: { get: vi.fn(), isAxiosError: () => false } }))
const box = { template: '<div><slot /><slot name="append" /></div>' }
const stubs = {
  EnvironmentalHistoryFilters: true,
  EnvironmentalHistoryReport: true,
  VBtn: { props: ['disabled'], template: '<button :disabled="disabled"><slot /></button>' },
  VTextField: { template: '<div />' },
  VSelect: { name: 'VSelect', props: ['modelValue'], template: '<div />' },
  VList: box,
  VListItem: box,
  VAlert: box,
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(axios.get).mockImplementation(async (url) => ({
    data: String(url).endsWith('/recursos') ? { enabled: true } : { items: [], total: 21 },
  }))
})
describe('Filtros de período e camada do histórico', () => {
  it('valida datas reais, limites abertos e ordem do período', () => {
    expect(historyFilterError({})).toBe('')
    expect(historyFilterError({ inicio: '2024-02-29' })).toBe('')
    expect(historyFilterError({ inicio: '2026-02-29' })).toContain('válida')
    expect(historyFilterError({ fim: '0000-01-01' })).toContain('válida')
    expect(historyFilterError({ inicio: '2026-10-21', fim: '2026-10-20' })).toContain('anterior')
  })
  for (const component of [History, Reports])
    it(`aplica filtros ao buscar e mantém a busca concluída na paginação: ${component.__name}`, async () => {
      const panel = mount(component, { global: { stubs } })
      await flushPromises()
      const filters = panel.findComponent(Filters)
      filters.vm.$emit('update:modelValue', {
        camadaId: 8,
        inicio: '2026-10-20',
        fim: '2026-10-20',
      })
      panel.findComponent({ name: 'VSelect' }).vm.$emit('update:modelValue', 'ifc')
      await flushPromises()
      const previous = vi.mocked(axios.get).mock.calls.length
      expect(axios.get).toHaveBeenCalledTimes(previous)
      const click = async (label: string) => {
        await panel
          .findAll('button')
          .find((b) => b.text() === label)!
          .trigger('click')
        await flushPromises()
      }
      await click('Buscar')
      const url = component === History ? '/ambiental/calculos' : '/ambiental/relatorios'
      expect(axios.get).toHaveBeenLastCalledWith(
        url,
        expect.objectContaining({
          params: {
            busca: '',
            indicador: 'ifc',
            page: 0,
            size: 20,
            camadaId: 8,
            inicio: '2026-10-20',
            fim: '2026-10-20',
          },
        }),
      )
      filters.vm.$emit('update:modelValue', { inicio: '2026-10-21', fim: '2026-10-20' })
      await flushPromises()
      await click('Próxima')
      expect(axios.get).toHaveBeenLastCalledWith(
        url,
        expect.objectContaining({
          params: expect.objectContaining({ page: 1, camadaId: 8, inicio: '2026-10-20' }),
        }),
      )
      const count = vi.mocked(axios.get).mock.calls.length
      await click('Buscar')
      expect(axios.get).toHaveBeenCalledTimes(count)
      expect(panel.text()).toContain('anterior ou igual')
      panel.unmount()
    })
  it('encaminha os filtros para todas as páginas do relatório do histórico', async () => {
    const records = [
      { id: 1, featureId: 90, name: 'Área', indicator: 'ifc' },
      { id: 2, featureId: 91, name: 'Área 2', indicator: 'ifc' },
    ]
    vi.mocked(axios.get).mockImplementation(async (url, config) => {
      if (url === '/ambiental/calculos') {
        const page = Number((config?.params as { page?: number })?.page ?? 0)
        return { data: { items: [records[page]], total: 2 } }
      }
      return {
        data: {
          calculation: records[Number(String(url).split('/').pop()) - 1],
          parameters: {},
          result: { IFC: { quantidade: 0 } },
        },
      }
    })
    const filters = { camadaId: 8, inicio: '2026-10-20', fim: '2026-10-20' }
    const groups = await historicalReport(
      '',
      'ifc',
      new AbortController().signal,
      () => {},
      filters,
    )
    expect(groups[0]?.entries).toHaveLength(2)
    const calls = vi.mocked(axios.get).mock.calls.filter(([url]) => url === '/ambiental/calculos')
    expect(calls).toHaveLength(2)
    for (const [, config] of calls) expect(config?.params).toMatchObject(filters)
  })
  it('separa relatório do histórico e execuções salvas sem consultas cruzadas', async () => {
    const panel = mount(Reports, { props: { view: 'history' }, global: { stubs } })
    await flushPromises()
    expect(axios.get).not.toHaveBeenCalled()
    await panel
      .findAll('button')
      .find((b) => b.text() === 'Buscar')!
      .trigger('click')
    await flushPromises()
    expect(panel.findComponent({ name: 'EnvironmentalHistoryReport' }).exists()).toBe(true)
    expect(axios.get).not.toHaveBeenCalled()
    expect(panel.text()).not.toContain('Nenhuma execução encontrada')
    expect(panel.text()).not.toContain('0 execuções')
    panel.unmount()
  })
})
