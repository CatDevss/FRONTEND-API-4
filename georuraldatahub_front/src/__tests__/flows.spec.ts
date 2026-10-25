import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, enableAutoUnmount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import axios from 'axios'
import { setSessionUser } from '@/access/session'
import Datasets from '@/views/DatasetsView.vue'
import FileUploads from '@/views/FileUploadsView.vue'
import NewLoad from '@/views/NewLoadView.vue'
import Dictionaries from '@/views/DictionariesView.vue'
import CollectionForm from '@/components/CollectionForm.vue'
import DatasetSelect from '@/components/DatasetSelect.vue'
import DataSetDialog from '@/components/DataSetDialog.vue'
import DataSourceDialog from '@/components/DataSourceDialog.vue'
import { sourceSupportsProduct } from '@/services/contracts'

enableAutoUnmount(afterEach)

vi.mock('axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), isAxiosError: () => true },
}))
const Select = defineComponent({
  props: ['modelValue', 'items', 'itemTitle', 'itemValue'],
  emits: ['update:modelValue'],
  template:
    '<select @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="item in items" :key="item.id || item" :value="item[itemValue] || item">{{ item[itemTitle] || item }}</option></select>',
})
const Button = defineComponent({
  props: ['disabled'],
  template: '<button :disabled="disabled"><slot /></button>',
})
const Container = defineComponent({
  template: '<div><slot /><slot name="prepend" /><slot name="append" /></div>',
  methods: {
    resetValidation() {},
    async validate() {
      return { valid: true }
    },
  },
})
const global = {
  stubs: {
    ...Object.fromEntries(
      [
        'VCard',
        'VCardText',
        'VCardActions',
        'VForm',
        'VDialog',
        'VRow',
        'VCol',
        'VProgressCircular',
        'VProgressLinear',
        'VAlert',
        'VChip',
        'VTextField',
        'VTextarea',
        'VCombobox',
        'VCheckbox',
        'VSpacer',
        'VIcon',
        'VExpansionPanels',
        'VExpansionPanel',
        'VExpansionPanelText',
      ].map((name) => [name, Container]),
    ),
    VSelect: Select,
    VAutocomplete: true,
    VListItem: Container,
    VBtn: Button,
    ValidationResult: true,
    ConfirmDialog: true,
  },
}
const dictionary = {
  id: 10,
  sourceId: 2,
  name: 'Regras',
  description: '',
  version: 1,
  status: 'UTILIZADO',
  rules: [{ name: 'id', required: true, type: 'STRING', unique: true, domain: [] }],
  createdOn: '2026-10-20T12:00:00',
}
beforeEach(() => {
  vi.clearAllMocks()
  setSessionUser({ id: 1, name: 'Operador', userType: 'OPERADOR', userStatus: 1 })
})
describe('contract dependent flows', () => {
  it('lists datasets without filtering by an absent sourceId', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: [{ id: 7, name: 'Conjunto real', userId: 1 }] })
    const wrapper = mount(DatasetSelect, { global })
    await flushPromises()
    expect(wrapper.text()).toContain('Conjunto real')
  })
  it('blocks changes to used dictionaries and allows a new version', async () => {
    setSessionUser({ id: 1, name: 'Gestor', userType: 'GESTOR', userStatus: 1 })
    vi.mocked(axios.get).mockImplementation(async (url) => ({
      data: url === '/fontes' ? [{ id: 2, name: 'IBGE' }] : [dictionary],
    }))
    const wrapper = mount(Dictionaries, { global })
    await flushPromises()
    wrapper.findComponent(Select).vm.$emit('update:modelValue', 2)
    await flushPromises()
    const button = (text: string) => wrapper.findAll('button').find((b) => b.text() === text)!
    expect(button('Editar').attributes('disabled')).toBeDefined()
    expect(button('Excluir').attributes('disabled')).toBeDefined()
    expect(button('Criar nova versão').attributes('disabled')).toBeUndefined()
    vi.mocked(axios.post).mockResolvedValue({
      data: { ...dictionary, id: 11, version: 2, status: 'RASCUNHO' },
    })
    await button('Criar nova versão').trigger('click')
    await flushPromises()
    expect(axios.post).toHaveBeenCalledWith('/dicionarios/10/versoes')
  })
  it('sends dataset userId rather than a sourceId', async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: {} })
    const wrapper = mount(DataSetDialog, { props: { userId: 1, modelValue: true }, global })
    // The creation form sends the current session identity with the name.
    const vm = wrapper.vm as unknown as { dataSet: { name: string }; save: () => Promise<void> }
    vm.dataSet.name = 'Novo conjunto'
    await vm.save()
    expect(axios.post).toHaveBeenCalledWith('/conjuntos', { name: 'Novo conjunto', userId: 1 })
  })
  it('collects using the selected source, product and dataset, without a dictionary override', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: [
        { id: 'IBGE_MUNICIPIOS', product: 'Malha municipal', access: 'AUTOMATICO' },
        { id: 'CAR_SICAR', product: 'CAR', access: 'MANUAL' },
      ],
    })
    vi.mocked(axios.post).mockResolvedValue({
      data: {
        file: { name: 'malha.geojson', validation: { status: 'PARCIAL' } },
        collection: { scope: 'Paraná', limitations: [] },
      },
    })
    const wrapper = mount(CollectionForm, {
      props: {
        connector: {
          id: 'IBGE_MUNICIPIOS',
          agency: 'IBGE',
          product: 'Malha municipal',
          access: 'AUTOMATICO',
          documentation: '',
          limitations: '',
        },
        sourceId: 2,
        sourceUrl: 'https://www.ibge.gov.br/',
        userId: 1,
        ready: true,
      },
      global,
    })
    await flushPromises()
    const vm = wrapper.vm as unknown as { competence: string; collect: () => Promise<void> }
    vm.competence = '2022'
    await vm.collect()
    expect(axios.post).toHaveBeenCalledWith('/fontes/2/coletas', {
      product: 'IBGE_MUNICIPIOS',
      competence: '2022',
      userId: 1,
    })
    expect(wrapper.findComponent({ name: 'ValidationResult' }).props('report').status).toBe(
      'PARCIAL',
    )
  })
  it('registers a source with the selected responsible user', async () => {
    setSessionUser({ id: 8, name: 'Gestor', userType: 'GESTOR', userStatus: 1 })
    const source = { id: 12, name: 'Nova origem', url: 'https://www.ibge.gov.br/' }
    vi.mocked(axios.post).mockResolvedValue({ data: source })
    const wrapper = mount(DataSourceDialog, { props: { userId: 8, modelValue: true }, global })
    const vm = wrapper.vm as unknown as {
      dataSource: { name: string; url: string }
      save: () => Promise<void>
    }
    vm.dataSource.name = source.name
    vm.dataSource.url = source.url
    await vm.save()
    expect(axios.post).toHaveBeenCalledWith('/fontes', {
      name: source.name,
      url: source.url,
      description: null,
      userId: 8,
    })
    expect(wrapper.emitted('saved')?.[0]).toEqual([source])
  })
  it('matches agency URLs with the same boundaries as the backend', () => {
    expect(sourceSupportsProduct('https://www.ibge.gov.br/', 'IBGE_BIOMAS')).toBe(true)
    expect(sourceSupportsProduct('https://ibge.gov.br.evil.test/', 'IBGE_BIOMAS')).toBe(false)
    expect(sourceSupportsProduct('https://www.gov.br/inpe/', 'INPE_PRODES')).toBe(true)
    expect(sourceSupportsProduct('https://www.car.gov.br/', 'INPE_PRODES')).toBe(false)
  })
})

