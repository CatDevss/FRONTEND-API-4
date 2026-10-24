import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import axios from 'axios'
import FileUploads from '@/views/FileUploadsView.vue'
import ValidationResult from '@/components/ValidationResult.vue'
import { setSessionUser } from '@/access/session'
import type { ValidationReport } from '@/services/contracts'

enableAutoUnmount(afterEach)
vi.mock('axios', () => ({ default: { get: vi.fn(), isAxiosError: () => true } }))
const Container = defineComponent({
  props: ['title'],
  template: '<section><h2 v-if="title">{{ title }}</h2><slot /></section>',
})
const Button = defineComponent({
  props: ['disabled'],
  template: '<button :disabled="disabled"><slot /></button>',
})
const Search = defineComponent({
  props: ['modelValue', 'label'],
  emits: ['update:modelValue'],
  template:
    '<input type="search" :aria-label="label" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
})
const Dialog = defineComponent({
  props: ['modelValue'],
  template: '<div v-if="modelValue"><slot /></div>',
})
const files = [
  {
    id: 101,
    name: 'municipios.geojson',
    formatFile: 'geojson',
    size: 2048,
    hash: 'abc001',
    receivedDate: '2026-10-22T09:30:00',
    ingestionId: 1,
    userId: 7,
    location: null,
    validation: null,
  },
  {
    id: 102,
    name: 'Relatório.csv',
    formatFile: 'csv',
    size: 512,
    hash: 'def002',
    receivedDate: '2026-10-21T14:00:00',
    ingestionId: 2,
    userId: 7,
    location: null,
    validation: null,
  },
]
const sources = [
  { id: 2, name: 'Órgão Municipal', url: 'https://www.ibge.gov.br/' },
  { id: 3, name: 'INPE', url: 'https://www.inpe.br/' },
]
const report: ValidationReport = {
  status: 'REJEITADO',
  validRecords: 0,
  rejectedRecords: 1,
  dictionaryId: 10,
  dictionaryVersion: 2,
  records: [],
}
function response(path: string) {
  return {
    data:
      path === '/fontes'
        ? sources
        : path === '/fontes/2/arquivos'
          ? [files[0]]
          : path === '/fontes/3/arquivos'
            ? [files[1]]
            : report,
  }
}
beforeEach(() => {
  vi.resetAllMocks()
  setSessionUser({ id: 7, name: 'Operador', userType: 'OPERADOR', userStatus: 1 })
  vi.mocked(axios.get).mockImplementation(async (path) => response(path))
})
afterEach(() => setSessionUser(null))
async function setup() {
  const wrapper = mount(FileUploads, {
    global: {
      stubs: {
        VTextField: Search,
        VSelect: true,
        VBtn: Button,
        VTable: { template: '<table><slot /></table>' },
        VIcon: true,
        VProgressLinear: true,
        VAlert: Container,
        VDialog: Dialog,
        VCard: Container,
        VCardText: Container,
        VCardActions: Container,
        VSpacer: true,
        VList: Container,
        VListItem: Container,
        ValidationResult: true,
      },
    },
  })
  await flushPromises()
  return wrapper
}
const rows = (wrapper: Awaited<ReturnType<typeof setup>>) => wrapper.findAll('tr.file-row')

