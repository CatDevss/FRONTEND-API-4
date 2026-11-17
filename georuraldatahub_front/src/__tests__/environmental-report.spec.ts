import { describe, it, expect } from 'vitest'
import { reportRows, reportCsv } from '@/services/environmentalReport'
describe('relatórios ambientais', () => {
  it('preserva zero, nulo, precisão e origem sem recalcular', () => {
    const rows = reportRows({
      name: 'Curitiba',
      indicator: 'icv',
      featureId: 1,
      parameters: { vegetacao: [2] },
      result: {
        ICV: { areaHa: 0, percentual: null },
        areaImovelHa: 12.3456789,
        regra: 'TESTE',
        fontes: [{ nome: 'Vegetação', arquivo: 'dados.geojson', fonte: 'IBGE' }],
      },
    })
    expect(rows).toContainEqual(['ICV', 'Área', 0, 'ha'])
    expect(rows).toContainEqual(['ICV', 'Percentual', 'Não disponível', '%'])
    expect(rows).toContainEqual(['Análise', 'Área analisada', 12.3456789, 'ha'])
    expect(rows).toContainEqual(['Vegetação', 'arquivo', 'dados.geojson', ''])
  })
  it('escapa aspas, quebras e fórmulas no CSV', () => {
    const csv = reportCsv([['=1+1', 'Nome', 'a"b\nc', '']])
    expect(csv).toContain("'" + '=1+1')
    expect(csv).toContain('a""b\nc')
    expect(csv.startsWith('\uFEFF')).toBe(true)
  })
})
