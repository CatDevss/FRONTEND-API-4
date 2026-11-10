import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'
import axios from 'axios'
import CollectionForm from '@/components/CollectionForm.vue'
import DictionaryTemplate from '@/components/DictionaryTemplate.vue'
import { setSessionUser } from '@/access/session'
import { isCollectionInProgress, isUploadInProgress } from '@/composables/uploadLock'
import { sourceSupportsProduct, supportedProducts } from '@/services/contracts'
import { collectionParameters, parseBbox } from '@/services/collection'

vi.mock('axios', () => ({ default: { get: vi.fn(), post: vi.fn(), isAxiosError: () => true } }))
enableAutoUnmount(afterEach)
const Container = defineComponent({ template: '<div><slot /></div>' })
const Button = defineComponent({
  props: ['disabled'],
  template: '<button :disabled="disabled"><slot /></button>',
})
const Field = defineComponent({
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template:
    '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
})
const global = {
  stubs: {
    VBtn: Button,
    VAlert: Container,
    VIcon: true,
    VSelect: Field,
    VTextField: Field,
    ValidationResult: true,
  },
}
const connector = (id: string) => ({
  id,
  agency: id,
  product: id,
  access: 'AUTOMATICO',
  documentation: '',
  limitations: '',
})
const metadata = {
  product: 'MMA',
  competence: '2024-10',
  scope: 'Paraná',
  limitations: ['Edição publicada.'],
  originals: [],
}
const response = { status: 'DISPONIVEL', records: 15, bytes: 1000, collection: metadata }
const mounted = (id = 'MMA', ready = true) =>
  mount(CollectionForm, {
    props: {
      connector: connector(id),
      sourceId: ready ? 2 : null,
      sourceUrl: `https://www.gov.br/${id.toLowerCase()}`,
      userId: 7,
      ready,
      dictionaryId: ready ? 10 : null,
    },
    global,
  })
type Form = {
  competence: string
  municipality: string
  biome: string
  bbox: string
  collect: () => Promise<void>
  verify: () => Promise<void>
  loadEditions: () => Promise<void>
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}
beforeEach(() => {
  vi.resetAllMocks()
  setSessionUser({ id: 7, name: 'Operador', userType: 'OPERADOR', userStatus: 1 })
  isCollectionInProgress.value = false
  isUploadInProgress.value = false
})
afterEach(() => {
  setSessionUser(null)
  vi.useRealTimers()
  isCollectionInProgress.value = false
  isUploadInProgress.value = false
})

describe('official collection contracts', () => {
  it.each([
    ['ICMBIO', 'https://www.gov.br/icmbio'],
    ['ICMBIO_EMBARGOS', 'https://geoservicos.inde.gov.br/geoserver/ICMBio/wfs'],
    ['MMA', 'https://dados.mma.gov.br'],
    ['FUNAI', 'https://www.gov.br/funai/pt-br'],
    ['INCRA', 'https://certificacao.incra.gov.br'],
    ['SFB', 'https://dados.florestal.gov.br'],
    ['IBAMA', 'https://pamgia.ibama.gov.br'],
  ])('enables %s and keeps agency matching at hostname/path boundaries', (product, url) => {
    expect(supportedProducts).toContain(product)
    expect(sourceSupportsProduct(url, product)).toBe(true)
    expect(sourceSupportsProduct(url.replace('https://', 'https://user@'), product)).toBe(false)
    expect(sourceSupportsProduct('https://mma.gov.br.evil.test', product)).toBe(false)
    expect(sourceSupportsProduct('https://www.gov.br/icmbio-falso', product)).toBe(false)
  })
  it('does not offer CAR or unknown products for automatic collection', () => {
    expect(sourceSupportsProduct('https://www.inpe.br', 'UNKNOWN')).toBe(false)
    expect(() => collectionParameters('CAR_SICAR', 'ATUAL')).toThrow('Produto sem coleta')
  })
  it.each(['ICMBIO', 'ICMBIO_EMBARGOS', 'FUNAI', 'INCRA', 'IBAMA'])(
    'requires ATUAL for %s and allows a bbox',
    (product) => {
      expect(collectionParameters(product, 'atual', '', '', '-54,-26,-50,-23')).toEqual({
        competence: 'ATUAL',
        bbox: [-54, -26, -50, -23],
      })
      expect(() => collectionParameters(product, '2024')).toThrow('somente a base ATUAL')
    },
  )
  it.each(['ATUAL', '2024', '2024-10'])('preserves MMA competence %s', (competence) => {
    expect(collectionParameters('MMA', competence)).toEqual({ competence })
  })
  it('rejects invalid editions, dates, municipalities and reversed bounds', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-28T02:00:00Z'))
    expect(collectionParameters('INPE_QUEIMADAS', '2026-10-26')).toEqual({
      competence: '2026-10-26',
    })
    for (const day of ['2026-10-27', '2026-10-28', '2026-02-30'])
      expect(() => collectionParameters('INPE_QUEIMADAS', day)).toThrow('dia válido já encerrado')
    expect(() => collectionParameters('IBGE_BIOMAS', '2024')).toThrow('2019 ou 2025')
    expect(() => collectionParameters('MMA', '2024-13')).toThrow('edição')
    expect(() => collectionParameters('IBGE_MUNICIPIOS', '2022', '3512345')).toThrow('Paraná')
    expect(() => collectionParameters('INPE_PRODES', '2024', '', 'AMAZONIA')).toThrow('bioma')
    for (const bbox of [
      '1,2,3',
      '1,,3,4',
      '-50,-26,-54,-23',
      '-181,-26,-50,-23',
      '-54,-23,-50,-26',
    ])
      expect(() => parseBbox(bbox)).toThrow()
  })
})

