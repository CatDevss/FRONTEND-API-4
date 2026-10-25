import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import axios from 'axios'
import NewLoad from '@/views/NewLoadView.vue'
import CollectionForm from '@/components/CollectionForm.vue'
import FileUploadList from '@/components/upload/FileUploadList.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import IngestionDictionarySelect from '@/components/IngestionDictionarySelect.vue'
import { setSessionUser } from '@/access/session'
import { isCollectionInProgress, isUploadInProgress, uploadResults } from '@/composables/uploadLock'
import type { Dictionary, ValidationReport } from '@/services/contracts'

vi.mock('axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), isAxiosError: () => true, isCancel: () => false },
}))
const sources = [
  { id: 2, name: 'IBGE', url: 'https://www.ibge.gov.br/' },
  { id: 4, name: 'INPE', url: 'https://terrabrasilis.dpi.inpe.br/' },
]
const connectors = [
  { id: 'IBGE_MUNICIPIOS', agency: 'IBGE', product: 'Malha municipal' },
  { id: 'IBGE_BIOMAS', agency: 'IBGE', product: 'Biomas' },
  { id: 'INPE_PRODES', agency: 'INPE', product: 'PRODES' },
  { id: 'INPE_QUEIMADAS', agency: 'INPE', product: 'Queimadas' },
].map((connector) => ({
  ...connector,
  access: 'AUTOMATICO',
  documentation: '',
  limitations: 'Coleta restrita ao Paraná.',
}))
let cleanups: (() => void)[] = []
function sourceDictionaries(sourceId: number): Dictionary[] {
  return [
    { id: sourceId === 2 ? 10 : 40, name: 'Regras históricas', version: 1, status: 'UTILIZADO' },
    { id: sourceId === 2 ? 22 : 44, name: 'Regras atuais', version: 3, status: 'RASCUNHO' },
  ].map((dictionary) => ({
    ...dictionary,
    sourceId,
    description: null,
    rules: [],
    createdOn: '2026-10-20T12:00:00',
  }))
}
function response(path: string) {
  if (path === '/fontes') return { data: sources }
  if (path === '/fontes/conectores') return { data: connectors }
  if (/^\/fontes\/(2|4)\/dicionarios$/.test(path))
    return { data: sourceDictionaries(Number(path.split('/')[2])) }
  throw new Error(`Unexpected GET ${path}`)
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  vi.stubGlobal('visualViewport', {
    width: 1280,
    height: 900,
    offsetTop: 0,
    offsetLeft: 0,
    addEventListener() {},
    removeEventListener() {},
  })
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }))
  setSessionUser({ id: 7, name: 'Operador', userType: 'OPERADOR', userStatus: 1 })
  uploadResults.value = []
  vi.mocked(axios.get).mockImplementation(async (path) => response(path))
})
afterEach(async () => {
  for (const cleanup of cleanups) cleanup()
  cleanups = []
  await flushPromises()
  setSessionUser(null)
  isCollectionInProgress.value = false
  isUploadInProgress.value = false
  uploadResults.value = []
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})
async function setup(mode: 'automatic' | 'manual' = 'automatic') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/new-load', component: NewLoad },
      { path: '/dictionaries', component: defineComponent({ template: '<div />' }) },
      { path: '/quarantine', component: defineComponent({ template: '<div />' }) },
    ],
  })
  await router.push('/new-load')
  const wrapper = mount(NewLoad, {
    attachTo: document.body,
    global: {
      plugins: [router, createVuetify({ components, directives, theme: { defaultTheme: 'dark' } })],
    },
  })
  cleanups.push(() => wrapper.unmount())
  await flushPromises()
  await button(wrapper, mode === 'automatic' ? 'Escolher serviço' : 'Enviar meus arquivos').trigger(
    'click',
  )
  return wrapper
}
type Wrapper = Awaited<ReturnType<typeof setup>>
const button = (w: Wrapper, name: string) =>
  w.findAll('button').find((entry) => entry.text() === name)!
async function select(w: Wrapper, product: string) {
  await w.find(`button[data-product="${product}"]`).trigger('click')
  await flushPromises()
}
async function chooseDictionary(w: Wrapper, dictionaryId: number | 'latest' | null) {
  w.findComponent(IngestionDictionarySelect)
    .findComponent(components.VAutocomplete)
    .vm.$emit('update:modelValue', dictionaryId)
  await flushPromises()
}
async function prepareManual() {
  const w = await setup('manual')
  const input = w.find('input[type="file"]')
  Object.defineProperty(input.element, 'files', { value: [new File(['id\n1'], 'dados.csv')] })
  await input.trigger('change')
  w.findComponent(components.VSelect).vm.$emit('update:modelValue', 2)
  await flushPromises()
  return w
}
const collectionResult = (dictionaryId: number, dictionaryVersion: number) => ({
  status: 201,
  data: {
    file: {
      id: 77,
      name: 'municipios.geojson',
      validation: {
        status: 'PARCIAL',
        dictionaryId,
        dictionaryVersion,
        validRecords: 1,
        rejectedRecords: 1,
        records: [],
      },
    },
    collection: { scope: 'Paraná', competence: '2024', limitations: [] },
  },
})

