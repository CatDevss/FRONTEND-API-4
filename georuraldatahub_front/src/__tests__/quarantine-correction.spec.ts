import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import QuarantineCorrectionDialog from '@/components/QuarantineCorrectionDialog.vue'
import {
  correctionTargets,
  draftError,
  editorKind,
  errorOwner,
  initialDraft,
  parseValidationError,
  recordCorrection,
  type ErrorOwner,
} from '@/services/quarantine'
import type { ValidationReport } from '@/services/contracts'

type ReportRecord = ValidationReport['records'][number]
const rejected = (recordIndex: number, errors: string[], rawContent = `{"id":${recordIndex}}`) =>
  ({ recordIndex, rawContent, valid: false, errors }) satisfies ReportRecord
const approved = (recordIndex: number) =>
  ({ recordIndex, rawContent: `{"id":${recordIndex}}`, valid: true, errors: [] }) satisfies ReportRecord
function reportOf(records: ReportRecord[]): ValidationReport {
  return {
    status: 'PARCIAL',
    dictionaryId: 10,
    dictionaryVersion: 2,
    validRecords: records.filter((entry) => entry.valid).length,
    rejectedRecords: records.filter((entry) => !entry.valid && entry.recordIndex >= 0).length,
    records,
  }
}

describe('quarantine correction helpers', () => {
  it('separates known error codes from the detail', () => {
    expect(parseValidationError('REQUIRED_FIELD: nome')).toEqual({
      code: 'REQUIRED_FIELD',
      label: 'Campo obrigatório',
      detail: 'nome',
    })
    expect(parseValidationError('INVALID_GEOMETRY: anel não fechado: linha 3').detail).toBe(
      'anel não fechado: linha 3',
    )
  })
  it('keeps messages without a known code untouched', () => {
    expect(parseValidationError('Arquivo sem geometria válida.')).toEqual({
      code: '',
      label: '',
      detail: 'Arquivo sem geometria válida.',
    })
    expect(parseValidationError('OUTRO_CODIGO: algo').code).toBe('')
    expect(parseValidationError('constructor: algo').code).toBe('')
    expect(parseValidationError(': sem código').code).toBe('')
  })
  it('splits file-level errors from rejected records and ignores approved ones', () => {
    const targets = correctionTargets(
      reportOf([rejected(-1, ['MALFORMED_FILE: x']), approved(0), rejected(1, ['REQUIRED_FIELD: a'])]),
    )
    expect(targets.fileErrors.map((entry) => entry.recordIndex)).toEqual([-1])
    expect(targets.rejected.map((entry) => entry.recordIndex)).toEqual([1])
    expect(correctionTargets(null)).toEqual({ fileErrors: [], rejected: [] })
  })
})

