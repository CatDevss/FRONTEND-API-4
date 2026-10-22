import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import axios from 'axios'
import Dictionaries from '@/views/DictionariesView.vue'
import Sources from '@/views/SourcesView.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { setSessionUser } from '@/access/session'
import type { Dictionary } from '@/services/contracts'

enableAutoUnmount(afterEach)
vi.mock('axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), isAxiosError: () => true },
}))
const Empty = defineComponent({ template: '<div />' })
const sources = [
  { id: 2, name: 'IBGE', url: 'https://www.ibge.gov.br/' },
  { id: 3, name: 'INPE', url: 'https://www.inpe.br/' },
]
const used: Dictionary = {
  id: 10,
  sourceId: 2,
  name: 'Malha municipal',
  description: 'Campos oficiais',
  version: 1,
  status: 'UTILIZADO',
  createdOn: '2026-10-20T12:00:00',
  rules: [{ name: 'codigo', type: 'STRING', required: true, unique: true, domain: [] }],
}
const draft: Dictionary = { ...used, id: 11, version: 2, status: 'RASCUNHO' }
let dictionaries: Dictionary[]
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
    width: 1024,
    height: 768,
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
  setSessionUser({ id: 7, name: 'Gestora', userType: 'GESTOR', userStatus: 1 })
  dictionaries = structuredClone([used, draft])
  vi.mocked(axios.get).mockImplementation(async (path) => ({
    data: path === '/fontes' ? sources : path === '/fontes/2/dicionarios' ? dictionaries : [],
  }))
})
afterEach(() => {
  setSessionUser(null)
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})
async function setup(path = '/dictionaries?source=2', view = Dictionaries) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/dictionaries', component: Dictionaries },
      { path: '/sources', component: view === Sources ? Sources : Empty },
    ],
  })
  await router.push(path)
  const root = mount(defineComponent({ template: '<router-view />' }), {
    attachTo: document.body,
    global: {
      plugins: [router, createVuetify({ components, directives, theme: { defaultTheme: 'dark' } })],
    },
  })
  await flushPromises()
  const wrapper = root.findComponent(view)
  return { wrapper, router }
}
const button = (w: Awaited<ReturnType<typeof setup>>['wrapper'], label: string) =>
  w.findAll('button').find((b) => b.text() === label)!
const input = (w: Awaited<ReturnType<typeof setup>>['wrapper'], label: string) =>
  w.find(`input[aria-label="${label}"]`)

