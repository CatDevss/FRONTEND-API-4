import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import Results from '@/components/workspace/EnvironmentalBatchResults.vue'
import {
  batchReportRows,
  reportCsv,
  download,
  exportExcel,
  printReport,
  type CalculationSnapshot,
} from '@/services/environmentalReport'
import { formatValue } from '@/services/environmentalIndicators'

vi.mock('@/services/environmentalReport', async (original) => ({
  ...(await original<typeof import('@/services/environmentalReport')>()),
  download: vi.fn(),
  exportExcel: vi.fn(),
  printReport: vi.fn(),
}))

// Resultados esperados para os mesmos polígonos de database/testes/validar_indicadores.sql.
const cases = [
  { indicator: 'icv', result: { ICV: { areaHa: 60, percentual: 60 } } },
  {
    indicator: 'irl',
    result: {
      IRL: { areaHa: 10, percentual: 10, minimoPercentual: 20, deficitHa: 10, excedenteHa: 0 },
    },
  },
  {
    indicator: 'iapp',
    result: { IAPP: { areaHa: 20, percentual: 50, appTotalHa: 40, passivoHa: 20 } },
  },
  { indicator: 'isap', result: { ISAP: { areaHa: 50, percentual: 50 } } },
  { indicator: 'iae', result: { IAE: { areaHa: 10, percentual: 10 } } },
  {
    indicator: 'idesmat',
    result: {
      IDesmat2008: { areaHa: 60, percentual: 60 },
      IDesmat2019: { areaHa: 50, percentual: 50 },
      IDesmat2020: { areaHa: 30, percentual: 30 },
    },
  },
  { indicator: 'ifc', result: { IFC: { quantidade: 2, porMilHa: 20 } } },
]
const stubs = {
  VBtn: { props: ['disabled'], template: '<button :disabled="disabled"><slot /></button>' },
  VSelect: { template: '<div />' },
  VDialog: { template: '<div />' },
  VAlert: { template: '<div><slot /></div>' },
  EnvironmentalQuality: true,
  EnvironmentalResultActions: true,
}
const expected: Record<string, [string, number, string][]> = {
  icv: [
    ['ICV · Área', 60, 'ha'],
    ['ICV · Percentual', 60, '%'],
  ],
  irl: [
    ['IRL · Área', 10, 'ha'],
    ['IRL · Percentual', 10, '%'],
    ['IRL · Déficit', 10, 'ha'],
    ['IRL · Excedente', 0, 'ha'],
  ],
  iapp: [
    ['IAPP · Área', 20, 'ha'],
    ['IAPP · Percentual', 50, '%'],
    ['IAPP · APP total', 40, 'ha'],
    ['IAPP · Passivo', 20, 'ha'],
  ],
  isap: [
    ['ISAP · Área', 50, 'ha'],
    ['ISAP · Percentual', 50, '%'],
  ],
  iae: [
    ['IAE · Área', 10, 'ha'],
    ['IAE · Percentual', 10, '%'],
  ],
  idesmat: [
    ['IDesmat2008 · Área', 60, 'ha'],
    ['IDesmat2019 · Área', 50, 'ha'],
    ['IDesmat2020 · Área', 30, 'ha'],
  ],
  ifc: [
    ['IFC · Focos únicos', 2, 'focos'],
    ['IFC · Densidade', 20, 'focos / 1.000 ha'],
  ],
}
describe('Casos controlados dos sete indicadores na tela e nas exportações', () => {
  for (const item of cases)
    it(`${item.indicator}: mantém os valores esperados em CSV, Excel e PDF`, async () => {
      vi.clearAllMocks()
      const area = { id: 1, name: 'Área controlada' }
      const snapshot: CalculationSnapshot = {
        featureId: 1,
        name: area.name,
        indicator: item.indicator,
        parameters: { inicio: '2026-10-20', fim: '2026-10-20' },
        result: {
          ...item.result,
          areaImovelHa: 100,
          calculoId: 9,
          regra: 'GEORURAL-1.3',
          calculadoEm: '2026-10-20T12:00:00Z',
          fontes: [{ nome: 'Camada controlada', fonte: 'Dados de teste' }],
        },
      }
      const entries = [{ area, snapshot }]
      const rows = batchReportRows([area], entries, item.indicator, snapshot.parameters)
      const panel = mount(Results, {
        props: {
          areas: [area],
          entries,
          indicator: item.indicator,
          parameters: snapshot.parameters,
          busy: false,
          stopping: false,
        },
        global: { stubs },
      })
      for (const metrics of Object.values(item.result))
        for (const value of Object.values(metrics))
          expect(panel.find('tbody').text()).toContain(formatValue(value))
      const button = (label: string) => panel.findAll('button').find((b) => b.text() === label)!
      await button('CSV de todas as áreas').trigger('click')
      const blob = vi.mocked(download).mock.calls[0]![0]
      const csv = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.readAsText(blob)
      })
      expect(csv.replace(/^\uFEFF/, '')).toBe(reportCsv(rows).replace(/^\uFEFF/, ''))
      for (const [field, value, unit] of expected[item.indicator]!) {
        expect(rows).toContainEqual([area.name, field, value, unit])
        expect(csv).toContain(`"${field}";"${value}";"${unit}"`)
      }
      await button('Excel').trigger('click')
      await flushPromises()
      expect(exportExcel).toHaveBeenCalledWith(rows)
      await button('PDF / imprimir').trigger('click')
      expect(printReport).toHaveBeenCalledWith(rows)
      expect(rows).toContainEqual([area.name, 'Área analisada', 100, 'ha'])
      expect(rows).toContainEqual([area.name, 'Número do cálculo', 9, ''])
      panel.unmount()
    })

  it('distingue ausência de dados e zero focos no relatório', () => {
    const areas = [
      { id: 1, name: 'Sem dados' },
      { id: 2, name: 'Zero focos' },
    ]
    const entries = areas.map((area, index) => ({
      area,
      snapshot: {
        name: area.name,
        featureId: area.id,
        indicator: 'ifc',
        parameters: {},
        result: {
          IFC: {
            quantidade: index ? 0 : null,
            porMilHa: index ? 0 : null,
            situacao: index ? 'DADOS_PRESENTES' : 'SEM_DADOS',
          },
        },
      },
    }))
    const rows = batchReportRows(areas, entries, 'ifc', {})
    expect(rows).toContainEqual(['Sem dados', 'IFC · Focos únicos', 'Não disponível', 'focos'])
    expect(rows).toContainEqual(['Zero focos', 'IFC · Focos únicos', 0, 'focos'])
  })
})
