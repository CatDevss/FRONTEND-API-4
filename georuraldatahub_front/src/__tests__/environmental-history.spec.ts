import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import axios from 'axios'
import History from '@/components/workspace/EnvironmentalHistory.vue'
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
        VBtn: button,
        VTextField: true,
        VSelect: true,
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
    })
    panel.unmount()
  })
})
