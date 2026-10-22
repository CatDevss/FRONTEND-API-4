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
import { setSessionUser } from '@/access/session'
import { isCollectionInProgress, isUploadInProgress, uploadResults } from '@/composables/uploadLock'
import type { ValidationReport } from '@/services/contracts'

vi.mock('axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), isAxiosError: () => true },
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
  vi.mocked(axios.get).mockImplementation(async (path) => {
    if (path === '/fontes') return { data: sources }
    if (path === '/fontes/conectores') return { data: connectors }
    if (/^\/fontes\/(2|4)\/dicionarios$/.test(path))
      return {
        data: [
          { id: 10, name: 'Regras anteriores', version: 1, status: 'UTILIZADO' },
          { id: 22, name: 'Regras atuais', version: 3, status: 'RASCUNHO' },
        ],
      }
    throw new Error(`Unexpected GET ${path}`)
  })
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
    type Response = { status: number; data: { validation: ValidationReport } }
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
    expect(button(w, 'Trocar modalidade').attributes('disabled')).toBeUndefined()
  })
})
