import { beforeEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import { setSessionUser } from '@/access/session'
import { startUpload, uploadResults, uploadSnackbarMessage } from '@/composables/uploadLock'
import { apiError, type ValidationReport } from '@/services/contracts'

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
})
