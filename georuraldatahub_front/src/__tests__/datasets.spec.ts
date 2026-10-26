import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import axios from 'axios'
import Datasets from '@/views/DatasetsView.vue'
import DataSetDialog from '@/components/DataSetDialog.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { setSessionUser } from '@/access/session'
import type { Dataset } from '@/services/contracts'

vi.mock('axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), isAxiosError: () => true },
}))
let cleanups: (() => void)[] = []
let datasets: Dataset[]
let linked: Map<number, boolean>
const file = {
  id: 99,
  name: 'municipios.geojson',
  formatFile: 'geojson',
  size: 512,
  receivedDate: '2026-10-22T12:00:00',
  dictionaryId: 10,
  dictionaryVersion: 2,
  ingestionId: 5,
  layers: [],
}
const source = { id: 2, name: 'IBGE', url: 'https://www.ibge.gov.br/' }
function structure(id: number) {
  return {
    ...datasets.find((d) => d.id === id)!,
    sources: linked.get(id) ? [{ ...source, files: [file] }] : [],
  }
}
function response(path: string) {
  if (path === '/conjuntos') return { data: datasets }
  if (path === '/fontes') return { data: [source] }
  if (path.endsWith('/estrutura')) return { data: structure(Number(path.split('/')[2])) }
  return { data: [file] }
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
  datasets = [
    { id: 8, name: 'Bacia Paraná', userId: 7 },
    { id: 7, name: 'Análise ambiental', userId: 7 },
  ]
  linked = new Map([
    [7, true],
    [8, false],
  ])
  vi.mocked(axios.get).mockImplementation(async (path) => response(path))
  vi.mocked(axios.put).mockImplementation(async (path, body) => {
    const id = Number(path.split('/')[2])
    if (path.includes('/arquivos/')) linked.set(id, true)
    else datasets.find((d) => d.id === id)!.name = (body as { name: string }).name
    return { data: datasets.find((d) => d.id === id), status: 200 }
  })
  vi.mocked(axios.delete).mockImplementation(async (path) => {
    const id = Number(path.split('/')[2])
    if (path.includes('/arquivos/')) linked.set(id, false)
    else datasets = datasets.filter((d) => d.id !== id)
    return { status: 204 }
  })
})
afterEach(async () => {
  for (const cleanup of cleanups) cleanup()
  cleanups = []
  await flushPromises()
  setSessionUser(null)
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})
async function setup() {
  const Empty = defineComponent({ template: '<div />' })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/datasets', component: Datasets },
      { path: '/home', component: Empty },
    ],
  })
  await router.push('/datasets')
  const wrapper = mount(Datasets, {
    attachTo: document.body,
    global: {
      plugins: [router, createVuetify({ components, directives, theme: { defaultTheme: 'dark' } })],
    },
  })
  cleanups.push(() => wrapper.unmount())
  await flushPromises()
  return wrapper
}
const button = (w: Awaited<ReturnType<typeof setup>>, name: string) =>
  w.findAll('button').find((b) => b.text() === name)!
async function select(w: Awaited<ReturnType<typeof setup>>, id: number) {
  await w.find(`button[data-dataset-id="${id}"]`).trigger('click')
  await flushPromises()
}

