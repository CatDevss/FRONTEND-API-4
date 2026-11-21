import { beforeEach, describe, it, expect, vi } from 'vitest'
import axios from 'axios'
import {
  allAnalysisAreas,
  calculateAreas,
  type AreaCalculation,
} from '@/services/environmentalBatch'
import { batchReportRows } from '@/services/environmentalReport'
vi.mock('axios', () => ({ default: { get: vi.fn(), post: vi.fn(), isAxiosError: () => true } }))
beforeEach(() => vi.clearAllMocks())
const areas = [
  { id: 1, name: 'Apucarana' },
  { id: 2, name: 'Vera Tupã’i' },
  { id: 3, name: 'Outra área' },
]
describe('relatórios de várias áreas', () => {
  it('enumera toda a camada com paginação e ignora filtros da busca individual', async () => {
    const first = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      name: `Área ${i + 1}`,
      attributes: '{}',
    }))
    vi.mocked(axios.get)
      .mockResolvedValueOnce({ data: { items: first, total: 101, page: 0 } })
      .mockResolvedValueOnce({
        data: { items: [{ id: 101, name: 'Última área', attributes: '{}' }], total: 101, page: 1 },
      })
    const result = await allAnalysisAreas(5, () => false)
    expect(result).toHaveLength(101)
    expect(result[100]).toEqual({ id: 101, name: 'Última área' })
    expect(axios.get).toHaveBeenNthCalledWith(2, '/ambiental/camadas/5/feicoes', {
      params: { busca: '', campo: undefined, page: 1, size: 100 },
    })
  })
  it('rejeita listagem incompleta antes de iniciar cálculos', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { items: [], total: 101, page: 0 } })
    await expect(allAnalysisAreas(5, () => false)).rejects.toThrow('incompleta')
    expect(axios.post).not.toHaveBeenCalled()
  })
  it('mantém resultados e erros separados, sem transformar falha em zero', async () => {
    vi.mocked(axios.post)
      .mockResolvedValueOnce({ data: { IFC: { quantidade: 0, porMilHa: null }, calculoId: 10 } })
      .mockRejectedValueOnce({ response: { data: { detail: 'Geometria inválida' } } })
      .mockResolvedValueOnce({ data: { IFC: { quantidade: 2 }, calculoId: 11 } })
    const entries: AreaCalculation[] = []
    await calculateAreas(
      areas,
      'ifc',
      { focos: [4], inicio: '2026-10-20', fim: '2026-10-20' },
      true,
      () => false,
      (e) => entries.push(e),
    )
    expect(entries).toHaveLength(3)
    expect(entries[1]?.error).toBe('Geometria inválida')
    expect(entries[1]?.snapshot).toBeUndefined()
    expect(entries[2]?.snapshot?.result.calculoId).toBe(11)
    const rows = batchReportRows(areas, entries, 'ifc', {})
    expect(rows).toContainEqual(['Apucarana', 'IFC · Focos únicos', 0, 'focos'])
    expect(rows).toContainEqual([
      'Apucarana',
      'IFC · Densidade',
      'Não disponível',
      'focos / 1.000 ha',
    ])
    expect(rows).toContainEqual(['Vera Tupã’i', 'Situação', 'Falhou', ''])
    expect(rows.some((r) => r[0] === 'Vera Tupã’i' && r[1].startsWith('IFC'))).toBe(false)
  })
  it('interrompe entre áreas e preserva o cálculo já concluído', async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { ICV: { percentual: 12 }, calculoId: 10 } })
    let stopped = false
    const entries: AreaCalculation[] = []
    await calculateAreas(
      areas,
      'icv',
      { vegetacao: [4] },
      true,
      () => stopped,
      (e) => {
        entries.push(e)
        stopped = true
      },
    )
    expect(axios.post).toHaveBeenCalledTimes(1)
    expect(entries[0]?.snapshot?.result.calculoId).toBe(10)
    expect(batchReportRows(areas, entries, 'icv', {})).toContainEqual([
      'Vera Tupã’i',
      'Situação',
      'Não processada',
      '',
    ])
  })
  it('não repete cálculos quando a resposta se perde e orienta conferir o histórico', async () => {
    vi.mocked(axios.post).mockRejectedValue({ code: 'ECONNABORTED' })
    const entries: AreaCalculation[] = []
    await calculateAreas(
      areas,
      'icv',
      { vegetacao: [4] },
      true,
      () => false,
      (e) => entries.push(e),
    )
    expect(axios.post).toHaveBeenCalledTimes(1)
    expect(entries[0]?.unconfirmed).toBe(true)
    expect(entries[0]?.error).toContain('histórico')
    expect(batchReportRows(areas, entries, 'icv', {})).toContainEqual([
      'Apucarana',
      'Situação',
      'Sem confirmação',
      '',
    ])
  })
})