describe('quarantine correction rules', () => {
  it('accepts bare error codes emitted without detail', () => {
    expect(parseValidationError('INVALID_GEOMETRY')).toEqual({
      code: 'INVALID_GEOMETRY',
      label: 'Geometria inválida',
      detail: '',
    })
    expect(parseValidationError('EMPTY_FILE').label).toBe('Arquivo vazio')
    expect(parseValidationError('INVALID_COLUMN_COUNT').code).toBe('INVALID_COLUMN_COUNT')
  })
  it.each<[string, number, ErrorOwner]>([
    ['INVALID_GEOMETRY', 2, 'operator'],
    ['INVALID_GEOMETRY: geometry', 2, 'operator'],
    ['INVALID_COORDINATES: latitude', 0, 'operator'],
    ['INVALID_TYPE: area', 0, 'operator'],
    ['REQUIRED_FIELD: nome', 3, 'operator'],
    ['DUPLICATE_VALUE: codigo', 1, 'operator'],
    ['INVALID_RECORD_STRUCTURE', 1, 'operator'],
    ['INVALID_COLUMN_COUNT', 5, 'operator'],
    ['mensagem sem código', 4, 'operator'],
    ['UNKNOWN_FIELD: area_ha', 3, 'manager'],
    ['UNKNOWN_FIELD: coluna_nova', -1, 'manager'],
    ['UNKNOWN_VALUE: uf=XX', 2, 'either'],
    ['REQUIRED_FIELD: nome', -1, 'file'],
    ['MALFORMED_FILE: aspas abertas', -1, 'file'],
    ['INVALID_FILE_STRUCTURE', -1, 'file'],
    ['EMPTY_FILE', -1, 'file'],
    ['UNSUPPORTED_FORMAT: shp', -1, 'file'],
    ['mensagem sem código', -1, 'file'],
  ])('classifies %s (registro %i) as %s', (message, index, owner) => {
    expect(errorOwner(message, index)).toBe(owner)
  })
  it('decides whether a record is editable and whether it needs the manager', () => {
    expect(recordCorrection({ recordIndex: 1, errors: ['INVALID_GEOMETRY'] })).toEqual({
      editable: true,
      needsManager: false,
    })
    expect(recordCorrection({ recordIndex: 1, errors: ['UNKNOWN_FIELD: x'] })).toEqual({
      editable: false,
      needsManager: true,
    })
    expect(
      recordCorrection({ recordIndex: 1, errors: ['UNKNOWN_FIELD: x', 'INVALID_TYPE: area'] }),
    ).toEqual({ editable: true, needsManager: true })
    expect(recordCorrection({ recordIndex: 1, errors: ['UNKNOWN_VALUE: uf=XX'] })).toEqual({
      editable: true,
      needsManager: false,
    })
  })
  it('prepares and validates correction drafts', () => {
    expect(editorKind('{"a":1}')).toBe('json')
    expect(editorKind('"a","b"')).toBe('text')
    expect(initialDraft('{"a":1}')).toBe('{\n  "a": 1\n}')
    expect(initialDraft('{quebrado')).toBe('{quebrado')
    expect(initialDraft('"a","b"')).toBe('"a","b"')
    expect(draftError('   ', '{"a":1}')).toBe('A correção não pode ficar vazia.')
    expect(draftError('{ nope', '{"a":1}')).toContain('JSON inválido')
    expect(draftError('[1]', '{"a":1}')).toBe('O registro precisa ser um objeto JSON.')
    expect(draftError('null', '{"a":1}')).toBe('O registro precisa ser um objeto JSON.')
    expect(draftError('{"a":2}', '{"a":1}')).toBe('')
    expect(draftError('"a","b"', '"a","b"')).toBe('')
  })
})

