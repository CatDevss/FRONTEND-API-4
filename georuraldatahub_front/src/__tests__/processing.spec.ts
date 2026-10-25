import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import axios from 'axios'
import { setSessionUser } from '@/access/session'
import { useFileTreatment } from '@/composables/useFileTreatment'
import {
  treatmentMapLocation,
  type TreatmentExecution,
  type TreatmentFile,
} from '@/services/processing'

vi.mock('axios', () => ({ default: { get: vi.fn(), post: vi.fn(), isAxiosError: () => true } }))
const execution: TreatmentExecution = {
  id: 50,
  fileId: 11,
  inputVersionId: 18,
  userId: 7,
  status: 'CONCLUIDO',
  startedAt: '2026-10-25T10:00:00',
  finishedAt: '2026-10-25T10:01:00',
  outputVersionId: 25,
  layerId: 11,
  rasterId: null,
  inputCount: 10,
  outputCount: 8,
  error: null,
  parameters: { request: { datasetId: 2 } },
  provenance: { engine: 'BE-07-v1' },
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}
function page(content: TreatmentExecution[] = []) {
  return {
    content,
    page: 0,
    size: 20,
    totalPages: content.length ? 1 : 0,
    totalElements: content.length,
  }
}
const cleanups: (() => void)[] = []
async function setup(format = 'geojson') {
  const file = ref<TreatmentFile | null>({ id: 11, name: `dados.${format}`, formatFile: format })
  let state!: ReturnType<typeof useFileTreatment>
  const wrapper = mount(
    defineComponent({
      setup() {
        state = useFileTreatment(file, ref(2))
        return () => null
      },
    }),
  )
  cleanups.push(() => wrapper.unmount())
  await flushPromises()
  return { state, file, wrapper }
}
beforeEach(() => {
  vi.resetAllMocks()
  setSessionUser({ id: 7, name: 'Operador', userStatus: 1, userType: 'OPERADOR' })
  vi.mocked(axios.get).mockImplementation(async (path) => ({
    data:
      path === '/conjuntos'
        ? [
            { id: 2, name: 'PR' },
            { id: 3, name: 'Outro' },
          ]
        : path.endsWith('/estrutura')
          ? { sources: [{ files: path === '/conjuntos/2/estrutura' ? [{ id: 11 }] : [] }] }
          : page(),
  }))
  vi.mocked(axios.post).mockResolvedValue({ status: 201, data: execution })
})
afterEach(async () => {
  cleanups.splice(0).forEach((fn) => fn())
  await flushPromises()
  setSessionUser(null)
})
describe('treatment contracts and lifecycle', () => {
  it('checks membership and sends actual session user and dataset, omitting optional transformations', async () => {
    const { state } = await setup()
    expect(state.canStart.value).toBe(true)
    expect(axios.get).toHaveBeenCalledWith('/conjuntos/2/estrutura')
    const result = await state.start()
    expect(axios.post).toHaveBeenCalledExactlyOnceWith('/arquivos/11/tratamentos', {
      userId: 7,
      datasetId: 2,
    })
    expect(result).toEqual(execution)
    expect(state.result.value?.outputVersionId).toBe(25)
    expect(
      vi.mocked(axios.get).mock.calls.filter(([path]) => path === '/arquivos/11/tratamentos'),
    ).toHaveLength(2)
    expect(state.busy.value).toBe(false)
  })
  it('does not treat an unassociated file or invent its association', async () => {
    const { state } = await setup()
    state.datasetId.value = 3
    expect(state.canStart.value).toBe(false)
    await flushPromises()
    expect(state.associated.value).toBe(false)
    await state.start()
    expect(axios.post).not.toHaveBeenCalled()
  })
  it('ignores a late membership response after selecting a different dataset', async () => {
    const slow = deferred<{ data: { sources: { files: { id: number }[] }[] } }>()
    const { state } = await setup()
    vi.mocked(axios.get).mockImplementation(async (path) =>
      path === '/conjuntos/2/estrutura' ? slow.promise : { data: { sources: [{ files: [] }] } },
    )
    state.datasetId.value = null
    state.datasetId.value = 2
    state.datasetId.value = 3
    await flushPromises()
    slow.resolve({ data: { sources: [{ files: [{ id: 11 }] }] } })
    await flushPromises()
    expect(state.associated.value).toBe(false)
    expect(state.canStart.value).toBe(false)
  })
  it.each(['tif', 'TIFF'])('catalogs %s without requesting a vector dataset', async (format) => {
    const { state } = await setup(format)
    expect(state.raster.value).toBe(true)
    await state.start()
    expect(axios.post).toHaveBeenCalledWith('/arquivos/11/tratamentos', { userId: 7 })
    expect(axios.get).not.toHaveBeenCalledWith('/conjuntos')
  })
  it.each(['zip', 'gpkg', 'csv', 'json', 'geojson'])(
    'uses the same treatment endpoint for %s',
    async (format) => {
      const { state } = await setup(format)
      await state.start()
      expect(axios.post).toHaveBeenCalledWith('/arquivos/11/tratamentos', {
        userId: 7,
        datasetId: 2,
      })
    },
  )
  it('blocks duplicate submits while processing and refreshing history', async () => {
    const slow = deferred<{ data: TreatmentExecution }>()
    vi.mocked(axios.post).mockReturnValue(slow.promise)
    const { state } = await setup()
    const first = state.start()
    await state.start()
    expect(state.busy.value).toBe(true)
    expect(axios.post).toHaveBeenCalledOnce()
    slow.resolve({ data: execution })
    await first
    expect(state.busy.value).toBe(false)
  })
  it.each([400, 403, 409, 422, 503])(
    'preserves HTTP %s messages and refreshes failed execution history',
    async (status) => {
      const { state } = await setup()
      vi.mocked(axios.post).mockRejectedValue({
        response: { status, data: 'Mensagem real do backend.' },
      })
      vi.mocked(axios.get).mockResolvedValue({
        data: page([{ ...execution, status: 'FALHOU', error: 'Falha original', layerId: null }]),
      })
      await state.start()
      expect(state.actionError.value).toBe('Mensagem real do backend.')
      expect(state.result.value).toBeNull()
      expect(state.history.value[0]?.error).toBe('Falha original')
      expect(state.busy.value).toBe(false)
    },
  )
  it('disables writes while history is unavailable or an execution is running', async () => {
    vi.mocked(axios.get).mockRejectedValue({ response: { data: 'Persistência desativada.' } })
    const { state } = await setup()
    expect(state.historyError.value).toBe('Persistência desativada.')
    expect(state.canStart.value).toBe(false)
    vi.mocked(axios.get).mockResolvedValue({
      data: page([{ ...execution, status: 'EM_EXECUCAO' }]),
    })
    await state.loadHistory()
    expect(state.canStart.value).toBe(false)
  })
  it('uses zero-based pagination and discards history for a previous file', async () => {
    const { state, file } = await setup()
    state.page.value = 1
    await flushPromises()
    expect(axios.get).toHaveBeenCalledWith('/arquivos/11/tratamentos', {
      params: { page: 1, size: 20 },
    })
    const slow = deferred<{ data: ReturnType<typeof page> }>()
    vi.mocked(axios.get).mockReturnValue(slow.promise)
    const pending = state.loadHistory()
    file.value = null
    await flushPromises()
    slow.resolve({ data: page([execution]) })
    await pending
    expect(state.history.value).toEqual([])
    expect(state.result.value).toBeNull()
  })
  it('ignores a treatment response after the session identity changes', async () => {
    const slow = deferred<{ data: TreatmentExecution }>()
    vi.mocked(axios.post).mockReturnValue(slow.promise)
    const { state } = await setup()
    const pending = state.start()
    setSessionUser({ id: 19, name: 'Outro operador', userStatus: 1, userType: 'OPERADOR' })
    await flushPromises()
    slow.resolve({ data: execution })
    await pending
    expect(state.result.value).toBeNull()
  })
  it.each(['ADMIN', 'GESTOR', 'ANALISTA', 'AUDITOR'])(
    'keeps %s in read-only mode',
    async (userType) => {
      setSessionUser({ id: 9, name: userType, userStatus: 1, userType })
      const { state } = await setup()
      await state.start()
      expect(state.canStart.value).toBe(false)
      expect(axios.post).not.toHaveBeenCalled()
      expect(axios.get).toHaveBeenCalledWith('/arquivos/11/tratamentos', expect.any(Object))
    },
  )
  it('only provides exact layer links for completed vector executions with a real dataset', () => {
    expect(treatmentMapLocation(execution)).toEqual({
      path: '/home',
      query: { dataset: '2', treatment: '50' },
    })
    expect(treatmentMapLocation({ ...execution, layerId: null, rasterId: 8 })).toBeNull()
    expect(treatmentMapLocation({ ...execution, status: 'FALHOU' })).toBeNull()
    expect(treatmentMapLocation({ ...execution, parameters: null })).toBeNull()
  })
})