describe('automatic ingestion with Vuetify controls', () => {
  it('sends the configured source filters and displays partial validation before changing service', async () => {
    const w = await setup()
    await select(w, 'INPE_PRODES')
    expect(w.findComponent(CollectionForm).props('ready')).toBe(true)
    expect(w.text()).toContain('Regras atuais')
    await w.findComponent(CollectionForm).find('input[type="text"]').setValue('2024')
    w.findComponent(CollectionForm)
      .findComponent(components.VSelect)
      .vm.$emit('update:modelValue', 'MATA_ATLANTICA')
    await w.find('input[placeholder="Ex.: -54,-26,-50,-23"]').setValue('-54,-26,-50,-23')
    expect(axios.post).not.toHaveBeenCalled()
    vi.mocked(axios.post).mockResolvedValue({
      status: 201,
      data: {
        file: {
          id: 77,
          name: 'prodes.geojson',
          validation: {
            status: 'PARCIAL',
            dictionaryId: 22,
            dictionaryVersion: 3,
            validRecords: 2,
            rejectedRecords: 1,
            records: [],
          },
        },
        collection: { scope: 'Paraná', competence: '2024', limitations: [] },
      },
    })
    await button(w, 'Coletar e validar').trigger('click')
    await flushPromises()
    expect(axios.post).toHaveBeenCalledExactlyOnceWith('/fontes/4/coletas', {
      product: 'INPE_PRODES',
      competence: '2024',
      userId: 7,
      biome: 'MATA_ATLANTICA',
      bbox: [-54, -26, -50, -23],
    })
    expect(w.text()).toContain('PARCIAL: 2 registro(s) aprovado(s), 1 rejeitado(s).')
    expect(w.text()).toContain('Somente os registros aprovados ficam disponíveis')
    expect(w.find('a[href="/quarantine?fileId=77"]').text()).toBe('Consultar quarentena')
    await select(w, 'IBGE_MUNICIPIOS')
    expect(w.findComponent(CollectionForm).props('sourceId')).toBe(2)
    expect(w.text()).not.toContain('prodes.geojson')
    expect(
      (w.findComponent(CollectionForm).find('input[type="text"]').element as HTMLInputElement)
        .value,
    ).toBe('')
    expect(button(w, 'Coletar e validar').attributes('disabled')).toBeDefined()
    expect(axios.post).toHaveBeenCalledTimes(1)
  })

  it('locks source, service and modality while collecting, then preserves the API error and allows retry', async () => {
    const w = await setup()
    await select(w, 'IBGE_MUNICIPIOS')
    await w.findComponent(CollectionForm).find('input[type="text"]').setValue('2022')
    let reject!: (reason: unknown) => void
    vi.mocked(axios.post).mockImplementationOnce(
      () => new Promise((_resolve, rejectRequest) => (reject = rejectRequest)),
    )
    await button(w, 'Coletar e validar').trigger('click')
    expect(isCollectionInProgress.value).toBe(true)
    expect(button(w, 'Trocar modalidade').attributes('disabled')).toBeDefined()
    expect(w.findComponent(components.VSelect).props('disabled')).toBe(true)
    expect(w.find('button[data-product="INPE_PRODES"]').attributes('disabled')).toBeDefined()
    await w.find('button[data-product="INPE_PRODES"]').trigger('click')
    expect(w.findComponent(CollectionForm).props('sourceId')).toBe(2)
    reject({ response: { data: { detail: 'Serviço oficial temporariamente indisponível.' } } })
    await flushPromises()
    expect(isCollectionInProgress.value).toBe(false)
    expect(w.text()).toContain('Serviço oficial temporariamente indisponível.')
    expect(button(w, 'Coletar e validar').attributes('disabled')).toBeUndefined()
    expect(button(w, 'Trocar modalidade').attributes('disabled')).toBeUndefined()
    expect(
      (w.findComponent(CollectionForm).find('input[type="text"]').element as HTMLInputElement)
        .value,
    ).toBe('2022')
    expect(axios.post).toHaveBeenCalledTimes(1)
  })
})

