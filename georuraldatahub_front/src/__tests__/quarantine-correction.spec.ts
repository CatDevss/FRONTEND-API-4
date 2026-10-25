import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import QuarantineCorrectionDialog from '@/components/QuarantineCorrectionDialog.vue'
import { correctionTargets, parseValidationError } from '@/services/quarantine'
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
})

function reportOpenWith(records: ReportRecord[]) {
  return reportOf(records)
}