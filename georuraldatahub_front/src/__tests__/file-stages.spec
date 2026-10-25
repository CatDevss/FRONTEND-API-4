import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import axios from 'axios'
import FileUploads from '@/views/FileUploadsView.vue'
import { setSessionUser } from '@/access/session'
import type { FileStage } from '@/services/contracts'

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
const base = { formatFile: 'csv', size: 100, ingestionId: 1, userId: 7, location: null, validation: null }
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
beforeEach(() => {
  vi.resetAllMocks()
  setSessionUser({ id: 7, name: 'Operador', userType: 'OPERADOR', userStatus: 1 })
  stagesResponse = async () => ({ data: stagesData })
  vi.mocked(axios.get).mockImplementation(async (path) => {
    if (path === '/arquivos/etapas') return stagesResponse()
    if (path === '/fontes') return { data: [{ id: 2, name: 'Fonte A', url: 'https://www.ibge.gov.br/' }] }
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
  it('mostra as quatro etapas na ordem do fluxo, com a soma de arquivos em cada uma', async () => {
    const wrapper = await setup()
    expect(cards(wrapper).map((c) => c.find('.stage-label').text())).toEqual([
      'Bruta',
      'Quarentena',
      'Tratada',
      'Publicada',
    ])
    expect(cards(wrapper).map((c) => c.find('.stage-count').text())).toEqual(['2', '0', '0', '1'])
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
  it('mantém a lista funcionando e avisa quando as etapas não carregam', async () => {
    stagesResponse = async () => {
      throw { response: { data: { detail: 'Etapas indisponíveis.' } } }
    }
    const wrapper = await setup()
    expect(rows(wrapper)).toHaveLength(3)
    expect(wrapper.find('.stage-error').text()).toContain('Etapas indisponíveis.')
    expect(cards(wrapper).map((c) => c.find('.stage-count').text())).toEqual(['—', '—', '—', '—'])
    expect(cards(wrapper).every((c) => c.attributes('disabled') !== undefined)).toBe(true)
    expect(rows(wrapper)[0]!.find('.stage-badge').text()).toBe('—')
  })
  it('conta separado o arquivo que não tem versão registrada', async () => {
    stagesResponse = async () => ({ data: stagesData.slice(0, 2) })
    const wrapper = await setup()
    expect(cards(wrapper).map((c) => c.find('.stage-count').text())).toEqual(['2', '0', '0', '0'])
    expect(wrapper.find('.stage-note').text()).toContain('1 arquivo(s) sem versão registrada')
    expect(rows(wrapper)[2]!.find('.stage-badge').text()).toBe('Sem etapa')
  })
})