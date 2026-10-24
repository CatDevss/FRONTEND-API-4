import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import axios from 'axios'
import { setSessionUser } from '@/access/session'
import { startUpload, uploadResults, uploadSnackbarMessage } from '@/composables/uploadLock'
import { apiError, type ValidationReport } from '@/services/contracts'
import FileUploadList from '@/components/upload/FileUploadList.vue'

enableAutoUnmount(afterEach)

vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
    isAxiosError: (e: unknown) => !!e && typeof e === 'object' && 'response' in e,
    isCancel: () => false,
  },
}))
const report = (status: ValidationReport['status']): ValidationReport => ({
  status,
  dictionaryId: 9,
  dictionaryVersion: 3,
  validRecords: status === 'REJEITADO' ? 0 : 1,
  rejectedRecords: status === 'VALIDO' ? 0 : 1,
  records: [],
})
const feature = {
  type: 'Feature',
  properties: { id: '1' },
  geometry: { type: 'Point', coordinates: [-49, -25] },
}
beforeEach(() => {
  vi.clearAllMocks()
  setSessionUser({ id: 1, name: 'Operador', userType: 'OPERADOR', userStatus: 1 })
})
describe('upload and validation', () => {
  it.each(['VALIDO', 'PARCIAL', 'REJEITADO'] as const)(
    'uses validation.status for HTTP 201 %s',
    async (status) => {
      vi.mocked(axios.post).mockResolvedValue({ status: 201, data: { validation: report(status) } })
      await startUpload(2, [new File(['a'], 'data.csv')], 1)
      expect(axios.post).toHaveBeenCalledWith(
        '/fontes/2/arquivos',
        expect.any(FormData),
        expect.objectContaining({ params: { userId: 1 } }),
      )
      expect(uploadResults.value[0]?.success).toBe(status === 'VALIDO')
      expect(uploadResults.value[0]?.validation?.dictionaryVersion).toBe(3)
      expect(uploadResults.value[0]?.message).toContain(status)
      if (status !== 'VALIDO') expect(uploadSnackbarMessage.value).not.toContain('com sucesso')
    },
  )
  it('does not approve a response without a validation report', async () => {
    vi.mocked(axios.post).mockResolvedValue({ status: 201, data: {} })
    await startUpload(2, [new File(['a'], 'data.csv')], 1)
    expect(uploadResults.value[0]?.success).toBe(false)
    expect(uploadResults.value[0]?.message).toContain('indisponível')
  })
  it('preserves API errors instead of assuming every 404 means a missing dataset', async () => {
    vi.mocked(axios.post).mockRejectedValue({
      response: { status: 404, data: 'Esta fonte não possui dicionário de dados cadastrado.' },
    })
    await startUpload(2, [new File(['a'], 'data.csv')], 1)
    expect(uploadResults.value[0]?.message).toContain('dicionário')
  })
  it('extracts plain text and problem detail errors', () => {
    expect(apiError({ response: { data: 'Conflito real' } })).toBe('Conflito real')
    expect(apiError({ response: { data: { detail: 'Dicionário já utilizado' } } })).toBe(
      'Dicionário já utilizado',
    )
  })
  it('sends the chosen dictionary as a query parameter for every file in the batch', async () => {
    vi.mocked(axios.post).mockResolvedValue({
      status: 201,
      data: { validation: { ...report('PARCIAL'), dictionaryId: 77, dictionaryVersion: 1 } },
    })
    await startUpload(2, [new File(['a'], 'a.csv'), new File(['b'], 'b.json')], 1, 77)
    expect(axios.post).toHaveBeenCalledTimes(2)
    for (const [, payload, config] of vi.mocked(axios.post).mock.calls) {
      expect(payload).toBeInstanceOf(FormData)
      expect(config?.params).toEqual({ userId: 1, dictionaryId: 77 })
    }
    expect(uploadResults.value.every((result) => result.validation?.dictionaryId === 77)).toBe(true)
    expect(uploadResults.value.every((result) => !result.success)).toBe(true)
  })
  it.each([undefined, null])('omits dictionaryId in automatic mode (%s)', async (dictionaryId) => {
    vi.mocked(axios.post).mockResolvedValue({ status: 201, data: { validation: report('VALIDO') } })
    await startUpload(2, [new File(['a'], 'a.csv')], 1, dictionaryId)
    expect(vi.mocked(axios.post).mock.calls[0]?.[2]?.params).toEqual({ userId: 1 })
  })
  it('preserves an API rejection of a dictionary from another source', async () => {
    vi.mocked(axios.post).mockRejectedValue({
      response: {
        status: 422,
        data: { detail: 'O dicionário selecionado não pertence à fonte informada.' },
      },
    })
    await startUpload(2, [new File(['a'], 'a.csv')], 1, 77)
    expect(uploadResults.value[0]?.message).toBe(
      'O dicionário selecionado não pertence à fonte informada.',
    )
    expect(uploadResults.value[0]?.success).toBe(false)
  })
  it.each(['VALIDO', 'PARCIAL', 'REJEITADO'] as const)(
    'sends a .json file unchanged and respects backend status %s',
    async (status) => {
      const rejectedFeature = { ...feature, geometry: null }
      const features =
        status === 'VALIDO'
          ? [feature]
          : status === 'PARCIAL'
            ? [feature, rejectedFeature]
            : [rejectedFeature]
      const file = new File(
        [JSON.stringify({ type: 'FeatureCollection', features })],
        'dados.json',
        {
          type: 'application/json',
        },
      )
      vi.mocked(axios.post).mockResolvedValue({ status: 201, data: { validation: report(status) } })
      await startUpload(2, [file], 1)
      const payload = vi.mocked(axios.post).mock.calls[0]?.[1] as FormData
      expect((payload.get('file') as File).name).toBe('dados.json')
      expect((payload.get('file') as File).size).toBe(file.size)
      expect(uploadResults.value[0]?.success).toBe(status === 'VALIDO')
      expect(uploadResults.value[0]?.message).toContain(status)
    },
  )
})

describe('manual file picker', () => {
  it.each(['dados.json', 'dados.JSON'])(
    'accepts %s alongside CSV and GeoJSON while blocking unsupported formats',
    async (name) => {
      const wrapper = mount(FileUploadList, {
        props: { allowedExtensions: ['csv', 'geojson', 'json'] },
        global: {
          stubs: {
            VBtn: { template: '<button><slot /></button>' },
            VAlert: { template: '<div><slot /></div>' },
            VList: true,
            VListSubheader: true,
            VListItem: true,
            VIcon: true,
          },
        },
      })
      const input = wrapper.find('input[type="file"]')
      expect(input.attributes('accept')).toBe('.csv,.geojson,.json')
      const file = new File(
        [JSON.stringify({ type: 'FeatureCollection', features: [feature] })],
        name,
      )
      Object.defineProperty(input.element, 'files', {
        value: [file, new File([''], 'arquivo.gpkg')],
      })
      await input.trigger('change')
      expect(wrapper.emitted('update:modelValue')?.[0]?.[0]).toEqual([file])
      expect(wrapper.text()).toContain('arquivo.gpkg: formato não autorizado')
      expect(wrapper.text()).not.toContain(`${name}: formato não autorizado`)
    },
  )
})