describe('manual ingestion with Vuetify controls', () => {
  it('removes only a selected file, confirms the source and keeps rejected content blocked after HTTP 201', async () => {
    const w = await setup('manual')
    const csv = new File(['id\n1'], 'dados.csv')
    const json = new File(['{"type":"FeatureCollection","features":[]}'], 'dados.json')
    const input = w.find('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [csv, json] })
    await input.trigger('change')
    expect(w.findAll('.selected-file')).toHaveLength(2)
    await w.find('button[aria-label="Remover dados.csv da seleção"]').trigger('click')
    expect(w.findComponent(FileUploadList).props('modelValue')).toEqual([json])
    w.findComponent(components.VSelect).vm.$emit('update:modelValue', 2)
    await flushPromises()
    expect(axios.post).not.toHaveBeenCalled()
    await button(w, 'Enviar e validar arquivos').trigger('click')
    const confirm = w.findComponent(ConfirmDialog)
    expect(confirm.props('message')).toContain('1 arquivo(s) para a fonte IBGE')
    expect(axios.post).not.toHaveBeenCalled()
    type Response = { status: number; data: { id: number; validation: ValidationReport } }
    let resolve!: (response: Response) => void
    vi.mocked(axios.post).mockImplementationOnce(
      () => new Promise<Response>((resolveRequest) => (resolve = resolveRequest)),
    )
    await confirm
      .findAllComponents(components.VBtn)
      .find((b) => b.text() === 'Confirmar')!
      .trigger('click')
    expect(axios.post).toHaveBeenCalledExactlyOnceWith(
      '/fontes/2/arquivos',
      expect.any(FormData),
      expect.objectContaining({ params: { userId: 7 } }),
    )
    const payload = vi.mocked(axios.post).mock.calls[0]?.[1] as FormData
    expect((payload.get('file') as File).name).toBe(json.name)
    expect((payload.get('file') as File).size).toBe(json.size)
    expect(isUploadInProgress.value).toBe(true)
    expect(w.findComponent(FileUploadList).props('disabled')).toBe(true)
    expect(
      w.find('button[aria-label="Remover dados.json da seleção"]').attributes('disabled'),
    ).toBeDefined()
    expect(w.findComponent(components.VSelect).props('disabled')).toBe(true)
    expect(button(w, 'Trocar modalidade').attributes('disabled')).toBeDefined()
    expect(w.find('.manual-progress').text()).toContain('dados.json')
    resolve({
      status: 201,
      data: {
        id: 99,
        validation: {
          status: 'REJEITADO',
          dictionaryId: 22,
          dictionaryVersion: 3,
          validRecords: 0,
          rejectedRecords: 1,
          records: [],
        },
      },
    })
    await flushPromises()
    expect(isUploadInProgress.value).toBe(false)
    expect(w.find('.manual-results').text()).toContain(
      'REJEITADO: 0 registro(s) aprovado(s), 1 rejeitado(s).',
    )
    expect(w.find('.manual-results').text()).toContain(
      'Arquivo bloqueado para tratamento e visualização.',
    )
    expect(w.findComponent(FileUploadList).props('modelValue')).toEqual([json])
    expect(w.find('a[href="/quarantine?fileId=99"]').text()).toBe('Consultar quarentena')
    expect(button(w, 'Trocar modalidade').attributes('disabled')).toBeUndefined()
  })
})

describe('dictionary selection for ingestion', () => {
  it('searches versions without accents and sends the chosen dictionary in the manual upload', async () => {
    const w = await prepareManual()
    const picker = w.findComponent(IngestionDictionarySelect)
    const search = picker.findComponent(components.VAutocomplete).find('input[type="text"]')
    const searchInput = search.element as HTMLInputElement
    searchInput.focus()
    await flushPromises()
    await search.setValue('HISTORICAS')
    await flushPromises()
    const matches = picker.findAllComponents(components.VListItem)
    expect(matches).toHaveLength(1)
    expect(matches[0]!.text()).toContain('Regras históricas · v1 · #10')
    await matches[0]!.trigger('click')
    await flushPromises()
    expect(picker.props('modelValue')).toBe(10)
    expect(axios.post).not.toHaveBeenCalled()
    vi.mocked(axios.post).mockResolvedValue({
      status: 201,
      data: collectionResult(10, 1).data.file,
    })
    await button(w, 'Enviar e validar arquivos').trigger('click')
    const confirm = w.findComponent(ConfirmDialog)
    expect(confirm.props('message')).toContain('Regras históricas · v1 · #10')
    await confirm
      .findAllComponents(components.VBtn)
      .find((b) => b.text() === 'Confirmar')!
      .trigger('click')
    await flushPromises()
    expect(vi.mocked(axios.post).mock.calls[0]?.[2]?.params).toEqual({
      userId: 7,
      dictionaryId: 10,
    })
    expect(w.find('.manual-results').text()).toContain('Dicionário 10, versão 1.')
    expect(w.find('.manual-results').text()).toContain('PARCIAL')
  })

  it('sends the chosen dictionary in collection JSON and clearing restores automatic selection without losing filters', async () => {
    const w = await setup()
    await select(w, 'IBGE_MUNICIPIOS')
    await chooseDictionary(w, 10)
    await w.findComponent(CollectionForm).find('input[type="text"]').setValue('2024')
    vi.mocked(axios.post).mockResolvedValue(collectionResult(10, 1))
    await button(w, 'Coletar e validar').trigger('click')
    await flushPromises()
    expect(axios.post).toHaveBeenLastCalledWith('/fontes/2/coletas', {
      product: 'IBGE_MUNICIPIOS',
      competence: '2024',
      userId: 7,
      dictionaryId: 10,
    })
    expect(w.text()).toContain('Dicionário 10, versão 1.')
    await chooseDictionary(w, null)
    expect(w.findComponent(IngestionDictionarySelect).props('modelValue')).toBeNull()
    expect(w.find('.collection-result').exists()).toBe(false)
    expect(
      (w.findComponent(CollectionForm).find('input[type="text"]').element as HTMLInputElement)
        .value,
    ).toBe('2024')
    vi.mocked(axios.post).mockResolvedValue(collectionResult(22, 3))
    await button(w, 'Coletar e validar').trigger('click')
    await flushPromises()
    expect(axios.post).toHaveBeenLastCalledWith('/fontes/2/coletas', {
      product: 'IBGE_MUNICIPIOS',
      competence: '2024',
      userId: 7,
    })
    expect(w.text()).toContain('Dicionário 22, versão 3.')
  })

  it('clears selection on source change and discards late versions and dictionaries belonging to another source', async () => {
    const w = await prepareManual()
    await chooseDictionary(w, 10)
    let resolve!: (value: { data: Dictionary[] }) => void
    vi.mocked(axios.get).mockImplementation(async (path) => {
      if (path === '/fontes/4/dicionarios')
        return new Promise<{ data: Dictionary[] }>((resolveRequest) => (resolve = resolveRequest))
      if (path === '/fontes/2/dicionarios')
        return { data: [...sourceDictionaries(2), ...sourceDictionaries(4)] }
      return response(path)
    })
    w.findComponent(components.VSelect).vm.$emit('update:modelValue', 4)
    await flushPromises()
    expect(w.findComponent(IngestionDictionarySelect).props('modelValue')).toBeNull()
    expect(w.findComponent(IngestionDictionarySelect).props('loading')).toBe(true)
    expect(button(w, 'Enviar e validar arquivos').attributes('disabled')).toBeDefined()
    w.findComponent(components.VSelect).vm.$emit('update:modelValue', 2)
    await flushPromises()
    resolve({ data: sourceDictionaries(4) })
    await flushPromises()
    expect(w.findComponent(IngestionDictionarySelect).props('dictionaries')).toEqual(
      [...sourceDictionaries(2)].reverse(),
    )
    expect(w.findComponent(IngestionDictionarySelect).props('modelValue')).toBeNull()
    expect(button(w, 'Enviar e validar arquivos').attributes('disabled')).toBeUndefined()
    expect(axios.post).not.toHaveBeenCalled()
  })

  it('shows dictionary API errors and blocks a disappeared selected version until the user chooses another mode', async () => {
    const w = await prepareManual()
    await chooseDictionary(w, 10)
    vi.mocked(axios.get).mockRejectedValueOnce({
      response: { data: 'Falha ao consultar versões.' },
    })
    await button(w, 'Conferir novamente').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('Falha ao consultar versões.')
    expect(
      w
        .findComponent(IngestionDictionarySelect)
        .findComponent(components.VAutocomplete)
        .props('disabled'),
    ).toBe(true)
    expect(button(w, 'Enviar e validar arquivos').attributes('disabled')).toBeDefined()
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: sourceDictionaries(2).filter((d) => d.id !== 10),
    })
    await button(w, 'Conferir novamente').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('A versão selecionada não está mais disponível.')
    expect(w.findComponent(IngestionDictionarySelect).props('modelValue')).toBe(10)
    expect(button(w, 'Enviar e validar arquivos').attributes('disabled')).toBeDefined()
    await chooseDictionary(w, 'latest')
    expect(button(w, 'Enviar e validar arquivos').attributes('disabled')).toBeUndefined()
    expect(axios.post).not.toHaveBeenCalled()
  })
})
