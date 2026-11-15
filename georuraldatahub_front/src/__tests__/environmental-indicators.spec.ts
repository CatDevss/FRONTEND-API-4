import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'
import {
  calculate,
  listFeatures,
  listLayers,
  formatValue,
} from '@/services/environmentalIndicators'
vi.mock('axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }))
beforeEach(() => vi.clearAllMocks())
describe('contratos ambientais', () => {
  it('busca IDs reais e pagina feições no servidor', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { items: [], total: 0, page: 2, size: 20 } })
    await listLayers('municípios', 2)
    expect(axios.get).toHaveBeenCalledWith('/ambiental/camadas', {
      params: { busca: 'municípios', page: 2, size: 20 },
    })
    await listFeatures(19, 'Curitiba', 'NM_MUN', 2)
    expect(axios.get).toHaveBeenLastCalledWith('/ambiental/camadas/19/feicoes', {
      params: { busca: 'Curitiba', campo: 'NM_MUN', page: 2, size: 20 },
    })
  })
  it('envia camadas e datas sem calcular ou arredondar o retorno', async () => {
    const result = { IFC: { quantidade: 2, porMilHa: 0.123456789 } }
    vi.mocked(axios.post).mockResolvedValue({ data: result })
    const params = { focos: [43, 44], inicio: '2021-01-01', fim: '2026-11-15' }
    expect(await calculate(928, 'ifc', params)).toEqual(result)
    expect(axios.post).toHaveBeenCalledWith('/imoveis/928/indicadores/ifc', params, {
      timeout: 310000,
    })
  })
  it('distingue ausência de zero', () => {
    expect(formatValue(0)).toBe('0')
    for (const value of [null, undefined, NaN, ''])
      expect(formatValue(value)).toBe('Não disponível')
  })
})

import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent } from 'vue'
import Panel from '@/components/workspace/WorkspaceIndicators.vue'
const Input = defineComponent({
  name: 'TestInput',
  props: ['modelValue', 'label', 'items', 'disabled'],
  emits: ['update:modelValue'],
  template: '<div>{{ label }}</div>',
})
const Picker = defineComponent({
  name: 'TestPicker',
  props: ['modelValue', 'label'],
  emits: ['update:modelValue', 'layers'],
  template: '<div>{{ label }}</div>',
})
const Button = defineComponent({
  props: ['disabled'],
  template: '<button :disabled="disabled"><slot /></button>',
})
function mountPanel() {
  return mount(Panel, {
    global: {
      stubs: {
        EnvironmentalLayerPicker: Picker,
        EnvironmentalResultActions: true,
        VSelect: Input,
        VTextField: Input,
        VTextarea: Input,
        VBtn: Button,
        VAlert: { template: '<div><slot /></div>' },
        VDivider: true,
      },
    },
  })
}
describe('formulário ambiental', () => {
  it('mostra somente os papéis e parâmetros do indicador escolhido', async () => {
    const panel = mountPanel()
    expect(panel.text()).toContain('Vegetação nativa')
    expect(panel.text()).not.toContain('Data inicial')
    const select = panel
      .findAllComponents({ name: 'TestInput' })
      .find((c) => c.props('label') === 'Indicador')!
    select.vm.$emit('update:modelValue', 'ifc')
    await flushPromises()
    expect(panel.text()).toContain('Focos de calor')
    expect(panel.text()).toContain('Data inicial')
    expect(panel.text()).not.toContain('Fundamento do percentual adotado')
    select.vm.$emit('update:modelValue', 'irl')
    await flushPromises()
    expect(panel.text()).toContain('Fundamento do percentual adotado')
    expect(panel.text()).not.toContain('Data inicial')
    panel.unmount()
  })
  it('calcula apenas após seleção e mantém percentual nulo como indisponível', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        items: [{ id: 928, name: 'Curitiba', attributes: '{"NM_MUN":"Curitiba"}' }],
        total: 1,
        page: 0,
        size: 20,
      },
    })
    vi.mocked(axios.post).mockResolvedValue({
      data: { ICV: { areaHa: 0, percentual: null }, areaImovelHa: 100, fontes: [] },
    })
    const panel = mountPanel()
    expect(
      panel
        .findAll('button')
        .find((b) => b.text() === 'Calcular indicador')!
        .attributes(),
    ).toHaveProperty('disabled')
    panel.findComponent({ name: 'TestPicker' }).vm.$emit('update:modelValue', 19)
    await flushPromises()
    panel
      .findAllComponents({ name: 'TestInput' })
      .find((c) => c.props('label') === 'Feição da área de análise')!
      .vm.$emit('update:modelValue', 928)
    panel.findAllComponents({ name: 'TestPicker' })[1]!.vm.$emit('update:modelValue', [28, 35])
    await flushPromises()
    await panel
      .findAll('button')
      .find((b) => b.text() === 'Calcular indicador')!
      .trigger('click')
    await flushPromises()
    expect(axios.post).toHaveBeenCalledWith(
      '/imoveis/928/indicadores/icv',
      { vegetacao: [28, 35] },
      { timeout: 310000 },
    )
    expect(panel.text()).toContain('Curitiba')
    expect(panel.text()).toContain('Não disponível')
    expect(panel.text()).toContain('0 ha')
    panel.unmount()
  })
})
