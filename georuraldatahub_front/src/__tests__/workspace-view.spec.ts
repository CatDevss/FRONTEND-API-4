import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import axios from 'axios'
import Home from '@/views/HomeView.vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { setSessionUser } from '@/access/session'

enableAutoUnmount(afterEach)
vi.mock('axios', () => ({ default: { get: vi.fn(), isAxiosError: () => true } }))
const Container = defineComponent({ template: '<div><slot /></div>' })
const Button = defineComponent({
  props: ['disabled'],
  template: '<button :disabled="disabled"><slot /></button>',
})
const Tabs = defineComponent({
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template: '<div><slot /></div>',
})
const Checkbox = defineComponent({
  props: ['modelValue', 'disabled'],
  emits: ['update:modelValue'],
  template:
    '<input type="checkbox" :checked="modelValue" :disabled="disabled" @change="$emit(\'update:modelValue\', $event.target.checked)" />',
})
const reference = {
  fileId: 11,
  name: 'Feições municipais',
  formatFile: 'geojson',
  size: 5,
  receivedDate: '2026-10-20T12:00:00',
}
const file = {
  id: 11,
  name: 'municipios.geojson',
  formatFile: 'geojson',
  size: 5,
  receivedDate: '2026-10-20T12:00:00',
  ingestionId: 2,
  dictionaryId: 3,
  dictionaryVersion: 1,
  layers: [reference],
}
async function setup(options: { empty?: boolean; noLayers?: boolean } = {}) {
  vi.mocked(axios.get).mockImplementation(async (path) => ({
    data:
      path === '/conjuntos'
        ? [{ id: 1, name: 'Paraná integrado', userId: 1 }]
        : path.endsWith('/camadas')
          ? options.noLayers || options.empty
            ? []
            : [reference]
          : {
              id: 1,
              name: 'Paraná integrado',
              userId: 1,
              sources: options.empty
                ? []
                : [
                    {
                      id: 7,
                      name: 'IBGE',
                      url: 'https://www.ibge.gov.br/',
                      files: [
                        options.noLayers ? { ...file, layers: [] } : file,
                        { ...file, id: 12, name: 'dados_sem_geometria.csv', layers: [] },
                      ],
                    },
                  ],
            },
  }))
  const pinia = createPinia()
  setActivePinia(pinia)
  const workspace = useWorkspaceStore()
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/home', component: Container }],
  })
  await router.push('/home')
  const wrapper = mount(Home, {
    global: {
      plugins: [pinia, router],
      stubs: {
        VCard: Container,
        VBtn: Button,
        VTabs: Tabs,
        VTab: Container,
        VAlert: Container,
        VIcon: true,
        VProgressLinear: true,
        VProgressCircular: true,
        VSlider: true,
        VCheckboxBtn: Checkbox,
        VSpacer: true,
        WorkspaceMap: true,
        WorkspaceFilesDialog: true,
        ConfirmDialog: true,
      },
    },
  })
  await flushPromises()
  await wrapper.find('button.dataset-row').trigger('click')
  await flushPromises()
  return { wrapper, workspace }
}
beforeEach(() => {
  vi.clearAllMocks()
  setSessionUser({ id: 1, name: 'Operador', userType: 'OPERADOR', userStatus: 1 })
})
describe('workspace explorer and tabs', () => {
  it('shows dataset → source → file → layer and keeps files with no layer in the explorer', async () => {
    const { wrapper, workspace } = await setup()
    expect(wrapper.find('.dataset-row').text()).toBe('Paraná integrado')
    expect(wrapper.find('details.source-node > summary').text()).toBe('IBGE')
    expect(wrapper.findAll('details.file-node')).toHaveLength(2)
    expect(wrapper.text()).toContain('dados_sem_geometria.csv')
    expect(wrapper.find('.layer-name').text()).toBe('Feições municipais')
    expect(wrapper.text()).toContain('Sem referência de visualização')
    await wrapper.find('input[type="checkbox"]').setValue(true)
    expect(workspace.isVisible(11)).toBe(true)
  })
  it('shows Medidores without requesting or calculating indicators', async () => {
    const { wrapper, workspace } = await setup()
    wrapper.findComponent(Tabs).vm.$emit('update:modelValue', 'meters')
    await flushPromises()
    expect(workspace.activeTab).toBe('meters')
    expect(wrapper.text()).toContain('Medidores ainda não disponíveis')
    expect(wrapper.text()).toContain('Nenhum indicador é calculado no navegador')
    expect(
      vi
        .mocked(axios.get)
        .mock.calls.every(
          ([path]) =>
            path === '/conjuntos' || path.endsWith('/estrutura') || path.endsWith('/camadas'),
        ),
    ).toBe(true)
  })
  it('distinguishes an empty dataset from files without references', async () => {
    const { wrapper } = await setup({ empty: true })
    expect(wrapper.text()).toContain('Conjunto vazio')
    expect(wrapper.findAll('details.file-node')).toHaveLength(0)
  })
  it('explains absence of visualization while preserving the file tree', async () => {
    const { wrapper } = await setup({ noLayers: true })
    expect(wrapper.text()).toContain('nenhuma referência de visualização disponível')
    expect(wrapper.findAll('details.file-node')).toHaveLength(2)
    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(0)
  })
  it('keeps auditors in read-only mode', async () => {
    setSessionUser({ id: 9, name: 'Auditor', userType: 'AUDITOR', userStatus: 1 })
    const { wrapper } = await setup()
    expect(wrapper.findAll('button').some((b) => b.text() === 'Adicionar arquivos')).toBe(false)
    expect(wrapper.text()).not.toContain('Remover vínculo')
  })
})