describe('collection user actions', () => {
  it.each([
    ['ICMBIO', 'ATUAL', 'https://www.gov.br/icmbio'],
    ['ICMBIO_EMBARGOS', 'ATUAL', 'https://www.gov.br/icmbio'],
    ['MMA', '2024-10', 'https://dados.mma.gov.br'],
    ['FUNAI', 'ATUAL', 'https://www.gov.br/funai'],
    ['INCRA', 'ATUAL', 'https://www.gov.br/incra'],
    ['SFB', '2023', 'https://dados.florestal.gov.br'],
    ['IBAMA', 'ATUAL', 'https://www.gov.br/ibama'],
  ])(
    'collects %s with its exact parameters and selected dictionary',
    async (product, competence, url) => {
      vi.mocked(axios.post).mockResolvedValue({
        data: {
          file: { id: 99, name: 'dados.geojson', validation: { status: 'VALIDO' } },
          collection: metadata,
        },
      })
      const w = mounted(product)
      await w.setProps({ sourceUrl: url })
      const vm = w.vm as unknown as Form
      vm.competence = competence
      vm.bbox = '-54,-26,-50,-23'
      vm.municipality = 'IGNORED'
      vm.biome = 'IGNORED'
      await nextTick()
      await vm.collect()
      expect(axios.post).toHaveBeenCalledWith('/fontes/2/coletas', {
        product,
        competence,
        bbox: [-54, -26, -50, -23],
        userId: 7,
        dictionaryId: 10,
      })
      expect(w.emitted('collected')).toHaveLength(1)
    },
  )
  it('verifies without a registered source or dictionary and does not persist data', async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: response })
    const w = mounted('MMA', false)
    await w
      .findAll('button')
      .find((b) => b.text() === 'Verificar sem salvar')!
      .trigger('click')
    await flushPromises()
    expect(axios.post).toHaveBeenCalledExactlyOnceWith('/fontes/conectores/MMA/verificacao', {
      competence: 'ATUAL',
    })
    expect(w.text()).toContain('Download verificado')
    expect(w.text()).toContain('2024-10')
    expect(w.emitted('collected')).toBeUndefined()
    expect(isCollectionInProgress.value).toBe(false)
  })
  it('distinguishes an empty recut from availability and invalidates results after filter changes', async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: { ...response, status: 'SEM_REGISTROS', records: 0 },
    })
    const w = mounted()
    const vm = w.vm as unknown as Form
    await vm.verify()
    await nextTick()
    expect(w.text()).toContain('Sem registros no recorte')
    vm.bbox = '-54,-26,-50,-23'
    await nextTick()
    expect(w.text()).not.toContain('Sem registros no recorte')
  })
  it('shows upstream failures and releases the global lock for retry', async () => {
    vi.mocked(axios.post).mockRejectedValue({
      response: { data: { detail: 'Canal oficial indisponível' } },
    })
    const w = mounted()
    await (w.vm as unknown as Form).verify()
    await nextTick()
    expect(w.text()).toContain('Canal oficial indisponível')
    expect(w.text()).not.toContain('Download verificado')
    expect(isCollectionInProgress.value).toBe(false)
  })
  it('ignores an old edition response after switching connector', async () => {
    const request = deferred<{ data: unknown }>()
    vi.mocked(axios.get).mockReturnValue(request.promise)
    const w = mounted()
    const loading = (w.vm as unknown as Form).loadEditions()
    await w.setProps({ connector: connector('SFB') })
    request.resolve({ data: { product: 'MMA', editions: [], limitation: 'Old MMA catalog' } })
    await loading
    await nextTick()
    expect(w.text()).not.toContain('Old MMA catalog')
  })
  it('consults published editions without silently changing the requested competence', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        product: 'MMA',
        editions: [{ competence: '2024-10', description: 'Histórico', format: 'zip', url: null }],
        limitation: 'Publicação não garante download.',
      },
    })
    const w = mounted()
    const vm = w.vm as unknown as Form
    await vm.loadEditions()
    await nextTick()
    expect(axios.get).toHaveBeenCalledWith('/fontes/conectores/MMA/edicoes')
    expect(w.text()).toContain('Publicação não garante download.')
    expect(vm.competence).toBe('ATUAL')
    expect(axios.post).not.toHaveBeenCalled()
  })
  it('does not submit malformed bbox or allow a second request while verification runs', async () => {
    const w = mounted()
    const vm = w.vm as unknown as Form
    vm.bbox = '1,2,3'
    await nextTick()
    await vm.verify()
    expect(axios.post).not.toHaveBeenCalled()
    const request = deferred<{ data: unknown }>()
    vi.mocked(axios.post).mockReturnValue(request.promise)
    vm.bbox = ''
    await nextTick()
    const pending = vm.verify()
    await vm.collect()
    await vm.verify()
    expect(axios.post).toHaveBeenCalledTimes(1)
    setSessionUser(null)
    request.resolve({ data: response })
    await pending
    await nextTick()
    expect(w.text()).not.toContain('Download verificado')
    expect(isCollectionInProgress.value).toBe(false)
  })
})

