import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, ref } from 'vue'
import type { Feature, FeatureCollection } from 'geojson'
import axios from 'axios'
import WorkspaceMap from '@/components/workspace/WorkspaceMap.vue'
import type { MapInspection } from '@/services/mapInspection'
import { useWorkspaceStore } from '@/stores/workspace'
import type { DatasetStructure, LayerReference } from '@/services/contracts'

enableAutoUnmount(afterEach)
const leaflet = vi.hoisted(() => {
  const attached = new Set<unknown>()
  const map = {
    fitBounds: vi.fn().mockReturnThis(),
    closePopup: vi.fn(),
    hasLayer: vi.fn((layer: unknown) => attached.has(layer)),
    on: vi.fn(),
    latLngToContainerPoint: vi.fn((position: { lat: number; lng: number } | number[]) => ({
      x: (Array.isArray(position) ? position[1]! : position.lng) * 100,
      y: -(Array.isArray(position) ? position[0]! : position.lat) * 100,
    })),
    containerPointToLatLng: vi.fn((pixel: number[]) => ({
      lng: pixel[0]! / 100,
      lat: -pixel[1]! / 100,
    })),
    invalidateSize: vi.fn(),
    remove: vi.fn(),
  }
  function bounds(initial: unknown[] = []) {
    let valid = initial.length > 0
    return {
      extend: vi.fn().mockImplementation(() => {
        valid = true
      }),
      isValid: vi.fn(() => valid),
    }
  }
  const groups: {
    addTo: ReturnType<typeof vi.fn>
    remove: ReturnType<typeof vi.fn>
    setStyle: ReturnType<typeof vi.fn>
    getBounds: ReturnType<typeof vi.fn>
  }[] = []
  const geoJSON = vi.fn(() => {
    const group = {
      addTo: vi.fn().mockImplementation(() => {
        attached.add(group)
        return group
      }),
      remove: vi.fn().mockImplementation(() => attached.delete(group)),
      setStyle: vi.fn(),
      getBounds: vi.fn(() => bounds([1])),
    }
    groups.push(group)
    return group
  })
  const control = Object.assign(vi.fn(), {
    layers: vi.fn(() => ({ addTo: vi.fn() })),
    scale: vi.fn(() => ({ addTo: vi.fn() })),
    zoom: vi.fn(() => ({ addTo: vi.fn() })),
  })
  const lib = {
    map: vi.fn(() => map),
    latLngBounds: vi.fn(bounds),
    geoJSON,
    tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
    circleMarker: vi.fn(() => ({
      addTo: vi.fn().mockReturnThis(),
      remove: vi.fn(),
      bringToFront: vi.fn(),
    })),
    control,
  }
  return { map, lib, groups, attached }
})
vi.mock('leaflet', () => ({ default: leaflet.lib }))
vi.mock('axios', () => ({ default: { get: vi.fn(), isAxiosError: () => true } }))
const reference = (id: number): LayerReference => ({
  fileId: id,
  name: `Camada ${id}`,
  formatFile: 'geojson',
  size: 12,
  receivedDate: '2026-10-20T12:00:00',
})
function tree(id: number, files: number[]): DatasetStructure {
  return {
    id,
    name: 'Conjunto',
    userId: 1,
    sources: [
      {
        id: 1,
        name: 'Fonte',
        url: 'https://www.ibge.gov.br/',
        files: files.map((fileId) => ({
          id: fileId,
          name: `Arquivo ${fileId}`,
          formatFile: 'geojson',
          size: 12,
          receivedDate: '2026-10-20T12:00:00',
          ingestionId: 1,
          dictionaryId: 1,
          dictionaryVersion: 1,
          layers: [reference(fileId)],
        })),
      },
    ],
  }
}
const features: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-49, -25] },
      properties: { nome: '<img src=x onerror=alert(1)>', id: 1 },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-49, -25],
          [-50, -24],
        ],
      },
      properties: { nome: 'Linha' },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-49, -25],
            [-50, -25],
            [-49, -24],
            [-49, -25],
          ],
        ],
      },
      properties: { nome: 'Polígono' },
    },
  ],
}
function deferred() {
  let resolve!: (response: { data: FeatureCollection }) => void
  const promise = new Promise<{ data: FeatureCollection }>((r) => {
    resolve = r
  })
  return { promise, resolve }
}
function setup(ids = [11]) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const workspace = useWorkspaceStore()
  workspace.selectedDatasetId = 1
  workspace.structure = tree(1, ids)
  workspace.references = ids.map(reference)
  for (const id of ids) workspace.setVisibility(id, true)
  const wrapper = mount(WorkspaceMap, {
    props: { visible: true },
    global: { plugins: [pinia], stubs: { VChip: true, VAlert: true } },
  })
  return { workspace, wrapper, pinia }
}
beforeEach(() => {
  vi.clearAllMocks()
  leaflet.groups.length = 0
  leaflet.attached.clear()
  vi.mocked(axios.get).mockImplementation(async (path) => ({
    data: path.endsWith('/estrutura')
      ? tree(2, [21])
      : path.endsWith('/camadas')
        ? [reference(21)]
        : features,
  }))
})
describe('Leaflet workspace lifecycle', () => {
  it('gives spaced file IDs distinct colors and keeps them when toggling or reordering layers', async () => {
    const ids = [11, 59, 107]
    const { workspace } = setup(ids)
    await flushPromises()
    const colors = ids.map((id) => workspace.colorFor(id))
    expect(new Set(colors).size).toBe(ids.length)
    workspace.setVisibility(11, false)
    workspace.references = [...workspace.references].reverse()
    await flushPromises()
    expect(ids.map((id) => workspace.colorFor(id))).toEqual(colors)
    workspace.setVisibility(11, true)
    await flushPromises()
    expect(ids.map((id) => workspace.colorFor(id))).toEqual(colors)
  })

  it('passes points, lines and polygons to Leaflet and toggles cached layers', async () => {
    const { workspace } = setup()
    await flushPromises()
    expect(leaflet.lib.geoJSON).toHaveBeenCalledOnce()
    const args = leaflet.lib.geoJSON.mock.calls[0] as unknown as [
      FeatureCollection,
      {
        pointToLayer: (f: Feature, position: unknown) => unknown
      },
    ]
    expect(args[0].features.map((f) => f.geometry.type)).toEqual(['Point', 'LineString', 'Polygon'])
    args[1].pointToLayer(features.features[0]!, { lat: -25, lng: -49 })
    expect(leaflet.lib.circleMarker).toHaveBeenCalledWith(
      { lat: -25, lng: -49 },
      expect.objectContaining({ radius: 5 }),
    )
    expect(leaflet.groups[0]?.addTo).toHaveBeenCalledOnce()
    workspace.setVisibility(11, false)
    await flushPromises()
    expect(leaflet.groups[0]?.remove).toHaveBeenCalled()
    workspace.setVisibility(11, true)
    await flushPromises()
    expect(leaflet.groups[0]?.addTo).toHaveBeenCalledTimes(2)
    expect(axios.get).toHaveBeenCalledTimes(1)
  })
  it('inspects every visible overlapping layer, updates visibility, and clears on dataset change', async () => {
    const { workspace, wrapper } = setup([11, 12])
    await flushPromises()
    const click = leaflet.map.on.mock.calls.find((call) => call[0] === 'click')![1]
    click({ latlng: { lat: -25, lng: -49 } })
    const result = () => wrapper.emitted('inspect')?.slice(-1)[0]?.[0] as MapInspection | null
    expect(result()?.groups.map((group) => group.fileId)).toEqual([11, 12])
    expect(result()?.groups.every((group) => group.features.length === 3)).toBe(true)
    expect(result()?.groups[0]?.features[0]?.properties?.nome).toContain('<img')
    workspace.setVisibility(12, false)
    await flushPromises()
    expect(result()?.groups.map((group) => group.fileId)).toEqual([11])
    click({ latlng: { lat: 0, lng: 0 } })
    expect(result()?.groups).toEqual([])
    click({ latlng: { lat: -25, lng: -49 } })
    wrapper.vm.closeInspection()
    expect(result()).toBeNull()
    click({ latlng: { lat: -25, lng: -49 } })
    await workspace.selectDataset(2)
    expect(result()).toBeNull()
  })

  it('updates the clicked location when pending layers finish without another click', async () => {
    const slow = deferred()
    vi.mocked(axios.get).mockReturnValue(slow.promise)
    const { wrapper } = setup([11])
    const click = leaflet.map.on.mock.calls.find((call) => call[0] === 'click')![1]
    click({ latlng: { lat: -25, lng: -49 } })
    const result = () => wrapper.emitted('inspect')?.slice(-1)[0]?.[0] as MapInspection
    expect(result().pending).toEqual(['Camada 11'])
    slow.resolve({ data: features })
    await flushPromises()
    expect(result().pending).toEqual([])
    expect(result().groups).toHaveLength(1)
    expect(axios.get).toHaveBeenCalledOnce()
  })

  it('reports a failed layer instead of presenting an incomplete query as complete', async () => {
    const slow = deferred()
    vi.mocked(axios.get).mockReturnValue(slow.promise)
    const { wrapper } = setup([11])
    const click = leaflet.map.on.mock.calls.find((call) => call[0] === 'click')![1]
    click({ latlng: { lat: -25, lng: -49 } })
    slow.resolve({ data: null as unknown as FeatureCollection })
    await flushPromises()
    const result = wrapper.emitted('inspect')?.slice(-1)[0]?.[0] as MapInspection
    expect(result.failed).toEqual(['Camada 11'])
    expect(result.pending).toEqual([])
    expect(result.groups).toEqual([])
  })

  it('aborts and ignores a late geometry response after changing dataset', async () => {
    const slow = deferred()
    vi.mocked(axios.get).mockImplementation(async (path) =>
      path === '/arquivos/11/geojson'
        ? slow.promise
        : { data: path.endsWith('/estrutura') ? tree(2, [21]) : [reference(21)] },
    )
    const { workspace } = setup()
    await flushPromises()
    const options = vi.mocked(axios.get).mock.calls[0]![1]
    await workspace.selectDataset(2)
    expect(options?.signal?.aborted).toBe(true)
    slow.resolve({ data: features })
    await flushPromises()
    expect(leaflet.lib.geoJSON).not.toHaveBeenCalled()
    expect(workspace.runtime[11]).toBeUndefined()
    expect(leaflet.attached.size).toBe(0)
  })
  it('does not display a layer switched off while its request is pending', async () => {
    const slow = deferred()
    vi.mocked(axios.get).mockReturnValue(slow.promise)
    const { workspace } = setup()
    workspace.setVisibility(11, false)
    slow.resolve({ data: features })
    await flushPromises()
    expect(leaflet.groups[0]?.addTo).not.toHaveBeenCalled()
    workspace.setVisibility(11, true)
    await flushPromises()
    expect(leaflet.groups[0]?.addTo).toHaveBeenCalledOnce()
    expect(axios.get).toHaveBeenCalledTimes(1)
  })
  it('overlays multiple layers and fits only the visible loaded extents', async () => {
    const { workspace, wrapper } = setup([11, 12])
    await flushPromises()
    expect(leaflet.attached.size).toBe(2)
    wrapper.vm.fitVisibleLayers()
    expect(
      leaflet.lib.latLngBounds.mock.results[leaflet.lib.latLngBounds.mock.results.length - 1]?.value
        .extend,
    ).toHaveBeenCalledTimes(2)
    workspace.setVisibility(12, false)
    await flushPromises()
    wrapper.vm.fitVisibleLayers()
    expect(
      leaflet.lib.latLngBounds.mock.results[leaflet.lib.latLngBounds.mock.results.length - 1]?.value
        .extend,
    ).toHaveBeenCalledTimes(1)
    expect(leaflet.attached.size).toBe(1)
  })
  it('keeps API failures visible and resets the failed checkbox', async () => {
    vi.mocked(axios.get).mockRejectedValue({
      response: { data: 'CSV sem coordenadas reconhecidas.' },
    })
    const { workspace } = setup()
    await flushPromises()
    expect(workspace.runtime[11]?.error).toBe('CSV sem coordenadas reconhecidas.')
    expect(workspace.isVisible(11)).toBe(false)
    expect(leaflet.lib.geoJSON).not.toHaveBeenCalled()
  })
  it('releases map instances and ignores pending work on unmount without clearing Pinia preferences', async () => {
    const slow = deferred()
    vi.mocked(axios.get).mockReturnValue(slow.promise)
    const { wrapper, workspace } = setup()
    await flushPromises()
    wrapper.unmount()
    slow.resolve({ data: features })
    await flushPromises()
    expect(leaflet.map.remove).toHaveBeenCalled()
    expect(leaflet.lib.geoJSON).not.toHaveBeenCalled()
    expect(workspace.selectedDatasetId).toBe(1)
    expect(workspace.isVisible(11)).toBe(true)
  })
  it('fits loaded layers and Paraná inside the space not covered by floating panels', async () => {
    const { wrapper } = setup()
    await flushPromises()
    await wrapper.setProps({ insets: { left: 330, top: 76, right: 64, bottom: 120 } })
    wrapper.vm.fitVisibleLayers()
    expect(leaflet.map.fitBounds).toHaveBeenLastCalledWith(expect.anything(), {
      paddingTopLeft: [354, 100],
      paddingBottomRight: [88, 144],
      maxZoom: 15,
    })
    wrapper.vm.resetView()
    expect(leaflet.map.fitBounds).toHaveBeenLastCalledWith(expect.anything(), {
      paddingTopLeft: [354, 100],
      paddingBottomRight: [88, 144],
    })
    const element = wrapper.find('.map-canvas').element
    Object.defineProperty(element, 'clientWidth', { value: 300 })
    Object.defineProperty(element, 'clientHeight', { value: 250 })
    wrapper.vm.fitVisibleLayers()
    const options = leaflet.map.fitBounds.mock.lastCall?.[1]
    expect(options.paddingTopLeft[0] + options.paddingBottomRight[0]).toBeCloseTo(204)
    expect(options.paddingTopLeft[1] + options.paddingBottomRight[1]).toBeCloseTo(154)
  })
  it('keeps loaded geometries and avoids new requests after hiding and showing the map', async () => {
    const { wrapper, workspace } = setup()
    await flushPromises()
    await wrapper.setProps({ visible: false })
    await wrapper.setProps({ visible: true })
    await flushPromises()
    expect(leaflet.lib.map).toHaveBeenCalledOnce()
    expect(axios.get).toHaveBeenCalledOnce()
    expect(leaflet.attached.size).toBe(1)
    expect(workspace.isVisible(11)).toBe(true)
    expect(leaflet.map.invalidateSize).toHaveBeenCalled()
  })
})