describe('file library with one unified search', () => {
  it('searches files, sources, formats and hashes in one bar, ignoring accents and case', async () => {
    const wrapper = await setup()
    expect(wrapper.findAll('input[type="search"]')).toHaveLength(1)
    expect(wrapper.find('v-select-stub').exists()).toBe(false)
    const search = wrapper.find('input[type="search"]')
    for (const term of [
      'ORGAO MUNICIPAL',
      'MUNICIPIOS',
      'geojson',
      'abc001',
      'municipios orgao geojson',
    ]) {
      await search.setValue(term)
      expect(rows(wrapper)).toHaveLength(1)
      expect(rows(wrapper)[0]!.text()).toContain('municipios.geojson')
    }
    await search.setValue('relatorio inpe csv')
    expect(rows(wrapper)).toHaveLength(1)
    expect(rows(wrapper)[0]!.text()).toContain('Relatório.csv')
    wrapper.findComponent(Search).vm.$emit('update:modelValue', null)
    await flushPromises()
    expect(rows(wrapper)).toHaveLength(2)
    expect(wrapper.find('.library-summary').text()).toContain('2,5 KB')
    expect(axios.get).not.toHaveBeenCalledWith('/conjuntos')
  })
  it('keeps provenance fields readable without implying a validation result', async () => {
    const wrapper = await setup()
    expect(rows(wrapper)[0]!.text()).toContain('2 KB')
    expect(rows(wrapper)[0]!.text()).toContain('22/10/2026 às 09:30')
    expect(rows(wrapper)[0]!.find('.hash').attributes('title')).toBe('abc001')
    expect(rows(wrapper)[0]!.text()).not.toContain('VALIDO')
    expect(wrapper.find('.library-footer').text()).toContain('não indica aprovação')
  })
  it('distinguishes no search matches and clears the query without reloading the API', async () => {
    const wrapper = await setup()
    const count = vi.mocked(axios.get).mock.calls.length
    await wrapper.find('input[type="search"]').setValue('arquivo inexistente')
    expect(wrapper.text()).toContain('Nenhum arquivo encontrado')
    expect(rows(wrapper)).toHaveLength(0)
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Limpar busca')!
      .trigger('click')
    expect(rows(wrapper)).toHaveLength(2)
    expect(axios.get).toHaveBeenCalledTimes(count)
  })
  it('opens the real validation report with the file context', async () => {
    const wrapper = await setup()
    await wrapper
      .find('button[aria-label="Consultar validação de municipios.geojson"]')
      .trigger('click')
    await flushPromises()
    expect(axios.get).toHaveBeenCalledWith('/arquivos/101/validacao')
    expect(wrapper.findComponent(ValidationResult).props('report')).toEqual(report)
    expect(wrapper.find('.dialog-file-name').text()).toBe('municipios.geojson')
  })
  it('preserves API messages when a file has no automatic collection metadata and allows retry', async () => {
    const wrapper = await setup()
    vi.mocked(axios.get).mockRejectedValue({
      response: { data: { detail: 'Arquivo não possui metadados de coleta automática.' } },
    })
    await wrapper
      .find('button[aria-label="Consultar origem da coleta de municipios.geojson"]')
      .trigger('click')
    await flushPromises()
    expect(axios.get).toHaveBeenCalledWith('/arquivos/101/coleta')
    expect(wrapper.text()).toContain('Arquivo não possui metadados de coleta automática.')
    expect(wrapper.findAll('button').some((b) => b.text() === 'Tentar novamente')).toBe(true)
  })
  it('keeps collection provenance, limitations and original evidence available', async () => {
    const wrapper = await setup()
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        product: 'IBGE_BIOMAS',
        competence: '2025',
        scope: 'Paraná',
        format: 'geojson',
        originFormat: 'shapefile',
        collectedAt: '2026-10-22T12:00:00Z',
        documentation: 'https://www.ibge.gov.br/',
        limitations: ['Recorte restrito ao Paraná.'],
        originals: [
          {
            filename: 'biomas.zip',
            origin: 'https://www.ibge.gov.br/biomas.zip',
            contentType: 'application/zip',
            size: 2048,
            sha256: 'evidencia-original',
          },
        ],
      },
    })
    await wrapper
      .find('button[aria-label="Consultar origem da coleta de municipios.geojson"]')
      .trigger('click')
    await flushPromises()
    expect(wrapper.find('.metadata-summary').text()).toContain('IBGE_BIOMAS')
    expect(wrapper.find('.metadata-summary').text()).toContain('Paraná')
    expect(wrapper.text()).toContain('Recorte restrito ao Paraná.')
    expect(wrapper.text()).toContain('biomas.zip')
    expect(wrapper.text()).toContain('evidencia-original')
    expect(wrapper.find('.dialog-file-name').text()).toBe('municipios.geojson')
  })
  it('keeps successfully loaded files and reports a failed source separately', async () => {
    vi.mocked(axios.get).mockImplementation(async (path) => {
      if (path === '/fontes/3/arquivos')
        throw { response: { data: 'Fonte temporariamente indisponível.' } }
      return response(path)
    })
    const wrapper = await setup()
    expect(rows(wrapper)).toHaveLength(1)
    expect(wrapper.find('.library-error').text()).toContain(
      'INPE: Fonte temporariamente indisponível.',
    )
    expect(wrapper.find('.result-count').text()).toBe('1 de 1 arquivo(s)')
  })
  it('ignores an old report response after selecting another file', async () => {
    const wrapper = await setup()
    let resolve!: (response: { data: ValidationReport }) => void
    vi.mocked(axios.get).mockImplementation(async (path) =>
      path === '/arquivos/101/validacao'
        ? new Promise((r) => {
            resolve = r
          })
        : { data: report },
    )
    await wrapper
      .find('button[aria-label="Consultar validação de municipios.geojson"]')
      .trigger('click')
    await wrapper.find('button[aria-label="Consultar validação de Relatório.csv"]').trigger('click')
    await flushPromises()
    resolve({ data: { ...report, status: 'VALIDO' } })
    await flushPromises()
    expect(wrapper.findComponent(ValidationResult).props('report').status).toBe('REJEITADO')
    expect(wrapper.find('.dialog-file-name').text()).toBe('Relatório.csv')
  })
  it('explains an empty library and leaves auditors without ingestion actions', async () => {
    setSessionUser({ id: 8, name: 'Auditor', userType: 'AUDITOR', userStatus: 1 })
    vi.mocked(axios.get).mockImplementation(async (path) => ({
      data: path === '/fontes' ? sources : [],
    }))
    const wrapper = await setup()
    expect(wrapper.text()).toContain('Seus arquivos começam por uma fonte')
    expect(wrapper.text()).not.toContain('Nova ingestão')
    expect(wrapper.text()).not.toContain('Fazer primeira ingestão')
  })
})
