import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { defineComponent, onMounted, onBeforeUnmount } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import axios from 'axios'
import Home from '@/views/HomeView.vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { setSessionUser } from '@/access/session'
import type { TreatmentExecution } from '@/services/processing'

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
const mapCalls = { mount: vi.fn(), unmount: vi.fn(), fit: vi.fn(), reset: vi.fn() }
const MapSurface = defineComponent({
  props: ['visible', 'insets'],
  setup(_, { expose }) {
    onMounted(mapCalls.mount)
    onBeforeUnmount(mapCalls.unmount)
    expose({ fitVisibleLayers: mapCalls.fit, resetView: mapCalls.reset })
  },
  template: '<div class="test-map" />',
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
async function setup(
  options: {
    empty?: boolean
    noLayers?: boolean
    treatment?: TreatmentExecution
    query?: string
  } = {},
) {
  vi.mocked(axios.get).mockImplementation(async (path) => ({
    data: path.startsWith('/tratamentos/')
      ? options.treatment
      : path === '/conjuntos'
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
  await router.push(`/home${options.query ?? ''}`)
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
        WorkspaceMap: MapSurface,
        WorkspaceFilesDialog: true,
        ConfirmDialog: true,
      },
    },
  })
  await flushPromises()
  if (workspace.selectedDatasetId === null)
    await wrapper.find('button.dataset-row').trigger('click')
  await flushPromises()
  return { wrapper, workspace }
}
beforeEach(() => {
  vi.clearAllMocks()
  setSessionUser({ id: 1, name: 'Operador', userType: 'OPERADOR', userStatus: 1 })
})
describe('workspace explorer and tabs', () => {
  it('restores a treatment link by fetching the execution and registers the exact layer', async () => {
    const treatment: TreatmentExecution = {
      id: 50,
      fileId: 11,
      userId: 1,
      inputVersionId: 1,
      outputVersionId: 2,
      status: 'CONCLUIDO',
      startedAt: null,
      finishedAt: null,
      layerId: 11,
      rasterId: null,
      inputCount: 1,
      outputCount: 1,
      error: null,
      parameters: { request: { datasetId: 1 } },
      provenance: null,
    }
    const { wrapper, workspace } = await setup({ query: '?dataset=1&treatment=50', treatment })
    expect(axios.get).toHaveBeenCalledWith('/tratamentos/50')
    expect(workspace.isVisible(-11)).toBe(true)
    expect(workspace.isVisible(11)).toBe(false)
    expect(wrapper.text()).toContain('tratamento 50 · camada 11')
    expect(wrapper.text()).toContain('Tratada · camada 11 · versão ID 2')
    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(2)
  })
  it('does not add a treatment belonging to another dataset', async () => {
    const treatment: TreatmentExecution = {
      id: 50,
      fileId: 11,
      userId: 1,
      inputVersionId: 1,
      outputVersionId: 2,
      status: 'CONCLUIDO',
      startedAt: null,
      finishedAt: null,
      layerId: 11,
      rasterId: null,
      inputCount: 1,
      outputCount: 1,
      error: null,
      parameters: { request: { datasetId: 2 } },
      provenance: null,
    }
    const { wrapper, workspace } = await setup({ query: '?dataset=1&treatment=50', treatment })
    expect(workspace.visibleLayerIds).toEqual([])
    expect(wrapper.text()).toContain('não disponibiliza uma camada concluída vinculada')
  })
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
  it('hides and restores the explorer without losing layers or remounting the map', async () => {
    const { wrapper, workspace } = await setup()
    await wrapper.find('input[type="checkbox"]').setValue(true)
    workspace.setOpacity(11, 0.55)
    const map = wrapper.findComponent(MapSurface).element
    const calls = vi.mocked(axios.get).mock.calls.length
    await wrapper
      .find('.workspace-toolbar button[aria-label="Ocultar explorador"]')
      .trigger('click')
    expect(wrapper.find('#workspace-explorer').attributes('style')).toContain('display: none')
    expect(wrapper.findComponent(MapSurface).element).toBe(map)
    await wrapper
      .find('.workspace-toolbar button[aria-label="Mostrar explorador"]')
      .trigger('click')
    expect(wrapper.find('input[type="checkbox"]').element).toHaveProperty('checked', true)
    expect(workspace.selectedDatasetId).toBe(1)
    expect(workspace.getOpacity(11)).toBe(0.55)
    expect(mapCalls.mount).toHaveBeenCalledOnce()
    expect(mapCalls.unmount).not.toHaveBeenCalled()
    expect(axios.get).toHaveBeenCalledTimes(calls)
  })
  it('keeps the map instance and layer preferences when switching tabs', async () => {
    const { wrapper, workspace } = await setup()
    workspace.setVisibility(11, true)
    const map = wrapper.findComponent(MapSurface).element
    wrapper.findComponent(Tabs).vm.$emit('update:modelValue', 'meters')
    await flushPromises()
    expect(wrapper.findComponent(MapSurface).props('visible')).toBe(false)
    wrapper.findComponent(Tabs).vm.$emit('update:modelValue', 'map')
    await flushPromises()
    expect(wrapper.findComponent(MapSurface).element).toBe(map)
    expect(wrapper.findComponent(MapSurface).props('visible')).toBe(true)
    expect(workspace.visibleLayerIds).toEqual([11])
    expect(mapCalls.mount).toHaveBeenCalledOnce()
  })
  it('keeps layer and API errors visible when their explorer panel is hidden', async () => {
    const { wrapper, workspace } = await setup()
    workspace.runtime[11] = { loading: false, featureCount: null, error: 'Geometria indisponível.' }
    workspace.structureError = 'Estrutura indisponível.'
    await wrapper
      .find('.workspace-toolbar button[aria-label="Ocultar explorador"]')
      .trigger('click')
    expect(wrapper.find('.workspace-messages').text()).toContain('Geometria indisponível.')
    expect(wrapper.find('.workspace-messages').text()).toContain('Estrutura indisponível.')
  })
  it('keeps the fitting, Paraná and membership actions connected to the floating controls', async () => {
    const { wrapper, workspace } = await setup()
    const fit = wrapper.findAll('button').find((b) => b.text() === 'Enquadrar camadas')!
    expect(fit.attributes('disabled')).toBeDefined()
    workspace.setVisibility(11, true)
    await flushPromises()
    await fit.trigger('click')
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Ver Paraná')!
      .trigger('click')
    expect(mapCalls.fit).toHaveBeenCalledOnce()
    expect(mapCalls.reset).toHaveBeenCalledOnce()
    await wrapper.find('button[aria-label="Adicionar arquivos"]').trigger('click')
    expect(wrapper.findComponent({ name: 'WorkspaceFilesDialog' }).props('modelValue')).toBe(true)
  })
  it('updates fitting insets for side panels, bottom panels and a hidden explorer', async () => {
    const { wrapper } = await setup()
    const rect = (left: number, top: number, width: number, height: number) =>
      ({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRect
    vi.spyOn(wrapper.find('.workspace').element, 'getBoundingClientRect').mockReturnValue(
      rect(0, 0, 1000, 800),
    )
    vi.spyOn(wrapper.find('.workspace-toolbar').element, 'getBoundingClientRect').mockReturnValue(
      rect(16, 16, 968, 60),
    )
    vi.spyOn(wrapper.find('.workspace-footer').element, 'getBoundingClientRect').mockReturnValue(
      rect(16, 680, 800, 80),
    )
    const explorerRect = vi
      .spyOn(wrapper.find('#workspace-explorer').element, 'getBoundingClientRect')
      .mockReturnValue(rect(16, 90, 300, 580))
    window.dispatchEvent(new Event('resize'))
    await flushPromises()
    expect(wrapper.findComponent(MapSurface).props('insets')).toEqual({
      top: 76,
      right: 64,
      left: 316,
      bottom: 120,
    })
    explorerRect.mockReturnValue(rect(12, 450, 976, 250))
    window.dispatchEvent(new Event('resize'))
    await flushPromises()
    expect(wrapper.findComponent(MapSurface).props('insets')).toEqual({
      top: 76,
      right: 64,
      left: 0,
      bottom: 350,
    })
    await wrapper
      .find('.workspace-toolbar button[aria-label="Ocultar explorador"]')
      .trigger('click')
    await flushPromises()
    expect(wrapper.findComponent(MapSurface).props('insets')).toEqual({
      top: 76,
      right: 64,
      left: 0,
      bottom: 120,
    })
  })
})