describe('dictionary workbench with Vuetify controls', () => {
  it('opens the source link and selects the latest version in a stable order', async () => {
    const { wrapper } = await setup()
    expect(axios.get).toHaveBeenCalledWith('/fontes/2/dicionarios')
    expect(wrapper.findAll('.version-item').map((v) => v.text())).toEqual([
      expect.stringContaining('v2'),
      expect.stringContaining('v1'),
    ])
    expect(wrapper.find('.version-item.selected').text()).toContain('v2')
    expect(wrapper.find('.dictionary-sidebar').text()).toContain('https://www.ibge.gov.br/')
    expect(input(wrapper, 'Nome do campo 1').element).toHaveProperty('value', 'codigo')
  })
  it('creates a dictionary from compact fields using the exact DTO without UI keys', async () => {
    const { wrapper } = await setup()
    await button(wrapper, 'Novo dicionário').trigger('click')
    await wrapper.find('.dictionary-metadata input').setValue('Regras novas')
    await input(wrapper, 'Nome do campo 1').setValue('municipio')
    vi.mocked(axios.post).mockResolvedValue({
      data: { ...draft, id: 12, name: 'Regras novas', version: 3 },
    })
    await button(wrapper, 'Salvar dicionário').trigger('click')
    await flushPromises()
    expect(axios.post).toHaveBeenCalledWith('/fontes/2/dicionarios', {
      name: 'Regras novas',
      description: '',
      rules: [{ name: 'municipio', type: 'STRING', required: false, unique: false, domain: [] }],
    })
    expect(wrapper.text()).toContain('Dicionário salvo. Versão 3')
    expect(wrapper.find('.version-item.selected').text()).toContain('v3')
  })
  it('preserves field edits and the exact API error when saving fails', async () => {
    const { wrapper } = await setup()
    await button(wrapper, 'Editar').trigger('click')
    await input(wrapper, 'Nome do campo 1').setValue('codigo_corrigido')
    vi.mocked(axios.put).mockRejectedValue({
      response: { data: { detail: 'Estrutura excede o limite do banco.' } },
    })
    await button(wrapper, 'Salvar dicionário').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Estrutura excede o limite do banco.')
    expect(input(wrapper, 'Nome do campo 1').element).toHaveProperty('value', 'codigo_corrigido')
  })
  it('blocks edits to used versions and creates a real new version from their rules', async () => {
    const { wrapper } = await setup()
    await wrapper.findAll('.version-item')[1]!.trigger('click')
    expect(button(wrapper, 'Editar').attributes('disabled')).toBeDefined()
    expect(button(wrapper, 'Excluir').attributes('disabled')).toBeDefined()
    vi.mocked(axios.post).mockResolvedValue({ data: { ...draft, id: 12, version: 3 } })
    await button(wrapper, 'Criar nova versão').trigger('click')
    await flushPromises()
    expect(axios.post).toHaveBeenCalledWith('/dicionarios/10/versoes')
    expect(wrapper.text()).toContain('Versão 3 criada com os campos da versão 1')
    expect(input(wrapper, 'Nome do campo 1').attributes('readonly')).toBeUndefined()
  })

  it('updates only the selected draft using the dictionary contract', async () => {
    const { wrapper } = await setup()
    await button(wrapper, 'Editar').trigger('click')
    await input(wrapper, 'Nome do campo 1').setValue('codigo_atualizado')
    vi.mocked(axios.put).mockResolvedValue({
      data: { ...draft, rules: [{ ...draft.rules[0]!, name: 'codigo_atualizado' }] },
    })
    await button(wrapper, 'Salvar dicionário').trigger('click')
    await flushPromises()
    expect(axios.put).toHaveBeenCalledWith('/dicionarios/11', {
      name: draft.name,
      description: draft.description,
      rules: [{ ...draft.rules[0], name: 'codigo_atualizado' }],
    })
    expect(axios.post).not.toHaveBeenCalled()
  })
  it('reloads use status on a conflict and locks the editor without losing the API message', async () => {
    const { wrapper } = await setup()
    await button(wrapper, 'Editar').trigger('click')
    await input(wrapper, 'Nome do campo 1').setValue('codigo_alterado')
    dictionaries[1]!.status = 'UTILIZADO'
    vi.mocked(axios.put).mockRejectedValue({
      response: { data: 'Dicionário já utilizado em validações.' },
    })
    await button(wrapper, 'Salvar dicionário').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Dicionário já utilizado em validações.')
    expect(input(wrapper, 'Nome do campo 1').attributes('readonly')).toBeDefined()
    expect(button(wrapper, 'Salvar dicionário')).toBeUndefined()
  })
  it('deletes the confirmed draft and selects the remaining version', async () => {
    const { wrapper } = await setup()
    vi.mocked(axios.delete).mockImplementation(async () => {
      dictionaries = [used]
      return { status: 204 }
    })
    await button(wrapper, 'Excluir').trigger('click')
    const confirm = wrapper.findAllComponents(ConfirmDialog)[0]!
    expect(confirm.props('modelValue')).toBe(true)
    confirm.vm.$emit('update:modelValue', false)
    confirm.vm.$emit('confirm')
    await flushPromises()
    expect(axios.delete).toHaveBeenCalledWith('/dicionarios/11')
    expect(wrapper.findAll('.version-item')).toHaveLength(1)
    expect(wrapper.find('.version-item.selected').text()).toContain('v1')
  })
  it('reports duplicate field names before sending anything to the API', async () => {
    const { wrapper } = await setup()
    await button(wrapper, 'Editar').trigger('click')
    await button(wrapper, 'Adicionar campo').trigger('click')
    await input(wrapper, 'Nome do campo 2').setValue('codigo')
    await button(wrapper, 'Salvar dicionário').trigger('click')
    expect(wrapper.text()).toContain('Este nome já foi usado.')
    expect(axios.put).not.toHaveBeenCalled()
  })
  it('asks before switching versions with unsaved edits and can keep or discard them', async () => {
    const { wrapper } = await setup()
    await button(wrapper, 'Editar').trigger('click')
    await input(wrapper, 'Nome do campo 1').setValue('nao_salvo')
    await wrapper.findAll('.version-item')[1]!.trigger('click')
    const confirm = wrapper.findAllComponents(ConfirmDialog)[1]!
    expect(confirm.props('modelValue')).toBe(true)
    expect(input(wrapper, 'Nome do campo 1').element).toHaveProperty('value', 'nao_salvo')
    confirm.vm.$emit('update:modelValue', false)
    await flushPromises()
    expect(wrapper.find('.version-item.selected').text()).toContain('v2')
    await wrapper.findAll('.version-item')[1]!.trigger('click')
    confirm.vm.$emit('update:modelValue', false)
    confirm.vm.$emit('confirm')
    await flushPromises()
    expect(wrapper.find('.version-item.selected').text()).toContain('v1')
    expect(input(wrapper, 'Nome do campo 1').element).toHaveProperty('value', 'codigo')
  })
  it('blocks route navigation until unsaved changes are explicitly discarded', async () => {
    const { wrapper, router } = await setup()
    await button(wrapper, 'Editar').trigger('click')
    await input(wrapper, 'Nome do campo 1').setValue('alterado')
    const navigating = router.push('/sources')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/dictionaries')
    const confirm = wrapper.findAllComponents(ConfirmDialog)[1]!
    expect(confirm.props('modelValue')).toBe(true)
    confirm.vm.$emit('update:modelValue', false)
    confirm.vm.$emit('confirm')
    await navigating
    expect(router.currentRoute.value.path).toBe('/sources')
  })
  it('keeps auditors in read-only mode', async () => {
    setSessionUser({ id: 12, name: 'Auditor', userType: 'AUDITOR', userStatus: 1 })
    const { wrapper } = await setup()
    expect(button(wrapper, 'Editar')).toBeUndefined()
    expect(button(wrapper, 'Novo dicionário')).toBeUndefined()
    expect(button(wrapper, 'Criar nova versão')).toBeUndefined()
    expect(input(wrapper, 'Nome do campo 1').attributes('readonly')).toBeDefined()
  })
  it('never reuses another source’s versions after a failed request', async () => {
    const { wrapper } = await setup()
    vi.mocked(axios.get).mockRejectedValue({ response: { data: 'Fonte indisponível' } })
    wrapper.findComponent(components.VSelect).vm.$emit('update:modelValue', 3)
    await flushPromises()
    expect(wrapper.text()).toContain('Fonte indisponível')
    expect(wrapper.findAll('.version-item')).toHaveLength(0)
    expect(button(wrapper, 'Editar')).toBeUndefined()
  })
  it('ignores late results from a source that was already replaced', async () => {
    const { wrapper } = await setup('/dictionaries')
    let resolve!: (value: unknown) => void
    vi.mocked(axios.get).mockImplementation((path) =>
      path === '/fontes/2/dicionarios'
        ? new Promise((r) => {
            resolve = r
          })
        : Promise.resolve({ data: [] }),
    )
    wrapper.findComponent(components.VSelect).vm.$emit('update:modelValue', 2)
    await flushPromises()
    wrapper.findComponent(components.VSelect).vm.$emit('update:modelValue', 3)
    await flushPromises()
    resolve({ data: [used] })
    await flushPromises()
    expect(wrapper.findAll('.version-item')).toHaveLength(0)
    expect(wrapper.text()).not.toContain('Malha municipal')
  })
})

describe('source discovery and dictionary shortcuts', () => {
  it('filters sources and links to the corresponding dictionary workspace', async () => {
    const { wrapper } = await setup('/sources', Sources)
    await wrapper.find('input').setValue('IBGE')
    expect(wrapper.findAll('.source-row')).toHaveLength(1)
    expect(wrapper.find('.source-row a').attributes('href')).toBe('/dictionaries?source=2')
    await wrapper.find('input').setValue('inexistente')
    expect(wrapper.text()).toContain('Nenhuma fonte encontrada')
  })
})