describe('QuarantineCorrectionDialog', () => {
  let cleanups: (() => void)[] = []
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    )
    vi.stubGlobal('visualViewport', {
      width: 1400,
      height: 1000,
      offsetTop: 0,
      offsetLeft: 0,
      addEventListener() {},
      removeEventListener() {},
    })
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    }))
  })
  afterEach(async () => {
    cleanups.forEach((cleanup) => cleanup())
    cleanups = []
    await flushPromises()
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })
  function mountDialog(props: Partial<InstanceType<typeof QuarantineCorrectionDialog>['$props']> = {}) {
    const w = mount(QuarantineCorrectionDialog, {
      attachTo: document.body,
      props: { modelValue: true, fileName: 'municipios.geojson', report: null, loading: false, error: '', ...props },
      global: { plugins: [createVuetify({ components, directives })] },
    })
    cleanups.push(() => w.unmount())
    return w
  }
  const text = () => document.body.textContent ?? ''

  it('lists file errors and rejected records with readable labels', async () => {
    mountDialog({
      report: reportOpenWith([
        rejected(-1, ['UNSUPPORTED_FORMAT: shp']),
        approved(0),
        rejected(4, ['REQUIRED_FIELD: nome', 'INVALID_TYPE: area deve ser número'], '{"area":"abc"}'),
      ]),
    })
    await flushPromises()
    expect(text()).toContain('Registros para corrigir')
    expect(text()).toContain('municipios.geojson')
    expect(text()).toContain('Erros do arquivo')
    expect(text()).toContain('Formato não suportado')
    expect(text()).toContain('Registros rejeitados (1)')
    expect(text()).toContain('Índice do registro: 4')
    expect(text()).toContain('Campo obrigatório')
    expect(text()).toContain('area deve ser número')
    expect(text()).toContain('{"area":"abc"}')
    expect(text()).toContain('PARCIAL: 1 registro(s) aprovado(s), 1 rejeitado(s).')
  })

  it('renders backend text as plain text', async () => {
    mountDialog({
      report: reportOpenWith([
        rejected(2, ['<script>alert(1)</script>'], '<img src=x onerror="alert(1)">'),
      ]),
    })
    await flushPromises()
    expect(document.body.querySelector('img')).toBeNull()
    expect(document.body.querySelector('.raw-content script')).toBeNull()
    expect(text()).toContain('<script>alert(1)</script>')
    expect(text()).toContain('<img src=x onerror="alert(1)">')
  })

  it('paginates rejected records on the client', async () => {
    const records = Array.from({ length: 25 }, (_, index) => rejected(index, ['REQUIRED_FIELD: nome']))
    const w = mountDialog({ report: reportOpenWith(records) })
    await flushPromises()
    expect(text()).toContain('Registros rejeitados (25)')
    expect(document.body.querySelectorAll('.rejected-record')).toHaveLength(10)
    w.findComponent(components.VPagination).vm.$emit('update:modelValue', 3)
    await flushPromises()
    const shown = [...document.body.querySelectorAll('.rejected-record')]
    expect(shown).toHaveLength(5)
    expect(shown[0]!.getAttribute('data-record-index')).toBe('20')
  })

  it('shows loading, error with retry and unavailable report states', async () => {
    const w = mountDialog({ loading: true })
    await flushPromises()
    expect(document.body.querySelector('[aria-label="Carregando relatório de validação"]')).not.toBeNull()
    expect(text()).not.toContain('Relatório indisponível')
    await w.setProps({ loading: false, error: 'Falha ao carregar.' })
    expect(text()).toContain('Falha ao carregar.')
    const retry = [...document.body.querySelectorAll('button')].find(
      (entry) => entry.textContent?.trim() === 'Tentar novamente',
    )!
    retry.click()
    expect(w.emitted('retry')).toHaveLength(1)
    await w.setProps({ error: '' })
    expect(text()).toContain('Relatório indisponível. Não presuma aprovação dos dados.')
  })

  it('reports when nothing was rejected and closes on request', async () => {
    const w = mountDialog({ report: reportOpenWith([approved(0), approved(1)]) })
    await flushPromises()
    expect(text()).toContain('Nenhum registro rejeitado no relatório.')
    const close = [...document.body.querySelectorAll('button')].find(
      (entry) => entry.textContent?.trim() === 'Fechar',
    )!
    close.click()
    expect(w.emitted('update:modelValue')?.[0]).toEqual([false])
  })
  async function typeInto(selector: string, value: string) {
    const element = document.body.querySelector<HTMLTextAreaElement>(selector)!
    element.value = value
    element.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
  }
  const geometryRecord =
    '{"type":"Feature","geometry":{"type":"Point","coordinates":[1,"x"]},"properties":{"nome":"A"}}'

  it('offers a correction field only where the operator can act and flags dictionary dependencies', async () => {
    mountDialog({
      report: reportOpenWith([
        rejected(1, ['INVALID_GEOMETRY'], geometryRecord),
        rejected(2, ['UNKNOWN_FIELD: area_ha'], '{"area_ha":"3"}'),
      ]),
    })
    await flushPromises()
    const first = document.body.querySelector('article[data-record-index="1"]')!
    const second = document.body.querySelector('article[data-record-index="2"]')!
    expect(first.textContent).toContain('Operador pode corrigir')
    expect(first.textContent).toContain('Geometria inválida')
    const field = first.querySelector<HTMLTextAreaElement>('textarea')!
    expect(field.value).toBe(JSON.stringify(JSON.parse(geometryRecord), null, 2))
    expect(second.querySelector('textarea')).toBeNull()
    expect(second.textContent).toContain('Depende do dicionário (gestor)')
    expect(second.textContent).toContain('ajuste no dicionário')
    expect(first.textContent).toContain('Conteúdo original (preservado)')
  })

  it('labels who resolves each file-level error', async () => {
    mountDialog({
      report: reportOpenWith([rejected(-1, ['UNKNOWN_FIELD: coluna_nova', 'MALFORMED_FILE: x'])]),
    })
    await flushPromises()
    expect(text()).toContain('Depende do dicionário (gestor)')
    expect(text()).toContain('Reenviar o arquivo')
  })

  it('keeps a draft, validates JSON and restores the original', async () => {
    mountDialog({ report: reportOpenWith([rejected(1, ['INVALID_GEOMETRY'], geometryRecord)]) })
    await flushPromises()
    const selector = 'article[data-record-index="1"] textarea'
    expect(text()).not.toContain('Rascunho alterado')
    await typeInto(selector, '{ nope')
    expect(text()).toContain('JSON inválido')
    expect(text()).toContain('Rascunho alterado')
    expect(text()).toContain('1 correção em rascunho')
    await typeInto(selector, '{"type":"Feature","geometry":{"type":"Point","coordinates":[1,2]}}')
    expect(text()).not.toContain('JSON inválido')
    expect(text()).toContain('1 correção em rascunho')
    const restore = [...document.body.querySelectorAll('button')].find(
      (entry) => entry.textContent?.trim() === 'Restaurar original',
    )!
    restore.click()
    await flushPromises()
    expect(text()).not.toContain('Rascunho alterado')
    expect(text()).not.toContain('correção em rascunho')
    expect(document.body.querySelector<HTMLTextAreaElement>(selector)!.value).toBe(
      JSON.stringify(JSON.parse(geometryRecord), null, 2),
    )
  })

  it('keeps drafts across pages and discards them when the report changes', async () => {
    const records = Array.from({ length: 12 }, (_, index) =>
      rejected(index, ['INVALID_TYPE: area'], '{"area":"abc"}'),
    )
    const w = mountDialog({ report: reportOpenWith(records) })
    await flushPromises()
    await typeInto('article[data-record-index="0"] textarea', '{"area":10}')
    w.findComponent(components.VPagination).vm.$emit('update:modelValue', 2)
    await flushPromises()
    expect(document.body.querySelector('article[data-record-index="0"]')).toBeNull()
    expect(text()).toContain('1 correção em rascunho')
    w.findComponent(components.VPagination).vm.$emit('update:modelValue', 1)
    await flushPromises()
    expect(
      document.body.querySelector<HTMLTextAreaElement>('article[data-record-index="0"] textarea')!
        .value,
    ).toBe('{"area":10}')
    await w.setProps({ report: reportOpenWith(records.slice()) })
    await flushPromises()
    expect(text()).not.toContain('correção em rascunho')
  })

  it('lets the operator edit CSV rows as text without JSON validation', async () => {
    mountDialog({ report: reportOpenWith([rejected(0, ['INVALID_COLUMN_COUNT'], '"a","b"')]) })
    await flushPromises()
    const selector = 'article[data-record-index="0"] textarea'
    expect(document.body.querySelector<HTMLTextAreaElement>(selector)!.value).toBe('"a","b"')
    expect(text()).toContain('Linha CSV')
    await typeInto(selector, '"a","b","c"')
    expect(text()).toContain('1 correção em rascunho')
    expect(text()).not.toContain('JSON inválido')
  })
})

function reportOpenWith(records: ReportRecord[]) {
  return reportOf(records)
}