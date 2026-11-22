import { beforeEach, describe, it, expect, vi } from 'vitest'
import axios from 'axios'
import { historicalReport } from '@/services/environmentalHistoryReport'
import { batchReportRows } from '@/services/environmentalReport'
vi.mock('axios', () => ({ default: { get: vi.fn(), post: vi.fn(), isAxiosError: () => false } }))
beforeEach(() => vi.clearAllMocks())
const rows = Array.from({ length: 23 }, (_, index) => ({
  id: index + 1,
  featureId: 90,
  name: 'Mesma área',
  indicator: 'ifc',
  calculatedAt: '2026-11-21 12:00:00',
}))
function mockHistory() {
  vi.mocked(axios.get).mockImplementation(async (url, config) => {
    if (url === '/ambiental/calculos') {
      const page = Number((config?.params as { page?: number } | undefined)?.page ?? 0)
      return { data: { items: rows.slice(page * 20, page * 20 + 20), total: 23 } }
    }
    const id = Number(String(url).split('/').pop())
    return {
      data: {
        calculation: rows[id - 1],
        parameters: {
          focos: [id],
          inicio: id === 1 ? '2026-01-01' : '2026-02-01',
          fim: id === 1 ? '2026-01-01' : '2026-02-01',
        },
        result: {
          IFC: { quantidade: id === 1 ? 0 : null, porMilHa: null },
          fontes: [{ camadaId: id, fonte: `Fonte ${id}` }],
          regra: 'ORACLE',
        },
      },
    }
  })
}
describe('Agrupamento do histórico existente', () => {
  it('reúne 23 cálculos antigos em duas páginas, mantendo repetições, datas e fontes sem recalcular', async () => {
    mockHistory()
    const progress = vi.fn()
    const groups = await historicalReport('', 'ifc', new AbortController().signal, progress)
    expect(groups).toHaveLength(1)
    const group = groups[0]!
    expect(group.entries).toHaveLength(23)
    expect(new Set(group.entries.map((entry) => entry.area.id)).size).toBe(23)
    expect(group.entries[0]!.snapshot!.featureId).toBe(90)
    expect(group.entries[0]!.snapshot!.result.IFC).toEqual({ quantidade: 0, porMilHa: null })
    expect(progress).toHaveBeenLastCalledWith(23, 23)
    const exportRows = batchReportRows(
      group.entries.map((entry) => entry.area),
      group.entries,
      'ifc',
      {},
    )
    expect(exportRows).toContainEqual(['Mesma área', 'Identificador da feição', 90, ''])
    expect(exportRows).toContainEqual(['Mesma área', 'Parâmetro · inicio', '2026-01-01', ''])
    expect(exportRows).toContainEqual(['Mesma área', 'Parâmetro · inicio', '2026-02-01', ''])
    expect(
      exportRows.some((row) => row[1] === 'Fonte utilizada' && String(row[2]).includes('Fonte 1')),
    ).toBe(true)
    expect(axios.post).not.toHaveBeenCalled()
  })
  it('mantém falha de leitura como erro, sem inventar zero', async () => {
    mockHistory()
    const get = vi.mocked(axios.get).getMockImplementation()!
    vi.mocked(axios.get).mockImplementation((url, config) =>
      String(url) === '/ambiental/calculos/1'
        ? Promise.reject(new Error('Falha'))
        : get(url, config),
    )
    const groups = await historicalReport('', 'ifc', new AbortController().signal, () => {})
    expect(groups[0]!.entries[0]!.snapshot).toBeUndefined()
    expect(groups[0]!.entries[0]!.error).toBeTruthy()
    expect(groups[0]!.entries[1]!.snapshot).toBeDefined()
  })
  it('interrompe consulta cancelada sem novos cálculos', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(historicalReport('', 'ifc', controller.signal, () => {})).rejects.toBeDefined()
    expect(axios.get).not.toHaveBeenCalled()
    expect(axios.post).not.toHaveBeenCalled()
  })
  it('recusa paginação incompleta', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { items: [], total: 23 } })
    await expect(
      historicalReport('', 'ifc', new AbortController().signal, () => {}),
    ).rejects.toThrow('todo o histórico')
  })
})
