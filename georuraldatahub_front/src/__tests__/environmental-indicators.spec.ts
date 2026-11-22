import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'
import {
  calculate,
  calculateAndSave,
  importLayer,
  listFeatures,
  listLayers,
  formatValue,
} from '@/services/environmentalIndicators'
vi.mock('axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }))
beforeEach(() => vi.clearAllMocks())
describe('contratos ambientais', () => {
  it('solicita reparo apenas quando o usuário permite', async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { camadaId: 1, quantidade: 3 } })
    await importLayer(2, 9)
    expect(axios.post).toHaveBeenLastCalledWith('/conjuntos/2/versoes/9/camada-oracle', undefined, {
      timeout: 310000,
    })
    await importLayer(2, 9, true)
    expect(axios.post).toHaveBeenLastCalledWith('/conjuntos/2/versoes/9/camada-oracle', undefined, {
      timeout: 310000,
      params: { corrigirGeometria: true },
    })
  })
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
  it('salva o indicador escolhido sem exigir todos os insumos', async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { IFC: { quantidade: 273 }, calculoId: 7 } })
    const params = { focos: [43], inicio: '2021-01-01', fim: '2026-11-15' }
    const result = await calculateAndSave(928, 'ifc', params)
    expect(result.calculoId).toBe(7)
    expect(axios.post).toHaveBeenCalledWith('/imoveis/928/indicadores/ifc/calcular', params, {
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
        VAutocomplete: Input,
        VTextField: Input,
        VTextarea: Input,
        VBtn: Button,
        VAlert: { template: '<div><slot /></div>' },
        VDivider: true,
        VProgressLinear: true,
        VDialog: { props: ['modelValue'], template: '<div v-if="modelValue"><slot /></div>' },
        VCard: { template: '<div><slot /></div>' },
        VCardText: { template: '<div><slot /></div>' },
        VCardActions: { template: '<div><slot /></div>' },
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
    expect(panel.text()).toContain('Data do boletim')
    expect(panel.text()).not.toContain('Data final (inclusiva)')
    panel
      .findAllComponents({ name: 'TestInput' })
      .find((c) => c.props('label') === 'Intervalo dos focos de calor')!
      .vm.$emit('update:modelValue', 'range')
    await flushPromises()
    expect(panel.text()).toContain('Data inicial')
    expect(panel.text()).toContain('Data final (inclusiva)')
    expect(panel.text()).not.toContain('Fundamento do percentual adotado')
    select.vm.$emit('update:modelValue', 'irl')
    await flushPromises()
    expect(panel.text()).toContain('Fundamento do percentual adotado')
    expect(panel.text()).not.toContain('Data inicial')
    panel.unmount()
  })
  it('preenche o boletim com a data dos registros e avisa quando outro dia não tem dados', async () => {
    vi.mocked(axios.get).mockImplementation(async (url) => ({
      data: String(url).endsWith('/dados')
        ? {
            layerId: 43,
            days: [{ date: '2026-10-20', records: 3 }],
            records: 3,
            undatedRecords: 0,
            repairedFeatures: 0,
            repairs: [],
          }
        : { enabled: false, items: [], total: 0 },
    }))
    const panel = mountPanel()
    const input = (label: string) =>
      panel.findAllComponents({ name: 'TestInput' }).find((c) => c.props('label') === label)!
    input('Indicador').vm.$emit('update:modelValue', 'ifc')
    await flushPromises()
    panel.findAllComponents({ name: 'TestPicker' })[1]!.vm.$emit('update:modelValue', [43])
    await flushPromises()
    expect(input('Data do boletim').props('modelValue')).toBe('2026-10-20')
    expect(panel.text()).toContain('Dias com registros não comprovam cobertura contínua')
    input('Data do boletim').vm.$emit('update:modelValue', '2026-10-21')
    await flushPromises()
    expect(panel.text()).toContain('As camadas selecionadas não têm registros neste período')
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
        .find((b) => b.text() === 'Prévia sem salvar')!
        .attributes(),
    ).toHaveProperty('disabled')
    panel.findComponent({ name: 'TestPicker' }).vm.$emit('update:modelValue', 19)
    await flushPromises()
    panel
      .findAllComponents({ name: 'TestInput' })
      .find((c) => c.props('label') === 'Buscar área pelo nome')!
      .vm.$emit('update:modelValue', 928)
    panel.findAllComponents({ name: 'TestPicker' })[1]!.vm.$emit('update:modelValue', [28, 35])
    await flushPromises()
    await panel
      .findAll('button')
      .find((b) => b.text() === 'Prévia sem salvar')!
      .trigger('click')
    await flushPromises()
    expect(axios.post).toHaveBeenCalledWith(
      '/imoveis/928/indicadores/icv',
      { vegetacao: [28, 35] },
      { timeout: 310000 },
    )
    expect(panel.text()).toContain('Curitiba')
    expect(panel.text()).toContain('Confira antes de calcular')
    expect(panel.text()).toContain('Não disponível')
    expect(panel.text()).toContain('0')
    expect(panel.text()).toContain('ha')
    expect(panel.text()).toContain('Prévia · não salva')
    vi.mocked(axios.post).mockResolvedValue({
      data: { ICV: { areaHa: 0, percentual: null }, areaImovelHa: 100, fontes: [], calculoId: 17 },
    })
    await panel
      .findAll('button')
      .find((b) => b.text() === '2 · Dados')!
      .trigger('click')
    await panel
      .findAll('button')
      .find((b) => b.text() === 'Calcular e salvar')!
      .trigger('click')
    await flushPromises()
    expect(axios.post).toHaveBeenLastCalledWith(
      '/imoveis/928/indicadores/icv/calcular',
      { vegetacao: [28, 35] },
      { timeout: 310000 },
    )
    expect(panel.text()).toContain('Salvo no histórico · #17')
    expect(panel.findAll('button').some((b) => b.text() === 'Voltar aos dados')).toBe(true)
    await panel
      .findAll('button')
      .find((b) => b.text() === 'Novo cálculo')!
      .trigger('click')
    await flushPromises()
    expect(panel.findAllComponents({ name: 'TestPicker' })[0]!.props('modelValue')).toBe(null)
    expect(
      panel
        .findAll('button')
        .find((b) => b.text() === 'Continuar')!
        .attributes(),
    ).toHaveProperty('disabled')
    expect(panel.text()).not.toContain('Salvo no histórico · #17')

    panel.unmount()
  })
  it('envia a mesma data como início e fim no boletim diário de focos', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        items: [{ id: 7, name: 'Apucarana', attributes: null }],
        total: 1,
        page: 0,
        size: 20,
      },
    })
    vi.mocked(axios.post).mockResolvedValue({ data: { IFC: { quantidade: 0 }, calculoId: 12 } })
    const panel = mountPanel()
    const input = (label: string) =>
      panel.findAllComponents({ name: 'TestInput' }).find((c) => c.props('label') === label)!
    input('Indicador').vm.$emit('update:modelValue', 'ifc')
    panel.findComponent({ name: 'TestPicker' }).vm.$emit('update:modelValue', 19)
    await flushPromises()
    input('Buscar área pelo nome').vm.$emit('update:modelValue', 7)
    panel.findAllComponents({ name: 'TestPicker' })[1]!.vm.$emit('update:modelValue', [43])
    input('Data do boletim').vm.$emit('update:modelValue', '2026-10-20')
    await flushPromises()
    await panel
      .findAll('button')
      .find((b) => b.text() === 'Calcular e salvar')!
      .trigger('click')
    await flushPromises()
    expect(axios.post).toHaveBeenCalledWith(
      '/imoveis/7/indicadores/ifc/calcular',
      { focos: [43], inicio: '2026-10-20', fim: '2026-10-20' },
      { timeout: 310000 },
    )
    expect(panel.text()).not.toContain('Ajustar campo do nome')
    panel.unmount()
  })
  it('calcula as áreas selecionadas separadamente e preserva os nomes no relatório', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        items: [
          { id: 7, name: 'Apucarana', attributes: null },
          { id: 8, name: 'Vera Tupã’i', attributes: null },
        ],
        total: 2,
        page: 0,
        size: 20,
      },
    })
    vi.mocked(axios.post).mockResolvedValue({ data: { ICV: { percentual: 10 }, calculoId: 12 } })
    const panel = mountPanel()
    panel.findComponent({ name: 'TestPicker' }).vm.$emit('update:modelValue', 19)
    await flushPromises()
    panel
      .findAllComponents({ name: 'TestInput' })
      .find((c) => c.props('label') === 'Áreas do relatório')!
      .vm.$emit('update:modelValue', 'multiple')
    await flushPromises()
    panel
      .findAllComponents({ name: 'TestInput' })
      .find((c) => c.props('label') === 'Buscar área pelo nome')!
      .vm.$emit('update:modelValue', [7, 8])
    panel.findAllComponents({ name: 'TestPicker' })[1]!.vm.$emit('update:modelValue', [43])
    await flushPromises()
    await panel
      .findAll('button')
      .find((b) => b.text() === 'Calcular e salvar')!
      .trigger('click')
    await flushPromises()
    expect(axios.post).toHaveBeenCalledWith(
      '/imoveis/7/indicadores/icv/calcular',
      { vegetacao: [43] },
      { timeout: 310000 },
    )
    expect(axios.post).toHaveBeenCalledWith(
      '/imoveis/8/indicadores/icv/calcular',
      { vegetacao: [43] },
      { timeout: 310000 },
    )
    expect(panel.text()).toContain('Relatório por área')
    expect(panel.text()).toContain('Apucarana')
    expect(panel.text()).toContain('Vera Tupã’i')
    panel.unmount()
  })
  it('inclui todas as áreas poligonais ao escolher a camada inteira', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        items: [
          { id: 7, name: 'Apucarana', attributes: null },
          { id: 8, name: 'Vera Tupã’i', attributes: null },
        ],
        total: 2,
        page: 0,
        size: 20,
      },
    })
    vi.mocked(axios.post).mockResolvedValue({ data: { ICV: { percentual: 10 } } })
    const panel = mountPanel()
    panel.findComponent({ name: 'TestPicker' }).vm.$emit('update:modelValue', 19)
    await flushPromises()
    panel
      .findAllComponents({ name: 'TestInput' })
      .find((c) => c.props('label') === 'Áreas do relatório')!
      .vm.$emit('update:modelValue', 'all')
    await flushPromises()
    expect(
      panel
        .findAllComponents({ name: 'TestInput' })
        .some((c) => c.props('label') === 'Buscar área pelo nome'),
    ).toBe(false)
    panel.findAllComponents({ name: 'TestPicker' })[1]!.vm.$emit('update:modelValue', [43])
    await flushPromises()
    await panel
      .findAll('button')
      .find((b) => b.text() === 'Prévia sem salvar')!
      .trigger('click')
    await flushPromises()
    expect(axios.get).toHaveBeenCalledWith('/ambiental/camadas/19/feicoes', {
      params: { busca: '', campo: undefined, page: 0, size: 100 },
    })
    expect(axios.post).toHaveBeenCalledTimes(2)
    expect(axios.post).toHaveBeenCalledWith(
      '/imoveis/7/indicadores/icv',
      { vegetacao: [43] },
      { timeout: 310000 },
    )
    expect(axios.post).toHaveBeenCalledWith(
      '/imoveis/8/indicadores/icv',
      { vegetacao: [43] },
      { timeout: 310000 },
    )
    panel.unmount()
  })
})