describe('dataset library and management', () => {
  it('uses one search by name or ID and preserves the selected dataset when filtering the list', async () => {
    const w = await setup()
    expect(w.findAll('input')).toHaveLength(1)
    expect(axios.get).not.toHaveBeenCalledWith('/fontes')
    await select(w, 7)
    await w.find('.dataset-search input').setValue('ANALISE')
    expect(w.findAll('.dataset-item')).toHaveLength(1)
    expect(w.find('.dataset-item').text()).toContain('Análise ambiental')
    await w.find('.dataset-search input').setValue('8')
    expect(w.findAll('.dataset-item')).toHaveLength(1)
    expect(w.find('.dataset-item').text()).toContain('Bacia Paraná')
    expect(w.find('.detail-heading').text()).toContain('Análise ambiental')
    await w.find('.dataset-search input').setValue('inexistente')
    expect(w.text()).toContain('Nenhum conjunto encontrado')
    await button(w, 'Limpar busca').trigger('click')
    expect(w.findAll('.dataset-item')).toHaveLength(2)
    expect(w.find('.linked-file').text()).toContain('municipios.geojson')
  })
  it('keeps files without layers, provenance and the workspace link visible', async () => {
    const w = await setup()
    await select(w, 7)
    expect(w.find('.linked-file').text()).toContain('Sem referência de visualização disponível.')
    expect(w.find('.linked-file').text()).toContain('Dicionário 10, versão 2 · Ingestão 5')
    expect(w.find('.detail-heading a').attributes('href')).toBe('/home?dataset=7')
    expect(w.find('.datasets-summary').text()).toContain('Arquivos no conjunto selecionado')
    expect(w.find('.library-footer').text()).toContain('preserva o arquivo original')
  })
  it('associates a file with another dataset and removes only its new link', async () => {
    const w = await setup()
    await select(w, 8)
    await button(w, 'Adicionar arquivos').trigger('click')
    await flushPromises()
    w.findComponent(components.VSelect).vm.$emit('update:modelValue', 2)
    await flushPromises()
    const add = w
      .findAllComponents(components.VBtn)
      .find((b) => b.text() === 'Adicionar ao conjunto')!
    await add.trigger('click')
    await flushPromises()
    expect(axios.put).toHaveBeenCalledWith('/conjuntos/8/arquivos/99')
    expect(linked.get(7)).toBe(true)
    expect(linked.get(8)).toBe(true)
    expect(w.find('.linked-file').text()).toContain('municipios.geojson')
    w.findComponent(components.VDialog).vm.$emit('update:modelValue', false)
    await flushPromises()
    await button(w, 'Remover vínculo').trigger('click')
    await flushPromises()
    expect(axios.delete).toHaveBeenCalledWith('/conjuntos/8/arquivos/99')
    expect(axios.delete).not.toHaveBeenCalledWith('/arquivos/99')
    expect(axios.post).not.toHaveBeenCalled()
    expect(linked.get(7)).toBe(true)
  })
  it('renames a dataset with only the supported name field', async () => {
    const w = await setup()
    await select(w, 7)
    await button(w, 'Renomear').trigger('click')
    await w.find('.rename-form input').setValue('Análise revisada')
    await w.find('.rename-form').trigger('submit')
    await flushPromises()
    expect(axios.put).toHaveBeenCalledWith('/conjuntos/7', { name: 'Análise revisada' })
    expect(w.find('.detail-heading').text()).toContain('Análise revisada')
    expect(w.find('.rename-form').exists()).toBe(false)
  })
  it('blocks deletion of nonempty datasets and confirms deletion of an empty one', async () => {
    const w = await setup()
    await select(w, 7)
    expect(button(w, 'Excluir conjunto vazio').attributes('disabled')).toBeDefined()
    await (w.vm as unknown as { remove: () => Promise<void> }).remove()
    expect(axios.delete).not.toHaveBeenCalled()
    await select(w, 8)
    await button(w, 'Excluir conjunto vazio').trigger('click')
    const confirm = w.findComponent(ConfirmDialog)
    expect(confirm.props('modelValue')).toBe(true)
    confirm.vm.$emit('update:modelValue', false)
    confirm.vm.$emit('confirm')
    await flushPromises()
    expect(axios.delete).toHaveBeenCalledWith('/conjuntos/8')
    expect(w.findAll('.dataset-item')).toHaveLength(1)
  })
  it('keeps membership API errors visible and does not claim a successful association', async () => {
    const w = await setup()
    await select(w, 8)
    await button(w, 'Adicionar arquivos').trigger('click')
    await flushPromises()
    w.findComponent(components.VSelect).vm.$emit('update:modelValue', 2)
    await flushPromises()
    vi.mocked(axios.put).mockRejectedValue({
      response: { data: 'Arquivo indisponível para associação.' },
    })
    await w
      .findAllComponents(components.VBtn)
      .find((b) => b.text() === 'Adicionar ao conjunto')!
      .trigger('click')
    await flushPromises()
    expect(w.text()).toContain('Arquivo indisponível para associação.')
    expect(w.findAll('.linked-file')).toHaveLength(0)
    expect(linked.get(8)).toBe(false)
  })
  it('ignores late structure responses after choosing another dataset', async () => {
    const w = await setup()
    let resolve!: (value: unknown) => void
    vi.mocked(axios.get).mockImplementation(async (path) =>
      path === '/conjuntos/7/estrutura'
        ? new Promise((r) => {
            resolve = r
          })
        : response(path),
    )
    await w.find('button[data-dataset-id="7"]').trigger('click')
    await select(w, 8)
    resolve({ data: structure(7) })
    await flushPromises()
    expect(w.find('.detail-heading').text()).toContain('Bacia Paraná')
    expect(w.findAll('.linked-file')).toHaveLength(0)
  })
  it('keeps auditors read-only without depending on the source catalog', async () => {
    setSessionUser({ id: 8, name: 'Auditor', userType: 'AUDITOR', userStatus: 1 })
    const w = await setup()
    await select(w, 7)
    expect(button(w, 'Novo conjunto')).toBeUndefined()
    expect(button(w, 'Renomear')).toBeUndefined()
    expect(button(w, 'Adicionar arquivos')).toBeUndefined()
    expect(button(w, 'Remover vínculo')).toBeUndefined()
    await (
      w.vm as unknown as { membership: (id: number, add: boolean) => Promise<void> }
    ).membership(99, false)
    expect(axios.delete).not.toHaveBeenCalled()
    expect(axios.get).not.toHaveBeenCalledWith('/fontes')
  })
  it('creates a dataset in one form submission using the current session user', async () => {
    const w = await setup()
    await button(w, 'Novo conjunto').trigger('click')
    await flushPromises()
    const editor = w.findComponent(DataSetDialog)
    const field = editor.findComponent(components.VTextField)
    await field.find('input').setValue('Novo conjunto ambiental')
    vi.mocked(axios.post).mockImplementation(async (path, body) => {
      const created = { id: 9, name: (body as { name: string }).name, userId: 7 }
      datasets.push(created)
      return { data: created, status: 201 }
    })
    await editor.findComponent(components.VForm).trigger('submit')
    await flushPromises()
    expect(axios.post).toHaveBeenCalledWith('/conjuntos', {
      name: 'Novo conjunto ambiental',
      userId: 7,
    })
    expect(w.find('.detail-heading').text()).toContain('Novo conjunto ambiental')
    expect(w.text()).toContain('Conjunto criado.')
    expect(w.findAllComponents(ConfirmDialog)).toHaveLength(1)
  })
  it('blocks an empty name and preserves creation input on API failure', async () => {
    const w = await setup()
    await button(w, 'Novo conjunto').trigger('click')
    await flushPromises()
    const editor = w.findComponent(DataSetDialog)
    const field = editor.findComponent(components.VTextField).find('input')
    await field.setValue('  ')
    await editor.findComponent(components.VForm).trigger('submit')
    await flushPromises()
    expect(axios.post).not.toHaveBeenCalled()
    await field.setValue('Análise em preparação')
    vi.mocked(axios.post).mockRejectedValue({
      response: { data: { detail: 'Não foi possível cadastrar o conjunto.' } },
    })
    await editor.findComponent(components.VForm).trigger('submit')
    await flushPromises()
    expect(editor.props('modelValue')).toBe(true)
    expect(field.element).toHaveProperty('value', 'Análise em preparação')
    expect(editor.findComponent(components.VAlert).text()).toContain(
      'Não foi possível cadastrar o conjunto.',
    )
  })
})
