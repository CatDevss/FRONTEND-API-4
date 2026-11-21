import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { defineComponent } from 'vue'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
import axios from 'axios'
import Layers from '@/components/workspace/WorkspaceLayers.vue'
import { setSessionUser } from '@/access/session'
vi.mock('axios', () => ({ default: { get: vi.fn(), post: vi.fn(), isAxiosError: () => false } }))
enableAutoUnmount(afterEach)
const Box = { template: '<div><slot /></div>' }
const Button = { props: ['disabled'], template: '<button :disabled="disabled"><slot /></button>' }
const Field = defineComponent({
  name: 'TestField',
  props: ['modelValue', 'label', 'items'],
  emits: ['update:modelValue'],
  template: '<div>{{ label }}</div>',
})
const layer = {
  id: 31,
  name: 'Municípios',
  dataset: 'Municípios PR',
  datasetId: 2,
  source: 'IBGE',
  file: 'municipios.geojson',
  geometry: 'POLYGON',
  features: 399,
  srid: 4326,
}
function page(items: unknown[]) {
  return { items, total: items.length, page: 0, size: 20 }
}
function mountLayers() {
  return mount(Layers, {
    props: { initialDataset: 1 },
    global: {
      stubs: {
        VBtn: Button,
        VAutocomplete: Field,
        VCheckbox: Field,
        VSelect: Field,
        VTextField: Field,
        VAlert: Box,
        VCard: Box,
        VCardText: Box,
        VCardTitle: Box,
        VCardActions: Box,
        VDialog: { props: ['modelValue'], template: '<div v-if="modelValue"><slot /></div>' },
        VList: Box,
        VListItem: {
          props: ['title', 'subtitle'],
          template: '<div>{{ title }} {{ subtitle }}</div>',
        },
        VIcon: true,
        VSpacer: true,
        VProgressLinear: true,
        EnvironmentalLayerPicker: true,
      },
    },
  })
}
beforeEach(() => {
  vi.clearAllMocks()
  setSessionUser({ id: 1, name: 'Operador', userType: 'OPERADOR', userStatus: 1 })
  vi.mocked(axios.get).mockImplementation(async (url) => {
    const path = String(url)
    if (path === '/conjuntos')
      return {
        data: [
          { id: 1, name: 'Conjunto A' },
          { id: 2, name: 'Conjunto B' },
        ],
      }
    if (path === '/ambiental/recursos') return { data: { compositionEnabled: false } }
    if (path.endsWith('versoes-importaveis'))
      return {
        data: page([
          {
            id: 9,
            number: 2,
            file: 'municipios.geojson',
            source: 'IBGE',
            format: 'GeoJSON',
            importedLayers: 0,
          },
        ]),
      }
    if (path === '/ambiental/camadas/31') return { data: { layer, origins: [] } }
    return { data: page([]) }
  })
  vi.mocked(axios.post).mockResolvedValue({ data: { camadaId: 31, quantidade: 399 } })
})
describe('preparação de camadas', () => {
  it('importa do conjunto escolhido no diálogo sem trocar o filtro do catálogo', async () => {
    const wrapper = mountLayers()
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Preparar camada')!
      .trigger('click')
    await flushPromises()
    wrapper
      .findAllComponents(Field)
      .find((c) => c.props('label') === '1. Escolha o conjunto')!
      .vm.$emit('update:modelValue', 2)
    await flushPromises()
    expect(axios.get).toHaveBeenCalledWith('/conjuntos/2/versoes-importaveis', expect.anything())
    await wrapper.find('[role="radio"]').trigger('click')
    await wrapper
      .findAll('button')
      .filter((b) => b.text() === 'Preparar camada')
      .pop()!
      .trigger('click')
    await flushPromises()
    expect(axios.post).toHaveBeenCalledWith('/conjuntos/2/versoes/9/camada-oracle', undefined, {
      timeout: 310000,
    })
    const catalogCalls = vi
      .mocked(axios.get)
      .mock.calls.filter(([url]) => url === '/ambiental/camadas')
    expect(catalogCalls[catalogCalls.length - 1]?.[1]).toMatchObject({ params: { conjunto: 1 } })
    expect(wrapper.text()).toContain('399')
    expect(wrapper.text()).toContain('Arquivos e fontes')
    expect(wrapper.text()).toContain('IBGE')
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Ir para Medidores')!
      .trigger('click')
    expect(wrapper.emitted('useIndicators')).toHaveLength(1)
  })
  it('não permite preparar uma camada sem escolher arquivo', async () => {
    const wrapper = mountLayers()
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Preparar camada')!
      .trigger('click')
    await flushPromises()
    expect(
      wrapper
        .findAll('button')
        .filter((b) => b.text() === 'Preparar camada')
        .pop()!
        .attributes(),
    ).toHaveProperty('disabled')
    expect(axios.post).not.toHaveBeenCalled()
  })
  it('mantém o reparo desmarcado e só envia a autorização após seleção explícita', async () => {
    const wrapper = mountLayers()
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Preparar camada')!
      .trigger('click')
    await flushPromises()
    await wrapper.find('[role="radio"]').trigger('click')
    const checkbox = wrapper
      .findAllComponents(Field)
      .find((c) => c.props('label') === 'Permitir correção de contornos que se cruzam')!
    expect(checkbox.props('modelValue')).toBe(false)
    checkbox.vm.$emit('update:modelValue', true)
    await flushPromises()
    await wrapper
      .findAll('button')
      .filter((b) => b.text() === 'Preparar camada')
      .pop()!
      .trigger('click')
    await flushPromises()
    expect(axios.post).toHaveBeenLastCalledWith('/conjuntos/1/versoes/9/camada-oracle', undefined, {
      timeout: 310000,
      params: { corrigirGeometria: true },
    })
  })
})
