import axios from 'axios'
export interface CalculationSnapshot {
  name: string
  indicator: string
  featureId: number
  parameters: Record<string, unknown>
  result: Record<string, unknown>
}
export type ReportRow = [string, string, string | number, string]
export const metricLabels: Record<string, [string, string]> = {
  areaHa: ['Área', 'ha'],
  percentual: ['Percentual', '%'],
  minimoPercentual: ['Mínimo adotado', '%'],
  deficitHa: ['Déficit', 'ha'],
  excedenteHa: ['Excedente', 'ha'],
  appTotalHa: ['APP total', 'ha'],
  passivoHa: ['Passivo', 'ha'],
  quantidade: ['Focos únicos', 'focos'],
  porMilHa: ['Densidade', 'focos / 1.000 ha'],
}
export const metricGroups = [
  'ICV',
  'IRL',
  'IAPP',
  'ISAP',
  'IAE',
  'IFC',
  'IDesmat2008',
  'IDesmat2019',
  'IDesmat2020',
]
function value(v: unknown): string | number {
  return typeof v === 'number' && Number.isFinite(v)
    ? v
    : typeof v === 'string' && v !== ''
      ? v
      : 'Não disponível'
}
export function reportRows(snapshot: CalculationSnapshot): ReportRow[] {
  const { result: r } = snapshot
  const rows: ReportRow[] = [
    ['Seção', 'Campo', 'Valor', 'Unidade'],
    ['Análise', 'Área / feição', snapshot.name, ''],
    ['Análise', 'Indicador', snapshot.indicator.toUpperCase(), ''],
    ['Análise', 'Identificador da feição', snapshot.featureId, ''],
    ['Análise', 'Área analisada', value(r.areaImovelHa), 'ha'],
    ['Análise', 'Data do cálculo', value(r.calculadoEm), ''],
    ['Análise', 'Regra', value(r.regra), ''],
    ['Histórico', 'Situação', r.calculoId ? 'Salvo' : 'Prévia não salva', ''],
    ['Histórico', 'Número do cálculo', value(r.calculoId), ''],
    ['Análise', 'Projeção', value(r.projecaoCalculo), ''],
  ]
  for (const group of metricGroups) {
    const metrics = r[group]
    if (metrics && typeof metrics === 'object')
      for (const [key, [label, unit]] of Object.entries(metricLabels))
        if (key in metrics)
          rows.push([group, label, value((metrics as Record<string, unknown>)[key]), unit])
  }
  for (const [key, v] of Object.entries(snapshot.parameters))
    rows.push(['Parâmetros', key, Array.isArray(v) ? v.join(', ') : value(v), ''])
  const sources = Array.isArray(r.fontes) ? (r.fontes as Record<string, unknown>[]) : []
  const seen = new Set<string>()
  for (const source of sources) {
    const fingerprint = JSON.stringify(source)
    if (seen.has(fingerprint)) continue
    seen.add(fingerprint)
    const label =
      typeof source.nome === 'string' ? source.nome : `Camada ${source.camadaId ?? 'não informada'}`
    for (const key of [
      'nome',
      'camadaId',
      'arquivo',
      'arquivoId',
      'fonte',
      'fonteId',
      'versaoId',
      'dicionarioId',
      'dicionarioVersao',
      'hashArquivoOriginal',
    ])
      rows.push([label, key, value(source[key]), ''])
  }
  if (!sources.length) rows.push(['Fontes', 'Origem', 'Não disponível', ''])
  return rows
}
export function reportCsv(rows: ReportRow[]): string {
  return (
    '\uFEFF' +
    rows
      .map((row) =>
        row
          .map((cell) => {
            let text = String(cell)
            // Impede que textos sejam interpretados como fórmulas na planilha.
            if (typeof cell === 'string' && /^[\s]*[=+@-]/.test(text)) text = "'" + text
            return '"' + text.replace(/"/g, '""') + '"'
          })
          .join(';'),
      )
      .join('\r\n')
  )
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export async function exportExcel(rows: ReportRow[]) {
  const response = await axios.post<Blob>(
    '/ambiental/exportacoes/xlsx',
    { rows },
    { responseType: 'blob' },
  )
  download(response.data, 'indicador-ambiental.xlsx')
}
export function printReport(rows: ReportRow[]) {
  const win = window.open('', '_blank')
  if (!win) throw new Error('Permita abrir a janela de relatório para salvar o PDF.')
  win.opener = null
  win.document.title = 'GeoRural DataHub — Indicador ambiental'
  const style = win.document.createElement('style')
  style.textContent =
    'body{font:12px Arial,sans-serif;color:#17252b;padding:24px}h1{font-size:22px}table{width:100%;border-collapse:collapse}th,td{padding:8px;text-align:left;border-bottom:1px solid #ddd;overflow-wrap:anywhere}th{background:#eaf1ed}thead{display:table-header-group}tr{break-inside:avoid}button{padding:10px;margin:12px 0}@media print{button{display:none}body{padding:0}@page{size:A4;margin:15mm}}'
  win.document.head.append(style)
  const title = win.document.createElement('h1')
  title.textContent = 'GeoRural DataHub · Indicador ambiental'
  win.document.body.append(title)
  const note = win.document.createElement('p')
  note.textContent =
    'Na impressão, escolha Salvar como PDF. Valores ausentes são identificados como não disponíveis.'
  win.document.body.append(note)
  const button = win.document.createElement('button')
  button.textContent = 'Imprimir / salvar PDF'
  button.onclick = () => win.print()
  win.document.body.append(button)
  const table = win.document.createElement('table'),
    thead = win.document.createElement('thead'),
    tbody = win.document.createElement('tbody')
  rows.forEach((row, i) => {
    const tr = win.document.createElement('tr')
    row.forEach((cell) => {
      const td = win.document.createElement(i === 0 ? 'th' : 'td')
      td.textContent = String(cell)
      tr.append(td)
    })
    ;(i === 0 ? thead : tbody).append(tr)
  })
  table.append(thead, tbody)
  win.document.body.append(table)
  win.focus()
}
