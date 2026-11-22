import { describe, it, expect } from 'vitest'
import {
  resultAvailability,
  sortedComparison,
  comparisonColumns,
  comparisonValue,
} from '@/services/environmentalQuality'
import { reportRows, batchReportRows } from '@/services/environmentalReport'
import type { AreaCalculation } from '@/services/environmentalBatch'
const areas = [
  { id: 1, name: 'Zero' },
  { id: 2, name: 'Ausente' },
  { id: 3, name: 'Maior' },
  { id: 4, name: 'Pendente' },
]
const entries: AreaCalculation[] = areas.slice(0, 3).map((area, i) => ({
  area,
  snapshot: {
    name: area.name,
    featureId: area.id,
    indicator: 'ifc',
    parameters: { inicio: '2026-01-01', fim: '2026-01-01' },
    result: {
      IFC: {
        quantidade: [0, null, 12][i],
        porMilHa: [0, null, 120][i],
        situacao: i === 1 ? 'SEM_DADOS' : 'DADOS_PRESENTES',
      },
    },
  },
}))
describe('Disponibilidade e comparação dos indicadores', () => {
  it('distingue zero de ausência de dados e de resultados antigos', () => {
    expect(resultAvailability(entries[0]!.snapshot!.result)).toBe('Dados presentes nas fontes')
    expect(resultAvailability(entries[1]!.snapshot!.result)).toBe('Sem dados')
    expect(resultAvailability({ IFC: { quantidade: 0 } })).toBe('Disponibilidade não informada')
    expect(resultAvailability({ IFC: { quantidade: 2, situacao: 'PARCIAL' } })).toBe(
      'Dados parciais',
    )
    expect(resultAvailability({ IAPP: { percentual: null, situacao: 'SEM_BASE' } })).toBe(
      'Sem base percentual',
    )
  })
  it('mantém ausentes no final em ambas as direções e não perde áreas pendentes', () => {
    expect(sortedComparison(areas, entries, 'IFC.quantidade', false).map((e) => e.area.id)).toEqual(
      [1, 3, 2, 4],
    )
    expect(sortedComparison(areas, entries, 'IFC.quantidade', true).map((e) => e.area.id)).toEqual([
      3, 1, 2, 4,
    ])
    expect(comparisonValue(entries[1]!.snapshot, 'IFC.quantidade')).toBeNull()
    expect(comparisonValue(entries[0]!.snapshot, 'IFC.quantidade')).toBe(0)
    expect(comparisonColumns(entries)).toEqual([
      { key: 'IFC.quantidade', label: 'IFC · Focos únicos', unit: 'focos' },
      { key: 'IFC.porMilHa', label: 'IFC · Densidade', unit: 'focos / 1.000 ha' },
    ])
  })
  it('inclui disponibilidade e reparos nos relatórios individuais e por área', () => {
    const snapshot = structuredClone(entries[1]!.snapshot!)
    snapshot.result.reparos = [
      {
        feicaoId: 2,
        nome: 'Área corrigida',
        papel: 'areaAnalise',
        registro: { metodo: 'Oracle Spatial', diagnosticoOriginal: '13349', tolerancia: 0.005 },
      },
    ]
    const rows = reportRows(snapshot)
    expect(rows).toContainEqual(['IFC', 'Focos únicos', 'Não disponível', 'focos'])
    expect(rows).toContainEqual(['Dados', 'Disponibilidade', 'Sem dados', ''])
    expect(rows).toContainEqual(['Reparo', 'diagnosticoOriginal', '13349', ''])
    const batch = batchReportRows(
      areas,
      [{ area: areas[1]!, snapshot }],
      'ifc',
      snapshot.parameters,
    )
    expect(batch).toContainEqual(['Ausente', 'Dados · Disponibilidade', 'Sem dados', ''])
    expect(batch).toContainEqual(['Ausente', 'Reparo · diagnosticoOriginal', '13349', ''])
  })
  it('conta uma feição apenas uma vez quando aparece em papéis diferentes', () => {
    const snapshot = structuredClone(entries[0]!.snapshot!)
    snapshot.result.reparos = ['app', 'vegetacao'].map((papel) => ({
      feicaoId: 9,
      papel,
      registro: { metodo: 'Oracle Spatial' },
    }))
    expect(reportRows(snapshot)).toContainEqual([
      'Geometrias',
      'Feições com reparo registrado',
      1,
      '',
    ])
    expect(reportRows(entries[0]!.snapshot!)).toContainEqual([
      'Geometrias',
      'Feições com reparo registrado',
      'Não informado',
      '',
    ])
  })
})