describe('supported collection payloads', () => {
  it.each([
    { product: 'IBGE_BIOMAS', competence: '2025', url: 'https://www.ibge.gov.br/' },
    { product: 'INPE_PRODES', competence: '2024', url: 'https://terrabrasilis.dpi.inpe.br/' },
    { product: 'INPE_QUEIMADAS', competence: '2026-10-19', url: 'https://queimadas.dgi.inpe.br/' },
  ])('sends only filters supported by $product', async ({ product, competence, url }) => {
    vi.mocked(axios.get).mockResolvedValue({
      data: [{ id: product, product, access: 'AUTOMATICO' }],
    })
    vi.mocked(axios.post).mockResolvedValue({
      data: {
        file: { name: 'saida', validation: { status: 'REJEITADO' } },
        collection: { scope: 'Paraná', limitations: [] },
      },
    })
    const wrapper = mount(CollectionForm, {
      props: {
        connector: {
          id: product,
          agency: 'Órgão',
          product,
          access: 'AUTOMATICO',
          documentation: '',
          limitations: '',
        },
        sourceId: 2,
        sourceUrl: url,
        userId: 1,
        ready: true,
      },
      global,
    })
    await flushPromises()
    const vm = wrapper.vm as unknown as {
      competence: string
      biome: string
      bbox: string
      collect: () => Promise<void>
    }
    vm.competence = competence
    if (product === 'INPE_PRODES') {
      vm.biome = 'CERRADO'
      vm.bbox = '-54,-26,-50,-23'
    }
    await vm.collect()
    expect(axios.post).toHaveBeenCalledWith('/fontes/2/coletas', {
      product,
      competence,
      userId: 1,
      ...(product === 'INPE_PRODES' ? { biome: 'CERRADO', bbox: [-54, -26, -50, -23] } : {}),
    })
    expect(wrapper.findComponent({ name: 'ValidationResult' }).props('report').status).toBe(
      'REJEITADO',
    )
  })
})