describe('cached map navigation', () => {
  it('retains the Leaflet instance and GeoJSON while away and resizes on return', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const workspace = useWorkspaceStore()
    workspace.selectedDatasetId = 1
    workspace.structure = tree(1, [11])
    workspace.references = [reference(11)]
    workspace.setVisibility(11, true)
    const host = mount(
      defineComponent({
        components: { WorkspaceMap },
        setup() {
          return { shown: ref(true) }
        },
        template:
          '<button @click="shown = !shown">Trocar página</button><KeepAlive><WorkspaceMap v-if="shown" :visible="true" /></KeepAlive>',
      }),
      { global: { plugins: [pinia], stubs: { VChip: true, VAlert: true } } },
    )
    await flushPromises()
    const instance = host.findComponent(WorkspaceMap).element
    const requests = vi.mocked(axios.get).mock.calls.length
    await host.find('button').trigger('click')
    await flushPromises()
    expect(leaflet.map.remove).not.toHaveBeenCalled()
    const resizes = leaflet.map.invalidateSize.mock.calls.length
    window.dispatchEvent(new Event('resize'))
    expect(leaflet.map.invalidateSize).toHaveBeenCalledTimes(resizes)
    await host.find('button').trigger('click')
    await flushPromises()
    expect(host.findComponent(WorkspaceMap).element).toBe(instance)
    expect(leaflet.lib.map).toHaveBeenCalledTimes(1)
    expect(axios.get).toHaveBeenCalledTimes(requests)
    expect(leaflet.map.invalidateSize.mock.calls.length).toBeGreaterThan(resizes)
  })
})
