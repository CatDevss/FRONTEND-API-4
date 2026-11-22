import { beforeEach, describe, it, expect, vi } from 'vitest'
import axios from 'axios'
import {
  calculateReportArea,
  createReport,
  loadWholeReport,
  reportsAvailable,
} from '@/services/environmentalReports'
import { calculateAreas } from '@/services/environmentalBatch'
vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    isAxiosError: (error: { isAxiosError?: boolean }) => error?.isAxiosError === true,
  },
}))
const get = vi.mocked(axios.get),
  post = vi.mocked(axios.post)
beforeEach(() => {
  vi.clearAllMocks()
})
describe('Relatórios persistidos', () => {
  it('consulta a disponibilidade sem presumir instalação', async () => {
    get.mockResolvedValueOnce({ data: { enabled: false } })
    expect(await reportsAvailable()).toBe(false)
  })
  it('agrupa os IDs internamente mantendo um identificador único de relatório', async () => {
    post.mockResolvedValueOnce({ data: { id: 'salvo' } })
    await createReport(10, [{ id: 2, name: 'Terra indígena' }], 'ifc', { focos: [4] })
    expect(post).toHaveBeenCalledWith(
      '/ambiental/relatorios',
      expect.objectContaining({
        layerId: 10,
        featureIds: [2],
        indicator: 'ifc',
        id: expect.any(String),
      }),
    )
    post.mockResolvedValueOnce({ data: { calculoId: 9 } })
    await calculateReportArea('salvo', 2)
    expect(post).toHaveBeenLastCalledWith(
      '/ambiental/relatorios/salvo/feicoes/2/calcular',
      undefined,
      { timeout: 310000 },
    )
  })
  it('consulta o mesmo relatório após resposta perdida e não repete criação', async () => {
    post.mockRejectedValueOnce({ isAxiosError: true })
    get.mockResolvedValueOnce({ data: { report: { id: 'recuperado' } } })
    expect((await createReport(10, [{ id: 2, name: 'Área' }], 'icv', { vegetacao: [4] })).id).toBe(
      'recuperado',
    )
    expect(post).toHaveBeenCalledTimes(1)
    expect(get.mock.calls[0]![0]).toMatch(/^\/ambiental\/relatorios\/[a-f0-9-]{36}$/)
  })
  it('carrega páginas do relatório preservando áreas pendentes', async () => {
    get.mockResolvedValueOnce({
      data: { report: { id: 'r' }, total: 2, items: [{ area: { id: 1, name: 'Área pendente' } }] },
    })
    get.mockResolvedValueOnce({
      data: { items: [{ area: { id: 2, name: 'Área com falha' }, error: 'Geometria inválida' }] },
    })
    const detail = await loadWholeReport('r')
    expect(detail.areas).toHaveLength(2)
    expect(detail.entries).toHaveLength(1)
    expect(get).toHaveBeenLastCalledWith('/ambiental/relatorios/r', {
      params: { page: 1, size: 100 },
    })
  })
  it('registra falhas confirmadas e continua as demais áreas', async () => {
    post
      .mockRejectedValueOnce(new Error('Falha de cálculo'))
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ data: { calculoId: 9 } })
    const completed = vi.fn()
    await calculateAreas(
      [
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
      ],
      'icv',
      { vegetacao: [4] },
      true,
      () => false,
      completed,
      'r',
    )
    expect(post).toHaveBeenNthCalledWith(
      2,
      '/ambiental/relatorios/r/feicoes/1/falha',
      expect.objectContaining({ message: expect.any(String) }),
    )
    expect(completed).toHaveBeenCalledTimes(2)
    expect(completed.mock.calls[1]![0].snapshot.result.calculoId).toBe(9)
  })
  it('interrompe após resposta perdida sem registrar uma falha presumida', async () => {
    post.mockRejectedValueOnce({ isAxiosError: true })
    const completed = vi.fn()
    await calculateAreas(
      [
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
      ],
      'ifc',
      {},
      true,
      () => false,
      completed,
      'r',
    )
    expect(post).toHaveBeenCalledTimes(1)
    expect(completed.mock.calls[0]![0].unconfirmed).toBe(true)
  })
})
