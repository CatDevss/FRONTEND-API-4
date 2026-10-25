import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import axios from 'axios'
import { setSessionUser } from '@/access/session'
import { useWorkspaceStore } from '@/stores/workspace'
import type { DatasetStructure, LayerReference } from '@/services/contracts'
import type { TreatmentExecution } from '@/services/processing'
vi.mock('axios', () => ({
  default: { get: vi.fn(), put: vi.fn(), delete: vi.fn(), isAxiosError: () => true },
}))
const reference = (id: number): LayerReference => ({
  fileId: id,
  name: `Camada ${id}`,
  formatFile: 'geojson',
  size: 20,
  receivedDate: '2026-10-20T12:00:00',
})
function structure(id: number, layers = [id * 10 + 1]): DatasetStructure {
  return {
    id,
    name: `Conjunto ${id}`,
    userId: 1,
    sources: [
      {
        id: 8,
        name: 'Fonte',
        url: 'https://www.ibge.gov.br/',
        files: [
          ...layers.map((fileId) => ({
            id: fileId,
            name: `Arquivo ${fileId}`,
            formatFile: 'geojson',
            size: 20,
            receivedDate: '2026-10-20T12:00:00',
            ingestionId: fileId,
            dictionaryId: 3,
            dictionaryVersion: 2,
            layers: [reference(fileId)],
          })),
          {
            id: id * 10 + 9,
            name: 'Arquivo sem camada',
            formatFile: 'csv',
            size: 5,
            receivedDate: '2026-10-20T12:00:00',
            ingestionId: 19,
            dictionaryId: 3,
            dictionaryVersion: 2,
            layers: [],
          },
        ],
      },
    ],
  }
}
function defer<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}
function normalApi() {
  vi.mocked(axios.get).mockImplementation(async (path) => {
    const id = Number(path.split('/')[2])
    return {
      data:
        path === '/conjuntos'
          ? [
              { id: 1, name: 'Conjunto 1', userId: 1 },
              { id: 2, name: 'Conjunto 2', userId: 1 },
            ]
          : path.endsWith('/estrutura')
            ? structure(id)
            : [reference(id * 10 + 1)],
    }
  })
}
beforeEach(() => {
  vi.resetAllMocks()
  setActivePinia(createPinia())
  setSessionUser({ id: 1, name: 'Operador', userType: 'OPERADOR', userStatus: 1 })
  normalApi()
})
describe('workspace state and contracts', () => {
  it('registers exact treated layers only in their associated dataset and preserves them across refreshes', async () => {
    const store = useWorkspaceStore()
    await store.selectDataset(1)
    const result: TreatmentExecution = {
      id: 50,
      fileId: 11,
      inputVersionId: 12,
      outputVersionId: 20,
      userId: 1,
      status: 'CONCLUIDO',
      startedAt: null,
      finishedAt: null,
      layerId: 11,
      rasterId: null,
      inputCount: 10,
      outputCount: 8,
      error: null,
      parameters: { request: { datasetId: 1 } },
      provenance: null,
    }
    expect(store.registerTreatment(result)).toBe(true)
    expect(store.visibleLayerIds).toEqual([-11])
    expect(
      store.layersForFile(store.structure!.sources[0]!.files[0]!).map((r) => r.layerId),
    ).toEqual([undefined, 11])
    await store.refresh()
    expect(store.isVisible(-11)).toBe(true)
    expect(store.availableReferences).toHaveLength(2)
    await store.selectDataset(2)
    expect(store.visibleLayerIds).toEqual([])
    expect(store.registerTreatment(result)).toBe(false)
    await store.selectDataset(1)
    expect(store.isVisible(-11)).toBe(true)
    expect(store.registerTreatment({ ...result, status: 'FALHOU' })).toBe(false)
    expect(store.registerTreatment({ ...result, fileId: 999 })).toBe(false)
    store.reset()
    expect(store.treatedReferences).toEqual({})
  })
  it('loads the real hierarchy and layer references while retaining files without layers', async () => {
    const store = useWorkspaceStore()
    await store.loadDatasets()
    await store.selectDataset(1)
    expect(axios.get).toHaveBeenCalledWith(
      '/conjuntos/1/estrutura',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    expect(axios.get).toHaveBeenCalledWith('/conjuntos/1/camadas', expect.any(Object))
    expect(store.fileCount).toBe(2)
    expect(store.structure?.sources[0]?.files[1]?.layers).toEqual([])
    expect(store.availableReferences.map((l) => l.fileId)).toEqual([11])
  })
  it('stores selection and visibility in Pinia and restores each dataset independently', async () => {
    const store = useWorkspaceStore()
    await store.selectDataset(1)
    store.setVisibility(11, true)
    store.activeTab = 'meters'
    expect(store.$state.visibility[1]?.[11]).toBe(true)
    expect(useWorkspaceStore().selectedDatasetId).toBe(1)
    expect(useWorkspaceStore().activeTab).toBe('meters')
    await store.selectDataset(2)
    expect(store.visibleLayerIds).toEqual([])
    await store.selectDataset(1)
    expect(store.visibleLayerIds).toEqual([11])
  })
  it('ignores late structure and reference results after switching datasets', async () => {
    const oldTree = defer<{ data: DatasetStructure }>(),
      oldLayers = defer<{ data: LayerReference[] }>()
    vi.mocked(axios.get).mockImplementation(async (path) =>
      path === '/conjuntos/1/estrutura'
        ? oldTree.promise
        : path === '/conjuntos/1/camadas'
          ? oldLayers.promise
          : { data: path.endsWith('/estrutura') ? structure(2) : [reference(21)] },
    )
    const store = useWorkspaceStore(),
      first = store.selectDataset(1)
    await store.selectDataset(2)
    oldTree.resolve({ data: structure(1) })
    oldLayers.resolve({ data: [reference(11)] })
    await first
    expect(store.selectedDatasetId).toBe(2)
    expect(store.structure?.id).toBe(2)
    expect(store.availableReferences[0]?.fileId).toBe(21)
    expect(store.loadingWorkspace).toBe(false)
  })
  it('refreshes membership with PUT and DELETE without uploading or deleting the original', async () => {
    const store = useWorkspaceStore()
    await store.selectDataset(1)
    vi.mocked(axios.put).mockResolvedValue({ status: 204 })
    vi.mocked(axios.delete).mockResolvedValue({ status: 204 })
    await store.changeMembership(22, true)
    expect(axios.put).toHaveBeenCalledWith('/conjuntos/1/arquivos/22')
    await store.changeMembership(11, false)
    expect(axios.delete).toHaveBeenCalledWith('/conjuntos/1/arquivos/11')
    expect(axios.delete).toHaveBeenCalledTimes(1)
    expect(
      vi.mocked(axios.get).mock.calls.filter(([path]) => path === '/conjuntos/1/estrutura'),
    ).toHaveLength(3)
    expect(
      vi.mocked(axios.get).mock.calls.filter(([path]) => path === '/conjuntos/1/camadas'),
    ).toHaveLength(3)
  })
  it('blocks membership writes for auditors', async () => {
    const store = useWorkspaceStore()
    await store.selectDataset(1)
    setSessionUser({ id: 8, name: 'Auditor', userType: 'AUDITOR', userStatus: 1 })
    expect(await store.changeMembership(11, false)).toBe(false)
    expect(axios.delete).not.toHaveBeenCalled()
  })
  it('preserves the API message on membership failure and does not invent a successful link', async () => {
    const store = useWorkspaceStore()
    await store.selectDataset(1)
    vi.mocked(axios.put).mockRejectedValue({ response: { data: 'Arquivo não encontrado.' } })
    expect(await store.changeMembership(999, true)).toBe(false)
    expect(store.membershipError).toBe('Arquivo não encontrado.')
    expect(store.fileIds.has(999)).toBe(false)
    expect(store.membershipBusy).toBe(false)
  })
  it('keeps the explorer when listing layers fails and reports the API error', async () => {
    vi.mocked(axios.get).mockImplementation(async (path) => {
      if (path.endsWith('/camadas'))
        throw { response: { data: { detail: 'Camadas temporariamente indisponíveis' } } }
      return { data: structure(1) }
    })
    const store = useWorkspaceStore()
    await store.selectDataset(1)
    expect(store.fileCount).toBe(2)
    expect(store.referencesError).toBe('Camadas temporariamente indisponíveis')
    expect(store.availableReferences).toEqual([])
  })
  it('prunes removed layer visibility and clears pending metadata on reset', async () => {
    const store = useWorkspaceStore()
    await store.selectDataset(1)
    store.setVisibility(11, true)
    vi.mocked(axios.get).mockResolvedValue({ data: [] })
    vi.mocked(axios.get).mockImplementation(async (path) => ({
      data: path.endsWith('/estrutura') ? structure(1, []) : [],
    }))
    await store.refresh()
    expect(store.isVisible(11)).toBe(false)
    store.reset()
    expect(store.selectedDatasetId).toBeNull()
    expect(store.structure).toBeNull()
    expect(store.visibleLayerIds).toEqual([])
  })
})