describe('dictionary templates', () => {
  it('previews a template for the chosen edition and requires explicit application', async () => {
    const draft = {
      name: 'Biomas 2019',
      description: 'Revisar antes de salvar',
      rules: [{ name: 'Bioma', type: 'STRING', required: true, unique: false, domain: [] }],
    }
    vi.mocked(axios.get).mockImplementation(async (path) => ({
      data:
        path === '/fontes/conectores'
          ? [connector('IBGE_BIOMAS'), connector('INPE_PRODES')]
          : draft,
    }))
    const w = mount(DictionaryTemplate, { props: { sourceUrl: 'https://www.ibge.gov.br' }, global })
    const vm = w.vm as unknown as {
      product: string
      competence: string
      loadCatalog: () => Promise<void>
      loadTemplate: () => Promise<void>
    }
    await vm.loadCatalog()
    vm.product = 'IBGE_BIOMAS'
    vm.competence = '2019'
    await nextTick()
    await vm.loadTemplate()
    await nextTick()
    expect(axios.get).toHaveBeenCalledWith('/fontes/conectores/IBGE_BIOMAS/dicionario', {
      params: { competence: '2019' },
    })
    expect(w.text()).toContain('Bioma · STRING · Obrigatório')
    expect(w.emitted('apply')).toBeUndefined()
    expect(axios.post).not.toHaveBeenCalled()
    await w
      .findAll('button')
      .find((b) => b.text() === 'Usar modelo no editor')!
      .trigger('click')
    expect(w.emitted('apply')?.[0]).toEqual([draft])
    vm.competence = '2025'
    await nextTick()
    expect(w.text()).not.toContain('Bioma · STRING · Obrigatório')
  })
})
