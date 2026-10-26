import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import axios from 'axios'
import FileUploads from '@/views/FileUploadsView.vue'
import { setSessionUser } from '@/access/session'
import type { FileStage } from '@/services/contracts'
import type { QuarantinePage, QuarantineRecord } from '@/services/quarantine'

enableAutoUnmount(afterEach)
vi.mock('axios', () => ({ default: { get: vi.fn(), isAxiosError: () => true } }))
const Container = defineComponent({
  props: ['title'],
  template: '<section><h2 v-if="title">{{ title }}</h2><slot /></section>',
})
const Button = defineComponent({
  props: ['disabled', 'to'],
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
const base = {
  formatFile: 'csv',
  size: 100,
  ingestionId: 1,
  userId: 7,
  location: null,
  validation: null,
}
const files = [
  { ...base, id: 1, name: 'a.csv', hash: 'h1', receivedDate: '2026-10-22T09:30:00' },
  { ...base, id: 2, name: 'b.csv', hash: 'h2', receivedDate: '2026-10-21T09:30:00' },
  { ...base, id: 3, name: 'c.csv', hash: 'h3', receivedDate: '2026-10-20T09:30:00' },
]
const stagesData: FileStage[] = [
  { fileId: 1, status: 'BRUTA', versionNumber: 2, location: 'validada/fontes/2/h1_a.csv' },
  { fileId: 2, status: 'BRUTA', versionNumber: 1, location: 'bruta/fontes/2/h2_b.csv' },
  { fileId: 3, status: 'PUBLICADA', versionNumber: 4, location: 'publicada/fontes/2/h3_c.csv' },
]
let stagesResponse: () => Promise<{ data: unknown }>
const emptyQuarantines: QuarantinePage = {
  content: [],
  page: 0,
  size: 100,
  totalElements: 0,
  totalPages: 0,
}
const quarantine = (overrides: Partial<QuarantineRecord> = {}): QuarantineRecord => ({
  id: 10,
  ingestionId: 1,
  fileId: 1,
  fileName: 'a.csv',
  sourceId: 2,
  sourceName: 'Fonte A',
  status: 'REGISTROS_REJEITADOS',
  reason: 'Registros rejeitados na validação.',
  treatment: null,
  dateEntry: '2026-10-22T09:30:00',
  dateResolution: null,
  responsibleId: null,
  responsibleName: null,
  validationReportUrl: '/arquivos/1/validacao',
  ...overrides,
})
let quarantinesResponse: (page: number) => Promise<{ data: QuarantinePage }>
beforeEach(() => {
  vi.resetAllMocks()
  setSessionUser({ id: 7, name: 'Operador', userType: 'OPERADOR', userStatus: 1 })
  stagesResponse = async () => ({ data: stagesData })
  quarantinesResponse = async () => ({ data: emptyQuarantines })
  vi.mocked(axios.get).mockImplementation(async (path, config) => {
    if (path === '/arquivos/etapas') return stagesResponse()
    if (path === '/quarentenas')
      return quarantinesResponse((config?.params as { page: number }).page)
    if (path === '/fontes')
      return { data: [{ id: 2, name: 'Fonte A', url: 'https://www.ibge.gov.br/' }] }
    if (path === '/fontes/2/arquivos') return { data: files }
    return { data: {} }
  })
})
afterEach(() => setSessionUser(null))
async function setup() {
  const wrapper = mount(FileUploads, {
    global: {
      stubs: {
        VTextField: Search,
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
const cards = (w: Awaited<ReturnType<typeof setup>>) => w.findAll('button.stage-card')
const rows = (w: Awaited<ReturnType<typeof setup>>) => w.findAll('tr.file-row')
const card = (w: Awaited<ReturnType<typeof setup>>, label: string) =>
  cards(w).find((c) => c.find('.stage-label').text() === label)!

describe('cards por etapa do bucket', () => {
  it('mostra o total recebido em Bruta e a etapa atual nos demais cards', async () => {
    const wrapper = await setup()
    expect(cards(wrapper).map((c) => c.find('.stage-label').text())).toEqual([
      'Bruta',
      'Quarentena',
      'Tratada',
      'Publicada',
    ])
    expect(cards(wrapper).map((c) => c.find('.stage-count').text())).toEqual(['3', '0', '0', '1'])
    expect(axios.get).toHaveBeenCalledWith('/arquivos/etapas')
  })
  it('mostra a etapa de cada arquivo na tabela, com versão e local no bucket na dica', async () => {
    const wrapper = await setup()
    const badge = rows(wrapper)[0]!.find('.stage-badge')
    expect(badge.text()).toBe('Bruta')
    expect(badge.attributes('title')).toBe('Versão 2 · validada/fontes/2/h1_a.csv')
    expect(rows(wrapper)[2]!.find('.stage-badge').text()).toBe('Publicada')
  })
  it('filtra a tabela ao clicar em um card e limpa ao clicar de novo', async () => {
    const wrapper = await setup()
    await card(wrapper, 'Publicada').trigger('click')
    expect(card(wrapper, 'Publicada').attributes('aria-pressed')).toBe('true')
    expect(rows(wrapper)).toHaveLength(1)
    expect(rows(wrapper)[0]!.text()).toContain('c.csv')
    expect(wrapper.find('.result-count').text()).toBe('1 de 3 arquivo(s)')
    await card(wrapper, 'Publicada').trigger('click')
    expect(rows(wrapper)).toHaveLength(3)
    expect(card(wrapper, 'Publicada').attributes('aria-pressed')).toBe('false')
  })
  it('explica a etapa vazia e permite voltar a todas as etapas', async () => {
    const wrapper = await setup()
    await card(wrapper, 'Quarentena').trigger('click')
    expect(rows(wrapper)).toHaveLength(0)
    expect(wrapper.text()).toContain('Nenhum arquivo encontrado')
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Mostrar todas as etapas')!
      .trigger('click')
    expect(rows(wrapper)).toHaveLength(3)
  })
  it('combina o filtro de etapa com a busca', async () => {
    const wrapper = await setup()
    await card(wrapper, 'Bruta').trigger('click')
    await wrapper.find('input[type="search"]').setValue('b.csv')
    expect(rows(wrapper)).toHaveLength(1)
    expect(rows(wrapper)[0]!.text()).toContain('b.csv')
  })
  it('mantém todos os arquivos em Bruta mesmo quando já estão tratados ou publicados', async () => {
    stagesResponse = async () => ({
      data: [
        { fileId: 1, status: 'TRATADA', versionNumber: 3, location: 'tratada/fontes/2/a.csv' },
        {
          fileId: 2,
          status: 'QUARENTENA',
          versionNumber: 1,
          location: 'quarentena/fontes/2/b.csv',
        },
        stagesData[2],
      ],
    })
    const wrapper = await setup()
    expect(cards(wrapper).map((c) => c.find('.stage-count').text())).toEqual(['3', '1', '1', '1'])
    await card(wrapper, 'Tratada').trigger('click')
    expect(rows(wrapper)).toHaveLength(1)
    expect(rows(wrapper)[0]!.text()).toContain('a.csv')
    await card(wrapper, 'Bruta').trigger('click')
    expect(rows(wrapper)).toHaveLength(3)
    expect(rows(wrapper).map((row) => row.find('.stage-badge').text())).toEqual([
      'Tratada',
      'Quarentena',
      'Publicada',
    ])
    await wrapper.find('input[type="search"]').setValue('c.csv')
    expect(rows(wrapper)).toHaveLength(1)
    expect(rows(wrapper)[0]!.find('.stage-badge').text()).toBe('Publicada')
    expect(card(wrapper, 'Bruta').find('.stage-count').text()).toBe('3')
  })
  it('mantém a lista funcionando e avisa quando as etapas não carregam', async () => {
    stagesResponse = async () => {
      throw { response: { data: { detail: 'Etapas indisponíveis.' } } }
    }
    const wrapper = await setup()
    expect(rows(wrapper)).toHaveLength(3)
    expect(wrapper.find('.stage-error').text()).toContain('Etapas indisponíveis.')
    expect(cards(wrapper).map((c) => c.find('.stage-count').text())).toEqual(['3', '0', '—', '—'])
    expect(card(wrapper, 'Bruta').attributes('disabled')).toBeUndefined()
    expect(card(wrapper, 'Quarentena').attributes('disabled')).toBeUndefined()
    expect(
      cards(wrapper)
        .filter((c) => ['Tratada', 'Publicada'].includes(c.find('.stage-label').text()))
        .every((c) => c.attributes('disabled') !== undefined),
    ).toBe(true)
    await card(wrapper, 'Bruta').trigger('click')
    expect(rows(wrapper)).toHaveLength(3)
    expect(rows(wrapper)[0]!.find('.stage-badge').text()).toBe('—')
  })
  it('conta separado o arquivo que não tem versão registrada', async () => {
    stagesResponse = async () => ({ data: stagesData.slice(0, 2) })
    const wrapper = await setup()
    expect(cards(wrapper).map((c) => c.find('.stage-count').text())).toEqual(['3', '0', '0', '0'])
    expect(wrapper.find('.stage-note').text()).toContain('1 arquivo(s) sem versão registrada')
    expect(rows(wrapper)[2]!.find('.stage-badge').text()).toBe('Sem etapa')
    await card(wrapper, 'Bruta').trigger('click')
    expect(rows(wrapper)).toHaveLength(3)
    expect(rows(wrapper)[2]!.find('.stage-badge').text()).toBe('Sem etapa')
  })
})

describe('quarentena na biblioteca de arquivos', () => {
  it('inclui rejeições parciais na contagem e no filtro, preservando a etapa e o local atuais', async () => {
    stagesResponse = async () => ({
      data: [
        { fileId: 1, status: 'TRATADA', versionNumber: 3, location: 'tratada/fontes/2/a.csv' },
        ...stagesData.slice(1),
      ],
    })
    quarantinesResponse = async () => ({
      data: { ...emptyQuarantines, content: [quarantine()], totalElements: 1, totalPages: 1 },
    })
    const wrapper = await setup()
    expect(cards(wrapper).map((c) => c.find('.stage-count').text())).toEqual(['3', '1', '1', '1'])
    const row = rows(wrapper)[0]!
    expect(row.find('.stage-badge').text()).toBe('Tratada')
    expect(row.find('.stage-badge').attributes('title')).toBe('Versão 3 · tratada/fontes/2/a.csv')
    expect(row.find('.quarantine-link').text()).toBe('Quarentena parcial')
    const link = row.findComponent(Button)
    expect(link.classes()).toContain('quarantine-link')
    expect(link.props('to')).toEqual({
      path: '/quarantine',
      query: { fileId: '1' },
    })
    await card(wrapper, 'Quarentena').trigger('click')
    expect(rows(wrapper)).toHaveLength(1)
    expect(rows(wrapper)[0]!.text()).toContain('a.csv')
    expect(axios.get).not.toHaveBeenCalledWith('/arquivos/1/validacao')
    await card(wrapper, 'Bruta').trigger('click')
    expect(rows(wrapper)).toHaveLength(3)
  })

  it('consulta todas as páginas e conta cada arquivo uma vez, incluindo análises de outras pessoas', async () => {
    quarantinesResponse = async (page) => ({
      data: {
        ...emptyQuarantines,
        page,
        totalPages: 2,
        totalElements: 5,
        content:
          page === 0
            ? [quarantine()]
            : [
                quarantine(),
                quarantine({ id: 11, fileId: 1 }),
                quarantine({ id: 12, fileId: 2, status: 'EM_ANALISE', responsibleId: 99 }),
                quarantine({ id: 13, fileId: null }),
                quarantine({ id: 14, fileId: 999 }),
              ],
      },
    })
    const wrapper = await setup()
    expect(axios.get).toHaveBeenCalledWith('/quarentenas', { params: { page: 0, size: 100 } })
    expect(axios.get).toHaveBeenCalledWith('/quarentenas', { params: { page: 1, size: 100 } })
    expect(card(wrapper, 'Quarentena').find('.stage-count').text()).toBe('2')
    expect(rows(wrapper)[0]!.find('.quarantine-link').text()).toBe(
      'Quarentena · 2 análises abertas',
    )
    expect(rows(wrapper)[1]!.find('.quarantine-link').text()).toBe('Quarentena · em análise')
    await card(wrapper, 'Quarentena').trigger('click')
    expect(rows(wrapper)).toHaveLength(2)
    await wrapper.find('input[type="search"]').setValue('b.csv')
    expect(rows(wrapper)).toHaveLength(1)
  })

  it('identifica análises encerradas sem apresentar os registros rejeitados como aprovados', async () => {
    quarantinesResponse = async () => ({
      data: {
        ...emptyQuarantines,
        content: [
          quarantine({
            fileId: 3,
            status: 'RESOLVIDA',
            dateResolution: '2026-10-25T12:00:00',
          }),
        ],
        totalElements: 1,
        totalPages: 1,
      },
    })
    const wrapper = await setup()
    const row = rows(wrapper)[2]!
    expect(row.find('.stage-badge').text()).toBe('Publicada')
    expect(row.find('.quarantine-link').text()).toBe('Quarentena encerrada')
    expect(row.find('.quarantine-link').attributes('title')).toContain(
      'Encerrar a análise não aprova os registros rejeitados.',
    )
    await card(wrapper, 'Quarentena').trigger('click')
    expect(rows(wrapper)).toHaveLength(1)
    expect(rows(wrapper)[0]!.text()).toContain('c.csv')
  })

  it('mantém a quarentena acessível mesmo se a consulta da etapa atual falhar', async () => {
    stagesResponse = async () => {
      throw { response: { data: 'Etapas indisponíveis.' } }
    }
    quarantinesResponse = async () => ({
      data: { ...emptyQuarantines, content: [quarantine()], totalElements: 1, totalPages: 1 },
    })
    const wrapper = await setup()
    expect(card(wrapper, 'Quarentena').find('.stage-count').text()).toBe('1')
    expect(card(wrapper, 'Quarentena').attributes('disabled')).toBeUndefined()
    await card(wrapper, 'Quarentena').trigger('click')
    expect(rows(wrapper)).toHaveLength(1)
    expect(rows(wrapper)[0]!.find('.stage-badge').text()).toBe('—')
    expect(rows(wrapper)[0]!.find('.quarantine-link').text()).toBe('Quarentena parcial')
  })

  it('não duplica o arquivo quando a etapa atual e a ocorrência indicam quarentena', async () => {
    stagesResponse = async () => ({
      data: [
        { fileId: 1, status: 'QUARENTENA', versionNumber: 2, location: 'quarentena/a.csv' },
        ...stagesData.slice(1),
      ],
    })
    quarantinesResponse = async () => ({
      data: {
        ...emptyQuarantines,
        content: [quarantine({ status: 'ARQUIVO_REJEITADO' })],
        totalElements: 1,
        totalPages: 1,
      },
    })
    const wrapper = await setup()
    expect(card(wrapper, 'Quarentena').find('.stage-count').text()).toBe('1')
    expect(rows(wrapper)[0]!.find('.quarantine-link').text()).toBe('Arquivo em quarentena')
    await card(wrapper, 'Quarentena').trigger('click')
    expect(rows(wrapper)).toHaveLength(1)
  })

  it('descarta uma consulta atrasada após sair da tela, sem carregar outras páginas', async () => {
    let resolve!: (response: { data: QuarantinePage }) => void
    quarantinesResponse = () =>
      new Promise((done) => {
        resolve = done
      })
    const wrapper = await setup()
    expect(wrapper.find('v-progress-linear-stub[aria-label="Carregando arquivos"]').exists()).toBe(
      true,
    )
    wrapper.unmount()
    resolve({
      data: { ...emptyQuarantines, content: [quarantine()], totalElements: 101, totalPages: 2 },
    })
    await flushPromises()
    expect(axios.get).not.toHaveBeenCalledWith('/quarentenas', { params: { page: 1, size: 100 } })
  })

  it('não apresenta uma contagem incompleta se uma página falha e permite atualizar', async () => {
    quarantinesResponse = async (page) => {
      if (page === 1) throw { response: { data: 'Quarentena temporariamente indisponível.' } }
      return {
        data: { ...emptyQuarantines, content: [quarantine()], totalElements: 101, totalPages: 2 },
      }
    }
    const wrapper = await setup()
    expect(wrapper.find('.quarantine-error').text()).toContain(
      'Quarentena temporariamente indisponível.',
    )
    expect(card(wrapper, 'Quarentena').find('.stage-count').text()).toBe('—')
    expect(card(wrapper, 'Quarentena').attributes('disabled')).toBeDefined()
    expect(wrapper.findAll('.quarantine-link')).toHaveLength(0)
    expect(rows(wrapper)).toHaveLength(3)
    expect(card(wrapper, 'Bruta').find('.stage-count').text()).toBe('3')
    expect(card(wrapper, 'Publicada').find('.stage-count').text()).toBe('1')

    quarantinesResponse = async () => ({
      data: { ...emptyQuarantines, content: [quarantine()], totalElements: 1, totalPages: 1 },
    })
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Atualizar')!
      .trigger('click')
    await flushPromises()
    expect(wrapper.find('.quarantine-error').exists()).toBe(false)
    expect(card(wrapper, 'Quarentena').find('.stage-count').text()).toBe('1')
    expect(rows(wrapper)[0]!.find('.quarantine-link').text()).toBe('Quarentena parcial')
  })
})