describe('ingestion by source and session', () => {
  const sources = [
    { id: 2, name: 'IBGE', url: 'https://www.ibge.gov.br/' },
    { id: 4, name: 'INPE', url: 'https://terrabrasilis.dpi.inpe.br/' },
  ]
  const catalog = [
    { id: 'IBGE_MUNICIPIOS', agency: 'IBGE', product: 'Malha municipal', access: 'AUTOMATICO' },
    { id: 'INPE_PRODES', agency: 'INPE', product: 'PRODES', access: 'AUTOMATICO' },
  ]
  function setup(extraSources = sources, dictionaries: unknown[] = [dictionary]) {
    vi.mocked(axios.get).mockImplementation(async (url) => ({
      data:
        url === '/fontes' ? extraSources : url === '/fontes/conectores' ? catalog : dictionaries,
    }))
    return mount(NewLoad, {
      global: { ...global, stubs: { ...global.stubs, FileUploadList: true, CollectionForm: true } },
    })
  }
  const button = (w: ReturnType<typeof setup>, text: string) =>
    w.findAll('button').find((b) => b.text().includes(text))!
  it('asks for modality and never requests a responsible user or dataset', async () => {
    const w = setup()
    await flushPromises()
    expect(w.text()).toContain('Qual serviço você quer utilizar?')
    await button(w, 'Enviar meus arquivos').trigger('click')
    expect(w.findComponent({ name: 'FileUploadList' }).exists()).toBe(true)
    expect(w.findComponent({ name: 'FileUploadList' }).props('allowedExtensions')).toEqual([
      'csv',
      'json',
      'geojson',
      'zip',
      'gpkg',
      'tif',
      'tiff',
    ])
    expect(w.findComponent({ name: 'CollectionForm' }).exists()).toBe(false)
    expect(w.find('select[label="Responsável pela ingestão"]').exists()).toBe(false)
    expect(w.findComponent({ name: 'DatasetSelect' }).exists()).toBe(false)
    expect(axios.get).not.toHaveBeenCalledWith('/usuarios')
    expect(axios.get).not.toHaveBeenCalledWith('/conjuntos')
  })
  it('selects a unique compatible source, but does not collect before confirmation', async () => {
    const w = setup()
    await flushPromises()
    await button(w, 'Escolher serviço').trigger('click')
    await button(w, 'Malha municipal').trigger('click')
    await flushPromises()
    expect(w.findComponent(Select).props('modelValue')).toBe(2)
    expect(w.text()).toContain('Fonte identificada automaticamente')
    expect(axios.post).not.toHaveBeenCalled()
  })
  it('requires an explicit source choice when several are compatible', async () => {
    const w = setup([
      ...sources,
      { id: 3, name: 'Outro IBGE', url: 'https://servicodados.ibge.gov.br/' },
    ])
    await flushPromises()
    await button(w, 'Escolher serviço').trigger('click')
    await button(w, 'Malha municipal').trigger('click')
    await flushPromises()
    expect(w.findComponent(Select).props('modelValue')).toBeNull()
    expect(w.findComponent({ name: 'CollectionForm' }).props('ready')).toBe(false)
  })
  it('does not create a source when no source matches', async () => {
    const w = setup([sources[1]!])
    await flushPromises()
    await button(w, 'Escolher serviço').trigger('click')
    await button(w, 'Malha municipal').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('Nenhuma fonte cadastrada corresponde')
    expect(axios.post).not.toHaveBeenCalled()
  })
  it('uploads to the source with session identity and no dataset parameter', async () => {
    const w = setup()
    await flushPromises()
    await button(w, 'Enviar meus arquivos').trigger('click')
    w.findComponent(Select).vm.$emit('update:modelValue', 2)
    w.findComponent({ name: 'FileUploadList' }).vm.$emit('update:modelValue', [
      new File(['id\n1'], 'teste.csv'),
    ])
    await flushPromises()
    expect(button(w, 'Enviar e validar arquivos').attributes('disabled')).toBeUndefined()
    vi.mocked(axios.post).mockResolvedValue({
      data: { validation: { status: 'VALIDO', validRecords: 1, rejectedRecords: 0 } },
    })
    await button(w, 'Enviar e validar arquivos').trigger('click')
    w.findComponent({ name: 'ConfirmDialog' }).vm.$emit('confirm')
    await flushPromises()
    expect(axios.post).toHaveBeenCalledWith(
      '/fontes/2/arquivos',
      expect.any(FormData),
      expect.objectContaining({ params: { userId: 1 } }),
    )
  })
  it('blocks uploads when there is no dictionary', async () => {
    const w = setup(sources, [])
    await flushPromises()
    await button(w, 'Enviar meus arquivos').trigger('click')
    w.findComponent(Select).vm.$emit('update:modelValue', 2)
    await flushPromises()
    expect(button(w, 'Enviar e validar arquivos').attributes('disabled')).toBeDefined()
  })
})

