import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import axios from 'axios'
import DictionaryGenerator from '@/components/DictionaryGenerator.vue'
import CollectionForm from '@/components/CollectionForm.vue'
import { setSessionUser } from '@/access/session'
import { isCollectionInProgress, isUploadInProgress } from '@/composables/uploadLock'

vi.mock('axios', () => ({ default: { post: vi.fn(), get: vi.fn(), isAxiosError: () => true } }))
enableAutoUnmount(afterEach)
const Container = defineComponent({ template: '<div><slot /></div>' })
const Button = defineComponent({
  props: ['disabled', 'to'],
  template: '<button :disabled="disabled"><slot /></button>',
})
const global = {
  stubs: { VBtn: Button, VAlert: Container, VIcon: true, VSelect: true, VTextField: true },
}
const response = {
  dictionary: {
    id: 99,
    sourceId: 2,
    name: 'Malha 2022',
    version: 3,
    status: 'RASCUNHO',
    rules: [{ name: 'CD_MUN', type: 'STRING', required: true, unique: false, domain: [] }],
  },
  filename: 'malha_2022.geojson',
  sha256: 'a'.repeat(64),
  validation: { status: 'VALIDO', validRecords: 399, rejectedRecords: 0, issues: [] },
  warnings: ['Revise as regras.'],
}
beforeEach(() => {
  vi.resetAllMocks()
  setSessionUser({ id: 7, name: 'Gestor', userType: 'GESTOR', userStatus: 1 })
  isCollectionInProgress.value = false
  isUploadInProgress.value = false
  vi.mocked(axios.post).mockResolvedValue({ data: response })
})
afterEach(() => {
  setSessionUser(null)
  isCollectionInProgress.value = false
  isUploadInProgress.value = false
})
const uploaded = (file: File | null = new File(['id\n1'], 'a.csv')) =>
  mount(DictionaryGenerator, {
    props: { mode: 'upload', sourceId: 2, userId: 7, file },
    global,
  })

describe('geração do dicionário pelo conteúdo', () => {
  it('saves from multipart content, emits the saved version and prevents duplicate clicks', async () => {
    const wrapper = uploaded()
    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(axios.post).toHaveBeenCalledWith(
      '/fontes/2/dicionarios/gerar-arquivo',
      expect.any(FormData),
      { params: { userId: 7 } },
    )
    const body = vi.mocked(axios.post).mock.calls[0]![1] as FormData
    expect((body.get('file') as File).name).toBe('a.csv')
    expect(wrapper.emitted('generated')?.[0]).toEqual([response])
    expect(wrapper.text()).toContain('Dicionário salvo e selecionado')
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
    expect(isCollectionInProgress.value).toBe(false)
    await wrapper.find('button').trigger('click')
    expect(axios.post).toHaveBeenCalledTimes(1)
  })
  it('can generate the chosen edition even when no dictionary exists yet', async () => {
    const wrapper = mount(CollectionForm, {
      props: {
        connector: {
          id: 'IBGE_MUNICIPIOS',
          agency: 'IBGE',
          product: 'Malhas municipais',
          access: 'AUTOMATICO',
          documentation: '',
          limitations: '',
        },
        sourceId: 2,
        sourceUrl: 'https://www.ibge.gov.br/',
        userId: 7,
        ready: false,
      },
      global,
    })
    ;(wrapper.vm as unknown as { competence: string }).competence = '2022'
    await flushPromises()
    const generator = wrapper.findComponent(DictionaryGenerator)
    expect(generator.find('button').attributes('disabled')).toBeUndefined()
    await generator.find('button').trigger('click')
    await flushPromises()
    expect(axios.post).toHaveBeenCalledWith(
      '/fontes/2/dicionarios/gerar-coleta',
      expect.objectContaining({ product: 'IBGE_MUNICIPIOS', competence: '2022', userId: 7 }),
    )
    expect(wrapper.emitted('dictionaryGenerated')?.[0]).toEqual([response.dictionary])
  })
  it('keeps generation unavailable for auditors or without a reference file', async () => {
    const wrapper = uploaded(null)
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
    setSessionUser({ id: 7, name: 'Auditor', userType: 'AUDITOR', userStatus: 1 })
    await flushPromises()
    expect(wrapper.find('button').exists()).toBe(false)
    expect(axios.post).not.toHaveBeenCalled()
  })
  it('reports rejected records separately from dictionary creation', async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: {
        ...response,
        validation: {
          status: 'REJEITADO',
          validRecords: 1,
          rejectedRecords: 1,
          issues: [{ recordIndex: 1, errors: ['DUPLICATE_RECORD'] }],
        },
      },
    })
    const wrapper = uploaded()
    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('conteúdo contém reprovações')
    expect(wrapper.text()).toContain('Registro 2: DUPLICATE_RECORD')
    expect(wrapper.emitted('generated')).toHaveLength(1)
  })
  it('releases locks on failure and allows retry', async () => {
    vi.mocked(axios.post).mockRejectedValue({ response: { data: 'JSON inválido.' } })
    const wrapper = uploaded()
    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('JSON inválido.')
    expect(isCollectionInProgress.value).toBe(false)
    expect(wrapper.find('button').attributes('disabled')).toBeUndefined()
    expect(wrapper.emitted('generated')).toBeUndefined()
  })
  it('does not select a stale response after changing source', async () => {
    let resolve!: (value: unknown) => void
    vi.mocked(axios.post).mockReturnValue(
      new Promise((done) => {
        resolve = done
      }),
    )
    const wrapper = uploaded()
    await wrapper.find('button').trigger('click')
    expect(isCollectionInProgress.value).toBe(true)
    await wrapper.setProps({ sourceId: 3 })
    resolve({ data: response })
    await flushPromises()
    expect(wrapper.emitted('generated')).toBeUndefined()
    expect(wrapper.text()).not.toContain('Dicionário salvo e selecionado')
    expect(isCollectionInProgress.value).toBe(false)
  })
})