describe('dataset membership', () => {
  function setup() {
    let linked = false
    const file = {
      id: 99,
      name: 'Sem conjunto.csv',
      formatFile: 'csv',
      size: 9,
      receivedDate: '2026-10-20T12:00:00',
      dictionaryId: 3,
      dictionaryVersion: 1,
      ingestionId: 4,
      layers: [],
    }
    vi.mocked(axios.get).mockImplementation(async (url) => ({
      data:
        url === '/conjuntos'
          ? [{ id: 7, name: 'Análise', userId: 1 }]
          : url === '/fontes'
            ? [{ id: 2, name: 'IBGE', url: 'https://www.ibge.gov.br/' }]
            : url === '/conjuntos/7/estrutura'
              ? {
                  id: 7,
                  name: 'Análise',
                  userId: 1,
                  sources: linked ? [{ id: 2, name: 'IBGE', files: [file] }] : [],
                }
              : [file],
    }))
    vi.mocked(axios.put).mockImplementation(async () => {
      linked = true
      return { status: 204 }
    })
    vi.mocked(axios.delete).mockImplementation(async () => {
      linked = false
      return { status: 204 }
    })
    return mount(Datasets, {
      global: {
        ...global,
        stubs: { ...global.stubs, VList: Container, VListItem: Container, DataSetDialog: true },
      },
    })
  }
  it('associates existing files without upload, refreshes structure, and removes only the link', async () => {
    const w = setup()
    await flushPromises()
    await w.find('button[data-dataset-id="7"]').trigger('click')
    await flushPromises()
    await w
      .findAll('button')
      .find((b) => b.text() === 'Adicionar arquivos')!
      .trigger('click')
    await flushPromises()
    w.findComponent(Select).vm.$emit('update:modelValue', 2)
    await flushPromises()
    await w
      .findAll('button')
      .find((b) => b.text() === 'Adicionar ao conjunto')!
      .trigger('click')
    await flushPromises()
    expect(axios.put).toHaveBeenCalledWith('/conjuntos/7/arquivos/99')
    expect(axios.post).not.toHaveBeenCalled()
    expect(axios.get).toHaveBeenCalledWith('/conjuntos/7/estrutura')
    await w
      .findAll('button')
      .find((b) => b.text() === 'Remover vínculo')!
      .trigger('click')
    await flushPromises()
    expect(axios.delete).toHaveBeenCalledWith('/conjuntos/7/arquivos/99')
    expect(axios.delete).not.toHaveBeenCalledWith('/arquivos/99')
    expect(w.findAll('button').some((b) => b.text() === 'Adicionar ao conjunto')).toBe(true)
  })
  it('renders read-only for auditors and blocks programmatic writes', async () => {
    setSessionUser({ id: 8, name: 'Auditor', userType: 'AUDITOR', userStatus: 1 })
    const w = setup()
    await flushPromises()
    await w.find('button[data-dataset-id="7"]').trigger('click')
    await flushPromises()
    expect(w.findAll('button').some((b) => b.text() === 'Novo conjunto')).toBe(false)
    const vm = w.vm as unknown as { membership: (file: number, add: boolean) => Promise<void> }
    await vm.membership(99, true)
    expect(axios.put).not.toHaveBeenCalled()
  })
  it('lists files by source, including those not associated to any dataset', async () => {
    vi.mocked(axios.get).mockImplementation(async (url) => ({
      data:
        url === '/fontes'
          ? [{ id: 2, name: 'IBGE' }]
          : [
              {
                id: 99,
                name: 'Arquivo independente.csv',
                size: 9,
                receivedDate: '2026-10-20T12:00:00',
              },
            ],
    }))
    const w = mount(FileUploads, {
      global: {
        ...global,
        stubs: { ...global.stubs, VTable: Container, VList: Container, VListItem: Container },
      },
    })
    await flushPromises()
    expect(w.text()).toContain('Arquivo independente.csv')
    expect(axios.get).toHaveBeenCalledWith('/fontes/2/arquivos')
    expect(axios.get).not.toHaveBeenCalledWith('/conjuntos')
  })
})
